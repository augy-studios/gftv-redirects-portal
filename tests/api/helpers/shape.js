// Reply shape helpers for the API handler tests. Run the tests with `npm test`.
//
// shape(value) turns a JSON value into its key/type outline:
//   objects -> { key: shape } (every key), arrays -> [ shape, ... ] (one entry per distinct
//   element shape; [] when empty), null -> 'null', anything else -> typeof.
// So { success: true, links: [{ id: 'a' }, { id: 'b' }] } -> { success: 'boolean', links: [{ id: 'string' }] }.

import assert from 'node:assert/strict';

export function shape(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) {
        const distinctShapes = new Map();
        for (const item of value) {
            const itemShape = shape(item);
            const shapeKey = JSON.stringify(itemShape);
            if (!distinctShapes.has(shapeKey)) distinctShapes.set(shapeKey, itemShape);
        }
        return [...distinctShapes.values()];
    }
    if (typeof value === 'object') {
        const outline = {};
        for (const key of Object.keys(value).sort()) outline[key] = shape(value[key]);
        return outline;
    }
    return typeof value;
}

// Assert the status code, the JSON content type, the exact sorted top-level keys and the full shape.
export function expectReply(reply, status, expectedShape) {
    assert.equal(reply.status, status, `status code (body: ${reply.body})`);
    assert.equal(reply.headers['content-type'], 'application/json', 'content type');
    assert.ok(reply.json && typeof reply.json === 'object', `JSON object body (got: ${reply.body})`);
    assert.deepStrictEqual(Object.keys(reply.json).sort(), Object.keys(expectedShape).sort(), 'top-level keys');
    assert.deepStrictEqual(shape(reply.json), expectedShape, 'reply shape');
}

// Shape of every error reply from lib/response.js err().
export const ERROR_SHAPE = { success: 'boolean', error: 'string' };
// Shape of the many replies that are just ok(res, { message }).
export const MESSAGE_SHAPE = { success: 'boolean', message: 'string' };
