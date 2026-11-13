// Fake Node request/response objects for calling the Vercel API handlers directly.
// Run the tests with `npm test`.
//
// The handlers use req.method, req.url, req.headers, req.query (trusted-devices only) and read
// the body as a stream through lib/response.js parseBody (req.on('data'|'end'|'error')).
// They reply with res.writeHead(status, headers) + res.end(json).

import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

export function makeRequest({ method = 'GET', url = '/', headers = {}, body, query = {} } = {}) {
    let chunks;
    if (body === undefined) {
        chunks = [];
    } else if (typeof body === 'string') {
        chunks = [body];
    } else {
        chunks = [JSON.stringify(body)];
    }
    const request = Readable.from(chunks, { objectMode: false });
    request.method = method;
    request.url = url;
    request.headers = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
    // Vercel fills req.query from the query string (and dynamic route params).
    request.query = { ...Object.fromEntries(new URL(url, 'http://localhost').searchParams), ...query };
    return request;
}

// A response object that records what the handler writes: the status and headers from
// writeHead() or setHeader(), and the body from end(), which may only be called once.
export function makeResponse() {
    return {
        statusCode: 200,
        headers: {},
        body: undefined,
        ended: false,
        writeHead(status, headers = {}) {
            this.statusCode = status;
            for (const [name, value] of Object.entries(headers)) this.headers[name.toLowerCase()] = value;
            return this;
        },
        setHeader(name, value) {
            this.headers[name.toLowerCase()] = value;
            return this;
        },
        getHeader(name) {
            return this.headers[name.toLowerCase()];
        },
        end(chunk) {
            assert.equal(this.ended, false, 'res.end() called twice');
            this.ended = true;
            if (chunk === undefined) {
                this.body = '';
            } else {
                this.body = String(chunk);
            }
            return this;
        },
    };
}

// Call a Node handler and return { status, headers, body, json }.
export async function callHandler(handler, requestOptions = {}) {
    const request = makeRequest(requestOptions);
    const response = makeResponse();
    await handler(request, response);
    assert.ok(response.ended, 'handler returned without ending the response');
    let json;
    if (response.body) json = JSON.parse(response.body);
    return { status: response.statusCode, headers: response.headers, body: response.body, json };
}
