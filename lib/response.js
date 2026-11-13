// Shared reply helpers for the API handlers (Node.js runtime). Every JSON reply carries the CORS
// headers below and is either { success: true, ...data } or { success: false, error }.

// The CORS headers sent with every reply, so any site can call the API.
export function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    };
}

// Sends { success: true, ...data } as JSON, with status 200 unless another is given.
export function sendSuccess(response, data = {}, status = 200) {
    response.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders() });
    response.end(JSON.stringify({ success: true, ...data }));
}

// Sends { success: false, error: message } as JSON, with status 400 unless another is given.
export function sendError(response, message, status = 400) {
    response.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders() });
    response.end(JSON.stringify({ success: false, error: message }));
}

// Answers a CORS preflight (OPTIONS) request: 204 with the CORS headers and no body.
export function sendOptionsResponse(response) {
    response.writeHead(204, corsHeaders());
    response.end();
}

// Reads the request body from the stream and parses it as JSON. Rejects when the body isn't
// valid JSON (an empty body included) or the stream fails.
export function parseBody(request) {
    return new Promise((resolve, reject) => {
        let rawBody = '';
        request.on('data', chunk => rawBody += chunk);
        request.on('end', () => {
            try {
                resolve(JSON.parse(rawBody));
            } catch (error) {
                reject(error);
            }
        });
        request.on('error', reject);
    });
}
