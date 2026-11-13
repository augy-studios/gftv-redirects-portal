// POST /api/auth/logout: signs out of the current session by deleting its session token.
// Who can call it: anyone. With no token, or an unknown one, it still replies "Logged out".
import supabase from '../../lib/supabase.js';
import { sendSuccess, sendError, sendOptionsResponse } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'POST') return sendError(response, 'Method not allowed', 405);

    const authorizationHeader = request.headers['authorization'] || '';
    const token = authorizationHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) await supabase.from('gftvhello_sessions').delete().eq('token', token);

    return sendSuccess(response, { message: 'Logged out' });
}
