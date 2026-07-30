import {
    Auth,
    Totp,
    Links,
    Ownership,
    Admin,
    Profile,
    ProfileViews,
    TrustedDevices,
    ApiKeys,
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
const COLOR_THEME_KEY = 'gftv-gftvlinks.colorTheme';
const MODE_KEY = 'gftv-gftvlinks.mode';
const DEFAULT_COLOR_THEME = 'classic';
const DEFAULT_MODE = 'light';

let state = {
    user: null,
    token: localStorage.getItem('gftv_token') || null,
    colorTheme: DEFAULT_COLOR_THEME,
    mode: DEFAULT_MODE,
    currentPage: 'home',
};

let homeTypingInterval = null;

// ===== THEME =====
const COLOR_THEMES = [
    { id: 'classic', label: 'Classic', color: '#ffffff' },
    { id: 'hellotheme', label: 'HelloTheme', color: '#fedc00' },
];

function isValidColorTheme(id) {
    return COLOR_THEMES.some(t => t.id === id);
}

function updateThemeColorMeta() {
    const meta = document.querySelector('meta[name="theme-color"]');
    const theme = COLOR_THEMES.find(t => t.id === state.colorTheme);
    if (meta) meta.setAttribute('content', theme?.color || '#ffffff');
}

function applyColorTheme(id) {
    if (!isValidColorTheme(id)) id = DEFAULT_COLOR_THEME;
    state.colorTheme = id;
    localStorage.setItem(COLOR_THEME_KEY, id);
    document.documentElement.setAttribute('data-color-theme', id);
    updateThemeColorMeta();
}

function applyMode(mode) {
    if (mode !== 'light' && mode !== 'dark') mode = DEFAULT_MODE;
    state.mode = mode;
    localStorage.setItem(MODE_KEY, mode);
    document.documentElement.setAttribute('data-mode', mode);
    updateThemeButtonIcon();
    updateModeOptions();
}

function updateThemeButtonIcon() {
    const btn = document.getElementById('theme-picker-btn');
    if (btn) btn.innerHTML = icon(state.mode === 'dark' ? 'moon' : 'sun', 18);
}

// Migrate the old single-key theme value, then drop it, so nobody loses their pick
function migrateLegacyTheme() {
    const legacy = localStorage.getItem('gftv_theme');
    if (legacy === null) return;
    const migrated = isValidColorTheme(legacy) ? legacy : DEFAULT_COLOR_THEME;
    if (!localStorage.getItem(COLOR_THEME_KEY)) localStorage.setItem(COLOR_THEME_KEY, migrated);
    if (!localStorage.getItem(MODE_KEY)) localStorage.setItem(MODE_KEY, DEFAULT_MODE);
    localStorage.removeItem('gftv_theme');
}

function initTheme() {
    migrateLegacyTheme();
    const savedColorTheme = localStorage.getItem(COLOR_THEME_KEY);
    const savedMode = localStorage.getItem(MODE_KEY);
    applyColorTheme(isValidColorTheme(savedColorTheme) ? savedColorTheme : DEFAULT_COLOR_THEME);
    applyMode(savedMode === 'dark' ? 'dark' : DEFAULT_MODE);
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
    const publicPages = ['home', 'login', 'register', 'pending', 'preapproved'];
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

    // Editor-only pages (editors + admins only)
    const editorPages = ['dashboard', 'ownership', 'apiintegration'];
    if (state.user && !isEditor() && editorPages.includes(page)) {
        showPage('directory');
        return;
    }

    showPage(page);

    // Load data for pages
    if (page === 'home') initHomePage();
    if (page === 'directory') loadDirectory();
    if (page === 'dashboard') loadDashboard();
    if (page === 'ownership') loadOwnershipRequests();
    if (page === 'admin') loadAdmin();
    if (page === 'profile') renderProfile();
    if (page === 'preapproved') renderPreapprovedPage();
    if (page === 'apiintegration') loadApiIntegration();
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
            { id: 'apiintegration', icon: icon('api'), label: 'API' },
        ] : []),
        ...(state.user.is_admin ? [{ id: 'admin', icon: icon('settings'), label: 'Admin' }] : []),
        { id: 'profile', icon: icon('user'), label: 'Profile' },
    ] : [];

    const renderLinks = (container) => {
        if (!state.user) {
            container.innerHTML = `
        <button class="nav-btn-outline" onclick="window.open('https://gftv.asia/user-support','_blank')">Send us feedback</button>
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
    navigator.serviceWorker?.controller?.postMessage('CLEAR_API_CACHE');
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

    // Allow Enter key in TOTP modal code inputs to submit
    document.getElementById('totp-login-code')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); window.submitTotpLogin(); }
    });
    document.getElementById('totp-login-backup-code')?.addEventListener('keydown', (e) => {
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
    // Reset to TOTP view for next open
    document.getElementById('totp-login-totp-section').style.display = 'block';
    document.getElementById('totp-login-backup-section').style.display = 'none';
    closeModal('modal-totp-login');
};

window.switchToBackupLogin = () => {
    document.getElementById('totp-login-totp-section').style.display = 'none';
    document.getElementById('totp-login-backup-section').style.display = 'block';
    document.getElementById('totp-login-error').style.display = 'none';
    document.getElementById('totp-login-backup-code').value = '';
    setTimeout(() => document.getElementById('totp-login-backup-code').focus(), 50);
};

window.switchToTotpLogin = () => {
    document.getElementById('totp-login-backup-section').style.display = 'none';
    document.getElementById('totp-login-totp-section').style.display = 'block';
    document.getElementById('totp-login-error').style.display = 'none';
    document.getElementById('totp-login-code').value = '';
    setTimeout(() => document.getElementById('totp-login-code').focus(), 50);
};

window.submitTotpLogin = async () => {
    const trust = document.getElementById('totp-trust-device').checked;
    const errEl = document.getElementById('totp-login-error');
    const btn = document.getElementById('totp-login-btn');
    const isBackupMode = document.getElementById('totp-login-backup-section').style.display !== 'none';

    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Verifying…';

    let res;
    if (isBackupMode) {
        const backupCode = document.getElementById('totp-login-backup-code').value.trim();
        if (!backupCode) {
            errEl.textContent = 'Please enter a backup code';
            errEl.style.display = 'flex';
            btn.disabled = false;
            btn.textContent = 'Verify';
            return;
        }
        res = await Totp.verifyBackup(_totpChallengeToken, backupCode, trust);
    } else {
        const code = document.getElementById('totp-login-code').value.trim();
        if (!code || code.length !== 6) {
            errEl.textContent = 'Please enter the 6-digit code';
            errEl.style.display = 'flex';
            btn.disabled = false;
            btn.textContent = 'Verify';
            return;
        }
        res = await Totp.verify(_totpChallengeToken, code, trust);
    }

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
                if (res.data.preapproved) {
                    // Auto-login and show congratulations screen
                    state.token = res.data.token;
                    state.user = res.data.user;
                    state.preapprovedRole = res.data.preapproved_role;
                    localStorage.setItem('gftv_token', res.data.token);
                    updateNav();
                    showPage('preapproved');
                    renderPreapprovedPage();
                    toast('Account created! You\'ve been pre-approved.', 'success');
                } else {
                    toast('Account created! Waiting for admin approval.', 'success');
                    navigate('pending');
                }
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
let dirFilterKeyword = '';
let dirFilterTag = '';
let dirFilterStatus = 'all';
let dirSortOrder = 'date';

function getFilteredSortedDirectoryLinks() {
    let links = directoryData.filter(link => {
        if (dirFilterKeyword) {
            const kw = dirFilterKeyword.toLowerCase();
            const user = link.gftvhello_users || {};
            if (!link.slug.toLowerCase().includes(kw) &&
                !link.destination.toLowerCase().includes(kw) &&
                !(user.display_name || '').toLowerCase().includes(kw) &&
                !(user.username || '').toLowerCase().includes(kw)) return false;
        }
        if (dirFilterTag) {
            const tag = dirFilterTag.toLowerCase();
            if (!link.tags || !link.tags.some(t => t.toLowerCase().includes(tag))) return false;
        }
        if (dirFilterStatus === 'active' && !link.is_active) return false;
        if (dirFilterStatus === 'inactive' && link.is_active) return false;
        return true;
    });

    if (dirSortOrder === 'visits') {
        links.sort((a, b) => (b.access_count ?? 0) - (a.access_count ?? 0));
    } else {
        links.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return links;
}

async function loadDirectory() {
    const container = document.getElementById('directory-table-wrap');
    container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

    const res = await Links.list('', 'keyword');
    if (!res.ok) {
        container.innerHTML = '<p style="color:var(--danger);padding:20px">Failed to load links.</p>';
        return;
    }

    directoryData = res.data.links || [];
    renderDirectoryTable();
}

function renderDirectoryTable() {
    const container = document.getElementById('directory-table-wrap');

    if (directoryData.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('link', 32)}</div><h3>No links found</h3><p>No links have been created yet.</p></div>`;
        return;
    }

    const data = getFilteredSortedDirectoryLinks();

    if (data.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('link', 32)}</div><h3>No links match</h3><p>Try adjusting your search or filters.</p></div>`;
        return;
    }

    const rows = data.map(link => {
        const user = link.gftvhello_users || {};
        const isOwner = state.user && link.gftvhello_users?.id === state.user.id;
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
    const keywordInput = document.getElementById('dir-search-keyword');
    const tagInput = document.getElementById('dir-search-tag');
    const statusSelect = document.getElementById('dir-filter-status');
    const sortSelect = document.getElementById('dir-sort');

    let debounceTimer;
    keywordInput.addEventListener('input', () => {
        dirFilterKeyword = keywordInput.value.trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderDirectoryTable, 200);
    });
    tagInput.addEventListener('input', () => {
        dirFilterTag = tagInput.value.trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderDirectoryTable, 200);
    });
    statusSelect.addEventListener('change', () => {
        dirFilterStatus = statusSelect.value;
        renderDirectoryTable();
    });
    sortSelect.addEventListener('change', () => {
        dirSortOrder = sortSelect.value;
        renderDirectoryTable();
    });
}

function buildProfileModalHtml(user, userLinks, viewers) {
    const totalViews = userLinks.reduce((a, l) => a + (l.access_count || 0), 0);
    const letter = (user.display_name || user.username || '?')[0].toUpperCase();
    const avHtml = user.avatar_url
        ? `<img src="${user.avatar_url}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;margin-bottom:10px;" alt="${letter}">`
        : `<div style="width:72px;height:72px;border-radius:50%;background:var(--brand);color:var(--brand-text);font-size:1.8rem;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">${letter}</div>`;

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
    const user = directoryData.map(l => l.gftvhello_users).find(u => u?.id === userId);
    if (!user) return;

    const userLinks = directoryData.filter(l => l.gftvhello_users?.id === userId);

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
    const fromDir = directoryData.map(l => l.gftvhello_users).find(u => u?.id === userId);
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
let dashFilterKeyword = '';
let dashFilterTag = '';
let dashFilterStatus = 'all';
let dashSortOrder = 'date';

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

function getFilteredSortedLinks() {
    let links = dashboardLinks.filter(link => {
        if (dashFilterKeyword) {
            const kw = dashFilterKeyword.toLowerCase();
            if (!link.slug.toLowerCase().includes(kw) && !link.destination.toLowerCase().includes(kw)) return false;
        }
        if (dashFilterTag) {
            const tag = dashFilterTag.toLowerCase();
            if (!link.tags || !link.tags.some(t => t.toLowerCase().includes(tag))) return false;
        }
        if (dashFilterStatus === 'active' && !link.is_active) return false;
        if (dashFilterStatus === 'inactive' && link.is_active) return false;
        return true;
    });
    if (dashSortOrder === 'visits') {
        links.sort((a, b) => (b.access_count ?? 0) - (a.access_count ?? 0));
    } else {
        links.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return links;
}

function renderDashboardTable() {
    const container = document.getElementById('dashboard-links-wrap');
    if (dashboardLinks.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('link', 32)}</div><h3>No links yet</h3><p>Create your first short link!</p></div>`;
        return;
    }

    const filtered = getFilteredSortedLinks();

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('link', 32)}</div><h3>No links match</h3><p>Try adjusting your search or filters.</p></div>`;
        return;
    }

    const rows = filtered.map(link => `
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
          <button class="btn btn-sm btn-secondary" onclick="openAnalyticsModal('${link.id}')" title="View analytics">${icon('bar-chart')}</button>
          <button class="btn btn-sm btn-secondary" onclick="openEditLink('${link.id}')" title="Edit link">${icon('edit')}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteLink('${link.id}')" title="Delete link">${icon('trash')}</button>
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

