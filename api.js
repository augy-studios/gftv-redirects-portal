const BASE = '/api';

function getToken() {
    return localStorage.getItem('gftv_token') || '';
}

async function req(method, path, body = null) {
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
        },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    const data = await res.json();
    return {
        ok: res.ok,
        status: res.status,
        data
    };
}

// Auth
export const Auth = {
    register: (body) => req('POST', '/auth/register', body),
    login: (body) => req('POST', '/auth/login', body),
    logout: () => req('POST', '/auth/logout'),
    me: () => req('GET', '/auth/me'),
};

// Links
export const Links = {
    list: (q = '', type = 'keyword') => req('GET', `/links?q=${encodeURIComponent(q)}&type=${type}`),
    mine: () => req('GET', '/links/mine'),
    create: (body) => req('POST', '/links', body),
    update: (id, body) => req('PUT', `/links/${id}`, body),
    delete: (id) => req('DELETE', `/links/${id}`),
};

// Ownership
export const Ownership = {
    list: () => req('GET', '/ownership'),
    request: (link_id) => req('POST', '/ownership', {
        link_id
    }),
    respond: (id, action) => req('PUT', `/ownership/${id}`, {
        action
    }),
};

// Admin
export const Admin = {
    users: () => req('GET', '/admin/users'),
    updateUser: (user_id, action) => req('PUT', '/admin/users', {
        user_id,
        action
    }),
    deleteUser: (user_id) => req('DELETE', `/admin/users?user_id=${user_id}`),
};

// Profile
export const Profile = {
    update: (body) => req('PUT', '/profile/update', body),
    delete: (password) => req('DELETE', '/profile/delete', {
        password
    }),
    avatar: (image_base64) => req('POST', '/profile/avatar', {
        image_base64
    }),
};