// ===== TOAST =====
export function toast(msg, type = 'info', duration = 3000) {
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
    const container = document.getElementById('toast-container');
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(24px)';
        el.style.transition = 'all 0.3s';
        setTimeout(() => el.remove(), 300);
    }, duration);
}

// ===== MODAL =====
export function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
}
export function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
}
export function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
}

// Click outside to close
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('open');
    }
});

// ===== COPY TO CLIPBOARD =====
export async function copyText(text, btn = null) {
    try {
        await navigator.clipboard.writeText(text);
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '✅ Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.innerHTML = orig;
                btn.classList.remove('copied');
            }, 1800);
        }
        return true;
    } catch {
        return false;
    }
}

// ===== TAGS INPUT =====
export function initTagsInput(container, onChange) {
    const wrap = container.querySelector('.tags-input-wrap');
    const input = container.querySelector('.tags-input');
    let tags = [];

    function renderTags() {
        wrap.querySelectorAll('.tag-chip').forEach(c => c.remove());
        tags.forEach((tag, i) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.innerHTML = `${tag}<button type="button" aria-label="Remove tag">×</button>`;
            chip.querySelector('button').onclick = () => {
                tags.splice(i, 1);
                renderTags();
                onChange(tags);
            };
            wrap.insertBefore(chip, input);
        });
        if (onChange) onChange(tags);
    }

    wrap.addEventListener('click', () => input.focus());

    input.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
            e.preventDefault();
            const val = input.value.trim().replace(/,/g, '').toLowerCase().slice(0, 24);
            if (val && tags.length < 5 && !tags.includes(val)) {
                tags.push(val);
                renderTags();
            }
            input.value = '';
        }
        if (e.key === 'Backspace' && !input.value && tags.length > 0) {
            tags.pop();
            renderTags();
        }
    });

    return {
        getTags: () => tags,
        setTags: (t) => {
            tags = [...t];
            renderTags();
        },
        reset: () => {
            tags = [];
            renderTags();
        },
    };
}

// ===== AVATAR COMPRESSION TO WEBP =====
export function compressToWebp(file, maxDim = 256, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('Not an image'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width,
                    h = img.height;
                const ratio = Math.min(maxDim / w, maxDim / h, 1);
                canvas.width = Math.round(w * ratio);
                canvas.height = Math.round(h * ratio);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const webp = canvas.toDataURL('image/webp', quality);
                resolve(webp);
            };
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
    });
}

// ===== FORMAT DATE =====
export function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-SG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// ===== AVATAR HTML =====
export function avatarHtml(user, size = 'sm') {
    const dim = size === 'sm' ? 26 : 90;
    const cls = size === 'sm' ? 'td-avatar' : 'profile-avatar';
    const clsPh = size === 'sm' ? 'td-avatar-ph' : 'profile-avatar-ph';
    const letter = (user.display_name || user.username || '?')[0].toUpperCase();
    if (user.avatar_url) {
        return `<img src="${user.avatar_url}" class="${cls}" width="${dim}" height="${dim}" alt="${letter}" onerror="this.outerHTML=\`<div class='${clsPh}'>${letter}</div>\`">`;
    }
    return `<div class="${clsPh}">${letter}</div>`;
}

// ===== SLUG COPY HTML =====
export function slugCopyHtml(slug) {
    const url = `https://gftv.asia/r/${slug}`;
    return `<button class="copy-btn" onclick="(async()=>{
    const btn=this;
    await navigator.clipboard.writeText('${url}');
    const orig=btn.innerHTML; btn.innerHTML='✅ Copied!'; btn.classList.add('copied');
    setTimeout(()=>{btn.innerHTML=orig;btn.classList.remove('copied');},1800);
  })()" title="${url}">🔗 ${slug}</button>`;
}

// ===== TAGS HTML =====
export function tagsHtml(tags) {
    if (!tags || tags.length === 0) return '<span style="color:var(--text-light);font-size:0.8rem">—</span>';
    return `<div class="tags-list">${tags.map(t => `<span class="tag-pill">${t}</span>`).join('')}</div>`;
}

// ===== PASSWORD STRENGTH =====
export function pwdStrength(pwd) {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    return Math.min(score, 4);
}