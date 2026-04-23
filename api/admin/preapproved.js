// Admin: manage pre-approved users
import supabase from '../../lib/supabase.js';
import { getSessionUser } from '../../lib/auth.js';
import { ok, err, optionsResponse, parseBody } from '../../lib/response.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return optionsResponse(res);

    const user = await getSessionUser(req);
    if (!user) return err(res, 'Unauthorized', 401);
    if (!user.is_admin) return err(res, 'Forbidden', 403);

    // GET - list all pre-approved users
    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('gftvhello_users_preapproved')
            .select('id, email, preapproved_role, user_id, preapproved_at, activated_at')
            .order('preapproved_at', { ascending: false });

        if (error) return err(res, 'Failed to fetch pre-approved users');
        return ok(res, { preapproved: data || [] });
    }

    // POST - add a pre-approved user
    if (req.method === 'POST') {
        const { email, role } = await parseBody(req);

        if (!email || !role) return err(res, 'Email and role are required');
        if (!['viewer', 'editor'].includes(role)) return err(res, 'Role must be viewer or editor');

        const trimmedEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
            return err(res, 'Invalid email address');

        // Check if already pre-approved
        const { data: existing } = await supabase
            .from('gftvhello_users_preapproved')
            .select('id')
            .eq('email', trimmedEmail)
            .maybeSingle();

        if (existing) return err(res, 'This email is already pre-approved');

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

        if (error) return err(res, 'Failed to add pre-approved user');
        return ok(res, { message: 'User pre-approved successfully' }, 201);
    }

    // DELETE - remove a pre-approved user
    if (req.method === 'DELETE') {
        const id = new URL(req.url, 'http://localhost').searchParams.get('id');
        if (!id) return err(res, 'id required');

        const { error } = await supabase
            .from('gftvhello_users_preapproved')
            .delete()
            .eq('id', id);

        if (error) return err(res, 'Failed to remove pre-approval');
        return ok(res, { message: 'Pre-approval removed' });
    }

    return err(res, 'Method not allowed', 405);
}
