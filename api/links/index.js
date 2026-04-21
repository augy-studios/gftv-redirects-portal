// List all links (directory) + create link
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);

    // GET - directory listing
    if (req.method === 'GET') {
        try {
            const url = new URL(req.url, 'http://localhost');
            const search = url.searchParams.get('q') || '';
            const searchType = url.searchParams.get('type') || 'keyword';

            let query = supabase
                .from('gftvlinks_links')
                .select(`
                    id, slug, destination, is_active, access_count, tags, created_at,
                    gftvlinks_users(id, username, display_name, avatar_url, social_links, is_admin)
                `)
                .order('created_at', { ascending: false });

            if (search) {
                if (searchType === 'keyword') {
                    query = query.or(`slug.ilike.%${search}%,destination.ilike.%${search}%`);
                } else if (searchType === 'tag') {
                    query = query.contains('tags', [search]);
                }
            }

            const { data: links, error } = await query;
            if (error) return err(res, 'Failed to fetch links');

            let result = links || [];

            if (search && searchType === 'username') {
                result = result.filter(l =>
                    l.gftvlinks_users?.username?.toLowerCase().includes(search.toLowerCase()) ||
                    l.gftvlinks_users?.display_name?.toLowerCase().includes(search.toLowerCase())
                );
            }

            return ok(res, { links: result });
        } catch (e) {
            console.error(e);
            return err(res, 'Server error', 500);
        }
    }

    // POST - create link
    if (req.method === 'POST') {
        if (!user.is_editor && !user.is_admin) return err(res, 'Forbidden: Viewers cannot create links', 403);
        try {
            const { slug, destination, tags = [] } = await parseBody(req);

            if (!slug || !destination) return err(res, 'Slug and destination required');
            if (!/^[a-zA-Z0-9_-]{1,60}$/.test(slug)) return err(res, 'Slug must be alphanumeric, hyphens or underscores, max 60 chars');
            if (tags.length > 5) return err(res, 'Maximum 5 tags allowed');

            try { new URL(destination); } catch { return err(res, 'Invalid destination URL'); }
            const destHostname = new URL(destination).hostname;
            const allowedGftvSubdomains = ['guide.gftv.asia', 'form.gftv.asia'];
            if (destHostname.endsWith('gftv.asia') && !allowedGftvSubdomains.includes(destHostname)) return err(res, 'Destination cannot point to gftv.asia');

            const { error } = await supabase
                .from('gftvlinks_links')
                .insert({ slug, destination, user_id: user.id, tags });

            if (error) {
                if (error.code === '23505') return err(res, 'Slug already taken');
                return err(res, 'Failed to create link');
            }

            return ok(res, { message: 'Link created' }, 201);
        } catch (e) {
            console.error(e);
            return err(res, 'Server error', 500);
        }
    }

    return err(res, 'Method not allowed', 405);
}