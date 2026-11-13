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
    Stats,
    getToken,
    setToken,
    clearToken
} from './api.js';
import {
    toast,
    openModal,
    closeModal,
    closeAllModals,
    initTagsInput,
    compressToWebp,
    formatDate,
    avatarHtml,
    slugCopyHtml,
    tagsHtml,
    getPasswordStrength,
    rejectSpaces,
    NO_SPACES_MESSAGE,
    icon,
    loadingHtml
} from './ui.js';
import { registerServiceWorker } from './sw-update.js';

// ===== STATE =====
const COLOR_THEME_KEY = 'gftv-gftvlinks.colorTheme';
const MODE_KEY = 'gftv-gftvlinks.mode';
const DEFAULT_COLOR_THEME = 'classic';
const DEFAULT_MODE = 'light';

let state = {
    user: null,
    token: getToken() || null,
    colorTheme: DEFAULT_COLOR_THEME,
    mode: DEFAULT_MODE,            // resolved: light or dark
    modePreference: DEFAULT_MODE,  // chosen: light, dark, or time
    currentPage: 'home',
};

let homeTypingInterval = null;

// ===== THEME =====
const COLOR_THEMES = [
    { id: 'classic', label: 'Classic', color: '#ffffff' },
    { id: 'hellotheme', label: 'HelloTheme', color: '#fedc00' },
];

// Page background per colour theme x mode, for meta[name=theme-color].
// Mirrors --bg in each token block in style.css.
const THEME_COLOR = {
    'classic:light': '#fafafa',
    'classic:dark': '#111111',
    'hellotheme:light': '#fffef0',
    'hellotheme:dark': '#14120a',
};

// Mode preference and mode are different things. The preference is what the
// person chose and can be "time"; the mode is what the document is in and is
// only ever light or dark. state.mode holds the resolved mode, MODE_KEY holds
// the preference.
const MODE_PREFERENCES = ['light', 'dark', 'time'];

// The daylight window. Duplicated in the pre-paint script in index.html's
// <head>, which has to resolve this before first paint and cannot import
// anything. Change both together.
const LIGHT_FROM_HOUR = 9;
const LIGHT_UNTIL_HOUR = 18;

function isValidColorTheme(themeId) {
    return COLOR_THEMES.some(theme => theme.id === themeId);
}

// The stored mode preference (light, dark or time), or the default when
// nothing valid is stored.
function getModePreference() {
    const savedMode = localStorage.getItem(MODE_KEY);
    if (MODE_PREFERENCES.includes(savedMode)) {
        return savedMode;
    } else {
        return DEFAULT_MODE;
    }
}

function isDaylightHours(now = new Date()) {
    const hour = now.getHours();
    return hour >= LIGHT_FROM_HOUR && hour < LIGHT_UNTIL_HOUR;
}

// Turns a preference into the mode the page shows: "time" follows the clock,
// "dark" is dark, and anything else is light.
function resolveMode(preference) {
    if (preference === 'time') {
        if (isDaylightHours()) {
            return 'light';
        } else {
            return 'dark';
        }
    }
    if (preference === 'dark') {
        return 'dark';
    } else {
        return 'light';
    }
}

function updateThemeColorMeta() {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) themeColorMeta.setAttribute('content', THEME_COLOR[`${state.colorTheme}:${state.mode}`] || '#ffffff');
}

function applyColorTheme(themeId) {
    if (!isValidColorTheme(themeId)) themeId = DEFAULT_COLOR_THEME;
    state.colorTheme = themeId;
    localStorage.setItem(COLOR_THEME_KEY, themeId);
    document.documentElement.setAttribute('data-color-theme', themeId);
    updateThemeColorMeta();
}

// Takes a preference (light, dark, time), stores it, and writes the resolved
// mode to the document. Never stores the resolved value: writing "dark" over a
// stored "time" on a winter evening would silently end the setting chosen.
function applyMode(preference) {
    let chosen;
    if (MODE_PREFERENCES.includes(preference)) {
        chosen = preference;
    } else {
        chosen = DEFAULT_MODE;
    }
    const resolved = resolveMode(chosen);
    state.modePreference = chosen;
    state.mode = resolved;
    localStorage.setItem(MODE_KEY, chosen);
    document.documentElement.setAttribute('data-mode', resolved);
    document.documentElement.setAttribute('data-mode-preference', chosen);
    updateThemeColorMeta();
    updateThemeButtonIcon();
    updateModeOptions();
    scheduleModeCheck();
    return resolved;
}

// The navbar's theme button shows a moon in dark mode and a sun in light mode.
function updateThemeButtonIcon() {
    const themeButton = document.getElementById('theme-picker-btn');
    if (!themeButton) return;
    let iconName;
    if (state.mode === 'dark') {
        iconName = 'moon';
    } else {
        iconName = 'sun';
    }
    themeButton.innerHTML = icon(iconName, 18);
}

// Keeping the time based mode honest while the page stays open: one timer to
// the next 09:00 or 18:00 rather than polling, plus a re-check when the tab
// becomes visible again, since a laptop that slept through the boundary fires
// its timer late.
let modeTimer = null;
let watchingVisibility = false;

// Milliseconds until the next LIGHT_FROM_HOUR or LIGHT_UNTIL_HOUR, whichever comes first.
function millisecondsUntilNextBoundary(now = new Date()) {
    const next = new Date(now);
    next.setMinutes(0, 0, 0);

    const hour = now.getHours();
    if (hour < LIGHT_FROM_HOUR) {
        next.setHours(LIGHT_FROM_HOUR);
    } else if (hour < LIGHT_UNTIL_HOUR) {
        next.setHours(LIGHT_UNTIL_HOUR);
    } else {
        next.setDate(next.getDate() + 1);
        next.setHours(LIGHT_FROM_HOUR);
    }

    // A second of slack, so a timer that fires a fraction early does not land
    // back in the hour it just left and reschedule itself in a tight loop.
    return Math.max(1000, next.getTime() - now.getTime() + 1000);
}

function scheduleModeCheck() {
    if (modeTimer !== null) {
        clearTimeout(modeTimer);
        modeTimer = null;
    }

    if (getModePreference() !== 'time') return;

    modeTimer = setTimeout(() => {
        modeTimer = null;
        refreshTimeMode();
    }, millisecondsUntilNextBoundary());

    if (!watchingVisibility) {
        watchingVisibility = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') refreshTimeMode();
        });
    }
}

function refreshTimeMode() {
    if (getModePreference() !== 'time') return;

    const resolved = resolveMode('time');
    const current = document.documentElement.getAttribute('data-mode');

    if (resolved !== current) {
        state.mode = resolved;
        document.documentElement.setAttribute('data-mode', resolved);
        updateThemeColorMeta();
        updateThemeButtonIcon();
        document.dispatchEvent(new CustomEvent('gftv:modechange', {
            detail: { mode: resolved, preference: 'time' },
        }));
    }

    scheduleModeCheck();
}

// Migrate the old single-key theme value, then drop it, so nobody loses their pick
function migrateLegacyTheme() {
    const legacy = localStorage.getItem('gftv_theme');
    if (legacy === null) return;
    let migrated;
    if (isValidColorTheme(legacy)) {
        migrated = legacy;
    } else {
        migrated = DEFAULT_COLOR_THEME;
    }
    if (!localStorage.getItem(COLOR_THEME_KEY)) localStorage.setItem(COLOR_THEME_KEY, migrated);
    if (!localStorage.getItem(MODE_KEY)) localStorage.setItem(MODE_KEY, DEFAULT_MODE);
    localStorage.removeItem('gftv_theme');
}

function initTheme() {
    migrateLegacyTheme();
    const savedColorTheme = localStorage.getItem(COLOR_THEME_KEY);
    if (isValidColorTheme(savedColorTheme)) {
        applyColorTheme(savedColorTheme);
    } else {
        applyColorTheme(DEFAULT_COLOR_THEME);
    }
    // The preference, not the resolved mode. Passing the resolved one would
    // quietly rewrite a stored "time" into "dark" the first evening.
    applyMode(getModePreference());
}

// ===== ROUTER =====
function showPage(pageId) {
    // Clean up typing animation when leaving home
    if (state.currentPage === 'home' && pageId !== 'home' && homeTypingInterval) {
        clearInterval(homeTypingInterval);
        homeTypingInterval = null;
    }

    document.querySelectorAll('.page').forEach(pageElement => pageElement.classList.remove('active'));
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) targetPage.classList.add('active');
    state.currentPage = pageId;
    updateNav();
}

function isEditor() {
    return state.user && (state.user.is_editor || state.user.is_admin);
}

// Goes to a page, if the person may see it, and loads its data. Signed-out
// visitors only get the public pages; viewers only get the directory and
// their profile; everyone else is sent to the home page or the directory.
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
// Redraws the navbar and the mobile menu for whoever is signed in, with the
// current page's button marked active, and the avatar at the right.
function updateNav() {
    const desktopNavigation = document.getElementById('nav-links');
    const mobileNavigation = document.getElementById('mobile-nav');
    if (!desktopNavigation) return;

    // The pages a signed-in person can go to: everyone gets the directory and
    // their profile, editors also get their links, requests and the API page,
    // and admins get the admin page.
    const navigationItems = [];
    if (state.user) {
        navigationItems.push({ id: 'directory', icon: icon('list'), label: 'Directory' });
        if (isEditor()) {
            navigationItems.push(
                { id: 'dashboard', icon: icon('home'), label: 'My Links' },
                { id: 'ownership', icon: icon('inbox'), label: 'Requests' },
                { id: 'apiintegration', icon: icon('api'), label: 'API' },
            );
        }
        if (state.user.is_admin) {
            navigationItems.push({ id: 'admin', icon: icon('settings'), label: 'Admin' });
        }
        navigationItems.push({ id: 'profile', icon: icon('user'), label: 'Profile' });
    }

    // "active" for the button of the page that's showing, nothing for the rest
    const getActiveClass = (pageId) => {
        if (state.currentPage === pageId) {
            return 'active';
        } else {
            return '';
        }
    };

    const renderNavigationButtons = (container) => {
        if (!state.user) {
            const loginActiveClass = getActiveClass('login');
            const registerActiveClass = getActiveClass('register');
            container.innerHTML = `
        <button class="nav-btn-outline" onclick="window.open('https://gftv.asia/user-support','_blank')">Send us feedback</button>
        <button class="nav-btn-outline" onclick="window.open('https://guide.gftv.asia','_blank')">Guide</button>
        <button class="nav-btn-outline" onclick="window.open('https://github.com/augy-studios/gftv-redirects-portal','_blank')">Contribute</button>
        <button class="nav-btn ${loginActiveClass}" onclick="nav('login')">Log In</button>
        <button class="nav-btn ${registerActiveClass}" onclick="nav('register')">Register</button>
      `;
        } else {
            container.innerHTML = navigationItems.map(item => {
                const activeClass = getActiveClass(item.id);
                return `<button class="nav-btn ${activeClass}" onclick="nav('${item.id}')"><span class="nav-btn-icon">${item.icon}</span>${item.label}</button>`;
            }).join('') + `<button class="nav-btn" onclick="handleLogout()">${icon('logout')} Logout</button>`;
        }
    };

    renderNavigationButtons(desktopNavigation);
    if (mobileNavigation) renderNavigationButtons(mobileNavigation);

    // User avatar in nav
    const navigationUser = document.getElementById('nav-user');
    if (navigationUser) {
        if (state.user) {
            const letter = (state.user.display_name || state.user.username)[0].toUpperCase();
            if (state.user.avatar_url) {
                navigationUser.innerHTML = `<img src="${state.user.avatar_url}" class="nav-avatar" onclick="nav('profile')" alt="${letter}">`;
            } else {
                navigationUser.innerHTML = `<div class="avatar-placeholder" onclick="nav('profile')">${letter}</div>`;
            }
        } else {
            navigationUser.innerHTML = '';
        }
    }
}

window.nav = navigate;
window.openModal = openModal;

