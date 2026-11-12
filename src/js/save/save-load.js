/* ============================================================
   SAVE / LOAD SYSTEM
   Serializes every piece of global game state to compressed JSON.
   Saving always downloads a file; localStorage is only a convenience
   cache for the "last save" display.
   ============================================================ */
(function () {
  var SAVE_VERSION = 1;

  /* ── LZ-String (inline, MIT) — compresses saves ~4-5× ───── */
  var LZString = (function () {
    var f = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
      u = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$',
      e = {};
    var t = {
      compressToUTF16: function (o) {
        return null == o
          ? ''
          : t._compress(o, 15, function (o) {
              return String.fromCharCode(o + 32);
            }) + ' ';
      },
      decompressFromUTF16: function (o) {
        return null == o
          ? ''
          : '' == o
            ? null
            : t._decompress(o.length, 16384, function (r) {
                return o.charCodeAt(r) - 32;
              });
      },
      compress: function (o) {
        return t._compress(o, 16, function (o) {
          return String.fromCharCode(o);
        });
      },
      decompress: function (o) {
        return null == o
          ? ''
          : '' == o
            ? null
            : t._decompress(o.length, 32768, function (r) {
                return o.charCodeAt(r);
              });
      },
      _compress: function (o, r, e) {
        if (null == o) return '';
        var f,
          n,
          u,
          i = {},
          p = {},
          a = '',
          c = '',
          l = '',
          s = 2,
          d = 3,
          h = 2,
          v = [],
          b = 0,
          g = 0;
        for (u = 0; u < o.length; u += 1) {
          a = o.charAt(u);
          Object.prototype.hasOwnProperty.call(i, a) || ((i[a] = {}), s++, (p[a] = !0));
          c = l + a;
          if (Object.prototype.hasOwnProperty.call(i, c)) l = c;
          else {
            if (Object.prototype.hasOwnProperty.call(p, l)) {
              if (l.charCodeAt(0) < 256) {
                for (f = 0; f < h; f++) ((b = b << 1), g == r - 1 ? ((g = 0), v.push(e(b)), (b = 0)) : g++);
                for (n = l.charCodeAt(0), f = 7; f >= 0; f--)
                  ((b = (b << 1) | ((n >> f) & 1)), g == r - 1 ? ((g = 0), v.push(e(b)), (b = 0)) : g++);
              } else {
                for (n = 1, f = 0; f < h; f++)
                  ((b = (b << 1) | n), g == r - 1 ? ((g = 0), v.push(e(b)), (b = 0)) : g++);
                n = 0;
                for (n = l.charCodeAt(0), f = 15; f >= 0; f--)
                  ((b = (b << 1) | ((n >> f) & 1)), g == r - 1 ? ((g = 0), v.push(e(b)), (b = 0)) : g++);
              }
              (d--, 0 == d && ((d = Math.pow(2, h)), h++));
              delete p[l];
            } else
              for (n = i[l], f = h - 1; f >= 0; f--)
                ((b = (b << 1) | ((n >> f) & 1)), g == r - 1 ? ((g = 0), v.push(e(b)), (b = 0)) : g++);
            (d--, 0 == d && ((d = Math.pow(2, h)), h++));
            ((i[c] = s++), (l = String(a)));
          }
        }
        if ('' !== l) {
          if (Object.prototype.hasOwnProperty.call(p, l)) {
            if (l.charCodeAt(0) < 256) {
              for (f = 0; f < h; f++) ((b = b << 1), g == r - 1 ? ((g = 0), v.push(e(b)), (b = 0)) : g++);
              for (n = l.charCodeAt(0), f = 7; f >= 0; f--)
                ((b = (b << 1) | ((n >> f) & 1)), g == r - 1 ? ((g = 0), v.push(e(b)), (b = 0)) : g++);
            } else {
              for (n = 1, f = 0; f < h; f++) ((b = (b << 1) | n), g == r - 1 ? ((g = 0), v.push(e(b)), (b = 0)) : g++);
              n = 0;
              for (n = l.charCodeAt(0), f = 15; f >= 0; f--)
                ((b = (b << 1) | ((n >> f) & 1)), g == r - 1 ? ((g = 0), v.push(e(b)), (b = 0)) : g++);
            }
            (d--, 0 == d && ((d = Math.pow(2, h)), h++));
            delete p[l];
          } else
            for (n = i[l], f = h - 1; f >= 0; f--)
              ((b = (b << 1) | ((n >> f) & 1)), g == r - 1 ? ((g = 0), v.push(e(b)), (b = 0)) : g++);
          (d--, 0 == d && ((d = Math.pow(2, h)), h++));
        }
        for (n = 2, f = 0; f < h; f++)
          ((b = (b << 1) | ((n >> f) & 1)), g == r - 1 ? ((g = 0), v.push(e(b)), (b = 0)) : g++);
        for (;;) {
          if (((b = b << 1), g == r - 1)) {
            v.push(e(b));
            break;
          }
          g++;
        }
        return v.join('');
      },
      _decompress: function (o, e, f) {
        var n,
          u,
          i,
          p,
          a,
          c,
          l,
          s = [],
          d = 4,
          h = 4,
          v = 3,
          b = '',
          g = [],
          m = { val: f(0), position: e, index: 1 };
        for (n = 0; n < 3; n += 1) s[n] = n;
        for (i = 0, a = Math.pow(2, 2), c = 1; c != a;)
          ((p = m.val & m.position),
            (m.position >>= 1),
            0 == m.position && ((m.position = e), (m.val = f(m.index++))),
            (i |= (p > 0 ? 1 : 0) * c),
            (c <<= 1));
        switch (i) {
          case 0:
            for (i = 0, a = Math.pow(2, 8), c = 1; c != a;)
              ((p = m.val & m.position),
                (m.position >>= 1),
                0 == m.position && ((m.position = e), (m.val = f(m.index++))),
                (i |= (p > 0 ? 1 : 0) * c),
                (c <<= 1));
            l = String.fromCharCode(i);
            break;
          case 1:
            for (i = 0, a = Math.pow(2, 16), c = 1; c != a;)
              ((p = m.val & m.position),
                (m.position >>= 1),
                0 == m.position && ((m.position = e), (m.val = f(m.index++))),
                (i |= (p > 0 ? 1 : 0) * c),
                (c <<= 1));
            l = String.fromCharCode(i);
            break;
          case 2:
            return '';
        }
        for (s[3] = l, u = l, g.push(l); ;) {
          if (m.index > o) {
            return '';
          }
          for (i = 0, a = Math.pow(2, v), c = 1; c != a;)
            ((p = m.val & m.position),
              (m.position >>= 1),
              0 == m.position && ((m.position = e), (m.val = f(m.index++))),
              (i |= (p > 0 ? 1 : 0) * c),
              (c <<= 1));
          switch ((l = i)) {
            case 0:
              for (i = 0, a = Math.pow(2, 8), c = 1; c != a;)
                ((p = m.val & m.position),
                  (m.position >>= 1),
                  0 == m.position && ((m.position = e), (m.val = f(m.index++))),
                  (i |= (p > 0 ? 1 : 0) * c),
                  (c <<= 1));
              ((s[d++] = String.fromCharCode(i)), (l = d - 1), h--);
              break;
            case 1:
              for (i = 0, a = Math.pow(2, 16), c = 1; c != a;)
                ((p = m.val & m.position),
                  (m.position >>= 1),
                  0 == m.position && ((m.position = e), (m.val = f(m.index++))),
                  (i |= (p > 0 ? 1 : 0) * c),
                  (c <<= 1));
              ((s[d++] = String.fromCharCode(i)), (l = d - 1), h--);
              break;
            case 2:
              return g.join('');
          }
          if ((0 == h && ((h = Math.pow(2, v)), v++), s[l])) b = s[l];
          else {
            if (l !== d) return null;
            b = u + u.charAt(0);
          }
          (g.push(b), (s[d++] = u + b.charAt(0)), h--, (u = b), 0 == h && ((h = Math.pow(2, v)), v++));
        }
      },
    };
    return t;
  })();

  /* ── Helpers: compress to storage / decompress from storage ─ */
  function _saveStr(state) {
    /* Plain JSON — always survives FileReader.readAsText() roundtrip.
       LZString.compressToUTF16 produces high-Unicode characters that
       get corrupted by the browser's text encoding pipeline.          */
    return JSON.stringify(state);
  }
  function _loadStr(raw) {
    /* Try plain JSON first (new format), then LZString for old saves */
    try {
      return JSON.parse(raw);
    } catch (e) {
      /* try compressed */
    }
    try {
      var dec = LZString.decompressFromUTF16(raw);
      if (dec) return JSON.parse(dec);
    } catch (e2) {
      /* give up */
    }
    throw new Error('Could not parse save file — not valid JSON or compressed data');
  }

  /* ── Collect all live game state into one object ─────────── */
  function captureState() {
    /* Find highest player ID so new-game IDs don't collide after load */
    var maxId = 0;
    if (league) {
      listAllTeams(league).forEach(function (t) {
        t.roster.forEach(function (p) {
          var n = parseInt(p.id, 10);
          if (!isNaN(n) && n > maxId) maxId = n;
        });
      });
    }

    return {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      simYear: window.simYear || 1,
      currentWeekIndex: currentWeekIndex || 0,
      userTeamId: userTeamId || null,
      globalPlayerId: Math.max(globalPlayerId || 1, maxId + 1),
      league: league,
      schedule: schedule,
      freeAgents: typeof freeAgents !== 'undefined' ? freeAgents : [],
      draftClass: typeof draftClass !== 'undefined' ? draftClass : [],
      draftOrder: typeof draftOrder !== 'undefined' ? draftOrder : [],
      draftRound: typeof draftRound !== 'undefined' ? draftRound : 1,
      draftIndex: typeof draftIndex !== 'undefined' ? draftIndex : 0,
      pickRegistry: window.pickRegistry || {},
      draftTrades: window.draftTrades || {},
      transactionLog: typeof transactionLog !== 'undefined' ? transactionLog : [],
      coachFreeAgents: typeof coachFreeAgents !== 'undefined' ? coachFreeAgents : [],
      coordinatorFAs: typeof coordinatorFreeAgents !== 'undefined' ? coordinatorFreeAgents : [],
    };
  }

  /* ── Restore a captured state back to all live globals ───── */
  function restoreState(state) {
    if (!state || state.version !== SAVE_VERSION) {
      _toast && _toast('❌ Save incompatible with this game version', false);
      return false;
    }

    /* Core game globals */
    window.simYear = state.simYear || 1;
    currentWeekIndex = state.currentWeekIndex || 0;
    userTeamId = state.userTeamId || null;
    globalPlayerId = state.globalPlayerId || 1;
    league = state.league;
    schedule = state.schedule;

    /* Rebuild teamMap (derived from league — not serialised directly) */
    teamMap = buildTeamMap(league);

    /* Arrays and registries */
    freeAgents = state.freeAgents || [];
    draftClass = state.draftClass || [];
    draftOrder = state.draftOrder || [];
    draftRound = state.draftRound || 1;
    draftIndex = state.draftIndex || 0;
    window.pickRegistry = state.pickRegistry || {};
    window.draftTrades = state.draftTrades || {};
    transactionLog = state.transactionLog || [];
    coachFreeAgents = state.coachFreeAgents || [];
    coordinatorFreeAgents = state.coordinatorFAs || [];

    /* Sync UI */
    renderTeamSelect(); /* rebuild dropdown from loaded league */
    if (state.userTeamId) {
      var sel = document.getElementById('teamSelect');
      if (sel) sel.value = state.userTeamId;
    }
    updateWeekLabel();

    /* Update header brand with loaded team */
    var team = teamMap && userTeamId ? teamMap[userTeamId] : null;
    var h1 = document.querySelector('.header-brand h1');
    var sub = document.querySelector('.header-brand .sub');
    if (h1 && team) h1.textContent = '⚡ ' + team.city + ' ' + team.nickname;
    if (sub && team) sub.textContent = team.conference + ' · ' + team.division;

    /* Season info label */
    var si = document.getElementById('seasonInfo');
    if (si && league) si.textContent = league.name + ' · Season ' + (window.simYear || 1);

    ensureMoraleAndChemistry();
    ensureLeaguePotential();
    return true;
  }

  /* ─────────────────────────────────────────────────────────
     SAVE / LOAD — FILE-FIRST SYSTEM

     Save  = always exports a .txt download file.
     Load  = always imports a .txt file from disk.
     localStorage used only as a convenience cache so the
     "last save" info can be displayed; never relied upon.
  ──────────────────────────────────────────────────────── */

  function _toast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'background:' +
      (ok ? 'rgba(22,163,74,.95)' : 'rgba(239,68,68,.95)') +
      ';' +
      'border:1px solid ' +
      (ok ? '#16a34a' : '#ef4444') +
      ';' +
      'color:#fff;padding:10px 22px;border-radius:8px;font-size:13px;' +
      'font-weight:600;z-index:99999;pointer-events:none;' +
      'box-shadow:0 4px 20px rgba(0,0,0,.6)';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () {
      if (t.parentNode) t.remove();
    }, 3000);
  }

  function _downloadFile(str, filename) {
    var blob = new Blob([str], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  /* ── SAVE: always exports a file ─────────────────────── */
  window._doSave = function () {
    if (typeof league === 'undefined' || !league) {
      _toast('⚠ No active game to save', false);
      return;
    }
    var state, str;
    try {
      state = captureState();
      str = _saveStr(state);
    } catch (e) {
      _toast('❌ Save failed: ' + e.message, false);
      return;
    }

    var team = state.userTeamId && typeof getTeamById === 'function' ? getTeamById(state.userTeamId) : null;
    var teamSlug = team ? (team.city + '_' + team.nickname).replace(/\s+/g, '_') : 'game';
    var filename =
      'gm_' +
      teamSlug +
      '_S' +
      (state.simYear || 1) +
      '_W' +
      (state.currentWeekIndex || 0) +
      '_' +
      new Date().toISOString().slice(0, 10) +
      '.txt';

    _downloadFile(str, filename);
    /* Also cache in localStorage for the "last save" display */
    try {
      localStorage.setItem(
        'gm_last_save_meta',
        JSON.stringify({
          savedAt: state.savedAt,
          simYear: state.simYear,
          week: state.currentWeekIndex,
          teamName: team ? team.city + ' ' + team.nickname : '—',
          record: team ? team.wins + '-' + team.losses : '',
        }),
      );
    } catch (e) {
      /* ignore */
    }

    _toast('✅ Save file downloading…', true);
    renderSaveLoad();
  };

  /* ── LOAD: file picker, then restoreState ───────────────── */
  window._doLoad = function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json';
    input.style.display = 'none';
    input.onchange = function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        var state;
        try {
          state = _loadStr(ev.target.result);
        } catch (err) {
          _toast('❌ Invalid save file: ' + err.message, false);
          return;
        }
        if (!state || !state.league) {
          _toast('❌ Save file appears empty or corrupt', false);
          return;
        }
        if (!restoreState(state)) return;
        /* Re-run post-load hooks */
        if (typeof window.initDraftPicks === 'function') window.initDraftPicks();
        if (typeof window.syncPlaybookDropdowns === 'function') window.syncPlaybookDropdowns();
        if (typeof renderHome === 'function') renderHome();
        _toast(
          '✅ Game loaded — ' +
            (state.userTeamId && typeof getTeamById === 'function'
              ? (function (t) {
                  return t ? t.city + ' ' + t.nickname : '';
                })(getTeamById(state.userTeamId))
              : ''),
          true,
        );
        renderSaveLoad();
      };
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  /* Keep old aliases pointing at new functions */
  window._importSave = window._doLoad;
  window._exportSave = window._doSave;
  window._doLoadAutosave = window._doLoad;

  /* ── Render the save/load screen ────────────────────────── */
  window.renderSaveLoad = function () {
    var meta = null;
    try {
      var raw = localStorage.getItem('gm_last_save_meta');
      if (raw) meta = JSON.parse(raw);
    } catch (e) {
      /* ignore */
    }

    var lastSaveHtml = meta
      ? '<div style="background:var(--surface2);border:1px solid var(--border);' +
        'border-radius:8px;padding:12px 14px;margin-bottom:16px">' +
        '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;' +
        'letter-spacing:.8px;margin-bottom:6px">Last saved game</div>' +
        '<div style="font-size:14px;font-weight:600;color:var(--accent2)">' +
        (meta.teamName || '—') +
        '</div>' +
        '<div style="font-size:11px;color:var(--muted2);margin-top:2px">' +
        'Season ' +
        (meta.simYear || '?') +
        ' · Week ' +
        (meta.week || 0) +
        (meta.record ? ' · ' + meta.record : '') +
        ' · ' +
        (meta.savedAt ? new Date(meta.savedAt).toLocaleDateString() : '') +
        '</div>' +
        '</div>'
      : '<div style="font-size:12px;color:var(--muted2);margin-bottom:16px;font-style:italic">' +
        'No save on record in this browser yet.</div>';

    var activeGame = typeof league !== 'undefined' && league;

    setMainContent(
      '<h2>💾 Save / Load</h2>' +
        '<p class="small" style="margin-bottom:14px">' +
        'Saves download as <strong>.txt</strong> files to your device. ' +
        'Load them back with the Import button. Works across browsers and devices.' +
        '</p>' +
        lastSaveHtml +
        '<div style="display:flex;flex-direction:column;gap:10px">' +
        /* Save button */
        '<div style="background:var(--surface);border:1px solid var(--border);' +
        'border-radius:10px;padding:16px">' +
        '<div style="font-size:13px;font-weight:600;margin-bottom:4px">Export Save File</div>' +
        '<div style="font-size:11px;color:var(--muted2);margin-bottom:10px">' +
        'Downloads your current game as a .txt file.' +
        '</div>' +
        '<button onclick="window._doSave()" style="width:100%;background:var(--accent-dim);' +
        'border-color:var(--accent);color:var(--accent2);font-weight:700;font-size:14px;' +
        'padding:12px;' +
        (!activeGame ? 'opacity:.45;pointer-events:none' : '') +
        '">' +
        '⬇ Save & Download' +
        '</button>' +
        (!activeGame
          ? '<div style="font-size:10px;color:var(--muted);margin-top:6px;text-align:center">' +
            'Start a new game first</div>'
          : '') +
        '</div>' +
        /* Load button */
        '<div style="background:var(--surface);border:1px solid var(--border);' +
        'border-radius:10px;padding:16px">' +
        '<div style="font-size:13px;font-weight:600;margin-bottom:4px">Import Save File</div>' +
        '<div style="font-size:11px;color:var(--muted2);margin-bottom:10px">' +
        'Load a .txt save file from your device to resume a game.' +
        '</div>' +
        '<button onclick="window._doLoad()" style="width:100%;background:rgba(59,130,246,.15);' +
        'border-color:#3b82f6;color:#60a5fa;font-weight:700;font-size:14px;padding:12px">' +
        '⬆ Import & Load' +
        '</button>' +
        '</div>' +
        '</div>',
    );
  };
})();