window.downloadLinksCSV = () => {
    if (dashboardLinks.length === 0) {
        toast('No links to download', 'error');
        return;
    }
    const links = getFilteredSortedLinks();
    if (links.length === 0) {
        toast('No links match the current filters', 'error');
        return;
    }
    const headers = ['Short URL', 'Original URL', 'Status', 'Tags', 'Visits', 'Created At', 'Last Modified'];
    const csvEscape = val => {
        const s = String(val ?? '');
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = links.map(link => [
        `https://gftv.asia/${link.slug}`,
        link.destination,
        link.is_active ? 'Active' : 'Inactive',
        (link.tags || []).join('; '),
        link.access_count ?? 0,
        link.created_at,
        link.updated_at
    ].map(csvEscape).join(','));
    const csv = [headers.map(csvEscape).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-links.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Downloaded ${links.length} link${links.length !== 1 ? 's' : ''} as CSV`, 'success');
};

function setupDashboardPage() {
    const keywordInput = document.getElementById('dash-search-keyword');
    const tagInput = document.getElementById('dash-search-tag');
    const statusSelect = document.getElementById('dash-filter-status');
    const sortSelect = document.getElementById('dash-sort');

    let debounceTimer;
    keywordInput.addEventListener('input', () => {
        dashFilterKeyword = keywordInput.value.trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderDashboardTable, 200);
    });
    tagInput.addEventListener('input', () => {
        dashFilterTag = tagInput.value.trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderDashboardTable, 200);
    });
    statusSelect.addEventListener('change', () => {
        dashFilterStatus = statusSelect.value;
        renderDashboardTable();
    });
    sortSelect.addEventListener('change', () => {
        dashSortOrder = sortSelect.value;
        renderDashboardTable();
    });
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

// ===== API INTEGRATION PAGE =====
let _apiKeyValue = null; // holds the plaintext key only immediately after generation

async function loadApiIntegration() {
    _apiKeyValue = null;
    const display = document.getElementById('api-key-display');
    const status = document.getElementById('api-key-status');
    const copyBtn = document.getElementById('api-key-copy-btn');
    const toggleBtn = document.getElementById('api-key-toggle-btn');
    if (!display) return;

    display.type = 'password';
    display.value = '';
    display.placeholder = '••••••••••••••••••••';
    if (status) status.textContent = 'Checking for existing API key…';
    if (copyBtn) copyBtn.disabled = true;
    if (toggleBtn) toggleBtn.disabled = true;

    const res = await ApiKeys.get();
    if (res.ok && res.data.api_key) {
        // Key exists — show masked placeholder, don't reveal it
        display.value = res.data.api_key;
        display.type = 'password';
        if (status) {
            const updated = res.data.updated_at ? ` Last regenerated: ${fmtDate(res.data.updated_at)}.` : '';
            status.textContent = `You have an active API key.${updated} Regenerate to get a new one (your old key will stop working immediately).`;
        }
        if (copyBtn) copyBtn.disabled = false;
        if (toggleBtn) toggleBtn.disabled = false;
    } else {
        display.value = '';
        display.placeholder = 'No API key yet — click Regenerate to create one';
        if (status) status.textContent = 'No API key generated yet.';
        if (copyBtn) copyBtn.disabled = true;
        if (toggleBtn) toggleBtn.disabled = true;
    }
}

window.toggleApiKeyVisibility = () => {
    const display = document.getElementById('api-key-display');
    const toggleBtn = document.getElementById('api-key-toggle-btn');
    if (!display) return;
    const isHidden = display.type === 'password';
    display.type = isHidden ? 'text' : 'password';
    if (toggleBtn) {
        toggleBtn.innerHTML = isHidden
            ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg> Hide`
            : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> Show`;
    }
};

window.copyApiKey = async () => {
    const display = document.getElementById('api-key-display');
    if (!display || !display.value) return;
    try {
        await navigator.clipboard.writeText(display.value);
        toast('API key copied to clipboard', 'success');
    } catch {
        toast('Failed to copy — please copy manually', 'error');
    }
};

window.regenerateApiKey = async () => {
    const btn = document.getElementById('api-key-regen-btn');
    const display = document.getElementById('api-key-display');
    const status = document.getElementById('api-key-status');
    const copyBtn = document.getElementById('api-key-copy-btn');
    const toggleBtn = document.getElementById('api-key-toggle-btn');

    const hasExisting = display && display.value;
    if (hasExisting && !confirm('Regenerating your API key will immediately invalidate your current key. Any integrations using the old key will stop working. Continue?')) return;

    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }

    const res = await ApiKeys.regenerate();
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg> Regenerate`;
    }

    if (res.ok && res.data.api_key) {
        _apiKeyValue = res.data.api_key;
        if (display) {
            display.value = _apiKeyValue;
            display.type = 'text'; // show it immediately after generation
        }
        if (toggleBtn) {
            toggleBtn.disabled = false;
            toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg> Hide`;
        }
        if (copyBtn) copyBtn.disabled = false;
        if (status) status.textContent = 'Your new API key is shown above. Copy it now — it will be hidden once you leave this page.';
        toast('API key regenerated successfully', 'success');
    } else {
        toast(res.data?.error || 'Failed to regenerate API key', 'error');
    }
};

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
    const preapprovedContainer = document.getElementById('admin-preapproved-wrap');
    container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
    preapprovedContainer.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

    const [res, preapprovedRes] = await Promise.all([Admin.users(), Admin.preapproved()]);
    if (!res.ok) {
        container.innerHTML = '<p style="color:var(--danger);padding:20px">Access denied.</p>';
        preapprovedContainer.innerHTML = '';
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

    // Render pre-approved section
    const preapprovedList = preapprovedRes.ok ? (preapprovedRes.data.preapproved || []) : [];
    renderPreapprovedSection(preapprovedList);
}

function renderPreapprovedSection(list) {
    const container = document.getElementById('admin-preapproved-wrap');
    const pending = list.filter(e => !e.user_id);
    const activated = list.filter(e => e.user_id);

    function preapprovedRow(e) {
        const roleBadge = e.preapproved_role === 'editor'
            ? '<span class="badge badge-editor">Editor</span>'
            : '<span class="badge badge-viewer">Viewer</span>';
        const statusBadge = e.activated_at
            ? '<span class="badge badge-active">Activated</span>'
            : '<span class="badge badge-pending">Waiting</span>';
        return `<tr>
      <td style="word-break:break-all">
        <span style="font-size:0.85rem">${e.email}</span>
        <button class="btn-copy-inline" data-copy="${e.email}" onclick="copyInline(this)" title="Copy email">${icon('copy')}</button>
      </td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td>${fmtDate(e.preapproved_at)}</td>
      <td>${e.activated_at ? fmtDate(e.activated_at) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>
        <div class="action-btns">
          ${!e.activated_at ? `<button class="btn btn-sm btn-danger" onclick="removePreapproved('${e.id}')">${icon('x-circle')} Remove</button>` : ''}
        </div>
      </td>
    </tr>`;
    }

    container.innerHTML = `
    <h3 class="section-title"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> Pre-approved Users (${list.length})</h3>
    ${list.length > 0
      ? `<div class="table-wrap glass"><table>
          <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Pre-approved</th><th>Activated</th><th>Actions</th></tr></thead>
          <tbody>${list.map(preapprovedRow).join('')}</tbody>
        </table></div>`
      : `<div class="empty-state" style="padding:24px"><p>No pre-approved users yet. Use the <strong>Pre-approve User</strong> button to add one.</p></div>`
    }
  `;
}

window.removePreapproved = async (id) => {
    if (!confirm('Remove this pre-approval? The user will need manual approval if they register.')) return;
    const res = await Admin.deletePreapproved(id);
    if (res.ok) {
        toast('Pre-approval removed', 'success');
        await loadAdmin();
    } else {
        toast(res.data.error || 'Failed to remove pre-approval', 'error');
    }
};

function setupAddPreapprovedModal() {
    const form = document.getElementById('add-preapproved-form');
    const errEl = document.getElementById('add-preapproved-error');
    const btn = document.getElementById('add-preapproved-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errEl.style.display = 'none';

        const email = document.getElementById('preapproved-email').value.trim();
        const role = document.getElementById('preapproved-role').value;

        if (!email) {
            errEl.textContent = 'Please enter an email address';
            errEl.style.display = 'flex';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Adding…';

        try {
            const res = await Admin.addPreapproved(email, role);
            if (res.ok) {
                toast('User pre-approved successfully', 'success');
                closeModal('modal-add-preapproved');
                form.reset();
                await loadAdmin();
            } else {
                errEl.textContent = res.data.error || 'Failed to add pre-approved user';
                errEl.style.display = 'flex';
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Pre-approve User';
        }
    });
}

function renderPreapprovedPage() {
    const role = state.preapprovedRole || 'viewer';
    const roleLabel = role === 'editor' ? 'Editor' : 'Viewer';
    const targetPage = role === 'editor' ? 'dashboard' : 'directory';
    const btnLabel = role === 'editor' ? 'Go to Dashboard →' : 'Browse the Directory →';

    const roleEl = document.getElementById('preapproved-role-text');
    const btn = document.getElementById('preapproved-cta-btn');
    if (roleEl) roleEl.textContent = `Congratulations, you have been pre-approved with ${roleLabel} access!`;
    if (btn) {
        btn.textContent = btnLabel;
        btn.onclick = () => navigate(targetPage);
    }
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
            localStorage.removeItem('gftv_token');
            state.user = null;
            state.token = null;
            closeAllModals();
            navigate('home');
            toast('Logged out of all devices.', 'success');
        } else {
            toast(res.data.error || 'Failed to sign out all devices', 'error');
        }
    };
}

// ===== TRUSTED DEVICES =====
async function loadTrustedDevices() {
    const container = document.getElementById('trusted-devices-list');
    if (!container) return;
    container.innerHTML = '<div style="color:var(--text-muted);font-size:0.88rem;">Loading…</div>';

    const res = await TrustedDevices.list();
    if (!res.ok) {
        container.innerHTML = '<div style="color:var(--danger);font-size:0.88rem;">Failed to load devices.</div>';
        return;
    }

    const devices = res.data.devices || [];
    if (devices.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);font-size:0.88rem;padding:8px 0;">No trusted devices found.</div>';
        return;
    }

    container.innerHTML = devices.map(d => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
            <div>
                <div style="font-size:0.9rem;font-weight:500;">Trusted on ${fmtDate(d.created_at)}</div>
                <div style="font-size:0.82rem;color:var(--text-muted);">Expires ${fmtDate(d.expires_at)}</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="removeTrustedDevice('${d.id}')">Remove</button>
        </div>
    `).join('');
}

window.loadTrustedDevices = loadTrustedDevices;

window.removeTrustedDevice = async (id) => {
    const res = await TrustedDevices.remove(id);
    if (res.ok) {
        toast('Device removed', 'success');
        loadTrustedDevices();
    } else {
        toast(res.data.error || 'Failed to remove device', 'error');
    }
};

// ===== PROFILE 2FA TAB =====
let _totpSetupSecret = null;
let _backupCodes = null; // plaintext codes shown after enable/regenerate

function render2FATab() {
    const u = state.user;
    const enabled = u?.totp_enabled;
    document.getElementById('totp-enabled-view').style.display = enabled ? 'block' : 'none';
    document.getElementById('totp-disabled-view').style.display = enabled ? 'none' : 'block';
    document.getElementById('totp-setup-step1').style.display = 'none';
    document.getElementById('totp-setup-step2').style.display = 'none';
    document.getElementById('totp-setup-step3').style.display = 'none';
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
        _backupCodes = res.data.backup_codes || [];
        // Show step 3: backup codes
        document.getElementById('totp-setup-step2').style.display = 'none';
        document.getElementById('totp-setup-step3').style.display = 'block';
        renderBackupCodesGrid('backup-codes-grid', _backupCodes);
    } else {
        errEl.textContent = res.data.error || 'Failed to enable 2FA';
        errEl.style.display = 'flex';
    }
};

function renderBackupCodesGrid(gridId, codes) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = codes.map(c =>
        `<div class="backup-code-item"><code>${c}</code></div>`
    ).join('');
}

window.copyBackupCodes = () => {
    const text = _backupCodes?.join('\n') || '';
    navigator.clipboard.writeText(text).then(() => toast('Backup codes copied!', 'success')).catch(() => {});
};

window.downloadBackupCodes = () => {
    const text = (_backupCodes || []).join('\n');
    const blob = new Blob([`GFTV Links Portal — 2FA Backup Codes\nGenerated: ${new Date().toUTCString()}\n\n${text}\n\nEach code can only be used once. Keep these safe.`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gftvlinks-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
};

window.finishEnable2FA = () => {
    _backupCodes = null;
    render2FATab();
    toast('2FA enabled successfully!', 'success');
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

// ===== REGENERATE BACKUP CODES =====
let _modalBackupCodes = null;

window.startRegenBackupCodes = () => {
    document.getElementById('regen-backup-password').value = '';
    document.getElementById('regen-backup-error').style.display = 'none';
    openModal('modal-regen-backup-codes');
};

function setupRegenBackupCodesModal() {
    document.getElementById('regen-backup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('regen-backup-password').value;
        const errEl = document.getElementById('regen-backup-error');
        const btn = document.getElementById('regen-backup-btn');

        errEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Generating…';

        const res = await Totp.regenerateCodes(password);

        btn.disabled = false;
        btn.textContent = 'Generate New Codes';

        if (res.ok) {
            _modalBackupCodes = res.data.backup_codes || [];
            closeModal('modal-regen-backup-codes');
            renderBackupCodesGrid('modal-backup-codes-grid', _modalBackupCodes);
            openModal('modal-backup-codes-display');
        } else {
            errEl.textContent = res.data.error || 'Failed to regenerate backup codes';
            errEl.style.display = 'flex';
        }
    });
}

window.copyModalBackupCodes = () => {
    const text = _modalBackupCodes?.join('\n') || '';
    navigator.clipboard.writeText(text).then(() => toast('Backup codes copied!', 'success')).catch(() => {});
};

window.downloadModalBackupCodes = () => {
    const text = (_modalBackupCodes || []).join('\n');
    const blob = new Blob([`GFTV Links Portal — 2FA Backup Codes\nGenerated: ${new Date().toUTCString()}\n\n${text}\n\nEach code can only be used once. Keep these safe.`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gftvlinks-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
};

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
function renderThemeGrid() {
    const grid = document.getElementById('theme-grid');
    if (!grid) return;
    grid.innerHTML = COLOR_THEMES.map(t => `
    <button type="button" class="appearance-option theme-swatch ${state.colorTheme === t.id ? 'active' : ''}"
      data-theme-id="${t.id}">
      <span class="theme-swatch-dot" style="background:${t.color};"></span>
      <span class="theme-swatch-name">${t.label}</span>
      <span class="theme-swatch-hex">${t.color}</span>
    </button>
  `).join('');
}

function updateModeOptions() {
    document.querySelectorAll('[data-mode-option]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.modeOption === state.mode);
    });
}

function setupThemePicker() {
    renderThemeGrid();

    const grid = document.getElementById('theme-grid');
    grid?.addEventListener('click', (e) => {
        const swatch = e.target.closest('.theme-swatch');
        if (!swatch) return;
        const id = swatch.dataset.themeId;
        applyColorTheme(id);
        document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const theme = COLOR_THEMES.find(t => t.id === id);
        toast(`Theme changed to ${theme.label}`, 'success');
    });

    document.getElementById('mode-options')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-mode-option]');
        if (!btn) return;
        const mode = btn.dataset.modeOption;
        if (mode === state.mode) return;
        applyMode(mode);
        toast(`Switched to ${mode} mode`, 'success');
    });
    updateModeOptions();
}

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

    // Overlay center logo (level H error correction allows ~30% occlusion)
    try {
        const logo = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = '/gsl-qr.png';
        });
        const logoSize = Math.round(qrSize * 0.22);
        const logoPad = 5;
        const logoX = paddingX + (qrSize - logoSize) / 2;
        const logoY = paddingTop + (qrSize - logoSize) / 2;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(logoX - logoPad, logoY - logoPad, logoSize + logoPad * 2, logoSize + logoPad * 2);
        ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    } catch { /* skip logo if image unavailable */ }

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

