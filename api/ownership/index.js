// /api/ownership: link ownership requests.
//   GET                the requests sent to the signed-in user for links they own, newest first.
//   POST { link_id }   asks a link's owner to hand the link over (201).
// Who can call it: any signed-in user (session token).
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);

    // GET - get ownership requests for current user (as owner)
    if (request.method === 'GET') {
        const { data: ownershipRequests, error } = await supabase
            .from('gftvlinks_ownership_requests')
            .select(`
                id, status, created_at,
                gftvlinks_links(id, slug, destination),
                requester:gftvhello_users!gftvlinks_ownership_requests_requester_id_fkey(id, username, display_name, avatar_url)
            `)
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false });

        if (error) return sendError(response, 'Failed to fetch requests');
        return sendSuccess(response, { requests: ownershipRequests || [] });
    }

    // POST - submit ownership request
    if (request.method === 'POST') {
        try {
            const { link_id: linkId } = await parseBody(request);
            if (!linkId) return sendError(response, 'Link ID required');

            const { data: link } = await supabase
                .from('gftvlinks_links')
                .select('user_id')
                .eq('id', linkId)
                .single();

            if (!link) return sendError(response, 'Link not found');
            if (link.user_id === user.id) return sendError(response, 'You already own this link');

            const { data: existing } = await supabase
                .from('gftvlinks_ownership_requests')
                .select('id')
                .eq('link_id', linkId)
                .eq('requester_id', user.id)
                .eq('status', 'pending')
                .single();

            if (existing) return sendError(response, 'You already have a pending request for this link');

            await supabase.from('gftvlinks_ownership_requests').insert({
                link_id: linkId,
                requester_id: user.id,
                owner_id: link.user_id,
                status: 'pending',
            });

            return sendSuccess(response, { message: 'Ownership request submitted' }, 201);
        } catch (error) {
            return sendError(response, 'Server error', 500);
        }
    }

    return sendError(response, 'Method not allowed', 405);
}
