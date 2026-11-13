// Public API v1: /api/v1/links/:slug, one link by its slug (documented in docs/api/).
//   GET   returns any link, without its owner's user_id.
//   PUT   changes the link's destination, is_active or tags; only its owner or an Admin.
// Who can call it: Editors and Admins, with "Authorization: ApiKey <key>". Viewers get 403.
import supabase from '../../../lib/supabase.js';
import { getApiKeyUser } from '../../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);

    const user = await getApiKeyUser(request);
    if (!user) return sendError(response, 'Unauthorized: provide a valid API key via "Authorization: ApiKey <key>"', 401);
    if (!user.is_editor && !user.is_admin) return sendError(response, 'Forbidden: your account does not have Editor or Admin access', 403);

    const slug = new URL(request.url, 'http://localhost').pathname.split('/').pop();
    if (!slug) return sendError(response, 'slug is required', 400);

    // Fetch the link
    const { data: link } = await supabase
        .from('gftvlinks_links')
        .select('id, slug, destination, is_active, access_count, tags, created_at, updated_at, user_id')
        .eq('slug', slug)
        .single();

    if (!link) return sendError(response, 'Link not found', 404);

    // GET /api/v1/links/:slug: retrieve a link (any user can read any link by slug)
    if (request.method === 'GET') {
        // Leave the owner's user_id out of the reply.
        const { user_id: _ownerUserId, ...publicLink } = link;
        return sendSuccess(response, { link: publicLink });
    }

    // PUT /api/v1/links/:slug: update a link (must be the owner or admin)
    if (request.method === 'PUT') {
        const canEdit = (link.user_id === user.id && (user.is_editor || user.is_admin)) || user.is_admin;
        if (!canEdit) return sendError(response, 'Forbidden: you do not own this link', 403);

        try {
            const body = await parseBody(request);
            const { destination, is_active: isActive, tags } = body;
            const updates = { updated_at: new Date().toISOString() };

            if (destination !== undefined) {
                if (typeof destination !== 'string') return sendError(response, 'destination must be a string');
                // The destination must be a valid URL, and not on gftv.asia except the allowed subdomains.
                try { new URL(destination); } catch { return sendError(response, 'destination must be a valid URL'); }
                const destinationHostname = new URL(destination).hostname;
                const allowedGftvSubdomains = ['guide.gftv.asia', 'form.gftv.asia'];
                if (destinationHostname.endsWith('gftv.asia') && !allowedGftvSubdomains.includes(destinationHostname)) return sendError(response, 'destination cannot point to gftv.asia');
                updates.destination = destination;
            }
            if (isActive !== undefined) {
                if (typeof isActive !== 'boolean') return sendError(response, 'is_active must be a boolean');
                updates.is_active = isActive;
            }
            if (tags !== undefined) {
                if (!Array.isArray(tags) || tags.length > 5) return sendError(response, 'tags must be an array of up to 5 strings');
                updates.tags = tags;
            }

            const { data: updatedLink, error } = await supabase
                .from('gftvlinks_links')
                .update(updates)
                .eq('id', link.id)
                .select('id, slug, destination, is_active, access_count, tags, created_at, updated_at')
                .single();

            if (error) return sendError(response, 'Failed to update link', 500);
            return sendSuccess(response, { link: updatedLink });
        } catch (error) {
            console.error(error);
            return sendError(response, 'Server error', 500);
        }
    }

    return sendError(response, 'Method not allowed', 405);
}
