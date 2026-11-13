// ===== SVG ICONS =====
const ICON_PATHS = {
    palette: `<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>`,
    list: `<rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>`,
    home: `<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
    inbox: `<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>`,
    settings: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
    refresh: `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>`,
    user: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
    edit: `<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>`,
    lock: `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
    alert: `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
    link: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
    shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
    logout: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`,
    eye: `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>`,
    trash: `<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>`,
    'mail-open': `<path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z"/><path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10"/>`,
    'check-circle': `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>`,
    'x-circle': `<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>`,
    info: `<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>`,
    clock: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
    search: `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`,
    camera: `<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>`,
    'external-link': `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>`,
    copy: `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
    qr: `<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>`,
    download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
    share: `<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>`,
    'bar-chart': `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
    monitor: `<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>`,
    'line-chart': `<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>`,
    grid: `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>`,
    history: `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>`,
    api: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
    sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`,
    moon: `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`,
};

export function icon(name, size = 16) {
    const paths = ICON_PATHS[name] || '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:-3px;flex-shrink:0">${paths}</svg>`;
}

// ===== LOADING =====
// A spinner announces nothing on its own, so it carries a label for screen
// readers and a live region; .delayed keeps it invisible for the first 250ms.
export function loadingHtml(label = 'Loading') {
    return `<div class="loading-wrap delayed" role="status"><div class="spinner" aria-hidden="true"></div><span class="sr-only">${label}</span></div>`;
}

// ===== TOAST =====
export function toast(message, type = 'info', duration = 3000) {
    const toastIcons = {
        success: icon('check-circle'),
        error: icon('x-circle'),
        info: icon('info'),
    };
    const toastElement = document.createElement('div');
    toastElement.className = `toast toast-${type}`;
    toastElement.innerHTML = `<span>${toastIcons[type] || ''}</span><span>${message}</span>`;
    const container = document.getElementById('toast-container');
    container.appendChild(toastElement);
    setTimeout(() => {
        toastElement.style.opacity = '0';
        toastElement.style.transform = 'translateX(24px)';
        toastElement.style.transition = 'all 0.3s';
        setTimeout(() => toastElement.remove(), 300);
    }, duration);
}

// ===== MODAL =====
export function openModal(id) {
    const modalElement = document.getElementById(id);
    if (modalElement) modalElement.classList.add('open');
}
export function closeModal(id) {
    const modalElement = document.getElementById(id);
    if (modalElement) modalElement.classList.remove('open');
}
export function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modalElement => modalElement.classList.remove('open'));
}

// Click outside to close
document.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.classList.remove('open');
    }
});

// ===== COPY TO CLIPBOARD =====
export async function copyText(text, button = null) {
    try {
        await navigator.clipboard.writeText(text);
        if (button) {
            const originalHtml = button.innerHTML;
            button.innerHTML = `${icon('check-circle')} Copied!`;
            button.classList.add('copied');
            setTimeout(() => {
                button.innerHTML = originalHtml;
                button.classList.remove('copied');
            }, 1800);
        }
        return true;
    } catch {
        return false;
    }
}

// ===== TAGS INPUT =====
// Sets up the tag chips inside `container`: typing a comma or pressing Enter
// adds a tag (lowercase, up to 24 characters, at most 5), Backspace on an empty
// field removes the last one. Returns getTags, setTags and reset helpers.
export function initTagsInput(container, onChange) {
    const wrap = container.querySelector('.tags-input-wrap');
    const input = container.querySelector('.tags-input');
    let tags = [];

    function renderTags() {
        wrap.querySelectorAll('.tag-chip').forEach(oldChip => oldChip.remove());
        tags.forEach((tag, index) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.innerHTML = `${tag}<button type="button" aria-label="Remove tag">×</button>`;
            chip.querySelector('button').onclick = () => {
                tags.splice(index, 1);
                renderTags();
                onChange(tags);
            };
            wrap.insertBefore(chip, input);
        });
        if (onChange) onChange(tags);
    }

    // Mobile keyboards: label the action key "Enter" (not "Next"), and
    // disable autocorrect / auto-capitalisation since tags are lowercase slugs.
    input.setAttribute('enterkeyhint', 'enter');
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');

    function addTag(raw) {
        const tagValue = raw.trim().replace(/,/g, '').toLowerCase().slice(0, 24);
        if (tagValue && tags.length < 5 && !tags.includes(tagValue)) {
            tags.push(tagValue);
            renderTags();
        }
    }

    function removeLastTag() {
        if (tags.length > 0) {
            tags.pop();
            renderTags();
        }
    }

    wrap.addEventListener('click', () => input.focus());

    // Virtual keyboards often don't report a real `key` on keydown, so commas
    // are detected from the value itself: any comma commits the text before it.
    input.addEventListener('input', () => {
        if (input.value.includes(',')) {
            const parts = input.value.split(',');
            const remainder = parts.pop();
            parts.forEach(addTag);
            input.value = remainder;
        }
        const lower = input.value.toLowerCase();
        if (input.value !== lower) input.value = lower;
    });

    // Backspace on an empty field removes the last tag. Guard against the
    // keydown and beforeinput fallbacks both firing for the same keypress.
    let backspaceHandled = false;
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (input.value.trim()) {
                addTag(input.value);
                input.value = '';
            } else if (input.form) {
                // Empty field: Enter submits the surrounding form.
                if (typeof input.form.requestSubmit === 'function') input.form.requestSubmit();
                else input.form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
            return;
        }
        if (event.key === ',' && input.value.trim()) {
            event.preventDefault();
            addTag(input.value);
            input.value = '';
            return;
        }
        if (event.key === 'Backspace' && !input.value) {
            backspaceHandled = true;
            removeLastTag();
            setTimeout(() => { backspaceHandled = false; }, 0);
        }
    });
    input.addEventListener('beforeinput', (event) => {
        if (event.inputType === 'deleteContentBackward' && !input.value && !backspaceHandled) {
            removeLastTag();
        }
    });

    return {
        getTags: () => tags,
        setTags: (newTags) => {
            tags = [...newTags];
            renderTags();
        },
        reset: () => {
            tags = [];
            renderTags();
        },
    };
}

