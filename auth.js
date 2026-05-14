// God Mode access gate (12-digit code). Normal Mode is open access.
// Plaintext code NEVER appears in this file; only its SHA-256 hash.
// To rotate the God Mode code: compute SHA-256 of the new code and replace
// EXPECTED_HASH.
//   $ printf '%s' 'NEW_CODE' | sha256sum
(() => {
  const EXPECTED_HASH = 'f75862c37063f15fc0e52fae147de03ec87fe5154761e7bd2974685447db5d9a';
  const STORAGE_KEY = 'aaron-rogue:god-unlock';

  const $ = (s) => document.querySelector(s);
  const modal = $('#auth-modal');
  if (!modal) return; // not on the landing page; bail out cleanly

  const modalTitle = $('#auth-modal-title');
  const modalDesc  = $('#auth-modal-copy');
  const input      = $('#auth-input');
  const submit     = $('#auth-submit');
  const close      = $('#auth-close');
  const status     = $('#auth-status');
  const trigger    = $('#god-mode-btn');

  function alreadyUnlocked() {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  }

  function openModal() {
    modal.hidden = false;
    modal.style.display = 'flex';
    if (modalTitle) modalTitle.textContent = 'God Mode :: access code required';
    if (modalDesc)  modalDesc.textContent  = 'Enter the 12-digit access code to unlock the guided walkthrough mode.';
    if (status) { status.textContent = ''; status.className = 'auth-status'; }
    if (submit) submit.disabled = false;
    if (input) { input.disabled = false; input.value = ''; }
    setTimeout(() => input && input.focus(), 50);
  }
  function closeModal() {
    modal.hidden = true;
    modal.style.display = 'none';
    if (input) input.value = '';
    if (status) { status.textContent = ''; status.className = 'auth-status'; }
  }

  if (trigger) {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      if (alreadyUnlocked()) { location.href = 'app.html?mode=god'; return; }
      openModal();
    });
  }
  if (close) close.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  async function sha256Hex(s) {
    const buf = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

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
      if (got === EXPECTED_HASH) {
        sessionStorage.setItem(STORAGE_KEY, 'true');
        status.textContent = '✓ access granted. redirecting...';
        status.className = 'auth-status ok';
        setTimeout(() => { location.href = 'app.html?mode=god'; }, 600);
      } else {
        status.textContent = '✗ access denied. wrong code.';
        status.className = 'auth-status danger';
        submit.disabled = false;
        input.select();
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

  // Reflect already-unlocked state in the God Mode CTA text
  if (alreadyUnlocked() && trigger) {
    const cta = trigger.querySelector('.mode-cta');
    if (cta) { cta.textContent = 'ENTER GOD MODE →'; cta.classList.remove('locked'); }
  }
})();
