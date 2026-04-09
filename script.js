import {
    Auth,
    Links,
    Ownership,
    Admin,
    Profile
} from './api.js';
import {
    toast,
    openModal,
    closeModal,
    closeAllModals,
    initTagsInput,
    compressToWebp,
    fmtDate,
    avatarHtml,
    slugCopyHtml,
    tagsHtml,
    pwdStrength,
    icon
} from './ui.js';

// ===== STATE =====
let state = {
    user: null,
    token: localStorage.getItem('gftv_token') || null,
    theme: localStorage.getItem('gftv_theme') || 'classic',
    currentPage: 'login',
};

// ===== THEME =====
const THEMES = {
    classic: {
        label: 'Classic',
        color: '#ccffcc'
    },
    notgreen1: {
        label: 'Not Green 1',
        color: '#ffcccc'
    },
    notgreen2: {
        label: 'Not Green 2',
        color: '#ccccff'
    },
    notgreen3: {
        label: 'Not Green 3',
        color: '#ffffcc'
    },
    notgreen4: {
        label: 'Not Green 4',
        color: '#ffccff'
    },
    notgreen5: {
        label: 'Not Green 5',
        color: '#ccffff'
    },
    rrlgreen: {
        label: 'Really Really Light Green',
        color: '#ffffff'
    },
    hellotheme: {
        label: 'HelloTheme',
        color: '#fedc00'
    },
};

function applyTheme(key) {
    state.theme = key;
    localStorage.setItem('gftv_theme', key);
    document.documentElement.setAttribute('data-theme', key === 'classic' ? '' : key);
    // Update manifest theme-color meta
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEMES[key]?.color || '#ccffcc');
}

// ===== ROUTER =====
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + id);
    if (page) page.classList.add('active');
    state.currentPage = id;
    updateNav();
}

function navigate(page) {
    // Auth guard
    const publicPages = ['login', 'register', 'pending'];
    if (!publicPages.includes(page) && !state.user) {
        showPage('login');
        return;
    }
    showPage(page);

    // Load data for pages
    if (page === 'directory') loadDirectory();
    if (page === 'dashboard') loadDashboard();
    if (page === 'ownership') loadOwnershipRequests();
    if (page === 'admin') loadAdmin();
    if (page === 'profile') renderProfile();
}

// ===== NAV =====
function updateNav() {
    const navLinks = document.getElementById('nav-links');
    const mobileNav = document.getElementById('mobile-nav');
    if (!navLinks) return;

    const links = state.user ? [{
            id: 'directory',
            icon: icon('list'),
            label: 'Directory'
        },
        {
            id: 'dashboard',
            icon: icon('home'),
            label: 'My Links'
        },
        {
            id: 'ownership',
            icon: icon('inbox'),
            label: 'Requests'
        },
        ...(state.user.is_admin ? [{
            id: 'admin',
            icon: icon('settings'),
            label: 'Admin'
        }] : []),
        {
            id: 'profile',
            icon: icon('user'),
            label: 'Profile'
        },
    ] : [];

    const renderLinks = (container) => {
        if (!state.user) {
            container.innerHTML = `
        <button class="nav-btn ${state.currentPage==='login'?'active':''}" onclick="nav('login')">Log In</button>
        <button class="nav-btn ${state.currentPage==='register'?'active':''}" onclick="nav('register')">Register</button>
      `;
        } else {
            container.innerHTML = links.map(l =>
                `<button class="nav-btn ${state.currentPage===l.id?'active':''}" onclick="nav('${l.id}')"><span class="nav-btn-icon">${l.icon}</span>${l.label}</button>`
            ).join('') + `<button class="nav-btn" onclick="handleLogout()">${icon('logout')} Logout</button>`;
        }
    };

    renderLinks(navLinks);
    if (mobileNav) renderLinks(mobileNav);

    // User avatar in nav
    const navUser = document.getElementById('nav-user');
    if (navUser) {
        if (state.user) {
            const letter = (state.user.display_name || state.user.username)[0].toUpperCase();
            navUser.innerHTML = state.user.avatar_url ?
                `<img src="${state.user.avatar_url}" class="nav-avatar" onclick="nav('profile')" alt="${letter}">` :
                `<div class="avatar-placeholder" onclick="nav('profile')">${letter}</div>`;
        } else {
            navUser.innerHTML = '';
        }
    }
}

