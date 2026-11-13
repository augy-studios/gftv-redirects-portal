// POST /api/auth/totp-disable: turns 2FA off once the password checks out, and removes the user's
// trusted devices and backup codes.
// Who can call it: any signed-in user (session token).
import supabase from '../../lib/supabase.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';
import { getSessionUser } from '../../lib/auth.js';
import bcrypt from 'bcryptjs';

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
            .select('password_hash')
            .eq('id', user.id)
            .single();

        const valid = await bcrypt.compare(password, fullUser.password_hash);
        if (!valid) return sendError(response, 'Incorrect password', 401);

        await supabase.from('gftvhello_users').update({ totp_secret: null }).eq('id', user.id);
        await supabase.from('gftvhello_trusted_devices').delete().eq('user_id', user.id);
        await supabase.from('gftvhello_backup_codes').delete().eq('user_id', user.id);

        return sendSuccess(response, { message: '2FA disabled successfully' });
    } catch (error) {
        console.error(error);
        return sendError(response, 'Server error', 500);
    }
}