// ===== LINK ANALYTICS MODAL =====
let analyticsLinkId = null;
let analyticsData = null;
let analyticsActiveTab = 'devices';

window.openAnalyticsModal = async (id) => {
    analyticsLinkId = id;
    analyticsData = null;
    analyticsActiveTab = 'devices';

    const link = dashboardLinks.find(l => l.id === id);
    if (!link) return;

    document.getElementById('analytics-modal-slug').textContent = 'https://gftv.asia/' + link.slug;
    document.getElementById('analytics-total-clicks').textContent = '— total clicks';
    document.getElementById('analytics-tab-content').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

    // Reset tabs to first tab
    document.querySelectorAll('.analytics-tab-btn').forEach(b => b.classList.remove('active'));
    const firstTab = document.querySelector('.analytics-tab-btn[data-tab="devices"]');
    if (firstTab) firstTab.classList.add('active');

    openModal('modal-analytics');

    const res = await Links.analytics(id);
    if (!res.ok) {
        document.getElementById('analytics-tab-content').innerHTML = `<p style="color:var(--danger);padding:20px">Failed to load analytics.</p>`;
        return;
    }
    analyticsData = res.data;

    const total = analyticsData.total_clicks || 0;
    document.getElementById('analytics-total-clicks').textContent = `${total} total click${total !== 1 ? 's' : ''}`;

    renderAnalyticsTabContent(analyticsActiveTab);
};

