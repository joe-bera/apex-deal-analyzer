import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { createSignedUploadUrl, getSignedDownloadUrl, deleteFromStorage } from '../services/storageService';
import crypto from 'crypto';

/**
 * Get deal room overview: documents, invites, recent activity
 * GET /api/crm-deals/:dealId/room
 */
export const getDealRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { dealId } = req.params;

    const [docsResult, invitesResult, activityResult] = await Promise.all([
      supabaseAdmin
        .from('deal_room_documents')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('deal_room_invites')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('deal_room_activity_log')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    res.status(200).json({
      success: true,
      documents: docsResult.data || [],
      invites: invitesResult.data || [],
      activity: activityResult.data || [],
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Get signed upload URL for deal room file
 * POST /api/crm-deals/:dealId/room/upload-url
 */
export const getUploadUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { file_name } = req.body;

    if (!file_name) throw new AppError(400, 'file_name is required');

    const result = await createSignedUploadUrl(file_name, req.user.id);

    res.status(200).json({
      success: true,
      upload_url: result.signedUrl,
      storage_path: result.storagePath,
      token: result.token,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Add document record after file upload
 * POST /api/crm-deals/:dealId/room/documents
 */
export const addDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { dealId } = req.params;
    const { storage_path, file_name, file_size, file_type, category, description, is_visible_to_external } = req.body;

    if (!storage_path || !file_name) {
      throw new AppError(400, 'storage_path and file_name are required');
    }

    const { data: doc, error } = await supabaseAdmin
      .from('deal_room_documents')
      .insert({
        deal_id: dealId,
        file_name,
        file_path: storage_path,
        file_size: file_size || null,
        file_type: file_type || null,
        category: category || 'other',
        description: description || null,
        is_visible_to_external: is_visible_to_external !== false,
        uploaded_by: req.user.id,
      })
      .select()
      .single();

    if (error || !doc) {
      console.error('Error adding deal room document:', error);
      throw new AppError(500, 'Failed to add document');
    }

    // Log activity
    await supabaseAdmin.from('deal_room_activity_log').insert({
      deal_id: dealId,
      document_id: doc.id,
      user_id: req.user.id,
      action: 'uploaded',
      metadata: { file_name },
    });

    res.status(201).json({ success: true, document: doc });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Delete a deal room document
 * DELETE /api/crm-deals/:dealId/room/documents/:docId
 */
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { dealId, docId } = req.params;

    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('deal_room_documents')
      .select('id, file_path, file_name')
      .eq('id', docId)
      .eq('deal_id', dealId)
      .single();

    if (fetchError || !doc) throw new AppError(404, 'Document not found');

    // Delete from storage
    try {
      await deleteFromStorage(doc.file_path);
    } catch {
      console.error('Failed to delete file from storage, continuing with DB delete');
    }

    const { error } = await supabaseAdmin
      .from('deal_room_documents')
      .delete()
      .eq('id', docId);

    if (error) throw new AppError(500, 'Failed to delete document');

    // Log activity
    await supabaseAdmin.from('deal_room_activity_log').insert({
      deal_id: dealId,
      user_id: req.user.id,
      action: 'deleted_document',
      metadata: { file_name: doc.file_name },
    });

    res.status(200).json({ success: true, message: 'Document deleted' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Create an invite for external party access
 * POST /api/crm-deals/:dealId/room/invites
 */
export const createInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { dealId } = req.params;
    const { email, name, expires_in_days } = req.body;

    if (!email) throw new AppError(400, 'email is required');

    const access_token = crypto.randomBytes(32).toString('hex');
    const expires_at = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
      : null;

    const { data: invite, error } = await supabaseAdmin
      .from('deal_room_invites')
      .insert({
        deal_id: dealId,
        email,
        name: name || null,
        access_token,
        expires_at,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error || !invite) {
      console.error('Error creating invite:', error);
      throw new AppError(500, 'Failed to create invite');
    }

    // Log activity
    await supabaseAdmin.from('deal_room_activity_log').insert({
      deal_id: dealId,
      invite_id: invite.id,
      user_id: req.user.id,
      action: 'invited',
      metadata: { email, name },
    });

    res.status(201).json({ success: true, invite });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Revoke an invite
 * DELETE /api/crm-deals/:dealId/room/invites/:inviteId
 */
export const revokeInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { dealId, inviteId } = req.params;

    const { data: invite, error: fetchError } = await supabaseAdmin
      .from('deal_room_invites')
      .select('id, email')
      .eq('id', inviteId)
      .eq('deal_id', dealId)
      .single();

    if (fetchError || !invite) throw new AppError(404, 'Invite not found');

    const { error } = await supabaseAdmin
      .from('deal_room_invites')
      .delete()
      .eq('id', inviteId);

    if (error) throw new AppError(500, 'Failed to revoke invite');

    // Log activity
    await supabaseAdmin.from('deal_room_activity_log').insert({
      deal_id: dealId,
      user_id: req.user.id,
      action: 'revoked',
      metadata: { email: invite.email },
    });

    res.status(200).json({ success: true, message: 'Invite revoked' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Get activity log for a deal room
 * GET /api/crm-deals/:dealId/room/activity
 */
export const getActivityLog = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { dealId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('deal_room_activity_log')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new AppError(500, 'Failed to fetch activity log');

    res.status(200).json({ success: true, activity: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Public: Get deal room by access token
 * GET /api/deal-room/:token
 */
export const getPublicDealRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('deal_room_invites')
      .select('*, deal:crm_deals(id, deal_name)')
      .eq('access_token', token)
      .single();

    if (inviteError || !invite) {
      throw new AppError(404, 'Invalid or expired link');
    }

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      throw new AppError(410, 'This link has expired');
    }

    // Update last accessed
    await supabaseAdmin
      .from('deal_room_invites')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', invite.id);

    // Fetch visible documents
    const { data: documents } = await supabaseAdmin
      .from('deal_room_documents')
      .select('id, file_name, file_size, file_type, category, description, created_at')
      .eq('deal_id', invite.deal_id)
      .eq('is_visible_to_external', true)
      .order('created_at', { ascending: false });

    // Generate signed download URLs
    const docsWithUrls = await Promise.all(
      (documents || []).map(async (doc: any) => {
        // We only need the download URL when user clicks, but provide file info
        return { ...doc };
      })
    );

    // Log view activity
    await supabaseAdmin.from('deal_room_activity_log').insert({
      deal_id: invite.deal_id,
      invite_id: invite.id,
      action: 'viewed',
      metadata: { email: invite.email, name: invite.name },
    });

    res.status(200).json({
      success: true,
      deal_name: invite.deal?.deal_name || 'Deal Room',
      invite_name: invite.name,
      invite_email: invite.email,
      documents: docsWithUrls,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Public: Download a document from deal room
 * POST /api/deal-room/:token/download/:docId
 */
export const logPublicDownload = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, docId } = req.params;

    // Validate token
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('deal_room_invites')
      .select('id, deal_id, email, name, expires_at')
      .eq('access_token', token)
      .single();

    if (inviteError || !invite) {
      throw new AppError(404, 'Invalid or expired link');
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      throw new AppError(410, 'This link has expired');
    }

    // Fetch document
    const { data: doc, error: docError } = await supabaseAdmin
      .from('deal_room_documents')
      .select('id, file_path, file_name')
      .eq('id', docId)
      .eq('deal_id', invite.deal_id)
      .eq('is_visible_to_external', true)
      .single();

    if (docError || !doc) {
      throw new AppError(404, 'Document not found');
    }

    // Generate signed download URL
    const downloadUrl = await getSignedDownloadUrl(doc.file_path);

    // Log download activity
    await supabaseAdmin.from('deal_room_activity_log').insert({
      deal_id: invite.deal_id,
      document_id: doc.id,
      invite_id: invite.id,
      action: 'downloaded',
      metadata: { email: invite.email, name: invite.name, file_name: doc.file_name },
    });

    res.status(200).json({
      success: true,
      download_url: downloadUrl,
      file_name: doc.file_name,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
