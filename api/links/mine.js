// GET /api/links/mine: lists the signed-in user's own links, newest first.
// Who can call it: Editors and Admins (session token). Viewers get 403.
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'GET') return sendError(response, 'Method not allowed', 405);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);
    if (!user.is_editor && !user.is_admin) return sendError(response, 'Forbidden: Viewers cannot access this page', 403);

    const { data: links, error } = await supabase
        .from('gftvlinks_links')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) return sendError(response, 'Failed to fetch links');
    return sendSuccess(response, { links: links || [] });
}