// ===== AUTH =====
async function init() {
    if (state.token) {
        const response = await Auth.me();
        if (response.ok) {
            state.user = response.data.user;
            if (isEditor()) {
                navigate('dashboard');
            } else {
                navigate('directory');
            }
        } else {
            clearToken();
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
    clearToken();
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
let _totpLoginRemember = false;

// Wires up the sign-in form. A correct password signs the person in, unless
// the account has 2FA on and this device isn't trusted: then the 2FA modal
// opens, and the challenge is kept for submitTotpLogin. An account that is
// waiting for approval goes to the waiting page.
function setupLoginPage() {
    const form = document.getElementById('login-form');
    const errorElement = document.getElementById('login-error');
    const loginButton = document.getElementById('login-btn');

    // Allow Enter key in TOTP modal code inputs to submit
    document.getElementById('totp-login-code')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); window.submitTotpLogin(); }
    });
    document.getElementById('totp-login-backup-code')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); window.submitTotpLogin(); }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const usernameInput = document.getElementById('login-username');
        if (rejectSpaces(usernameInput)) {
            errorElement.textContent = `${NO_SPACES_MESSAGE} in your username or email`;
            errorElement.style.display = 'flex';
            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = 'Logging in…';

        const username = usernameInput.value.trim();
        const password = document.getElementById('login-password').value;
        // Stay logged in for 30 days on this device, or just for this browser session
        const remember = document.getElementById('login-remember').checked;

        // Send stored device token so trusted devices skip 2FA
        const deviceToken = localStorage.getItem(`gftv_device_${username.toLowerCase()}`) || undefined;

        const response = await Auth.login({ username, password, device_token: deviceToken, remember });

        if (response.ok && response.data.requires_2fa) {
            // Server issued a TOTP challenge, show the 2FA modal
            _totpChallengeToken = response.data.challenge_token;
            _totpLoginUsername = response.data.username || username.toLowerCase();
            _totpLoginRemember = remember;
            document.getElementById('totp-login-code').value = '';
            document.getElementById('totp-trust-device').checked = false;
            document.getElementById('totp-login-error').style.display = 'none';
            openModal('modal-totp-login');
            setTimeout(() => document.getElementById('totp-login-code').focus(), 100);
        } else if (response.ok) {
            finishLogin(response.data.token, response.data.user, remember);
            toast(`Welcome back, ${response.data.user.display_name}!`, 'success');
        } else if (response.status === 403 && response.data.error === 'PENDING_APPROVAL') {
            navigate('pending');
        } else {
            errorElement.textContent = response.data.error || 'Login failed';
            errorElement.style.display = 'flex';
        }

        loginButton.disabled = false;
        loginButton.textContent = 'Log In';
    });
}

function finishLogin(token, user, remember) {
    state.token = token;
    state.user = user;
    setToken(token, remember);
    closeAllModals();
    if (isEditor()) {
        navigate('dashboard');
    } else {
        navigate('directory');
    }
}

window.cancelTotpLogin = () => {
    _totpChallengeToken = null;
    _totpLoginUsername = null;
    _totpLoginRemember = false;
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

// Sends the 2FA modal's code, either the 6-digit app code or a backup code,
// with the challenge from setupLoginPage. On success it signs the person in,
// and, if they ticked "trust this device", stores the device token the server
// returns, so the next sign-in on this device skips 2FA.
window.submitTotpLogin = async () => {
    const trustDevice = document.getElementById('totp-trust-device').checked;
    const errorElement = document.getElementById('totp-login-error');
    const verifyButton = document.getElementById('totp-login-btn');
    const isBackupMode = document.getElementById('totp-login-backup-section').style.display !== 'none';

    errorElement.style.display = 'none';
    verifyButton.disabled = true;
    verifyButton.textContent = 'Verifying…';

    let response;
    if (isBackupMode) {
        const backupCode = document.getElementById('totp-login-backup-code').value.trim();
        if (!backupCode) {
            errorElement.textContent = 'Please enter a backup code';
            errorElement.style.display = 'flex';
            verifyButton.disabled = false;
            verifyButton.textContent = 'Verify';
            return;
        }
        response = await Totp.verifyBackup(_totpChallengeToken, backupCode, trustDevice, _totpLoginRemember);
    } else {
        const code = document.getElementById('totp-login-code').value.trim();
        if (!code || code.length !== 6) {
            errorElement.textContent = 'Please enter the 6-digit code';
            errorElement.style.display = 'flex';
            verifyButton.disabled = false;
            verifyButton.textContent = 'Verify';
            return;
        }
        response = await Totp.verify(_totpChallengeToken, code, trustDevice, _totpLoginRemember);
    }

    verifyButton.disabled = false;
    verifyButton.textContent = 'Verify';

    if (response.ok) {
        if (trustDevice && response.data.device_token && _totpLoginUsername) {
            localStorage.setItem(`gftv_device_${_totpLoginUsername}`, response.data.device_token);
        }
        finishLogin(response.data.token, response.data.user, _totpLoginRemember);
        toast(`Welcome back, ${response.data.user.display_name}!`, 'success');
    } else {
        errorElement.textContent = response.data.error || 'Verification failed';
        errorElement.style.display = 'flex';
    }
};

// ===== REGISTER PAGE =====
// Wires up the registration form: the password strength bar, then on submit
// the checks (no spaces, a valid email, matching passwords) and the request.
// A pre-approved email is signed in straight away and shown the
// congratulations page; anyone else goes to the waiting page.
function setupRegisterPage() {
    const form = document.getElementById('register-form');
    const errorElement = document.getElementById('register-error');
    const registerButton = document.getElementById('register-btn');
    const passwordInput = document.getElementById('reg-password');
    const strengthBar = document.getElementById('pwd-strength-bar');

    passwordInput.addEventListener('input', () => {
        const strength = getPasswordStrength(passwordInput.value);
        strengthBar.className = `pwd-strength pwd-strength-${strength}`;
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const usernameInput = document.getElementById('reg-username');
        const emailInput = document.getElementById('reg-email');
        const inputWithSpaces = rejectSpaces(usernameInput, emailInput);
        if (inputWithSpaces) {
            let fieldName;
            if (inputWithSpaces === usernameInput) {
                fieldName = 'username';
            } else {
                fieldName = 'email address';
            }
            errorElement.textContent = `${NO_SPACES_MESSAGE} in your ${fieldName}`;
            errorElement.style.display = 'flex';
            return;
        }

        const email = emailInput.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errorElement.textContent = 'Please enter a valid email address';
            errorElement.style.display = 'flex';
            return;
        }

        const password = passwordInput.value;
        const passwordConfirmation = document.getElementById('reg-confirm').value;
        if (password !== passwordConfirmation) {
            errorElement.textContent = 'Passwords do not match';
            errorElement.style.display = 'flex';
            return;
        }

        registerButton.disabled = true;
        registerButton.textContent = 'Creating account…';

        try {
            const response = await Auth.register({
                username: usernameInput.value.trim(),
                display_name: document.getElementById('reg-displayname').value.trim(),
                email,
                password,
            });

            if (response.ok) {
                if (response.data.preapproved) {
                    // Auto-login and show congratulations screen
                    state.token = response.data.token;
                    state.user = response.data.user;
                    state.preapprovedRole = response.data.preapproved_role;
                    setToken(response.data.token, true);
                    updateNav();
                    showPage('preapproved');
                    renderPreapprovedPage();
                    toast('Account created! You\'ve been pre-approved.', 'success');
                } else {
                    toast('Account created! Waiting for admin approval.', 'success');
                    navigate('pending');
                }
            } else {
                errorElement.textContent = response.data.error || 'Registration failed';
                errorElement.style.display = 'flex';
            }
        } finally {
            registerButton.disabled = false;
            registerButton.textContent = 'Create Account';
        }
    });
}

// ===== DIRECTORY PAGE =====
let directoryData = [];
let directoryFilterKeyword = '';
let directoryFilterTag = '';
let directoryFilterStatus = 'all';
let directorySortOrder = 'date';

// The directory's links after the search box, tag box and status filter, in
// the chosen order: most visits first, or newest first.
function getFilteredSortedDirectoryLinks() {
    let links = directoryData.filter(link => {
        if (directoryFilterKeyword) {
            const keyword = directoryFilterKeyword.toLowerCase();
            const user = link.gftvhello_users || {};
            if (!link.slug.toLowerCase().includes(keyword) &&
                !link.destination.toLowerCase().includes(keyword) &&
                !(user.display_name || '').toLowerCase().includes(keyword) &&
                !(user.username || '').toLowerCase().includes(keyword)) return false;
        }
        if (directoryFilterTag) {
            const tag = directoryFilterTag.toLowerCase();
            if (!link.tags || !link.tags.some(linkTag => linkTag.toLowerCase().includes(tag))) return false;
        }
        if (directoryFilterStatus === 'active' && !link.is_active) return false;
        if (directoryFilterStatus === 'inactive' && link.is_active) return false;
        return true;
    });

    if (directorySortOrder === 'visits') {
        links.sort((firstLink, secondLink) => (secondLink.access_count ?? 0) - (firstLink.access_count ?? 0));
    } else {
        links.sort((firstLink, secondLink) => new Date(secondLink.created_at) - new Date(firstLink.created_at));
    }
    return links;
}

async function loadDirectory() {
    const container = document.getElementById('directory-table-wrap');
    container.innerHTML = loadingHtml();

    const response = await Links.list('', 'keyword');
    if (!response.ok) {
        container.innerHTML = '<p style="color:var(--danger);padding:20px">Failed to load links.</p>';
        return;
    }

    directoryData = response.data.links || [];
    renderDirectoryTable();
}

