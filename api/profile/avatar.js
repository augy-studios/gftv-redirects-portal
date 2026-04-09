// Upload avatar (receives base64 webp from client)
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);
    if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);

    try {
        const { image_base64 } = await parseBody(req);
        if (!image_base64) return err(res, 'No image provided');

        const base64Data = image_base64.replace(/^data:image\/webp;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        if (buffer.length > 2 * 1024 * 1024) return err(res, 'Image too large (max 2MB)');

        const filename = `${user.id}.webp`;

        const { error: uploadError } = await supabase.storage
            .from('gftvlinks_avatars')
            .upload(filename, buffer, {
                contentType: 'image/webp',
                upsert: true,
            });

        if (uploadError) return err(res, 'Failed to upload avatar');

        const { data: { publicUrl } } = supabase.storage
            .from('gftvlinks_avatars')
            .getPublicUrl(filename);

        await supabase
            .from('gftvlinks_users')
            .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
            .eq('id', user.id);

        return ok(res, { avatar_url: publicUrl });
    } catch (e) {
        console.error(e);
        return err(res, 'Server error', 500);
    }
}