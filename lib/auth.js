// Auth helpers for the API handlers (Node.js runtime): find the user behind a request, from a
// session token or from an API key.
import supabase from './supabase.js';

// The signed-in user for a request sent with "Authorization: Bearer <session token>", as their
// full gftvhello_users row, or null when the token is missing, unknown or expired.
export async function getSessionUser(request) {
    const authorizationHeader = request.headers['authorization'] || '';
    const token = authorizationHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;

    const { data: session } = await supabase
        .from('gftvhello_sessions')
        .select('*, gftvhello_users(*)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

    if (!session) return null;
    return session.gftvhello_users;
}

// The owner of the API key in "Authorization: ApiKey <key>" (used by the public v1 API), as their
// full gftvhello_users row, or null when there's no key or it's unknown.
export async function getApiKeyUser(request) {
    const authorizationHeader = request.headers['authorization'] || '';
    const apiKeyMatch = authorizationHeader.match(/^ApiKey\s+(.+)$/i);
    if (!apiKeyMatch) return null;
    const apiKey = apiKeyMatch[1].trim();
    if (!apiKey) return null;

    const { data: apiKeyRow } = await supabase
        .from('gftvlinks_api_keys')
        .select('*, gftvhello_users(*)')
        .eq('api_key', apiKey)
        .single();

    if (!apiKeyRow) return null;
    return apiKeyRow.gftvhello_users;
}
