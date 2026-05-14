// Access gates for Normal Mode (12-digit code + 9am-6pm SGT window
// on May 14-16, 2026) and God Mode (separate 12-digit code, no time window).
// Plaintext codes are NEVER in this file. Only SHA-256 hashes.
// To rotate either code: compute SHA-256 of the new code, replace the hash.
//   $ printf '%s' 'NEW_CODE' | sha256sum
(() => {
  const NORMAL_HASH = '42ab599c0b4bf59e3f22b0ee399b2c025e889b5bdbf69dc103a71e5c52a79340';
  const GOD_HASH    = 'f75862c37063f15fc0e52fae147de03ec87fe5154761e7bd2974685447db5d9a';
  const NORMAL_UNLOCK_KEY = 'aaron-rogue:normal-unlock';
  const GOD_UNLOCK_KEY    = 'aaron-rogue:god-unlock';

  // Normal Mode availability window: 9am-6pm SGT on May 14-16, 2026.
  // 6pm is interpreted as < 18:00 (so 17:59:59 is in, 18:00:00 is out).
  function checkNormalWindow() {
    const now = new Date();
    // Convert "now" to a fake-UTC Date that represents SGT wall-clock time
    const SGT_OFFSET_MIN = 8 * 60; // UTC+8
    const sgtMs = now.getTime() + (now.getTimezoneOffset() + SGT_OFFSET_MIN) * 60 * 1000;
    const sgt = new Date(sgtMs);
    const y = sgt.getUTCFullYear();
    const m = sgt.getUTCMonth() + 1; // 1-12
    const d = sgt.getUTCDate();
    const h = sgt.getUTCHours();
    const okDate = (y === 2026 && m === 5 && d >= 14 && d <= 16);
    const okHour = (h >= 9 && h < 18);
    return { ok: okDate && okHour, y, m, d, h, sgt };
  }

  async function sha256Hex(s) {
    const buf = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Expose the window check for app.html
  window.AaronAuth = {
    checkNormalWindow,
    isNormalUnlocked: () => sessionStorage.getItem(NORMAL_UNLOCK_KEY) === 'true',
    isGodUnlocked:    () => sessionStorage.getItem(GOD_UNLOCK_KEY) === 'true',
  };

  // ---------- modal wiring (landing page only) ----------
  const $ = (s) => document.querySelector(s);
  const modal = $('#auth-modal');
  if (!modal) return; // not on the landing page; bail out cleanly

  const modalTitle = $('#auth-modal-title');
  const modalDesc  = $('#auth-modal-copy');
  const input      = $('#auth-input');
  const submit     = $('#auth-submit');
  const close      = $('#auth-close');
  const status     = $('#auth-status');
  const triggerNormal = $('#normal-mode-btn');
  const triggerGod    = $('#god-mode-btn');

  let currentMode = null; // 'normal' | 'god'

  function openModal(mode) {
    currentMode = mode;
    modal.hidden = false;
    modal.style.display = 'flex';
    input.value = '';
    status.textContent = '';
    status.className = 'auth-status';
    submit.disabled = false;
    input.disabled = false;
    if (mode === 'god') {
      modalTitle.textContent = 'God Mode :: access code required';
      modalDesc.textContent = 'Enter the 12-digit access code to unlock the guided walkthrough mode.';
      modal.dataset.mode = 'god';
    } else {
      modalTitle.textContent = 'Normal Mode :: access code required';
      const w = checkNormalWindow();
      if (!w.ok) {
        modalDesc.textContent = 'Normal Mode is only available 09:00–18:00 SGT on May 14–16, 2026.';
      } else {
        modalDesc.textContent = 'Enter the 12-digit access code to enter the challenge.';
      }
      modal.dataset.mode = 'normal';
    }
    setTimeout(() => input.focus(), 50);
  }
  function closeModal() {
    modal.hidden = true;
    modal.style.display = 'none';
    input.value = '';
    status.textContent = '';
    status.className = 'auth-status';
  }

  if (triggerNormal) {
    triggerNormal.addEventListener('click', (e) => {
      e.preventDefault();
      // If already unlocked AND still in window, go straight in.
      if (sessionStorage.getItem(NORMAL_UNLOCK_KEY) === 'true' && checkNormalWindow().ok) {
        location.href = 'app.html';
        return;
      }
      openModal('normal');
    });
  }
  if (triggerGod) {
    triggerGod.addEventListener('click', (e) => {
      e.preventDefault();
      if (sessionStorage.getItem(GOD_UNLOCK_KEY) === 'true') {
        location.href = 'app.html?mode=god';
        return;
      }
      openModal('god');
    });
  }
  if (close) close.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  async function tryUnlock() {
    const code = (input.value || '').trim();
    if (!/^\d{12}$/.test(code)) {
      status.textContent = 'access code is exactly 12 digits.';
      status.className = 'auth-status warn';
      return;
    }
    submit.disabled = true;
    status.textContent = 'verifying...';
    status.className = 'auth-status info';

    try {
      const got = await sha256Hex(code);
      if (currentMode === 'god') {
        if (got === GOD_HASH) {
          sessionStorage.setItem(GOD_UNLOCK_KEY, 'true');
          status.textContent = '✓ access granted. redirecting...';
          status.className = 'auth-status ok';
          setTimeout(() => { location.href = 'app.html?mode=god'; }, 600);
        } else {
          status.textContent = '✗ access denied. wrong code.';
          status.className = 'auth-status danger';
          submit.disabled = false;
          input.select();
        }
      } else {
        // Normal mode: check window then code
        const w = checkNormalWindow();
        if (!w.ok) {
          status.textContent = '✗ Normal Mode is closed. Available 09:00–18:00 SGT on May 14–16, 2026.';
          status.className = 'auth-status danger';
          submit.disabled = true;
          input.disabled = true;
          return;
        }
        if (got === NORMAL_HASH) {
          sessionStorage.setItem(NORMAL_UNLOCK_KEY, 'true');
          status.textContent = '✓ access granted. redirecting...';
          status.className = 'auth-status ok';
          setTimeout(() => { location.href = 'app.html'; }, 600);
        } else {
          status.textContent = '✗ access denied. wrong code.';
          status.className = 'auth-status danger';
          submit.disabled = false;
          input.select();
        }
      }
    } catch (e) {
      status.textContent = 'crypto error: ' + e.message;
      status.className = 'auth-status danger';
      submit.disabled = false;
    }
  }

  if (submit) submit.addEventListener('click', tryUnlock);
  if (input) input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); }
    if (e.key === 'Escape') closeModal();
  });

  // ---------- landing-page status / reason indicator ----------
  // When app.html bounces a user back here (window/unlock issues), it appends
  // ?reason=window or ?reason=locked so we can update the cards.
  const reason = new URLSearchParams(location.search).get('reason');
  if (reason && triggerNormal) {
    const cta = triggerNormal.querySelector('.mode-cta');
    if (cta) {
      if (reason === 'window') cta.textContent = 'NORMAL MODE :: CLOSED (out of window)';
      if (reason === 'locked') cta.textContent = 'NORMAL MODE :: LOCKED (enter code)';
    }
  }

  // Reflect already-unlocked state in CTA text
  if (sessionStorage.getItem(NORMAL_UNLOCK_KEY) === 'true' && triggerNormal) {
    const cta = triggerNormal.querySelector('.mode-cta');
    if (cta && checkNormalWindow().ok) cta.textContent = 'ENTER NORMAL MODE →';
  }
  if (sessionStorage.getItem(GOD_UNLOCK_KEY) === 'true' && triggerGod) {
    const cta = triggerGod.querySelector('.mode-cta');
    if (cta) { cta.textContent = 'ENTER GOD MODE →'; cta.classList.remove('locked'); }
  }
})();
