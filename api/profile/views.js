// /api/profile/views: who has looked at whose profile, and when.
//   POST { viewed_id }        records that the signed-in user viewed that profile (views of your
//                             own profile aren't recorded).
//   GET  ?profile_id=<id>     the 5 most recent viewers of a profile, not counting its owner.
// Who can call it: any signed-in user (session token). GET works for any profile.
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);

    // POST - record a profile view (upsert: update viewed_at if already viewed)
    if (request.method === 'POST') {
        const { viewed_id: viewedId } = await parseBody(request);
        if (!viewedId) return sendError(response, 'viewed_id required');

        // Don't track self-views in the table (viewer clicking own profile)
        if (viewedId === user.id) return sendSuccess(response, { message: 'Self-view not tracked' });

        const { error } = await supabase
            .from('gftvlinks_profileviews')
            .upsert(
                { viewer_id: user.id, viewed_id: viewedId, viewed_at: new Date().toISOString() },
                { onConflict: 'viewer_id,viewed_id' }
            );

        if (error) return sendError(response, 'Failed to record view');
        return sendSuccess(response, { message: 'View recorded' });
    }

    // GET - fetch 5 most recent viewers for a profile (excluding the profile owner)
    if (request.method === 'GET') {
        const profileId = new URL(request.url, 'http://localhost').searchParams.get('profile_id');
        if (!profileId) return sendError(response, 'profile_id required');

        const { data: profileViews, error } = await supabase
            .from('gftvlinks_profileviews')
            .select(`
                viewed_at,
                viewer:viewer_id(id, username, display_name, avatar_url)
            `)
            .eq('viewed_id', profileId)
            .neq('viewer_id', profileId)
            .order('viewed_at', { ascending: false })
            .limit(5);

        if (error) return sendError(response, 'Failed to fetch viewers');
        // Each viewer is their user fields plus viewed_at.
        const viewers = (profileViews || []).map(profileView => ({ ...profileView.viewer, viewed_at: profileView.viewed_at }));
        return sendSuccess(response, { viewers });
    }

    return sendError(response, 'Method not allowed', 405);
}