// ===== AVATAR COMPRESSION TO WEBP =====
// Reads an image file, scales it down so neither side is larger than maxDim,
// and resolves with a WebP data URL. Rejects if the file isn't an image or
// can't be read.
export function compressToWebp(file, maxDim = 256, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('Not an image'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const width = image.width;
                const height = image.height;
                const ratio = Math.min(maxDim / width, maxDim / height, 1);
                canvas.width = Math.round(width * ratio);
                canvas.height = Math.round(height * ratio);
                const canvasContext = canvas.getContext('2d');
                canvasContext.drawImage(image, 0, 0, canvas.width, canvas.height);
                const webp = canvas.toDataURL('image/webp', quality);
                resolve(webp);
            };
            image.onerror = () => reject(new Error('Image load failed'));
            image.src = loadEvent.target.result;
        };
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
    });
}

// ===== FORMAT DATE =====
export function formatDate(isoString) {
    if (!isoString) return '–';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-SG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// ===== AVATAR HTML =====
export function avatarHtml(user, size = 'sm') {
    let dimension;
    let avatarClass;
    let placeholderClass;
    if (size === 'sm') {
        dimension = 26;
        avatarClass = 'td-avatar';
        placeholderClass = 'td-avatar-ph';
    } else {
        dimension = 90;
        avatarClass = 'profile-avatar';
        placeholderClass = 'profile-avatar-ph';
    }
    const letter = (user.display_name || user.username || '?')[0].toUpperCase();
    if (user.avatar_url) {
        return `<img src="${user.avatar_url}" class="${avatarClass}" width="${dimension}" height="${dimension}" alt="${letter}" onerror="this.outerHTML=\`<div class='${placeholderClass}'>${letter}</div>\`">`;
    }
    return `<div class="${placeholderClass}">${letter}</div>`;
}

// ===== SLUG COPY HTML =====
export function slugCopyHtml(slug) {
    const url = `https://gftv.asia/${slug}`;
    const linkIcon = icon('copy');
    const qrIcon = icon('qr', 14);
    return `<div style="display:inline-flex;gap:4px;align-items:center;">
      <button class="copy-btn" onclick="(async()=>{
        const button=this;
        await navigator.clipboard.writeText('${url}');
        const originalHtml=button.innerHTML; button.innerHTML='Copied!'; button.classList.add('copied');
        setTimeout(()=>{button.innerHTML=originalHtml;button.classList.remove('copied');},1800);
      })()" title="${url}">${linkIcon} ${slug}</button>
      <button class="qr-btn" onclick="window.openQrModal('${slug}')" title="Generate QR code">${qrIcon}</button>
    </div>`;
}

// ===== TAGS HTML =====
export function tagsHtml(tags) {
    if (!tags || tags.length === 0) return '<span style="color:var(--text-light);font-size:0.8rem">–</span>';
    return `<div class="tags-list">${tags.map(tag => `<span class="tag-pill">${tag}</span>`).join('')}</div>`;
}

// ===== NO-SPACES VALIDATION =====
export const NO_SPACES_MSG = 'No spaces are allowed';

// Username and email fields must never contain whitespace. Call on submit with
// the inputs to check: any whose (trimmed) value contains a space is marked
// invalid until the user edits it. Returns the first offending input, or null.
// Leading/trailing whitespace is ignored since submit handlers trim it anyway
// (mobile keyboards often add a trailing space after autocomplete).
export function rejectSpaces(...inputs) {
    let first = null;
    for (const input of inputs) {
        if (!input) continue;
        input.classList.remove('is-invalid');
        if (/\s/.test(input.value.trim())) {
            input.classList.add('is-invalid');
            input.addEventListener('input', () => input.classList.remove('is-invalid'), { once: true });
            if (!first) first = input;
        }
    }
    if (first) first.focus();
    return first;
}

// ===== PASSWORD STRENGTH =====
// Scores a password from 0 to 4: one point each for 8+ characters, 12+
// characters, an uppercase letter, a digit and a symbol, capped at 4.
export function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return Math.min(score, 4);
}