// Ownership requests
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

    const user = await getSessionUser(req);
    if (!user) return err('Unauthorized', 401);

    

    // GET - get ownership requests for current user (as owner)
    if (req.method === 'GET') {
        const {
            data,
            error
        } = await supabase
            .from('gftvlinks_ownership_requests')
            .select(`
        id, status, created_at,
        gftvlinks_links(id, slug, destination),
        requester:gftvlinks_users!gftvlinks_ownership_requests_requester_id_fkey(id, username, display_name, avatar_url)
      `)
            .eq('owner_id', user.id)
            .order('created_at', {
                ascending: false
            });

        if (error) return err('Failed to fetch requests');
        return ok({
            requests: data || []
        });
    }

    // POST - submit ownership request
    if (req.method === 'POST') {
        try {
            const {
                link_id
            } = await req.json();
            if (!link_id) return err('Link ID required');

            const {
                data: link
            } = await supabase
                .from('gftvlinks_links')
                .select('user_id')
                .eq('id', link_id)
                .single();

            if (!link) return err('Link not found');
            if (link.user_id === user.id) return err('You already own this link');

            // Check no pending request exists
            const {
                data: existing
            } = await supabase
                .from('gftvlinks_ownership_requests')
                .select('id')
                .eq('link_id', link_id)
                .eq('requester_id', user.id)
                .eq('status', 'pending')
                .single();

            if (existing) return err('You already have a pending request for this link');

            await supabase.from('gftvlinks_ownership_requests').insert({
                link_id,
                requester_id: user.id,
                owner_id: link.user_id,
                status: 'pending',
            });

            return ok({
                message: 'Ownership request submitted'
            }, 201);
        } catch (e) {
            return err('Server error', 500);
        }
    }

    return err('Method not allowed', 405);
}