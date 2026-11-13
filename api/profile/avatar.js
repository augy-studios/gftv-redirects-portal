// POST /api/profile/avatar: sets the signed-in user's avatar. Takes { image_base64 }, a WebP image
// as base64 (up to 2 MB), stores it as <user id>.webp in the gftvhello_avatars bucket, saves its
// public URL on the user and returns it as avatar_url.
// Who can call it: any signed-in user (session token).
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'POST') return sendError(response, 'Method not allowed', 405);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);

    try {
        const { image_base64: imageBase64 } = await parseBody(request);
        if (!imageBase64) return sendError(response, 'No image provided');

        const base64Data = imageBase64.replace(/^data:image\/webp;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        if (buffer.length > 2 * 1024 * 1024) return sendError(response, 'Image too large (max 2MB)');

        const filename = `${user.id}.webp`;

        const { error: uploadError } = await supabase.storage
            .from('gftvhello_avatars')
            .upload(filename, buffer, {
                contentType: 'image/webp',
                upsert: true,
            });

        if (uploadError) return sendError(response, 'Failed to upload avatar');

        const { data: { publicUrl } } = supabase.storage
            .from('gftvhello_avatars')
            .getPublicUrl(filename);

        await supabase
            .from('gftvhello_users')
            .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
            .eq('id', user.id);

        return sendSuccess(response, { avatar_url: publicUrl });
    } catch (error) {
        console.error(error);
        return sendError(response, 'Server error', 500);
    }
}
