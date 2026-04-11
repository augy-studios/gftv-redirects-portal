import {
    Auth,
    Totp,
    Links,
    Ownership,
    Admin,
    Profile,
    ProfileViews,
    Stats
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
    currentPage: 'home',
};

let homeTypingInterval = null;

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
    // Clean up typing animation when leaving home
    if (state.currentPage === 'home' && id !== 'home' && homeTypingInterval) {
        clearInterval(homeTypingInterval);
        homeTypingInterval = null;
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + id);
    if (page) page.classList.add('active');
    state.currentPage = id;
    updateNav();
}

function isEditor() {
    return state.user && (state.user.is_editor || state.user.is_admin);
}

function navigate(page) {
    // Auth guard
    const publicPages = ['home', 'login', 'register', 'pending'];
    if (!publicPages.includes(page) && !state.user) {
        showPage('home');
        return;
    }

    // Viewer guard: Viewers can only access directory and profile
    if (state.user && !isEditor()) {
        const viewerPages = ['directory', 'profile'];
        if (!viewerPages.includes(page)) {
            showPage('directory');
            return;
        }
    }

    showPage(page);

    // Load data for pages
    if (page === 'home') initHomePage();
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

    const links = state.user ? [
        { id: 'directory', icon: icon('list'), label: 'Directory' },
        ...(isEditor() ? [
            { id: 'dashboard', icon: icon('home'), label: 'My Links' },
            { id: 'ownership', icon: icon('inbox'), label: 'Requests' },
        ] : []),
        ...(state.user.is_admin ? [{ id: 'admin', icon: icon('settings'), label: 'Admin' }] : []),
        { id: 'profile', icon: icon('user'), label: 'Profile' },
    ] : [];

    const renderLinks = (container) => {
        if (!state.user) {
            container.innerHTML = `
        <button class="nav-btn-outline" onclick="window.open('https://form.gov.sg','_blank')">Send us feedback</button>
        <button class="nav-btn-outline" onclick="window.open('https://guide.gftv.asia','_blank')">Guide</button>
        <button class="nav-btn-outline" onclick="window.open('https://github.com/augy-studios/gftv-redirects-portal','_blank')">Contribute</button>
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
            navigate(isEditor() ? 'dashboard' : 'directory');
        } else {
            localStorage.removeItem('gftv_token');
            state.token = null;
            navigate('home');
        }
    } else {
        navigate('home');
    }

    registerServiceWorker();
}

async function handleLogout() {
    await Auth.logout();
    localStorage.removeItem('gftv_token');
    state.user = null;
    state.token = null;
    closeAllModals();
    navigate('home');
    toast('Logged out successfully', 'success');
}
window.handleLogout = handleLogout;

// ===== LOGIN PAGE =====
// Holds state during the 2FA challenge flow
let _totpChallengeToken = null;
let _totpLoginUsername = null;

function setupLoginPage() {
    const form = document.getElementById('login-form');
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    // Allow Enter key in TOTP modal code input to submit
    document.getElementById('totp-login-code')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); window.submitTotpLogin(); }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Logging in…';

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        // Send stored device token so trusted devices skip 2FA
        const device_token = localStorage.getItem(`gftv_device_${username.toLowerCase()}`) || undefined;

        const res = await Auth.login({ username, password, device_token });

        if (res.ok && res.data.requires_2fa) {
            // Server issued a TOTP challenge — show the 2FA modal
            _totpChallengeToken = res.data.challenge_token;
            _totpLoginUsername = res.data.username || username.toLowerCase();
            document.getElementById('totp-login-code').value = '';
            document.getElementById('totp-trust-device').checked = false;
            document.getElementById('totp-login-error').style.display = 'none';
            openModal('modal-totp-login');
            setTimeout(() => document.getElementById('totp-login-code').focus(), 100);
        } else if (res.ok) {
            finishLogin(res.data.token, res.data.user);
            toast(`Welcome back, ${res.data.user.display_name}!`, 'success');
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

function finishLogin(token, user) {
    state.token = token;
    state.user = user;
    localStorage.setItem('gftv_token', token);
    closeAllModals();
    navigate(isEditor() ? 'dashboard' : 'directory');
}

window.cancelTotpLogin = () => {
    _totpChallengeToken = null;
    _totpLoginUsername = null;
    closeModal('modal-totp-login');
};

window.submitTotpLogin = async () => {
    const code = document.getElementById('totp-login-code').value.trim();
    const trust = document.getElementById('totp-trust-device').checked;
    const errEl = document.getElementById('totp-login-error');
    const btn = document.getElementById('totp-login-btn');

    if (!code || code.length !== 6) {
        errEl.textContent = 'Please enter the 6-digit code';
        errEl.style.display = 'flex';
        return;
    }

    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Verifying…';

    const res = await Totp.verify(_totpChallengeToken, code, trust);

    btn.disabled = false;
    btn.textContent = 'Verify';

    if (res.ok) {
        if (trust && res.data.device_token && _totpLoginUsername) {
            localStorage.setItem(`gftv_device_${_totpLoginUsername}`, res.data.device_token);
        }
        finishLogin(res.data.token, res.data.user);
        toast(`Welcome back, ${res.data.user.display_name}!`, 'success');
    } else {
        errEl.textContent = res.data.error || 'Verification failed';
        errEl.style.display = 'flex';
    }
};

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

        const email = document.getElementById('reg-email').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errEl.textContent = 'Please enter a valid email address';
            errEl.style.display = 'flex';
            return;
        }

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
                email,
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
      <td class="td-dest"><span title="${link.destination}">${link.destination}</span></td>
      <td class="td-user td-user-clickable" onclick="viewUserProfile('${user.id}')" title="View profile">${avatarHtml(user)}<span>${user.display_name || user.username || '—'}</span></td>
      <td style="white-space:nowrap"><span class="badge ${link.is_active ? 'badge-active' : 'badge-inactive'}">${link.is_active ? '● Active' : '● Inactive'}</span></td>
      <td class="access-count" style="white-space:nowrap">${icon('eye')} ${link.access_count ?? 0}</td>
      <td>${tagsHtml(link.tags)}</td>
      <td style="white-space:nowrap">${fmtDate(link.created_at)}</td>
      <td style="white-space:nowrap">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${state.user?.is_admin ? `<button class="btn btn-sm btn-secondary" onclick="openAdminManageLink('${link.id}')">${icon('edit')} Edit</button>` : ''}
          ${isOwner
            ? `<span style="color:var(--text-light);font-size:0.8rem">You own this</span>`
            : isEditor()
              ? `<button class="btn btn-sm btn-secondary" onclick="requestOwnership('${link.id}')">Request Ownership</button>`
              : ''
          }
        </div>
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

function buildProfileModalHtml(user, userLinks, viewers) {
    const totalViews = userLinks.reduce((a, l) => a + (l.access_count || 0), 0);
    const letter = (user.display_name || user.username || '?')[0].toUpperCase();
    const avHtml = user.avatar_url
        ? `<img src="${user.avatar_url}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;margin-bottom:10px;" alt="${letter}">`
        : `<div style="width:72px;height:72px;border-radius:50%;background:var(--brand);color:var(--brand-text,#fff);font-size:1.8rem;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">${letter}</div>`;

    const socials = user.social_links || [];
    const socialsHtml = socials.length > 0
        ? `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:14px;">
            ${socials.map(s => `<a href="${s.url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;border:1px solid var(--border);font-size:0.82rem;color:var(--text-muted);text-decoration:none;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text-muted)'">${icon('external-link')} ${s.label}</a>`).join('')}
          </div>`
        : '';

    const viewerPillsHtml = viewers && viewers.length > 0
        ? `<div class="profile-viewers">
            <div class="profile-viewers-label">Recent viewers</div>
            <div class="profile-viewers-pills">
              ${viewers.map(v => {
                const vLetter = (v.display_name || v.username || '?')[0].toUpperCase();
                const vAvatar = v.avatar_url
                    ? `<img src="${v.avatar_url}" class="viewer-pill-avatar" alt="${vLetter}">`
                    : `<span class="viewer-pill-avatar viewer-pill-avatar-ph">${vLetter}</span>`;
                return `<button class="viewer-pill" onclick="viewUserProfileById('${v.id}')" title="@${v.username}">${vAvatar}<span>${v.display_name || v.username}</span></button>`;
              }).join('')}
            </div>
          </div>`
        : '';

    const roleBadge = user.is_admin
        ? `<span class="badge badge-admin" style="margin-bottom:16px;display:inline-block;">Admin</span>`
        : `<div style="margin-bottom:16px"></div>`;

    return `
        ${avHtml}
        <div style="font-size:1.15rem;font-weight:700;margin-bottom:2px;">${user.display_name || user.username}</div>
        <div style="color:var(--text-muted);font-size:0.88rem;margin-bottom:8px;">@${user.username}</div>
        ${roleBadge}
        <div style="display:flex;gap:24px;justify-content:center;">
            <div><div style="font-size:1.4rem;font-weight:700;">${userLinks.length}</div><div style="font-size:0.78rem;color:var(--text-muted);">Links</div></div>
            <div><div style="font-size:1.4rem;font-weight:700;">${totalViews}</div><div style="font-size:0.78rem;color:var(--text-muted);">Total Views</div></div>
        </div>
        ${socialsHtml}
        ${viewerPillsHtml}
    `;
}

window.viewUserProfile = async (userId) => {
    const user = directoryData.map(l => l.gftvlinks_users).find(u => u?.id === userId);
    if (!user) return;

    const userLinks = directoryData.filter(l => l.gftvlinks_users?.id === userId);

    // Show modal immediately with loading viewers placeholder
    document.getElementById('view-profile-content').innerHTML = buildProfileModalHtml(user, userLinks, []);
    openModal('modal-view-profile');

    // Record the profile view (fire-and-forget, non-blocking)
    ProfileViews.record(userId);

    // Fetch recent viewers and update modal
    const viewRes = await ProfileViews.getViewers(userId);
    if (viewRes.ok && viewRes.data.viewers?.length > 0) {
        document.getElementById('view-profile-content').innerHTML =
            buildProfileModalHtml(user, userLinks, viewRes.data.viewers);
    }
};

// View a profile by ID — used by viewer pills (looks up user from directoryData or fetches from API)
window.viewUserProfileById = async (userId) => {
    // Try to find user in already-loaded directory data first
    const fromDir = directoryData.map(l => l.gftvlinks_users).find(u => u?.id === userId);
    if (fromDir) {
        await window.viewUserProfile(userId);
        return;
    }
    // Fallback: fetch from directory (reload)
    const res = await Links.list('', 'keyword');
    if (res.ok) {
        directoryData = res.data.links || [];
    }
    await window.viewUserProfile(userId);
};

window.requestOwnership = async (link_id) => {
    const res = await Ownership.request(link_id);
    if (res.ok) toast('Ownership request sent!', 'success');
    else toast(res.data.error || 'Failed to send request', 'error');
};

// ===== ADMIN MANAGE SHORT LINK MODAL =====
let adminManageLinkId = null;
let adminLinkTagsManager = null;

window.openAdminManageLink = (id) => {
    const link = directoryData.find(l => l.id === id);
    if (!link) return;
    adminManageLinkId = id;

    document.getElementById('admin-manage-link-subtitle').textContent = `gftv.asia/${link.slug}`;
    document.getElementById('admin-link-slug').value = link.slug;
    document.getElementById('admin-link-dest').value = link.destination;
    document.getElementById('admin-link-status').value = String(link.is_active);
    document.getElementById('admin-link-new-owner').value = '';
    if (adminLinkTagsManager) adminLinkTagsManager.setTags(link.tags || []);

    openModal('modal-admin-manage-link');
};

window.adminDeleteLink = async () => {
    if (!adminManageLinkId) return;
    const link = directoryData.find(l => l.id === adminManageLinkId);
    const slug = link?.slug || adminManageLinkId;
    if (!confirm(`Delete gftv.asia/${slug}? This cannot be undone.`)) return;

    const res = await Links.delete(adminManageLinkId);
    if (res.ok) {
        toast('Link deleted', 'success');
        closeModal('modal-admin-manage-link');
        loadDirectory();
    } else {
        toast(res.data.error || 'Failed to delete link', 'error');
    }
};

function setupAdminManageLinkModal() {
    const tagsContainer = document.getElementById('admin-link-tags-container');
    let adminLinkTags = [];
    adminLinkTagsManager = initTagsInput(tagsContainer, (t) => {
        adminLinkTags = t;
    });

    document.getElementById('admin-manage-link-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!adminManageLinkId) return;
        const btn = document.getElementById('admin-manage-link-save-btn');
        btn.disabled = true;
        btn.textContent = 'Saving…';

        const slug = document.getElementById('admin-link-slug').value.trim();
        const destination = document.getElementById('admin-link-dest').value.trim();
        const is_active = document.getElementById('admin-link-status').value === 'true';

        const res = await Links.update(adminManageLinkId, { slug, destination, is_active, tags: adminLinkTags });
        if (res.ok) {
            toast('Link updated!', 'success');
            closeModal('modal-admin-manage-link');
            loadDirectory();
        } else {
            toast(res.data.error || 'Failed to update link', 'error');
        }
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    });

    document.getElementById('admin-transfer-link-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!adminManageLinkId) return;
        const btn = document.getElementById('admin-transfer-link-btn');
        const new_owner_username = document.getElementById('admin-link-new-owner').value.trim();
        if (!new_owner_username) { toast('Enter a username to transfer to', 'error'); return; }

        btn.disabled = true;
        btn.textContent = 'Transferring…';

        const res = await Links.update(adminManageLinkId, { new_owner_username });
        if (res.ok) {
            toast(`Ownership transferred to @${new_owner_username}`, 'success');
            document.getElementById('admin-link-new-owner').value = '';
            closeModal('modal-admin-manage-link');
            loadDirectory();
        } else {
            toast(res.data.error || 'Failed to transfer ownership', 'error');
        }
        btn.disabled = false;
        btn.textContent = 'Transfer Ownership';
    });
}

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
        <input class="active-check" type="checkbox" ${link.is_active ? 'checked' : ''} onchange="toggleLink('${link.id}', this.checked)" title="${link.is_active ? 'Disable' : 'Enable'}">
      </td>
      <td class="access-count" style="white-space:nowrap">${icon('eye')} ${link.access_count ?? 0}</td>
      <td>${tagsHtml(link.tags)}</td>
      <td>${fmtDate(link.created_at)}</td>
      <td style="white-space:nowrap">
        <div style="display:flex;gap:6px;align-items:center">
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
    document.getElementById('edit-transfer-owner').value = '';
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

        const slugInput = document.getElementById('create-slug');
        const slug = slugInput.value.trim() || Array.from(crypto.getRandomValues(new Uint8Array(8)), b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('');
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
        const new_owner_username = document.getElementById('edit-transfer-owner').value.trim();

        const body = { slug, destination, tags: editTags };
        if (new_owner_username) body.new_owner_username = new_owner_username;

        const res = await Links.update(editingLinkId, body);
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
let adminUsers = [];
let adminManageUserId = null;
let adminManageUserData = null;
let adminDeleteStep = 0;

async function loadAdmin() {
    const container = document.getElementById('admin-users-wrap');
    container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

    const res = await Admin.users();
    if (!res.ok) {
        container.innerHTML = '<p style="color:var(--danger);padding:20px">Access denied.</p>';
        return;
    }

    adminUsers = res.data.users || [];
    const pending = adminUsers.filter(u => !u.is_approved);
    const approved = adminUsers.filter(u => u.is_approved);

    function userRoleBadge(u) {
        if (u.is_admin) return '<span class="badge badge-admin">Admin</span>';
        if (!u.is_approved) return '<span class="badge badge-pending">Pending</span>';
        if (u.is_editor) return '<span class="badge badge-editor">Editor</span>';
        return '<span class="badge badge-viewer">Viewer</span>';
    }

    function userRow(u) {
        return `<tr>
      <td class="td-user">${avatarHtml(u)}<div><div style="font-weight:700">${u.display_name}</div><div style="font-size:0.8rem;color:var(--text-muted)">@${u.username}</div></div></td>
      <td style="white-space:nowrap">
        <span style="font-size:0.85rem;color:var(--text-muted)">${u.email}</span>
        <button class="btn-copy-inline" data-copy="${u.email}" onclick="copyInline(this)" title="Copy email">${icon('copy')}</button>
      </td>
      <td>${userRoleBadge(u)}</td>
      <td>${u.is_approved ? '<span class="badge badge-active">Approved</span>' : '<span class="badge badge-pending">Pending</span>'}</td>
      <td>${fmtDate(u.created_at)}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-sm btn-secondary" onclick="openAdminManageModal('${u.id}')">${icon('edit')} Edit</button>
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
    <h3 class="section-title">${icon('check-circle')} Approved Users (${approved.length})</h3>
    <div class="table-wrap glass"><table>
      <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
      <tbody>${approved.map(userRow).join('')}</tbody>
    </table></div>
  `;
}

window.loadAdmin = loadAdmin;
window.copyInline = (btn) => {
    const text = btn.dataset.copy;
    navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.innerHTML = icon('copy'); }, 1500);
    });
};

window.openAdminManageModal = (user_id) => {
    const u = adminUsers.find(u => u.id === user_id);
    if (!u) return;
    adminManageUserId = user_id;
    adminManageUserData = u;
    const isSelf = u.id === state.user?.id;

    // Subtitle
    document.getElementById('admin-manage-subtitle').textContent = `@${u.username} · ${u.email}`;

    // Permissions buttons
    const permBtns = document.getElementById('admin-manage-perm-btns');
    const editorClass = u.is_editor ? 'btn-warning' : 'btn-success';
    const editorLabel = u.is_editor ? 'Revoke Editor' : 'Grant Editor';
    const editorAction = u.is_editor ? 'revoke_editor' : 'grant_editor';
    const viewerClass = u.is_approved ? 'btn-danger' : 'btn-success';
    const viewerLabel = u.is_approved ? 'Revoke Viewer' : 'Grant Viewer';
    const viewerAction = u.is_approved ? 'revoke_viewer' : 'grant_viewer';
    const adminClass = u.is_admin ? 'btn-warning' : 'btn-secondary';
    const adminLabel = u.is_admin ? 'Revoke Admin' : 'Grant Admin';

    let permHtml = `
        <button class="btn btn-sm ${editorClass}" onclick="adminModalAction('${editorAction}')">${editorLabel}</button>
        <button class="btn btn-sm ${viewerClass}" onclick="adminModalAction('${viewerAction}')">${viewerLabel}</button>
    `;
    if (!isSelf) {
        permHtml += `<button class="btn btn-sm ${adminClass}" onclick="adminModalAction('toggle_admin')">${adminLabel}</button>`;
    }
    permBtns.innerHTML = permHtml;

    // Details fields
    document.getElementById('admin-manage-username').value = u.username;
    document.getElementById('admin-manage-displayname').value = u.display_name;
    document.getElementById('admin-manage-email').value = u.email;

    // Danger zone — delete row
    const deleteRow = document.getElementById('admin-delete-user-row');
    if (isSelf) {
        deleteRow.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;margin:0;">You cannot delete your own account from here.</p>';
    } else {
        deleteRow.innerHTML = `
            <div>
                <div style="font-weight:700;margin-bottom:3px;">Delete Account</div>
                <div class="admin-danger-desc">Permanently delete this user's account and all their links.</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="adminStartDeleteUser()">Delete Account</button>
        `;
    }

    openModal('modal-admin-manage');
};

window.adminModalAction = async (action) => {
    if (!adminManageUserId) return;
    const res = await Admin.updateUser(adminManageUserId, action);
    if (res.ok) {
        toast('User updated', 'success');
        await loadAdmin();
        // Refresh modal with updated data
        const updated = adminUsers.find(u => u.id === adminManageUserId);
        if (updated) openAdminManageModal(adminManageUserId);
    } else {
        toast(res.data.error || 'Failed', 'error');
    }
};

window.adminResetPassword = async () => {
    if (!adminManageUserId) return;
    const btn = document.querySelector('#modal-admin-manage .admin-danger-row button.btn-warning');
    if (btn) { btn.disabled = true; btn.textContent = 'Resetting…'; }
    const res = await Admin.resetPassword(adminManageUserId);
    if (btn) { btn.disabled = false; btn.textContent = 'Reset Password'; }
    if (res.ok) {
        await navigator.clipboard.writeText(res.data.password);
        toast('Password reset & copied to clipboard', 'success');
    } else {
        toast(res.data.error || 'Failed to reset password', 'error');
    }
};

window.adminStartDeleteUser = () => {
    adminDeleteStep = 0;
    updateAdminDeleteStep();
    openModal('modal-admin-delete-user');
};

window.adminNextDeleteStep = async () => {
    adminDeleteStep++;
    if (adminDeleteStep < 3) {
        updateAdminDeleteStep();
    } else {
        const res = await Admin.deleteUser(adminManageUserId);
        if (res.ok) {
            toast('User deleted', 'success');
            closeModal('modal-admin-delete-user');
            closeModal('modal-admin-manage');
            loadAdmin();
        } else {
            toast(res.data.error || 'Failed to delete user', 'error');
            adminDeleteStep = 2;
        }
    }
};

function updateAdminDeleteStep() {
    const dots = document.querySelectorAll('#modal-admin-delete-user .admin-delete-step-dot');
    dots.forEach((d, i) => d.classList.toggle('done', i <= adminDeleteStep));
    const name = adminManageUserData?.display_name || 'this user';
    const texts = [
        `Are you sure you want to delete ${name}'s account? All their links will also be deleted.`,
        'This action is irreversible. Their account and all associated data will be permanently removed.',
        'Last chance! Once deleted, you cannot recover this account.',
    ];
    document.getElementById('admin-delete-step-text').textContent = texts[adminDeleteStep];
}

function setupAdminModal() {
    document.getElementById('admin-manage-details-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!adminManageUserId) return;
        const username = document.getElementById('admin-manage-username').value.trim();
        const display_name = document.getElementById('admin-manage-displayname').value.trim();
        const email = document.getElementById('admin-manage-email').value.trim();
        const btn = document.getElementById('admin-manage-details-btn');
        btn.disabled = true;
        btn.textContent = 'Saving…';
        const res = await Admin.updateUserDetails(adminManageUserId, { username, display_name, email });
        btn.disabled = false;
        btn.textContent = 'Save Changes';
        if (res.ok) {
            toast('User details updated', 'success');
            await loadAdmin();
            // Refresh subtitle with new values
            const updated = adminUsers.find(u => u.id === adminManageUserId);
            if (updated) {
                adminManageUserData = updated;
                document.getElementById('admin-manage-subtitle').textContent = `@${updated.username} · ${updated.email}`;
            }
        } else {
            toast(res.data.error || 'Failed to update details', 'error');
        }
    });
}

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

    // Load recent profile viewers
    loadProfilePageViewers(u.id);

    // Render 2FA tab state
    render2FATab();

    // Fill edit form
    document.getElementById('edit-displayname').value = u.display_name;

    // Social links editor
    renderSocialLinksEditor(socials);
}