// Draws the directory table, or an empty state when there are no links or
// none match the filters. Each row shows an Edit button to admins, and either
// "You own this" or a Request Ownership button to editors.
function renderDirectoryTable() {
    const container = document.getElementById('directory-table-wrap');

    if (directoryData.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('link', 32)}</div><h3>No links found</h3><p>No links have been created yet.</p></div>`;
        return;
    }

    const matchingLinks = getFilteredSortedDirectoryLinks();

    if (matchingLinks.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('link', 32)}</div><h3>No links match</h3><p>Try adjusting your search or filters.</p></div>`;
        return;
    }

    const rows = matchingLinks.map(link => {
        const user = link.gftvhello_users || {};
        const isOwner = state.user && link.gftvhello_users?.id === state.user.id;

        let statusClass;
        let statusLabel;
        if (link.is_active) {
            statusClass = 'badge-active';
            statusLabel = '● Active';
        } else {
            statusClass = 'badge-inactive';
            statusLabel = '● Inactive';
        }

        let adminEditButtonHtml;
        if (state.user?.is_admin) {
            adminEditButtonHtml = `<button class="btn btn-sm btn-secondary" onclick="openAdminManageLink('${link.id}')">${icon('edit')} Edit</button>`;
        } else {
            adminEditButtonHtml = '';
        }

        let ownershipHtml;
        if (isOwner) {
            ownershipHtml = `<span style="color:var(--text-light);font-size:0.8rem">You own this</span>`;
        } else if (isEditor()) {
            ownershipHtml = `<button class="btn btn-sm btn-secondary" onclick="requestOwnership('${link.id}')">Request Ownership</button>`;
        } else {
            ownershipHtml = '';
        }

        return `<tr>
      <td class="td-slug">${slugCopyHtml(link.slug)}</td>
      <td class="td-dest"><span title="${link.destination}">${link.destination}</span></td>
      <td class="td-user td-user-clickable" onclick="viewUserProfile('${user.id}')" title="View profile">${avatarHtml(user)}<span>${user.display_name || user.username || '–'}</span></td>
      <td style="white-space:nowrap"><span class="badge ${statusClass}">${statusLabel}</span></td>
      <td class="access-count" style="white-space:nowrap">${icon('eye')} ${link.access_count ?? 0}</td>
      <td>${tagsHtml(link.tags)}</td>
      <td style="white-space:nowrap">${formatDate(link.created_at)}</td>
      <td style="white-space:nowrap">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${adminEditButtonHtml}
          ${ownershipHtml}
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

// Wires up the directory's search and filters. Typing in the keyword or tag
// box redraws the table 200ms after the last key; the status and sort menus
// redraw it straight away.
function setupDirectoryPage() {
    const keywordInput = document.getElementById('dir-search-keyword');
    const tagInput = document.getElementById('dir-search-tag');
    const statusSelect = document.getElementById('dir-filter-status');
    const sortSelect = document.getElementById('dir-sort');

    let debounceTimer;
    keywordInput.addEventListener('input', () => {
        directoryFilterKeyword = keywordInput.value.trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderDirectoryTable, 200);
    });
    tagInput.addEventListener('input', () => {
        directoryFilterTag = tagInput.value.trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderDirectoryTable, 200);
    });
    statusSelect.addEventListener('change', () => {
        directoryFilterStatus = statusSelect.value;
        renderDirectoryTable();
    });
    sortSelect.addEventListener('change', () => {
        directorySortOrder = sortSelect.value;
        renderDirectoryTable();
    });
}

// One "recent viewers" pill: the viewer's photo (or first letter) and name.
// Clicking it opens their profile. Used by the profile modal and the profile page.
function buildViewerPillHtml(viewer) {
    const viewerLetter = (viewer.display_name || viewer.username || '?')[0].toUpperCase();
    let viewerAvatarHtml;
    if (viewer.avatar_url) {
        viewerAvatarHtml = `<img src="${viewer.avatar_url}" class="viewer-pill-avatar" alt="${viewerLetter}">`;
    } else {
        viewerAvatarHtml = `<span class="viewer-pill-avatar viewer-pill-avatar-ph">${viewerLetter}</span>`;
    }
    return `<button class="viewer-pill" onclick="viewUserProfileById('${viewer.id}')" title="@${viewer.username}">${viewerAvatarHtml}<span>${viewer.display_name || viewer.username}</span></button>`;
}

// The contents of the "view profile" modal opened from the directory: the
// person's photo (or first letter), name, @username, an Admin badge, their
// link and view counts, their social links, and recent viewers if any.
function buildProfileModalHtml(user, userLinks, viewers) {
    const totalViews = userLinks.reduce((total, link) => total + (link.access_count || 0), 0);
    const letter = (user.display_name || user.username || '?')[0].toUpperCase();

    let profileAvatarHtml;
    if (user.avatar_url) {
        profileAvatarHtml = `<img src="${user.avatar_url}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;margin-bottom:10px;" alt="${letter}">`;
    } else {
        profileAvatarHtml = `<div style="width:72px;height:72px;border-radius:50%;background:var(--brand);color:var(--brand-text);font-size:1.8rem;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">${letter}</div>`;
    }

    const socials = user.social_links || [];
    let socialsHtml;
    if (socials.length > 0) {
        socialsHtml = `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:14px;">
            ${socials.map(social => `<a href="${social.url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;border:1px solid var(--border);font-size:0.82rem;color:var(--text-muted);text-decoration:none;" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text-muted)'">${icon('external-link')} ${social.label}</a>`).join('')}
          </div>`;
    } else {
        socialsHtml = '';
    }

    let viewerPillsHtml;
    if (viewers && viewers.length > 0) {
        viewerPillsHtml = `<div class="profile-viewers">
            <div class="profile-viewers-label">Recent viewers</div>
            <div class="profile-viewers-pills">
              ${viewers.map(viewer => buildViewerPillHtml(viewer)).join('')}
            </div>
          </div>`;
    } else {
        viewerPillsHtml = '';
    }

    let roleBadge;
    if (user.is_admin) {
        roleBadge = `<span class="badge badge-admin" style="margin-bottom:16px;display:inline-block;">Admin</span>`;
    } else {
        roleBadge = `<div style="margin-bottom:16px"></div>`;
    }

    return `
        ${profileAvatarHtml}
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
    const user = directoryData.map(link => link.gftvhello_users).find(linkOwner => linkOwner?.id === userId);
    if (!user) return;

    const userLinks = directoryData.filter(link => link.gftvhello_users?.id === userId);

    // Show modal immediately with loading viewers placeholder
    document.getElementById('view-profile-content').innerHTML = buildProfileModalHtml(user, userLinks, []);
    openModal('modal-view-profile');

    // Record the profile view (fire-and-forget, non-blocking)
    ProfileViews.record(userId);

    // Fetch recent viewers and update modal
    const viewersResponse = await ProfileViews.getViewers(userId);
    if (viewersResponse.ok && viewersResponse.data.viewers?.length > 0) {
        document.getElementById('view-profile-content').innerHTML =
            buildProfileModalHtml(user, userLinks, viewersResponse.data.viewers);
    }
};

// View a profile by ID, used by viewer pills (looks up user from directoryData or fetches from API)
window.viewUserProfileById = async (userId) => {
    // Try to find user in already-loaded directory data first
    const userFromDirectory = directoryData.map(link => link.gftvhello_users).find(linkOwner => linkOwner?.id === userId);
    if (userFromDirectory) {
        await window.viewUserProfile(userId);
        return;
    }
    // Fallback: fetch from directory (reload)
    const response = await Links.list('', 'keyword');
    if (response.ok) {
        directoryData = response.data.links || [];
    }
    await window.viewUserProfile(userId);
};

window.requestOwnership = async (linkId) => {
    const response = await Ownership.request(linkId);
    if (response.ok) toast('Ownership request sent!', 'success');
    else toast(response.data.error || 'Failed to send request', 'error');
};

// ===== ADMIN MANAGE SHORT LINK MODAL =====
let adminManageLinkId = null;
let adminLinkTagsManager = null;

window.openAdminManageLink = (linkId) => {
    const link = directoryData.find(candidate => candidate.id === linkId);
    if (!link) return;
    adminManageLinkId = linkId;

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
    const link = directoryData.find(candidate => candidate.id === adminManageLinkId);
    const slug = link?.slug || adminManageLinkId;
    if (!confirm(`Delete gftv.asia/${slug}? This cannot be undone.`)) return;

    const response = await Links.delete(adminManageLinkId);
    if (response.ok) {
        toast('Link deleted', 'success');
        closeModal('modal-admin-manage-link');
        loadDirectory();
    } else {
        toast(response.data.error || 'Failed to delete link', 'error');
    }
};

// Wires up the admin's "manage short link" modal, opened from a directory
// row: the tags box, the form that saves the slug, destination, status and
// tags, and the form that transfers the link to another username.
function setupAdminManageLinkModal() {
    const tagsContainer = document.getElementById('admin-link-tags-container');
    let adminLinkTags = [];
    adminLinkTagsManager = initTagsInput(tagsContainer, (tags) => {
        adminLinkTags = tags;
    });

    document.getElementById('admin-manage-link-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!adminManageLinkId) return;
        const saveButton = document.getElementById('admin-manage-link-save-btn');
        saveButton.disabled = true;
        saveButton.textContent = 'Saving…';

        const slug = document.getElementById('admin-link-slug').value.trim();
        const destination = document.getElementById('admin-link-dest').value.trim();
        const isActive = document.getElementById('admin-link-status').value === 'true';

        const response = await Links.update(adminManageLinkId, { slug, destination, is_active: isActive, tags: adminLinkTags });
        if (response.ok) {
            toast('Link updated!', 'success');
            closeModal('modal-admin-manage-link');
            loadDirectory();
        } else {
            toast(response.data.error || 'Failed to update link', 'error');
        }
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
    });

    document.getElementById('admin-transfer-link-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!adminManageLinkId) return;
        const transferButton = document.getElementById('admin-transfer-link-btn');
        const ownerInput = document.getElementById('admin-link-new-owner');
        if (rejectSpaces(ownerInput)) { toast(`${NO_SPACES_MESSAGE} in a username`, 'error'); return; }
        const newOwnerUsername = ownerInput.value.trim();
        if (!newOwnerUsername) { toast('Enter a username to transfer to', 'error'); return; }

        transferButton.disabled = true;
        transferButton.textContent = 'Transferring…';

        const response = await Links.update(adminManageLinkId, { new_owner_username: newOwnerUsername });
        if (response.ok) {
            toast(`Ownership transferred to @${newOwnerUsername}`, 'success');
            document.getElementById('admin-link-new-owner').value = '';
            closeModal('modal-admin-manage-link');
            loadDirectory();
        } else {
            toast(response.data.error || 'Failed to transfer ownership', 'error');
        }
        transferButton.disabled = false;
        transferButton.textContent = 'Transfer Ownership';
    });
}

// ===== DASHBOARD PAGE =====
let dashboardLinks = [];
let editLinkTagsManager = null;
let editingLinkId = null;
let dashboardFilterKeyword = '';
let dashboardFilterTag = '';
let dashboardFilterStatus = 'all';
let dashboardSortOrder = 'date';

// Loads the signed-in person's own links, fills the three stat cards (total
// links, active links, total views) and draws the table.
async function loadDashboard() {
    const container = document.getElementById('dashboard-links-wrap');
    const statsElement = document.getElementById('dashboard-stats');
    container.innerHTML = loadingHtml();

    const response = await Links.mine();
    if (!response.ok) {
        container.innerHTML = '<p style="color:var(--danger);padding:20px">Failed to load your links.</p>';
        return;
    }

    dashboardLinks = response.data.links || [];

    // Stats
    const totalViews = dashboardLinks.reduce((total, link) => total + (link.access_count || 0), 0);
    const activeCount = dashboardLinks.filter(link => link.is_active).length;
    statsElement.innerHTML = `
    <div class="stat-card glass"><div class="stat-icon">${icon('link', 20)}</div><div class="stat-label">Total Links</div><div class="stat-value">${dashboardLinks.length}</div></div>
    <div class="stat-card glass"><div class="stat-icon">${icon('check-circle', 20)}</div><div class="stat-label">Active</div><div class="stat-value">${activeCount}</div></div>
    <div class="stat-card glass"><div class="stat-icon">${icon('eye', 20)}</div><div class="stat-label">Total Views</div><div class="stat-value">${totalViews}</div></div>
  `;

    renderDashboardTable();
}

// The dashboard's links after the search box, tag box and status filter, in
// the chosen order: most visits first, or newest first.
function getFilteredSortedLinks() {
    let links = dashboardLinks.filter(link => {
        if (dashboardFilterKeyword) {
            const keyword = dashboardFilterKeyword.toLowerCase();
            if (!link.slug.toLowerCase().includes(keyword) && !link.destination.toLowerCase().includes(keyword)) return false;
        }
        if (dashboardFilterTag) {
            const tag = dashboardFilterTag.toLowerCase();
            if (!link.tags || !link.tags.some(linkTag => linkTag.toLowerCase().includes(tag))) return false;
        }
        if (dashboardFilterStatus === 'active' && !link.is_active) return false;
        if (dashboardFilterStatus === 'inactive' && link.is_active) return false;
        return true;
    });
    if (dashboardSortOrder === 'visits') {
        links.sort((firstLink, secondLink) => (secondLink.access_count ?? 0) - (firstLink.access_count ?? 0));
    } else {
        links.sort((firstLink, secondLink) => new Date(secondLink.created_at) - new Date(firstLink.created_at));
    }
    return links;
}

// Draws the dashboard table, or an empty state when the person has no links
// or none match the filters. Each row has an on/off checkbox and buttons for
// analytics, edit and delete.
function renderDashboardTable() {
    const container = document.getElementById('dashboard-links-wrap');
    if (dashboardLinks.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('link', 32)}</div><h3>No links yet</h3><p>Create your first short link!</p></div>`;
        return;
    }

    const matchingLinks = getFilteredSortedLinks();

    if (matchingLinks.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('link', 32)}</div><h3>No links match</h3><p>Try adjusting your search or filters.</p></div>`;
        return;
    }

    const rows = matchingLinks.map(link => {
        // The checkbox is ticked for an active link, and its tooltip offers the opposite
        let checkedAttribute;
        let toggleTitle;
        if (link.is_active) {
            checkedAttribute = 'checked';
            toggleTitle = 'Disable';
        } else {
            checkedAttribute = '';
            toggleTitle = 'Enable';
        }

        return `
    <tr>
      <td class="td-slug">${slugCopyHtml(link.slug)}</td>
      <td class="td-dest"><a href="${link.destination}" target="_blank" rel="noopener">${link.destination}</a></td>
      <td>
        <input class="active-check" type="checkbox" ${checkedAttribute} onchange="toggleLink('${link.id}', this.checked)" title="${toggleTitle}">
      </td>
      <td class="access-count" style="white-space:nowrap">${icon('eye')} ${link.access_count ?? 0}</td>
      <td>${tagsHtml(link.tags)}</td>
      <td>${formatDate(link.created_at)}</td>
      <td style="white-space:nowrap">
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm btn-secondary" onclick="openAnalyticsModal('${link.id}')" title="View analytics">${icon('bar-chart')}</button>
          <button class="btn btn-sm btn-secondary" onclick="openEditLink('${link.id}')" title="Edit link">${icon('edit')}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteLink('${link.id}')" title="Delete link">${icon('trash')}</button>
        </div>
      </td>
    </tr>
  `;
    }).join('');

    container.innerHTML = `
    <div class="table-wrap glass">
      <table>
        <thead><tr><th>Short Link</th><th>Destination</th><th>Active</th><th>Views</th><th>Tags</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// Downloads the dashboard's links, as filtered and sorted on screen, as
// my-links.csv: one row per link with its short URL, destination, status,
// tags, visits and dates.
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

    // Quotes a value that holds a comma, a quote or a line break, doubling any quotes inside it
    const escapeCsvValue = (value) => {
        const text = String(value ?? '');
        if (text.includes(',') || text.includes('"') || text.includes('\n')) {
            return '"' + text.replace(/"/g, '""') + '"';
        } else {
            return text;
        }
    };

    const rows = links.map(link => {
        let statusLabel;
        if (link.is_active) {
            statusLabel = 'Active';
        } else {
            statusLabel = 'Inactive';
        }
        return [
            `https://gftv.asia/${link.slug}`,
            link.destination,
            statusLabel,
            (link.tags || []).join('; '),
            link.access_count ?? 0,
            link.created_at,
            link.updated_at
        ].map(escapeCsvValue).join(',');
    });
    const csv = [headers.map(escapeCsvValue).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = 'my-links.csv';
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);

    let pluralSuffix;
    if (links.length !== 1) {
        pluralSuffix = 's';
    } else {
        pluralSuffix = '';
    }
    toast(`Downloaded ${links.length} link${pluralSuffix} as CSV`, 'success');
};

// Wires up the dashboard's search and filters. Typing in the keyword or tag
// box redraws the table 200ms after the last key; the status and sort menus
// redraw it straight away.
function setupDashboardPage() {
    const keywordInput = document.getElementById('dash-search-keyword');
    const tagInput = document.getElementById('dash-search-tag');
    const statusSelect = document.getElementById('dash-filter-status');
    const sortSelect = document.getElementById('dash-sort');

    let debounceTimer;
    keywordInput.addEventListener('input', () => {
        dashboardFilterKeyword = keywordInput.value.trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderDashboardTable, 200);
    });
    tagInput.addEventListener('input', () => {
        dashboardFilterTag = tagInput.value.trim();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderDashboardTable, 200);
    });
    statusSelect.addEventListener('change', () => {
        dashboardFilterStatus = statusSelect.value;
        renderDashboardTable();
    });
    sortSelect.addEventListener('change', () => {
        dashboardSortOrder = sortSelect.value;
        renderDashboardTable();
    });
}

window.toggleLink = async (linkId, isActive) => {
    const response = await Links.update(linkId, {
        is_active: isActive
    });
    if (response.ok) {
        const link = dashboardLinks.find(candidate => candidate.id === linkId);
        if (link) link.is_active = isActive;
        let message;
        if (isActive) {
            message = 'Link enabled';
        } else {
            message = 'Link disabled';
        }
        toast(message, 'success');
    } else {
        toast(response.data.error || 'Failed to toggle link', 'error');
        loadDashboard();
    }
};

