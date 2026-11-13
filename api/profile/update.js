// PUT /api/profile/update: changes the signed-in user's display name, social links, avatar URL or
// password. Only the fields sent are changed. A new password needs the current one, and must be
// strong enough.
// Who can call it: any signed-in user (session token).
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';
import bcrypt from 'bcryptjs';
import passwordEntropy from 'fast-password-entropy';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);
    if (request.method !== 'PUT') return sendError(response, 'Method not allowed', 405);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);

    try {
        const body = await parseBody(request);
        const {
            display_name: displayName,
            social_links: socialLinks,
            avatar_url: avatarUrl,
            new_password: newPassword,
            current_password: currentPassword,
        } = body;
        const updates = { updated_at: new Date().toISOString() };

        if (displayName !== undefined) {
            if (!displayName.trim()) return sendError(response, 'Display name cannot be empty');
            updates.display_name = displayName.trim();
        }

        if (socialLinks !== undefined) {
            updates.social_links = socialLinks;
        }

        if (avatarUrl !== undefined) {
            updates.avatar_url = avatarUrl;
        }

        if (newPassword !== undefined) {
            if (passwordEntropy(newPassword) < 36) return sendError(response, 'Password is too weak. Use a longer password with a mix of uppercase, lowercase, numbers, and symbols.');
            if (!currentPassword) return sendError(response, 'Current password required');

            const valid = await bcrypt.compare(currentPassword, user.password_hash);
            if (!valid) return sendError(response, 'Current password is incorrect');

            updates.password_hash = await bcrypt.hash(newPassword, 10);
        }

        const { error } = await supabase
            .from('gftvhello_users')
            .update(updates)
            .eq('id', user.id);

        if (error) return sendError(response, 'Failed to update profile');
        return sendSuccess(response, { message: 'Profile updated' });
    } catch (error) {
        console.error(error);
        return sendError(response, 'Server error', 500);
    }
}
