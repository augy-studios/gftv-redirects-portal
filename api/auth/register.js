import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';
import bcrypt from 'bcryptjs';
import passwordEntropy from 'fast-password-entropy';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    try {
        const { username, display_name, email, password } = await parseBody(req);

        if (!username || !display_name || !email || !password)
            return err(res, 'All fields are required');

        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
            return err(res, 'Username must be 3-30 alphanumeric characters or underscores');

        if (passwordEntropy(password) < 36)
            return err(res, 'Password is too weak. Use a longer password with a mix of uppercase, lowercase, numbers, and symbols.');

        const { data: existing } = await supabase
            .from('gftvhello_users')
            .select('id')
            .or(`username.eq.${username},email.eq.${email}`)
            .limit(1);

        if (existing && existing.length > 0)
            return err(res, 'Username or email already in use');

        // Check if this email has been pre-approved by an admin
        const { data: preapproved } = await supabase
            .from('gftvhello_users_preapproved')
            .select('id, preapproved_role')
            .eq('email', email.toLowerCase())
            .is('user_id', null)
            .maybeSingle();

        const password_hash = await bcrypt.hash(password, 10);

        const insertData = {
            username: username.toLowerCase(),
            display_name,
            email: email.toLowerCase(),
            password_hash,
            is_approved: preapproved ? true : false,
            is_editor: preapproved ? preapproved.preapproved_role === 'editor' : false,
            is_admin: false,
        };

        const { data: newUser, error } = await supabase
            .from('gftvhello_users')
            .insert(insertData)
            .select('id, username, display_name, email, is_admin, is_approved, is_editor, avatar_url, created_at')
            .single();

        if (error) return err(res, 'Failed to create account');

        // If pre-approved: link the record, create a session for immediate login
        if (preapproved && newUser) {
            await supabase
                .from('gftvhello_users_preapproved')
                .update({ user_id: newUser.id, activated_at: new Date().toISOString() })
                .eq('id', preapproved.id);

            const token = crypto.randomBytes(48).toString('hex');
            const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await supabase.from('gftvhello_sessions').insert({ user_id: newUser.id, token, expires_at });

            return ok(res, {
                message: 'Account created and pre-approved!',
                preapproved: true,
                preapproved_role: preapproved.preapproved_role,
                token,
                user: { ...newUser, totp_enabled: false },
            }, 201);
        }

        return ok(res, { message: 'Account created. Waiting for admin approval.' }, 201);
    } catch (e) {
        console.error(e);
        return err(res, 'Server error', 500);
    }
}
