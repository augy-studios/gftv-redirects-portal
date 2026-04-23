import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';
import { getSessionUser } from '../../lib/auth.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    try {
        const user = await getSessionUser(req);
        if (!user) return err(res, 'Unauthorized', 401);

        const { password } = await parseBody(req);
        if (!password) return err(res, 'Password required');

        const { data: fullUser } = await supabase
            .from('gftvhello_users')
            .select('password_hash')
            .eq('id', user.id)
            .single();

        const valid = await bcrypt.compare(password, fullUser.password_hash);
        if (!valid) return err(res, 'Incorrect password', 401);

        await supabase.from('gftvhello_users').update({ totp_secret: null }).eq('id', user.id);
        await supabase.from('gftvhello_trusted_devices').delete().eq('user_id', user.id);
        await supabase.from('gftvhello_backup_codes').delete().eq('user_id', user.id);

        return ok(res, { message: '2FA disabled successfully' });
    } catch (e) {
        console.error(e);
        return err(res, 'Server error', 500);
    }
}
