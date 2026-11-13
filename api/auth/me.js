// GET /api/auth/me: returns the signed-in user, without their password hash or TOTP secret, with
// totp_enabled saying whether 2FA is on.
// Who can call it: any signed-in user (session token).
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'GET') return sendError(response, 'Method not allowed', 405);

    try {
        const user = await getSessionUser(request);
        if (!user) return sendError(response, 'Unauthorized', 401);

        // Leave the password hash and the TOTP secret out of the reply.
        const { password_hash: passwordHash, totp_secret: totpSecret, ...safeUser } = user;
        safeUser.totp_enabled = !!totpSecret;
        return sendSuccess(response, { user: safeUser });
    } catch (error) {
        return sendError(response, 'Server error', 500);
    }
}
