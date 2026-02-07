import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

// ============================================================================
// Playbook Templates CRUD
// ============================================================================

/**
 * List all playbook templates
 * GET /api/playbooks
 */
export const listPlaybooks = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');

    const { deal_type } = req.query;

    let query = supabaseAdmin
      .from('task_playbooks')
      .select('*, playbook_tasks(count)')
      .order('created_at', { ascending: false });

    if (deal_type) query = query.eq('deal_type', deal_type as string);

    const { data, error } = await query;

    if (error) {
      console.error('Error listing playbooks:', error);
      throw new AppError(500, 'Failed to list playbooks');
    }

    res.status(200).json({ success: true, playbooks: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Get playbook with tasks
 * GET /api/playbooks/:id
 */
export const getPlaybook = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { id } = req.params;

    const { data: playbook, error } = await supabaseAdmin
      .from('task_playbooks')
      .select('*, tasks:playbook_tasks(*)')
      .eq('id', id)
      .single();

    if (error || !playbook) throw new AppError(404, 'Playbook not found');

    // Sort tasks by sort_order
    if (playbook.tasks) {
      playbook.tasks.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    res.status(200).json({ success: true, playbook });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Create a new playbook
 * POST /api/playbooks
 */
export const createPlaybook = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { name, description, deal_type } = req.body;

    if (!name) throw new AppError(400, 'name is required');

    const { data: playbook, error } = await supabaseAdmin
      .from('task_playbooks')
      .insert({
        name,
        description: description || null,
        deal_type: deal_type || null,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error || !playbook) {
      console.error('Error creating playbook:', error);
      throw new AppError(500, 'Failed to create playbook');
    }

    res.status(201).json({ success: true, playbook });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Update playbook
 * PATCH /api/playbooks/:id
 */
export const updatePlaybook = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { id } = req.params;
    const { name, description, deal_type } = req.body;

    const { data: playbook, error } = await supabaseAdmin
      .from('task_playbooks')
      .update({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(deal_type !== undefined && { deal_type }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !playbook) throw new AppError(404, 'Playbook not found');

    res.status(200).json({ success: true, playbook });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Delete playbook
 * DELETE /api/playbooks/:id
 */
export const deletePlaybook = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('task_playbooks')
      .delete()
      .eq('id', id);

    if (error) throw new AppError(500, 'Failed to delete playbook');

    res.status(200).json({ success: true, message: 'Playbook deleted' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

// ============================================================================
// Playbook Task Templates CRUD
// ============================================================================

/**
 * Add task to playbook
 * POST /api/playbooks/:id/tasks
 */
export const addPlaybookTask = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { id } = req.params;
    const { title, description, stage, due_offset_days, is_required, sort_order } = req.body;

    if (!title) throw new AppError(400, 'title is required');

    const { data: task, error } = await supabaseAdmin
      .from('playbook_tasks')
      .insert({
        playbook_id: id,
        title,
        description: description || null,
        stage: stage || null,
        due_offset_days: due_offset_days ?? null,
        is_required: is_required || false,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error || !task) {
      console.error('Error adding playbook task:', error);
      throw new AppError(500, 'Failed to add task');
    }

    res.status(201).json({ success: true, task });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Update playbook task template
 * PATCH /api/playbooks/:playbookId/tasks/:taskId
 */
export const updatePlaybookTask = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { taskId } = req.params;

    const { data: task, error } = await supabaseAdmin
      .from('playbook_tasks')
      .update(req.body)
      .eq('id', taskId)
      .select()
      .single();

    if (error || !task) throw new AppError(404, 'Task not found');

    res.status(200).json({ success: true, task });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Delete playbook task template
 * DELETE /api/playbooks/:playbookId/tasks/:taskId
 */
export const deletePlaybookTask = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { taskId } = req.params;

    const { error } = await supabaseAdmin
      .from('playbook_tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw new AppError(500, 'Failed to delete task');

    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

// ============================================================================
// Deal Tasks CRUD
// ============================================================================

/**
 * List tasks for a deal
 * GET /api/crm-deals/:dealId/tasks
 */
export const listDealTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { dealId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('deal_tasks')
      .select('*, assigned_user:profiles!deal_tasks_assigned_to_fkey(id, full_name)')
      .eq('deal_id', dealId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error listing deal tasks:', error);
      throw new AppError(500, 'Failed to list tasks');
    }

    res.status(200).json({ success: true, tasks: data || [] });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Create a manual deal task
 * POST /api/crm-deals/:dealId/tasks
 */
export const createDealTask = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { dealId } = req.params;
    const { title, description, stage, assigned_to, due_date, is_required, sort_order } = req.body;

    if (!title) throw new AppError(400, 'title is required');

    const { data: task, error } = await supabaseAdmin
      .from('deal_tasks')
      .insert({
        deal_id: dealId,
        title,
        description: description || null,
        stage: stage || null,
        assigned_to: assigned_to || null,
        due_date: due_date || null,
        is_required: is_required || false,
        sort_order: sort_order ?? 0,
      })
      .select('*, assigned_user:profiles!deal_tasks_assigned_to_fkey(id, full_name)')
      .single();

    if (error || !task) {
      console.error('Error creating deal task:', error);
      throw new AppError(500, 'Failed to create task');
    }

    res.status(201).json({ success: true, task });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Update a deal task (toggle complete, edit, etc.)
 * PATCH /api/crm-deals/:dealId/tasks/:taskId
 */
export const updateDealTask = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { taskId } = req.params;
    const updates = { ...req.body };

    // Handle completion toggling
    if (updates.is_completed === true && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = req.user.id;
    } else if (updates.is_completed === false) {
      updates.completed_at = null;
      updates.completed_by = null;
    }

    const { data: task, error } = await supabaseAdmin
      .from('deal_tasks')
      .update(updates)
      .eq('id', taskId)
      .select('*, assigned_user:profiles!deal_tasks_assigned_to_fkey(id, full_name)')
      .single();

    if (error || !task) {
      console.error('Error updating deal task:', error);
      throw new AppError(500, 'Failed to update task');
    }

    res.status(200).json({ success: true, task });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Delete a deal task
 * DELETE /api/crm-deals/:dealId/tasks/:taskId
 */
export const deleteDealTask = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { taskId } = req.params;

    const { error } = await supabaseAdmin
      .from('deal_tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw new AppError(500, 'Failed to delete task');

    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Apply a playbook to a deal — creates deal_tasks from playbook templates
 * POST /api/crm-deals/:dealId/apply-playbook
 */
export const applyPlaybook = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const { dealId } = req.params;
    const { playbook_id } = req.body;

    if (!playbook_id) throw new AppError(400, 'playbook_id is required');

    // Fetch playbook tasks
    const { data: playbookTasks, error: fetchError } = await supabaseAdmin
      .from('playbook_tasks')
      .select('*')
      .eq('playbook_id', playbook_id)
      .order('sort_order', { ascending: true });

    if (fetchError || !playbookTasks?.length) {
      throw new AppError(404, 'Playbook not found or has no tasks');
    }

    const now = new Date();

    // Create deal tasks from playbook templates
    const tasksToInsert = playbookTasks.map((pt: any) => ({
      deal_id: dealId,
      playbook_id: playbook_id,
      title: pt.title,
      description: pt.description,
      stage: pt.stage,
      is_required: pt.is_required,
      sort_order: pt.sort_order,
      due_date: pt.due_offset_days
        ? new Date(now.getTime() + pt.due_offset_days * 86400000).toISOString()
        : null,
    }));

    const { data: tasks, error } = await supabaseAdmin
      .from('deal_tasks')
      .insert(tasksToInsert)
      .select('*, assigned_user:profiles!deal_tasks_assigned_to_fkey(id, full_name)');

    if (error) {
      console.error('Error applying playbook:', error);
      throw new AppError(500, 'Failed to apply playbook');
    }

    res.status(201).json({
      success: true,
      message: `Applied ${tasks?.length || 0} tasks from playbook`,
      tasks: tasks || [],
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
