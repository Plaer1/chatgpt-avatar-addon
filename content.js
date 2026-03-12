(() => {
  'use strict';

  const ROLE_SELECTOR = '[data-message-author-role="user"], [data-message-author-role="assistant"]';
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

  let scanQueued = false;
  let observer = null;

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
        if (action === 'cancel') closeWithError(new Error('Crop canceled'));

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
        const factor = event.deltaY > 0 ? 0.92 : 1.08;
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
          // no-op
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
        if (String((err && err.message) || '').toLowerCase().includes('canceled')) return;
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
      if (bubble instanceof HTMLElement) target = bubble;
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
    messages.forEach((messageEl) => {
      attachAvatar(messageEl);
    });
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    window.requestAnimationFrame(() => {
      scanQueued = false;
      scanMessages();
    });
  }

  function startObserver() {
    if (observer || !document.body) return;

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(ROLE_SELECTOR) || node.querySelector(ROLE_SELECTOR)) {
            queueScan();
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function runWhenIdle(task) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(task, { timeout: 1500 });
      return;
    }
    window.setTimeout(task, 400);
  }

  function boot() {
    runWhenIdle(() => {
      scanMessages();
      startObserver();
    });
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
