// Shared response helpers (Node.js runtime)

export function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    };
}

export function ok(res, data = {}, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders() });
    res.end(JSON.stringify({ success: true, ...data }));
}

export function err(res, message, status = 400) {
    res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders() });
    res.end(JSON.stringify({ success: false, error: message }));
}

export function optionsResponse(res) {
    res.writeHead(204, corsHeaders());
    res.end();
}

export function parseBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
        req.on('error', reject);
    });
}