async function loadProfilePageViewers(profileId) {
    const wrap = document.getElementById('profile-viewers-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    const res = await ProfileViews.getViewers(profileId);
    if (!res.ok || !res.data.viewers?.length) return;

    const viewers = res.data.viewers;
    wrap.innerHTML = `
        <div class="profile-viewers">
            <div class="profile-viewers-label">Recent viewers</div>
            <div class="profile-viewers-pills">
              ${viewers.map(v => {
                const vLetter = (v.display_name || v.username || '?')[0].toUpperCase();
                const vAvatar = v.avatar_url
                    ? `<img src="${v.avatar_url}" class="viewer-pill-avatar" alt="${vLetter}">`
                    : `<span class="viewer-pill-avatar viewer-pill-avatar-ph">${vLetter}</span>`;
                return `<button class="viewer-pill" onclick="viewUserProfileById('${v.id}')" title="@${v.username}">${vAvatar}<span>${v.display_name || v.username}</span></button>`;
              }).join('')}
            </div>
        </div>`;
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

    // Log out all devices
    window.startLogoutAll = () => openModal('modal-logout-all');
    window.confirmLogoutAll = async () => {
        const btn = document.getElementById('logout-all-confirm-btn');
        btn.disabled = true;
        btn.textContent = 'Signing out…';
        const res = await Auth.logoutAll();
        btn.disabled = false;
        btn.textContent = 'Log Out All Devices';
        closeModal('modal-logout-all');
        if (res.ok) {
            toast('All other devices have been signed out.', 'success');
        } else {
            toast(res.data.error || 'Failed to sign out other devices', 'error');
        }
    };
}

// ===== PROFILE 2FA TAB =====
let _totpSetupSecret = null;

function render2FATab() {
    const u = state.user;
    const enabled = u?.totp_enabled;
    document.getElementById('totp-enabled-view').style.display = enabled ? 'block' : 'none';
    document.getElementById('totp-disabled-view').style.display = enabled ? 'none' : 'block';
    document.getElementById('totp-setup-step1').style.display = 'none';
    document.getElementById('totp-setup-step2').style.display = 'none';
}

window.startEnable2FA = async () => {
    document.getElementById('totp-disabled-view').style.display = 'none';
    document.getElementById('totp-setup-step1').style.display = 'block';

    const qrImg = document.getElementById('totp-qr-img');
    const spinner = document.getElementById('totp-qr-spinner');
    const keyEl = document.getElementById('totp-manual-key');
    const nextBtn = document.getElementById('totp-next-btn');

    qrImg.style.display = 'none';
    spinner.style.display = 'flex';
    nextBtn.disabled = true;
    keyEl.textContent = '';
    _totpSetupSecret = null;

    const res = await Totp.setup();
    spinner.style.display = 'none';

    if (res.ok) {
        _totpSetupSecret = res.data.secret;
        qrImg.src = res.data.qr_data_url;
        qrImg.style.display = 'block';
        keyEl.textContent = res.data.secret;
        nextBtn.disabled = false;
    } else {
        toast(res.data.error || 'Failed to generate 2FA setup', 'error');
        cancelEnable2FA();
    }
};

window.cancelEnable2FA = () => {
    _totpSetupSecret = null;
    render2FATab();
};

window.show2FAStep1 = () => {
    document.getElementById('totp-setup-step2').style.display = 'none';
    document.getElementById('totp-setup-step1').style.display = 'block';
};

window.show2FAStep2 = () => {
    if (!_totpSetupSecret) return;
    document.getElementById('totp-setup-step1').style.display = 'none';
    document.getElementById('totp-setup-step2').style.display = 'block';
    document.getElementById('totp-verify-code').value = '';
    document.getElementById('totp-enable-error').style.display = 'none';
    setTimeout(() => document.getElementById('totp-verify-code').focus(), 50);
};

window.confirmEnable2FA = async () => {
    const code = document.getElementById('totp-verify-code').value.trim();
    const errEl = document.getElementById('totp-enable-error');
    const btn = document.getElementById('totp-enable-btn');

    if (!code || code.length !== 6) {
        errEl.textContent = 'Please enter the 6-digit code';
        errEl.style.display = 'flex';
        return;
    }

    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Enabling…';

    const res = await Totp.enable(_totpSetupSecret, code);

    btn.disabled = false;
    btn.textContent = 'Enable 2FA';

    if (res.ok) {
        state.user.totp_enabled = true;
        _totpSetupSecret = null;
        toast('2FA enabled successfully!', 'success');
        render2FATab();
    } else {
        errEl.textContent = res.data.error || 'Failed to enable 2FA';
        errEl.style.display = 'flex';
    }
};

window.copyTotpKey = () => {
    const key = document.getElementById('totp-manual-key').textContent;
    if (!key) return;
    navigator.clipboard.writeText(key).then(() => toast('Key copied!', 'success')).catch(() => {});
};

window.startDisable2FA = () => {
    document.getElementById('disable-2fa-password').value = '';
    document.getElementById('disable-2fa-error').style.display = 'none';
    openModal('modal-disable-2fa');
};

function setupDisable2FAModal() {
    document.getElementById('disable-2fa-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('disable-2fa-password').value;
        const errEl = document.getElementById('disable-2fa-error');
        const btn = document.getElementById('disable-2fa-btn');

        errEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Disabling…';

        const res = await Totp.disable(password);

        btn.disabled = false;
        btn.textContent = 'Disable 2FA';

        if (res.ok) {
            state.user.totp_enabled = false;
            closeModal('modal-disable-2fa');
            toast('2FA has been disabled.', 'success');
            render2FATab();
        } else {
            errEl.textContent = res.data.error || 'Failed to disable 2FA';
            errEl.style.display = 'flex';
        }
    });
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
            navigate('home');
        } else {
            toast(res.data.error || 'Failed to delete account', 'error');
            btn.disabled = false;
            btn.textContent = 'Permanently Delete Account';
        }
    });
}

