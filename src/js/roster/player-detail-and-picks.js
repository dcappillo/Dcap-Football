/* ============================================================
   ROSTER FIX + PLAYER DETAIL SCREEN + DRAFT PICKS
   ============================================================ */
(function () {
  /* ── Active team: always reads from DOM, never stale ───── */
  function activeTeamId() {
    var sel = document.getElementById('teamSelect');
    return sel && sel.value ? sel.value : window._activeTeamId || null;
  }
  function activeTeam() {
    var id = activeTeamId();
    return id ? getTeamById(id) : null;
  }

  /* ══════════════════════════════════════════════════════════
     FIXED renderPlayerStats — reads active team, clickable
     ════════════════════════════════════════════════════════ */
  window.renderPlayerStats = function () {
    var team = activeTeam();
    if (!team) return;

    /* ── Non-kicker rows ── */
    var rows = team.roster
      .filter(function (p) {
        return p.positions.indexOf('K') === -1;
      })
      .map(function (p) {
        var s = p.stats || {};
        return (
          '<tr style="cursor:pointer" onclick="renderPlayerDetail(\'' +
          p.id +
          '\')">' +
          '<td><span style="color:var(--accent2)">' +
          p.name +
          '</span></td>' +
          '<td>' +
          p.positions[0] +
          '</td>' +
          '<td>' +
          (s.gamesPlayed || 0) +
          '</td>' +
          '<td>' +
          (s.passingYards || 0) +
          '</td>' +
          '<td>' +
          (s.passingTD || 0) +
          '</td>' +
          '<td>' +
          (s.interceptionsThrown || 0) +
          '</td>' +
          '<td>' +
          (s.rushingYards || 0) +
          '</td>' +
          '<td>' +
          (s.rushingTD || 0) +
          '</td>' +
          '<td>' +
          (s.receivingYards || 0) +
          '</td>' +
          '<td>' +
          (s.receivingTD || 0) +
          '</td>' +
          '<td>' +
          (s.tackles || 0) +
          '</td>' +
          '<td>' +
          (s.sacks || 0) +
          '</td>' +
          '<td>' +
          (s.interceptions || 0) +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    /* ── Kicker rows ── */
    var kickers = team.roster.filter(function (p) {
      return p.positions.indexOf('K') !== -1;
    });
    var kickerSection = '';
    if (kickers.length) {
      var kRows = kickers
        .map(function (p) {
          var s = p.stats || {};
          var fgMade = s.fieldGoalsMade || 0;
          var fgMiss = s.fieldGoalsMissed || 0;
          var fgAtt = fgMade + fgMiss;
          var fgPct = fgAtt > 0 ? Math.round((fgMade / fgAtt) * 100) : '—';
          var xpMade = s.xpMade || 0;
          var xpMiss = s.xpMissed || 0;
          var xpAtt = xpMade + xpMiss;
          var xpPct = xpAtt > 0 ? Math.round((xpMade / xpAtt) * 100) : '—';
          var fgColor =
            typeof fgPct === 'number'
              ? fgPct >= 85
                ? '#4ade80'
                : fgPct >= 75
                  ? '#facc15'
                  : '#f87171'
              : 'var(--muted2)';
          var xpColor =
            typeof xpPct === 'number'
              ? xpPct >= 95
                ? '#4ade80'
                : xpPct >= 85
                  ? '#facc15'
                  : '#f87171'
              : 'var(--muted2)';
          return (
            '<tr style="cursor:pointer" onclick="renderPlayerDetail(\'' +
            p.id +
            '\')">' +
            '<td><span style="color:var(--accent2)">' +
            p.name +
            '</span></td>' +
            '<td>' +
            p.positions[0] +
            '</td>' +
            '<td>' +
            (s.gamesPlayed || 0) +
            '</td>' +
            '<td>' +
            fgMade +
            '/' +
            fgAtt +
            '</td>' +
            '<td style="color:' +
            fgColor +
            ';font-weight:600">' +
            (typeof fgPct === 'number' ? fgPct + '%' : '—') +
            '</td>' +
            '<td>' +
            xpMade +
            '/' +
            xpAtt +
            '</td>' +
            '<td style="color:' +
            xpColor +
            ';font-weight:600">' +
            (typeof xpPct === 'number' ? xpPct + '%' : '—') +
            '</td>' +
            '</tr>'
          );
        })
        .join('');
      kickerSection =
        '<h3 style="margin:20px 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--accent2)">Kickers</h3>' +
        '<table><thead><tr>' +
        '<th>Name</th><th>Pos</th><th>G</th>' +
        '<th>FG M/A</th><th>FG%</th>' +
        '<th>XP M/A</th><th>XP%</th>' +
        '</tr></thead><tbody>' +
        kRows +
        '</tbody></table>';
    }

    setMainContent(
      '<h2>' +
        team.city +
        ' ' +
        team.nickname +
        ' — Player Stats</h2>' +
        '<p class="small">Season totals. Tap any row for full profile.</p>' +
        '<table><thead><tr><th>Name</th><th>Pos</th><th>G</th>' +
        '<th>Pass Yds</th><th>Pass TD</th><th>INT</th>' +
        '<th>Rush Yds</th><th>Rush TD</th>' +
        '<th>Rec Yds</th><th>Rec TD</th>' +
        '<th>Tackles</th><th>Sacks</th><th>INT(D)</th>' +
        '</tr></thead><tbody>' +
        rows +
        '</tbody></table>' +
        kickerSection,
    );
  };

  /* ══════════════════════════════════════════════════════════
     PLAYER DETAIL SCREEN
     ════════════════════════════════════════════════════════ */
  window.renderPlayerDetail = function (playerId) {
    /* Find player across ALL teams */
    var found = null,
      foundTeam = null;
    listAllTeams(league).forEach(function (t) {
      t.roster.forEach(function (p) {
        if (String(p.id) === String(playerId)) {
          found = p;
          foundTeam = t;
        }
      });
    });
    if (!found) return;

    var p = found,
      team = foundTeam,
      s = p.stats || {},
      cs = p.careerStats || {},
      a = p.attributes || {};
    var onMyTeam = team.id === activeTeamId();

    /* Attribute progress bar */
    function bar(label, val) {
      val = val || 0;
      var c =
        val >= 90
          ? '#c084fc'
          : val >= 85
            ? '#60a5fa'
            : val >= 80
              ? '#4ade80'
              : val >= 70
                ? '#facc15'
                : val >= 60
                  ? '#94a3b8'
                  : '#f87171';
      return (
        '<div style="margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">' +
        '<span style="color:var(--muted2)">' +
        label +
        '</span>' +
        '<span style="font-weight:600;color:' +
        c +
        '">' +
        val +
        '</span></div>' +
        '<div style="height:4px;background:var(--surface3);border-radius:2px">' +
        '<div style="height:4px;width:' +
        val +
        '%;background:' +
        c +
        ';border-radius:2px"></div>' +
        '</div></div>'
      );
    }

    /* Stat row */
    function sr(lbl, v) {
      return (
        '<tr><td style="color:var(--muted2);font-size:12px;padding:4px 0">' +
        lbl +
        '</td><td style="font-weight:500;font-size:13px;text-align:right">' +
        (v || 0) +
        '</td></tr>'
      );
    }

    var devColor =
      p.devTrait === 'X-Factor'
        ? '#c084fc'
        : p.devTrait === 'Superstar'
          ? '#60a5fa'
          : p.devTrait === 'Star'
            ? '#facc15'
            : 'var(--muted2)';
    var moraleC = (p.morale || 70) >= 80 ? '#4ade80' : (p.morale || 70) >= 60 ? '#facc15' : '#f87171';
    var contract = p.contract
      ? '<strong>$' +
        p.contract.capHitPerYear.toLocaleString() +
        '</strong>/yr · ' +
        p.contract.years +
        ' yr' +
        (p.contract.years !== 1 ? 's' : '') +
        ' left'
      : '<em style="color:var(--muted)">Expiring</em>';

    var actions = onMyTeam
      ? '<div style="display:flex;gap:8px;margin-top:14px">' +
        '<button onclick="confirmCutPlayer(\'' +
        p.id +
        '\')" style="flex:1;background:rgba(239,68,68,.15);border-color:#ef4444;color:#ef4444;font-size:12px">✂ Cut</button>' +
        '<button onclick="window.renderTradeOffers&&window.renderTradeOffers(\'' +
        p.id +
        '\')" style="flex:1;background:rgba(59,130,246,.15);border-color:#3b82f6;color:#60a5fa;font-size:12px">🔄 Trade</button>' +
        '</div>'
      : '<p style="font-size:11px;color:var(--muted);margin-top:10px">Not on your roster — view only.</p>';

    setMainContent(
      '<button onclick="renderRoster()" style="width:auto;padding:5px 14px;margin-bottom:14px;font-size:12px">← Roster</button>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        /* Identity card */
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px">' +
        '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:700;color:var(--accent2)">' +
        p.name +
        '</div>' +
        '<div style="font-size:12px;color:var(--muted2);margin-bottom:10px">' +
        p.positions.join(' / ') +
        ' · Age ' +
        p.age +
        (p.isRookie ? ' <span style="color:var(--gold);font-size:10px">ROOKIE</span>' : '') +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:12px">' +
        '<div style="flex:1;text-align:center;background:var(--surface2);border-radius:8px;padding:8px">' +
        '<div style="font-size:26px;font-weight:700;color:' +
        ovrColor(a.overall || 0) +
        '">' +
        a.overall +
        '</div>' +
        '<div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">OVR</div>' +
        '</div>' +
        '<div style="flex:1;text-align:center;background:var(--surface2);border-radius:8px;padding:8px" ' +
        'title="Highest overall he can reach. A dev-trait upgrade re-rolls it.">' +
        '<div style="font-size:26px;font-weight:700;color:' +
        ovrColor(ensurePotential(p)) +
        '">' +
        p.potential +
        '</div>' +
        '<div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">POT</div>' +
        '</div>' +
        '<div style="flex:1;text-align:center;background:var(--surface2);border-radius:8px;padding:8px">' +
        '<div style="font-size:14px;font-weight:600;color:' +
        devColor +
        '">' +
        (p.devTrait || 'Normal') +
        '</div>' +
        '<div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Dev</div>' +
        '</div>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--muted2)">Contract</div>' +
        '<div style="font-size:13px;margin-bottom:8px">' +
        contract +
        '</div>' +
        '<div style="font-size:11px;color:var(--muted2)">Team</div>' +
        '<div style="font-size:13px;margin-bottom:8px">' +
        team.city +
        ' ' +
        team.nickname +
        '</div>' +
        (p.morale !== undefined
          ? '<div style="font-size:11px;color:var(--muted2)">Morale</div><div style="font-size:15px;font-weight:600;color:' +
            moraleC +
            '">' +
            p.morale +
            '/100</div>'
          : '') +
        actions +
        '</div>' +
        /* Attributes */
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px">' +
        '<div style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--accent2);margin-bottom:10px">Attributes</div>' +
        bar('Overall', a.overall) +
        bar('Athleticism', a.athleticism) +
        bar('Intelligence', a.intelligence) +
        bar('Toughness', a.toughness) +
        bar('Discipline', a.discipline) +
        '</div>' +
        '</div>' +
        /* Stats row */
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px">' +
        '<div style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--accent2);margin-bottom:8px">This Season</div>' +
        '<table style="width:100%"><tbody>' +
        sr('Games', s.gamesPlayed) +
        sr('Pass Yds', s.passingYards) +
        sr('Pass TD', s.passingTD) +
        sr('INT Thrown', s.interceptionsThrown) +
        sr('Rush Yds', s.rushingYards) +
        sr('Rush TD', s.rushingTD) +
        sr('Rec Yds', s.receivingYards) +
        sr('Rec TD', s.receivingTD) +
        sr('Tackles', s.tackles) +
        sr('Sacks', s.sacks) +
        sr('INT (Def)', s.interceptions) +
        sr('FG Made', s.fieldGoalsMade) +
        sr('FG Missed', s.fieldGoalsMissed) +
        sr('XP Made', s.xpMade) +
        sr('XP Missed', s.xpMissed) +
        '</tbody></table>' +
        '</div>' +
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px">' +
        '<div style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--accent2);margin-bottom:8px">Career Totals</div>' +
        '<table style="width:100%"><tbody>' +
        sr('Games', cs.gamesPlayed) +
        sr('Pass Yds', cs.passingYards) +
        sr('Pass TD', cs.passingTD) +
        sr('INT Thrown', cs.interceptionsThrown) +
        sr('Rush Yds', cs.rushingYards) +
        sr('Rush TD', cs.rushingTD) +
        sr('Rec Yds', cs.receivingYards) +
        sr('Rec TD', cs.receivingTD) +
        sr('Tackles', cs.tackles) +
        sr('Sacks', cs.sacks) +
        sr('INT (Def)', cs.interceptions) +
        sr('FG Made', cs.fieldGoalsMade) +
        sr('FG Missed', cs.fieldGoalsMissed) +
        sr('XP Made', cs.xpMade) +
        sr('XP Missed', cs.xpMissed) +
        '</tbody></table>' +
        '</div>' +
        '</div>',
    );
  };

  /* ── Cut player from detail screen ─────────────────────── */
  window.confirmCutPlayer = function (playerId) {
    var tid = activeTeamId();
    var team = getTeamById(tid);
    var p =
      team &&
      team.roster.find(function (x) {
        return String(x.id) === String(playerId);
      });
    if (!p) return;
    var dead = typeof calculateDeadMoney === 'function' ? calculateDeadMoney(p) : 0;
    if (!confirm('Cut ' + p.name + '?\nDead money: $' + dead.toLocaleString() + '\nThis cannot be undone.')) return;
    team.capUsed -= p.contract ? p.contract.capHitPerYear || 0 : 0;
    team.roster = team.roster.filter(function (x) {
      return String(x.id) !== String(playerId);
    });
    team.capUsed += dead;
    if (typeof recalcAllTeamCap === 'function') recalcAllTeamCap();
    p.isFreeAgent = true;
    if (typeof freeAgents !== 'undefined') freeAgents.push(p);
    if (typeof logTransaction === 'function')
      logTransaction('Release', team.city + ' ' + team.nickname + ' cut ' + p.name, team.id, p);
    renderRoster();
  };

  /* ══════════════════════════════════════════════════════════
     DRAFT PICK REGISTRY — 7 rounds per team per year
     ════════════════════════════════════════════════════════ */
  window.pickRegistry = {}; /* teamId → [pick, ...] */
  window.simYear = 1;

  /* ══════════════════════════════════════════════════════════
     OVERHAULED TRADE CENTER — shows real pick ownership
     ════════════════════════════════════════════════════════ */
  window.renderTradePicksUI = function (preSelectPlayerId) {
    if (!league) return;
    window.initDraftPicks();
    var tid = activeTeamId();
    var teams = listAllTeams(league);

    function teamOpts(selectedId) {
      return teams
        .map(function (t) {
          return (
            '<option value="' +
            t.id +
            '"' +
            (t.id === selectedId ? ' selected' : '') +
            '>' +
            t.city +
            ' ' +
            t.nickname +
            '</option>'
          );
        })
        .join('');
    }

    setMainContent(
      '<h2>Trade Center</h2>' +
        '<p class="small">Select two teams, choose players and picks, then propose.</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
        '<div><label>Team A (giving)</label><select id="tcTeamA" onchange="window._refreshTC()">' +
        teamOpts(tid) +
        '</select><div id="tcAssetsA"></div></div>' +
        '<div><label>Team B (giving)</label><select id="tcTeamB" onchange="window._refreshTC()">' +
        teamOpts(
          teams.find(function (t) {
            return t.id !== tid;
          }) || teams[0].id,
        ) +
        '</select><div id="tcAssetsB"></div></div>' +
        '</div>' +
        '<button onclick="window._proposeTrade()" style="margin-top:14px;width:100%;background:var(--accent-dim);border-color:var(--accent);color:var(--accent2);font-weight:600">📋 Propose Trade</button>' +
        '<div id="tcResult" style="margin-top:12px"></div>',
    );

    window._refreshTC();

    /* Pre-select player if coming from player detail */
    if (preSelectPlayerId) {
      setTimeout(function () {
        var selA = document.getElementById('tcPlayersA');
        if (!selA) return;
        for (var i = 0; i < selA.options.length; i++) {
          if (selA.options[i].value === String(preSelectPlayerId)) {
            selA.options[i].selected = true;
            break;
          }
        }
      }, 80);
    }
  };

  /* ── Accumulate career stats at season end ────────────── */
  window.accumulateCareerStats = function () {
    if (!league) return;
    listAllTeams(league).forEach(function (team) {
      team.roster.forEach(function (p) {
        if (!p.careerStats) p.careerStats = {};
        var s = p.stats || {},
          cs = p.careerStats;
        [
          'gamesPlayed',
          'passingYards',
          'passingTD',
          'interceptionsThrown',
          'rushingYards',
          'rushingTD',
          'receivingYards',
          'receivingTD',
          'tackles',
          'sacks',
          'interceptions',
          'fieldGoalsMade',
          'fieldGoalsMissed',
          'xpMade',
          'xpMissed',
        ].forEach(function (k) {
          cs[k] = (cs[k] || 0) + (s[k] || 0);
        });
      });
    });
  };

  /* ── Wire up on load ──────────────────────────────────── */
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      if (typeof league !== 'undefined' && league) window.initDraftPicks();

      /* Add "My Draft Picks" to sidebar draft section */
      var ds = document.getElementById('section-draft');
      if (ds && !ds.querySelector('[data-picks-btn]')) {
        var b = document.createElement('button');
        b.textContent = '📋 My Draft Picks';
        b.setAttribute('data-picks-btn', '1');
        b.onclick = window.renderMyPicks;
        ds.appendChild(b);
      }
    }, 300);
  });
})();
