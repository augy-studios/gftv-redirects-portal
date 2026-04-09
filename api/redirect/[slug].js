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

        // Atomic increment via RPC
        supabase.rpc('increment_link_count', { link_id: link.id }).then(() => {});

        return Response.redirect(link.destination, 302);
    } catch (e) {
        return Response.redirect(FALLBACK, 302);
    }
}