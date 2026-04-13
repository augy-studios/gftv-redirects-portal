// Link analytics — devices, daily clicks, traffic heatmap, link history
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);

    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id');
    if (!id) return err(res, 'Link ID required', 400);

    // Verify link exists and requester owns it (or is admin)
    const { data: link } = await supabase
        .from('gftvlinks_links')
        .select('id, user_id, access_count')
        .eq('id', id)
        .single();

    if (!link) return err(res, 'Link not found', 404);
    if (link.user_id !== user.id && !user.is_admin) return err(res, 'Forbidden', 403);

    // Fetch all analytics data in parallel
    const [devicesRes, dailyRes, allDailyRes, heatmapRes, historyRes] = await Promise.all([
        supabase.rpc('get_link_device_breakdown', { p_link_id: id }),
        supabase.rpc('get_link_daily_clicks', { p_link_id: id }),
        supabase.rpc('get_link_all_daily_clicks', { p_link_id: id }),
        supabase.rpc('get_link_traffic_heatmap', { p_link_id: id }),
        supabase
            .from('gftvlinks_linkhistory')
            .select('id, event_type, description, created_at')
            .eq('link_id', id)
            .order('created_at', { ascending: false }),
    ]);

    return ok(res, {
        total_clicks: link.access_count || 0,
        devices: devicesRes.data || [],
        daily_clicks: dailyRes.data || [],
        all_daily_clicks: allDailyRes.data || [],
        heatmap: heatmapRes.data || [],
        history: historyRes.data || [],
    });
}
