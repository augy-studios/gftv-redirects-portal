// POST /api/auth/logout-all: signs the user out everywhere by deleting all their sessions,
// the current one included.
// Who can call it: any signed-in user (session token).
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'POST') return sendError(response, 'Method not allowed', 405);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);

    const authorizationHeader = request.headers['authorization'] || '';
    const currentToken = authorizationHeader.replace(/^Bearer\s+/i, '').trim();

    const { error } = await supabase.from('gftvhello_sessions').delete().eq('user_id', user.id);
    if (error) return sendError(response, 'Server error', 500);

    return sendSuccess(response, { message: 'All sessions terminated' });
}
