// ==UserScript==
// @name         ChatGPT Avatars (cheap polling build)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Lightweight inline avatars for ChatGPT using slow polling, local storage, and a tiny built-in wheel-zoom cropper
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const ROLE_SELECTOR = '[data-message-author-role="user"], [data-message-author-role="assistant"]';
    const STYLE_ID = 'cgpt-inline-avatar-style';
    const FILE_INPUT_ID = 'cgpt-inline-avatar-file-input';
    const AVATAR_CLASS = 'cgpt-inline-avatar';
    const CROPPER_ID = 'cgpt-avatar-cropper-modal';

    const STORAGE = {
        user: 'cgpt_avatar_user',
        assistant: 'cgpt_avatar_assistant'
    };

    const EMOJI = {
        user: '🤓',
        assistant: '🤖'
    };

    const avatarCache = {
        user: null,
        assistant: null
    };

    let processedCount = 0;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
.cgpt-inline-avatar {
    width: 40px;
    height: 40px;
    border-radius: 999px;
    border: 1px solid rgba(127,127,127,.25);
    background: rgba(127,127,127,.10);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: pointer;
    flex: 0 0 auto;
    padding: 0;
    margin: 0;
}

.cgpt-inline-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.cgpt-avatar-emoji {
    font-size: 30px;
    line-height: 1;
}

/* assistant layout */

[data-message-author-role="assistant"] {
    position: relative;
}

[data-message-author-role="assistant"] > .cgpt-inline-avatar {
    position: absolute;
    left: -52px;
    top: 0.2em;
}

/* user layout */

[data-message-author-role="user"] .flex.w-\[var\(--user-chat-width\,70\%\)\].flex-col.items-end {
    position: relative;
}

[data-message-author-role="user"] .flex.w-\[var\(--user-chat-width\,70\%\)\].flex-col.items-end > .cgpt-inline-avatar {
    position: absolute;
    left: -64px;
    top: 0.2em;
}
.user-message-bubble-color {
    position: relative;
}

.user-message-bubble-color > .cgpt-inline-avatar[data-role="user"] {
    position: absolute;
    left: -56px;
    top: 0.2em;
}

/* cropper */

#${CROPPER_ID} {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,.72);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

#${CROPPER_ID} .cgpt-cropper-panel {
    width: min(92vw, 390px);
    max-height: 92vh;
    background: #141414;
    color: #fafafa;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 12px;
    padding: 14px;
    box-shadow: 0 20px 60px rgba(0,0,0,.55);
    display: flex;
    flex-direction: column;
    gap: 12px;
}

#${CROPPER_ID} .cgpt-cropper-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
}

#${CROPPER_ID} .cgpt-cropper-viewport {
    width: min(78vw, 300px);
    height: min(78vw, 300px);
    align-self: center;
    position: relative;
    overflow: hidden;
    border-radius: 10px;
    background: #222;
    touch-action: none;
    user-select: none;
}

#${CROPPER_ID} .cgpt-cropper-image {
    position: absolute;
    transform-origin: center center;
    will-change: transform;
    pointer-events: none;
}

#${CROPPER_ID} .cgpt-cropper-dim {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle at center, transparent 0 49%, rgba(0,0,0,.52) 51%);
}

#${CROPPER_ID} .cgpt-cropper-circle {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 78%;
    height: 78%;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    border: 2px solid rgba(255,255,255,.8);
    box-shadow: 0 0 0 1px rgba(0,0,0,.45);
    pointer-events: none;
}

#${CROPPER_ID} .cgpt-cropper-hint {
    font-size: 12px;
    opacity: .86;
    margin-top: -2px;
}

#${CROPPER_ID} .cgpt-cropper-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

#${CROPPER_ID} .cgpt-cropper-btn {
    border: 1px solid rgba(255,255,255,.2);
    background: rgba(255,255,255,.08);
    color: #fff;
    border-radius: 8px;
    padding: 7px 12px;
    cursor: pointer;
}

#${CROPPER_ID} .cgpt-cropper-btn-primary {
    background: #fff;
    border-color: #fff;
    color: #111;
    font-weight: 600;
}

/* mobile tweaks */

