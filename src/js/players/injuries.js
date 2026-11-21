/* ============================================================
   INJURY & SUSPENSION SYSTEM
   ============================================================
   Data model per player:
     p.injury = {
       type:     string   e.g. "Hamstring", "Concussion", "Broken Arm"
       severity: 'minor' | 'moderate' | 'major' | 'careerThreatening'
       weeksRemaining: int   (weeks until the player is healthy)
       weeksSustained: int   (sim year + week when it happened — for history)
     }
     p.suspension = {
       weeksRemaining: int
       reason: string
     }

   Active injury → player is OUT of the lineup (power rating penalty).
   Suspension     → player is OUT of the lineup.
   Recovery       → weeksRemaining ticks down each simulated week.
   History        → pushed to p.injuryHistory[] for regression calc.

   UI surface:
     • Week Results panel shows an "Injury Report" section for YOUR team.
     • Roster shows a 🤕 / 🚫 badge next to injured / suspended players.
     • Player card shows status banner.
   ============================================================ */

(function () {
  /* ── Injury type tables by position group ─────────────────── */
  var INJ_TABLE = {
    skill: ['Hamstring', 'Quad', 'Ankle', 'Shoulder', 'Concussion', 'Wrist'],
    line: ['Knee', 'Pectoral', 'Shoulder', 'Back', 'Hand', 'Concussion'],
    db: ['Hamstring', 'Ankle', 'Quad', 'Shoulder', 'Concussion', 'Knee'],
    spec: ['Groin', 'Quad', 'Ankle', 'Back', 'Concussion'],
  };
  function injType(pos) {
    if (['QB', 'RB', 'WR', 'TE'].includes(pos)) return INJ_TABLE.skill;
    if (['T', 'G', 'C', 'DT', 'EDGE'].includes(pos)) return INJ_TABLE.line;
    if (['CB', 'FS', 'SS', 'LB'].includes(pos)) return INJ_TABLE.db;
    return INJ_TABLE.spec;
  }
  function randomInjuryType(pos) {
    var pool = injType(pos);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ── Severity table — weeks out range ──────────────────────── */
  var SEVERITY = {
    minor: { label: 'Questionable', weeks: [1, 1], color: '#facc15' },
    moderate: { label: 'Out', weeks: [2, 3], color: '#f97316' },
    major: { label: 'IR', weeks: [4, 6], color: '#ef4444' },
    careerThreatening: { label: 'Season', weeks: [6, 10], color: '#c084fc' },
  };

  /* 60% minor · 28% moderate · 10% major · 2% season-ending */
  function rollSeverity() {
    var r = Math.random();
    if (r < 0.6) return 'minor';
    if (r < 0.88) return 'moderate';
    if (r < 0.98) return 'major';
    return 'careerThreatening';
  }
  function weeksForSeverity(sev) {
    var range = SEVERITY[sev].weeks;
    return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
  }

  /* ── Injury roll probability per player per game ──────────── *
     Tuned for ~1-2 new injuries per team per week and
     ~2-4 players out at any one time (realistic NFL scale).     */
  function injuryProbability(player) {
    var base = 0.025; /* 2.5% base per game (was 6%) */
    var age = player.age || 25;
    var tough = (player.attributes && player.attributes.toughness) || 70;
    if (age >= 32) base += 0.015; /* veterans more fragile */
    else if (age >= 29) base += 0.008;
    base -= (tough - 70) * 0.001; /* toughness helps a little */
    if (player.injury && player.injury.weeksRemaining > 0) return 0;
    return Math.max(0.005, Math.min(0.08, base));
  }

  /* ── Suspension roll — rare, ~1-2 per league per season ───── */
  var SUSPENSION_REASONS = ['PED violation', 'Conduct detrimental', 'Unsportsmanlike act', 'DUI arrest'];
  function suspensionProbability(player) {
    return 0.0015; /* was 0.004 — now ~1 event per season league-wide */
  }
  function rollSuspensionWeeks() {
    return 1 + Math.floor(Math.random() * 2);
  }

  /* ── Apply injuries & suspensions after a game ────────────── */
  function processTeamInjuries(team) {
    if (!team || !team.roster) return [];
    var events = [];
    team.roster.forEach(function (p) {
      /* Tick down existing injury */
      if (p.injury && p.injury.weeksRemaining > 0) {
        p.injury.weeksRemaining--;
        if (p.injury.weeksRemaining === 0) {
          events.push({ player: p, type: 'recovery', injury: p.injury });
          /* Push to injuryHistory for long-term regression */
          if (!p.injuryHistory) p.injuryHistory = [];
          p.injuryHistory.push({ severity: p.injury.severity, type: p.injury.type });
          p.injury = null;
        }
        return; /* already injured — skip new roll */
      }

      /* Tick down existing suspension */
      if (p.suspension && p.suspension.weeksRemaining > 0) {
        p.suspension.weeksRemaining--;
        if (p.suspension.weeksRemaining === 0) {
          events.push({ player: p, type: 'suspension_return', reason: p.suspension.reason });
          p.suspension = null;
        }
        return;
      }

      /* Roll for new injury */
      if (Math.random() < injuryProbability(p)) {
        var sev = rollSeverity();
        var weeks = weeksForSeverity(sev);
        var itype = randomInjuryType(p.positions[0]);
        p.injury = { type: itype, severity: sev, weeksRemaining: weeks, weeksSustained: window.simYear || 1 };
        events.push({ player: p, type: 'new_injury', injury: p.injury });
        return;
      }

      /* Roll for suspension */
      if (Math.random() < suspensionProbability(p)) {
        var reason = SUSPENSION_REASONS[Math.floor(Math.random() * SUSPENSION_REASONS.length)];
        var sus = rollSuspensionWeeks();
        p.suspension = { weeksRemaining: sus, reason: reason };
        events.push({ player: p, type: 'new_suspension', reason: reason, weeks: sus });
      }
    });
    return events;
  }

  /* ── Clear all injuries/suspensions at season end ─────────── */
  window.clearAllInjuries = function () {
    if (typeof league === 'undefined' || !league || typeof listAllTeams !== 'function') return;
    listAllTeams(league).forEach(function (team) {
      (team.roster || []).forEach(function (p) {
        /* Only clear non-season injuries at EOS; season injuries are already 0 */
        p.injury = null;
        p.suspension = null;
      });
    });
  };

  /* ── Roster status badge ──────────────────────────────────── */
  window.injuryBadge = function (player) {
    if (player.injury && player.injury.weeksRemaining > 0) {
      var sev = SEVERITY[player.injury.severity] || SEVERITY.minor;
      return (
        ' <span title="' +
        player.injury.type +
        ' — ' +
        sev.label +
        ' (' +
        player.injury.weeksRemaining +
        'w)"' +
        ' style="font-size:9px;background:rgba(239,68,68,.18);color:' +
        sev.color +
        ';border-radius:3px;padding:1px 4px;font-weight:700">' +
        '🤕 ' +
        sev.label +
        '</span>'
      );
    }
    if (player.suspension && player.suspension.weeksRemaining > 0) {
      return (
        ' <span title="Suspended: ' +
        player.suspension.reason +
        ' (' +
        player.suspension.weeksRemaining +
        'w)"' +
        ' style="font-size:9px;background:rgba(168,85,247,.18);color:#c084fc;' +
        'border-radius:3px;padding:1px 4px;font-weight:700">' +
        '🚫 Susp.</span>'
      );
    }
    return '';
  };

  /* ── Power rating penalty for missing starters ────────────── */
  function teamInjuryPenalty(team) {
    var penalty = 0;
    (team.roster || []).forEach(function (p) {
      var isOut = (p.injury && p.injury.weeksRemaining > 0) || (p.suspension && p.suspension.weeksRemaining > 0);
      if (!isOut) return;
      var ovr = (p.attributes && p.attributes.overall) || 70;
      /* Higher-rated players hurt more when missing */
      if (ovr >= 85) penalty += 2.5;
      else if (ovr >= 78) penalty += 1.5;
      else if (ovr >= 72) penalty += 0.8;
      else penalty += 0.3;
    });
    return Math.min(penalty, 10); /* cap at -10 pts */
  }

  /* ── Wrap simulateGame to apply injuries after each game ──── */
  var _prevSimGame = window.simulateGame;
  window.simulateGame = function (game, tMap, userStrat, uid) {
    /* Apply injury penalty before rating calc */
    var tMapRef = tMap || teamMap;
    if (tMapRef && game) {
      var ht = tMapRef[game.homeTeamId];
      var at = tMapRef[game.awayTeamId];
      if (ht) ht._injPenalty = teamInjuryPenalty(ht);
      if (at) at._injPenalty = teamInjuryPenalty(at);
    }
    /* Run the game */
    var result = typeof _prevSimGame === 'function' ? _prevSimGame.call(this, game, tMap, userStrat, uid) : undefined;
    /* Roll injuries for both teams post-game */
    if (tMapRef && game) {
      var ht2 = tMapRef[game.homeTeamId];
      var at2 = tMapRef[game.awayTeamId];
      if (ht2) {
        var evH = processTeamInjuries(ht2);
        game._injuryEvents = game._injuryEvents || {};
        game._injuryEvents[ht2.id] = evH;
      }
      if (at2) {
        var evA = processTeamInjuries(at2);
        game._injuryEvents = game._injuryEvents || {};
        game._injuryEvents[at2.id] = evA;
      }
    }
    return result;
  };

  /* ── Injury report section for week results ──────────────── */
  function buildInjuryReport(week, tid) {
    if (!week || !week.games) return '';
    var events = [];
    week.games.forEach(function (g) {
      if (!g._injuryEvents) return;
      var myEvents = g._injuryEvents[tid];
      if (myEvents) events = events.concat(myEvents);
    });
    if (!events.length) return '';

    var rows = events
      .map(function (e) {
        var p = e.player;
        var pos = (p.positions && p.positions[0]) || '?';
        var name = p.name || '?';
        if (e.type === 'new_injury') {
          var sev = SEVERITY[e.injury.severity] || SEVERITY.minor;
          return (
            '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;' +
            'border-bottom:1px solid rgba(30,45,71,.3)">' +
            '<span style="font-size:11px;font-weight:700;color:var(--accent2);min-width:34px">' +
            pos +
            '</span>' +
            '<span style="flex:1;font-size:12px">' +
            name +
            '</span>' +
            '<span style="font-size:11px;font-weight:700;color:' +
            sev.color +
            '">' +
            '🤕 ' +
            e.injury.type +
            ' — ' +
            sev.label +
            ' (' +
            e.injury.weeksRemaining +
            'w)' +
            '</span>' +
            '</div>'
          );
        }
        if (e.type === 'recovery') {
          return (
            '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;' +
            'border-bottom:1px solid rgba(30,45,71,.3)">' +
            '<span style="font-size:11px;font-weight:700;color:var(--accent2);min-width:34px">' +
            pos +
            '</span>' +
            '<span style="flex:1;font-size:12px">' +
            name +
            '</span>' +
            '<span style="font-size:11px;font-weight:700;color:#4ade80">✅ Cleared to play</span>' +
            '</div>'
          );
        }
        if (e.type === 'new_suspension') {
          return (
            '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;' +
            'border-bottom:1px solid rgba(30,45,71,.3)">' +
            '<span style="font-size:11px;font-weight:700;color:var(--accent2);min-width:34px">' +
            pos +
            '</span>' +
            '<span style="flex:1;font-size:12px">' +
            name +
            '</span>' +
            '<span style="font-size:11px;font-weight:700;color:#c084fc">' +
            '🚫 Suspended ' +
            e.weeks +
            'w — ' +
            e.reason +
            '</span>' +
            '</div>'
          );
        }
        if (e.type === 'suspension_return') {
          return (
            '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;' +
            'border-bottom:1px solid rgba(30,45,71,.3)">' +
            '<span style="font-size:11px;font-weight:700;color:var(--accent2);min-width:34px">' +
            pos +
            '</span>' +
            '<span style="flex:1;font-size:12px">' +
            name +
            '</span>' +
            '<span style="font-size:11px;font-weight:700;color:#94a3b8">↩ Suspension served — eligible</span>' +
            '</div>'
          );
        }
        return '';
      })
      .join('');

    return (
      '<div style="background:var(--surface);border:1px solid var(--border);' +
      'border-radius:10px;padding:14px;margin-top:14px">' +
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;' +
      'letter-spacing:.8px;color:var(--accent2);margin-bottom:8px">📋 Injury Report</div>' +
      rows +
      '</div>'
    );
  }

  /* ── Wrap renderWeekResults to append injury report ─────── */
  var _prevRWR = window.renderWeekResults;
  window.renderWeekResults = function (week) {
    if (typeof _prevRWR === 'function') _prevRWR(week);
    var tid =
      (document.getElementById('teamSelect') || {}).value || (typeof userTeamId !== 'undefined' ? userTeamId : null);
    if (!tid) return;
    var report = buildInjuryReport(week, tid);
    if (!report) return;
    var main = document.getElementById('main');
    if (main) main.insertAdjacentHTML('beforeend', report);
  };

  /* ── Patch renderRoster to show injury badges ──────────────── */
  var _prevRR = window.renderRoster;
  window.renderRoster = function () {
    if (typeof _prevRR === 'function') _prevRR();
    /* After roster renders, inject badges next to each player name */
    setTimeout(function () {
      var tid =
        (document.getElementById('teamSelect') || {}).value || (typeof userTeamId !== 'undefined' ? userTeamId : null);
      if (!tid || typeof getTeamById !== 'function') return;
      var team = getTeamById(tid);
      if (!team) return;
      /* Walk each roster row — find name cells and append badge if needed */
      var rows = document.querySelectorAll('[data-player-id]');
      rows.forEach(function (row) {
        var pid = row.getAttribute('data-player-id');
        var p = team.roster.find(function (x) {
          return String(x.id) === String(pid);
        });
        if (!p) return;
        var badge = window.injuryBadge(p);
        if (!badge) return;
        /* Append to existing name cell if badge not already there */
        var nameCell = row.querySelector('.player-name, td:nth-child(2)');
        if (nameCell && !nameCell.querySelector('.inj-badge')) {
          nameCell.insertAdjacentHTML(
            'beforeend',
            '<span class="inj-badge">' + badge.replace(/<span /, '<span class="inj-badge-inner" ') + '</span>',
          );
        }
      });
    }, 60);
  };

  /* ── Patch renderPlayerDetail to show status banner ────────── */
  var _prevRPD = window.renderPlayerDetail;
  window.renderPlayerDetail = function (playerId) {
    if (typeof _prevRPD === 'function') _prevRPD(playerId);
    setTimeout(function () {
      var tid =
        (document.getElementById('teamSelect') || {}).value || (typeof userTeamId !== 'undefined' ? userTeamId : null);
      if (!tid || typeof getTeamById !== 'function') return;
      var team = getTeamById(tid);
      if (!team) return;
      var p = team.roster.find(function (x) {
        return String(x.id) === String(playerId);
      });
      if (!p) return;
      var banner = '';
      if (p.injury && p.injury.weeksRemaining > 0) {
        var sev = SEVERITY[p.injury.severity] || SEVERITY.minor;
        banner =
          '<div style="background:rgba(239,68,68,.12);border:1px solid #ef4444;' +
          'border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px">' +
          '🤕 <strong>' +
          p.injury.type +
          '</strong> — ' +
          sev.label +
          ' · <span style="color:#94a3b8">' +
          p.injury.weeksRemaining +
          ' week' +
          (p.injury.weeksRemaining !== 1 ? 's' : '') +
          ' remaining</span>' +
          '</div>';
      } else if (p.suspension && p.suspension.weeksRemaining > 0) {
        banner =
          '<div style="background:rgba(168,85,247,.12);border:1px solid #a855f7;' +
          'border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px">' +
          '🚫 <strong>Suspended</strong> — ' +
          p.suspension.reason +
          ' · <span style="color:#94a3b8">' +
          p.suspension.weeksRemaining +
          ' week' +
          (p.suspension.weeksRemaining !== 1 ? 's' : '') +
          ' remaining</span>' +
          '</div>';
      }
      if (!banner) return;
      var main = document.getElementById('main');
      if (!main) return;
      /* Insert after first h2 or at top */
      var h2 = main.querySelector('h2');
      if (h2 && h2.parentNode) {
        h2.insertAdjacentHTML('afterend', banner);
      } else {
        main.insertAdjacentHTML('afterbegin', banner);
      }
    }, 80);
  };

  /* ── Clear injuries at end of season ───────────────────────── */
  var _prevEOS = window.runEndOfSeasonDevelopment;
  window.runEndOfSeasonDevelopment = function () {
    if (typeof _prevEOS === 'function') _prevEOS();
    window.clearAllInjuries();
  };
})();
