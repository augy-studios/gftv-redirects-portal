import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';
import { getSessionUser } from '../../lib/auth.js';
import { authenticator } from 'otplib';
import crypto from 'crypto';

function generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
        const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
        codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
    return codes;
}

function hashCode(code) {
    return crypto.createHash('sha256').update(code.replace('-', '')).digest('hex');
}

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
            const totpWithWindow = authenticator.clone({ window: 1 });
            isValid = totpWithWindow.verify({ token: code, secret });
        } catch {
            return err(res, 'Invalid verification code', 400);
        }
        if (!isValid) return err(res, 'Invalid verification code', 400);

        const { error: updateError } = await supabase
            .from('gftvlinks_users')
            .update({ totp_secret: secret })
            .eq('id', user.id);

        if (updateError) return err(res, 'Failed to enable 2FA', 500);

        // Generate 10 single-use backup codes
        const plainCodes = generateBackupCodes();
        const rows = plainCodes.map(c => ({ user_id: user.id, code_hash: hashCode(c) }));

        // Clear any old backup codes first (e.g. re-enabling after disable)
        await supabase.from('gftvlinks_backup_codes').delete().eq('user_id', user.id);

        const { error: codesError } = await supabase.from('gftvlinks_backup_codes').insert(rows);
        if (codesError) return err(res, 'Failed to generate backup codes', 500);

        return ok(res, { message: '2FA enabled successfully', backup_codes: plainCodes });
    } catch (e) {
        console.error(e);
        return err(res, 'Server error', 500);
    }
}
