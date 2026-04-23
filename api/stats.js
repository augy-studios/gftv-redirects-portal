// Public stats endpoint — no auth required
import supabase from '../lib/supabase.js';
import { ok, err, optionsResponse } from '../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

    try {
        const [editorsRes, linksRes, clicksRes] = await Promise.all([
            supabase
                .from('gftvhello_users')
                .select('*', { count: 'exact', head: true })
                .eq('is_approved', true)
                .or('is_editor.eq.true,is_admin.eq.true'),
            supabase
                .from('gftvhello_links')
                .select('*', { count: 'exact', head: true }),
            supabase
                .from('gftvhello_links')
                .select('access_count'),
        ]);

        if (editorsRes.error || linksRes.error || clicksRes.error) {
            return err(res, 'Failed to fetch stats', 500);
        }

        const totalClicks = (clicksRes.data || []).reduce((sum, l) => sum + (l.access_count || 0), 0);

        return ok(res, {
            officers: editorsRes.count || 0,
            links: linksRes.count || 0,
            clicks: totalClicks,
        });
    } catch (error) {
        return err(res, 'Internal server error', 500);
    }
}
