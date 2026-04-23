// Profile views: track who viewed whose profile and when
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);

    // POST - record a profile view (upsert: update viewed_at if already viewed)
    if (req.method === 'POST') {
        const { viewed_id } = await parseBody(req);
        if (!viewed_id) return err(res, 'viewed_id required');

        // Don't track self-views in the table (viewer clicking own profile)
        if (viewed_id === user.id) return ok(res, { message: 'Self-view not tracked' });

        const { error } = await supabase
            .from('gftvhello_profileviews')
            .upsert(
                { viewer_id: user.id, viewed_id, viewed_at: new Date().toISOString() },
                { onConflict: 'viewer_id,viewed_id' }
            );

        if (error) return err(res, 'Failed to record view');
        return ok(res, { message: 'View recorded' });
    }

    // GET - fetch 5 most recent viewers for a profile (excluding the profile owner)
    if (req.method === 'GET') {
        const profile_id = new URL(req.url, 'http://localhost').searchParams.get('profile_id');
        if (!profile_id) return err(res, 'profile_id required');

        const { data, error } = await supabase
            .from('gftvhello_profileviews')
            .select(`
                viewed_at,
                viewer:viewer_id(id, username, display_name, avatar_url)
            `)
            .eq('viewed_id', profile_id)
            .neq('viewer_id', profile_id)
            .order('viewed_at', { ascending: false })
            .limit(5);

        if (error) return err(res, 'Failed to fetch viewers');
        return ok(res, { viewers: (data || []).map(r => ({ ...r.viewer, viewed_at: r.viewed_at })) });
    }

    return err(res, 'Method not allowed', 405);
}
