/* ============================================================
   NEW GAME FLOW
   startNewGame → renderFranchisePicker → renderCoachCreation
   → saveNewCoach → home screen

   Franchise is set once here; sidebar/home dropdowns are
   hidden and kept in sync silently from this point on.
   ============================================================ */

/* ── Helper: colour a power rating ─────────────────────────── */
function _pwrColor(r) {
  return r >= 82 ? '#4ade80' : r >= 76 ? '#facc15' : r >= 70 ? '#94a3b8' : '#f87171';
}
function _pwrLabel(r) {
  return r >= 82 ? 'Elite' : r >= 76 ? 'Good' : r >= 70 ? 'Average' : 'Rebuilding';
}

/* ── Silently sync both dropdowns whenever the team changes ── */
function _syncTeamSelects(tid) {
  ['teamSelect', 'homeTeamSelect'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = tid;
  });
  if (typeof userTeamId !== 'undefined') userTeamId = tid;
}

/* ── Update the home hero franchise name ─────────────────────  */
function _updateHomeFranchiseName(teamId) {
  var el = document.getElementById('homeFranchiseName');
  var team = typeof getTeamById === 'function' ? getTeamById(teamId) : null;
  if (el && team) el.textContent = team.city + ' ' + team.nickname;
}

/* ═══════════════════════════════════════════════════════════
   STEP 0 — Entry point
   If active game exists, confirm before wiping.
═══════════════════════════════════════════════════════════ */
window.startNewGame = function () {
  var hasGame = typeof league !== 'undefined' && league && typeof userTeamId !== 'undefined' && userTeamId;

  if (!hasGame) {
    _doStartNewGame();
    return;
  }

  setMainContent(
    '<div style="max-width:400px;margin:60px auto;text-align:center;padding:24px">' +
      '<div style="font-size:44px;margin-bottom:12px">🏈</div>' +
      '<h2 style="margin-bottom:8px">Start New Game?</h2>' +
      '<p style="color:var(--muted2);font-size:13px;margin-bottom:24px">' +
      'This resets your current franchise. Export your save first if you want to keep it.' +
      '</p>' +
      '<div style="display:flex;gap:10px;justify-content:center">' +
      '<button onclick="renderHome()" style="flex:1;max-width:160px">← Cancel</button>' +
      '<button onclick="_doStartNewGame()" style="flex:1;max-width:160px;' +
      'background:rgba(239,68,68,.15);border-color:#ef4444;color:#f87171;font-weight:700">' +
      '🔄 Confirm' +
      '</button>' +
      '</div>' +
      '</div>',
  );
};

function _doStartNewGame() {
  /* Fresh league */
  league = buildLeague();
  schedule = generateSchedule(league);
  teamMap = buildTeamMap(league);
  currentWeekIndex = 0;
  window.simYear = 1;
  window.gmPhase = 'season';
  window.pickRegistry = {};
  window.playoffs = null;
  if (typeof window.initDraftPicks === 'function') window.initDraftPicks();
  renderFranchisePicker();
}

