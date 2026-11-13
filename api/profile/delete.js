// DELETE /api/profile/delete: deletes the signed-in user's own account once their password checks
// out.
// Who can call it: any signed-in user except Admins (session token). Admins get 403.
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';
import bcrypt from 'bcryptjs';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'DELETE') return sendError(response, 'Method not allowed', 405);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);
    if (user.is_admin) return sendError(response, 'Admin account cannot be deleted via this endpoint', 403);

    try {
        const { password } = await parseBody(request);
        if (!password) return sendError(response, 'Password required');

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return sendError(response, 'Incorrect password');

        await supabase.from('gftvhello_users').delete().eq('id', user.id);

        return sendSuccess(response, { message: 'Account deleted' });
    } catch (error) {
        return sendError(response, 'Server error', 500);
    }
}