// ===== HOME PAGE =====
function initHomePage() {
    startTypingAnimation();
    loadHomeStats();
}

function startTypingAnimation() {
    // Clear any existing animation
    if (homeTypingInterval) {
        clearInterval(homeTypingInterval);
        homeTypingInterval = null;
    }

    const slugs = ['we-care', 'takagi', 'join', 'apac', 'telegram', 'discord', 'linkedin', 'youtube', 'policy', 'hello', 'furst'];
    const el = document.getElementById('home-typing-slug');
    if (!el) return;

    let slugIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let pauseCounter = 0;

    function tick() {
        const currentSlug = slugs[slugIndex];

        if (pauseCounter > 0) {
            pauseCounter--;
            return;
        }

        if (!isDeleting) {
            // Typing
            charIndex++;
            el.textContent = currentSlug.slice(0, charIndex);
            if (charIndex === currentSlug.length) {
                isDeleting = true;
                pauseCounter = 20; // Pause before deleting (~1.4s at 70ms interval)
            }
        } else {
            // Deleting
            charIndex--;
            el.textContent = currentSlug.slice(0, charIndex);
            if (charIndex === 0) {
                isDeleting = false;
                slugIndex = (slugIndex + 1) % slugs.length;
                pauseCounter = 5; // Brief pause before next word
            }
        }
    }

    homeTypingInterval = setInterval(tick, 70);
}

