// Public API v1 — Get or update a specific link by slug
// Authentication: Authorization: ApiKey <your_api_key>
import supabase from '../../../lib/supabase.js';
import { getApiKeyUser } from '../../../lib/auth.js';
import { ok, err, optionsResponse, parseBody } from '../../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);

    const user = await getApiKeyUser(req);
    if (!user) return err(res, 'Unauthorized: provide a valid API key via "Authorization: ApiKey <key>"', 401);
    if (!user.is_editor && !user.is_admin) return err(res, 'Forbidden: your account does not have Editor or Admin access', 403);

    const slug = new URL(req.url, 'http://localhost').pathname.split('/').pop();
    if (!slug) return err(res, 'slug is required', 400);

    // Fetch the link
    const { data: link } = await supabase
        .from('gftvhello_links')
        .select('id, slug, destination, is_active, access_count, tags, created_at, updated_at, user_id')
        .eq('slug', slug)
        .single();

    if (!link) return err(res, 'Link not found', 404);

    // GET /api/v1/links/:slug — retrieve a link (any user can read any link by slug)
    if (req.method === 'GET') {
        const { user_id: _, ...publicLink } = link;
        return ok(res, { link: publicLink });
    }

    // PUT /api/v1/links/:slug — update a link (must be the owner or admin)
    if (req.method === 'PUT') {
        const canEdit = (link.user_id === user.id && (user.is_editor || user.is_admin)) || user.is_admin;
        if (!canEdit) return err(res, 'Forbidden: you do not own this link', 403);

        try {
            const body = await parseBody(req);
            const { destination, is_active, tags } = body;
            const updates = { updated_at: new Date().toISOString() };

            if (destination !== undefined) {
                if (typeof destination !== 'string') return err(res, 'destination must be a string');
                try { new URL(destination); } catch { return err(res, 'destination must be a valid URL'); }
                const destHostname = new URL(destination).hostname;
                const allowedGftvSubdomains = ['guide.gftv.asia', 'form.gftv.asia'];
                if (destHostname.endsWith('gftv.asia') && !allowedGftvSubdomains.includes(destHostname)) return err(res, 'destination cannot point to gftv.asia');
                updates.destination = destination;
            }
            if (is_active !== undefined) {
                if (typeof is_active !== 'boolean') return err(res, 'is_active must be a boolean');
                updates.is_active = is_active;
            }
            if (tags !== undefined) {
                if (!Array.isArray(tags) || tags.length > 5) return err(res, 'tags must be an array of up to 5 strings');
                updates.tags = tags;
            }

            const { data: updated, error } = await supabase
                .from('gftvhello_links')
                .update(updates)
                .eq('id', link.id)
                .select('id, slug, destination, is_active, access_count, tags, created_at, updated_at')
                .single();

            if (error) return err(res, 'Failed to update link', 500);
            return ok(res, { link: updated });
        } catch (e) {
            console.error(e);
            return err(res, 'Server error', 500);
        }
    }

    return err(res, 'Method not allowed', 405);
}
