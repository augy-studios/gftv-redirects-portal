// Edit, delete, toggle a specific link
import supabase from '../../lib/supabase.js';
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

    const user = await getSessionUser(req);
    if (!user) return err('Unauthorized', 401);

    const url = new URL(req.url);
    const id = url.pathname.split('/').pop();
    

    // Fetch the link
    const {
        data: link
    } = await supabase
        .from('gftvlinks_links')
        .select('*')
        .eq('id', id)
        .single();

    if (!link) return err('Link not found', 404);

    // Only owner or admin can modify
    const canEdit = link.user_id === user.id || user.is_admin;

    // PUT - edit link
    if (req.method === 'PUT') {
        if (!canEdit) return err('Forbidden', 403);

        try {
            const {
                slug,
                destination,
                is_active,
                tags
            } = await req.json();
            const updates = {
                updated_at: new Date().toISOString()
            };

            if (slug !== undefined) {
                if (!/^[a-zA-Z0-9_-]{1,60}$/.test(slug)) return err('Invalid slug');
                updates.slug = slug;
            }
            if (destination !== undefined) {
                try {
                    new URL(destination);
                } catch {
                    return err('Invalid URL');
                }
                updates.destination = destination;
            }
            if (is_active !== undefined) updates.is_active = is_active;
            if (tags !== undefined) {
                if (tags.length > 5) return err('Maximum 5 tags allowed');
                updates.tags = tags;
            }

            const {
                error
            } = await supabase
                .from('gftvlinks_links')
                .update(updates)
                .eq('id', id);

            if (error) {
                if (error.code === '23505') return err('Slug already taken');
                return err('Failed to update link');
            }

            return ok({
                message: 'Link updated'
            });
        } catch (e) {
            return err('Server error', 500);
        }
    }

    // DELETE - remove link
    if (req.method === 'DELETE') {
        if (!canEdit) return err('Forbidden', 403);

        await supabase.from('gftvlinks_links').delete().eq('id', id);
        return ok({
            message: 'Link deleted'
        });
    }

    return err('Method not allowed', 405);
}