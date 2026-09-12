// ===== SERVICE WORKER REGISTRATION + UPDATE NOTICE =====
// The one place the worker is registered. A new worker downloads, installs,
// and then waits; nothing promotes it except a person pressing Reload on the
// bar this module draws. See update-bar-spec.md for the reasoning.

const SW_URL = '/sw.js';
const SITE_NAME = 'GFTV Link Shortener';

let registration = null;
let waitingWorker = null;
let reloading = false;
let dismissed = false; // this page view only, never stored

function render() {
    const existing = document.querySelector('.update-notice');

    if (!waitingWorker || dismissed) {
        existing?.remove();
        return;
    }

    const bar = existing ?? document.createElement('div');
    bar.className = 'update-notice';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-label', 'Update');
    bar.innerHTML = `
      <div class="update-notice-inner">
        <p>A new version of ${SITE_NAME} is ready.</p>
        <button type="button" class="btn btn-primary" data-sw-update>Reload</button>
        <button type="button" class="btn btn-secondary" data-sw-later>Not now</button>
      </div>
    `;

    bar.querySelector('[data-sw-update]').addEventListener('click', () => {
        // The only place anything asks for skipWaiting. The reload happens on
        // controllerchange, not here: reloading now would race the worker and
        // bring the page back under the old one with the prompt still showing.
        waitingWorker?.postMessage('skip-waiting');
    });

    bar.querySelector('[data-sw-later]').addEventListener('click', () => {
        dismissed = true;
        render();
    });

    if (!existing) {
        // Below the official banner, above the header. The banner is permanent
        // chrome and keeps the top slot; this notice is the next thing down.
        const header = document.querySelector('.site-header');
        if (header) header.before(bar);
        else document.body.prepend(bar);
    }
}

function watchForUpdate() {
    if (!registration) return;

    // A worker already waiting when the page opened. This is the ordinary case
    // on the second page view after a deploy; without it the prompt would only
    // reach somebody who had the page open while the new worker installed.
    if (registration.waiting && navigator.serviceWorker.controller) {
        waitingWorker = registration.waiting;
        render();
    }

    registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;

        installing.addEventListener('statechange', () => {
            // `installed` with a controller present means an update. Without a
            // controller it is a first install, which has nothing to prompt about.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                waitingWorker = registration.waiting ?? installing;
                render();
            }
        });
    });
}

function register() {
    navigator.serviceWorker
        .register(SW_URL)
        .then((reg) => {
            registration = reg;
            watchForUpdate();
        })
        .catch((cause) => {
            // Private browsing in some browsers, or a plain http origin that is
            // not localhost, land here. Not a reason to break the page.
            console.warn('service worker registration failed:', cause);
        });

    // The swap, once somebody has accepted it. By this point the controller has
    // changed, so the reload is served by the new worker. Guarded because
    // controllerchange can fire more than once.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
    });
}

export function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    // On load rather than immediately: installing fetches everything the worker
    // precaches, and starting that while the page is still fetching its own
    // assets makes a first visit slower for no gain.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
}