window.switchAnalyticsTab = (tab, btn) => {
    analyticsActiveTab = tab;
    document.querySelectorAll('.analytics-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (analyticsData) {
        renderAnalyticsTabContent(tab);
    } else {
        document.getElementById('analytics-tab-content').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
    }
};

function renderAnalyticsTabContent(tab) {
    const content = document.getElementById('analytics-tab-content');
    if (!analyticsData) return;
    if (tab === 'devices') content.innerHTML = renderAnalyticsDevices(analyticsData);
    else if (tab === 'clicks') content.innerHTML = renderAnalyticsClicks(analyticsData);
    else if (tab === 'traffic') content.innerHTML = renderAnalyticsTraffic(analyticsData);
    else if (tab === 'history') content.innerHTML = renderAnalyticsHistory(analyticsData);
}

function renderAnalyticsDevices(data) {
    const ORDER = ['Desktop', 'Tablet', 'Mobile', 'Others'];
    const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

    const counts = { Desktop: 0, Tablet: 0, Mobile: 0, Others: 0 };
    (data.devices || []).forEach(d => {
        if (counts.hasOwnProperty(d.device_type)) counts[d.device_type] = Number(d.cnt);
    });
    const total = ORDER.reduce((s, k) => s + counts[k], 0);
    const pct = v => total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';

    const segments = ORDER.map((type, i) => {
        const w = total > 0 ? (counts[type] / total) * 100 : 0;
        return w > 0 ? `<div style="width:${w}%;background:${COLORS[i]};height:100%;"></div>` : '';
    }).join('');

    const legend = ORDER.map((type, i) => `
        <div style="display:flex;flex-direction:column;gap:3px;min-width:70px;">
            <div style="display:flex;align-items:center;gap:6px;">
                <span style="width:10px;height:10px;border-radius:50%;background:${COLORS[i]};display:inline-block;flex-shrink:0;"></span>
                <span style="font-size:0.82rem;color:var(--text-muted)">${type}</span>
            </div>
            <div style="font-size:1.05rem;font-weight:700;padding-left:16px;">${pct(counts[type])}%</div>
        </div>
    `).join('');

    return `
        <p style="font-size:0.95rem;font-weight:600;margin-bottom:16px;">What devices are your users on?</p>
        <div style="height:18px;border-radius:999px;overflow:hidden;display:flex;background:var(--border);margin-bottom:20px;">
            ${segments || `<div style="width:100%;background:var(--border);height:100%;"></div>`}
        </div>
        <div style="display:flex;gap:28px;flex-wrap:wrap;">${legend}</div>
    `;
}