window.deleteLink = async (linkId) => {
    if (!confirm('Delete this link? This cannot be undone.')) return;
    const response = await Links.delete(linkId);
    if (response.ok) {
        toast('Link deleted', 'success');
        loadDashboard();
    } else {
        toast(response.data.error || 'Failed to delete', 'error');
    }
};

window.openEditLink = (linkId) => {
    const link = dashboardLinks.find(candidate => candidate.id === linkId);
    if (!link) return;
    editingLinkId = linkId;

    document.getElementById('edit-slug').value = link.slug;
    document.getElementById('edit-dest').value = link.destination;
    document.getElementById('edit-transfer-owner').value = '';
    if (editLinkTagsManager) editLinkTagsManager.setTags(link.tags || []);

    openModal('modal-edit-link');
};

// Wires up the create link and edit link modals. Creating a link with no
// slug makes up a random 8-character one. Saving an edit sends the slug,
// destination and tags, plus a new owner's username when one is typed in.
function setupCreateLinkModal() {
    // Create link tags
    const createTagsContainer = document.getElementById('create-tags-container');
    let createTags = [];
    const createTagsManager = initTagsInput(createTagsContainer, (tags) => {
        createTags = tags;
    });

    document.getElementById('create-link-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const createButton = document.getElementById('create-link-btn');
        createButton.disabled = true;
        createButton.textContent = 'Creating…';

        const slugInput = document.getElementById('create-slug');
        const slug = slugInput.value.trim() || Array.from(crypto.getRandomValues(new Uint8Array(8)), randomByte => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[randomByte % 62]).join('');
        const destination = document.getElementById('create-dest').value.trim();

        const response = await Links.create({
            slug,
            destination,
            tags: createTags
        });
        if (response.ok) {
            toast('Link created!', 'success');
            closeModal('modal-create-link');
            createTagsManager.reset();
            document.getElementById('create-link-form').reset();
            loadDashboard();
        } else {
            toast(response.data.error || 'Failed to create link', 'error');
        }
        createButton.disabled = false;
        createButton.textContent = 'Create Link';
    });

    // Edit link tags
    const editTagsContainer = document.getElementById('edit-tags-container');
    let editTags = [];
    editLinkTagsManager = initTagsInput(editTagsContainer, (tags) => {
        editTags = tags;
    });

    document.getElementById('edit-link-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const ownerInput = document.getElementById('edit-transfer-owner');
        if (rejectSpaces(ownerInput)) { toast(`${NO_SPACES_MESSAGE} in a username`, 'error'); return; }

        const saveButton = document.getElementById('edit-link-btn');
        saveButton.disabled = true;
        saveButton.textContent = 'Saving…';

        const slug = document.getElementById('edit-slug').value.trim();
        const destination = document.getElementById('edit-dest').value.trim();
        const newOwnerUsername = ownerInput.value.trim();

        const body = { slug, destination, tags: editTags };
        if (newOwnerUsername) body.new_owner_username = newOwnerUsername;

        const response = await Links.update(editingLinkId, body);
        if (response.ok) {
            toast('Link updated!', 'success');
            closeModal('modal-edit-link');
            loadDashboard();
        } else {
            toast(response.data.error || 'Failed to update link', 'error');
        }
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
    });
}

// ===== API INTEGRATION PAGE =====
let _apiKeyValue = null; // holds the plaintext key only immediately after generation

// Opens the API page: the key box starts masked and empty while it asks the
// server for the person's key. With a key, it goes into the box (still
// masked), the status line says when it was last regenerated, and the copy
// and show buttons come on. Without one, the box says to click Regenerate.
async function loadApiIntegration() {
    _apiKeyValue = null;
    const keyInput = document.getElementById('api-key-display');
    const statusElement = document.getElementById('api-key-status');
    const copyButton = document.getElementById('api-key-copy-btn');
    const toggleButton = document.getElementById('api-key-toggle-btn');
    if (!keyInput) return;

    keyInput.type = 'password';
    keyInput.value = '';
    keyInput.placeholder = '••••••••••••••••••••';
    if (statusElement) statusElement.textContent = 'Checking for existing API key…';
    if (copyButton) copyButton.disabled = true;
    if (toggleButton) toggleButton.disabled = true;

    const response = await ApiKeys.get();
    if (response.ok && response.data.api_key) {
        // Key exists: show masked placeholder, don't reveal it
        keyInput.value = response.data.api_key;
        keyInput.type = 'password';
        if (statusElement) {
            let lastRegeneratedText;
            if (response.data.updated_at) {
                lastRegeneratedText = ` Last regenerated: ${formatDate(response.data.updated_at)}.`;
            } else {
                lastRegeneratedText = '';
            }
            statusElement.textContent = `You have an active API key.${lastRegeneratedText} Regenerate to get a new one (your old key will stop working immediately).`;
        }
        if (copyButton) copyButton.disabled = false;
        if (toggleButton) toggleButton.disabled = false;
    } else {
        keyInput.value = '';
        keyInput.placeholder = 'No API key yet. Click Regenerate to create one';
        if (statusElement) statusElement.textContent = 'No API key generated yet.';
        if (copyButton) copyButton.disabled = true;
        if (toggleButton) toggleButton.disabled = true;
    }
}

// Shows or masks the API key, and flips the button between "Hide" (eye
// crossed out) and "Show" (open eye).
window.toggleApiKeyVisibility = () => {
    const keyInput = document.getElementById('api-key-display');
    const toggleButton = document.getElementById('api-key-toggle-btn');
    if (!keyInput) return;
    const isHidden = keyInput.type === 'password';
    if (isHidden) {
        keyInput.type = 'text';
    } else {
        keyInput.type = 'password';
    }
    if (toggleButton) {
        if (isHidden) {
            toggleButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg> Hide`;
        } else {
            toggleButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> Show`;
        }
    }
};

window.copyApiKey = async () => {
    const keyInput = document.getElementById('api-key-display');
    if (!keyInput || !keyInput.value) return;
    try {
        await navigator.clipboard.writeText(keyInput.value);
        toast('API key copied to clipboard', 'success');
    } catch {
        toast('Failed to copy, please copy manually', 'error');
    }
};

// Asks the server for a new API key, after a warning if there's already one
// (the old key stops working at once). The new key is shown unmasked, with
// the copy and hide buttons on, until the person leaves the page.
window.regenerateApiKey = async () => {
    const regenerateButton = document.getElementById('api-key-regen-btn');
    const keyInput = document.getElementById('api-key-display');
    const statusElement = document.getElementById('api-key-status');
    const copyButton = document.getElementById('api-key-copy-btn');
    const toggleButton = document.getElementById('api-key-toggle-btn');

    const hasExistingKey = keyInput && keyInput.value;
    if (hasExistingKey && !confirm('Regenerating your API key will immediately invalidate your current key. Any integrations using the old key will stop working. Continue?')) return;

    if (regenerateButton) { regenerateButton.disabled = true; regenerateButton.textContent = 'Generating…'; }

    const response = await ApiKeys.regenerate();
    if (regenerateButton) {
        regenerateButton.disabled = false;
        regenerateButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg> Regenerate`;
    }

    if (response.ok && response.data.api_key) {
        _apiKeyValue = response.data.api_key;
        if (keyInput) {
            keyInput.value = _apiKeyValue;
            keyInput.type = 'text'; // show it immediately after generation
        }
        if (toggleButton) {
            toggleButton.disabled = false;
            toggleButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg> Hide`;
        }
        if (copyButton) copyButton.disabled = false;
        if (statusElement) statusElement.textContent = 'Your new API key is shown above. Copy it now; it will be hidden once you leave this page.';
        toast('API key regenerated successfully', 'success');
    } else {
        toast(response.data?.error || 'Failed to regenerate API key', 'error');
    }
};

// ===== OWNERSHIP REQUESTS =====
// Lists the ownership requests for the person's links: which link, who asked
// and when. A pending request gets Approve and Reject buttons; an answered
// one shows its status as a badge.
async function loadOwnershipRequests() {
    const container = document.getElementById('ownership-list');
    container.innerHTML = loadingHtml();

    const response = await Ownership.list();
    if (!response.ok) {
        container.innerHTML = '<p style="color:var(--danger);padding:20px">Failed to load requests.</p>';
        return;
    }

    const requests = response.data.requests || [];
    if (requests.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('mail-open', 32)}</div><h3>No ownership requests</h3><p>When someone requests ownership of your links, they'll appear here.</p></div>`;
        return;
    }

    container.innerHTML = requests.map(request => {
        let actionsHtml;
        if (request.status === 'pending') {
            actionsHtml = `
          <button class="btn btn-sm btn-success" onclick="respondOwnership('${request.id}','approve')">${icon('check-circle')} Approve</button>
          <button class="btn btn-sm btn-danger" onclick="respondOwnership('${request.id}','reject')">${icon('x-circle')} Reject</button>
        `;
        } else {
            let statusBadgeClass;
            if (request.status === 'approved') {
                statusBadgeClass = 'badge-active';
            } else {
                statusBadgeClass = 'badge-inactive';
            }
            actionsHtml = `<span class="badge ${statusBadgeClass}">${request.status}</span>`;
        }

        return `
    <div class="glass" style="padding:18px 20px;margin-bottom:12px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:200px;">
        <div style="font-weight:700;margin-bottom:2px;">${icon('link')} gftv.asia/${request.gftvlinks_links?.slug || '–'}</div>
        <div style="font-size:0.85rem;color:var(--text-muted);">Requested by <strong>${request.requester?.display_name || request.requester?.username || '?'}</strong> (@${request.requester?.username || '?'})</div>
        <div style="font-size:0.78rem;color:var(--text-light);margin-top:2px;">${formatDate(request.created_at)}</div>
      </div>
      <div style="display:flex;gap:8px;">
        ${actionsHtml}
      </div>
    </div>
  `;
    }).join('');
}

window.respondOwnership = async (requestId, action) => {
    const response = await Ownership.respond(requestId, action);
    if (response.ok) {
        toast(`Request ${action}d`, 'success');
        loadOwnershipRequests();
    } else {
        toast(response.data.error || 'Failed', 'error');
    }
};

// ===== ADMIN PAGE =====
let adminUsers = [];
let adminManageUserId = null;
let adminManageUserData = null;
let adminDeleteStep = 0;

// Loads the admin page: every user, split into "Pending Approval" and
// "Approved Users" tables (each row with its role and status badges, a copy
// email button and an Edit button), and the pre-approved emails below them.
async function loadAdmin() {
    const container = document.getElementById('admin-users-wrap');
    const preapprovedContainer = document.getElementById('admin-preapproved-wrap');
    container.innerHTML = loadingHtml();
    preapprovedContainer.innerHTML = loadingHtml();

    const [usersResponse, preapprovedResponse] = await Promise.all([Admin.users(), Admin.preapproved()]);
    if (!usersResponse.ok) {
        container.innerHTML = '<p style="color:var(--danger);padding:20px">Access denied.</p>';
        preapprovedContainer.innerHTML = '';
        return;
    }

    adminUsers = usersResponse.data.users || [];
    const pendingUsers = adminUsers.filter(user => !user.is_approved);
    const approvedUsers = adminUsers.filter(user => user.is_approved);

    function buildRoleBadgeHtml(user) {
        if (user.is_admin) return '<span class="badge badge-admin">Admin</span>';
        if (!user.is_approved) return '<span class="badge badge-pending">Pending</span>';
        if (user.is_editor) return '<span class="badge badge-editor">Editor</span>';
        return '<span class="badge badge-viewer">Viewer</span>';
    }

    // One row of a users table: the person, email, role, approval, join date and Edit
    function buildUserRowHtml(user) {
        let approvalBadgeHtml;
        if (user.is_approved) {
            approvalBadgeHtml = '<span class="badge badge-active">Approved</span>';
        } else {
            approvalBadgeHtml = '<span class="badge badge-pending">Pending</span>';
        }

        return `<tr>
      <td class="td-user">${avatarHtml(user)}<div><div style="font-weight:700">${user.display_name}</div><div style="font-size:0.8rem;color:var(--text-muted)">@${user.username}</div></div></td>
      <td style="white-space:nowrap">
        <span style="font-size:0.85rem;color:var(--text-muted)">${user.email}</span>
        <button class="btn-copy-inline" data-copy="${user.email}" onclick="copyInline(this)" title="Copy email">${icon('copy')}</button>
      </td>
      <td>${buildRoleBadgeHtml(user)}</td>
      <td>${approvalBadgeHtml}</td>
      <td>${formatDate(user.created_at)}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-sm btn-secondary" onclick="openAdminManageModal('${user.id}')">${icon('edit')} Edit</button>
        </div>
      </td>
    </tr>`;
    }

    let pendingSectionHtml;
    if (pendingUsers.length > 0) {
        pendingSectionHtml = `<div class="table-wrap glass" style="margin-bottom:28px;"><table>
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>${pendingUsers.map(buildUserRowHtml).join('')}</tbody>
        </table></div>`;
    } else {
        pendingSectionHtml = `<div class="empty-state" style="padding:24px"><p>No pending accounts</p></div>`;
    }

    container.innerHTML = `
    <h3 class="section-title">${icon('clock')} Pending Approval (${pendingUsers.length})</h3>
    ${pendingSectionHtml}
    <h3 class="section-title">${icon('check-circle')} Approved Users (${approvedUsers.length})</h3>
    <div class="table-wrap glass"><table>
      <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
      <tbody>${approvedUsers.map(buildUserRowHtml).join('')}</tbody>
    </table></div>
  `;

    // Render pre-approved section
    let preapprovedList;
    if (preapprovedResponse.ok) {
        preapprovedList = preapprovedResponse.data.preapproved || [];
    } else {
        preapprovedList = [];
    }
    renderPreapprovedSection(preapprovedList);
}