@media (max-width: 700px) {

    .cgpt-inline-avatar {
        width: 34px;
        height: 34px;
    }

    .cgpt-avatar-emoji {
        font-size: 24px;
    }

    [data-message-author-role="assistant"] > .cgpt-inline-avatar {
        left: -44px;
    }
}
        `;
        document.head.appendChild(style);
    }

    function ensureFileInput() {
        let input = document.getElementById(FILE_INPUT_ID);
        if (input) return input;

        input = document.createElement('input');
        input.id = FILE_INPUT_ID;
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        return input;
    }

    function getAvatar(role) {
        if (avatarCache[role] !== null) return avatarCache[role];

        const key = role === 'user' ? STORAGE.user : STORAGE.assistant;
        avatarCache[role] = localStorage.getItem(key) || '';
        return avatarCache[role];
    }

    function setAvatar(role, value) {
        const key = role === 'user' ? STORAGE.user : STORAGE.assistant;
        localStorage.setItem(key, value);
        avatarCache[role] = value;
        console.log('[CGPT-AVATAR] avatar saved for', role);
    }

    function renderAvatar(button, role) {
        const stored = getAvatar(role);
        button.innerHTML = '';

        if (stored) {
            const img = document.createElement('img');
            img.src = stored;
            img.alt = `${role} avatar`;
            button.appendChild(img);
        } else {
            const span = document.createElement('span');
            span.className = 'cgpt-avatar-emoji';
            span.textContent = EMOJI[role];
            button.appendChild(span);
        }

        button.title = `Click to change ${role} avatar`;
    }

    function refreshAllAvatars() {
        document.querySelectorAll(`.${AVATAR_CLASS}[data-role]`).forEach((button) => {
            renderAvatar(button, button.getAttribute('data-role'));
        });
    }

    function loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = String(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function openCropper(file) {
        return new Promise(async (resolve, reject) => {
            const image = await loadImageFromFile(file);
            const existing = document.getElementById(CROPPER_ID);
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = CROPPER_ID;
            modal.innerHTML = `
<div class="cgpt-cropper-panel" role="dialog" aria-modal="true" aria-label="Crop avatar image">
    <p class="cgpt-cropper-title">Crop avatar</p>
    <div class="cgpt-cropper-viewport">
        <img class="cgpt-cropper-image" alt="Crop preview" />
        <div class="cgpt-cropper-dim"></div>
        <div class="cgpt-cropper-circle"></div>
    </div>
    <p class="cgpt-cropper-hint">Scroll / trackpad to zoom. Drag to reposition.</p>
    <div class="cgpt-cropper-buttons">
        <button class="cgpt-cropper-btn" data-action="cancel" type="button">Cancel</button>
        <button class="cgpt-cropper-btn cgpt-cropper-btn-primary" data-action="save" type="button">Save</button>
    </div>
