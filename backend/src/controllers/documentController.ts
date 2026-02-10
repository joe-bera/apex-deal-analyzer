import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { uploadToStorage, createSignedUploadUrl, getPublicUrl, getSignedDownloadUrl } from '../services/storageService';
import { parsePDF, parsePDFFromURL, cleanPDFText } from '../services/pdfService';
import { extractPropertyData, DocumentType, HistoricalTransaction } from '../services/extractionService';

/**
 * Store extracted historical transactions in the transactions table
 * Links to master_properties table for property history tracking
 */
const storeTransactionHistory = async (
  transactions: HistoricalTransaction[],
  propertyAddress: string,
  propertyCity: string | undefined,
  propertyState: string | undefined,
  userId: string,
  documentId: string
): Promise<{ stored: number; errors: string[] }> => {
  const errors: string[] = [];
  let stored = 0;

  if (!transactions || transactions.length === 0) {
    return { stored: 0, errors: [] };
  }

  // First, try to find or create a master_property for this address
  let masterPropertyId: string | null = null;

  // Normalize address for matching
  const normalizeAddr = (addr: string) =>
    addr.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\./g, '')
      .replace(/ street| st| avenue| ave| boulevard| blvd| drive| dr| road| rd| lane| ln| court| ct| place| pl| way/gi, '')
      .replace(/ north| south| east| west| n| s| e| w/gi, '')
      .replace(/[^a-z0-9]/g, '');

  try {
    // Check if property exists in master_properties
    const { data: existingProperty } = await supabaseAdmin
      .from('master_properties')
      .select('id')
      .eq('address_normalized', normalizeAddr(propertyAddress))
      .eq('city', propertyCity?.toLowerCase() || '')
      .maybeSingle();

    if (existingProperty) {
      masterPropertyId = existingProperty.id;
    } else {
      // Create new master_property
      const { data: newProperty, error: createError } = await supabaseAdmin
        .from('master_properties')
        .insert({
          address: propertyAddress,
          city: propertyCity,
          state: propertyState || 'CA',
          source: 'pdf_extract',
          created_by: userId,
          notes: `Created from document extraction (doc: ${documentId})`,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('[storeTransactionHistory] Failed to create master property:', createError);
        errors.push(`Failed to create property record: ${createError.message}`);
      } else {
        masterPropertyId = newProperty.id;
      }
    }

    if (!masterPropertyId) {
      return { stored: 0, errors };
    }

    // Now store each transaction
    for (const tx of transactions) {
      // Map transaction_type to our enum
      let txType: 'sale' | 'lease' | 'listing' | 'off_market' = 'sale';
      if (tx.transaction_type === 'lease') {
        txType = 'lease';
      } else if (tx.transaction_type === 'refinance' || tx.transaction_type === 'transfer') {
        txType = 'off_market';
      }

      const txRecord = {
        property_id: masterPropertyId,
        transaction_type: txType,
        transaction_date: tx.transaction_date || null,
        sale_price: tx.sale_price || null,
        price_per_sf: tx.price_per_sf || null,
        buyer_name: tx.buyer || null,
        seller_name: tx.seller || null,
        source: 'pdf_extract' as const,
        notes: tx.notes || `Extracted from document (doc: ${documentId})`,
        created_by: userId,
      };

      const { error: insertError } = await supabaseAdmin
        .from('transactions')
        .insert(txRecord);

      if (insertError) {
        console.error('[storeTransactionHistory] Failed to insert transaction:', insertError);
        errors.push(`Failed to store transaction from ${tx.transaction_date || 'unknown date'}: ${insertError.message}`);
      } else {
        stored++;
      }
    }
  } catch (error) {
    console.error('[storeTransactionHistory] Unexpected error:', error);
    errors.push(`Unexpected error storing transactions: ${String(error)}`);
  }

  return { stored, errors };
};

/**
 * Upload a document (PDF)
 * POST /api/documents/upload
 *
 * Requires: Authentication, file in multipart/form-data
 * Optional: property_id, document_type
 */
