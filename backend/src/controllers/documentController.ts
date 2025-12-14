import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { uploadToStorage } from '../services/storageService';
import { cleanupFile } from '../middleware/upload';
import { parsePDF, cleanPDFText } from '../services/pdfService';
import { extractPropertyData, DocumentType } from '../services/extractionService';

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

    const { property_id, document_type = 'other' } = req.body;

    // Validate document_type
    const validTypes = [
      'offering_memorandum',
      'title_report',
      'comp',
      'lease',
      'appraisal',
      'environmental_report',
      'other',
    ];

    if (!validTypes.includes(document_type)) {
      cleanupFile(req.file.path);
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
        cleanupFile(req.file.path);
        throw new AppError(404, 'Property not found');
      }

      // Check if user owns the property or has access
      if (property.created_by !== req.user.id) {
        // TODO: Check shared_access table for permission
        cleanupFile(req.file.path);
        throw new AppError(403, 'You do not have access to this property');
      }
    }

    // Extract text from PDF before uploading
    let extractedText = '';
    let pdfMetadata = {};

    // Limit extracted text to prevent database issues with very large PDFs
    const MAX_EXTRACTED_TEXT_LENGTH = 500000; // ~500KB of text

    try {
      const pdfData = await parsePDF(req.file.path);
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

    // Upload file to Supabase Storage
    const { filePath, publicUrl } = await uploadToStorage(
      req.file.path,
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

    // Clean up temporary file
    cleanupFile(req.file.path);

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
    // Clean up temporary file on error
    if (req.file) {
      cleanupFile(req.file.path);
    }

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

    res.status(200).json({
      success: true,
      message: document.document_type === 'comp' && document.property_id
        ? 'Comp data extracted and added to property successfully'
        : 'Property data extracted successfully',
      extracted_data: extractedData,
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
