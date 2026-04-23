// Delete own account
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'DELETE') return err(res, 'Method not allowed', 405);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);
    if (user.is_admin) return err(res, 'Admin account cannot be deleted via this endpoint', 403);

    try {
        const { password } = await parseBody(req);
        if (!password) return err(res, 'Password required');

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return err(res, 'Incorrect password');

        await supabase.from('gftvhello_users').delete().eq('id', user.id);

        return ok(res, { message: 'Account deleted' });
    } catch (e) {
        return err(res, 'Server error', 500);
    }
}