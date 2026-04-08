export const config = { runtime: 'edge' };

import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse } from '../../lib/response.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export default async function handler(req) {
    if (req.method === 'OPTIONS') return optionsResponse();
    if (req.method !== 'POST') return err('Method not allowed', 405);

    try {
        const { username, password } = await req.json();
        if (!username || !password) return err('Username and password required');

        const { data: user } = await supabase
            .from('gftvlinks_users')
            .select('*')
            .or(`username.eq.${username.toLowerCase()},email.eq.${username.toLowerCase()}`)
            .single();

        if (!user) return err('Invalid credentials', 401);

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return err('Invalid credentials', 401);

        if (!user.is_approved) return err('PENDING_APPROVAL', 403);

        const token = crypto.randomBytes(48).toString('hex');
        const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        await supabase.from('gftvlinks_sessions').insert({ user_id: user.id, token, expires_at });

        const { password_hash, ...safeUser } = user;
        return ok({ token, user: safeUser });
    } catch (e) {
        console.error(e);
        return err('Server error', 500);
    }
}