async function loadHomeStats() {
    const res = await Stats.get();
    if (!res.ok) return;

    const { officers, links, clicks } = res.data;

    animateCounter('home-stat-officers', officers);
    animateCounter('home-stat-links', links);
    animateCounter('home-stat-clicks', clicks);
}

function animateCounter(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (target === 0) {
        el.textContent = '0';
        return;
    }

    const duration = 1200;
    const steps = 40;
    const stepTime = duration / steps;
    let current = 0;
    const increment = target / steps;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        el.textContent = Math.round(current).toLocaleString();
    }, stepTime);
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

// ===== QR CODE MODAL =====
async function createQrCompositeImage(url) {
    const qrSize = 280;
    const paddingX = 24;
    const paddingTop = 24;
    const paddingGap = 14;
    const paddingBottom = 20;
    const fontSize = 13;
    const lineHeight = Math.ceil(fontSize * 1.5);

    // Measure and word-wrap the URL on a temp canvas
    const measureCanvas = document.createElement('canvas');
    const mCtx = measureCanvas.getContext('2d');
    mCtx.font = `bold ${fontSize}px 'Courier New', monospace`;
    const maxTextWidth = qrSize;
    const lines = [];
    let currentLine = '';
    for (const char of url) {
        const testLine = currentLine + char;
        if (mCtx.measureText(testLine).width > maxTextWidth) {
            lines.push(currentLine);
            currentLine = char;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);

    const textBlockHeight = lines.length * lineHeight;
    const totalWidth = qrSize + paddingX * 2;
    const totalHeight = paddingTop + qrSize + paddingGap + textBlockHeight + paddingBottom;

    // Generate QR code using QRious (exposes window.QRious)
    if (!window.QRious) throw new Error('QRious library not loaded');
    const qrCanvas = document.createElement('canvas');
    new window.QRious({
        element: qrCanvas,
        value: url,
        size: qrSize,
        background: '#ffffff',
        foreground: '#000000',
        level: 'H'
    });

    // Build composite canvas
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    canvas.style.maxWidth = '100%';
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    ctx.drawImage(qrCanvas, paddingX, paddingTop, qrSize, qrSize);

    ctx.fillStyle = '#111111';
    ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    const textStartY = paddingTop + qrSize + paddingGap + fontSize;
    lines.forEach((line, i) => {
        ctx.fillText(line, totalWidth / 2, textStartY + i * lineHeight);
    });

    return canvas;
}

window.openQrModal = async (slug) => {
    const url = `https://gftv.asia/${slug}`;
    document.getElementById('qr-modal-subtitle').textContent = url;
    const container = document.getElementById('qr-canvas-container');
    container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
    openModal('modal-qr');

    try {
        const compositeCanvas = await createQrCompositeImage(url);
        container.innerHTML = '';
        container.appendChild(compositeCanvas);
        window._qrCanvas = compositeCanvas;
        window._qrUrl = url;
        window._qrSlug = slug;
    } catch {
        container.innerHTML = '<p style="color:var(--danger);padding:20px;">Failed to generate QR code.</p>';
    }
};

window.downloadQrCode = () => {
    const canvas = window._qrCanvas;
    if (!canvas) return;
    canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `qr-${window._qrSlug || 'code'}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/png');
};

window.copyQrCode = async () => {
    const canvas = window._qrCanvas;
    if (!canvas) return;
    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('QR code copied!', 'success');
    } catch {
        toast('Failed to copy image', 'error');
    }
};

window.shareQrCode = async () => {
    const canvas = window._qrCanvas;
    const url = window._qrUrl;
    const slug = window._qrSlug;
    if (!canvas) return;
    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], `qr-${slug || 'code'}.png`, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ text: url, files: [file] });
        } else if (navigator.share) {
            await navigator.share({ text: url });
        } else {
            toast('Sharing is not supported on this browser', 'info');
        }
    } catch (e) {
        if (e.name !== 'AbortError') toast('Failed to share', 'error');
    }
};

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
    setupAdminManageLinkModal();
    setupProfilePage();
    setupDisable2FAModal();
    setupAdminModal();
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