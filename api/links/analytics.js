// GET /api/links/analytics?id=<link id>: analytics for one link: total clicks, clicks by device
// type, clicks per day (last 7 days and all time), a day-by-hour traffic heatmap and the link's
// history.
// Who can call it: the link's owner or an Admin (session token).
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'GET') return sendError(response, 'Method not allowed', 405);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);

    const url = new URL(request.url, 'http://localhost');
    const linkId = url.searchParams.get('id');
    if (!linkId) return sendError(response, 'Link ID required', 400);

    // Verify link exists and requester owns it (or is admin)
    const { data: link } = await supabase
        .from('gftvlinks_links')
        .select('id, user_id, access_count')
        .eq('id', linkId)
        .single();

    if (!link) return sendError(response, 'Link not found', 404);
    if (link.user_id !== user.id && !user.is_admin) return sendError(response, 'Forbidden', 403);

    // Fetch all analytics data in parallel
    const [devicesResult, dailyResult, allDailyResult, heatmapResult, historyResult] = await Promise.all([
        supabase.rpc('get_link_device_breakdown', { p_link_id: linkId }),
        supabase.rpc('get_link_daily_clicks', { p_link_id: linkId }),
        supabase.rpc('get_link_all_daily_clicks', { p_link_id: linkId }),
        supabase.rpc('get_link_traffic_heatmap', { p_link_id: linkId }),
        supabase
            .from('gftvlinks_linkhistory')
            .select('id, event_type, description, created_at')
            .eq('link_id', linkId)
            .order('created_at', { ascending: false }),
    ]);

    return sendSuccess(response, {
        total_clicks: link.access_count || 0,
        devices: devicesResult.data || [],
        daily_clicks: dailyResult.data || [],
        all_daily_clicks: allDailyResult.data || [],
        heatmap: heatmapResult.data || [],
        history: historyResult.data || [],
    });
}
