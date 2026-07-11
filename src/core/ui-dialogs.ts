// @ts-nocheck
// ============================================================================
// Compass — Custom UI Dialogs
// Replaces native browser alert()/confirm() popups ("сайт сообщает /
// подтвердите действие на сайте") with themed in-page notifications.
//
//  • window.cpToast(message, type?, duration?)  — corner toast (bottom-right)
//  • window.cpConfirm(message, options?)        — Promise<boolean> confirm card
//  • window.alert is overridden to show a toast instead of the native popup.
//
// Plain (non-module) script — include it BEFORE other scripts on every page.
// ============================================================================
(function () {
    'use strict';
    if (window.__cpDialogsInstalled) return;
    window.__cpDialogsInstalled = true;

    // ------------------------------------------------------------ styles ---
    const css = `
    .cp-toast-container {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 999999;
        display: flex;
        flex-direction: column-reverse;
        gap: 10px;
        max-width: min(380px, calc(100vw - 32px));
        pointer-events: none;
    }
    .cp-toast {
        pointer-events: auto;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 14px;
        background: linear-gradient(145deg, rgba(22, 22, 32, 0.92), rgba(12, 12, 18, 0.88));
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        color: rgba(255, 255, 255, 0.92);
        font-family: inherit;
        font-size: 0.875rem;
        line-height: 1.45;
        white-space: pre-line;
        word-break: break-word;
        opacity: 0;
        transform: translateY(12px) scale(0.98);
        transition: opacity 0.22s ease, transform 0.22s ease;
    }
    .cp-toast.cp-shown { opacity: 1; transform: translateY(0) scale(1); }
    .cp-toast.cp-hiding { opacity: 0; transform: translateY(8px) scale(0.98); }
    .cp-toast::before {
        content: '';
        flex: 0 0 4px;
        align-self: stretch;
        border-radius: 4px;
        background: #00d2ff;
        box-shadow: 0 0 10px rgba(0, 210, 255, 0.55);
    }
    .cp-toast.cp-success::before { background: #39ff14; box-shadow: 0 0 10px rgba(57, 255, 20, 0.45); }
    .cp-toast.cp-error::before   { background: #ff4d6d; box-shadow: 0 0 10px rgba(255, 77, 109, 0.5); }
    .cp-toast.cp-warning::before { background: #ffb020; box-shadow: 0 0 10px rgba(255, 176, 32, 0.5); }
    .cp-toast-msg { flex: 1; }
    .cp-toast-close {
        flex: 0 0 auto;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.45);
        font-size: 1rem;
        line-height: 1;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 6px;
    }
    .cp-toast-close:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }

    .cp-confirm-overlay {
        position: fixed;
        inset: 0;
        z-index: 999998;
        background: rgba(0, 0, 0, 0.15);
    }
    .cp-confirm-card {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 999999;
        width: min(380px, calc(100vw - 32px));
        padding: 16px;
        border-radius: 16px;
        background: linear-gradient(145deg, rgba(24, 24, 36, 0.97), rgba(12, 12, 18, 0.95));
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        color: rgba(255, 255, 255, 0.94);
        font-family: inherit;
        font-size: 0.9rem;
        line-height: 1.5;
        white-space: pre-line;
        word-break: break-word;
        opacity: 0;
        transform: translateY(14px) scale(0.98);
        transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .cp-confirm-card.cp-shown { opacity: 1; transform: translateY(0) scale(1); }
    .cp-confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 14px;
    }
    .cp-confirm-btn {
        border: none;
        border-radius: 10px;
        padding: 8px 16px;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        transition: transform 0.12s ease, filter 0.12s ease;
    }
    .cp-confirm-btn:hover { transform: translateY(-1px); filter: brightness(1.12); }
    .cp-confirm-btn.cp-ok {
        background: linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%);
        color: #04121a;
    }
    .cp-confirm-btn.cp-ok.cp-danger {
        background: linear-gradient(135deg, #ff4d6d 0%, #c9184a 100%);
        color: #fff;
    }
    .cp-confirm-btn.cp-cancel {
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.12);
    }
    `;

    function ensureStyles() {
        if (document.getElementById('cp-dialog-styles')) return;
        const style = document.createElement('style');
        style.id = 'cp-dialog-styles';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }

    function getContainer() {
        ensureStyles();
        let c = document.querySelector('.cp-toast-container');
        if (!c) {
            c = document.createElement('div');
            c.className = 'cp-toast-container';
            (document.body || document.documentElement).appendChild(c);
        }
        return c;
    }

    function detectType(message) {
        const m = String(message);
        if (/❌|⛔|🚫|error|failed|failure|ошибк|не удалось/i.test(m)) return 'error';
        if (/✅|🎉|🤝|success|saved|updated|успеш|сохранен/i.test(m)) return 'success';
        if (/⚠|warning|внимани/i.test(m)) return 'warning';
        return 'info';
    }

    // ------------------------------------------------------------- toast ---
    window.cpToast = function (message, type, duration) {
        const run = () => {
            const container = getContainer();
            const t = type || detectType(message);
            const toast = document.createElement('div');
            toast.className = `cp-toast cp-${t}`;
            const msg = document.createElement('div');
            msg.className = 'cp-toast-msg';
            msg.textContent = String(message);
            const close = document.createElement('button');
            close.className = 'cp-toast-close';
            close.setAttribute('aria-label', 'Close');
            close.textContent = '✕';
            toast.appendChild(msg);
            toast.appendChild(close);
            container.appendChild(toast);
            requestAnimationFrame(() => toast.classList.add('cp-shown'));
            const life = duration || Math.min(12000, Math.max(4000, String(message).length * 60));
            let hideTimer = setTimeout(hide, life);
            function hide() {
                clearTimeout(hideTimer);
                toast.classList.add('cp-hiding');
                setTimeout(() => toast.remove(), 260);
            }
            close.addEventListener('click', hide);
            // Pause auto-hide while hovered
            toast.addEventListener('mouseenter', () => clearTimeout(hideTimer));
            toast.addEventListener('mouseleave', () => { hideTimer = setTimeout(hide, 2500); });
        };
        if (document.body) run();
        else document.addEventListener('DOMContentLoaded', run, { once: true });
    };

    // ----------------------------------------------------------- confirm ---
    window.cpConfirm = function (message, options) {
        const opts = options || {};
        const tr = (k) => (typeof window.cp_translate === 'function' ? window.cp_translate(k) : k);
        return new Promise((resolve) => {
            const run = () => {
                ensureStyles();
                const overlay = document.createElement('div');
                overlay.className = 'cp-confirm-overlay';
                const card = document.createElement('div');
                card.className = 'cp-confirm-card';
                const msg = document.createElement('div');
                msg.className = 'cp-confirm-msg';
                msg.textContent = String(message);
                const actions = document.createElement('div');
                actions.className = 'cp-confirm-actions';
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'cp-confirm-btn cp-cancel';
                cancelBtn.textContent = opts.cancelText || tr('Cancel');
                const okBtn = document.createElement('button');
                okBtn.className = 'cp-confirm-btn cp-ok' + (opts.danger ? ' cp-danger' : '');
                okBtn.textContent = opts.okText || tr('Confirm');
                actions.appendChild(cancelBtn);
                actions.appendChild(okBtn);
                card.appendChild(msg);
                card.appendChild(actions);
                document.body.appendChild(overlay);
                document.body.appendChild(card);
                requestAnimationFrame(() => card.classList.add('cp-shown'));
                function finish(result) {
                    document.removeEventListener('keydown', onKey, true);
                    card.classList.remove('cp-shown');
                    setTimeout(() => { card.remove(); overlay.remove(); }, 200);
                    resolve(result);
                }
                function onKey(e) {
                    if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
                    else if (e.key === 'Enter') { e.stopPropagation(); finish(true); }
                }
                okBtn.addEventListener('click', () => finish(true));
                cancelBtn.addEventListener('click', () => finish(false));
                overlay.addEventListener('click', () => finish(false));
                document.addEventListener('keydown', onKey, true);
                okBtn.focus();
            };
            if (document.body) run();
            else document.addEventListener('DOMContentLoaded', run, { once: true });
        });
    };

    // -------------------------------------------- override native alert ---
    window.alert = function (message) {
        window.cpToast(message);
    };
})();
