import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

/**
 * List activities with type/entity/date filters
 * GET /api/activities
 */
export const listActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const {
      activity_type, contact_id, deal_id, company_id, property_id,
      limit = '50', offset = '0',
    } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
    const offsetNum = parseInt(offset as string, 10) || 0;

    let query = supabaseAdmin
      .from('activities')
      .select('*, contact:contacts(id, first_name, last_name), deal:crm_deals(id, deal_name)', { count: 'exact' })
      .order('activity_date', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (activity_type) query = query.eq('activity_type', activity_type);
    if (contact_id) query = query.eq('contact_id', contact_id);
    if (deal_id) query = query.eq('deal_id', deal_id);
    if (company_id) query = query.eq('company_id', company_id);
    if (property_id) query = query.eq('property_id', property_id);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error listing activities:', error);
      throw new AppError(500, 'Failed to list activities');
    }

    res.status(200).json({
      success: true,
      activities: data || [],
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
 * Get upcoming tasks (incomplete tasks with due dates approaching)
 * GET /api/activities/upcoming-tasks
 */
export const getUpcomingTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { data, error } = await supabaseAdmin
      .from('activities')
      .select('*, contact:contacts(id, first_name, last_name), deal:crm_deals(id, deal_name)')
      .eq('activity_type', 'task')
      .eq('is_completed', false)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
      .limit(25);

    if (error) {
      console.error('Error fetching upcoming tasks:', error);
      throw new AppError(500, 'Failed to fetch upcoming tasks');
    }

    res.status(200).json({
      success: true,
      tasks: data || [],
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
 * Create an activity
 * POST /api/activities
 */
export const createActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { data: activity, error } = await supabaseAdmin
      .from('activities')
      .insert({
        ...req.body,
        created_by: req.user.id,
      })
      .select('*, contact:contacts(id, first_name, last_name), deal:crm_deals(id, deal_name)')
      .single();

    if (error || !activity) {
      console.error('Error creating activity:', error);
      throw new AppError(500, 'Failed to create activity');
    }

    // Update last_contacted_at on the contact if applicable
    if (req.body.contact_id && ['call', 'email', 'meeting', 'site_visit'].includes(req.body.activity_type)) {
      await supabaseAdmin
        .from('contacts')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', req.body.contact_id);
    }

    res.status(201).json({
      success: true,
      message: 'Activity created successfully',
      activity,
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
 * Update an activity
 * PATCH /api/activities/:id
 */
export const updateActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('activities')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new AppError(404, 'Activity not found');
    }

    const { data: activity, error } = await supabaseAdmin
      .from('activities')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error || !activity) {
      console.error('Error updating activity:', error);
      throw new AppError(500, 'Failed to update activity');
    }

    res.status(200).json({
      success: true,
      message: 'Activity updated successfully',
      activity,
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
 * Mark a task as completed
 * PATCH /api/activities/:id/complete
 */
export const completeActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: activity, error } = await supabaseAdmin
      .from('activities')
      .update({ is_completed: true })
      .eq('id', id)
      .select()
      .single();

    if (error || !activity) {
      throw new AppError(404, 'Activity not found');
    }

    res.status(200).json({
      success: true,
      message: 'Task marked as complete',
      activity,
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
 * Delete an activity
 * DELETE /api/activities/:id
 */
export const deleteActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('activities')
      .select('id, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new AppError(404, 'Activity not found');
    }

    const { error } = await supabaseAdmin
      .from('activities')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting activity:', error);
      throw new AppError(500, 'Failed to delete activity');
    }

    res.status(200).json({
      success: true,
      message: 'Activity deleted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
