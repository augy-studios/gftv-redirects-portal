// Redirect short link to destination — kept on Edge for low-latency redirects
export const config = { runtime: 'edge' };
import supabase from '../../lib/supabase.js';

const FALLBACK = 'https://globalfurrytv.news.blog';

export default async function handler(req) {
    const url = new URL(req.url);
    const slug = url.pathname.split('/').pop();

    if (!slug) return Response.redirect(FALLBACK, 302);

    try {
        const { data: link } = await supabase
            .from('gftvlinks_links')
            .select('id, destination, is_active')
            .eq('slug', slug)
            .single();

        if (!link || !link.is_active) {
            return Response.redirect(FALLBACK, 302);
        }

        // Record visit in gftvlinks_linkvisits and sync access_count in gftvlinks_links
        await supabase.rpc('record_link_visit', { p_link_id: link.id, p_slug: slug });

        return Response.redirect(link.destination, 302);
    } catch (e) {
        return Response.redirect(FALLBACK, 302);
    }
}