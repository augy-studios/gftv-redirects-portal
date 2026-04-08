export const config = { runtime: 'edge' };

import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse } from '../../lib/response.js';

export default async function handler(req) {
    if (req.method === 'OPTIONS') return optionsResponse();
    if (req.method !== 'GET') return err('Method not allowed', 405);

    try {
        const user = await getSessionUser(req);
        if (!user) return err('Unauthorized', 401);

        const { password_hash, ...safeUser } = user;
        return ok({ user: safeUser });
    } catch (e) {
        return err('Server error', 500);
    }
}