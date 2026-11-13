// /api/links: the link directory, and creating links.
//   GET   every link with its owner, newest first. ?q= searches, and ?type= says how: keyword
//         (slug or destination, the default), tag or username.
//   POST  creates a link from { slug, destination, tags } (201).
// Who can call it: GET, any signed-in user; POST, Editors and Admins (session token).
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);

    // GET - directory listing
    if (request.method === 'GET') {
        try {
            const url = new URL(request.url, 'http://localhost');
            const search = url.searchParams.get('q') || '';
            const searchType = url.searchParams.get('type') || 'keyword';

            let query = supabase
                .from('gftvlinks_links')
                .select(`
                    id, slug, destination, is_active, access_count, tags, created_at,
                    gftvhello_users(id, username, display_name, avatar_url, social_links, is_admin)
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
            if (error) return sendError(response, 'Failed to fetch links');

            let result = links || [];

            // A username search matches the owner's username or display name, ignoring case.
            if (search && searchType === 'username') {
                result = result.filter(link =>
                    link.gftvhello_users?.username?.toLowerCase().includes(search.toLowerCase()) ||
                    link.gftvhello_users?.display_name?.toLowerCase().includes(search.toLowerCase())
                );
            }

            return sendSuccess(response, { links: result });
        } catch (error) {
            console.error(error);
            return sendError(response, 'Server error', 500);
        }
    }

    // POST - create link
    if (request.method === 'POST') {
        if (!user.is_editor && !user.is_admin) return sendError(response, 'Forbidden: Viewers cannot create links', 403);
        try {
            const { slug, destination, tags = [] } = await parseBody(request);

            if (!slug || !destination) return sendError(response, 'Slug and destination required');
            if (!/^[a-zA-Z0-9_-]{1,60}$/.test(slug)) return sendError(response, 'Slug must be alphanumeric, hyphens or underscores, max 60 chars');
            if (tags.length > 5) return sendError(response, 'Maximum 5 tags allowed');

            // The destination must be a valid URL, and not on gftv.asia except the allowed subdomains.
            try { new URL(destination); } catch { return sendError(response, 'Invalid destination URL'); }
            const destinationHostname = new URL(destination).hostname;
            const allowedGftvSubdomains = ['guide.gftv.asia', 'form.gftv.asia'];
            if (destinationHostname.endsWith('gftv.asia') && !allowedGftvSubdomains.includes(destinationHostname)) return sendError(response, 'Destination cannot point to gftv.asia');

            const { error } = await supabase
                .from('gftvlinks_links')
                .insert({ slug, destination, user_id: user.id, tags });

            if (error) {
                if (error.code === '23505') return sendError(response, 'Slug already taken');
                return sendError(response, 'Failed to create link');
            }

            return sendSuccess(response, { message: 'Link created' }, 201);
        } catch (error) {
            console.error(error);
            return sendError(response, 'Server error', 500);
        }
    }

    return sendError(response, 'Method not allowed', 405);
}
