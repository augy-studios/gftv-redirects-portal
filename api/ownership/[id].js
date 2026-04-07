// Approve or reject ownership request
import supabase from '../../lib/supabase.js';
import {
    getSessionUser
} from '../../lib/auth.js';
import {
    ok,
    err,
    optionsResponse
} from '../../lib/response.js';

export default async function handler(req) {
    if (req.method === 'OPTIONS') return optionsResponse();
    if (req.method !== 'PUT') return err('Method not allowed', 405);

    const user = await getSessionUser(req);
    if (!user) return err('Unauthorized', 401);

    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();

    const {
        action
    } = await req.json(); // approve | reject
    if (!['approve', 'reject'].includes(action)) return err('Invalid action');

    

    const {
        data: request
    } = await supabase
        .from('gftvlinks_ownership_requests')
        .select('*')
        .eq('id', id)
        .single();

    if (!request) return err('Request not found', 404);
    if (request.owner_id !== user.id) return err('Forbidden', 403);

    const status = action === 'approve' ? 'approved' : 'rejected';

    await supabase
        .from('gftvlinks_ownership_requests')
        .update({
            status,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (action === 'approve') {
        await supabase
            .from('gftvlinks_links')
            .update({
                user_id: request.requester_id,
                updated_at: new Date().toISOString()
            })
            .eq('id', request.link_id);
    }

    return ok({
        message: `Request ${status}`
    });
}