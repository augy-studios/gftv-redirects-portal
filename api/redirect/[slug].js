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

        // Run Supabase increment and GoatCounter ping in parallel
        const gcUrl = new URL('https://augy.goatcounter.com/count');
        gcUrl.searchParams.set('p', `/${slug}`);
        gcUrl.searchParams.set('t', slug);
        gcUrl.searchParams.set('r', req.headers.get('referer') || '');

        await Promise.allSettled([
            supabase.rpc('increment_link_count', { link_id: link.id }),
            fetch(gcUrl.toString(), {
                headers: { 'User-Agent': req.headers.get('user-agent') || '' }
            })
        ]);

        return Response.redirect(link.destination, 302);
    } catch (e) {
        return Response.redirect(FALLBACK, 302);
    }
}