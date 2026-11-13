// /:slug (vercel.json rewrites it to /api/redirect/[slug]): the short link itself. Sends the
// visitor to the link's destination with a 302 and records the visit with their device type.
// An unknown or inactive slug, or any error, goes to the fallback site instead.
// Who can call it: anyone. Runs on the Edge runtime, kept there for low-latency redirects.
export const config = { runtime: 'edge' };
import supabase from '../../lib/supabase.js';

const FALLBACK_URL = 'https://globalfurrytv.news.blog';

// Sorts a visitor's User-Agent into 'Tablet', 'Mobile', 'Desktop' or 'Others'.
function detectDeviceType(userAgent) {
    if (!userAgent) return 'Others';
    // Check tablet before mobile: many Android tablets include "android" but not "mobile"
    if (/tablet|ipad|playbook|silk|(android(?!.*mobile))/i.test(userAgent)) return 'Tablet';
    if (/mobile|iphone|ipod|android.*mobile|blackberry|windows phone|iemobile/i.test(userAgent)) return 'Mobile';
    if (/windows|macintosh|linux|cros/i.test(userAgent)) return 'Desktop';
    return 'Others';
}

export default async function handler(request) {
    const url = new URL(request.url);
    const slug = url.pathname.split('/').pop();

    if (!slug) return Response.redirect(FALLBACK_URL, 302);

    try {
        const { data: link } = await supabase
            .from('gftvlinks_links')
            .select('id, destination, is_active')
            .eq('slug', slug)
            .single();

        if (!link || !link.is_active) {
            return Response.redirect(FALLBACK_URL, 302);
        }

        const userAgent = request.headers.get('user-agent') || '';
        const deviceType = detectDeviceType(userAgent);

        // Record visit with device type in gftvlinks_linkvisits and sync access_count
        await supabase.rpc('record_link_visit', {
            p_link_id: link.id,
            p_slug: slug,
            p_device_type: deviceType,
        });

        return Response.redirect(link.destination, 302);
    } catch (error) {
        return Response.redirect(FALLBACK_URL, 302);
    }
}
