import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Session lifetimes: "stay logged in" keeps the session for 30 days,
// otherwise it only lasts for the current browsing session (12h server-side cap).
const REMEMBER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const SHORT_SESSION_MS = 12 * 60 * 60 * 1000;

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    try {
        const { username, password, device_token, remember } = await parseBody(req);
        if (!username || !password) return err(res, 'Username and password required');

        const sessionMs = remember ? REMEMBER_SESSION_MS : SHORT_SESSION_MS;

        const { data: user } = await supabase
            .from('gftvhello_users')
            .select('*')
            .or(`username.eq.${username.toLowerCase()},email.eq.${username.toLowerCase()}`)
            .single();

        if (!user) return err(res, 'Invalid credentials', 401);

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return err(res, 'Invalid credentials', 401);

        if (!user.is_approved) return err(res, 'PENDING_APPROVAL', 403);

        // If TOTP 2FA is enabled, handle challenge or device trust
        if (user.totp_secret) {
            // Check if the current device is already trusted
            if (device_token) {
                const { data: trusted } = await supabase
                    .from('gftvhello_trusted_devices')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('device_token', device_token)
                    .gt('expires_at', new Date().toISOString())
                    .single();

                if (trusted) {
                    // Trusted device — skip 2FA, create session directly
                    const token = crypto.randomBytes(48).toString('hex');
                    const expires_at = new Date(Date.now() + sessionMs).toISOString();
                    await supabase.from('gftvhello_sessions').insert({ user_id: user.id, token, expires_at });

                    const { password_hash, totp_secret, ...safeUser } = user;
                    safeUser.totp_enabled = true;
                    return ok(res, { token, user: safeUser, remember: !!remember });
                }
            }

            // Device not trusted — issue a short-lived challenge token
            const challenge_token = crypto.randomBytes(32).toString('hex');
            const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
            await supabase.from('gftvhello_totp_challenges').insert({
                token: challenge_token,
                user_id: user.id,
                expires_at,
            });

            return ok(res, { requires_2fa: true, challenge_token, username: user.username });
        }

        // No 2FA — create session normally
        const token = crypto.randomBytes(48).toString('hex');
        const expires_at = new Date(Date.now() + sessionMs).toISOString();
        await supabase.from('gftvhello_sessions').insert({ user_id: user.id, token, expires_at });

        const { password_hash, totp_secret, ...safeUser } = user;
        safeUser.totp_enabled = false;
        return ok(res, { token, user: safeUser, remember: !!remember });
    } catch (e) {
        console.error(e);
        return err(res, 'Server error', 500);
    }
}
