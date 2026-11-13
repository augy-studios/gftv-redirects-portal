// The one Supabase client every handler shares, built from SUPABASE_URL and SUPABASE_SERVICE_KEY.
// The service key isn't held back by row-level security, so each handler checks for itself who
// may read or change what.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

export default supabase;
