import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

/**
 * List companies with search, type filter, pagination
 * GET /api/companies
 */
export const listCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { search, company_type, limit = '50', offset = '0' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
    const offsetNum = parseInt(offset as string, 10) || 0;

    let query = supabaseAdmin
      .from('companies')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)
      .order('name', { ascending: true })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    if (company_type) {
      query = query.eq('company_type', company_type);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error listing companies:', error);
      throw new AppError(500, 'Failed to list companies');
    }

    res.status(200).json({
      success: true,
      companies: data || [],
      total: count || 0,
      limit: limitNum,
      offset: offsetNum,
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
 * Get company detail with contacts and linked properties
 * GET /api/companies/:id
 */
export const getCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error || !company) {
      throw new AppError(404, 'Company not found');
    }

    // Fetch contacts for this company
    const { data: contacts } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, email, phone, title, contact_type')
      .eq('company_id', id)
      .eq('is_deleted', false)
      .order('last_name', { ascending: true });

    res.status(200).json({
      success: true,
      company: {
        ...company,
        contacts: contacts || [],
      },
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
 * Create a company
 * POST /api/companies
 */
export const createCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .insert({
        ...req.body,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error || !company) {
      console.error('Error creating company:', error);
      throw new AppError(500, 'Failed to create company');
    }

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      company,
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
 * Update a company
 * PATCH /api/companies/:id
 */
export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    // Verify exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('companies')
      .select('id, created_by')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existing) {
      throw new AppError(404, 'Company not found');
    }

    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error || !company) {
      console.error('Error updating company:', error);
      throw new AppError(500, 'Failed to update company');
    }

    res.status(200).json({
      success: true,
      message: 'Company updated successfully',
      company,
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
 * Soft delete a company
 * DELETE /api/companies/:id
 */
export const deleteCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('companies')
      .select('id, created_by')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existing) {
      throw new AppError(404, 'Company not found');
    }

    const { error } = await supabaseAdmin
      .from('companies')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) {
      console.error('Error deleting company:', error);
      throw new AppError(500, 'Failed to delete company');
    }

    res.status(200).json({
      success: true,
      message: 'Company deleted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
