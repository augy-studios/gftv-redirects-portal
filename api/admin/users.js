// /api/admin/users: the Admin's list of users, and the tools to manage them.
//   GET                          every user, newest first.
//   PUT { user_id, action, … }   action is one of grant_editor, grant_viewer, revoke_editor,
//                                revoke_viewer, toggle_admin, update_details (with username,
//                                display_name or email) or reset_password (returns a new random
//                                password, this once).
//   DELETE ?user_id=<id>         deletes a user.
// Who can call it: Admins only (session token).
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';
import bcrypt from 'bcryptjs';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);
    if (!user.is_admin) return sendError(response, 'Forbidden', 403);

    // GET - list all users
    if (request.method === 'GET') {
        const { data: users, error } = await supabase
            .from('gftvhello_users')
            .select('id, username, display_name, email, is_admin, is_approved, is_editor, avatar_url, created_at')
            .order('created_at', { ascending: false });

        if (error) return sendError(response, 'Failed to fetch users');
        return sendSuccess(response, { users: users || [] });
    }

    // PUT - grant/revoke roles, update details, reset password
    if (request.method === 'PUT') {
        const body = await parseBody(request);
        const { user_id: targetUserId, action, username, display_name: displayName, email } = body;
        if (!targetUserId || !action) return sendError(response, 'user_id and action required');
        if (targetUserId === user.id && (action === 'revoke_viewer' || action === 'revoke_editor')) {
            return sendError(response, 'You cannot revoke your own access', 403);
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
                .eq('id', targetUserId)
                .single();
            updates.is_admin = !target.is_admin;
        } else if (action === 'update_details') {
            // Change any of username, display name and email; each is checked, and a username or
            // email can't be one another user already has.
            if (username !== undefined) {
                const trimmedUsername = username.trim().toLowerCase();
                if (!trimmedUsername) return sendError(response, 'Username cannot be empty');
                if (/\s/.test(trimmedUsername)) return sendError(response, 'Username cannot contain spaces');
                if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) return sendError(response, 'Username can only contain letters, numbers, hyphens and underscores');
                const { data: existing } = await supabase
                    .from('gftvhello_users').select('id').eq('username', trimmedUsername).single();
                if (existing && existing.id !== targetUserId) return sendError(response, 'Username already taken');
                updates.username = trimmedUsername;
            }
            if (displayName !== undefined) {
                if (!displayName.trim()) return sendError(response, 'Display name cannot be empty');
                updates.display_name = displayName.trim();
            }
            if (email !== undefined) {
                const trimmedEmail = email.trim().toLowerCase();
                if (!trimmedEmail) return sendError(response, 'Email cannot be empty');
                if (/\s/.test(trimmedEmail)) return sendError(response, 'Email cannot contain spaces');
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return sendError(response, 'Invalid email address');
                const { data: existing } = await supabase
                    .from('gftvhello_users').select('id').eq('email', trimmedEmail).single();
                if (existing && existing.id !== targetUserId) return sendError(response, 'Email already in use');
                updates.email = trimmedEmail;
            }
        } else if (action === 'reset_password') {
            // Make a random 16-character password, save its hash and return it to the Admin.
            const passwordCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let newPassword = '';
            for (let characterIndex = 0; characterIndex < 16; characterIndex++) {
                newPassword += passwordCharacters[Math.floor(Math.random() * passwordCharacters.length)];
            }
            updates.password_hash = await bcrypt.hash(newPassword, 10);
            const { error: passwordError } = await supabase
                .from('gftvhello_users').update(updates).eq('id', targetUserId);
            if (passwordError) return sendError(response, 'Failed to reset password');
            return sendSuccess(response, { message: 'Password reset', password: newPassword });
        } else {
            return sendError(response, 'Invalid action');
        }

        const { data: targetUser } = await supabase
            .from('gftvhello_users')
            .select('email, is_approved')
            .eq('id', targetUserId)
            .single();

        const { error } = await supabase
            .from('gftvhello_users')
            .update(updates)
            .eq('id', targetUserId);

        if (error) return sendError(response, 'Failed to update user');

        // If granting/revoking approval, sync the pre-approved list
        if ((action === 'grant_editor' || action === 'grant_viewer') && targetUser) {
            await supabase
                .from('gftvhello_users_preapproved')
                .update({ user_id: targetUserId, activated_at: new Date().toISOString() })
                .eq('email', targetUser.email)
                .is('user_id', null);
        } else if (action === 'revoke_viewer' && targetUser) {
            await supabase
                .from('gftvhello_users_preapproved')
                .update({ user_id: null, activated_at: null })
                .eq('email', targetUser.email);
        }

        return sendSuccess(response, { message: 'User updated' });
    }

    // DELETE - delete user
    if (request.method === 'DELETE') {
        const targetUserId = new URL(request.url, 'http://localhost').searchParams.get('user_id');
        if (!targetUserId) return sendError(response, 'user_id required');

        await supabase.from('gftvhello_users').delete().eq('id', targetUserId);
        return sendSuccess(response, { message: 'User deleted' });
    }

    return sendError(response, 'Method not allowed', 405);
}
