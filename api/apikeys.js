// /api/apikeys: the signed-in user's key for the public v1 API.
//   GET   returns the key in full, with when it was made and last changed ({ api_key: null } if
//         there's none yet).
//   POST  makes a new key, replacing any old one, and returns it (201).
// Who can call it: Editors and Admins (session token). Viewers get 403.
import crypto from 'crypto';
import supabase from '../lib/supabase.js';
import { getSessionUser } from '../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse } from '../lib/response.js';

// A new random API key: "gftv_" followed by 64 hex characters.
function generateApiKey() {
    return 'gftv_' + crypto.randomBytes(32).toString('hex');
}

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);
    if (!user.is_editor && !user.is_admin) return sendError(response, 'Forbidden: Only Editors and Admins can use the API', 403);

    // GET - retrieve the current API key, in full
    if (request.method === 'GET') {
        const { data: apiKeyRow } = await supabase
            .from('gftvlinks_api_keys')
            .select('api_key, created_at, updated_at')
            .eq('user_id', user.id)
            .single();

        if (!apiKeyRow) return sendSuccess(response, { api_key: null });
        return sendSuccess(response, { api_key: apiKeyRow.api_key, created_at: apiKeyRow.created_at, updated_at: apiKeyRow.updated_at });
    }

    // POST - generate or regenerate API key
    if (request.method === 'POST') {
        const newApiKey = generateApiKey();
        const now = new Date().toISOString();

        const { error } = await supabase
            .from('gftvlinks_api_keys')
            .upsert(
                { user_id: user.id, api_key: newApiKey, updated_at: now },
                { onConflict: 'user_id' }
            );

        if (error) return sendError(response, 'Failed to generate API key', 500);
        return sendSuccess(response, { api_key: newApiKey }, 201);
    }

    return sendError(response, 'Method not allowed', 405);
}
