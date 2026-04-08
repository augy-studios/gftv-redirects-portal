import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse } from '../../lib/response.js';
import bcrypt from 'bcryptjs';

const parseBody = (req) => new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    req.on('error', reject);
});

export default async function handler(req) {
    if (req.method === 'OPTIONS') return optionsResponse();
    if (req.method !== 'POST') return err('Method not allowed', 405);

    try {
        const { username, display_name, email, password } = await parseBody(req);

        if (!username || !display_name || !email || !password)
            return err('All fields are required');

        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
            return err('Username must be 3-30 alphanumeric characters or underscores');

        if (password.length < 8)
            return err('Password must be at least 8 characters');

        const { data: existing } = await supabase
            .from('gftvlinks_users')
            .select('id')
            .or(`username.eq.${username},email.eq.${email}`)
            .limit(1);

        if (existing && existing.length > 0)
            return err('Username or email already in use');

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

        if (error) return err('Failed to create account');

        return ok({ message: 'Account created. Waiting for admin approval.' }, 201);
    } catch (e) {
        console.error(e);
        return err('Server error', 500);
    }
}