window.nav = navigate;
window.openModal = openModal;

// ===== AUTH =====
async function init() {
    applyTheme(state.theme);

    if (state.token) {
        const res = await Auth.me();
        if (res.ok) {
            state.user = res.data.user;
            navigate('dashboard');
        } else {
            localStorage.removeItem('gftv_token');
            state.token = null;
            navigate('login');
        }
    } else {
        navigate('login');
    }

    registerServiceWorker();
}

async function handleLogout() {
    await Auth.logout();
    localStorage.removeItem('gftv_token');
    state.user = null;
    state.token = null;
    closeAllModals();
    navigate('login');
    toast('Logged out successfully', 'success');
}
window.handleLogout = handleLogout;

// ===== LOGIN PAGE =====
function setupLoginPage() {
    const form = document.getElementById('login-form');
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Logging in…';

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        const res = await Auth.login({
            username,
            password
        });

        if (res.ok) {
            state.token = res.data.token;
            state.user = res.data.user;
            localStorage.setItem('gftv_token', state.token);
            toast(`Welcome back, ${state.user.display_name}!`, 'success');
            navigate('dashboard');
        } else if (res.status === 403 && res.data.error === 'PENDING_APPROVAL') {
            navigate('pending');
        } else {
            errEl.textContent = res.data.error || 'Login failed';
            errEl.style.display = 'flex';
        }

        btn.disabled = false;
        btn.textContent = 'Log In';
    });
}

