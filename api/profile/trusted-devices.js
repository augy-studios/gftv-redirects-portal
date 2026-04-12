// List and remove trusted 2FA devices for the current user
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);

    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('gftvlinks_trusted_devices')
            .select('id, created_at, expires_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) return err(res, 'Server error', 500);
        return ok(res, { devices: data });
    }

    if (req.method === 'DELETE') {
        const id = req.query?.id;
        if (!id) return err(res, 'Device ID required', 400);

        const { error } = await supabase
            .from('gftvlinks_trusted_devices')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) return err(res, 'Server error', 500);
        return ok(res, { message: 'Device removed' });
    }

    return err(res, 'Method not allowed', 405);
}
