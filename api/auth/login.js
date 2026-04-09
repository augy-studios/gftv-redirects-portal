import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    try {
        const { username, password } = await parseBody(req);
        if (!username || !password) return err(res, 'Username and password required');

        const { data: user } = await supabase
            .from('gftvlinks_users')
            .select('*')
            .or(`username.eq.${username.toLowerCase()},email.eq.${username.toLowerCase()}`)
            .single();

        if (!user) return err(res, 'Invalid credentials', 401);

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return err(res, 'Invalid credentials', 401);

        if (!user.is_approved) return err(res, 'PENDING_APPROVAL', 403);

        const token = crypto.randomBytes(48).toString('hex');
        const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        await supabase.from('gftvlinks_sessions').insert({ user_id: user.id, token, expires_at });

        const { password_hash, ...safeUser } = user;
        return ok(res, { token, user: safeUser });
    } catch (e) {
        console.error(e);
        return err(res, 'Server error', 500);
    }
}