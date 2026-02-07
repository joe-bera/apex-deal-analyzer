import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

/**
 * List contacts with search, type/company/tags filters, pagination
 * GET /api/contacts
 */
export const listContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { search, contact_type, company_id, tag, limit = '50', offset = '0' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
    const offsetNum = parseInt(offset as string, 10) || 0;

    let query = supabaseAdmin
      .from('contacts')
      .select('*, company:companies(id, name)', { count: 'exact' })
      .eq('is_deleted', false)
      .order('last_name', { ascending: true })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (contact_type) {
      query = query.eq('contact_type', contact_type);
    }
    if (company_id) {
      query = query.eq('company_id', company_id);
    }
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error listing contacts:', error);
      throw new AppError(500, 'Failed to list contacts');
    }

    res.status(200).json({
      success: true,
      contacts: data || [],
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
 * Get contact detail with company, deals, activities, linked properties
 * GET /api/contacts/:id
 */
export const getContact = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: contact, error } = await supabaseAdmin
      .from('contacts')
      .select('*, company:companies(id, name, company_type)')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error || !contact) {
      throw new AppError(404, 'Contact not found');
    }

    // Fetch related data in parallel
    const [dealsResult, activitiesResult, propertiesResult] = await Promise.all([
      supabaseAdmin
        .from('deal_contacts')
        .select('id, role, deal:crm_deals(id, deal_name, deal_type, stage, deal_value)')
        .eq('contact_id', id),
      supabaseAdmin
        .from('activities')
        .select('*')
        .eq('contact_id', id)
        .order('activity_date', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('contact_properties')
        .select('id, relationship, notes, master_property_id, property_id')
        .eq('contact_id', id),
    ]);

    res.status(200).json({
      success: true,
      contact: {
        ...contact,
        deals: dealsResult.data || [],
        activities: activitiesResult.data || [],
        linked_properties: propertiesResult.data || [],
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
 * Create a contact
 * POST /api/contacts
 */
export const createContact = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { data: contact, error } = await supabaseAdmin
      .from('contacts')
      .insert({
        ...req.body,
        created_by: req.user.id,
      })
      .select('*, company:companies(id, name)')
      .single();

    if (error || !contact) {
      console.error('Error creating contact:', error);
      throw new AppError(500, 'Failed to create contact');
    }

    res.status(201).json({
      success: true,
      message: 'Contact created successfully',
      contact,
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
 * Update a contact
 * PATCH /api/contacts/:id
 */
export const updateContact = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existing) {
      throw new AppError(404, 'Contact not found');
    }

    const { data: contact, error } = await supabaseAdmin
      .from('contacts')
      .update(req.body)
      .eq('id', id)
      .select('*, company:companies(id, name)')
      .single();

    if (error || !contact) {
      console.error('Error updating contact:', error);
      throw new AppError(500, 'Failed to update contact');
    }

    res.status(200).json({
      success: true,
      message: 'Contact updated successfully',
      contact,
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
 * Soft delete a contact
 * DELETE /api/contacts/:id
 */
export const deleteContact = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existing) {
      throw new AppError(404, 'Contact not found');
    }

    const { error } = await supabaseAdmin
      .from('contacts')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) {
      console.error('Error deleting contact:', error);
      throw new AppError(500, 'Failed to delete contact');
    }

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully',
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
 * Link a contact to a property
 * POST /api/contacts/:id/properties
 */
export const linkContactProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    // Verify contact exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existing) {
      throw new AppError(404, 'Contact not found');
    }

    const { data: link, error } = await supabaseAdmin
      .from('contact_properties')
      .insert({
        contact_id: id,
        ...req.body,
      })
      .select()
      .single();

    if (error || !link) {
      console.error('Error linking contact to property:', error);
      throw new AppError(500, 'Failed to link contact to property');
    }

    res.status(201).json({
      success: true,
      message: 'Contact linked to property',
      link,
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
 * Unlink a contact from a property
 * DELETE /api/contacts/:id/properties/:linkId
 */
export const unlinkContactProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { linkId } = req.params;

    const { error } = await supabaseAdmin
      .from('contact_properties')
      .delete()
      .eq('id', linkId);

    if (error) {
      console.error('Error unlinking contact from property:', error);
      throw new AppError(500, 'Failed to unlink contact from property');
    }

    res.status(200).json({
      success: true,
      message: 'Contact unlinked from property',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
