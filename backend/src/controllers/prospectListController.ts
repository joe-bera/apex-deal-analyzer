import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../config/supabase';

interface ProspectFilters {
  // Multi-select
  property_type?: string[];
  city?: string[];
  state?: string[];
  zip?: string[];
  submarket?: string[];
  property_subtype?: string[];
  // Ranges
  building_size_min?: number;
  building_size_max?: number;
  lot_size_acres_min?: number;
  lot_size_acres_max?: number;
  year_built_min?: number;
  year_built_max?: number;
  sale_price_min?: number;
  sale_price_max?: number;
  price_per_sf_min?: number;
  price_per_sf_max?: number;
  cap_rate_min?: number;
  cap_rate_max?: number;
  // Text search
  owner_name?: string;
  search?: string;
}

/**
 * Build a Supabase query on property_with_latest_transaction from filter config.
 * Returns the query builder (not yet executed).
 * @param selectColumns - columns to select (default '*')
 */
function buildFilterQuery(filters: ProspectFilters, selectColumns: string = '*') {
  let query = supabase
    .from('property_with_latest_transaction')
    .select(selectColumns, { count: 'exact' });

  // Multi-select filters
  if (filters.property_type?.length) {
    query = query.in('property_type', filters.property_type);
  }
  if (filters.city?.length) {
    query = query.in('city', filters.city);
  }
  if (filters.state?.length) {
    query = query.in('state', filters.state);
  }
  if (filters.zip?.length) {
    query = query.in('zip', filters.zip);
  }
  if (filters.submarket?.length) {
    query = query.in('submarket', filters.submarket);
  }
  if (filters.property_subtype?.length) {
    query = query.in('property_subtype', filters.property_subtype);
  }

  // Range filters
  if (filters.building_size_min != null) {
    query = query.gte('building_size', filters.building_size_min);
  }
  if (filters.building_size_max != null) {
    query = query.lte('building_size', filters.building_size_max);
  }
  if (filters.lot_size_acres_min != null) {
    query = query.gte('lot_size_acres', filters.lot_size_acres_min);
  }
  if (filters.lot_size_acres_max != null) {
    query = query.lte('lot_size_acres', filters.lot_size_acres_max);
  }
  if (filters.year_built_min != null) {
    query = query.gte('year_built', filters.year_built_min);
  }
  if (filters.year_built_max != null) {
    query = query.lte('year_built', filters.year_built_max);
  }
  if (filters.sale_price_min != null) {
    query = query.gte('latest_sale_price', filters.sale_price_min);
  }
  if (filters.sale_price_max != null) {
    query = query.lte('latest_sale_price', filters.sale_price_max);
  }
  if (filters.price_per_sf_min != null) {
    query = query.gte('latest_price_per_sf', filters.price_per_sf_min);
  }
  if (filters.price_per_sf_max != null) {
    query = query.lte('latest_price_per_sf', filters.price_per_sf_max);
  }
  if (filters.cap_rate_min != null) {
    query = query.gte('latest_cap_rate', filters.cap_rate_min);
  }
  if (filters.cap_rate_max != null) {
    query = query.lte('latest_cap_rate', filters.cap_rate_max);
  }

  // Text search
  if (filters.owner_name) {
    query = query.ilike('owner_name', `%${filters.owner_name}%`);
  }
  if (filters.search) {
    query = query.or(
      `address.ilike.%${filters.search}%,property_name.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
    );
  }

  return query;
}

// POST /api/prospect-lists/preview — Run filters, return count + first 20 matches
export const previewFilters = async (req: Request, res: Response) => {
  try {
    const filters: ProspectFilters = req.body.filters || {};

    const query = buildFilterQuery(filters)
      .order('created_at', { ascending: false })
      .range(0, 19);

    const { data, error, count } = await query;

    if (error) throw error;

    return res.json({
      success: true,
      count: count || 0,
      properties: data || [],
    });
  } catch (error) {
    console.error('Error previewing prospect filters:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to preview filters',
    });
  }
};

// GET /api/prospect-lists — List user's prospect lists
export const listProspectLists = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const { data, error } = await supabase
      .from('prospect_lists')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      prospect_lists: data || [],
    });
  } catch (error) {
    console.error('Error listing prospect lists:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list prospect lists',
    });
  }
};

// POST /api/prospect-lists — Create list + auto-execute filters → snapshot items
export const createProspectList = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { name, description, filters } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    // Run filters to get matching property IDs
    const { data: matchedProperties, error: filterError, count } = await buildFilterQuery(filters || {}, 'id');
    if (filterError) throw filterError;

    // Create the list
    const { data: list, error: listError } = await supabase
      .from('prospect_lists')
      .insert({
        name,
        description: description || null,
        filters: filters || {},
        result_count: count || 0,
        last_refreshed_at: new Date().toISOString(),
        created_by: userId,
      })
      .select()
      .single();

    if (listError) throw listError;

    // Snapshot items
    if (matchedProperties && matchedProperties.length > 0) {
      const items = matchedProperties.map((p: any) => ({
        list_id: list.id,
        master_property_id: p.id,
        status: 'pending',
      }));

      const { error: itemsError } = await supabase
        .from('prospect_list_items')
        .insert(items);

      if (itemsError) throw itemsError;
    }

    return res.status(201).json({
      success: true,
      prospect_list: list,
      items_count: count || 0,
    });
  } catch (error) {
    console.error('Error creating prospect list:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create prospect list',
    });
  }
};

// GET /api/prospect-lists/:id — Get list with items (joined property data)
export const getProspectList = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    // Get the list
    const { data: list, error: listError } = await supabase
      .from('prospect_lists')
      .select('*')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (listError) throw listError;
    if (!list) {
      return res.status(404).json({ success: false, error: 'Prospect list not found' });
    }

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('prospect_list_items')
      .select('*')
      .eq('list_id', id)
      .order('added_at', { ascending: true });

    if (itemsError) throw itemsError;

    // Get property data for all items
    let properties: any[] = [];
    if (items && items.length > 0) {
      const propertyIds = items.map((item: any) => item.master_property_id);
      const { data: propData, error: propError } = await supabase
        .from('property_with_latest_transaction')
        .select('*')
        .in('id', propertyIds);

      if (propError) throw propError;
      properties = propData || [];
    }

    // Merge property data into items
    const propertyMap = new Map(properties.map((p: any) => [p.id, p]));
    const enrichedItems = (items || []).map((item: any) => ({
      ...item,
      property: propertyMap.get(item.master_property_id) || null,
    }));

    return res.json({
      success: true,
      prospect_list: list,
      items: enrichedItems,
    });
  } catch (error) {
    console.error('Error getting prospect list:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get prospect list',
    });
  }
};

// PATCH /api/prospect-lists/:id — Update name/description/filters
export const updateProspectList = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { name, description, filters } = req.body;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (filters !== undefined) updates.filters = filters;

    const { data, error } = await supabase
      .from('prospect_lists')
      .update(updates)
      .eq('id', id)
      .eq('created_by', userId)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      prospect_list: data,
    });
  } catch (error) {
    console.error('Error updating prospect list:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update prospect list',
    });
  }
};

// DELETE /api/prospect-lists/:id — Delete list (cascade items)
export const deleteProspectList = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('prospect_lists')
      .delete()
      .eq('id', id)
      .eq('created_by', userId);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting prospect list:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete prospect list',
    });
  }
};

// POST /api/prospect-lists/:id/refresh — Re-run filters, replace items snapshot
export const refreshProspectList = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    // Get the list to read its filters
    const { data: list, error: listError } = await supabase
      .from('prospect_lists')
      .select('*')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (listError) throw listError;
    if (!list) {
      return res.status(404).json({ success: false, error: 'Prospect list not found' });
    }

    // Re-run filters
    const { data: matchedProperties, error: filterError, count } = await buildFilterQuery(list.filters || {}, 'id');
    if (filterError) throw filterError;

    // Delete old items
    const { error: deleteError } = await supabase
      .from('prospect_list_items')
      .delete()
      .eq('list_id', id);

    if (deleteError) throw deleteError;

    // Insert new items
    if (matchedProperties && matchedProperties.length > 0) {
      const items = matchedProperties.map((p: any) => ({
        list_id: id,
        master_property_id: p.id,
        status: 'pending',
      }));

      const { error: itemsError } = await supabase
        .from('prospect_list_items')
        .insert(items);

      if (itemsError) throw itemsError;
    }

    // Update list metadata
    const { data: updatedList, error: updateError } = await supabase
      .from('prospect_lists')
      .update({
        result_count: count || 0,
        last_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return res.json({
      success: true,
      prospect_list: updatedList,
      items_count: count || 0,
    });
  } catch (error) {
    console.error('Error refreshing prospect list:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh prospect list',
    });
  }
};

// GET /api/prospect-lists/:id/export — CSV download
export const exportProspectList = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    // Verify ownership
    const { data: list, error: listError } = await supabase
      .from('prospect_lists')
      .select('name')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (listError || !list) {
      return res.status(404).json({ success: false, error: 'Prospect list not found' });
    }

    // Get items with property data
    const { data: items, error: itemsError } = await supabase
      .from('prospect_list_items')
      .select('*')
      .eq('list_id', id)
      .order('added_at', { ascending: true });

    if (itemsError) throw itemsError;

    let properties: any[] = [];
    if (items && items.length > 0) {
      const propertyIds = items.map((item: any) => item.master_property_id);
      const { data: propData, error: propError } = await supabase
        .from('property_with_latest_transaction')
        .select('*')
        .in('id', propertyIds);

      if (propError) throw propError;
      properties = propData || [];
    }

    const propertyMap = new Map(properties.map((p: any) => [p.id, p]));

    // Build CSV
    const csvHeaders = [
      'Status', 'Notes', 'Address', 'City', 'State', 'Zip', 'Property Type',
      'Property Subtype', 'Building Size (SF)', 'Lot Size (Acres)', 'Year Built',
      'Owner Name', 'Sale Price', 'Price/SF', 'Cap Rate', 'Submarket',
    ];

    const csvRows = (items || []).map((item: any) => {
      const p = propertyMap.get(item.master_property_id) || {} as any;
      return [
        item.status || '',
        (item.notes || '').replace(/"/g, '""'),
        (p.address || '').replace(/"/g, '""'),
        p.city || '',
        p.state || '',
        p.zip || '',
        p.property_type || '',
        p.property_subtype || '',
        p.building_size || '',
        p.lot_size_acres || '',
        p.year_built || '',
        (p.owner_name || '').replace(/"/g, '""'),
        p.latest_sale_price || '',
        p.latest_price_per_sf || '',
        p.latest_cap_rate || '',
        p.submarket || '',
      ].map(v => `"${v}"`).join(',');
    });

    const csv = [csvHeaders.join(','), ...csvRows].join('\n');

    const filename = `${list.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (error) {
    console.error('Error exporting prospect list:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to export prospect list',
    });
  }
};

// PATCH /api/prospect-lists/:listId/items/:itemId — Update item status/notes
export const updateProspectListItem = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { listId, itemId } = req.params;
    const { status, notes } = req.body;

    // Verify list ownership
    const { data: list, error: listError } = await supabase
      .from('prospect_lists')
      .select('id')
      .eq('id', listId)
      .eq('created_by', userId)
      .single();

    if (listError || !list) {
      return res.status(404).json({ success: false, error: 'Prospect list not found' });
    }

    const updates: Record<string, any> = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabase
      .from('prospect_list_items')
      .update(updates)
      .eq('id', itemId)
      .eq('list_id', listId)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      item: data,
    });
  } catch (error) {
    console.error('Error updating prospect list item:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update item',
    });
  }
};

// POST /api/prospect-lists/:id/bulk-update — Bulk update item_ids with status/notes
export const bulkUpdateItems = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { item_ids, status, notes } = req.body;

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'item_ids array is required' });
    }

    // Verify list ownership
    const { data: list, error: listError } = await supabase
      .from('prospect_lists')
      .select('id')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (listError || !list) {
      return res.status(404).json({ success: false, error: 'Prospect list not found' });
    }

    const updates: Record<string, any> = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabase
      .from('prospect_list_items')
      .update(updates)
      .eq('list_id', id)
      .in('id', item_ids)
      .select();

    if (error) throw error;

    return res.json({
      success: true,
      updated_count: data?.length || 0,
      items: data,
    });
  } catch (error) {
    console.error('Error bulk updating prospect list items:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to bulk update items',
    });
  }
};
