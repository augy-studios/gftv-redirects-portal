// Admin: list and manage users
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);
    if (!user.is_admin) return err(res, 'Forbidden', 403);

    // GET - list all users
    if (req.method === 'GET') {
        const { data: users, error } = await supabase
            .from('gftvhello_users')
            .select('id, username, display_name, email, is_admin, is_approved, is_editor, avatar_url, created_at')
            .order('created_at', { ascending: false });

        if (error) return err(res, 'Failed to fetch users');
        return ok(res, { users: users || [] });
    }

    // PUT - grant/revoke roles, update details, reset password
    if (req.method === 'PUT') {
        const body = await parseBody(req);
        const { user_id, action, username, display_name, email } = body;
        if (!user_id || !action) return err(res, 'user_id and action required');
        if (user_id === user.id && (action === 'revoke_viewer' || action === 'revoke_editor')) {
            return err(res, 'You cannot revoke your own access', 403);
        }

        const updates = { updated_at: new Date().toISOString() };

        if (action === 'grant_editor') {
            // Grant full editor access (implies view access too)
            updates.is_approved = true;
            updates.is_editor = true;
        } else if (action === 'grant_viewer') {
            // Grant view-only access
            updates.is_approved = true;
            updates.is_editor = false;
        } else if (action === 'revoke_editor') {
            // Downgrade editor to viewer (keep approved but remove editor)
            updates.is_editor = false;
        } else if (action === 'revoke_viewer') {
            // Revoke all access (both view and edit)
            updates.is_approved = false;
            updates.is_editor = false;
        } else if (action === 'toggle_admin') {
            const { data: target } = await supabase
                .from('gftvhello_users')
                .select('is_admin')
                .eq('id', user_id)
                .single();
            updates.is_admin = !target.is_admin;
        } else if (action === 'update_details') {
            if (username !== undefined) {
                const trimmed = username.trim().toLowerCase();
                if (!trimmed) return err(res, 'Username cannot be empty');
                if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return err(res, 'Username can only contain letters, numbers, hyphens and underscores');
                const { data: existing } = await supabase
                    .from('gftvhello_users').select('id').eq('username', trimmed).single();
                if (existing && existing.id !== user_id) return err(res, 'Username already taken');
                updates.username = trimmed;
            }
            if (display_name !== undefined) {
                if (!display_name.trim()) return err(res, 'Display name cannot be empty');
                updates.display_name = display_name.trim();
            }
            if (email !== undefined) {
                const trimmedEmail = email.trim().toLowerCase();
                if (!trimmedEmail) return err(res, 'Email cannot be empty');
                const { data: existing } = await supabase
                    .from('gftvhello_users').select('id').eq('email', trimmedEmail).single();
                if (existing && existing.id !== user_id) return err(res, 'Email already in use');
                updates.email = trimmedEmail;
            }
        } else if (action === 'reset_password') {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let newPassword = '';
            for (let i = 0; i < 16; i++) {
                newPassword += chars[Math.floor(Math.random() * chars.length)];
            }
            updates.password_hash = await bcrypt.hash(newPassword, 10);
            const { error: pwErr } = await supabase
                .from('gftvhello_users').update(updates).eq('id', user_id);
            if (pwErr) return err(res, 'Failed to reset password');
            return ok(res, { message: 'Password reset', password: newPassword });
        } else {
            return err(res, 'Invalid action');
        }

        const { data: targetUser } = await supabase
            .from('gftvhello_users')
            .select('email, is_approved')
            .eq('id', user_id)
            .single();

        const { error } = await supabase
            .from('gftvhello_users')
            .update(updates)
            .eq('id', user_id);

        if (error) return err(res, 'Failed to update user');

        // If granting/revoking approval, sync the pre-approved list
        if ((action === 'grant_editor' || action === 'grant_viewer') && targetUser) {
            await supabase
                .from('gftvhello_users_preapproved')
                .update({ user_id, activated_at: new Date().toISOString() })
                .eq('email', targetUser.email)
                .is('user_id', null);
        } else if (action === 'revoke_viewer' && targetUser) {
            await supabase
                .from('gftvhello_users_preapproved')
                .update({ user_id: null, activated_at: null })
                .eq('email', targetUser.email);
        }

        return ok(res, { message: 'User updated' });
    }

    // DELETE - delete user
    if (req.method === 'DELETE') {
        const user_id = new URL(req.url, 'http://localhost').searchParams.get('user_id');
        if (!user_id) return err(res, 'user_id required');

        await supabase.from('gftvhello_users').delete().eq('id', user_id);
        return ok(res, { message: 'User deleted' });
    }

    return err(res, 'Method not allowed', 405);
}
