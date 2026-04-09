// Admin: list and approve users
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);
    if (!user.is_admin) return err(res, 'Forbidden', 403);

    // GET - list all users
    if (req.method === 'GET') {
        const { data: users, error } = await supabase
            .from('gftvlinks_users')
            .select('id, username, display_name, email, is_admin, is_approved, avatar_url, created_at')
            .order('created_at', { ascending: false });

        if (error) return err(res, 'Failed to fetch users');
        return ok(res, { users: users || [] });
    }

    // PUT - approve/reject/toggle admin
    if (req.method === 'PUT') {
        const { user_id, action } = await parseBody(req);
        if (!user_id || !action) return err(res, 'user_id and action required');

        const updates = { updated_at: new Date().toISOString() };

        if (action === 'approve') updates.is_approved = true;
        else if (action === 'reject') updates.is_approved = false;
        else if (action === 'toggle_admin') {
            const { data: target } = await supabase
                .from('gftvlinks_users')
                .select('is_admin')
                .eq('id', user_id)
                .single();
            updates.is_admin = !target.is_admin;
        } else return err(res, 'Invalid action');

        const { error } = await supabase
            .from('gftvlinks_users')
            .update(updates)
            .eq('id', user_id);

        if (error) return err(res, 'Failed to update user');
        return ok(res, { message: 'User updated' });
    }

    // DELETE - delete user
    if (req.method === 'DELETE') {
        const user_id = new URL(req.url, 'http://localhost').searchParams.get('user_id');
        if (!user_id) return err(res, 'user_id required');

        await supabase.from('gftvlinks_users').delete().eq('id', user_id);
        return ok(res, { message: 'User deleted' });
    }

    return err(res, 'Method not allowed', 405);
}