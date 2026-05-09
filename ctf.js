// Shared CTF infrastructure: scoring, timing, flag verification, session export.
// Each lab includes this file in CTF mode and registers its config via
//   CTF.register({ id: 'lab1', name: '...', objective: '...', hints: [...], flagHash: '...' })
// then calls CTF.solved() on flag submit success.
(function () {
  const STORAGE_KEY = 'aaron-rogue:ctf-session';
  const POINTS_BASE = 1000;
  const HINT_COSTS = [100, 200, 300]; // cumulative cost per hint reveal
  const FAST_BONUS_SECS = 180;        // <3 min for full bonus
  const FAST_BONUS = 500;
  const MIN_SCORE = 100;

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return newSession();
  }
  function newSession() {
    return {
      session_id: 'sess_' + Math.random().toString(36).slice(2, 10),
      started_at: new Date().toISOString(),
      labs: {}, // id -> { started_at, completed_at, score, hints_used, time_seconds, completed }
    };
  }
  function saveSession(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {}
  }

  async function sha256Hex(s) {
    const buf = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function calcScore(hintsUsed, timeSecs) {
    let score = POINTS_BASE;
    for (let i = 0; i < hintsUsed && i < HINT_COSTS.length; i++) score -= HINT_COSTS[i];
    if (timeSecs <= FAST_BONUS_SECS) score += FAST_BONUS;
    return Math.max(MIN_SCORE, score);
  }

  const CTF = {
    config: null,
    session: loadSession(),
    state: { hintsUsed: 0, completed: false, startedAt: null },

    register(cfg) {
      this.config = cfg;
      this.state.startedAt = Date.now();
      const labRecord = this.session.labs[cfg.id] || {
        started_at: new Date().toISOString(),
        completed_at: null, score: 0, hints_used: 0,
        time_seconds: 0, completed: false,
      };
      this.session.labs[cfg.id] = labRecord;
      saveSession(this.session);
      this.state.hintsUsed = labRecord.hints_used || 0;
      this.state.completed = !!labRecord.completed;
    },

    revealHint(idx) {
      if (this.state.completed) return;
      if (idx + 1 > this.state.hintsUsed) {
        this.state.hintsUsed = idx + 1;
        const lab = this.session.labs[this.config.id];
        lab.hints_used = this.state.hintsUsed;
        saveSession(this.session);
      }
    },

    async checkFlag(input) {
      const cleaned = (input || '').trim();
      if (!cleaned) return { ok: false, reason: 'empty' };
      const got = await sha256Hex(cleaned);
      if (got !== this.config.flagHash) return { ok: false, reason: 'wrong' };
      if (!this.state.completed) {
        this.state.completed = true;
        const elapsed = Math.round((Date.now() - this.state.startedAt) / 1000);
        const score = calcScore(this.state.hintsUsed, elapsed);
        const lab = this.session.labs[this.config.id];
        lab.completed = true;
        lab.completed_at = new Date().toISOString();
        lab.time_seconds = elapsed;
        lab.score = score;
        saveSession(this.session);
        return { ok: true, score, time: elapsed, hintsUsed: this.state.hintsUsed };
      }
      const lab = this.session.labs[this.config.id];
      return { ok: true, score: lab.score, time: lab.time_seconds, hintsUsed: lab.hints_used, alreadyDone: true };
    },

    totalScore() {
      return Object.values(this.session.labs).reduce((s, l) => s + (l.score || 0), 0);
    },
    totalTime() {
      return Object.values(this.session.labs).reduce((s, l) => s + (l.time_seconds || 0), 0);
    },
    completedCount() {
      return Object.values(this.session.labs).filter((l) => l.completed).length;
    },

    exportSession() {
      const session = this.session;
      const summary = {
        ...session,
        ended_at: new Date().toISOString(),
        total_score: this.totalScore(),
        total_time_seconds: this.totalTime(),
        completed_count: this.completedCount(),
      };
      return JSON.stringify(summary, null, 2);
    },

    downloadSession() {
      const blob = new Blob([this.exportSession()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aaron-rogue-ctf-' + this.session.session_id + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    },

    resetAll() {
      this.session = newSession();
      saveSession(this.session);
      this.state = { hintsUsed: 0, completed: false, startedAt: Date.now() };
    },

    fmtTime(secs) {
      const m = Math.floor(secs / 60), s = secs % 60;
      return m + 'm ' + s.toString().padStart(2, '0') + 's';
    },
  };

  window.CTF = CTF;

  // Convenience helper for lab pages: build the standard mission sidebar
  // (objective + hints + flag input) given a container element + the lab's
  // config. Wires up reveal buttons and flag submit.
  CTF.installMissionSidebar = function (mount) {
    const cfg = this.config;
    if (!cfg) throw new Error('CTF.register() must be called first');
    mount.innerHTML =
      '<h2>Mission</h2>' +
      '<div class="mission-objective">' +
        '<div class="mission-tag">// objective</div>' +
        '<p>' + escapeHtml(cfg.objective) + '</p>' +
      '</div>' +
      '<div class="mission-hints" id="mission-hints">' +
        cfg.hints.map((h, i) =>
          '<div class="mission-hint" data-hint-idx="' + i + '">' +
            '<button class="hint-reveal-btn" data-i="' + i + '">' +
              'reveal hint ' + (i + 1) + '  <span class="hint-cost">(-' + HINT_COSTS[i] + ' pts)</span>' +
            '</button>' +
            '<div class="hint-body" hidden>' + escapeHtml(h) + '</div>' +
          '</div>'
        ).join('') +
      '</div>' +
      '<div class="mission-flag">' +
        '<div class="mission-tag">// flag</div>' +
        '<div class="flag-input-row">' +
          '<input type="text" class="flag-input" id="flag-input" autocomplete="off" placeholder="aaron{...}">' +
          '<button class="flag-submit" id="flag-submit">SUBMIT</button>' +
        '</div>' +
        '<div class="flag-status" id="flag-status"></div>' +
      '</div>' +
      '<div class="mission-score" id="mission-score"></div>' +
      '<div class="mission-foot">' +
        '<a class="mission-link" href="app.html?mode=ctf">← back to challenges</a>' +
      '</div>';

    // wire reveal buttons
    mount.querySelectorAll('.hint-reveal-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.i;
        CTF.revealHint(i);
        const wrap = btn.closest('.mission-hint');
        const body = wrap.querySelector('.hint-body');
        body.hidden = false;
        wrap.classList.add('revealed');
        btn.disabled = true;
        btn.textContent = 'hint ' + (i + 1) + ' revealed';
        CTF.renderScore();
      });
      // restore reveal state from session
      const i = +btn.dataset.i;
      if (i < CTF.state.hintsUsed) {
        const wrap = btn.closest('.mission-hint');
        wrap.querySelector('.hint-body').hidden = false;
        wrap.classList.add('revealed');
        btn.disabled = true;
        btn.textContent = 'hint ' + (i + 1) + ' revealed';
      }
    });

    const flagInput = mount.querySelector('#flag-input');
    const flagSubmit = mount.querySelector('#flag-submit');
    const flagStatus = mount.querySelector('#flag-status');
    async function submitFlag() {
      const v = flagInput.value;
      flagSubmit.disabled = true;
      flagStatus.textContent = 'verifying...';
      flagStatus.className = 'flag-status info';
      const r = await CTF.checkFlag(v);
      if (r.ok) {
        flagStatus.innerHTML =
          '<span class="ok">✓ ' + (r.alreadyDone ? 'already solved' : 'flag accepted') + '</span><br>' +
          'score: <strong>' + r.score + '</strong> · time: ' + CTF.fmtTime(r.time) +
          ' · hints used: ' + r.hintsUsed;
        flagStatus.className = 'flag-status ok';
        flagSubmit.textContent = 'SOLVED ✓';
        flagInput.disabled = true;
        CTF.renderScore();
      } else {
        flagStatus.textContent = r.reason === 'empty'
          ? 'enter a flag.'
          : '✗ wrong flag. read the lab carefully or try a hint.';
        flagStatus.className = 'flag-status danger';
        flagSubmit.disabled = false;
        flagInput.select();
      }
    }
    flagSubmit.addEventListener('click', submitFlag);
    flagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitFlag(); });

    CTF.renderScore = function () {
      const lab = CTF.session.labs[CTF.config.id];
      const el = mount.querySelector('#mission-score');
      if (!el) return;
      if (lab && lab.completed) {
        el.innerHTML = '<div class="ms-row"><strong>solved</strong> · score ' + lab.score +
          ' · time ' + CTF.fmtTime(lab.time_seconds) + ' · hints ' + lab.hints_used + '/3</div>' +
          '<div class="ms-row muted">total session: ' + CTF.totalScore() + ' pts · ' +
          CTF.completedCount() + '/10 challenges</div>';
      } else {
        const projected = calcScore(CTF.state.hintsUsed, 0);
        el.innerHTML = '<div class="ms-row muted">projected best: ' + projected + ' pts · ' +
          CTF.state.hintsUsed + '/3 hints used</div>';
      }
    };
    CTF.renderScore();
  };

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
