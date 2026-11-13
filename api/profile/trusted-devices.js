// /api/profile/trusted-devices: the signed-in user's trusted 2FA devices.
//   GET                     lists them, newest first.
//   DELETE ?id=<device id>  removes one.
// Who can call it: any signed-in user, for their own devices only (session token).
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);

    try {
        const user = await getSessionUser(request);
        if (!user) return sendError(response, 'Unauthorized', 401);

        if (request.method === 'GET') {
            const { data: devices, error } = await supabase
                .from('gftvhello_trusted_devices')
                .select('id, created_at, expires_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('trusted-devices GET error:', error);
                return sendError(response, 'Server error', 500);
            }
            return sendSuccess(response, { devices });
        }

        if (request.method === 'DELETE') {
            const deviceId = request.query?.id;
            if (!deviceId) return sendError(response, 'Device ID required', 400);

            const { error } = await supabase
                .from('gftvhello_trusted_devices')
                .delete()
                .eq('id', deviceId)
                .eq('user_id', user.id);

            if (error) {
                console.error('trusted-devices DELETE error:', error);
                return sendError(response, 'Server error', 500);
            }
            return sendSuccess(response, { message: 'Device removed' });
        }

        return sendError(response, 'Method not allowed', 405);
    } catch (error) {
        console.error('trusted-devices handler error:', error);
        return sendError(response, 'Server error', 500);
    }
}
