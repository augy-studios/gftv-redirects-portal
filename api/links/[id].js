// /api/links/:id: one link, by its id.
//   PUT     changes its slug, destination, is_active or tags, or hands it to another user
//           (new_owner_username: only the owner or an Admin can do that).
//   DELETE  deletes it.
// Who can call it: the link's owner if they're an Editor, or any Admin (session token).
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);

    const linkId = new URL(request.url, 'http://localhost').pathname.split('/').pop();

    // Fetch the link
    const { data: link } = await supabase
        .from('gftvlinks_links')
        .select('*')
        .eq('id', linkId)
        .single();

    if (!link) return sendError(response, 'Link not found', 404);

    // Editors can change their own links; Admins can change any link.
    const canEdit = (link.user_id === user.id && (user.is_editor || user.is_admin)) || user.is_admin;

    // PUT - edit link
    if (request.method === 'PUT') {
        if (!canEdit) return sendError(response, 'Forbidden', 403);

        try {
            const {
                slug,
                destination,
                is_active: isActive,
                tags,
                new_owner_username: newOwnerUsername,
            } = await parseBody(request);
            const updates = { updated_at: new Date().toISOString() };

            if (slug !== undefined) {
                if (!/^[a-zA-Z0-9_-]{1,60}$/.test(slug)) return sendError(response, 'Invalid slug');
                updates.slug = slug;
            }
            if (destination !== undefined) {
                // The destination must be a valid URL, and not on gftv.asia except the allowed subdomains.
                try { new URL(destination); } catch { return sendError(response, 'Invalid URL'); }
                const destinationHostname = new URL(destination).hostname;
                const allowedGftvSubdomains = ['guide.gftv.asia', 'form.gftv.asia'];
                if (destinationHostname.endsWith('gftv.asia') && !allowedGftvSubdomains.includes(destinationHostname)) return sendError(response, 'Destination cannot point to gftv.asia');
                updates.destination = destination;
            }
            if (isActive !== undefined) updates.is_active = isActive;
            if (tags !== undefined) {
                if (tags.length > 5) return sendError(response, 'Maximum 5 tags allowed');
                updates.tags = tags;
            }
            // Hand the link to another user, found by username.
            if (newOwnerUsername !== undefined && newOwnerUsername !== '') {
                const canTransfer = link.user_id === user.id || user.is_admin;
                if (!canTransfer) return sendError(response, 'Only the link owner or an admin can transfer ownership', 403);
                const trimmedUsername = newOwnerUsername.trim().toLowerCase();
                const { data: newOwner } = await supabase
                    .from('gftvhello_users')
                    .select('id')
                    .eq('username', trimmedUsername)
                    .single();
                if (!newOwner) return sendError(response, 'User not found');
                updates.user_id = newOwner.id;
            }

            const { data: updatedRows, error } = await supabase
                .from('gftvlinks_links')
                .update(updates)
                .eq('id', linkId)
                .select('id');

            if (error) {
                console.error('Link update error:', JSON.stringify(error));
                if (error.code === '23505') return sendError(response, 'Slug already taken');
                return sendError(response, 'Failed to update link');
            }

            if (!updatedRows || updatedRows.length === 0) {
                console.error('Link update matched 0 rows for id:', linkId);
                return sendError(response, 'Failed to update link');
            }

            return sendSuccess(response, { message: 'Link updated' });
        } catch (error) {
            return sendError(response, 'Server error', 500);
        }
    }

    // DELETE - remove link
    if (request.method === 'DELETE') {
        if (!canEdit) return sendError(response, 'Forbidden', 403);

        await supabase.from('gftvlinks_links').delete().eq('id', linkId);
        return sendSuccess(response, { message: 'Link deleted' });
    }

    return sendError(response, 'Method not allowed', 405);
}
