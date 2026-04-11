import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

    try {
        const user = await getSessionUser(req);
        if (!user) return err(res, 'Unauthorized', 401);

        const { password_hash, totp_secret, ...safeUser } = user;
        safeUser.totp_enabled = !!totp_secret;
        return ok(res, { user: safeUser });
    } catch (e) {
        return err(res, 'Server error', 500);
    }
}