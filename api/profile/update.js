// Update profile (display name, password, social links)
import supabase from '../../lib/supabase.js';
import {
    getSessionUser
} from '../../lib/auth.js';
import {
    ok,
    err,
    optionsResponse
} from '../../lib/response.js';
import bcrypt from 'bcryptjs';

export default async function handler(req) {
    if (req.method === 'OPTIONS') return optionsResponse();
    if (req.method !== 'PUT') return err('Method not allowed', 405);

    const user = await getSessionUser(req);
    if (!user) return err('Unauthorized', 401);

    

    try {
        const body = await req.json();
        const updates = {
            updated_at: new Date().toISOString()
        };

        if (body.display_name !== undefined) {
            if (!body.display_name.trim()) return err('Display name cannot be empty');
            updates.display_name = body.display_name.trim();
        }

        if (body.social_links !== undefined) {
            updates.social_links = body.social_links;
        }

        if (body.avatar_url !== undefined) {
            updates.avatar_url = body.avatar_url;
        }

        if (body.new_password !== undefined) {
            if (body.new_password.length < 8) return err('Password must be at least 8 characters');
            if (!body.current_password) return err('Current password required');

            const valid = await bcrypt.compare(body.current_password, user.password_hash);
            if (!valid) return err('Current password is incorrect');

            updates.password_hash = await bcrypt.hash(body.new_password, 10);
        }

        const {
            error
        } = await supabase
            .from('gftvlinks_users')
            .update(updates)
            .eq('id', user.id);

        if (error) return err('Failed to update profile');
        return ok({
            message: 'Profile updated'
        });
    } catch (e) {
        console.error(e);
        return err('Server error', 500);
    }
}