function renderAnalyticsClicks(data) {
    // Build the 7-day window ending today (UTC)
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - i);
        days.push({
            date: d.toISOString().split('T')[0],
            label: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
            count: 0,
        });
    }
    (data.daily_clicks || []).forEach(item => {
        const day = days.find(d => d.date === item.day);
        if (day) day.count = Number(item.cnt);
    });

    const maxCount = Math.max(...days.map(d => d.count), 1);
    const W = 520, H = 160, padL = 28, padR = 12, padT = 16, padB = 28;
    const cW = W - padL - padR, cH = H - padT - padB;
    const xStep = cW / 6;

    const points = days.map((d, i) => ({
        x: padL + i * xStep,
        y: padT + cH - (d.count / maxCount) * cH,
        count: d.count,
        label: d.label,
    }));

    // Y-axis reference lines
    const yTicks = maxCount <= 4
        ? Array.from({ length: maxCount + 1 }, (_, i) => i)
        : [0, Math.ceil(maxCount / 2), maxCount];
    const yLines = yTicks.map(v => {
        const y = padT + cH - (v / maxCount) * cH;
        return `<line x1="${padL}" y1="${y}" x2="${padL + cW}" y2="${y}" stroke="var(--border)" stroke-width="1"/>
                <text x="${padL - 4}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-muted)">${v}</text>`;
    }).join('');

    const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
    const dots = points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--brand-darker)"/>`).join('');
    const xLabels = points.map(p =>
        `<text x="${p.x}" y="${H - 4}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${p.label}</text>`
    ).join('');

    const dlId = analyticsLinkId;
    return `
        <p style="font-size:0.95rem;font-weight:600;margin-bottom:6px;">How many users have visited your link in the past week?</p>
        <p style="margin-bottom:18px;">
            <a href="#" onclick="window.downloadAllClicks(event,'${dlId}')" style="color:var(--brand-darker);font-size:0.83rem;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
                Download full link click statistics here ${icon('download', 13)}
            </a>
        </p>
        <div style="overflow-x:auto;">
            <svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:280px;" xmlns="http://www.w3.org/2000/svg">
                <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + cH}" stroke="var(--border)" stroke-width="1"/>
                ${yLines}
                <polyline points="${polyline}" fill="none" stroke="var(--brand-darker)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
                ${dots}
                ${xLabels}
            </svg>
        </div>
    `;
}

