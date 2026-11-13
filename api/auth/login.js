// POST /api/auth/login: signs in with { username, password }, where username may also be an email.
//   - 2FA off: creates a session and returns its token and the user.
//   - 2FA on, with a device_token from a trusted device: the same, without asking for a code.
//   - 2FA on, otherwise: returns requires_2fa and a 10-minute challenge_token for
//     /api/auth/totp-verify.
// "remember" picks a 30-day session over a 12-hour one.
// Who can call it: anyone. An account not yet approved gets 403 PENDING_APPROVAL.
import supabase from '../../lib/supabase.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Session lifetimes: "stay logged in" keeps the session for 30 days,
// otherwise it only lasts for the current browsing session (12h server-side cap).
const REMEMBER_SESSION_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
const SHORT_SESSION_MILLISECONDS = 12 * 60 * 60 * 1000;

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'POST') return sendError(response, 'Method not allowed', 405);

    try {
        const { username, password, device_token: deviceToken, remember } = await parseBody(request);
        if (!username || !password) return sendError(response, 'Username and password required');
        if (/\s/.test(username)) return sendError(response, 'Username or email cannot contain spaces');

        let sessionLengthMilliseconds;
        if (remember) {
            sessionLengthMilliseconds = REMEMBER_SESSION_MILLISECONDS;
        } else {
            sessionLengthMilliseconds = SHORT_SESSION_MILLISECONDS;
        }

        const { data: user } = await supabase
            .from('gftvhello_users')
            .select('*')
            .or(`username.eq.${username.toLowerCase()},email.eq.${username.toLowerCase()}`)
            .single();

        if (!user) return sendError(response, 'Invalid credentials', 401);

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return sendError(response, 'Invalid credentials', 401);

        if (!user.is_approved) return sendError(response, 'PENDING_APPROVAL', 403);

        // If TOTP 2FA is enabled, handle challenge or device trust
        if (user.totp_secret) {
            // Check if the current device is already trusted
            if (deviceToken) {
                const { data: trustedDevice } = await supabase
                    .from('gftvhello_trusted_devices')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('device_token', deviceToken)
                    .gt('expires_at', new Date().toISOString())
                    .single();

                if (trustedDevice) {
                    // Trusted device: skip 2FA, create session directly
                    const token = crypto.randomBytes(48).toString('hex');
                    const expiresAt = new Date(Date.now() + sessionLengthMilliseconds).toISOString();
                    await supabase.from('gftvhello_sessions').insert({ user_id: user.id, token, expires_at: expiresAt });

                    // Leave the password hash and the TOTP secret out of the reply.
                    const { password_hash: passwordHash, totp_secret: totpSecret, ...safeUser } = user;
                    safeUser.totp_enabled = true;
                    return sendSuccess(response, { token, user: safeUser, remember: !!remember });
                }
            }

            // Device not trusted: issue a short-lived challenge token
            const challengeToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
            await supabase.from('gftvhello_totp_challenges').insert({
                token: challengeToken,
                user_id: user.id,
                expires_at: expiresAt,
            });

            return sendSuccess(response, { requires_2fa: true, challenge_token: challengeToken, username: user.username });
        }

        // No 2FA: create session normally
        const token = crypto.randomBytes(48).toString('hex');
        const expiresAt = new Date(Date.now() + sessionLengthMilliseconds).toISOString();
        await supabase.from('gftvhello_sessions').insert({ user_id: user.id, token, expires_at: expiresAt });

        // Leave the password hash and the TOTP secret out of the reply.
        const { password_hash: passwordHash, totp_secret: totpSecret, ...safeUser } = user;
        safeUser.totp_enabled = false;
        return sendSuccess(response, { token, user: safeUser, remember: !!remember });
    } catch (error) {
        console.error(error);
        return sendError(response, 'Server error', 500);
    }
}
