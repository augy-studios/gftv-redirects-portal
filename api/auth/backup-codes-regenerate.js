// POST /api/auth/backup-codes-regenerate: replaces the user's 2FA backup codes with 10 new ones once
// the password checks out. The new codes are returned this once in plain text; only their hashes
// are stored.
// Who can call it: any signed-in user who has 2FA on (session token).
import supabase from '../../lib/supabase.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';
import { getSessionUser } from '../../lib/auth.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Ten random backup codes in the form XXXXX-XXXXX (uppercase hex).
function generateBackupCodes() {
    const codes = [];
    for (let codeIndex = 0; codeIndex < 10; codeIndex++) {
        const randomHex = crypto.randomBytes(5).toString('hex').toUpperCase();
        codes.push(`${randomHex.slice(0, 5)}-${randomHex.slice(5)}`);
    }
    return codes;
}

// The SHA-256 hash stored for a backup code, taken with its dash removed.
function hashBackupCode(code) {
    return crypto.createHash('sha256').update(code.replace('-', '')).digest('hex');
}

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'POST') return sendError(response, 'Method not allowed', 405);

    try {
        const user = await getSessionUser(request);
        if (!user) return sendError(response, 'Unauthorized', 401);

        const { password } = await parseBody(request);
        if (!password) return sendError(response, 'Password required');

        const { data: fullUser } = await supabase
            .from('gftvhello_users')
            .select('password_hash, totp_secret')
            .eq('id', user.id)
            .single();

        if (!fullUser?.totp_secret) return sendError(response, '2FA is not enabled on this account', 400);

        const valid = await bcrypt.compare(password, fullUser.password_hash);
        if (!valid) return sendError(response, 'Incorrect password', 401);

        // Replace all backup codes with a fresh set
        const plainCodes = generateBackupCodes();
        const backupCodeRows = plainCodes.map(code => ({ user_id: user.id, code_hash: hashBackupCode(code) }));

        await supabase.from('gftvhello_backup_codes').delete().eq('user_id', user.id);
        const { error: codesError } = await supabase.from('gftvhello_backup_codes').insert(backupCodeRows);
        if (codesError) return sendError(response, 'Failed to regenerate backup codes', 500);

        return sendSuccess(response, { backup_codes: plainCodes });
    } catch (error) {
        console.error(error);
        return sendError(response, 'Server error', 500);
    }
}
