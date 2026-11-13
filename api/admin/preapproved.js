// /api/admin/preapproved: emails an Admin has approved before the person registers.
//   GET                    the list, newest first.
//   POST { email, role }   adds an email as a viewer or an editor (201). If that email already
//                          belongs to an approved account, it's linked to that account at once.
//   DELETE ?id=<id>        removes one.
// Who can call it: Admins only (session token).
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { sendSuccess, sendError, sendOptionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(request, response) {
    if (request.method === 'OPTIONS') return sendOptionsResponse(response);

    const user = await getSessionUser(request);
    if (!user) return sendError(response, 'Unauthorized', 401);
    if (!user.is_admin) return sendError(response, 'Forbidden', 403);

    // GET - list all pre-approved users
    if (request.method === 'GET') {
        const { data: preapprovedUsers, error } = await supabase
            .from('gftvhello_users_preapproved')
            .select('id, email, preapproved_role, user_id, preapproved_at, activated_at')
            .order('preapproved_at', { ascending: false });

        if (error) return sendError(response, 'Failed to fetch pre-approved users');
        return sendSuccess(response, { preapproved: preapprovedUsers || [] });
    }

    // POST - add a pre-approved user
    if (request.method === 'POST') {
        const { email, role } = await parseBody(request);

        if (!email || !role) return sendError(response, 'Email and role are required');
        if (!['viewer', 'editor'].includes(role)) return sendError(response, 'Role must be viewer or editor');

        const trimmedEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
            return sendError(response, 'Invalid email address');

        // Check if already pre-approved
        const { data: existing } = await supabase
            .from('gftvhello_users_preapproved')
            .select('id')
            .eq('email', trimmedEmail)
            .maybeSingle();

        if (existing) return sendError(response, 'This email is already pre-approved');

        // Check if this email already belongs to a registered and approved user
        const { data: existingUser } = await supabase
            .from('gftvhello_users')
            .select('id, is_approved')
            .eq('email', trimmedEmail)
            .maybeSingle();

        const insertData = {
            email: trimmedEmail,
            preapproved_role: role,
            preapproved_by: user.id,
        };

        // If the user is already registered and approved, link them immediately
        if (existingUser && existingUser.is_approved) {
            insertData.user_id = existingUser.id;
            insertData.activated_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('gftvhello_users_preapproved')
            .insert(insertData);

        if (error) return sendError(response, 'Failed to add pre-approved user');
        return sendSuccess(response, { message: 'User pre-approved successfully' }, 201);
    }

    // DELETE - remove a pre-approved user
    if (request.method === 'DELETE') {
        const preapprovalId = new URL(request.url, 'http://localhost').searchParams.get('id');
        if (!preapprovalId) return sendError(response, 'id required');

        const { error } = await supabase
            .from('gftvhello_users_preapproved')
            .delete()
            .eq('id', preapprovalId);

        if (error) return sendError(response, 'Failed to remove pre-approval');
        return sendSuccess(response, { message: 'Pre-approval removed' });
    }

    return sendError(response, 'Method not allowed', 405);
}
