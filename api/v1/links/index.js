// Public API v1: /api/v1/links (documented in docs/api/).
//   GET   the API key holder's own links, newest first. Filters: ?slug= (part of the slug) and
//         ?tag=. Paging: ?limit= (50 by default, 100 at most) and ?offset=.
//   POST  creates a link from { slug, destination, tags } (201; 409 if the slug is taken).
// Who can call it: Editors and Admins, with "Authorization: ApiKey <key>". Viewers get 403.
import supabase from '../../../lib/supabase.js';
import { getApiKeyUser } from '../../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);

    const user = await getApiKeyUser(request);
    if (!user) return sendError(response, 'Unauthorized: provide a valid API key via "Authorization: ApiKey <key>"', 401);
    if (!user.is_editor && !user.is_admin) return sendError(response, 'Forbidden: your account does not have Editor or Admin access', 403);

    // GET /api/v1/links: list all links owned by the API key holder
    if (request.method === 'GET') {
        try {
            const url = new URL(request.url, 'http://localhost');
            const slug = url.searchParams.get('slug') || '';
            const tag = url.searchParams.get('tag') || '';
            const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
            const offset = parseInt(url.searchParams.get('offset') || '0', 10);

            let query = supabase
                .from('gftvlinks_links')
                .select('id, slug, destination, is_active, access_count, tags, created_at, updated_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (slug) query = query.ilike('slug', `%${slug}%`);
            if (tag) query = query.contains('tags', [tag]);

            const { data: links, error } = await query;
            if (error) return sendError(response, 'Failed to fetch links', 500);

            return sendSuccess(response, { links: links || [], count: (links || []).length });
        } catch (error) {
            console.error(error);
            return sendError(response, 'Server error', 500);
        }
    }

    // POST /api/v1/links: create a new link
    if (request.method === 'POST') {
        try {
            const body = await parseBody(request);
            const { slug, destination, tags = [] } = body;

            if (!slug || typeof slug !== 'string') return sendError(response, 'slug is required');
            if (!destination || typeof destination !== 'string') return sendError(response, 'destination is required');
            if (!/^[a-zA-Z0-9_-]{1,60}$/.test(slug)) return sendError(response, 'slug must be 1–60 alphanumeric characters, hyphens, or underscores');
            if (!Array.isArray(tags) || tags.length > 5) return sendError(response, 'tags must be an array of up to 5 strings');

            // The destination must be a valid URL, and not on gftv.asia except the allowed subdomains.
            try { new URL(destination); } catch { return sendError(response, 'destination must be a valid URL'); }
            const destinationHostname = new URL(destination).hostname;
            const allowedGftvSubdomains = ['guide.gftv.asia', 'form.gftv.asia'];
            if (destinationHostname.endsWith('gftv.asia') && !allowedGftvSubdomains.includes(destinationHostname)) return sendError(response, 'destination cannot point to gftv.asia');

            const { data: createdLink, error } = await supabase
                .from('gftvlinks_links')
                .insert({ slug, destination, user_id: user.id, tags })
                .select('id, slug, destination, is_active, access_count, tags, created_at, updated_at')
                .single();

            if (error) {
                if (error.code === '23505') return sendError(response, 'slug is already taken', 409);
                return sendError(response, 'Failed to create link', 500);
            }

            return sendSuccess(response, { link: createdLink }, 201);
        } catch (error) {
            console.error(error);
            return sendError(response, 'Server error', 500);
        }
    }

    return sendError(response, 'Method not allowed', 405);
}
