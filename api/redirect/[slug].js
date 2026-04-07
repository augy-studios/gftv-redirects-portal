// Redirect short link to destination
import supabase from '../../lib/supabase.js';

const FALLBACK = 'https://globalfurrytv.news.blog';

export default async function handler(req) {
    const url = new URL(req.url);
    const slug = url.pathname.split('/').pop();

    if (!slug) return Response.redirect(FALLBACK, 302);

    try {
        

        const {
            data: link
        } = await supabase
            .from('gftvlinks_links')
            .select('id, destination, is_active')
            .eq('slug', slug)
            .single();

        if (!link || !link.is_active) {
            return Response.redirect(FALLBACK, 302);
        }

        // Increment access count (fire and forget)
        supabase
            .from('gftvlinks_links')
            .update({
                access_count: link.access_count + 1
            }) // use rpc for atomic
            .eq('id', link.id)
            .then(() => {});

        // Use RPC for atomic increment instead
        supabase.rpc('increment_link_count', {
            link_id: link.id
        }).then(() => {});

        return Response.redirect(link.destination, 302);
    } catch (e) {
        return Response.redirect(FALLBACK, 302);
    }
}