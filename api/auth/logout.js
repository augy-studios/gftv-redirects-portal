import {
    getSupabase
} from '../../lib/supabase.js';
import {
    ok,
    err,
    optionsResponse
} from '../../lib/response.js';

export default async function handler(req) {
    if (req.method === 'OPTIONS') return optionsResponse();
    if (req.method !== 'POST') return err('Method not allowed', 405);

    try {
        const auth = req.headers.get('Authorization') || '';
        const token = auth.replace('Bearer ', '').trim();
        if (!token) return err('No token provided');

        const supabase = getSupabase();
        await supabase.from('gftvlinks_sessions').delete().eq('token', token);

        return ok({
            message: 'Logged out'
        });
    } catch (e) {
        return err('Server error', 500);
    }
}