import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);

    const auth = req.headers['authorization'] || '';
    const currentToken = auth.replace(/^Bearer\s+/i, '').trim();

    let query = supabase.from('gftvlinks_sessions').delete().eq('user_id', user.id);
    if (currentToken) query = query.neq('token', currentToken);

    const { error } = await query;
    if (error) return err(res, 'Server error', 500);

    return ok(res, { message: 'All other sessions terminated' });
}
