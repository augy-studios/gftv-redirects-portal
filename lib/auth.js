// Auth helpers (Node.js runtime)
import supabase from './supabase.js';

export async function getSessionUser(req) {
    const auth = req.headers['authorization'] || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;

    const { data: session } = await supabase
        .from('gftvlinks_sessions')
        .select('*, gftvlinks_users(*)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

    if (!session) return null;
    return session.gftvlinks_users;
}