// Draws the admin page's "Pre-approved Users" table: each email with a copy
// button, the role it was given, whether it has been used to register yet,
// and a Remove button while it hasn't. An empty state when there are none.
function renderPreapprovedSection(preapprovals) {
    const container = document.getElementById('admin-preapproved-wrap');
    // Unused: the table below lists both kinds together
    const waitingPreapprovals = preapprovals.filter(preapproval => !preapproval.user_id);
    const activatedPreapprovals = preapprovals.filter(preapproval => preapproval.user_id);

    // One row of the table: the email, role, status, dates and, while unused, Remove
    function buildPreapprovalRowHtml(preapproval) {
        let roleBadge;
        if (preapproval.preapproved_role === 'editor') {
            roleBadge = '<span class="badge badge-editor">Editor</span>';
        } else {
            roleBadge = '<span class="badge badge-viewer">Viewer</span>';
        }

        // Once someone has registered with the email, it shows the date and can't be removed
        let statusBadge;
        let activatedDateHtml;
        let removeButtonHtml;
        if (preapproval.activated_at) {
            statusBadge = '<span class="badge badge-active">Activated</span>';
            activatedDateHtml = formatDate(preapproval.activated_at);
            removeButtonHtml = '';
        } else {
            statusBadge = '<span class="badge badge-pending">Waiting</span>';
            activatedDateHtml = '<span style="color:var(--text-muted)">–</span>';
            removeButtonHtml = `<button class="btn btn-sm btn-danger" onclick="removePreapproved('${preapproval.id}')">${icon('x-circle')} Remove</button>`;
        }

        return `<tr>
      <td style="word-break:break-all">
        <span style="font-size:0.85rem">${preapproval.email}</span>
        <button class="btn-copy-inline" data-copy="${preapproval.email}" onclick="copyInline(this)" title="Copy email">${icon('copy')}</button>
      </td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td>${formatDate(preapproval.preapproved_at)}</td>
      <td>${activatedDateHtml}</td>
      <td>
        <div class="action-btns">
          ${removeButtonHtml}
        </div>
      </td>
    </tr>`;
    }

    let tableHtml;
    if (preapprovals.length > 0) {
        tableHtml = `<div class="table-wrap glass"><table>
          <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Pre-approved</th><th>Activated</th><th>Actions</th></tr></thead>
          <tbody>${preapprovals.map(buildPreapprovalRowHtml).join('')}</tbody>
        </table></div>`;
    } else {
        tableHtml = `<div class="empty-state" style="padding:24px"><p>No pre-approved users yet. Use the <strong>Pre-approve User</strong> button to add one.</p></div>`;
    }

    container.innerHTML = `
    <h3 class="section-title"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-2px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> Pre-approved Users (${preapprovals.length})</h3>
    ${tableHtml}
  `;
}

window.removePreapproved = async (preapprovalId) => {
    if (!confirm('Remove this pre-approval? The user will need manual approval if they register.')) return;
    const response = await Admin.deletePreapproved(preapprovalId);
    if (response.ok) {
        toast('Pre-approval removed', 'success');
        await loadAdmin();
    } else {
        toast(response.data.error || 'Failed to remove pre-approval', 'error');
    }
};

// Wires up the "Pre-approve User" modal: checks the email (no spaces, not
// empty), sends it with the chosen role, and reloads the admin page on
// success. Errors show inside the modal.
function setupAddPreapprovedModal() {
    const form = document.getElementById('add-preapproved-form');
    const errorElement = document.getElementById('add-preapproved-error');
    const addButton = document.getElementById('add-preapproved-btn');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorElement.style.display = 'none';

        const emailInput = document.getElementById('preapproved-email');
        if (rejectSpaces(emailInput)) {
            errorElement.textContent = `${NO_SPACES_MESSAGE} in an email address`;
            errorElement.style.display = 'flex';
            return;
        }
        const email = emailInput.value.trim();
        const role = document.getElementById('preapproved-role').value;

        if (!email) {
            errorElement.textContent = 'Please enter an email address';
            errorElement.style.display = 'flex';
            return;
        }

        addButton.disabled = true;
        addButton.textContent = 'Adding…';

        try {
            const response = await Admin.addPreapproved(email, role);
            if (response.ok) {
                toast('User pre-approved successfully', 'success');
                closeModal('modal-add-preapproved');
                form.reset();
                await loadAdmin();
            } else {
                errorElement.textContent = response.data.error || 'Failed to add pre-approved user';
                errorElement.style.display = 'flex';
            }
        } finally {
            addButton.disabled = false;
            addButton.textContent = 'Pre-approve User';
        }
    });
}

// Fills the "you've been pre-approved" page shown straight after registering
// with a pre-approved email: it names the role given, and points its button
// at the page that role starts on (the dashboard for editors, the directory
// for viewers).
function renderPreapprovedPage() {
    const role = state.preapprovedRole || 'viewer';
    let roleLabel;
    let targetPage;
    let buttonLabel;
    if (role === 'editor') {
        roleLabel = 'Editor';
        targetPage = 'dashboard';
        buttonLabel = 'Go to Dashboard →';
    } else {
        roleLabel = 'Viewer';
        targetPage = 'directory';
        buttonLabel = 'Browse the Directory →';
    }

    const roleTextElement = document.getElementById('preapproved-role-text');
    const callToActionButton = document.getElementById('preapproved-cta-btn');
    if (roleTextElement) roleTextElement.textContent = `Congratulations, you have been pre-approved with ${roleLabel} access!`;
    if (callToActionButton) {
        callToActionButton.textContent = buttonLabel;
        callToActionButton.onclick = () => navigate(targetPage);
    }
}

window.loadAdmin = loadAdmin;
window.copyInline = (copyButton) => {
    const text = copyButton.dataset.copy;
    navigator.clipboard.writeText(text).then(() => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => { copyButton.innerHTML = icon('copy'); }, 1500);
    });
};

// Opens the admin's "manage user" modal for one user: the permission
// buttons (grant or revoke editor and viewer, and admin unless it's the
// admin themself), the details form, and the danger zone's delete button
// (replaced by a note when it's the admin's own account).
window.openAdminManageModal = (userId) => {
    const user = adminUsers.find(candidate => candidate.id === userId);
    if (!user) return;
    adminManageUserId = userId;
    adminManageUserData = user;
    const isSelf = user.id === state.user?.id;

    // Subtitle
    document.getElementById('admin-manage-subtitle').textContent = `@${user.username} · ${user.email}`;

    // Permissions buttons: each one offers the opposite of what the user has now
    const permissionButtons = document.getElementById('admin-manage-perm-btns');
    let editorClass;
    let editorLabel;
    let editorAction;
    if (user.is_editor) {
        editorClass = 'btn-warning';
        editorLabel = 'Revoke Editor';
        editorAction = 'revoke_editor';
    } else {
        editorClass = 'btn-success';
        editorLabel = 'Grant Editor';
        editorAction = 'grant_editor';
    }

    let viewerClass;
    let viewerLabel;
    let viewerAction;
    if (user.is_approved) {
        viewerClass = 'btn-danger';
        viewerLabel = 'Revoke Viewer';
        viewerAction = 'revoke_viewer';
    } else {
        viewerClass = 'btn-success';
        viewerLabel = 'Grant Viewer';
        viewerAction = 'grant_viewer';
    }

    let adminClass;
    let adminLabel;
    if (user.is_admin) {
        adminClass = 'btn-warning';
        adminLabel = 'Revoke Admin';
    } else {
        adminClass = 'btn-secondary';
        adminLabel = 'Grant Admin';
    }

    let permissionButtonsHtml = `
        <button class="btn btn-sm ${editorClass}" onclick="adminModalAction('${editorAction}')">${editorLabel}</button>
        <button class="btn btn-sm ${viewerClass}" onclick="adminModalAction('${viewerAction}')">${viewerLabel}</button>
    `;
    if (!isSelf) {
        permissionButtonsHtml += `<button class="btn btn-sm ${adminClass}" onclick="adminModalAction('toggle_admin')">${adminLabel}</button>`;
    }
    permissionButtons.innerHTML = permissionButtonsHtml;

    // Details fields
    document.getElementById('admin-manage-username').value = user.username;
    document.getElementById('admin-manage-displayname').value = user.display_name;
    document.getElementById('admin-manage-email').value = user.email;

    // Danger zone: delete row
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
    const response = await Admin.updateUser(adminManageUserId, action);
    if (response.ok) {
        toast('User updated', 'success');
        await loadAdmin();
        // Refresh modal with updated data
        const updatedUser = adminUsers.find(user => user.id === adminManageUserId);
        if (updatedUser) openAdminManageModal(adminManageUserId);
    } else {
        toast(response.data.error || 'Failed', 'error');
    }
};

window.adminResetPassword = async () => {
    if (!adminManageUserId) return;
    const resetButton = document.querySelector('#modal-admin-manage .admin-danger-row button.btn-warning');
    if (resetButton) { resetButton.disabled = true; resetButton.textContent = 'Resetting…'; }
    const response = await Admin.resetPassword(adminManageUserId);
    if (resetButton) { resetButton.disabled = false; resetButton.textContent = 'Reset Password'; }
    if (response.ok) {
        await navigator.clipboard.writeText(response.data.password);
        toast('Password reset & copied to clipboard', 'success');
    } else {
        toast(response.data.error || 'Failed to reset password', 'error');
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
        const response = await Admin.deleteUser(adminManageUserId);
        if (response.ok) {
            toast('User deleted', 'success');
            closeModal('modal-admin-delete-user');
            closeModal('modal-admin-manage');
            loadAdmin();
        } else {
            toast(response.data.error || 'Failed to delete user', 'error');
            adminDeleteStep = 2;
        }
    }
};

function updateAdminDeleteStep() {
    const dots = document.querySelectorAll('#modal-admin-delete-user .admin-delete-step-dot');
    dots.forEach((dot, dotIndex) => dot.classList.toggle('done', dotIndex <= adminDeleteStep));
    const displayName = adminManageUserData?.display_name || 'this user';
    const stepTexts = [
        `Are you sure you want to delete ${displayName}'s account? All their links will also be deleted.`,
        'This action is irreversible. Their account and all associated data will be permanently removed.',
        'Last chance! Once deleted, you cannot recover this account.',
    ];
    document.getElementById('admin-delete-step-text').textContent = stepTexts[adminDeleteStep];
}

// Wires up the details form in the "manage user" modal: checks the username
// and email for spaces, saves the username, display name and email, then
// reloads the admin page and updates the modal's subtitle.
function setupAdminModal() {
    document.getElementById('admin-manage-details-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!adminManageUserId) return;
        const usernameInput = document.getElementById('admin-manage-username');
        const emailInput = document.getElementById('admin-manage-email');
        const inputWithSpaces = rejectSpaces(usernameInput, emailInput);
        if (inputWithSpaces) {
            let fieldName;
            if (inputWithSpaces === usernameInput) {
                fieldName = 'username';
            } else {
                fieldName = 'email address';
            }
            toast(`${NO_SPACES_MESSAGE} in the ${fieldName}`, 'error');
            return;
        }
        const username = usernameInput.value.trim();
        const displayName = document.getElementById('admin-manage-displayname').value.trim();
        const email = emailInput.value.trim();
        const saveButton = document.getElementById('admin-manage-details-btn');
        saveButton.disabled = true;
        saveButton.textContent = 'Saving…';
        const response = await Admin.updateUserDetails(adminManageUserId, { username, display_name: displayName, email });
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
        if (response.ok) {
            toast('User details updated', 'success');
            await loadAdmin();
            // Refresh subtitle with new values
            const updatedUser = adminUsers.find(user => user.id === adminManageUserId);
            if (updatedUser) {
                adminManageUserData = updatedUser;
                document.getElementById('admin-manage-subtitle').textContent = `@${updatedUser.username} · ${updatedUser.email}`;
            }
        } else {
            toast(response.data.error || 'Failed to update details', 'error');
        }
    });
}

