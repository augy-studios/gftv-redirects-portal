// Public API v1 — List user's links or create a new link
// Authentication: Authorization: ApiKey <your_api_key>
import supabase from '../../../lib/supabase.js';
import { getApiKeyUser } from '../../../lib/auth.js';
import { ok, err, optionsResponse, parseBody } from '../../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);

    const user = await getApiKeyUser(req);
    if (!user) return err(res, 'Unauthorized: provide a valid API key via "Authorization: ApiKey <key>"', 401);
    if (!user.is_editor && !user.is_admin) return err(res, 'Forbidden: your account does not have Editor or Admin access', 403);

    // GET /api/v1/links — list all links owned by the API key holder
    if (req.method === 'GET') {
        try {
            const url = new URL(req.url, 'http://localhost');
            const slug = url.searchParams.get('slug') || '';
            const tag = url.searchParams.get('tag') || '';
            const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
            const offset = parseInt(url.searchParams.get('offset') || '0', 10);

            let query = supabase
                .from('gftvhello_links')
                .select('id, slug, destination, is_active, access_count, tags, created_at, updated_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (slug) query = query.ilike('slug', `%${slug}%`);
            if (tag) query = query.contains('tags', [tag]);

            const { data: links, error } = await query;
            if (error) return err(res, 'Failed to fetch links', 500);

            return ok(res, { links: links || [], count: (links || []).length });
        } catch (e) {
            console.error(e);
            return err(res, 'Server error', 500);
        }
    }

    // POST /api/v1/links — create a new link
    if (req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { slug, destination, tags = [] } = body;

            if (!slug || typeof slug !== 'string') return err(res, 'slug is required');
            if (!destination || typeof destination !== 'string') return err(res, 'destination is required');
            if (!/^[a-zA-Z0-9_-]{1,60}$/.test(slug)) return err(res, 'slug must be 1–60 alphanumeric characters, hyphens, or underscores');
            if (!Array.isArray(tags) || tags.length > 5) return err(res, 'tags must be an array of up to 5 strings');

            try { new URL(destination); } catch { return err(res, 'destination must be a valid URL'); }
            const destHostname = new URL(destination).hostname;
            const allowedGftvSubdomains = ['guide.gftv.asia', 'form.gftv.asia'];
            if (destHostname.endsWith('gftv.asia') && !allowedGftvSubdomains.includes(destHostname)) return err(res, 'destination cannot point to gftv.asia');

            const { data: created, error } = await supabase
                .from('gftvhello_links')
                .insert({ slug, destination, user_id: user.id, tags })
                .select('id, slug, destination, is_active, access_count, tags, created_at, updated_at')
                .single();

            if (error) {
                if (error.code === '23505') return err(res, 'slug is already taken', 409);
                return err(res, 'Failed to create link', 500);
            }

            return ok(res, { link: created }, 201);
        } catch (e) {
            console.error(e);
            return err(res, 'Server error', 500);
        }
    }

    return err(res, 'Method not allowed', 405);
}