</div>`;
            document.body.appendChild(modal);

            const panel = modal.querySelector('.cgpt-cropper-panel');
            const viewport = modal.querySelector('.cgpt-cropper-viewport');
            const preview = modal.querySelector('.cgpt-cropper-image');


            if (!(panel instanceof HTMLElement) || !(viewport instanceof HTMLElement) || !(preview instanceof HTMLImageElement)) {
                modal.remove();
                reject(new Error('Cropper failed to initialize'));
                return;
            }

            preview.src = image.src;

            const viewportSize = viewport.getBoundingClientRect().width;
            const guideSize = viewportSize * 0.78;
            const naturalWidth = image.naturalWidth;
            const naturalHeight = image.naturalHeight;
            const minScale = Math.max(guideSize / naturalWidth, guideSize / naturalHeight);
            const maxScale = Math.max(minScale * 6, minScale + 0.8);

            let scale = minScale;
            let tx = 0;
            let ty = 0;
            let dragging = false;
            let dragStartX = 0;
            let dragStartY = 0;
            let dragOriginX = 0;
            let dragOriginY = 0;

            function clampPosition() {
                const scaledW = naturalWidth * scale;
                const scaledH = naturalHeight * scale;
                const edgeX = Math.max(0, (scaledW - guideSize) / 2);
                const edgeY = Math.max(0, (scaledH - guideSize) / 2);
                tx = Math.max(-edgeX, Math.min(edgeX, tx));
                ty = Math.max(-edgeY, Math.min(edgeY, ty));
            }

            function redraw() {
                clampPosition();
                preview.style.width = 'auto';
                preview.style.height = 'auto';
                preview.style.maxWidth = 'none';
                preview.style.maxHeight = 'none';
                preview.style.left = '50%';
                preview.style.top = '50%';
                preview.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${scale})`;
            }

            function closeWithError(err) {
                modal.remove();
                reject(err);
            }

            function closeWithResult(data) {
                modal.remove();
                resolve(data);
            }

            modal.addEventListener('click', (event) => {
                if (event.target === modal) closeWithError(new Error('Crop canceled'));
            });

            panel.addEventListener('click', (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                const action = target.getAttribute('data-action');
                if (action === 'cancel') {
                    closeWithError(new Error('Crop canceled'));
                }
                if (action === 'save') {
                    const srcSize = guideSize / scale;
                    const srcX = Math.max(0, Math.min(naturalWidth - srcSize, (naturalWidth / 2) - (srcSize / 2) - (tx / scale)));
                    const srcY = Math.max(0, Math.min(naturalHeight - srcSize, (naturalHeight / 2) - (srcSize / 2) - (ty / scale)));

                    const outputSize = Math.max(256, Math.min(1024, Math.round(srcSize)));
                    const output = document.createElement('canvas');
                    output.width = outputSize;
                    output.height = outputSize;
                    const ctx = output.getContext('2d');
                    if (!ctx) {
                        closeWithError(new Error('Canvas context unavailable'));
                        return;
                    }

                    const radius = outputSize / 2;
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(image, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize);
                    ctx.restore();

                    closeWithResult(output.toDataURL('image/png'));
                }
            });

            viewport.addEventListener('wheel', (event) => {
                event.preventDefault();
                const delta = event.deltaY > 0 ? -1 : 1;
                const factor = delta > 0 ? 1.08 : 0.92;
                const nextScale = Math.max(minScale, Math.min(maxScale, scale * factor));
                if (nextScale === scale) return;
                scale = nextScale;
                redraw();
            }, { passive: false });

            viewport.addEventListener('pointerdown', (event) => {
                dragging = true;
                dragStartX = event.clientX;
                dragStartY = event.clientY;
                dragOriginX = tx;
                dragOriginY = ty;
                viewport.setPointerCapture(event.pointerId);
            });

            viewport.addEventListener('pointermove', (event) => {
                if (!dragging) return;
                tx = dragOriginX + (event.clientX - dragStartX);
                ty = dragOriginY + (event.clientY - dragStartY);
                redraw();
            });

            function stopDrag(event) {
                if (!dragging) return;
                dragging = false;
                try {
                    viewport.releasePointerCapture(event.pointerId);
                } catch (_) {
                    /* no-op */
                }
            }

            viewport.addEventListener('pointerup', stopDrag);
            viewport.addEventListener('pointercancel', stopDrag);

            redraw();
        });
    }

    function promptForAvatar(role) {
        const input = ensureFileInput();
        input.value = '';

        input.onchange = async () => {
            const file = input.files && input.files[0];
            if (!file) return;

            try {
                const data = await openCropper(file);
                setAvatar(role, data);
                refreshAllAvatars();
            } catch (err) {
                if (String(err && err.message || '').toLowerCase().includes('canceled')) {
                    return;
                }
                console.error('[CGPT-AVATAR] crop/file handling failed', err);
            }
        };

        input.click();
    }

    function attachAvatar(messageEl) {
        if (!(messageEl instanceof HTMLElement)) return;

        const role = messageEl.getAttribute('data-message-author-role');
        if (!role) return;

        let target = messageEl;

        if (role === 'user') {
            const bubble = messageEl.querySelector('.user-message-bubble-color');
            if (bubble instanceof HTMLElement) {
                target = bubble;
            }
        }

        if (target.querySelector(`:scope > .${AVATAR_CLASS}[data-role="${role}"]`)) return;

        const avatar = document.createElement('button');
        avatar.type = 'button';
        avatar.className = AVATAR_CLASS;
        avatar.setAttribute('data-role', role);

        renderAvatar(avatar, role);

        avatar.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            promptForAvatar(role);
        });

        target.prepend(avatar);
    }

    function scanMessages() {
        const messages = document.querySelectorAll(ROLE_SELECTOR);

        if (messages.length < processedCount) {
            processedCount = 0;
        }

        for (let i = processedCount; i < messages.length; i++) {
            attachAvatar(messages[i]);
        }

        processedCount = messages.length;
    }

    function boot() {
        injectStyles();
        ensureFileInput();

        scanMessages();
        setInterval(scanMessages, 4444);

        console.log('[CGPT-AVATAR] cheap polling build with cropper loaded');
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