// ===== PROFILE PAGE =====
// Fills the profile page from the signed-in user: the photo (or first
// letter), name, @username and social links at the top, the recent viewers,
// the 2FA tab, and the edit form.
function renderProfile() {
    const user = state.user;
    if (!user) return;

    // Header
    let profileAvatarHtml;
    if (user.avatar_url) {
        profileAvatarHtml = `<img src="${user.avatar_url}" class="profile-avatar" alt="${user.display_name}">`;
    } else {
        profileAvatarHtml = `<div class="profile-avatar-ph">${(user.display_name || user.username)[0].toUpperCase()}</div>`;
    }
    document.getElementById('profile-avatar-wrap').innerHTML = `
    <div class="profile-avatar-wrap">
      ${profileAvatarHtml}
      <div class="profile-avatar-edit" onclick="document.getElementById('avatar-file-input').click()" title="Change photo">${icon('camera')}</div>
    </div>`;

    document.getElementById('profile-display-name').textContent = user.display_name;
    document.getElementById('profile-username').textContent = `@${user.username}`;

    const socials = user.social_links || [];
    const socialLinksElement = document.getElementById('profile-social-links');
    if (socials.length > 0) {
        socialLinksElement.innerHTML = socials.map(social => `<a class="social-link" href="${social.url}" target="_blank" rel="noopener">${icon('external-link')} ${social.label}</a>`).join('');
    } else {
        socialLinksElement.innerHTML = '<span style="color:var(--text-light);font-size:0.85rem">No social links added</span>';
    }

    // Load recent profile viewers
    loadProfilePageViewers(user.id);

    // Render 2FA tab state
    render2FATab();

    // Fill edit form
    document.getElementById('edit-displayname').value = user.display_name;

    // Social links editor
    renderSocialLinksEditor(socials);
}

// Shows the "recent viewers" pills on the profile page, or nothing when no
// one has viewed it yet or the request fails.
async function loadProfilePageViewers(profileId) {
    const viewersContainer = document.getElementById('profile-viewers-wrap');
    if (!viewersContainer) return;
    viewersContainer.innerHTML = '';

    const response = await ProfileViews.getViewers(profileId);
    if (!response.ok || !response.data.viewers?.length) return;

    const viewers = response.data.viewers;
    viewersContainer.innerHTML = `
        <div class="profile-viewers">
            <div class="profile-viewers-label">Recent viewers</div>
            <div class="profile-viewers-pills">
              ${viewers.map(viewer => buildViewerPillHtml(viewer)).join('')}
            </div>
        </div>`;
}

