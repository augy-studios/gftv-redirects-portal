// Get logged in user's own links
import {
    getSupabase
} from '../../lib/supabase.js';
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
    if (req.method !== 'GET') return err('Method not allowed', 405);

    const user = await getSessionUser(req);
    if (!user) return err('Unauthorized', 401);

    const supabase = getSupabase();
    const {
        data: links,
        error
    } = await supabase
        .from('gftvlinks_links')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', {
            ascending: false
        });

    if (error) return err('Failed to fetch links');
    return ok({
        links: links || []
    });
}