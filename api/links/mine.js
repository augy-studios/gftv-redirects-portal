// Get logged in user's own links
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);
    if (!user.is_editor && !user.is_admin) return err(res, 'Forbidden: Viewers cannot access this page', 403);

    const { data: links, error } = await supabase
        .from('gftvlinks_links')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) return err(res, 'Failed to fetch links');
    return ok(res, { links: links || [] });
}