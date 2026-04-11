import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';
import { authenticator } from 'otplib';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    try {
        const { challenge_token, code, trust_device } = await parseBody(req);
        if (!challenge_token || !code) return err(res, 'Challenge token and code required');

        // Look up the challenge (join to user)
        const { data: challenge } = await supabase
            .from('gftvlinks_totp_challenges')
            .select('*, gftvlinks_users(*)')
            .eq('token', challenge_token)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (!challenge) return err(res, 'Invalid or expired challenge', 401);

        // Delete the challenge immediately — single use
        await supabase.from('gftvlinks_totp_challenges').delete().eq('token', challenge_token);

        const user = challenge.gftvlinks_users;
        if (!user?.totp_secret) return err(res, 'TOTP not configured for this account', 400);

        // Verify the TOTP code
        let isValid = false;
        try {
            isValid = authenticator.verify({ token: code, secret: user.totp_secret });
        } catch {
            return err(res, 'Invalid code', 400);
        }
        if (!isValid) return err(res, 'Invalid verification code', 401);

        // Create the real session
        const token = crypto.randomBytes(48).toString('hex');
        const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('gftvlinks_sessions').insert({ user_id: user.id, token, expires_at });

        const { password_hash, totp_secret, ...safeUser } = user;
        safeUser.totp_enabled = true;

        // Optionally trust this device for 30 days
        let device_token = null;
        if (trust_device) {
            device_token = crypto.randomBytes(32).toString('hex');
            const device_expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await supabase.from('gftvlinks_trusted_devices').insert({
                user_id: user.id,
                device_token,
                expires_at: device_expires,
            });
        }

        return ok(res, { token, user: safeUser, device_token });
    } catch (e) {
        console.error(e);
        return err(res, 'Server error', 500);
    }
}
