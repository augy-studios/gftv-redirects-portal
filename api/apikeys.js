// API key management — get or regenerate the user's API key
import crypto from 'crypto';
import supabase from '../lib/supabase.js';
import { getSessionUser } from '../lib/auth.js';
import { ok, err, optionsResponse } from '../lib/response.js';

function generateApiKey() {
    return 'gftv_' + crypto.randomBytes(32).toString('hex');
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);
    if (!user.is_editor && !user.is_admin) return err(res, 'Forbidden: Only Editors and Admins can use the API', 403);

    // GET - retrieve current API key (masked, or full if just generated)
    if (req.method === 'GET') {
        const { data: row } = await supabase
            .from('gftvlinks_api_keys')
            .select('api_key, created_at, updated_at')
            .eq('user_id', user.id)
            .single();

        if (!row) return ok(res, { api_key: null });
        return ok(res, { api_key: row.api_key, created_at: row.created_at, updated_at: row.updated_at });
    }

    // POST - generate or regenerate API key
    if (req.method === 'POST') {
        const newKey = generateApiKey();
        const now = new Date().toISOString();

        const { error } = await supabase
            .from('gftvlinks_api_keys')
            .upsert(
                { user_id: user.id, api_key: newKey, updated_at: now },
                { onConflict: 'user_id' }
            );

        if (error) return err(res, 'Failed to generate API key', 500);
        return ok(res, { api_key: newKey }, 201);
    }

    return err(res, 'Method not allowed', 405);
}