// ===== REGISTER PAGE =====
function setupRegisterPage() {
    const form = document.getElementById('register-form');
    const errEl = document.getElementById('register-error');
    const btn = document.getElementById('register-btn');
    const pwdInput = document.getElementById('reg-password');
    const strengthBar = document.getElementById('pwd-strength-bar');

    pwdInput.addEventListener('input', () => {
        const s = pwdStrength(pwdInput.value);
        strengthBar.className = `pwd-strength pwd-strength-${s}`;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errEl.style.display = 'none';

        const password = pwdInput.value;
        const confirm = document.getElementById('reg-confirm').value;
        if (password !== confirm) {
            errEl.textContent = 'Passwords do not match';
            errEl.style.display = 'flex';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Creating account…';

        try {
            const res = await Auth.register({
                username: document.getElementById('reg-username').value.trim(),
                display_name: document.getElementById('reg-displayname').value.trim(),
                email: document.getElementById('reg-email').value.trim(),
                password,
            });

            if (res.ok) {
                toast('Account created! Waiting for admin approval.', 'success');
                navigate('pending');
            } else {
                errEl.textContent = res.data.error || 'Registration failed';
                errEl.style.display = 'flex';
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    });
}

// ===== DIRECTORY PAGE =====
let directoryData = [];
let directorySearch = '';
let directorySearchType = 'keyword';

async function loadDirectory() {
    const container = document.getElementById('directory-table-wrap');
    container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

    const res = await Links.list(directorySearch, directorySearchType);
    if (!res.ok) {
        container.innerHTML = '<p style="color:var(--danger);padding:20px">Failed to load links.</p>';
        return;
    }

    directoryData = res.data.links || [];
    renderDirectoryTable();
}

function renderDirectoryTable() {
    const container = document.getElementById('directory-table-wrap');
    const data = directoryData;

    if (data.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('link', 32)}</div><h3>No links found</h3><p>Try a different search, or add some links!</p></div>`;
        return;
    }

    const rows = data.map(link => {
        const user = link.gftvlinks_users || {};
        const isOwner = state.user && link.gftvlinks_users?.id === state.user.id;
        return `<tr>
      <td class="td-slug">${slugCopyHtml(link.slug)}</td>
      <td class="td-dest"><a href="${link.destination}" target="_blank" rel="noopener" title="${link.destination}">${link.destination}</a></td>
      <td class="td-user">${avatarHtml(user)}<span>${user.display_name || user.username || '—'}</span></td>
      <td><span class="badge ${link.is_active ? 'badge-active' : 'badge-inactive'}">${link.is_active ? '● Active' : '● Inactive'}</span></td>
      <td class="access-count">${icon('eye')} ${link.access_count ?? 0}</td>
      <td>${tagsHtml(link.tags)}</td>
      <td>${fmtDate(link.created_at)}</td>
      <td>
        ${!isOwner
          ? `<button class="btn btn-sm btn-secondary" onclick="requestOwnership('${link.id}')">Request Ownership</button>`
          : `<span style="color:var(--text-light);font-size:0.8rem">You own this</span>`
        }
      </td>
    </tr>`;
    }).join('');

    container.innerHTML = `
    <div class="table-wrap glass">
      <table>
        <thead><tr>
          <th>Short Link</th><th>Destination</th><th>Created By</th>
          <th>Status</th><th>Views</th><th>Tags</th><th>Created</th><th>Action</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function setupDirectoryPage() {
    const searchInput = document.getElementById('dir-search');
    const typeSelect = document.getElementById('dir-search-type');

    let debounceTimer;
    searchInput.addEventListener('input', () => {
        directorySearch = searchInput.value.trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(loadDirectory, 350);
    });
    typeSelect.addEventListener('change', () => {
        directorySearchType = typeSelect.value;
        if (directorySearch) loadDirectory();
    });
}

window.requestOwnership = async (link_id) => {
    const res = await Ownership.request(link_id);
    if (res.ok) toast('Ownership request sent!', 'success');
    else toast(res.data.error || 'Failed to send request', 'error');
};

// ===== DASHBOARD PAGE =====
let dashboardLinks = [];
let dashTagsManager = null;
let editingLinkId = null;

async function loadDashboard() {
    const container = document.getElementById('dashboard-links-wrap');
    const statsEl = document.getElementById('dashboard-stats');
    container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

    const res = await Links.mine();
    if (!res.ok) {
        container.innerHTML = '<p style="color:var(--danger);padding:20px">Failed to load your links.</p>';
        return;
    }

    dashboardLinks = res.data.links || [];

    // Stats
    const totalViews = dashboardLinks.reduce((a, l) => a + (l.access_count || 0), 0);
    const activeCount = dashboardLinks.filter(l => l.is_active).length;
    statsEl.innerHTML = `
    <div class="stat-card glass"><div class="stat-icon">${icon('link', 20)}</div><div class="stat-label">Total Links</div><div class="stat-value">${dashboardLinks.length}</div></div>
    <div class="stat-card glass"><div class="stat-icon">${icon('check-circle', 20)}</div><div class="stat-label">Active</div><div class="stat-value">${activeCount}</div></div>
    <div class="stat-card glass"><div class="stat-icon">${icon('eye', 20)}</div><div class="stat-label">Total Views</div><div class="stat-value">${totalViews}</div></div>
  `;

    renderDashboardTable();
}

function renderDashboardTable() {
    const container = document.getElementById('dashboard-links-wrap');
    if (dashboardLinks.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('link', 32)}</div><h3>No links yet</h3><p>Create your first short link!</p></div>`;
        return;
    }

    const rows = dashboardLinks.map(link => `
    <tr>
      <td class="td-slug">${slugCopyHtml(link.slug)}</td>
      <td class="td-dest"><a href="${link.destination}" target="_blank" rel="noopener">${link.destination}</a></td>
      <td>
        <label class="toggle" title="${link.is_active ? 'Disable' : 'Enable'}">
          <input type="checkbox" ${link.is_active ? 'checked' : ''} onchange="toggleLink('${link.id}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td class="access-count">${icon('eye')} ${link.access_count ?? 0}</td>
      <td>${tagsHtml(link.tags)}</td>
      <td>${fmtDate(link.created_at)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-secondary" onclick="openEditLink('${link.id}')">${icon('edit')} Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteLink('${link.id}')">${icon('trash')}</button>
        </div>
      </td>
    </tr>
  `).join('');

    container.innerHTML = `
    <div class="table-wrap glass">
      <table>
        <thead><tr><th>Short Link</th><th>Destination</th><th>Active</th><th>Views</th><th>Tags</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

window.toggleLink = async (id, is_active) => {
    const res = await Links.update(id, {
        is_active
    });
    if (res.ok) {
        const link = dashboardLinks.find(l => l.id === id);
        if (link) link.is_active = is_active;
        toast(is_active ? 'Link enabled' : 'Link disabled', 'success');
    } else {
        toast(res.data.error || 'Failed to toggle link', 'error');
        loadDashboard();
    }
};

window.deleteLink = async (id) => {
    if (!confirm('Delete this link? This cannot be undone.')) return;
    const res = await Links.delete(id);
    if (res.ok) {
        toast('Link deleted', 'success');
        loadDashboard();
    } else toast(res.data.error || 'Failed to delete', 'error');
};

window.openEditLink = (id) => {
    const link = dashboardLinks.find(l => l.id === id);
    if (!link) return;
    editingLinkId = id;

    document.getElementById('edit-slug').value = link.slug;
    document.getElementById('edit-dest').value = link.destination;
    if (dashTagsManager) dashTagsManager.setTags(link.tags || []);

    openModal('modal-edit-link');
};

function setupCreateLinkModal() {
    // Create link tags
    const createTagsContainer = document.getElementById('create-tags-container');
    let createTags = [];
    const createTagsManager = initTagsInput(createTagsContainer, (t) => {
        createTags = t;
    });

    document.getElementById('create-link-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('create-link-btn');
        btn.disabled = true;
        btn.textContent = 'Creating…';

        const slug = document.getElementById('create-slug').value.trim();
        const destination = document.getElementById('create-dest').value.trim();

        const res = await Links.create({
            slug,
            destination,
            tags: createTags
        });
        if (res.ok) {
            toast('Link created!', 'success');
            closeModal('modal-create-link');
            createTagsManager.reset();
            document.getElementById('create-link-form').reset();
            loadDashboard();
        } else {
            toast(res.data.error || 'Failed to create link', 'error');
        }
        btn.disabled = false;
        btn.textContent = 'Create Link';
    });

    // Edit link tags
    const editTagsContainer = document.getElementById('edit-tags-container');
    let editTags = [];
    dashTagsManager = initTagsInput(editTagsContainer, (t) => {
        editTags = t;
    });

    document.getElementById('edit-link-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('edit-link-btn');
        btn.disabled = true;
        btn.textContent = 'Saving…';

        const slug = document.getElementById('edit-slug').value.trim();
        const destination = document.getElementById('edit-dest').value.trim();

        const res = await Links.update(editingLinkId, {
            slug,
            destination,
            tags: editTags
        });
        if (res.ok) {
            toast('Link updated!', 'success');
            closeModal('modal-edit-link');
            loadDashboard();
        } else {
            toast(res.data.error || 'Failed to update link', 'error');
        }
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    });
}

// ===== OWNERSHIP REQUESTS =====
async function loadOwnershipRequests() {
    const container = document.getElementById('ownership-list');
    container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

    const res = await Ownership.list();
    if (!res.ok) {
        container.innerHTML = '<p style="color:var(--danger);padding:20px">Failed to load requests.</p>';
        return;
    }

    const requests = res.data.requests || [];
    if (requests.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('mail-open', 32)}</div><h3>No ownership requests</h3><p>When someone requests ownership of your links, they'll appear here.</p></div>`;
        return;
    }

    container.innerHTML = requests.map(r => `
    <div class="glass" style="padding:18px 20px;margin-bottom:12px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:200px;">
        <div style="font-weight:700;margin-bottom:2px;">${icon('link')} gftv.asia/${r.gftvlinks_links?.slug || '—'}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);">Requested by <strong>${r.requester?.display_name || r.requester?.username || '?'}</strong> (@${r.requester?.username || '?'})</div>
        <div style="font-size:0.78rem;color:var(--text-light);margin-top:2px;">${fmtDate(r.created_at)}</div>
      </div>
      <div style="display:flex;gap:8px;">
        ${r.status === 'pending' ? `
          <button class="btn btn-sm btn-success" onclick="respondOwnership('${r.id}','approve')">${icon('check-circle')} Approve</button>
          <button class="btn btn-sm btn-danger" onclick="respondOwnership('${r.id}','reject')">${icon('x-circle')} Reject</button>
        ` : `<span class="badge ${r.status === 'approved' ? 'badge-active' : 'badge-inactive'}">${r.status}</span>`}
      </div>
    </div>
  `).join('');
}

window.respondOwnership = async (id, action) => {
    const res = await Ownership.respond(id, action);
    if (res.ok) {
        toast(`Request ${action}d`, 'success');
        loadOwnershipRequests();
    } else toast(res.data.error || 'Failed', 'error');
};

// ===== ADMIN PAGE =====
async function loadAdmin() {
    const container = document.getElementById('admin-users-wrap');
    container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

    const res = await Admin.users();
    if (!res.ok) {
        container.innerHTML = '<p style="color:var(--danger);padding:20px">Access denied.</p>';
        return;
    }

    const users = res.data.users || [];
    const pending = users.filter(u => !u.is_approved);
    const approved = users.filter(u => u.is_approved);

    function userRow(u) {
        const isSelf = u.id === state.user?.id;
        return `<tr>
      <td class="td-user">${avatarHtml(u)}<div><div style="font-weight:700">${u.display_name}</div><div style="font-size:0.8rem;color:var(--text-muted)">@${u.username}</div></div></td>
      <td style="font-size:0.85rem;color:var(--text-muted)">${u.email}</td>
      <td>${u.is_admin ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge">User</span>'}</td>
      <td>${u.is_approved ? '<span class="badge badge-active">Approved</span>' : '<span class="badge badge-pending">Pending</span>'}</td>
      <td>${fmtDate(u.created_at)}</td>
      <td>
        <div class="action-btns">
          ${!u.is_approved ? `<button class="btn btn-sm btn-success" onclick="adminAction('${u.id}','approve')">Approve</button>` : `<button class="btn btn-sm btn-danger" onclick="adminAction('${u.id}','reject')">Revoke</button>`}
          ${!isSelf ? `<button class="btn btn-sm btn-secondary" onclick="adminAction('${u.id}','toggle_admin')">${u.is_admin ? 'Remove Admin' : 'Make Admin'}</button>` : ''}
          ${!isSelf ? `<button class="btn btn-sm btn-danger" onclick="adminDeleteUser('${u.id}','${u.display_name}')">${icon('trash')}</button>` : ''}
        </div>
      </td>
    </tr>`;
    }

    container.innerHTML = `
    <h3 class="section-title">${icon('clock')} Pending Approval (${pending.length})</h3>
    ${pending.length > 0
      ? `<div class="table-wrap glass" style="margin-bottom:28px;"><table>
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>${pending.map(userRow).join('')}</tbody>
        </table></div>`
      : `<div class="empty-state" style="padding:24px"><p>No pending accounts</p></div>`
    }
    <h3 class="section-title">${icon('check-circle')} All Users (${approved.length})</h3>
    <div class="table-wrap glass"><table>
      <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
      <tbody>${approved.map(userRow).join('')}</tbody>
    </table></div>
  `;
}

window.loadAdmin = loadAdmin;
window.adminAction = async (user_id, action) => {
    const res = await Admin.updateUser(user_id, action);
    if (res.ok) {
        toast('User updated', 'success');
        loadAdmin();
    } else toast(res.data.error || 'Failed', 'error');
};

window.adminDeleteUser = async (user_id, name) => {
    if (!confirm(`Delete user "${name}"? This will also delete all their links.`)) return;
    const res = await Admin.deleteUser(user_id);
    if (res.ok) {
        toast('User deleted', 'success');
        loadAdmin();
    } else toast(res.data.error || 'Failed', 'error');
};

// ===== PROFILE PAGE =====
function renderProfile() {
    const u = state.user;
    if (!u) return;

    // Header
    document.getElementById('profile-avatar-wrap').innerHTML = `
    <div class="profile-avatar-wrap">
      ${u.avatar_url
        ? `<img src="${u.avatar_url}" class="profile-avatar" alt="${u.display_name}">`
        : `<div class="profile-avatar-ph">${(u.display_name || u.username)[0].toUpperCase()}</div>`
      }
      <div class="profile-avatar-edit" onclick="document.getElementById('avatar-file-input').click()" title="Change photo">${icon('camera')}</div>
    </div>`;

    document.getElementById('profile-display-name').textContent = u.display_name;
    document.getElementById('profile-username').textContent = `@${u.username}`;

    const socials = u.social_links || [];
    document.getElementById('profile-social-links').innerHTML = socials.length > 0 ?
        socials.map(s => `<a class="social-link" href="${s.url}" target="_blank" rel="noopener">${icon('external-link')} ${s.label}</a>`).join('') :
        '<span style="color:var(--text-light);font-size:0.85rem">No social links added</span>';

    // Fill edit form
    document.getElementById('edit-displayname').value = u.display_name;

    // Social links editor
    renderSocialLinksEditor(socials);
}

function renderSocialLinksEditor(socials) {
    const container = document.getElementById('social-links-editor');
    container.innerHTML = '';
    socials.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'social-link-row';
        row.innerHTML = `
      <input class="form-control" placeholder="Label (e.g. Twitter)" value="${s.label}" data-index="${i}" data-field="label">
      <input class="form-control" placeholder="URL" value="${s.url}" data-index="${i}" data-field="url">
      <button type="button" class="btn btn-icon btn-danger" onclick="removeSocialLink(${i})">×</button>
    `;
        container.appendChild(row);
    });
}

window.addSocialLink = () => {
    const socials = getSocialLinksFromEditor();
    socials.push({
        label: '',
        url: ''
    });
    renderSocialLinksEditor(socials);
};

window.removeSocialLink = (i) => {
    const socials = getSocialLinksFromEditor();
    socials.splice(i, 1);
    renderSocialLinksEditor(socials);
};

function getSocialLinksFromEditor() {
    const container = document.getElementById('social-links-editor');
    const inputs = container.querySelectorAll('input');
    const socials = [];
    inputs.forEach(inp => {
        const i = parseInt(inp.dataset.index);
        if (!socials[i]) socials[i] = {
            label: '',
            url: ''
        };
        socials[i][inp.dataset.field] = inp.value.trim();
    });
    return socials;
}

function setupProfilePage() {
    // Avatar upload
    const avatarInput = document.getElementById('avatar-file-input');
    avatarInput.addEventListener('change', async () => {
        const file = avatarInput.files[0];
        if (!file) return;
        try {
            toast('Compressing image…', 'info');
            const webp = await compressToWebp(file);
            const res = await Profile.avatar(webp);
            if (res.ok) {
                state.user.avatar_url = res.data.avatar_url;
                toast('Avatar updated!', 'success');
                renderProfile();
                updateNav();
            } else {
                toast(res.data.error || 'Upload failed', 'error');
            }
        } catch (err) {
            toast('Image processing failed: ' + err.message, 'error');
        }
        avatarInput.value = '';
    });

    // Edit profile form
    document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-profile-btn');
        btn.disabled = true;
        btn.textContent = 'Saving…';

        const display_name = document.getElementById('edit-displayname').value.trim();
        const social_links = getSocialLinksFromEditor().filter(s => s.label && s.url);

        const res = await Profile.update({
            display_name,
            social_links
        });
        if (res.ok) {
            state.user.display_name = display_name;
            state.user.social_links = social_links;
            toast('Profile updated!', 'success');
            renderProfile();
            updateNav();
        } else {
            toast(res.data.error || 'Failed to update profile', 'error');
        }
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    });

    // Change password form
    document.getElementById('change-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const current = document.getElementById('current-password').value;
        const newPwd = document.getElementById('new-password').value;
        const confirm = document.getElementById('confirm-new-password').value;

        if (newPwd !== confirm) {
            toast('Passwords do not match', 'error');
            return;
        }
        if (newPwd.length < 8) {
            toast('Password must be at least 8 characters', 'error');
            return;
        }

        const btn = document.getElementById('change-pwd-btn');
        btn.disabled = true;
        btn.textContent = 'Changing…';

        const res = await Profile.update({
            current_password: current,
            new_password: newPwd
        });
        if (res.ok) {
            toast('Password changed!', 'success');
            document.getElementById('change-password-form').reset();
        } else {
            toast(res.data.error || 'Failed to change password', 'error');
        }
        btn.disabled = false;
        btn.textContent = 'Change Password';
    });

    // New pwd strength
    document.getElementById('new-password').addEventListener('input', function () {
        const s = pwdStrength(this.value);
        document.getElementById('new-pwd-strength').className = `pwd-strength pwd-strength-${s}`;
    });

    // Delete account
    setupDeleteAccount();
}

