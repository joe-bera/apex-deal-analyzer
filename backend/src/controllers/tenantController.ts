import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

// List tenants by property
export const listTenantsByProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { propertyId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('master_property_id', propertyId)
      .order('unit_number');

    if (error) throw new AppError(500, `Failed to fetch tenants: ${error.message}`);

    res.json({ success: true, tenants: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[Tenants] List error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tenants' });
    }
  }
};

// Get single tenant
export const getTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new AppError(404, 'Tenant not found');

    res.json({ success: true, tenant: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[Tenants] Get error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tenant' });
    }
  }
};

// Create tenant
export const createTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { master_property_id, tenant_name, ...rest } = req.body;

    if (!master_property_id) throw new AppError(400, 'Property ID is required');
    if (!tenant_name) throw new AppError(400, 'Tenant name is required');

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .insert({ master_property_id, tenant_name, ...rest, created_by: req.user.id })
      .select()
      .single();

    if (error) throw new AppError(500, `Failed to create tenant: ${error.message}`);

    res.status(201).json({ success: true, tenant: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[Tenants] Create error:', error);
      res.status(500).json({ success: false, error: 'Failed to create tenant' });
    }
  }
};

// Update tenant
export const updateTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new AppError(404, 'Tenant not found');

    res.json({ success: true, tenant: data });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[Tenants] Update error:', error);
      res.status(500).json({ success: false, error: 'Failed to update tenant' });
    }
  }
};

// Soft-delete tenant (mark inactive)
export const deleteTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('tenants')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw new AppError(500, `Failed to delete tenant: ${error.message}`);

    res.json({ success: true, message: 'Tenant deactivated' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[Tenants] Delete error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete tenant' });
    }
  }
};

// Get rent roll for a property
export const getRentRoll = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { propertyId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('rent_roll')
      .select('*')
      .eq('master_property_id', propertyId)
      .order('unit_number');

    if (error) throw new AppError(500, `Failed to fetch rent roll: ${error.message}`);

    res.json({ success: true, rent_roll: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      console.error('[Tenants] Rent roll error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch rent roll' });
    }
  }
};
