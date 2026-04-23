// Auth helpers (Node.js runtime)
import supabase from './supabase.js';

export async function getSessionUser(req) {
    const auth = req.headers['authorization'] || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
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

export async function getApiKeyUser(req) {
    const auth = req.headers['authorization'] || '';
    const match = auth.match(/^ApiKey\s+(.+)$/i);
    if (!match) return null;
    const apiKey = match[1].trim();
    if (!apiKey) return null;

    const { data: row } = await supabase
        .from('gftvhello_api_keys')
        .select('*, gftvhello_users(*)')
        .eq('api_key', apiKey)
        .single();

    if (!row) return null;
    return row.gftvhello_users;
}