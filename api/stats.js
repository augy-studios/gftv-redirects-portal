// GET /api/stats: public counts for the home page: officers (approved Editors and Admins), links,
// and total clicks across every link.
// Who can call it: anyone; no sign-in needed.
import supabase from '../lib/supabase.js';
import { sendSuccess, sendError, sendOptionsResponse } from '../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'GET') return sendError(response, 'Method not allowed', 405);

    try {
        const [editorsResult, linksResult, clicksResult] = await Promise.all([
            supabase
                .from('gftvhello_users')
                .select('*', { count: 'exact', head: true })
                .eq('is_approved', true)
                .or('is_editor.eq.true,is_admin.eq.true'),
            supabase
                .from('gftvlinks_links')
                .select('*', { count: 'exact', head: true }),
            supabase
                .from('gftvlinks_links')
                .select('access_count'),
        ]);

        if (editorsResult.error || linksResult.error || clicksResult.error) {
            return sendError(response, 'Failed to fetch stats', 500);
        }

        const totalClicks = (clicksResult.data || []).reduce((sum, link) => sum + (link.access_count || 0), 0);

        return sendSuccess(response, {
            officers: editorsResult.count || 0,
            links: linksResult.count || 0,
            clicks: totalClicks,
        });
    } catch (error) {
        return sendError(response, 'Internal server error', 500);
    }
}
