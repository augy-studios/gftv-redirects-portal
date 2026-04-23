import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';
import { getSessionUser } from '../../lib/auth.js';
import bcrypt from 'bcryptjs';
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

        const { password } = await parseBody(req);
        if (!password) return err(res, 'Password required');

        const { data: fullUser } = await supabase
            .from('gftvhello_users')
            .select('password_hash, totp_secret')
            .eq('id', user.id)
            .single();

        if (!fullUser?.totp_secret) return err(res, '2FA is not enabled on this account', 400);

        const valid = await bcrypt.compare(password, fullUser.password_hash);
        if (!valid) return err(res, 'Incorrect password', 401);

        // Replace all backup codes with a fresh set
        const plainCodes = generateBackupCodes();
        const rows = plainCodes.map(c => ({ user_id: user.id, code_hash: hashCode(c) }));

        await supabase.from('gftvhello_backup_codes').delete().eq('user_id', user.id);
        const { error: codesError } = await supabase.from('gftvhello_backup_codes').insert(rows);
        if (codesError) return err(res, 'Failed to regenerate backup codes', 500);

        return ok(res, { backup_codes: plainCodes });
    } catch (e) {
        console.error(e);
        return err(res, 'Server error', 500);
    }
}
