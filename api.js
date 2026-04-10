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
    try {
        const res = await fetch(BASE + path, opts);
        const data = await res.json();
        return {
            ok: res.ok,
            status: res.status,
            data
        };
    } catch (e) {
        console.error(`API request failed [${method} ${path}]:`, e);
        return {
            ok: false,
            status: 0,
            data: { error: 'Network error. Please try again.' }
        };
    }
}

// Auth
export const Auth = {
    register: (body) => req('POST', '/auth/register', body),
    login: (body) => req('POST', '/auth/login', body),
    logout: () => req('POST', '/auth/logout'),
    logoutAll: () => req('POST', '/auth/logout-all'),
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
    updateUser: (user_id, action) => req('PUT', '/admin/users', { user_id, action }),
    updateUserDetails: (user_id, details) => req('PUT', '/admin/users', { user_id, action: 'update_details', ...details }),
    resetPassword: (user_id) => req('PUT', '/admin/users', { user_id, action: 'reset_password' }),
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

// Profile Views
export const ProfileViews = {
    record: (viewed_id) => req('POST', '/profile/views', { viewed_id }),
    getViewers: (profile_id) => req('GET', `/profile/views?profile_id=${encodeURIComponent(profile_id)}`),
};

// Public Stats
export const Stats = {
    get: () => req('GET', '/stats'),
};