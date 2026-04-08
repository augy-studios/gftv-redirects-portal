// Delete own account
export const config = { runtime: 'edge' };
import supabase from '../../lib/supabase.js';
import {
    getSessionUser
} from '../../lib/auth.js';
import {
    ok,
    err,
    optionsResponse
} from '../../lib/response.js';
import bcrypt from 'bcryptjs';

export default async function handler(req) {
    if (req.method === 'OPTIONS') return optionsResponse();
    if (req.method !== 'DELETE') return err('Method not allowed', 405);

    const user = await getSessionUser(req);
    if (!user) return err('Unauthorized', 401);
    if (user.is_admin) return err('Admin account cannot be deleted via this endpoint', 403);

    try {
        const {
            password
        } = await req.json();
        if (!password) return err('Password required');

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return err('Incorrect password');

        
        await supabase.from('gftvlinks_users').delete().eq('id', user.id);

        return ok({
            message: 'Account deleted'
        });
    } catch (e) {
        return err('Server error', 500);
    }
}