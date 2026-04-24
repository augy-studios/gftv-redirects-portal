// Redirect short link to destination — kept on Edge for low-latency redirects
export const config = { runtime: 'edge' };
import supabase from '../../lib/supabase.js';

const FALLBACK = 'https://globalfurrytv.news.blog';

function detectDeviceType(ua) {
    if (!ua) return 'Others';
    // Check tablet before mobile — many Android tablets include "android" but not "mobile"
    if (/tablet|ipad|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'Tablet';
    if (/mobile|iphone|ipod|android.*mobile|blackberry|windows phone|iemobile/i.test(ua)) return 'Mobile';
    if (/windows|macintosh|linux|cros/i.test(ua)) return 'Desktop';
    return 'Others';
}

export default async function handler(req) {
    const url = new URL(req.url);
    const slug = url.searchParams.get('nc');

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

        const ua = req.headers.get('user-agent') || '';
        const deviceType = detectDeviceType(ua);

        // Record visit with device type in gftvlinks_linkvisits and sync access_count
        await supabase.rpc('record_link_visit', {
            p_link_id: link.id,
            p_slug: slug,
            p_device_type: deviceType,
        });

        return Response.redirect(link.destination, 302);
    } catch (e) {
        return Response.redirect(FALLBACK, 302);
    }
}