// Shared response helpers

export function ok(data = {}, status = 200) {
    return new Response(JSON.stringify({
        success: true,
        ...data
    }), {
        status,
        headers: corsHeaders({
            'Content-Type': 'application/json'
        }),
    });
}

export function err(message, status = 400) {
    return new Response(JSON.stringify({
        success: false,
        error: message
    }), {
        status,
        headers: corsHeaders({
            'Content-Type': 'application/json'
        }),
    });
}

export function corsHeaders(extra = {}) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        ...extra,
    };
}

export function optionsResponse() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders()
    });
}