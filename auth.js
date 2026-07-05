// Access gate for the live-demo site. One 8-digit code unlocks everything.
// The plaintext code is NEVER in this file — only its SHA-256 hash.
// To rotate: compute SHA-256 of the new code and replace EXPECTED_HASH.
//   $ printf '%s' 'NEW_CODE' | sha256sum
(() => {
  const EXPECTED_HASH = '8ebf417858aaf4919385c3a734e7e600ec84a8df267ffb5abcd35009fb0f5f8d';
  const UNLOCK_KEY = 'rogue:event-unlock';

  const $ = (s) => document.querySelector(s);
  const gate = $('#gate');
  const main = $('#event-main');
  const input = $('#gate-input');
  const btn = $('#gate-btn');
  const status = $('#gate-status');
  if (!gate) return;

  function reveal() {
    gate.hidden = true;
    gate.style.display = 'none';
    if (main) main.hidden = false;
  }

  // Already unlocked this session? Skip straight in.
  if (sessionStorage.getItem(UNLOCK_KEY) === 'true') {
    reveal();
    return;
  }

  async function sha256Hex(s) {
    const buf = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function tryUnlock() {
    const code = (input.value || '').trim();
    if (!/^\d{8}$/.test(code)) {
      status.textContent = 'The access code is 8 digits.';
      status.className = 'gate-status warn';
      return;
    }
    btn.disabled = true;
    status.textContent = 'verifying…';
    status.className = 'gate-status info';
    try {
      const got = await sha256Hex(code);
      if (got === EXPECTED_HASH) {
        sessionStorage.setItem(UNLOCK_KEY, 'true');
        status.textContent = '✓ access granted';
        status.className = 'gate-status ok';
        setTimeout(reveal, 350);
      } else {
        status.textContent = '✗ wrong code';
        status.className = 'gate-status danger';
        btn.disabled = false;
        input.select();
      }
    } catch (e) {
      status.textContent = 'error: ' + e.message;
      status.className = 'gate-status danger';
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', tryUnlock);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); } });
})();
