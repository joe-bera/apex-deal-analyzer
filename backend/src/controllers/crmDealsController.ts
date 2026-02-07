import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

/**
 * List CRM deals with filters
 * GET /api/crm-deals
 */
export const listCrmDeals = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { stage, deal_type, assigned_to, search, limit = '50', offset = '0' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
    const offsetNum = parseInt(offset as string, 10) || 0;

    let query = supabaseAdmin
      .from('crm_deals')
      .select('*, assigned_user:profiles!crm_deals_assigned_to_fkey(id, full_name, email)', { count: 'exact' })
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (stage) query = query.eq('stage', stage);
    if (deal_type) query = query.eq('deal_type', deal_type);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (search) query = query.ilike('deal_name', `%${search}%`);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error listing CRM deals:', error);
      throw new AppError(500, 'Failed to list deals');
    }

    res.status(200).json({
      success: true,
      deals: data || [],
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
 * Get deals grouped by stage for kanban view
 * GET /api/crm-deals/pipeline
 */
export const getPipeline = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { data: deals, error } = await supabaseAdmin
      .from('crm_deals')
      .select('*, assigned_user:profiles!crm_deals_assigned_to_fkey(id, full_name)')
      .eq('is_deleted', false)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('stage_entered_at', { ascending: true });

    if (error) {
      console.error('Error fetching pipeline:', error);
      throw new AppError(500, 'Failed to fetch pipeline');
    }

    // Group by stage
    const stages = [
      'prospecting', 'qualification', 'proposal', 'negotiation',
      'under_contract', 'due_diligence', 'closing',
    ];

    const pipeline = stages.map((stage) => {
      const stageDeals = (deals || []).filter((d: any) => d.stage === stage);
      return {
        stage,
        count: stageDeals.length,
        total_value: stageDeals.reduce((sum: number, d: any) => sum + (d.deal_value || 0), 0),
        deals: stageDeals,
      };
    });

    res.status(200).json({
      success: true,
      pipeline,
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
 * Get deal analytics: conversion rates, avg days, revenue forecast
 * GET /api/crm-deals/analytics
 */
export const getAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { data: deals, error } = await supabaseAdmin
      .from('crm_deals')
      .select('id, deal_name, deal_type, stage, deal_value, probability_percent, commission_total, stage_entered_at, created_at, actual_close_date, expected_close_date')
      .eq('is_deleted', false);

    if (error) {
      console.error('Error fetching analytics:', error);
      throw new AppError(500, 'Failed to fetch analytics');
    }

    const allDeals = deals || [];
    const closedWon = allDeals.filter((d: any) => d.stage === 'closed_won');
    const closedLost = allDeals.filter((d: any) => d.stage === 'closed_lost');
    const active = allDeals.filter((d: any) => d.stage !== 'closed_won' && d.stage !== 'closed_lost');

    const totalClosed = closedWon.length + closedLost.length;
    const winRate = totalClosed > 0 ? (closedWon.length / totalClosed) * 100 : 0;

    const avgDealSize = closedWon.length > 0
      ? closedWon.reduce((sum: number, d: any) => sum + (d.deal_value || 0), 0) / closedWon.length
      : 0;

    const totalCommissionEarned = closedWon.reduce(
      (sum: number, d: any) => sum + (d.commission_total || 0), 0
    );

    // Weighted pipeline value = sum of (deal_value * probability / 100)
    const weightedPipelineValue = active.reduce(
      (sum: number, d: any) => sum + ((d.deal_value || 0) * (d.probability_percent || 0)) / 100, 0
    );

    const totalPipelineValue = active.reduce(
      (sum: number, d: any) => sum + (d.deal_value || 0), 0
    );

    res.status(200).json({
      success: true,
      analytics: {
        total_deals: allDeals.length,
        active_deals: active.length,
        closed_won: closedWon.length,
        closed_lost: closedLost.length,
        win_rate: Math.round(winRate * 10) / 10,
        avg_deal_size: Math.round(avgDealSize),
        total_commission_earned: Math.round(totalCommissionEarned),
        total_pipeline_value: Math.round(totalPipelineValue),
        weighted_pipeline_value: Math.round(weightedPipelineValue),
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
 * Get deal detail with contacts, activities, property, stage history
 * GET /api/crm-deals/:id
 */
export const getCrmDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: deal, error } = await supabaseAdmin
      .from('crm_deals')
      .select('*, assigned_user:profiles!crm_deals_assigned_to_fkey(id, full_name, email)')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error || !deal) {
      throw new AppError(404, 'Deal not found');
    }

    // Fetch related data in parallel
    const [contactsResult, activitiesResult, historyResult] = await Promise.all([
      supabaseAdmin
        .from('deal_contacts')
        .select('id, role, contact:contacts(id, first_name, last_name, email, phone, company_id)')
        .eq('deal_id', id),
      supabaseAdmin
        .from('activities')
        .select('*')
        .eq('deal_id', id)
        .order('activity_date', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('deal_stage_history')
        .select('*, changed_by_user:profiles!deal_stage_history_changed_by_fkey(id, full_name)')
        .eq('deal_id', id)
        .order('changed_at', { ascending: false }),
    ]);

    res.status(200).json({
      success: true,
      deal: {
        ...deal,
        contacts: contactsResult.data || [],
        activities: activitiesResult.data || [],
        stage_history: historyResult.data || [],
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
 * Create a CRM deal
 * POST /api/crm-deals
 */
export const createCrmDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { data: deal, error } = await supabaseAdmin
      .from('crm_deals')
      .insert({
        ...req.body,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error || !deal) {
      console.error('Error creating CRM deal:', error);
      throw new AppError(500, 'Failed to create deal');
    }

    // Record initial stage in history
    await supabaseAdmin
      .from('deal_stage_history')
      .insert({
        deal_id: deal.id,
        to_stage: deal.stage,
        changed_by: req.user.id,
        notes: 'Deal created',
      });

    res.status(201).json({
      success: true,
      message: 'Deal created successfully',
      deal,
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
 * Update a CRM deal
 * PATCH /api/crm-deals/:id
 */
export const updateCrmDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('crm_deals')
      .select('id')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existing) {
      throw new AppError(404, 'Deal not found');
    }

    const { data: deal, error } = await supabaseAdmin
      .from('crm_deals')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error || !deal) {
      console.error('Error updating CRM deal:', error);
      throw new AppError(500, 'Failed to update deal');
    }

    res.status(200).json({
      success: true,
      message: 'Deal updated successfully',
      deal,
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
 * Move deal to a new stage (with optional notes)
 * PATCH /api/crm-deals/:id/stage
 */
export const updateDealStage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;
    const { stage, notes } = req.body;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('crm_deals')
      .select('id, stage')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existing) {
      throw new AppError(404, 'Deal not found');
    }

    if (existing.stage === stage) {
      res.status(200).json({
        success: true,
        message: 'Deal is already in this stage',
      });
      return;
    }

    // Update stage (trigger will record history and update stage_entered_at)
    const { data: deal, error } = await supabaseAdmin
      .from('crm_deals')
      .update({ stage })
      .eq('id', id)
      .select()
      .single();

    if (error || !deal) {
      console.error('Error updating deal stage:', error);
      throw new AppError(500, 'Failed to update deal stage');
    }

    // If notes were provided, update the latest history entry
    if (notes) {
      await supabaseAdmin
        .from('deal_stage_history')
        .update({ notes })
        .eq('deal_id', id)
        .eq('to_stage', stage)
        .order('changed_at', { ascending: false })
        .limit(1);
    }

    res.status(200).json({
      success: true,
      message: `Deal moved to ${stage}`,
      deal,
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
 * Soft delete a CRM deal
 * DELETE /api/crm-deals/:id
 */
export const deleteCrmDeal = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('crm_deals')
      .select('id')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existing) {
      throw new AppError(404, 'Deal not found');
    }

    const { error } = await supabaseAdmin
      .from('crm_deals')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) {
      console.error('Error deleting CRM deal:', error);
      throw new AppError(500, 'Failed to delete deal');
    }

    res.status(200).json({
      success: true,
      message: 'Deal deleted successfully',
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
 * Add contact to deal with role
 * POST /api/crm-deals/:id/contacts
 */
export const addDealContact = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { id } = req.params;
    const { contact_id, role } = req.body;

    // Verify deal exists
    const { data: deal, error: dealError } = await supabaseAdmin
      .from('crm_deals')
      .select('id')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (dealError || !deal) {
      throw new AppError(404, 'Deal not found');
    }

    const { data: link, error } = await supabaseAdmin
      .from('deal_contacts')
      .insert({ deal_id: id, contact_id, role })
      .select('id, role, contact:contacts(id, first_name, last_name, email)')
      .single();

    if (error || !link) {
      if (error?.code === '23505') {
        throw new AppError(409, 'Contact already has this role on this deal');
      }
      console.error('Error adding deal contact:', error);
      throw new AppError(500, 'Failed to add contact to deal');
    }

    res.status(201).json({
      success: true,
      message: 'Contact added to deal',
      deal_contact: link,
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
 * Remove contact from deal
 * DELETE /api/crm-deals/:id/contacts/:dcId
 */
export const removeDealContact = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { dcId } = req.params;

    const { error } = await supabaseAdmin
      .from('deal_contacts')
      .delete()
      .eq('id', dcId);

    if (error) {
      console.error('Error removing deal contact:', error);
      throw new AppError(500, 'Failed to remove contact from deal');
    }

    res.status(200).json({
      success: true,
      message: 'Contact removed from deal',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