function renderAnalyticsTraffic(data) {
    // PostgreSQL DOW: 0=Sun, 1=Mon ... 6=Sat — display Mon first
    const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
    const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => {
        if (h === 0) return '12am';
        if (h === 12) return '12pm';
        return h < 12 ? `${h}am` : `${h - 12}pm`;
    });

    const grid = {};
    let maxVal = 0;
    (data.heatmap || []).forEach(item => {
        const k = `${item.dow}:${item.hr}`;
        grid[k] = Number(item.cnt);
        if (grid[k] > maxVal) maxVal = grid[k];
    });

    const SHOW_AT = new Set([0, 6, 12, 18]);

    const headerCells = Array.from({ length: 24 }, (_, h) =>
        `<th style="padding:0 1px;text-align:center;font-size:9px;color:var(--text-light);font-weight:400;white-space:nowrap;min-width:20px;">${SHOW_AT.has(h) ? HOUR_LABELS[h] : ''}</th>`
    ).join('');

    const bodyRows = DOW_ORDER.map((dow, rowIdx) => {
        const cells = Array.from({ length: 24 }, (_, h) => {
            const cnt = grid[`${dow}:${h}`] || 0;
            const intensity = maxVal > 0 ? cnt / maxVal : 0;
            const bg = cnt > 0
                ? `rgba(var(--heat-rgb),${(0.12 + intensity * 0.82).toFixed(2)})`
                : 'var(--surface)';
            const title = `${DOW_LABELS[rowIdx]} ${HOUR_LABELS[h]} — ${cnt} click${cnt !== 1 ? 's' : ''}`;
            return `<td title="${title}" style="width:20px;height:20px;background:${bg};border:1px solid var(--border);border-radius:3px;"></td>`;
        }).join('');
        return `<tr>
            <td style="font-size:11px;color:var(--text-muted);padding-right:8px;white-space:nowrap;vertical-align:middle;">${DOW_LABELS[rowIdx]}</td>
            ${cells}
        </tr>`;
    }).join('');

    // Legend: 5 steps from empty → max
    const legendBoxes = [0, 0.12, 0.35, 0.6, 0.9].map((alpha, i) => {
        const bg = i === 0 ? 'var(--surface)' : `rgba(var(--heat-rgb),${alpha})`;
        return `<div style="width:16px;height:16px;background:${bg};border:1px solid var(--border);border-radius:3px;"></div>`;
    }).join('');

    return `
        <p style="font-size:0.95rem;font-weight:600;margin-bottom:14px;">When do your users visit?</p>
        <div style="overflow-x:auto;">
            <table style="border-collapse:separate;border-spacing:2px;">
                <thead><tr><th></th>${headerCells}</tr></thead>
                <tbody>${bodyRows}</tbody>
            </table>
        </div>
        <div style="display:flex;align-items:center;gap:4px;margin-top:12px;font-size:11px;color:var(--text-muted);">
            ${legendBoxes}
            <span style="margin-left:4px;">0</span>
            <span style="flex:1;min-width:8px;"></span>
            <span>${maxVal}+</span>
        </div>
    `;
}

