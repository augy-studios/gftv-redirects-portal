import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';
import { authenticator } from 'otplib';
import crypto from 'crypto';

function hashCode(code) {
    return crypto.createHash('sha256').update(code.replace('-', '')).digest('hex');
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    try {
        const { challenge_token, code, backup_code, trust_device } = await parseBody(req);
        if (!challenge_token || (!code && !backup_code)) return err(res, 'Challenge token and a verification code required');

        // Look up the challenge (join to user)
        const { data: challenge } = await supabase
            .from('gftvhello_totp_challenges')
            .select('*, gftvhello_users(*)')
            .eq('token', challenge_token)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (!challenge) return err(res, 'Invalid or expired challenge', 401);

        // Delete the challenge immediately — single use
        await supabase.from('gftvhello_totp_challenges').delete().eq('token', challenge_token);

        const user = challenge.gftvhello_users;
        if (!user?.totp_secret) return err(res, 'TOTP not configured for this account', 400);

        if (backup_code) {
            // Verify a backup code instead of a TOTP code
            const normalized = backup_code.trim().toUpperCase().replace(/\s/g, '');
            const hash = hashCode(normalized);

            const { data: storedCode } = await supabase
                .from('gftvhello_backup_codes')
                .select('id')
                .eq('user_id', user.id)
                .eq('code_hash', hash)
                .single();

            if (!storedCode) return err(res, 'Invalid backup code', 401);

            // Consume the backup code — single use
            await supabase.from('gftvhello_backup_codes').delete().eq('id', storedCode.id);
        } else {
            // Verify the TOTP code — allow current and 1 previous cycle (±1 window)
            let isValid = false;
            try {
                const totpWithWindow = authenticator.clone({ window: 1 });
                isValid = totpWithWindow.verify({ token: code, secret: user.totp_secret });
            } catch {
                return err(res, 'Invalid code', 400);
            }
            if (!isValid) return err(res, 'Invalid verification code', 401);
        }

        // Create the real session
        const token = crypto.randomBytes(48).toString('hex');
        const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('gftvhello_sessions').insert({ user_id: user.id, token, expires_at });

        const { password_hash, totp_secret, ...safeUser } = user;
        safeUser.totp_enabled = true;

        // Optionally trust this device for 30 days
        let device_token = null;
        if (trust_device) {
            device_token = crypto.randomBytes(32).toString('hex');
            const device_expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await supabase.from('gftvhello_trusted_devices').insert({
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