/* ═══════════════════════════════════════════════════════════
   STEP 1 — Franchise Picker: 32 team tiles
═══════════════════════════════════════════════════════════ */
window.renderFranchisePicker = function () {
  var teams = listAllTeams(league)
    .slice()
    .sort(function (a, b) {
      var ka = (a.conference || '') + (a.division || '') + a.city;
      var kb = (b.conference || '') + (b.division || '') + b.city;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

  teams.forEach(function (t) {
    t.powerRating = computeTeamPowerRating(t);
  });

  var tiles = teams
    .map(function (t) {
      var pr = t.powerRating || 70;
      var pc = _pwrColor(pr);
      return (
        '<div onclick="renderCoachCreation(\'' +
        t.id +
        '\')" ' +
        'style="background:var(--surface);border:2px solid var(--border);border-radius:10px;' +
        'padding:14px 10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;' +
        'text-align:center;gap:4px;min-height:96px;justify-content:center;' +
        'transition:border-color .12s,background .12s" ' +
        "onmouseover=\"this.style.borderColor='var(--accent)';this.style.background='var(--surface2)'\" " +
        "onmouseout=\"this.style.borderColor='var(--border)';this.style.background='var(--surface)'\">" +
        '<div style="font-size:9px;color:var(--muted2);text-transform:uppercase;letter-spacing:.9px">' +
        (t.conference || '') +
        ' · ' +
        (t.division || '') +
        '</div>' +
        "<div style=\"font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:700;" +
        'color:var(--accent2);line-height:1.1;margin-top:2px">' +
        t.city +
        '</div>' +
        "<div style=\"font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:600;" +
        'color:var(--text)">' +
        t.nickname +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:5px;margin-top:3px">' +
        '<span style="font-size:15px;font-weight:700;color:' +
        pc +
        '">' +
        pr +
        '</span>' +
        '<span style="font-size:10px;color:' +
        pc +
        '">' +
        _pwrLabel(pr) +
        '</span>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  setMainContent(
    '<div style="max-width:940px;margin:0 auto">' +
      '<div style="text-align:center;margin-bottom:20px">' +
      '<h2 style="margin-bottom:4px">Choose Your Franchise</h2>' +
      '<p class="small" style="color:var(--muted2)">' +
      'Tap a team to start your franchise. Power rating reflects current roster strength.' +
      '</p>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">' +
      tiles +
      '</div>' +
      '</div>',
  );
};

/* ═══════════════════════════════════════════════════════════
   STEP 2 — Head Coach Creation
═══════════════════════════════════════════════════════════ */
window._selectedCoachStyle = 'balanced';

var COACH_STYLES = [
  {
    id: 'balanced',
    icon: '⚖️',
    label: 'Balanced',
    desc: 'Well-rounded staff. No major weaknesses on either side of the ball.',
    off: 72,
    def: 72,
    lead: 72,
  },
  {
    id: 'offensive',
    icon: '⚡',
    label: 'Offensive Minded',
    desc: 'Elite offensive coordinator. Puts up points but defense may struggle.',
    off: 85,
    def: 62,
    lead: 68,
  },
  {
    id: 'defensive',
    icon: '🛡',
    label: 'Defensive Minded',
    desc: 'Lockdown defense specialist. Stops the opponent but offense is secondary.',
    off: 62,
    def: 85,
    lead: 68,
  },
  {
    id: 'leadership',
    icon: '🤝',
    label: 'Leadership Focused',
    desc: 'Exceptional motivator. Boosts chemistry, morale, and clutch performance.',
    off: 68,
    def: 68,
    lead: 88,
  },
];

window.renderCoachCreation = function (teamId) {
  var team = getTeamById(teamId);
  if (!team) return;
  window._pendingTeamId = teamId;
  window._selectedCoachStyle = 'balanced';

  var styleCards = COACH_STYLES.map(function (s) {
    var isDefault = s.id === 'balanced';
    return (
      '<div id="cstyle-' +
      s.id +
      '" onclick="window._pickCoachStyle(\'' +
      s.id +
      '\')" ' +
      'style="border:2px solid ' +
      (isDefault ? 'var(--accent)' : 'var(--border)') +
      ';' +
      'background:' +
      (isDefault ? 'var(--accent-dim)' : 'var(--surface)') +
      ';' +
      'border-radius:10px;padding:14px;cursor:pointer;transition:all .12s">' +
      '<div style="font-size:26px;margin-bottom:6px">' +
      s.icon +
      '</div>' +
      '<div style="font-weight:700;font-size:13px;color:var(--accent2);margin-bottom:4px">' +
      s.label +
      '</div>' +
      '<div style="font-size:11px;color:var(--muted2);line-height:1.5">' +
      s.desc +
      '</div>' +
      '</div>'
    );
  }).join('');

  setMainContent(
    '<div style="max-width:540px;margin:0 auto">' +
      /* Back button */
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">' +
      '<button onclick="renderFranchisePicker()" style="width:auto;padding:5px 12px;font-size:12px">← Back</button>' +
      '<div>' +
      '<h2 style="margin:0">Head Coach Creation</h2>' +
      '<div style="font-size:12px;color:var(--muted2)">' +
      team.city +
      ' ' +
      team.nickname +
      '</div>' +
      '</div>' +
      '</div>' +
      /* Name input */
      '<div style="margin-bottom:20px">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:var(--muted2);' +
      'text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Coach Name</label>' +
      '<input id="coachNameInput" type="text" placeholder="Enter your coach\'s name" maxlength="40" ' +
      'style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border);' +
      'background:var(--surface2);color:var(--text);font-size:15px;box-sizing:border-box">' +
      '</div>' +
      /* Custom Roster */
      '<div style="margin-bottom:24px;background:var(--surface);border:1px solid var(--border);' +
      'border-radius:10px;padding:14px 16px">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;' +
      'color:var(--accent2);margin-bottom:10px">📋 League Roster</div>' +
      '<div style="font-size:12px;color:var(--muted2);margin-bottom:10px;line-height:1.5">' +
      'Download the auto-generated roster as a CSV, edit player names, positions, ages and ratings, ' +
      'then re-import it before starting.' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
      '<button onclick="window.downloadRosterTemplate()" ' +
      'style="width:auto;padding:7px 14px;font-size:12px;font-weight:600;' +
      'background:rgba(59,130,246,.12);border-color:#3b82f6;color:#60a5fa">' +
      '📥 Download Roster Template' +
      '</button>' +
      '<button onclick="document.getElementById(\'_rosterFileInput\').click()" ' +
      'style="width:auto;padding:7px 14px;font-size:12px;font-weight:600;' +
      'background:rgba(22,163,74,.12);border-color:var(--accent);color:var(--accent2)">' +
      '📂 Import Custom Roster' +
      '</button>' +
      '<input type="file" id="_rosterFileInput" accept=".csv" style="display:none" ' +
      'onchange="window.importCustomRoster(this.files[0]);this.value=\'\'">' +
      '</div>' +
      '<div id="_rosterImportBadge" style="font-size:12px;color:var(--accent2);display:' +
      (window._customRosterImported
        ? 'block" >✅ ' +
          window._customRosterImported.players +
          ' players across ' +
          window._customRosterImported.teams +
          ' teams imported'
        : 'none" >') +
      '</div>' +
      '</div>' +
      /* Style selector */
      '<div style="margin-bottom:24px">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:var(--muted2);' +
      'text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Coaching Style</label>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      styleCards +
      '</div>' +
      '</div>' +
      /* Save */
      '<button onclick="window.saveNewCoach()" ' +
      'style="width:100%;padding:14px;font-size:16px;font-weight:700;letter-spacing:1px;' +
      "font-family:'Barlow Condensed',sans-serif;" +
      'background:var(--accent-dim);border-color:var(--accent);color:var(--accent2)">' +
      '🏈  START FRANCHISE →' +
      '</button>' +
      '</div>',
  );
};

window._pickCoachStyle = function (styleId) {
  window._selectedCoachStyle = styleId;
  COACH_STYLES.forEach(function (s) {
    var el = document.getElementById('cstyle-' + s.id);
    if (!el) return;
    var active = s.id === styleId;
    el.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
    el.style.background = active ? 'var(--accent-dim)' : 'var(--surface)';
  });
};

/* ═══════════════════════════════════════════════════════════
   STEP 3 — Save coach and launch the game
═══════════════════════════════════════════════════════════ */
window.saveNewCoach = function () {
  var nameEl = document.getElementById('coachNameInput');
  var name = nameEl ? nameEl.value.trim() : '';
  if (!name) {
    if (typeof _toast === 'function') _toast('⚠ Please enter a coach name', false);
    else alert('Please enter a coach name.');
    if (nameEl) nameEl.focus();
    return;
  }

  var style =
    COACH_STYLES.find(function (s) {
      return s.id === window._selectedCoachStyle;
    }) || COACH_STYLES[0];

  var teamId = window._pendingTeamId;
  var team = getTeamById(teamId);
  if (!team) return;

  /* Assign head coach */
  team.coach = {
    name: name,
    offenseRating: style.off,
    defenseRating: style.def,
    leadership: style.lead,
    jobSecurity: 75,
    contractYears: 5,
    contractRemaining: 5,
  };

  ensureMoraleAndChemistry();
  stampRosterContinuity();
  initializeLeaguePotential();

  /* Recompute power with new coach */
  team.powerRating = computeTeamPowerRating(team);

  /* Init picks for draft */
  if (typeof window.initDraftPicks === 'function') window.initDraftPicks();

  /* Rebuild dropdown options first (this also sets userTeamId to team[0])… */
  if (typeof renderTeamSelect === 'function') renderTeamSelect();

  /* …then immediately override with the user's chosen team */
  userTeamId = teamId;
  _syncTeamSelects(teamId);
  _updateHomeFranchiseName(teamId);
  window._gameStarted = true;

  /* Trigger any coordinator sync */
  if (typeof window.syncPlaybookDropdowns === 'function') window.syncPlaybookDropdowns();

  /* Snapshot OVR + granular attrs NOW — the timer-based captures fired
     at DOMContentLoaded before the custom roster existed and snapshotted
     the wrong (random) values. This call is the authoritative baseline. */
  if (typeof window.initSeasonOVR === 'function') window.initSeasonOVR();

  /* Go home */
  if (typeof renderHome === 'function') {
    renderHome();
    /* Re-sync at multiple intervals to win any race with renderHome's own timeouts */
    [80, 200, 500].forEach(function (ms) {
      setTimeout(function () {
        userTeamId = teamId;
        _syncTeamSelects(teamId);
        _updateHomeFranchiseName(teamId);
        if (ms === 200 && typeof window.renderHomeDashboard === 'function') {
          window.renderHomeDashboard(teamId);
        }
      }, ms);
    });
  }
};

/* ═══════════════════════════════════════════════════════════
   CUSTOM ROSTER — Download Template & Import
═══════════════════════════════════════════════════════════ */

/* Ordered list of every granular attribute column (must match ATTR_LABELS keys) */
var _ROSTER_ATTR_COLS = [
  'speed',
  'acceleration',
  'agility',
  'strength',
  'stamina',
  'awareness',
  'throwPower',
  'throwAccShort',
  'throwAccMid',
  'throwAccDeep',
  'elusiveness',
  'trucking',
  'jukeMoves',
  'spinMove',
  'ballCarrierVision',
  'carrying',
  'catching',
  'catchInTraffic',
  'routeRunning',
  'release',
  'spectacularCatch',
  'passBlock',
  'runBlock',
  'passBlockStrength',
  'passBlockFootwork',
  'runBlockStrength',
  'runBlockFinesse',
  'blockShedding',
  'tackle',
  'powerMoves',
  'finesseMoves',
  'pursuit',
  'playRecognition',
  'manCoverage',
  'zoneCoverage',
  'press',
  'hitPower',
  'kickPower',
  'kickAccuracy',
];

/* Simple quoted-CSV/TSV row parser — auto-detects tab vs comma delimiter */
var _csvDelimiter = ','; /* set by importCustomRoster before parsing */
function _parseCSVRow(row) {
  var delim = _csvDelimiter;
  /* Tab-delimited: no quoting convention, fast-path split */
  if (delim === '\t')
    return row.split('\t').map(function (c) {
      return c.trim();
    });
  var result = [],
    cur = '',
    inQ = false;
  for (var i = 0; i < row.length; i++) {
    var c = row[i];
    if (c === '"') {
      if (inQ && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === delim && !inQ) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function _csvQuote(v) {
  return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
}

/* Download the current league rosters as a CSV template */
window.downloadRosterTemplate = function () {
  if (typeof league === 'undefined' || !league) {
    if (typeof _toast === 'function') _toast('⚠ No league loaded yet', false);
    return;
  }

  /* Header: identity columns + every granular attribute */
  var header = ['team_id', 'team_name', 'name', 'position', 'age'].concat(_ROSTER_ATTR_COLS);
  var rows = [header.join(',')];

  listAllTeams(league).forEach(function (team) {
    var teamName = team.city + ' ' + team.nickname;
    (team.roster || []).forEach(function (p) {
      /* Ensure granular attrs exist on the player */
      var g = p.granularAttrs;
      if (!g && typeof window.initGranularAttrs === 'function') {
        g = window.initGranularAttrs(p);
      }
      g = g || {};

      var pos = p.positions ? p.positions[0] : 'LB';
      var row = [_csvQuote(team.id), _csvQuote(teamName), _csvQuote(p.name), _csvQuote(pos), _csvQuote(p.age)];
      _ROSTER_ATTR_COLS.forEach(function (k) {
        row.push(_csvQuote(g[k] !== undefined ? g[k] : 60));
      });
      rows.push(row.join(','));
    });
  });

  var csv = rows.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'roster_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof _toast === 'function') _toast('📥 roster_template.csv downloaded', true);
};

/* Import a CSV and apply it to the current league */
window.importCustomRoster = function (file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var lines = e.target.result.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
      /* Auto-detect delimiter: if the header row has tabs, treat as TSV */
      _csvDelimiter = lines[0].indexOf('\t') !== -1 ? '\t' : ',';
      var headers = _parseCSVRow(lines[0]).map(function (h) {
        return h
          .trim()
          .toLowerCase()
          .replace(/[^a-z_]/g, '');
      });

      var iTeamId = headers.indexOf('team_id');
      var iName = headers.indexOf('name');
      var iPos = headers.indexOf('position');
      var iAge = headers.indexOf('age');

      if (iTeamId < 0 || iName < 0 || iPos < 0) {
        if (typeof _toast === 'function') _toast('⚠ CSV missing required columns (team_id, name, position)', false);
        return;
      }

      /* Build a column-index map for every granular attribute present in the CSV.
         Headers were normalized to lowercase (no uppercase letters), so normalise
         each _ROSTER_ATTR_COLS key the same way before looking it up.            */
      var attrColIdx = {};
      _ROSTER_ATTR_COLS.forEach(function (k) {
        var normKey = k.toLowerCase().replace(/[^a-z_]/g, '');
        var idx = headers.indexOf(normKey);
        if (idx >= 0) attrColIdx[k] = idx;
      });

      /* Also accept a legacy "overall" column as a fallback */
      var iOvr = headers.indexOf('overall');

      /* Require at least one of: granular attr columns OR an overall column */
      var hasGranular = Object.keys(attrColIdx).length > 0;
      if (!hasGranular && iOvr < 0) {
        if (typeof _toast === 'function')
          _toast('⚠ CSV must have granular attribute columns or an overall column', false);
        return;
      }

      /* Group rows by team_id */
      var byTeam = {};
      for (var i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        var cols = _parseCSVRow(lines[i]);
        var tid = cols[iTeamId] || '';
        if (!tid) continue;
        if (!byTeam[tid]) byTeam[tid] = [];

        /* Read every granular attribute that appears in the CSV */
        var g = {};
        _ROSTER_ATTR_COLS.forEach(function (k) {
          if (attrColIdx[k] !== undefined) {
            var val = parseInt(cols[attrColIdx[k]]);
            g[k] = isNaN(val) ? 60 : Math.max(20, Math.min(99, val));
          }
        });

        byTeam[tid].push({
          name: cols[iName] || 'Unknown',
          pos: cols[iPos] || 'QB',
          age: parseInt(cols[iAge]) || 23,
          g: g,
          legacyOvr: iOvr >= 0 ? parseInt(cols[iOvr]) || null : null,
        });
      }

      /* Apply to league */
      var teamsUpdated = 0,
        playersImported = 0;
      listAllTeams(league).forEach(function (team) {
        var rows = byTeam[team.id];
        if (!rows || !rows.length) return;
        team.roster = [];
        team.capUsed = 0;

        rows.forEach(function (r) {
          var pos = r.pos;
          var g = r.g;

          /* If the CSV had no granular attrs (legacy "overall" only), generate
             a full attribute set seeded from that overall value.              */
          if (!Object.keys(g).length) {
            var seedOvr = r.legacyOvr || 72;
            var fakePlayer = {
              positions: [pos],
              granularAttrs: null,
              attributes: {
                overall: seedOvr,
                athleticism: seedOvr,
                intelligence: seedOvr,
                toughness: seedOvr,
                discipline: seedOvr,
              },
            };
            if (typeof window.initGranularAttrs === 'function') {
              g = window.initGranularAttrs(fakePlayer) || {};
            }
          }

          /* Derive overall and composites from the granular set */
          var overall = 72;
          var comp = { athleticism: 72, intelligence: 72, toughness: 72, discipline: 72 };
          if (typeof window.calcPosOVR === 'function' && Object.keys(g).length) {
            overall = window.calcPosOVR(g, pos);
          } else if (r.legacyOvr) {
            overall = r.legacyOvr;
          }
          if (typeof window.deriveComposites === 'function' && Object.keys(g).length) {
            comp = window.deriveComposites(g);
          }

          var attrs = {
            overall: overall,
            athleticism: comp.athleticism,
            intelligence: comp.intelligence,
            toughness: comp.toughness,
            discipline: comp.discipline,
          };

          var positions = typeof generatePositionsForPlayer === 'function' ? generatePositionsForPlayer(pos) : [pos];

          var contract =
            typeof generateContract === 'function' ? generateContract(overall, r.age) : { capHitPerYear: 0 };

          var p = {
            id: typeof globalPlayerId !== 'undefined' ? globalPlayerId++ : Math.random(),
            name: r.name,
            positions: positions,
            age: r.age,
            attributes: attrs,
            granularAttrs: Object.keys(g).length ? g : undefined,
            contract: contract,
            stats: typeof defaultPlayerStats === 'function' ? defaultPlayerStats() : {},
          };

          team.roster.push(p);
          if (contract) team.capUsed += contract.capHitPerYear || 0;
          playersImported++;
        });

        if (typeof computeTeamPowerRating === 'function') team.powerRating = computeTeamPowerRating(team);
        teamsUpdated++;
      });

      window._customRosterImported = { teams: teamsUpdated, players: playersImported };

      /* Update the status badge if the coach creation screen is still open */
      var badge = document.getElementById('_rosterImportBadge');
      if (badge) {
        badge.innerHTML = '✅ ' + playersImported + ' players across ' + teamsUpdated + ' teams imported';
        badge.style.color = 'var(--accent2)';
        badge.style.display = 'block';
      }
      if (typeof _toast === 'function')
        _toast('✅ Custom roster imported — ' + playersImported + ' players, ' + teamsUpdated + ' teams', true);
    } catch (err) {
      if (typeof _toast === 'function') _toast('⚠ Import failed: ' + err.message, false);
    }
  };
  reader.readAsText(file);
};

/* ── On load: if no game exists show a start-game prompt ─────── */
window.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () {
    /* If the league hasn't been started yet, swap the hero into
       a minimal splash so the user knows to click New Game.     */
    var hasGame = typeof userTeamId !== 'undefined' && userTeamId;
    if (!hasGame) {
      var name = document.getElementById('homeFranchiseName');
      if (name) name.textContent = 'Football Sim';
      var dash = document.getElementById('homeDashboard');
      if (dash)
        dash.innerHTML =
          '<p style="font-size:12px;color:var(--muted2);margin:8px 0 0">Click <strong>New Game</strong> below to start your franchise.</p>';
    }
  }, 600);
});