function renderSocialLinksEditor(socials) {
    const container = document.getElementById('social-links-editor');
    container.innerHTML = '';
    socials.forEach((social, index) => {
        const row = document.createElement('div');
        row.className = 'social-link-row';
        row.innerHTML = `
      <input class="form-control" placeholder="Label (e.g. Twitter)" value="${social.label}" data-index="${index}" data-field="label">
      <input class="form-control" placeholder="URL" value="${social.url}" data-index="${index}" data-field="url">
      <button type="button" class="btn btn-icon btn-danger" onclick="removeSocialLink(${index})">×</button>
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

window.removeSocialLink = (index) => {
    const socials = getSocialLinksFromEditor();
    socials.splice(index, 1);
    renderSocialLinksEditor(socials);
};

// Reads the social links editor back into a list of { label, url }, using
// each input's data-index and data-field to put it in the right place.
function getSocialLinksFromEditor() {
    const container = document.getElementById('social-links-editor');
    const inputs = container.querySelectorAll('input');
    const socials = [];
    inputs.forEach(input => {
        const index = parseInt(input.dataset.index);
        if (!socials[index]) socials[index] = {
            label: '',
            url: ''
        };
        socials[index][input.dataset.field] = input.value.trim();
    });
    return socials;
}

// Wires up everything on the profile page that the person can change: the
// avatar upload (compressed to WebP first), the edit profile form (display
// name and social links), the change password form and its strength bar, the
// delete account steps, and "log out all devices".
function setupProfilePage() {
    // Avatar upload
    const avatarInput = document.getElementById('avatar-file-input');
    avatarInput.addEventListener('change', async () => {
        const file = avatarInput.files[0];
        if (!file) return;
        try {
            toast('Compressing image…', 'info');
            const webpDataUrl = await compressToWebp(file);
            const response = await Profile.avatar(webpDataUrl);
            if (response.ok) {
                state.user.avatar_url = response.data.avatar_url;
                toast('Avatar updated!', 'success');
                renderProfile();
                updateNav();
            } else {
                toast(response.data.error || 'Upload failed', 'error');
            }
        } catch (error) {
            toast('Image processing failed: ' + error.message, 'error');
        }
        avatarInput.value = '';
    });

    // Edit profile form
    document.getElementById('edit-profile-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const saveButton = document.getElementById('save-profile-btn');
        saveButton.disabled = true;
        saveButton.textContent = 'Saving…';

        const displayName = document.getElementById('edit-displayname').value.trim();
        const socialLinks = getSocialLinksFromEditor().filter(social => social.label && social.url);

        const response = await Profile.update({
            display_name: displayName,
            social_links: socialLinks
        });
        if (response.ok) {
            state.user.display_name = displayName;
            state.user.social_links = socialLinks;
            toast('Profile updated!', 'success');
            renderProfile();
            updateNav();
        } else {
            toast(response.data.error || 'Failed to update profile', 'error');
        }
        saveButton.disabled = false;
        saveButton.textContent = 'Save Changes';
    });

    // Change password form
    document.getElementById('change-password-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const newPasswordConfirmation = document.getElementById('confirm-new-password').value;

        if (newPassword !== newPasswordConfirmation) {
            toast('Passwords do not match', 'error');
            return;
        }
        if (newPassword.length < 8) {
            toast('Password must be at least 8 characters', 'error');
            return;
        }

        const changeButton = document.getElementById('change-pwd-btn');
        changeButton.disabled = true;
        changeButton.textContent = 'Changing…';

        const response = await Profile.update({
            current_password: currentPassword,
            new_password: newPassword
        });
        if (response.ok) {
            toast('Password changed!', 'success');
            document.getElementById('change-password-form').reset();
        } else {
            toast(response.data.error || 'Failed to change password', 'error');
        }
        changeButton.disabled = false;
        changeButton.textContent = 'Change Password';
    });

    // New password strength
    document.getElementById('new-password').addEventListener('input', function () {
        const strength = getPasswordStrength(this.value);
        document.getElementById('new-pwd-strength').className = `pwd-strength pwd-strength-${strength}`;
    });

    // Delete account
    setupDeleteAccount();

    // Log out all devices
    window.startLogoutAll = () => openModal('modal-logout-all');
    window.confirmLogoutAll = async () => {
        const confirmButton = document.getElementById('logout-all-confirm-btn');
        confirmButton.disabled = true;
        confirmButton.textContent = 'Signing out…';
        const response = await Auth.logoutAll();
        confirmButton.disabled = false;
        confirmButton.textContent = 'Log Out All Devices';
        closeModal('modal-logout-all');
        if (response.ok) {
            clearToken();
            state.user = null;
            state.token = null;
            closeAllModals();
            navigate('home');
            toast('Logged out of all devices.', 'success');
        } else {
            toast(response.data.error || 'Failed to sign out all devices', 'error');
        }
    };
}

// ===== TRUSTED DEVICES =====
// Lists the devices that skip 2FA for this account, each with the date it
// was trusted, when that runs out, and a Remove button. Called by the
// profile page's danger tab in index.html.
async function loadTrustedDevices() {
    const container = document.getElementById('trusted-devices-list');
    if (!container) return;
    container.innerHTML = loadingHtml('Loading trusted devices');

    const response = await TrustedDevices.list();
    if (!response.ok) {
        container.innerHTML = '<div style="color:var(--danger);font-size:0.88rem;">Failed to load devices.</div>';
        return;
    }

    const devices = response.data.devices || [];
    if (devices.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);font-size:0.88rem;padding:8px 0;">No trusted devices found.</div>';
        return;
    }

    container.innerHTML = devices.map(device => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
            <div>
                <div style="font-size:0.9rem;font-weight:500;">Trusted on ${formatDate(device.created_at)}</div>
                <div style="font-size:0.82rem;color:var(--text-muted);">Expires ${formatDate(device.expires_at)}</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="removeTrustedDevice('${device.id}')">Remove</button>
        </div>
    `).join('');
}

window.loadTrustedDevices = loadTrustedDevices;

window.removeTrustedDevice = async (deviceId) => {
    const response = await TrustedDevices.remove(deviceId);
    if (response.ok) {
        toast('Device removed', 'success');
        loadTrustedDevices();
    } else {
        toast(response.data.error || 'Failed to remove device', 'error');
    }
};

// ===== PROFILE 2FA TAB =====
let _totpSetupSecret = null;
let _backupCodes = null; // plaintext codes shown after enable/regenerate

// Puts the profile's 2FA tab back to its starting state: the "2FA is on"
// view or the "2FA is off" view, depending on the account, with every
// setup step hidden. The setup steps that follow (startEnable2FA through
// finishEnable2FA) show one step at a time.
function render2FATab() {
    const totpEnabled = state.user?.totp_enabled;
    let enabledViewDisplay;
    let disabledViewDisplay;
    if (totpEnabled) {
        enabledViewDisplay = 'block';
        disabledViewDisplay = 'none';
    } else {
        enabledViewDisplay = 'none';
        disabledViewDisplay = 'block';
    }
    document.getElementById('totp-enabled-view').style.display = enabledViewDisplay;
    document.getElementById('totp-disabled-view').style.display = disabledViewDisplay;
    document.getElementById('totp-setup-step1').style.display = 'none';
    document.getElementById('totp-setup-step2').style.display = 'none';
    document.getElementById('totp-setup-step3').style.display = 'none';
}

// Step 1 of turning on 2FA: asks the server for a new secret, and shows its
// QR code and the key to type in by hand. "Next" stays off until they've
// arrived. If the request fails, the tab goes back to its starting state.
window.startEnable2FA = async () => {
    document.getElementById('totp-disabled-view').style.display = 'none';
    document.getElementById('totp-setup-step1').style.display = 'block';

    const qrImage = document.getElementById('totp-qr-img');
    const spinner = document.getElementById('totp-qr-spinner');
    const manualKeyElement = document.getElementById('totp-manual-key');
    const nextButton = document.getElementById('totp-next-btn');

    qrImage.style.display = 'none';
    spinner.style.display = 'flex';
    nextButton.disabled = true;
    manualKeyElement.textContent = '';
    _totpSetupSecret = null;

    const response = await Totp.setup();
    spinner.style.display = 'none';

    if (response.ok) {
        _totpSetupSecret = response.data.secret;
        qrImage.src = response.data.qr_data_url;
        qrImage.style.display = 'block';
        manualKeyElement.textContent = response.data.secret;
        nextButton.disabled = false;
    } else {
        toast(response.data.error || 'Failed to generate 2FA setup', 'error');
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

// Step 2 of turning on 2FA: sends the 6-digit code from the person's app
// with the secret from step 1. On success, 2FA is on and step 3 shows the
// backup codes the server sent back; otherwise the error shows in the tab.
window.confirmEnable2FA = async () => {
    const code = document.getElementById('totp-verify-code').value.trim();
    const errorElement = document.getElementById('totp-enable-error');
    const enableButton = document.getElementById('totp-enable-btn');

    if (!code || code.length !== 6) {
        errorElement.textContent = 'Please enter the 6-digit code';
        errorElement.style.display = 'flex';
        return;
    }

    errorElement.style.display = 'none';
    enableButton.disabled = true;
    enableButton.textContent = 'Enabling…';

    const response = await Totp.enable(_totpSetupSecret, code);

    enableButton.disabled = false;
    enableButton.textContent = 'Enable 2FA';

    if (response.ok) {
        state.user.totp_enabled = true;
        _totpSetupSecret = null;
        _backupCodes = response.data.backup_codes || [];
        // Show step 3: backup codes
        document.getElementById('totp-setup-step2').style.display = 'none';
        document.getElementById('totp-setup-step3').style.display = 'block';
        renderBackupCodesGrid('backup-codes-grid', _backupCodes);
    } else {
        errorElement.textContent = response.data.error || 'Failed to enable 2FA';
        errorElement.style.display = 'flex';
    }
};

function renderBackupCodesGrid(gridId, codes) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = codes.map(code =>
        `<div class="backup-code-item"><code>${code}</code></div>`
    ).join('');
}

window.copyBackupCodes = () => {
    const text = _backupCodes?.join('\n') || '';
    navigator.clipboard.writeText(text).then(() => toast('Backup codes copied!', 'success')).catch(() => {});
};

window.downloadBackupCodes = () => {
    const text = (_backupCodes || []).join('\n');
    const blob = new Blob([`GFTV Links Portal: 2FA Backup Codes\nGenerated: ${new Date().toUTCString()}\n\n${text}\n\nEach code can only be used once. Keep these safe.`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = 'gftvlinks-backup-codes.txt';
    downloadAnchor.click();
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

// Wires up the "turn off 2FA" modal: sends the password, and on success
// marks 2FA off, closes the modal and redraws the 2FA tab. Errors show
// inside the modal.
function setupDisable2FAModal() {
    document.getElementById('disable-2fa-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const password = document.getElementById('disable-2fa-password').value;
        const errorElement = document.getElementById('disable-2fa-error');
        const disableButton = document.getElementById('disable-2fa-btn');

        errorElement.style.display = 'none';
        disableButton.disabled = true;
        disableButton.textContent = 'Disabling…';

        const response = await Totp.disable(password);

        disableButton.disabled = false;
        disableButton.textContent = 'Disable 2FA';

        if (response.ok) {
            state.user.totp_enabled = false;
            closeModal('modal-disable-2fa');
            toast('2FA has been disabled.', 'success');
            render2FATab();
        } else {
            errorElement.textContent = response.data.error || 'Failed to disable 2FA';
            errorElement.style.display = 'flex';
        }
    });
}

// ===== REGENERATE BACKUP CODES =====
let _modalBackupCodes = null;

window.startRegenerateBackupCodes = () => {
    document.getElementById('regen-backup-password').value = '';
    document.getElementById('regen-backup-error').style.display = 'none';
    openModal('modal-regen-backup-codes');
};

// Wires up the "regenerate backup codes" modal: sends the password, and on
// success closes it and opens a second modal showing the new codes. Errors
// show inside the first modal.
function setupRegenerateBackupCodesModal() {
    document.getElementById('regen-backup-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const password = document.getElementById('regen-backup-password').value;
        const errorElement = document.getElementById('regen-backup-error');
        const generateButton = document.getElementById('regen-backup-btn');

        errorElement.style.display = 'none';
        generateButton.disabled = true;
        generateButton.textContent = 'Generating…';

        const response = await Totp.regenerateCodes(password);

        generateButton.disabled = false;
        generateButton.textContent = 'Generate New Codes';

        if (response.ok) {
            _modalBackupCodes = response.data.backup_codes || [];
            closeModal('modal-regen-backup-codes');
            renderBackupCodesGrid('modal-backup-codes-grid', _modalBackupCodes);
            openModal('modal-backup-codes-display');
        } else {
            errorElement.textContent = response.data.error || 'Failed to regenerate backup codes';
            errorElement.style.display = 'flex';
        }
    });
}

window.copyModalBackupCodes = () => {
    const text = _modalBackupCodes?.join('\n') || '';
    navigator.clipboard.writeText(text).then(() => toast('Backup codes copied!', 'success')).catch(() => {});
};

window.downloadModalBackupCodes = () => {
    const text = (_modalBackupCodes || []).join('\n');
    const blob = new Blob([`GFTV Links Portal: 2FA Backup Codes\nGenerated: ${new Date().toUTCString()}\n\n${text}\n\nEach code can only be used once. Keep these safe.`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = 'gftvlinks-backup-codes.txt';
    downloadAnchor.click();
    URL.revokeObjectURL(url);
};

// ===== DELETE ACCOUNT =====
// Wires up deleting your own account (hidden for admins): three warning
// steps in one modal, then a final modal that asks for the password. On
// success the person is signed out and sent to the home page.
function setupDeleteAccount() {
    if (state.user?.is_admin) {
        const deleteSection = document.getElementById('delete-account-section');
        if (deleteSection) deleteSection.style.display = 'none';
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
        dots.forEach((dot, dotIndex) => dot.classList.toggle('done', dotIndex <= deleteStep));

        const stepTexts = [
            'Are you sure you want to delete your account? All your links will also be deleted.',
            'This action is irreversible. Your account and all associated data will be permanently removed.',
            'Last chance! Once deleted, you cannot recover your account.',
        ];
        document.getElementById('delete-step-text').textContent = stepTexts[deleteStep];
    }

    document.getElementById('delete-final-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const password = document.getElementById('delete-confirm-password').value;
        const deleteButton = document.getElementById('delete-account-final-btn');
        deleteButton.disabled = true;
        deleteButton.textContent = 'Deleting…';

        const response = await Profile.delete(password);
        if (response.ok) {
            clearToken();
            state.user = null;
            state.token = null;
            closeAllModals();
            toast('Account deleted. Goodbye!', 'info', 5000);
            navigate('home');
        } else {
            toast(response.data.error || 'Failed to delete account', 'error');
            deleteButton.disabled = false;
            deleteButton.textContent = 'Permanently Delete Account';
        }
    });
}

// ===== HOME PAGE =====
function initHomePage() {
    startTypingAnimation();
    loadHomeStats();
}

// The home page's typing effect: types out each example slug a letter at a
// time, holds it, deletes it, and moves on to the next, every 70ms, for as
// long as the home page is showing (showPage stops it).
function startTypingAnimation() {
    // Clear any existing animation
    if (homeTypingInterval) {
        clearInterval(homeTypingInterval);
        homeTypingInterval = null;
    }

    const slugs = ['we-care', 'takagi', 'join', 'apac', 'telegram', 'discord', 'linkedin', 'youtube', 'policy', 'hello', 'furst'];
    const slugElement = document.getElementById('home-typing-slug');
    if (!slugElement) return;

    let slugIndex = 0;
    let characterIndex = 0;
    let isDeleting = false;
    let pauseCounter = 0;

    // One step of the animation: wait out a pause, or type or delete one letter
    function tick() {
        const currentSlug = slugs[slugIndex];

        if (pauseCounter > 0) {
            pauseCounter--;
            return;
        }

        if (!isDeleting) {
            // Typing
            characterIndex++;
            slugElement.textContent = currentSlug.slice(0, characterIndex);
            if (characterIndex === currentSlug.length) {
                isDeleting = true;
                pauseCounter = 20; // Pause before deleting (~1.4s at 70ms interval)
            }
        } else {
            // Deleting
            characterIndex--;
            slugElement.textContent = currentSlug.slice(0, characterIndex);
            if (characterIndex === 0) {
                isDeleting = false;
                slugIndex = (slugIndex + 1) % slugs.length;
                pauseCounter = 5; // Brief pause before next word
            }
        }
    }

    homeTypingInterval = setInterval(tick, 70);
}

async function loadHomeStats() {
    const response = await Stats.get();
    if (!response.ok) return;

    const { officers, links, clicks } = response.data;

    animateCounter('home-stat-officers', officers);
    animateCounter('home-stat-links', links);
    animateCounter('home-stat-clicks', clicks);
}

// Counts a home page stat up from 0 to its value in 40 steps over 1.2s.
function animateCounter(elementId, target) {
    const counterElement = document.getElementById(elementId);
    if (!counterElement) return;

    if (target === 0) {
        counterElement.textContent = '0';
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
        counterElement.textContent = Math.round(current).toLocaleString();
    }, stepTime);
}

// ===== THEME PICKER =====
function renderThemeGrid() {
    const grid = document.getElementById('theme-grid');
    if (!grid) return;
    grid.innerHTML = COLOR_THEMES.map(theme => {
        let activeClass;
        if (state.colorTheme === theme.id) {
            activeClass = 'active';
        } else {
            activeClass = '';
        }
        return `
    <button type="button" class="appearance-option theme-swatch ${activeClass}"
      data-theme-id="${theme.id}">
      <span class="theme-swatch-dot" style="background:${theme.color};"></span>
      <span class="theme-swatch-name">${theme.label}</span>
      <span class="theme-swatch-hex">${theme.color}</span>
    </button>
  `;
    }).join('');
}

// The pressed button follows the preference, the note says what the clock has
// resolved it to, so "Time-based" stays pressed in the evening rather than "Dark".
function updateModeOptions() {
    const preference = state.modePreference;
    document.querySelectorAll('[data-mode-option]').forEach(modeButton => {
        const pressed = modeButton.dataset.modeOption === preference;
        modeButton.classList.toggle('active', pressed);
        modeButton.setAttribute('aria-pressed', String(pressed));
    });
    const note = document.getElementById('mode-note');
    if (note) {
        if (preference === 'time') {
            note.textContent = `Light from ${LIGHT_FROM_HOUR}:00 to ${LIGHT_UNTIL_HOUR}:00 on this device's clock. Currently ${state.mode}.`;
            note.hidden = false;
        } else {
            note.textContent = '';
            note.hidden = true;
        }
    }
}

// Wires up the theme modal: clicking a colour swatch applies that theme, and
// clicking a mode button (light, dark, time) applies that preference. Each
// change says so in a toast.
function setupThemePicker() {
    renderThemeGrid();

    const grid = document.getElementById('theme-grid');
    grid?.addEventListener('click', (event) => {
        const swatch = event.target.closest('.theme-swatch');
        if (!swatch) return;
        const themeId = swatch.dataset.themeId;
        applyColorTheme(themeId);
        document.querySelectorAll('.theme-swatch').forEach(otherSwatch => otherSwatch.classList.remove('active'));
        swatch.classList.add('active');
        const theme = COLOR_THEMES.find(candidate => candidate.id === themeId);
        toast(`Theme changed to ${theme.label}`, 'success');
    });

    document.getElementById('mode-options')?.addEventListener('click', (event) => {
        const modeButton = event.target.closest('[data-mode-option]');
        if (!modeButton) return;
        const preference = modeButton.dataset.modeOption;
        if (preference === state.modePreference) return;
        applyMode(preference);
        let message;
        if (preference === 'time') {
            message = 'Following the clock: light by day, dark by night';
        } else {
            message = `Switched to ${preference} mode`;
        }
        toast(message, 'success');
    });

    // A tab held open across 09:00 or 18:00 re-resolves itself; redraw the
    // modal so it does not show the answer from before dinner.
    document.addEventListener('gftv:modechange', updateModeOptions);
    updateModeOptions();
}

// ===== HAMBURGER MENU =====
// The mobile menu: the hamburger button opens and closes the drawer, and a
// click anywhere outside both closes it.
function setupHamburger() {
    const hamburgerButton = document.getElementById('hamburger-btn');
    const drawer = document.getElementById('mobile-nav');
    hamburgerButton?.addEventListener('click', () => {
        drawer.classList.toggle('open');
    });
    document.addEventListener('click', (event) => {
        if (!hamburgerButton?.contains(event.target) && !drawer?.contains(event.target)) {
            drawer?.classList.remove('open');
        }
    });
}

// ===== QR CODE MODAL =====
// Draws the QR code image for a short link on a canvas: a white card with
// the QR code (high error correction, so the GFTV logo can sit in the middle)
// and the URL underneath, wrapped to the QR code's width. Without the logo
// file, the QR code is drawn without it.
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
    const measureContext = measureCanvas.getContext('2d');
    measureContext.font = `bold ${fontSize}px 'Courier New', monospace`;
    const maxTextWidth = qrSize;
    const lines = [];
    let currentLine = '';
    for (const character of url) {
        const testLine = currentLine + character;
        if (measureContext.measureText(testLine).width > maxTextWidth) {
            lines.push(currentLine);
            currentLine = character;
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
    const canvasContext = canvas.getContext('2d');

    canvasContext.fillStyle = '#ffffff';
    canvasContext.fillRect(0, 0, totalWidth, totalHeight);

    canvasContext.drawImage(qrCanvas, paddingX, paddingTop, qrSize, qrSize);

    // Overlay center logo (level H error correction allows ~30% occlusion)
    try {
        const logo = await new Promise((resolve, reject) => {
            const logoImage = new Image();
            logoImage.onload = () => resolve(logoImage);
            logoImage.onerror = reject;
            logoImage.src = '/gsl-qr.png';
        });
        const logoSize = Math.round(qrSize * 0.22);
        const logoPadding = 5;
        const logoX = paddingX + (qrSize - logoSize) / 2;
        const logoY = paddingTop + (qrSize - logoSize) / 2;
        canvasContext.fillStyle = '#ffffff';
        canvasContext.fillRect(logoX - logoPadding, logoY - logoPadding, logoSize + logoPadding * 2, logoSize + logoPadding * 2);
        canvasContext.drawImage(logo, logoX, logoY, logoSize, logoSize);
    } catch { /* skip logo if image unavailable */ }

    canvasContext.fillStyle = '#111111';
    canvasContext.font = `bold ${fontSize}px 'Courier New', monospace`;
    canvasContext.textAlign = 'center';
    const textStartY = paddingTop + qrSize + paddingGap + fontSize;
    lines.forEach((line, lineIndex) => {
        canvasContext.fillText(line, totalWidth / 2, textStartY + lineIndex * lineHeight);
    });

    return canvas;
}

window.openQrModal = async (slug) => {
    const url = `https://gftv.asia/${slug}`;
    document.getElementById('qr-modal-subtitle').textContent = url;
    const container = document.getElementById('qr-canvas-container');
    container.innerHTML = loadingHtml();
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
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = URL.createObjectURL(blob);
        downloadAnchor.download = `qr-${window._qrSlug || 'code'}.png`;
        downloadAnchor.click();
        setTimeout(() => URL.revokeObjectURL(downloadAnchor.href), 5000);
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
    } catch (error) {
        if (error.name !== 'AbortError') toast('Failed to share', 'error');
    }
};

// ===== LINK ANALYTICS MODAL =====
let analyticsLinkId = null;
let analyticsData = null;
let analyticsActiveTab = 'devices';

// Opens the analytics modal for one of the person's links on its "Devices"
// tab, loading, then fetches the link's analytics, fills in the total
// clicks and draws the chosen tab.
window.openAnalyticsModal = async (linkId) => {
    analyticsLinkId = linkId;
    analyticsData = null;
    analyticsActiveTab = 'devices';

    const link = dashboardLinks.find(candidate => candidate.id === linkId);
    if (!link) return;

    document.getElementById('analytics-modal-slug').textContent = 'https://gftv.asia/' + link.slug;
    document.getElementById('analytics-total-clicks').textContent = '– total clicks';
    document.getElementById('analytics-tab-content').innerHTML = loadingHtml();

    // Reset tabs to first tab
    document.querySelectorAll('.analytics-tab-btn').forEach(tabButton => tabButton.classList.remove('active'));
    const firstTab = document.querySelector('.analytics-tab-btn[data-tab="devices"]');
    if (firstTab) firstTab.classList.add('active');

    openModal('modal-analytics');

    const response = await Links.analytics(linkId);
    if (!response.ok) {
        document.getElementById('analytics-tab-content').innerHTML = `<p style="color:var(--danger);padding:20px">Failed to load analytics.</p>`;
        return;
    }
    analyticsData = response.data;

    const totalClicks = analyticsData.total_clicks || 0;
    let pluralSuffix;
    if (totalClicks !== 1) {
        pluralSuffix = 's';
    } else {
        pluralSuffix = '';
    }
    document.getElementById('analytics-total-clicks').textContent = `${totalClicks} total click${pluralSuffix}`;

    renderAnalyticsTabContent(analyticsActiveTab);
};

window.switchAnalyticsTab = (tab, tabButton) => {
    analyticsActiveTab = tab;
    document.querySelectorAll('.analytics-tab-btn').forEach(otherTabButton => otherTabButton.classList.remove('active'));
    if (tabButton) tabButton.classList.add('active');
    if (analyticsData) {
        renderAnalyticsTabContent(tab);
    } else {
        document.getElementById('analytics-tab-content').innerHTML = loadingHtml();
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

// The "Devices" tab: one bar split by each device type's share of the
// clicks (desktop, tablet, mobile, others), with a legend of percentages.
function renderAnalyticsDevices(data) {
    const DEVICE_TYPES = ['Desktop', 'Tablet', 'Mobile', 'Others'];
    const DEVICE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

    const counts = { Desktop: 0, Tablet: 0, Mobile: 0, Others: 0 };
    (data.devices || []).forEach(deviceRow => {
        if (counts.hasOwnProperty(deviceRow.device_type)) counts[deviceRow.device_type] = Number(deviceRow.cnt);
    });
    const total = DEVICE_TYPES.reduce((sum, deviceType) => sum + counts[deviceType], 0);
    const formatPercentage = (count) => {
        if (total > 0) {
            return ((count / total) * 100).toFixed(1);
        } else {
            return '0.0';
        }
    };

    const segments = DEVICE_TYPES.map((deviceType, typeIndex) => {
        let widthPercent;
        if (total > 0) {
            widthPercent = (counts[deviceType] / total) * 100;
        } else {
            widthPercent = 0;
        }
        if (widthPercent > 0) {
            return `<div style="width:${widthPercent}%;background:${DEVICE_COLORS[typeIndex]};height:100%;"></div>`;
        } else {
            return '';
        }
    }).join('');

    const legend = DEVICE_TYPES.map((deviceType, typeIndex) => `
        <div style="display:flex;flex-direction:column;gap:3px;min-width:70px;">
            <div style="display:flex;align-items:center;gap:6px;">
                <span style="width:10px;height:10px;border-radius:50%;background:${DEVICE_COLORS[typeIndex]};display:inline-block;flex-shrink:0;"></span>
                <span style="font-size:0.82rem;color:var(--text-muted)">${deviceType}</span>
            </div>
            <div style="font-size:1.05rem;font-weight:700;padding-left:16px;">${formatPercentage(counts[deviceType])}%</div>
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

// The "Clicks" tab: an SVG line chart of clicks per day over the last 7 days
// (UTC), with a link to download every day's clicks as a CSV file.
function renderAnalyticsClicks(data) {
    // Build the 7-day window ending today (UTC)
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const days = [];
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
        const date = new Date(today);
        date.setUTCDate(date.getUTCDate() - daysAgo);
        days.push({
            date: date.toISOString().split('T')[0],
            label: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
            count: 0,
        });
    }
    (data.daily_clicks || []).forEach(item => {
        const day = days.find(candidate => candidate.date === item.day);
        if (day) day.count = Number(item.cnt);
    });

    // The chart's size, the padding around the plotted area, and the space between days
    const maxCount = Math.max(...days.map(day => day.count), 1);
    const chartWidth = 520;
    const chartHeight = 160;
    const paddingLeft = 28;
    const paddingRight = 12;
    const paddingTop = 16;
    const paddingBottom = 28;
    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;
    const daySpacing = plotWidth / 6;

    const points = days.map((day, dayIndex) => ({
        left: paddingLeft + dayIndex * daySpacing,
        top: paddingTop + plotHeight - (day.count / maxCount) * plotHeight,
        count: day.count,
        label: day.label,
    }));

    // Y-axis reference lines: one per whole number up to a maximum of 4,
    // otherwise 0, the halfway mark and the maximum
    let axisValues;
    if (maxCount <= 4) {
        axisValues = Array.from({ length: maxCount + 1 }, (unusedValue, index) => index);
    } else {
        axisValues = [0, Math.ceil(maxCount / 2), maxCount];
    }
    const gridLines = axisValues.map(axisValue => {
        const lineY = paddingTop + plotHeight - (axisValue / maxCount) * plotHeight;
        return `<line x1="${paddingLeft}" y1="${lineY}" x2="${paddingLeft + plotWidth}" y2="${lineY}" stroke="var(--border)" stroke-width="1"/>
                <text x="${paddingLeft - 4}" y="${lineY + 4}" text-anchor="end" font-size="10" fill="var(--text-muted)">${axisValue}</text>`;
    }).join('');

    const polylinePoints = points.map(point => `${point.left},${point.top}`).join(' ');
    const dots = points.map(point => `<circle cx="${point.left}" cy="${point.top}" r="3.5" fill="var(--brand-darker)"/>`).join('');
    const dayLabels = points.map(point =>
        `<text x="${point.left}" y="${chartHeight - 4}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${point.label}</text>`
    ).join('');

    const linkId = analyticsLinkId;
    return `
        <p style="font-size:0.95rem;font-weight:600;margin-bottom:6px;">How many users have visited your link in the past week?</p>
        <p style="margin-bottom:18px;">
            <a href="#" onclick="window.downloadAllClicks(event,'${linkId}')" style="color:var(--brand-text);font-size:0.83rem;display:inline-flex;align-items:center;gap:4px;">
                Download full link click statistics here ${icon('download', 13)}
            </a>
        </p>
        <div style="overflow-x:auto;">
            <svg viewBox="0 0 ${chartWidth} ${chartHeight}" style="width:100%;min-width:280px;" xmlns="http://www.w3.org/2000/svg">
                <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + plotHeight}" stroke="var(--border)" stroke-width="1"/>
                ${gridLines}
                <polyline points="${polylinePoints}" fill="none" stroke="var(--brand-darker)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
                ${dots}
                ${dayLabels}
            </svg>
        </div>
    `;
}

// The "Traffic" tab: a heatmap of clicks by day of the week (rows, Monday
// first) and hour of the day (columns). Each cell is shaded by its clicks
// against the busiest hour's, and a legend runs from 0 to that busiest count.
function renderAnalyticsTraffic(data) {
    // PostgreSQL DOW: 0=Sun, 1=Mon ... 6=Sat; display Mon first
    const DAY_OF_WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
    const DAY_OF_WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const HOUR_LABELS = Array.from({ length: 24 }, (unusedValue, hour) => {
        if (hour === 0) return '12am';
        if (hour === 12) return '12pm';
        if (hour < 12) {
            return `${hour}am`;
        } else {
            return `${hour - 12}pm`;
        }
    });

    // Clicks per "day of week:hour" cell, and the busiest cell's count
    const clickCounts = {};
    let maxCount = 0;
    (data.heatmap || []).forEach(item => {
        const cellKey = `${item.dow}:${item.hr}`;
        clickCounts[cellKey] = Number(item.cnt);
        if (clickCounts[cellKey] > maxCount) maxCount = clickCounts[cellKey];
    });

    const LABELLED_HOURS = new Set([0, 6, 12, 18]);

    const headerCells = Array.from({ length: 24 }, (unusedValue, hour) => {
        let hourLabel;
        if (LABELLED_HOURS.has(hour)) {
            hourLabel = HOUR_LABELS[hour];
        } else {
            hourLabel = '';
        }
        return `<th style="padding:0 1px;text-align:center;font-size:9px;color:var(--text-light);font-weight:400;white-space:nowrap;min-width:20px;">${hourLabel}</th>`;
    }).join('');

    // One row per day, with a cell per hour whose tooltip gives the click count
    const bodyRows = DAY_OF_WEEK_ORDER.map((dayOfWeek, rowIndex) => {
        const cells = Array.from({ length: 24 }, (unusedValue, hour) => {
            const clickCount = clickCounts[`${dayOfWeek}:${hour}`] || 0;
            let intensity;
            if (maxCount > 0) {
                intensity = clickCount / maxCount;
            } else {
                intensity = 0;
            }
            let cellBackground;
            if (clickCount > 0) {
                cellBackground = `rgba(var(--heat-rgb),${(0.12 + intensity * 0.82).toFixed(2)})`;
            } else {
                cellBackground = 'var(--surface)';
            }
            let pluralSuffix;
            if (clickCount !== 1) {
                pluralSuffix = 's';
            } else {
                pluralSuffix = '';
            }
            const title = `${DAY_OF_WEEK_LABELS[rowIndex]} ${HOUR_LABELS[hour]}: ${clickCount} click${pluralSuffix}`;
            return `<td title="${title}" style="width:20px;height:20px;background:${cellBackground};border:1px solid var(--border);border-radius:3px;"></td>`;
        }).join('');
        return `<tr>
            <td style="font-size:11px;color:var(--text-muted);padding-right:8px;white-space:nowrap;vertical-align:middle;">${DAY_OF_WEEK_LABELS[rowIndex]}</td>
            ${cells}
        </tr>`;
    }).join('');

    // Legend: 5 steps from empty → max
    const legendBoxes = [0, 0.12, 0.35, 0.6, 0.9].map((alpha, boxIndex) => {
        let boxBackground;
        if (boxIndex === 0) {
            boxBackground = 'var(--surface)';
        } else {
            boxBackground = `rgba(var(--heat-rgb),${alpha})`;
        }
        return `<div style="width:16px;height:16px;background:${boxBackground};border:1px solid var(--border);border-radius:3px;"></div>`;
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
            <span>${maxCount}+</span>
        </div>
    `;
}

// The "History" tab: a timeline of the link's changes in the order the
// server sends them, each with its date and time, and with ACTIVE, INACTIVE
// and any URL in bold.
function renderAnalyticsHistory(data) {
    const link = dashboardLinks.find(candidate => candidate.id === analyticsLinkId);
    let slug;
    if (link) {
        slug = link.slug;
    } else {
        slug = '';
    }
    const history = data.history || [];

    if (history.length === 0) {
        return `<div class="empty-state" style="padding:32px 0;">${icon('clock', 28)}<p style="margin-top:8px;">No history recorded yet.</p></div>`;
    }

    // One timeline entry per change: a dot, its date and time, and what changed
    const items = history.map((item, itemIndex) => {
        const isLast = itemIndex === history.length - 1;
        const dateText = new Date(item.created_at).toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit',
        });
        // Bold key terms in description
        const descriptionHtml = item.description
            .replace(/\bACTIVE\b/g, '<strong>ACTIVE</strong>')
            .replace(/\bINACTIVE\b/g, '<strong>INACTIVE</strong>')
            .replace(/(https?:\/\/[^\s]+)/g, '<strong>$1</strong>');

        // Every entry but the last has a line down to the next one, and space below it
        let connectorLineHtml;
        let bottomPadding;
        if (isLast) {
            connectorLineHtml = '';
            bottomPadding = '0';
        } else {
            connectorLineHtml = `<div style="width:2px;flex:1;background:var(--border);margin-top:4px;min-height:32px;"></div>`;
            bottomPadding = '20px';
        }

        return `
            <div style="display:flex;gap:14px;align-items:flex-start;">
                <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
                    <div style="width:11px;height:11px;border-radius:50%;background:var(--text-muted);margin-top:3px;"></div>
                    ${connectorLineHtml}
                </div>
                <div style="padding-bottom:${bottomPadding};">
                    <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:3px;">${dateText}</div>
                    <div style="font-size:0.88rem;line-height:1.5;">${descriptionHtml}</div>
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

// Downloads every day's clicks for a link as analytics-<slug>.csv (date,
// clicks), from the "Clicks" tab's link.
window.downloadAllClicks = (event, linkId) => {
    event.preventDefault();
    if (!analyticsData) return;
    const rows = ['date,clicks'];
    (analyticsData.all_daily_clicks || []).forEach(item => rows.push(`${item.day},${item.cnt}`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    const link = dashboardLinks.find(candidate => candidate.id === linkId);
    let fileNamePart;
    if (link) {
        fileNamePart = link.slug;
    } else {
        fileNamePart = linkId;
    }
    downloadAnchor.download = `analytics-${fileNamePart}.csv`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
};

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
    setupRegenerateBackupCodesModal();
    setupAdminModal();
    setupAddPreapprovedModal();
    setupThemePicker();
    setupHamburger();

    // Theme picker open
    document.getElementById('theme-picker-btn')?.addEventListener('click', () => openModal('modal-theme'));

    // Close buttons
    document.querySelectorAll('[data-close-modal]').forEach(closeButton => {
        closeButton.addEventListener('click', () => closeModal(closeButton.dataset.closeModal));
    });

    init();
});