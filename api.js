const BASE_URL = '/api';
const TOKEN_KEY = 'gftv_token';

// The session token lives in localStorage when the user chose to stay logged in
// for 30 days, and in sessionStorage otherwise (cleared when the tab/browser closes).
export function getToken() {
    try {
        return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
    } catch {
        return '';
    }
}

export function setToken(token, remember) {
    clearToken();
    try {
        let storage;
        if (remember) {
            storage = localStorage;
        } else {
            storage = sessionStorage;
        }
        storage.setItem(TOKEN_KEY, token);
    } catch { /* storage unavailable: session stays in memory only */ }
}

export function clearToken() {
    try {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
    } catch { /* ignore */ }
}

// Called `req` because tests/e2e/api-calls.spec.js finds the API calls by that name.
// Sends one request to the API with the session token attached. Always resolves
// with { ok, status, data }; a network failure gives status 0 and an error message.
async function req(method, path, body = null) {
    const requestOptions = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
        },
    };
    if (body) requestOptions.body = JSON.stringify(body);
    try {
        const response = await fetch(BASE_URL + path, requestOptions);
        const data = await response.json();
        return {
            ok: response.ok,
            status: response.status,
            data
        };
    } catch (error) {
        console.error(`API request failed [${method} ${path}]:`, error);
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

// TOTP 2FA
export const Totp = {
    setup: () => req('GET', '/auth/totp-setup'),
    enable: (secret, code) => req('POST', '/auth/totp-enable', { secret, code }),
    disable: (password) => req('POST', '/auth/totp-disable', { password }),
    verify: (challengeToken, code, trustDevice, remember) => req('POST', '/auth/totp-verify', { challenge_token: challengeToken, code, trust_device: trustDevice, remember }),
    verifyBackup: (challengeToken, backupCode, trustDevice, remember) => req('POST', '/auth/totp-verify', { challenge_token: challengeToken, backup_code: backupCode, trust_device: trustDevice, remember }),
    regenerateCodes: (password) => req('POST', '/auth/backup-codes-regenerate', { password }),
};

// Links
export const Links = {
    list: (query = '', type = 'keyword') => req('GET', `/links?q=${encodeURIComponent(query)}&type=${type}`),
    mine: () => req('GET', '/links/mine'),
    create: (body) => req('POST', '/links', body),
    update: (id, body) => req('PUT', `/links/${id}`, body),
    delete: (id) => req('DELETE', `/links/${id}`),
    analytics: (id) => req('GET', `/links/analytics?id=${encodeURIComponent(id)}`),
};

// Ownership
export const Ownership = {
    list: () => req('GET', '/ownership'),
    request: (linkId) => req('POST', '/ownership', {
        link_id: linkId
    }),
    respond: (id, action) => req('PUT', `/ownership/${id}`, {
        action
    }),
};

// Admin
export const Admin = {
    users: () => req('GET', '/admin/users'),
    updateUser: (userId, action) => req('PUT', '/admin/users', { user_id: userId, action }),
    updateUserDetails: (userId, details) => req('PUT', '/admin/users', { user_id: userId, action: 'update_details', ...details }),
    resetPassword: (userId) => req('PUT', '/admin/users', { user_id: userId, action: 'reset_password' }),
    deleteUser: (userId) => req('DELETE', `/admin/users?user_id=${userId}`),
    preapproved: () => req('GET', '/admin/preapproved'),
    addPreapproved: (email, role) => req('POST', '/admin/preapproved', { email, role }),
    deletePreapproved: (id) => req('DELETE', `/admin/preapproved?id=${id}`),
};

// Profile
export const Profile = {
    update: (body) => req('PUT', '/profile/update', body),
    delete: (password) => req('DELETE', '/profile/delete', {
        password
    }),
    avatar: (imageBase64) => req('POST', '/profile/avatar', {
        image_base64: imageBase64
    }),
};

// Profile Views
export const ProfileViews = {
    record: (viewedId) => req('POST', '/profile/views', { viewed_id: viewedId }),
    getViewers: (profileId) => req('GET', `/profile/views?profile_id=${encodeURIComponent(profileId)}`),
};

// Trusted 2FA Devices
export const TrustedDevices = {
    list: () => req('GET', '/profile/trusted-devices'),
    remove: (id) => req('DELETE', `/profile/trusted-devices?id=${encodeURIComponent(id)}`),
};

// API Key management
export const ApiKeys = {
    get: () => req('GET', '/apikeys'),
    regenerate: () => req('POST', '/apikeys'),
};

// Public Stats
export const Stats = {
    get: () => req('GET', '/stats'),
};