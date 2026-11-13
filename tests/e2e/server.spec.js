// tests/serve.js: files first, cleanUrls, then the vercel.json rewrites.
// No browser needed: these only look at what the server answers.
import { test, expect } from '@playwright/test';

test('tests/serve.js serves files and applies the vercel.json rewrites', async ({ request }) => {
    const home = await request.get('/');
    expect(home.status()).toBe(200);
    expect(await home.text()).toContain('id="page-home"');

    const stylesheet = await request.get('/style.css');
    expect(stylesheet.headers()['content-type']).toContain('text/css');

    // The catch-all rewrite sends any non-API path with more than one segment to the app.
    const deepPath = await request.get('/some/deep/path');
    expect(deepPath.status()).toBe(200);
    expect(await deepPath.text()).toContain('id="page-home"');

    // A single segment is a short link: Vercel runs the redirect function.
    const shortLink = await request.get('/discord', { maxRedirects: 0 });
    expect(shortLink.headers()['x-serve-rewrite']).toBe('/api/redirect/[slug]');

    const linkById = await request.get('/api/links/abc');
    expect(linkById.headers()['x-serve-rewrite']).toBe('/api/links/[id]');
    const linksIndex = await request.get('/api/links');
    expect(linksIndex.headers()['x-serve-rewrite']).toBe('/api/links/index');
    const publicApi = await request.get('/api/v1/links/discord');
    expect(publicApi.headers()['x-serve-rewrite']).toBe('/api/v1/links/[slug]');

    // cleanUrls: /404 is 404.html, and /404.html redirects to /404.
    const notFoundPage = await request.get('/404');
    expect(await notFoundPage.text()).toContain('Page Not Found uwu');
    const notFoundHtml = await request.get('/404.html', { maxRedirects: 0 });
    expect(notFoundHtml.status()).toBe(308);
    expect(notFoundHtml.headers().location).toBe('/404');

    // Dotfiles are never served.
    const dotfile = await request.get('/.gitignore');
    expect(dotfile.status()).toBe(404);
});
