// God Mode access gate.
// The plaintext code is NEVER in this file. Only its SHA-256 hash is.
// On submit, JS hashes the typed code (SubtleCrypto) and compares to EXPECTED_HASH.
// On match, we set a localStorage flag and redirect to /app.html?mode=god.
//
// To rotate the code: compute SHA-256 of the new code and replace EXPECTED_HASH.
//   $ printf '%s' 'YOUR_NEW_CODE' | sha256sum
(() => {
  const EXPECTED_HASH = 'f75862c37063f15fc0e52fae147de03ec87fe5154761e7bd2974685447db5d9a';
  const STORAGE_KEY = 'aaron-rogue:god-unlock';

  const $ = (s) => document.querySelector(s);
  const modal = $('#auth-modal');
  const input = $('#auth-input');
  const submit = $('#auth-submit');
  const close = $('#auth-close');
  const status = $('#auth-status');
  const trigger = $('#god-mode-btn');

  // If already unlocked, change the God Mode card CTA + skip the modal
  function alreadyUnlocked() {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  }
  if (alreadyUnlocked() && trigger) {
    const cta = trigger.querySelector('.mode-cta');
    if (cta) { cta.textContent = 'ENTER GOD MODE →'; cta.classList.remove('locked'); }
  }

  function openModal() {
    modal.hidden = false;
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 50);
  }
  function closeModal() {
    modal.hidden = true;
    modal.style.display = 'none';
    input.value = '';
    status.textContent = '';
    status.className = 'auth-status';
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
})();