// ===== DELETE ACCOUNT =====
function setupDeleteAccount() {
    if (state.user?.is_admin) {
        const delSection = document.getElementById('delete-account-section');
        if (delSection) delSection.style.display = 'none';
        return;
    }

    let deleteStep = 0;

    window.startDeleteAccount = () => {
        deleteStep = 0;
        updateDeleteStep();
        openModal('modal-delete-account');
    };

    window.nextDeleteStep = () => {
        deleteStep++;
        if (deleteStep < 3) {
            updateDeleteStep();
        } else {
            openModal('modal-delete-final');
            closeModal('modal-delete-account');
        }
    };

    function updateDeleteStep() {
        const dots = document.querySelectorAll('.confirm-step-dot');
        dots.forEach((d, i) => d.classList.toggle('done', i <= deleteStep));

        const texts = [
            'Are you sure you want to delete your account? All your links will also be deleted.',
            'This action is irreversible. Your account and all associated data will be permanently removed.',
            'Last chance! Once deleted, you cannot recover your account.',
        ];
        document.getElementById('delete-step-text').textContent = texts[deleteStep];
    }

    document.getElementById('delete-final-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = document.getElementById('delete-confirm-password').value;
        const btn = document.getElementById('delete-account-final-btn');
        btn.disabled = true;
        btn.textContent = 'Deleting…';

        const res = await Profile.delete(pwd);
        if (res.ok) {
            localStorage.removeItem('gftv_token');
            state.user = null;
            state.token = null;
            closeAllModals();
            toast('Account deleted. Goodbye!', 'info', 5000);
            navigate('login');
        } else {
            toast(res.data.error || 'Failed to delete account', 'error');
            btn.disabled = false;
            btn.textContent = 'Permanently Delete Account';
        }
    });
}

