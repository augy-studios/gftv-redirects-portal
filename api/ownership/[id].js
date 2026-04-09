// Approve or reject ownership request
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'PUT') return err(res, 'Method not allowed', 405);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);

    const id = new URL(req.url, 'http://localhost').pathname.split('/').pop();

    const { action } = await parseBody(req); // approve | reject
    if (!['approve', 'reject'].includes(action)) return err(res, 'Invalid action');

    const { data: request } = await supabase
        .from('gftvlinks_ownership_requests')
        .select('*')
        .eq('id', id)
        .single();

    if (!request) return err(res, 'Request not found', 404);
    if (request.owner_id !== user.id) return err(res, 'Forbidden', 403);

    const status = action === 'approve' ? 'approved' : 'rejected';

    await supabase
        .from('gftvlinks_ownership_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (action === 'approve') {
        await supabase
            .from('gftvlinks_links')
            .update({ user_id: request.requester_id, updated_at: new Date().toISOString() })
            .eq('id', request.link_id);
    }

    return ok(res, { message: `Request ${status}` });
}