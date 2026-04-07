// Upload avatar (receives base64 webp from client)
import {
    getSupabase
} from '../../lib/supabase.js';
import {
    getSessionUser
} from '../../lib/auth.js';
import {
    ok,
    err,
    optionsResponse
} from '../../lib/response.js';

export default async function handler(req) {
    if (req.method === 'OPTIONS') return optionsResponse();
    if (req.method !== 'POST') return err('Method not allowed', 405);

    const user = await getSessionUser(req);
    if (!user) return err('Unauthorized', 401);

    try {
        const {
            image_base64
        } = await req.json();
        if (!image_base64) return err('No image provided');

        // Strip data URL prefix if present
        const base64Data = image_base64.replace(/^data:image\/webp;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        if (buffer.length > 2 * 1024 * 1024) return err('Image too large (max 2MB)');

        const supabase = getSupabase();
        const filename = `${user.id}.webp`;

        const {
            error: uploadError
        } = await supabase.storage
            .from('gftvlinks_avatars')
            .upload(filename, buffer, {
                contentType: 'image/webp',
                upsert: true,
            });

        if (uploadError) return err('Failed to upload avatar');

        const {
            data: {
                publicUrl
            }
        } = supabase.storage
            .from('gftvlinks_avatars')
            .getPublicUrl(filename);

        await supabase
            .from('gftvlinks_users')
            .update({
                avatar_url: publicUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        return ok({
            avatar_url: publicUrl
        });
    } catch (e) {
        console.error(e);
        return err('Server error', 500);
    }
}