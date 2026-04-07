import supabase from './supabase.js';

export async function getSessionUser(req) {
    const auth = req.headers.get('Authorization') || '';
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

export function requireAuth(user) {
    if (!user) throw new Error('UNAUTHORIZED');
}

export function requireAdmin(user) {
    if (!user || !user.is_admin) throw new Error('FORBIDDEN');
}