export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    // Ensure file was uploaded
    if (!req.file) {
      throw new AppError(400, 'No file uploaded');
    }

    // Debug logging for file upload
    console.log('[DocumentController] File received:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      bufferLength: req.file.buffer?.length || 0,
      hasBuffer: !!req.file.buffer,
      fieldname: req.file.fieldname,
    });

    const { property_id, document_type = 'other' } = req.body;

    // Validate document_type
    const validTypes = [
      'offering_memorandum',
      'property_profile',
      'title_report',
      'comp',
      'lease',
      'appraisal',
      'environmental_report',
      'other',
    ];

    if (!validTypes.includes(document_type)) {
      throw new AppError(400, `Invalid document_type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Ensure we have file buffer (memory storage)
    if (!req.file.buffer) {
      throw new AppError(400, 'File upload failed - no file data received');
    }

    // If property_id provided, verify it exists and user has access
    if (property_id) {
      const { data: property, error } = await supabaseAdmin
        .from('properties')
        .select('id, created_by')
        .eq('id', property_id)
        .single();

      if (error || !property) {
        throw new AppError(404, 'Property not found');
      }

    }

    // Extract text from PDF before uploading
    let extractedText = '';
    let pdfMetadata = {};

    // Limit extracted text to prevent database issues with very large PDFs
    const MAX_EXTRACTED_TEXT_LENGTH = 500000; // ~500KB of text

    try {
      const pdfData = await parsePDF(req.file.buffer);
      extractedText = cleanPDFText(pdfData.text);

      // Truncate if too long
      if (extractedText.length > MAX_EXTRACTED_TEXT_LENGTH) {
        console.log(`[DocumentController] Truncating extracted text from ${extractedText.length} to ${MAX_EXTRACTED_TEXT_LENGTH} chars`);
        extractedText = extractedText.substring(0, MAX_EXTRACTED_TEXT_LENGTH) + '\n\n[Text truncated due to length...]';
      }

      pdfMetadata = {
        num_pages: pdfData.numPages,
        title: pdfData.info.Title,
        author: pdfData.info.Author,
        creation_date: pdfData.info.CreationDate,
      };
    } catch (error) {
      console.error('PDF extraction failed:', error);
      // Continue with upload even if extraction fails
    }

    // Upload file buffer to Supabase Storage
    const { filePath, publicUrl } = await uploadToStorage(
      req.file.buffer,
      req.file.originalname,
      req.user.id
    );

    // Create document record in database with extracted text
    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        property_id: property_id || null,
        uploaded_by: req.user.id,
        file_name: req.file.originalname,
        file_path: filePath,
        file_size: req.file.size,
        document_type,
        extraction_status: extractedText ? 'completed' : 'pending',
        extracted_data: extractedText
          ? {
              raw_text: extractedText,
              metadata: pdfMetadata,
              extracted_at: new Date().toISOString(),
            }
          : null,
      })
      .select()
      .single();

    if (dbError || !document) {
      console.error('[DocumentController] Database error creating document:', dbError);
      console.error('[DocumentController] Extracted text length:', extractedText?.length || 0);
      throw new AppError(500, 'Failed to create document record');
    }

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        file_name: document.file_name,
        file_size: document.file_size,
        document_type: document.document_type,
        extraction_status: document.extraction_status,
        uploaded_at: document.uploaded_at,
        url: publicUrl,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Upload error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload document' });
    }
  }
};

/**
 * Get document by ID
 * GET /api/documents/:id
 */
export const getDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;

    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !document) {
      throw new AppError(404, 'Document not found');
    }

    // Check access permission
    if (document.uploaded_by !== req.user.id) {
      // TODO: Check if user has access via property ownership or shared_access
      throw new AppError(403, 'You do not have access to this document');
    }

    res.status(200).json({
      success: true,
      document,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to fetch document' });
    }
  }
};

/**
 * List user's documents
 * GET /api/documents
 */
export const listDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { property_id, document_type, limit = 50, offset = 0 } = req.query;

    let query = supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('uploaded_by', req.user.id)
      .order('uploaded_at', { ascending: false });

    if (property_id) {
      query = query.eq('property_id', property_id as string);
    }

    if (document_type) {
      query = query.eq('document_type', document_type as string);
    }

    query = query.range(
      parseInt(offset as string),
      parseInt(offset as string) + parseInt(limit as string) - 1
    );

    const { data: documents, error, count } = await query;

    if (error) {
      throw new AppError(500, 'Failed to fetch documents');
    }

    res.status(200).json({
      success: true,
      documents: documents || [],
      pagination: {
        total: count || 0,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to fetch documents' });
    }
  }
};

/**
 * Delete document
 * DELETE /api/documents/:id
 */
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;

    // Get document to check ownership
    const { data: document, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      throw new AppError(404, 'Document not found');
    }

    if (document.uploaded_by !== req.user.id) {
      throw new AppError(403, 'You do not have permission to delete this document');
    }

    // Delete from database (will cascade delete references)
    const { error: deleteError } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new AppError(500, 'Failed to delete document');
    }

    // TODO: Delete from Supabase Storage as well
    // await deleteFromStorage(document.file_path);

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Failed to delete document' });
    }
  }
};

/**
 * Extract property data from document using AI
 * POST /api/documents/:id/extract
 */
export const extractDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { id } = req.params;
    console.log(`[DocumentController] Starting extraction for document ${id}`);

    // Get document
    const { data: document, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      throw new AppError(404, 'Document not found');
    }

    // Check access permission
    if (document.uploaded_by !== req.user.id) {
      // TODO: Check if user has access via property ownership or shared_access
      throw new AppError(403, 'You do not have access to this document');
    }

    // Check if document has extracted text
    if (!document.extracted_data?.raw_text) {
      throw new AppError(400, 'Document has no extracted text. Please re-upload the document.');
    }

    // Update extraction status to processing
    await supabaseAdmin
      .from('documents')
      .update({ extraction_status: 'processing' })
      .eq('id', id);

    // Extract property data using Claude
    const extractedData = await extractPropertyData(
      document.extracted_data.raw_text,
      document.document_type as DocumentType
    );

    // Merge with existing extracted_data
    const updatedExtractedData = {
      ...document.extracted_data,
      structured_data: extractedData,
      extraction_completed_at: new Date().toISOString(),
    };

    // Update document with extracted property data
    const { data: updatedDoc, error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        extraction_status: 'completed',
        extracted_data: updatedExtractedData,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedDoc) {
      throw new AppError(500, 'Failed to save extracted data');
    }

    // If this is a comp document with a property_id, automatically create a comp record
    if (document.document_type === 'comp' && document.property_id && extractedData) {
      console.log('[DocumentController] Creating comp from extracted data:', {
        property_id: document.property_id,
        address: extractedData.address,
        city: extractedData.city,
        price: extractedData.price,
      });

      const compData = {
        property_id: document.property_id,
        created_by: req.user.id,
        comp_address: extractedData.address || 'Unknown',
        comp_city: extractedData.city || 'Unknown',
        comp_state: extractedData.state || 'CA',
        comp_zip_code: extractedData.zip_code,
        comp_property_type: extractedData.property_type || 'industrial',
        comp_square_footage: extractedData.building_size,
        comp_year_built: extractedData.year_built,
        comp_sale_price: extractedData.price || 0,
        comp_sale_date: extractedData.sale_date || new Date().toISOString().split('T')[0],
        comp_price_per_sqft: extractedData.price_per_sqft,
        comp_cap_rate: extractedData.cap_rate,
        adjustment_notes: extractedData.notes,
      };

      const { data: newComp, error: compError } = await supabaseAdmin
        .from('comps')
        .insert(compData)
        .select()
        .single();

      if (compError) {
        console.error('[DocumentController] Failed to create comp:', compError);
        // Don't fail the whole extraction if comp creation fails
      } else {
        console.log('[DocumentController] Comp created successfully:', newComp?.id);
      }
    }

    // Write extracted fields back to master_properties for property profiles and OMs
    if (
      ['property_profile', 'offering_memorandum'].includes(document.document_type) &&
      extractedData
    ) {
      // Find the master_properties record — by property_id if linked, otherwise by extracted address
      let masterPropertyId: string | null = document.property_id || null;

      if (!masterPropertyId && extractedData.address) {
        const normalizedExtracted = extractedData.address
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/\.$/g, '')
          .replace(/ street| st\.?| avenue| ave\.?| boulevard| blvd\.?| drive| dr\.?| road| rd\.?| lane| ln\.?| court| ct\.?| place| pl\.?| way/gi, '')
          .replace(/ north| south| east| west| n\.?| s\.?| e\.?| w\.?/gi, '')
          .replace(/[^a-z0-9]/g, '')
          .trim();

        console.log(`[DocumentController] Looking up master_properties by normalized address: "${normalizedExtracted}" city: "${extractedData.city}"`);

        let lookupQuery = supabaseAdmin
          .from('master_properties')
          .select('id')
          .eq('address_normalized', normalizedExtracted)
          .eq('is_deleted', false);

        if (extractedData.city) {
          lookupQuery = lookupQuery.ilike('city', extractedData.city.toLowerCase().trim());
        }

        const { data: matchedProperty } = await lookupQuery.limit(1).maybeSingle();

        if (matchedProperty) {
          masterPropertyId = matchedProperty.id;
          console.log(`[DocumentController] Matched master_properties record: ${masterPropertyId}`);
        } else {
          console.log(`[DocumentController] No master_properties match found for address: "${extractedData.address}"`);
        }
      }

      if (masterPropertyId) {
        // Map extracted fields to master_properties columns (only set non-null values)
        const propertyUpdate: Record<string, any> = {};
        if (extractedData.building_size) propertyUpdate.building_size = Math.round(extractedData.building_size);
        if (extractedData.lot_size) propertyUpdate.land_area_sf = Math.round(extractedData.lot_size);
        if (extractedData.year_built) propertyUpdate.year_built = extractedData.year_built;
        if (extractedData.stories) propertyUpdate.number_of_floors = extractedData.stories;
        if (extractedData.units) propertyUpdate.number_of_units = extractedData.units;
        if (extractedData.occupancy_rate) propertyUpdate.percent_leased = extractedData.occupancy_rate;
        if (extractedData.parking_spaces) propertyUpdate.parking_spaces = extractedData.parking_spaces;
        if (extractedData.zoning) propertyUpdate.zoning = extractedData.zoning;
        if (extractedData.subtype) propertyUpdate.property_subtype = extractedData.subtype;
        if (extractedData.market) propertyUpdate.market = extractedData.market;
        if (extractedData.submarket) propertyUpdate.submarket = extractedData.submarket;
        if (extractedData.apn) propertyUpdate.apn = extractedData.apn;
        if (extractedData.owner_name) propertyUpdate.owner_name = extractedData.owner_name;
        if (extractedData.owner_address) propertyUpdate.owner_address = extractedData.owner_address;

        if (Object.keys(propertyUpdate).length > 0) {
          propertyUpdate.updated_at = new Date().toISOString();
          const { error: propUpdateError } = await supabaseAdmin
            .from('master_properties')
            .update(propertyUpdate)
            .eq('id', masterPropertyId);

          if (propUpdateError) {
            console.error('[DocumentController] Failed to update master_properties:', propUpdateError);
          } else {
            console.log(`[DocumentController] Updated master_properties ${masterPropertyId} with ${Object.keys(propertyUpdate).length - 1} fields from extraction`);
          }
        }
      }
    }

    // Store historical transaction data from title reports and OMs
    let transactionHistoryResult = { stored: 0, errors: [] as string[] };
    if (
      extractedData.transaction_history &&
      extractedData.transaction_history.length > 0 &&
      extractedData.address
    ) {
      console.log(
        `[DocumentController] Found ${extractedData.transaction_history.length} historical transactions to store`
      );

      transactionHistoryResult = await storeTransactionHistory(
        extractedData.transaction_history,
        extractedData.address,
        extractedData.city,
        extractedData.state,
        req.user.id,
        id
      );

      console.log(
        `[DocumentController] Stored ${transactionHistoryResult.stored} transactions, ${transactionHistoryResult.errors.length} errors`
      );
    }

    // Build response message
    let message = 'Property data extracted successfully';
    if (document.document_type === 'comp' && document.property_id) {
      message = 'Comp data extracted and added to property successfully';
    }
    if (transactionHistoryResult.stored > 0) {
      message += `. Found and stored ${transactionHistoryResult.stored} historical transactions.`;
    }

    res.status(200).json({
      success: true,
      message,
      extracted_data: extractedData,
      transaction_history: {
        stored: transactionHistoryResult.stored,
        errors: transactionHistoryResult.errors,
      },
    });
  } catch (error) {
    // Update extraction status to failed
    if (req.params.id) {
      await supabaseAdmin
        .from('documents')
        .update({ extraction_status: 'failed' })
        .eq('id', req.params.id);
    }

    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Extraction error:', error);
      res.status(500).json({ success: false, error: 'Failed to extract property data' });
    }
  }
};

/**
 * Upload document from a URL (Dropbox, Google Drive share links, etc.)
 * POST /api/documents/upload-from-url
 *
 * Downloads the file from the provided URL and processes it.
 * Converts Dropbox/Google Drive share links to direct download URLs.
 */
export const uploadFromUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { url, file_name, property_id, document_type = 'other' } = req.body;

    if (!url) {
      throw new AppError(400, 'url is required');
    }

    // Validate document_type
    const validTypes = [
      'offering_memorandum', 'property_profile', 'title_report', 'comp', 'lease',
      'appraisal', 'environmental_report', 'other',
    ];
    if (!validTypes.includes(document_type)) {
      throw new AppError(400, `Invalid document_type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Convert cloud share links to direct download URLs
    let downloadUrl = url.trim();

    // Dropbox: change dl=0 to dl=1, or add dl=1
    if (downloadUrl.includes('dropbox.com')) {
      downloadUrl = downloadUrl.replace(/\?dl=0/, '?dl=1');
      if (!downloadUrl.includes('dl=1')) {
        downloadUrl += (downloadUrl.includes('?') ? '&' : '?') + 'dl=1';
      }
    }

    // Google Drive: convert share link to direct download
    const gdriveMatch = downloadUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (gdriveMatch) {
      downloadUrl = `https://drive.google.com/uc?export=download&id=${gdriveMatch[1]}`;
    }

    console.log('[DocumentController] Downloading from URL:', downloadUrl);

    // Download the file
    let response;
    try {
      response = await fetch(downloadUrl, {
        headers: { 'User-Agent': 'ApexDealAnalyzer/1.0' },
        redirect: 'follow',
      });
    } catch (fetchErr: any) {
      throw new AppError(400, `Failed to download file: ${fetchErr.message}`);
    }

    if (!response.ok) {
      throw new AppError(400, `Failed to download file: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    if (fileBuffer.length === 0) {
      throw new AppError(400, 'Downloaded file is empty. Please check the URL and sharing permissions.');
    }

    console.log('[DocumentController] Downloaded file, size:', fileBuffer.length);

    // Determine filename
    const resolvedName = file_name ||
      decodeURIComponent(downloadUrl.split('/').pop()?.split('?')[0] || 'document.pdf');

    // If property_id provided, verify access
    if (property_id) {
      const { data: property, error } = await supabaseAdmin
        .from('properties')
        .select('id, created_by')
        .eq('id', property_id)
        .single();

      if (error || !property) {
        throw new AppError(404, 'Property not found');
      }
    }

    // Parse PDF
    let extractedText = '';
    let pdfMetadata = {};
    const MAX_EXTRACTED_TEXT_LENGTH = 500000;

    try {
      const pdfData = await parsePDF(fileBuffer);
      extractedText = cleanPDFText(pdfData.text);
      if (extractedText.length > MAX_EXTRACTED_TEXT_LENGTH) {
        extractedText = extractedText.substring(0, MAX_EXTRACTED_TEXT_LENGTH) + '\n\n[Text truncated due to length...]';
      }
      pdfMetadata = {
        num_pages: pdfData.numPages,
        title: pdfData.info.Title,
        author: pdfData.info.Author,
        creation_date: pdfData.info.CreationDate,
      };
    } catch (parseErr) {
      console.error('PDF parsing error from URL:', parseErr);
    }

    // Upload to Supabase Storage
    const { filePath, publicUrl } = await uploadToStorage(fileBuffer, resolvedName, req.user.id);

    // Create document record
    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        property_id: property_id || null,
        uploaded_by: req.user.id,
        file_name: resolvedName,
        file_path: filePath,
        file_size: fileBuffer.length,
        document_type,
        extraction_status: extractedText ? 'completed' : 'pending',
        extracted_data: extractedText
          ? { raw_text: extractedText, metadata: pdfMetadata, extracted_at: new Date().toISOString() }
          : null,
      })
      .select()
      .single();

    if (dbError || !document) {
      console.error('[DocumentController] DB error creating document from URL:', dbError);
      throw new AppError(500, 'Failed to create document record');
    }

    res.status(201).json({
      success: true,
      message: 'Document uploaded from URL successfully',
      document: {
        id: document.id,
        file_name: document.file_name,
        file_size: document.file_size,
        document_type: document.document_type,
        extraction_status: document.extraction_status,
        uploaded_at: document.uploaded_at,
        url: publicUrl,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Upload from URL error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload document from URL' });
    }
  }
};

/**
 * Get a signed URL for direct upload to Supabase Storage
 * POST /api/documents/upload-url
 *
 * This bypasses Railway's proxy for file uploads
 */
export const getUploadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { file_name, file_size } = req.body;

    if (!file_name) {
      throw new AppError(400, 'file_name is required');
    }

    // Validate file size (50MB limit)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file_size && file_size > MAX_FILE_SIZE) {
      throw new AppError(400, 'File too large. Maximum size is 50MB.');
    }

    // Create signed upload URL
    const { signedUrl, storagePath, token } = await createSignedUploadUrl(
      file_name,
      req.user.id
    );

    res.status(200).json({
      success: true,
      upload_url: signedUrl,
      storage_path: storagePath,
      token,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Get upload URL error:', error);
      res.status(500).json({ success: false, error: 'Failed to create upload URL' });
    }
  }
};

/**
 * Create document record after direct upload to Supabase Storage
 * POST /api/documents/create
 *
 * Called after frontend uploads directly to Supabase Storage
 */
export const createDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    const { storage_path, file_name, file_size, property_id, document_type = 'other' } = req.body;

    if (!storage_path || !file_name) {
      throw new AppError(400, 'storage_path and file_name are required');
    }

    // Validate document_type
    const validTypes = [
      'offering_memorandum',
      'property_profile',
      'title_report',
      'comp',
      'lease',
      'appraisal',
      'environmental_report',
      'other',
    ];

    if (!validTypes.includes(document_type)) {
      throw new AppError(400, `Invalid document_type. Must be one of: ${validTypes.join(', ')}`);
    }

    // If property_id provided, verify it exists and user has access
    if (property_id) {
      const { data: property, error } = await supabaseAdmin
        .from('properties')
        .select('id, created_by')
        .eq('id', property_id)
        .single();

      if (error || !property) {
        throw new AppError(404, 'Property not found');
      }

    }

    // Get URLs for the uploaded file
    const publicUrl = getPublicUrl(storage_path);

    // Parse file_size - handle both number and string
    const parsedFileSize = typeof file_size === 'string' ? parseInt(file_size, 10) : (file_size || 0);
    console.log('[DocumentController] File size received:', file_size, 'parsed:', parsedFileSize);

    // Extract text from PDF using signed URL (works even if bucket is private)
    let extractedText = '';
    let pdfMetadata = {};
    const MAX_EXTRACTED_TEXT_LENGTH = 500000;

    try {
      const signedUrl = await getSignedDownloadUrl(storage_path);
      console.log('[DocumentController] Parsing PDF from signed URL');
      const pdfData = await parsePDFFromURL(signedUrl);
      extractedText = cleanPDFText(pdfData.text);

      if (extractedText.length > MAX_EXTRACTED_TEXT_LENGTH) {
        console.log(`[DocumentController] Truncating extracted text from ${extractedText.length} to ${MAX_EXTRACTED_TEXT_LENGTH} chars`);
        extractedText = extractedText.substring(0, MAX_EXTRACTED_TEXT_LENGTH) + '\n\n[Text truncated due to length...]';
      }

      pdfMetadata = {
        num_pages: pdfData.numPages,
        title: pdfData.info.Title,
        author: pdfData.info.Author,
        creation_date: pdfData.info.CreationDate,
      };
    } catch (error) {
      console.error('PDF extraction failed:', error);
      // Continue with document creation even if extraction fails
    }

    // Create document record (file_size must be > 0 due to DB constraint)
    const { data: document, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        property_id: property_id || null,
        uploaded_by: req.user.id,
        file_name,
        file_path: storage_path,
        file_size: parsedFileSize > 0 ? parsedFileSize : 1, // Ensure > 0 for DB constraint
        document_type,
        extraction_status: extractedText ? 'completed' : 'pending',
        extracted_data: extractedText
          ? {
              raw_text: extractedText,
              metadata: pdfMetadata,
              extracted_at: new Date().toISOString(),
            }
          : null,
      })
      .select()
      .single();

    if (dbError || !document) {
      console.error('[DocumentController] Database error creating document:', dbError);
      throw new AppError(500, 'Failed to create document record');
    }

    res.status(201).json({
      success: true,
      message: 'Document created successfully',
      document: {
        id: document.id,
        file_name: document.file_name,
        file_size: document.file_size,
        document_type: document.document_type,
        extraction_status: document.extraction_status,
        uploaded_at: document.uploaded_at,
        url: publicUrl,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('Create document error:', error);
      res.status(500).json({ success: false, error: 'Failed to create document' });
    }
  }
};
