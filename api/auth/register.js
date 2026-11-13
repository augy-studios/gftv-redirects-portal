// POST /api/auth/register: creates an account from { username, display_name, email, password }.
// An email an Admin has pre-approved (see /api/admin/preapproved) is approved at once with its
// role, and signed in with a 30-day session; anyone else waits for an Admin to approve them.
// Who can call it: anyone.
import supabase from '../../lib/supabase.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';
import bcrypt from 'bcryptjs';
import passwordEntropy from 'fast-password-entropy';
import crypto from 'crypto';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'POST') return sendError(response, 'Method not allowed', 405);

    try {
        const { username, display_name: displayName, email, password } = await parseBody(request);

        if (!username || !displayName || !email || !password)
            return sendError(response, 'All fields are required');

        if (/\s/.test(username)) return sendError(response, 'Username cannot contain spaces');
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
            return sendError(response, 'Username must be 3-30 alphanumeric characters or underscores');

        if (/\s/.test(email)) return sendError(response, 'Email cannot contain spaces');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(response, 'Invalid email address');

        if (passwordEntropy(password) < 36)
            return sendError(response, 'Password is too weak. Use a longer password with a mix of uppercase, lowercase, numbers, and symbols.');

        const { data: existing } = await supabase
            .from('gftvhello_users')
            .select('id')
            .or(`username.eq.${username},email.eq.${email}`)
            .limit(1);

        if (existing && existing.length > 0)
            return sendError(response, 'Username or email already in use');

        // Check if this email has been pre-approved by an admin
        const { data: preapproved } = await supabase
            .from('gftvhello_users_preapproved')
            .select('id, preapproved_role')
            .eq('email', email.trim().toLowerCase())
            .is('user_id', null)
            .maybeSingle();

        const passwordHash = await bcrypt.hash(password, 10);

        // A pre-approved account is approved straight away, as an editor if that was its role.
        let isApproved;
        let isEditor;
        if (preapproved) {
            isApproved = true;
            isEditor = preapproved.preapproved_role === 'editor';
        } else {
            isApproved = false;
            isEditor = false;
        }

        const insertData = {
            username: username.toLowerCase(),
            display_name: displayName,
            email: email.toLowerCase(),
            password_hash: passwordHash,
            is_approved: isApproved,
            is_editor: isEditor,
            is_admin: false,
        };

        const { data: newUser, error } = await supabase
            .from('gftvhello_users')
            .insert(insertData)
            .select('id, username, display_name, email, is_admin, is_approved, is_editor, avatar_url, created_at')
            .single();

        if (error) return sendError(response, 'Failed to create account');

        // If pre-approved: link the record, create a session for immediate login
        if (preapproved && newUser) {
            await supabase
                .from('gftvhello_users_preapproved')
                .update({ user_id: newUser.id, activated_at: new Date().toISOString() })
                .eq('id', preapproved.id);

            const token = crypto.randomBytes(48).toString('hex');
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await supabase.from('gftvhello_sessions').insert({ user_id: newUser.id, token, expires_at: expiresAt });

            return sendSuccess(response, {
                message: 'Account created and pre-approved!',
                preapproved: true,
                preapproved_role: preapproved.preapproved_role,
                token,
                user: { ...newUser, totp_enabled: false },
            }, 201);
        }

        return sendSuccess(response, { message: 'Account created. Waiting for admin approval.' }, 201);
    } catch (error) {
        console.error(error);
        return sendError(response, 'Server error', 500);
    }
}
