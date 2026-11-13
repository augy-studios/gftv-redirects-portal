// PUT /api/ownership/:id: answers an ownership request with { action: 'approve' | 'reject' }.
// Approving hands the link to the user who asked for it.
// Who can call it: the signed-in user the request was sent to, as the link's owner (session token).
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'PUT') return sendError(response, 'Method not allowed', 405);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);

    const requestId = new URL(request.url, 'http://localhost').pathname.split('/').pop();

    const { action } = await parseBody(request); // approve | reject
    if (!['approve', 'reject'].includes(action)) return sendError(response, 'Invalid action');

    const { data: ownershipRequest } = await supabase
        .from('gftvlinks_ownership_requests')
        .select('*')
        .eq('id', requestId)
        .single();

    if (!ownershipRequest) return sendError(response, 'Request not found', 404);
    if (ownershipRequest.owner_id !== user.id) return sendError(response, 'Forbidden', 403);

    let status;
    if (action === 'approve') {
        status = 'approved';
    } else {
        status = 'rejected';
    }

    await supabase
        .from('gftvlinks_ownership_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId);

    if (action === 'approve') {
        await supabase
            .from('gftvlinks_links')
            .update({ user_id: ownershipRequest.requester_id, updated_at: new Date().toISOString() })
            .eq('id', ownershipRequest.link_id);
    }

    return sendSuccess(response, { message: `Request ${status}` });
}
