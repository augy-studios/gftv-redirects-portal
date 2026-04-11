import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';
import bcrypt from 'bcryptjs';
import passwordEntropy from 'fast-password-entropy';

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
            .from('gftvlinks_users')
            .select('id')
            .or(`username.eq.${username},email.eq.${email}`)
            .limit(1);

        if (existing && existing.length > 0)
            return err(res, 'Username or email already in use');

        const password_hash = await bcrypt.hash(password, 10);

        const { error } = await supabase
            .from('gftvlinks_users')
            .insert({
                username: username.toLowerCase(),
                display_name,
                email: email.toLowerCase(),
                password_hash,
                is_approved: false,
                is_admin: false,
            });

        if (error) return err(res, 'Failed to create account');

        return ok(res, { message: 'Account created. Waiting for admin approval.' }, 201);
    } catch (e) {
        console.error(e);
        return err(res, 'Server error', 500);
    }
}