// ===== THEME PICKER =====
function setupThemePicker() {
    const grid = document.getElementById('theme-grid');
    grid.innerHTML = Object.entries(THEMES).map(([key, t]) => `
    <div class="theme-swatch ${state.theme === key ? 'active' : ''}"
      style="background:${t.color};"
      onclick="selectTheme('${key}', this)">
      <div class="theme-swatch-dot" style="background:${t.color};border:2px solid rgba(0,0,0,0.15)"></div>
      <div class="theme-swatch-name">${t.label}</div>
    </div>
  `).join('');
}

window.selectTheme = (key, el) => {
    applyTheme(key);
    document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    toast(`Theme changed to ${THEMES[key].label}`, 'success');
};

// ===== HAMBURGER MENU =====
function setupHamburger() {
    const btn = document.getElementById('hamburger-btn');
    const drawer = document.getElementById('mobile-nav');
    btn?.addEventListener('click', () => {
        drawer.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
        if (!btn?.contains(e.target) && !drawer?.contains(e.target)) {
            drawer?.classList.remove('open');
        }
    });
}

// ===== SERVICE WORKER =====
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
}

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', () => {
    setupLoginPage();
    setupRegisterPage();
    setupDirectoryPage();
    setupCreateLinkModal();
    setupProfilePage();
    setupThemePicker();
    setupHamburger();

    // Theme picker open
    document.getElementById('theme-picker-btn')?.addEventListener('click', () => openModal('modal-theme'));

    // Close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    init();
});