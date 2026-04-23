// Edit, delete a specific link
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);

    const id = new URL(req.url, 'http://localhost').pathname.split('/').pop();

    // Fetch the link
    const { data: link } = await supabase
        .from('gftvlinks_links')
        .select('*')
        .eq('id', id)
        .single();

    if (!link) return err(res, 'Link not found', 404);

    const canEdit = (link.user_id === user.id && (user.is_editor || user.is_admin)) || user.is_admin;

    // PUT - edit link
    if (req.method === 'PUT') {
        if (!canEdit) return err(res, 'Forbidden', 403);

        try {
            const { slug, destination, is_active, tags, new_owner_username } = await parseBody(req);
            const updates = { updated_at: new Date().toISOString() };

            if (slug !== undefined) {
                if (!/^[a-zA-Z0-9_-]{1,60}$/.test(slug)) return err(res, 'Invalid slug');
                updates.slug = slug;
            }
            if (destination !== undefined) {
                try { new URL(destination); } catch { return err(res, 'Invalid URL'); }
                const destHostname = new URL(destination).hostname;
                const allowedGftvSubdomains = ['guide.gftv.asia', 'form.gftv.asia'];
                if (destHostname.endsWith('gftv.asia') && !allowedGftvSubdomains.includes(destHostname)) return err(res, 'Destination cannot point to gftv.asia');
                updates.destination = destination;
            }
            if (is_active !== undefined) updates.is_active = is_active;
            if (tags !== undefined) {
                if (tags.length > 5) return err(res, 'Maximum 5 tags allowed');
                updates.tags = tags;
            }
            if (new_owner_username !== undefined && new_owner_username !== '') {
                const canTransfer = link.user_id === user.id || user.is_admin;
                if (!canTransfer) return err(res, 'Only the link owner or an admin can transfer ownership', 403);
                const trimmedUsername = new_owner_username.trim().toLowerCase();
                const { data: newOwner } = await supabase
                    .from('gftvhello_users')
                    .select('id')
                    .eq('username', trimmedUsername)
                    .single();
                if (!newOwner) return err(res, 'User not found');
                updates.user_id = newOwner.id;
            }

            const { error } = await supabase
                .from('gftvlinks_links')
                .update(updates)
                .eq('id', id);

            if (error) {
                if (error.code === '23505') return err(res, 'Slug already taken');
                return err(res, 'Failed to update link');
            }

            return ok(res, { message: 'Link updated' });
        } catch (e) {
            return err(res, 'Server error', 500);
        }
    }

    // DELETE - remove link
    if (req.method === 'DELETE') {
        if (!canEdit) return err(res, 'Forbidden', 403);

        await supabase.from('gftvlinks_links').delete().eq('id', id);
        return ok(res, { message: 'Link deleted' });
    }

    return err(res, 'Method not allowed', 405);
}