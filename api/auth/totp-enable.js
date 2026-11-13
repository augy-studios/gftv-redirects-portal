// POST /api/auth/totp-enable: turns 2FA on. Takes { secret, code }: the secret from
// /api/auth/totp-setup and a code from the authenticator app. When the code checks out, saves the
// secret and returns 10 new backup codes in plain text (any old ones are removed).
// Who can call it: any signed-in user (session token).
import supabase from '../../lib/supabase.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';
import { getSessionUser } from '../../lib/auth.js';
import { authenticator } from 'otplib';
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

        const { secret, code } = await parseBody(request);
        if (!secret || !code) return sendError(response, 'Secret and code required');

        // Accept the current code, or the one just before or after it (a window of 1 step).
        let isValid = false;
        try {
            const totpWithWindow = authenticator.clone({ window: 1 });
            isValid = totpWithWindow.verify({ token: code, secret });
        } catch {
            return sendError(response, 'Invalid verification code', 400);
        }
        if (!isValid) return sendError(response, 'Invalid verification code', 400);

        const { error: updateError } = await supabase
            .from('gftvhello_users')
            .update({ totp_secret: secret })
            .eq('id', user.id);

        if (updateError) return sendError(response, 'Failed to enable 2FA', 500);

        // Generate 10 single-use backup codes
        const plainCodes = generateBackupCodes();
        const backupCodeRows = plainCodes.map(backupCode => ({ user_id: user.id, code_hash: hashBackupCode(backupCode) }));

        // Clear any old backup codes first (e.g. re-enabling after disable)
        await supabase.from('gftvhello_backup_codes').delete().eq('user_id', user.id);

        const { error: codesError } = await supabase.from('gftvhello_backup_codes').insert(backupCodeRows);
        if (codesError) return sendError(response, 'Failed to generate backup codes', 500);

        return sendSuccess(response, { message: '2FA enabled successfully', backup_codes: plainCodes });
    } catch (error) {
        console.error(error);
        return sendError(response, 'Server error', 500);
    }
}
