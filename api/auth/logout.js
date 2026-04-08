export const config = { runtime: 'edge' };

import supabase from '../../lib/supabase.js';
import { ok, err, optionsResponse } from '../../lib/response.js';

export default async function handler(req) {
    if (req.method === 'OPTIONS') return optionsResponse();
    if (req.method !== 'POST') return err('Method not allowed', 405);

    const auth = req.headers.get('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (token) await supabase.from('gftvlinks_sessions').delete().eq('token', token);

    return ok({ message: 'Logged out' });
}