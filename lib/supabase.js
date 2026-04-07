// Supabase client for serverless functions
import {
    createClient
} from '@supabase/supabase-js';

let _client = null;

export function getSupabase() {
    if (!_client) {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
        }
        _client = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
    }
    return _client;
}