function renderAnalyticsHistory(data) {
    const link = dashboardLinks.find(l => l.id === analyticsLinkId);
    const slug = link ? link.slug : '';
    const history = data.history || [];

    if (history.length === 0) {
        return `<div class="empty-state" style="padding:32px 0;">${icon('clock', 28)}<p style="margin-top:8px;">No history recorded yet.</p></div>`;
    }

    const items = history.map((item, i) => {
        const isLast = i === history.length - 1;
        const dateStr = new Date(item.created_at).toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit',
        });
        // Bold key terms in description
        const desc = item.description
            .replace(/\bACTIVE\b/g, '<strong>ACTIVE</strong>')
            .replace(/\bINACTIVE\b/g, '<strong>INACTIVE</strong>')
            .replace(/(https?:\/\/[^\s]+)/g, '<strong>$1</strong>');

        return `
            <div style="display:flex;gap:14px;align-items:flex-start;">
                <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
                    <div style="width:11px;height:11px;border-radius:50%;background:var(--text-muted);margin-top:3px;"></div>
                    ${!isLast ? `<div style="width:2px;flex:1;background:var(--border);margin-top:4px;min-height:32px;"></div>` : ''}
                </div>
                <div style="padding-bottom:${isLast ? '0' : '20px'};">
                    <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:3px;">${dateStr}</div>
                    <div style="font-size:0.88rem;line-height:1.5;">${desc}</div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:20px;display:flex;align-items:center;gap:6px;">
            ${icon('link', 13)} https://gftv.asia/${slug}
        </p>
        ${items}
    `;
}

window.downloadAllClicks = (e, id) => {
    e.preventDefault();
    if (!analyticsData) return;
    const rows = ['date,clicks'];
    (analyticsData.all_daily_clicks || []).forEach(item => rows.push(`${item.day},${item.cnt}`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const link = dashboardLinks.find(l => l.id === id);
    a.download = `analytics-${link ? link.slug : id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ===== SERVICE WORKER =====
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
}

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupLoginPage();
    setupRegisterPage();
    setupDirectoryPage();
    setupDashboardPage();
    setupCreateLinkModal();
    setupAdminManageLinkModal();
    setupProfilePage();
    setupDisable2FAModal();
    setupRegenBackupCodesModal();
    setupAdminModal();
    setupAddPreapprovedModal();
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