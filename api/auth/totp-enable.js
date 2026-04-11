import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';
import { getSessionUser } from '../../lib/auth.js';
import { authenticator } from 'otplib';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    try {
        const user = await getSessionUser(req);
        if (!user) return err(res, 'Unauthorized', 401);

        const { secret, code } = await parseBody(req);
        if (!secret || !code) return err(res, 'Secret and code required');

        let isValid = false;
        try {
            isValid = authenticator.verify({ token: code, secret });
        } catch {
            return err(res, 'Invalid verification code', 400);
        }
        if (!isValid) return err(res, 'Invalid verification code', 400);

        const { error } = await supabase
            .from('gftvlinks_users')
            .update({ totp_secret: secret })
            .eq('id', user.id);

        if (error) return err(res, 'Failed to enable 2FA', 500);

        return ok(res, { message: '2FA enabled successfully' });
    } catch (e) {
        console.error(e);
        return err(res, 'Server error', 500);
    }
}
