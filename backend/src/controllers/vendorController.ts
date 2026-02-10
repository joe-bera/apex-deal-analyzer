import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

// List vendors with search/filter
export const listVendors = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { search, trade, is_preferred } = req.query;

    let query = supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('is_deleted', false)
      .order('name');

    if (search) {
      query = query.or(`name.ilike.%${search}%,company_name.ilike.%${search}%,trade.ilike.%${search}%`);
    }
    if (trade) {
      query = query.eq('trade', trade);
    }
    if (is_preferred === 'true') {
      query = query.eq('is_preferred', true);
    }

    const { data, error } = await query;

    if (error) throw new AppError(500, `Failed to fetch vendors: ${error.message}`);

    res.json({ success: true, vendors: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[Vendors] List error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch vendors' });
    }
  }
};

// Get single vendor
export const getVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error || !data) throw new AppError(404, 'Vendor not found');

    res.json({ success: true, vendor: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[Vendors] Get error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch vendor' });
    }
  }
};

// Create vendor
export const createVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { name, company_name, trade, email, phone, address, city, state, zip,
            license_number, insurance_expiry, w9_on_file, rating, is_preferred, notes } = req.body;

    if (!name) throw new AppError(400, 'Vendor name is required');

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .insert({
        name, company_name, trade, email, phone, address, city, state, zip,
        license_number, insurance_expiry, w9_on_file, rating, is_preferred, notes,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw new AppError(500, `Failed to create vendor: ${error.message}`);

    res.status(201).json({ success: true, vendor: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[Vendors] Create error:', error);
      res.status(500).json({ success: false, error: 'Failed to create vendor' });
    }
  }
};

// Update vendor
export const updateVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabaseAdmin
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error || !data) throw new AppError(404, 'Vendor not found');

    res.json({ success: true, vendor: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[Vendors] Update error:', error);
      res.status(500).json({ success: false, error: 'Failed to update vendor' });
    }
  }
};

// Soft-delete vendor
export const deleteVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('vendors')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) throw new AppError(500, `Failed to delete vendor: ${error.message}`);

    res.json({ success: true, message: 'Vendor deleted' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[Vendors] Delete error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete vendor' });
    }
  }
};
