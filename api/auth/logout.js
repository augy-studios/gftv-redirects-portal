import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    const auth = req.headers['authorization'] || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (token) await supabase.from('gftvlinks_sessions').delete().eq('token', token);

    return ok(res, { message: 'Logged out' });
}