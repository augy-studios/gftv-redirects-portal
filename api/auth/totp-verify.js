// POST /api/auth/totp-verify: the second step of a 2FA sign-in. Takes the challenge_token from
// /api/auth/login and either a code from the authenticator app or a backup code (each backup code
// works once). On success, creates a session and returns its token and the user. With
// trust_device, also returns a device_token that skips 2FA on that device for 30 days.
// "remember" picks a 30-day session over a 12-hour one.
// Who can call it: anyone holding a valid, unexpired challenge token (each one works once).
import supabase from '../../lib/supabase.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';
import { authenticator } from 'otplib';
import crypto from 'crypto';

// The SHA-256 hash stored for a backup code, taken with its dash removed.
function hashBackupCode(code) {
    return crypto.createHash('sha256').update(code.replace('-', '')).digest('hex');
}

// Session lifetimes: "stay logged in" keeps the session for 30 days,
// otherwise it only lasts for the current browsing session (12h server-side cap).
const REMEMBER_SESSION_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
const SHORT_SESSION_MILLISECONDS = 12 * 60 * 60 * 1000;

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'POST') return sendError(response, 'Method not allowed', 405);

    try {
        const {
            challenge_token: challengeToken,
            code,
            backup_code: backupCode,
            trust_device: trustDevice,
            remember,
        } = await parseBody(request);
        if (!challengeToken || (!code && !backupCode)) return sendError(response, 'Challenge token and a verification code required');

        // Look up the challenge (join to user)
        const { data: challenge } = await supabase
            .from('gftvhello_totp_challenges')
            .select('*, gftvhello_users(*)')
            .eq('token', challengeToken)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (!challenge) return sendError(response, 'Invalid or expired challenge', 401);

        // Delete the challenge immediately: single use
        await supabase.from('gftvhello_totp_challenges').delete().eq('token', challengeToken);

        const user = challenge.gftvhello_users;
        if (!user?.totp_secret) return sendError(response, 'TOTP not configured for this account', 400);

        if (backupCode) {
            // Verify a backup code instead of a TOTP code
            const normalized = backupCode.trim().toUpperCase().replace(/\s/g, '');
            const hash = hashBackupCode(normalized);

            const { data: storedCode } = await supabase
                .from('gftvhello_backup_codes')
                .select('id')
                .eq('user_id', user.id)
                .eq('code_hash', hash)
                .single();

            if (!storedCode) return sendError(response, 'Invalid backup code', 401);

            // Consume the backup code: single use
            await supabase.from('gftvhello_backup_codes').delete().eq('id', storedCode.id);
        } else {
            // Verify the TOTP code: accept the current code, or the one just before or after it
            // (a window of 1 step)
            let isValid = false;
            try {
                const totpWithWindow = authenticator.clone({ window: 1 });
                isValid = totpWithWindow.verify({ token: code, secret: user.totp_secret });
            } catch {
                return sendError(response, 'Invalid code', 400);
            }
            if (!isValid) return sendError(response, 'Invalid verification code', 401);
        }

        // Create the real session
        let sessionLengthMilliseconds;
        if (remember) {
            sessionLengthMilliseconds = REMEMBER_SESSION_MILLISECONDS;
        } else {
            sessionLengthMilliseconds = SHORT_SESSION_MILLISECONDS;
        }
        const token = crypto.randomBytes(48).toString('hex');
        const expiresAt = new Date(Date.now() + sessionLengthMilliseconds).toISOString();
        await supabase.from('gftvhello_sessions').insert({ user_id: user.id, token, expires_at: expiresAt });

        // Leave the password hash and the TOTP secret out of the reply.
        const { password_hash: passwordHash, totp_secret: totpSecret, ...safeUser } = user;
        safeUser.totp_enabled = true;

        // Optionally trust this device for 30 days
        let deviceToken = null;
        if (trustDevice) {
            deviceToken = crypto.randomBytes(32).toString('hex');
            const deviceExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await supabase.from('gftvhello_trusted_devices').insert({
                user_id: user.id,
                device_token: deviceToken,
                expires_at: deviceExpiresAt,
            });
        }

        return sendSuccess(response, { token, user: safeUser, device_token: deviceToken, remember: !!remember });
    } catch (error) {
        console.error(error);
        return sendError(response, 'Server error', 500);
    }
}
