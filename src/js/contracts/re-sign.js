/* ============================================================
   RE-SIGN FEATURE
   Allows user to negotiate a new contract extension with any
   player currently on their roster. Uses the same
   calculateMarketValue engine as free agency. The player
   stays on the roster — only the contract terms change.
   ============================================================ */

(function () {
  /* ── State ─────────────────────────────────────────────── */
  var reSignState = {
    playerId: null,
    round: 1,
    counterOffer: null,
  };

  /* ── Patch renderPlayerDetail to inject the Re-sign button ─ */
  var _origRPD_resign = window.renderPlayerDetail;
  window.renderPlayerDetail = function (playerId) {
    if (typeof _origRPD_resign === 'function') _origRPD_resign(playerId);

    /* After the original renders, inject the Re-sign button
       alongside Cut / Trade inside the actions flex row.        */
    setTimeout(function () {
      var main = document.getElementById('main');
      if (!main) return;

      /* Confirm this player is on the user's team */
      var p = null,
        onMyTeam = false;
      var tid =
        typeof activeTeamId === 'function' ? activeTeamId() : typeof userTeamId !== 'undefined' ? userTeamId : null;
      if (!tid) return;
      listAllTeams(league).forEach(function (t) {
        t.roster.forEach(function (x) {
          if (String(x.id) === String(playerId)) {
            p = x;
            if (t.id === tid) onMyTeam = true;
          }
        });
      });
      if (!p || !onMyTeam) return;

      /* Find the actions flex row (the div holding Cut + Trade) */
      var allDivs = main.querySelectorAll('div');
      var actionsRow = null;
      allDivs.forEach(function (div) {
        if (div.style && div.style.display === 'flex' && div.style.gap === '8px' && div.style.marginTop === '14px') {
          /* Verify it contains the Cut button */
          if (div.querySelector && div.querySelector('button')) {
            var btns = div.querySelectorAll('button');
            var hasCut = false;
            btns.forEach(function (b) {
              if (b.textContent.indexOf('Cut') !== -1) hasCut = true;
            });
            if (hasCut) actionsRow = div;
          }
        }
      });

      if (!actionsRow) return;
      /* Avoid double-injection */
      if (actionsRow.querySelector('.resign-btn')) return;

      var btn = document.createElement('button');
      btn.className = 'resign-btn';
      btn.onclick = function () {
        window.renderReSignScreen(playerId);
      };
      btn.style.cssText = 'flex:1;background:rgba(245,158,11,.15);border-color:#f59e0b;color:#fbbf24;font-size:12px';
      btn.textContent = '📝 Re-sign';
      actionsRow.appendChild(btn);
    }, 50);
  };

  /* ── Patch renderPlayerDetail: inject Transaction History ── */
  var _origRPD_txHistory = window.renderPlayerDetail;
  window.renderPlayerDetail = function (playerId) {
    if (typeof _origRPD_txHistory === 'function') _origRPD_txHistory(playerId);

    setTimeout(function () {
      var main = document.getElementById('main');
      if (!main) return;

      /* Find the player */
      var p = null;
      if (typeof listAllTeams === 'function' && league) {
        listAllTeams(league).forEach(function (t) {
          t.roster.forEach(function (x) {
            if (String(x.id) === String(playerId)) p = x;
          });
        });
      }
      /* Also check free agents */
      if (!p && typeof freeAgents !== 'undefined') {
        freeAgents.forEach(function (x) {
          if (String(x.id) === String(playerId)) p = x;
        });
      }
      if (!p) return;

      /* Don't double-inject */
      if (main.querySelector('.player-tx-history')) return;

      /* Gather matching transactions */
      var log = typeof transactionLog !== 'undefined' ? transactionLog : [];
      var entries = log
        .filter(function (e) {
          if (e.playerName && e.playerName === p.name) return true;
          if (e.description && e.description.indexOf(p.name) !== -1) return true;
          return false;
        })
        .slice()
        .reverse(); /* newest first */

      /* Badge colour per type */
      function txBadge(type) {
        var cfg = {
          Trade: { bg: 'rgba(59,130,246,.15)', border: '#3b82f6', color: '#60a5fa' },
          Signing: { bg: 'rgba(22,163,74,.15)', border: 'var(--accent)', color: 'var(--accent2)' },
          'Re-sign': { bg: 'rgba(34,197,94,.12)', border: '#16a34a', color: '#4ade80' },
          Release: { bg: 'rgba(248,113,113,.12)', border: '#f87171', color: '#fca5a5' },
          Draft: { bg: 'rgba(245,158,11,.12)', border: '#f59e0b', color: '#fbbf24' },
        };
        var c = cfg[type] || { bg: 'var(--surface3)', border: 'var(--border)', color: 'var(--muted2)' };
        return (
          '<span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;' +
          'font-weight:700;letter-spacing:.4px;white-space:nowrap;' +
          'background:' +
          c.bg +
          ';border:1px solid ' +
          c.border +
          ';color:' +
          c.color +
          '">' +
          type.toUpperCase() +
          '</span>'
        );
      }

      /* Render rows */
      var rows = '';
      if (!entries.length) {
        rows =
          '<div style="text-align:center;padding:20px 0;color:var(--muted2);font-size:13px">' +
          'No transactions on record for this player yet.</div>';
      } else {
        entries.forEach(function (e) {
          var wk = '';
          if (e.season || e.week) {
            wk = '<span style="font-size:10px;font-weight:600;color:var(--accent2)">';
            if (e.season) wk += 'S' + e.season;
            if (e.season && e.week) wk += ' · ';
            if (e.week) wk += 'Wk ' + e.week;
            wk += '</span>';
          }
          var dt = new Date(e.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

          rows +=
            '<div style="display:flex;gap:10px;align-items:flex-start;' +
            'padding:10px 0;border-bottom:1px solid rgba(30,45,71,.5)">' +
            /* left: dot + line */
            '<div style="display:flex;flex-direction:column;align-items:center;padding-top:3px">' +
            '<div style="width:8px;height:8px;border-radius:50%;background:var(--border);flex-shrink:0"></div>' +
            '</div>' +
            /* right: content */
            '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:4px">' +
            txBadge(e.type) +
            '<span style="font-size:11px;color:var(--muted2)">' +
            (wk ? wk + '&ensp;' : '') +
            dt +
            '</span>' +
            '</div>' +
            '<div style="font-size:12px;color:var(--text);line-height:1.5">' +
            e.description +
            '</div>' +
            '</div>' +
            '</div>';
        });
      }

      /* Build the section */
      var section = document.createElement('div');
      section.className = 'player-tx-history';
      section.style.cssText =
        'margin-top:14px;background:var(--surface);border:1px solid var(--border);' + 'border-radius:10px;padding:16px';
      section.innerHTML =
        '<div style="font-size:10px;font-weight:600;letter-spacing:1px;' +
        'text-transform:uppercase;color:var(--accent2);margin-bottom:12px;' +
        'display:flex;align-items:center;justify-content:space-between">' +
        '<span>Transaction History</span>' +
        '<span style="font-size:11px;font-weight:400;letter-spacing:0;color:var(--muted2);' +
        'text-transform:none">' +
        entries.length +
        ' record' +
        (entries.length !== 1 ? 's' : '') +
        '</span>' +
        '</div>' +
        rows;

      main.appendChild(section);
    }, 80);
  };

  /* ── Patch renderPlayerDetail: inject Game Log ───────────── */
  var _origRPD_gameLog = window.renderPlayerDetail;
  window.renderPlayerDetail = function (playerId) {
    if (typeof _origRPD_gameLog === 'function') _origRPD_gameLog(playerId);

    setTimeout(function () {
      var main = document.getElementById('main');
      if (!main) return;
      if (main.querySelector('.player-game-log')) return;

      /* Find the player */
      var p = null;
      if (typeof listAllTeams === 'function' && league) {
        listAllTeams(league).forEach(function (t) {
          t.roster.forEach(function (x) {
            if (String(x.id) === String(playerId)) p = x;
          });
        });
      }
      if (!p && typeof freeAgents !== 'undefined') {
        freeAgents.forEach(function (x) {
          if (String(x.id) === String(playerId)) p = x;
        });
      }
      if (!p) return;

      /* Walk schedule for per-game stats for this player */
      var gameLogs = [];
      if (typeof schedule !== 'undefined' && schedule) {
        schedule.forEach(function (wk) {
          if (!wk.games) return;
          wk.games.forEach(function (g) {
            if (!g.played) return;
            var entry = null,
              isHome = false;
            if (g.homePlayerStats && g.homePlayerStats[playerId]) {
              entry = g.homePlayerStats[playerId];
              isHome = true;
            } else if (g.awayPlayerStats && g.awayPlayerStats[playerId]) {
              entry = g.awayPlayerStats[playerId];
              isHome = false;
            }
            if (!entry) return;
            var myScore = isHome ? g.homeScore : g.awayScore;
            var oppScore = isHome ? g.awayScore : g.homeScore;
            var oppId = isHome ? g.awayTeamId : g.homeTeamId;
            var opp = typeof getTeamById === 'function' ? getTeamById(oppId) : null;
            var won = myScore > oppScore;
            var tied = myScore === oppScore;
            gameLogs.push({
              week: wk.weekNumber,
              oppName: opp ? opp.nickname : '?',
              result: (won ? 'W' : tied ? 'T' : 'L') + ' ' + myScore + '-' + oppScore,
              won: won,
              tied: tied,
              s: entry.stats || {},
            });
          });
        });
      }

      if (!gameLogs.length) return; /* no per-game data yet (week 1 not played) */

      /* Position-aware column config */
      var pos = p.positions[0];
      var cols;
      if (pos === 'QB') {
        cols = [
          { key: 'passingYards', label: 'PASS YDS' },
          { key: 'passingTD', label: 'TD' },
          { key: 'interceptionsThrown', label: 'INT' },
          { key: 'rushingYards', label: 'RUSH YDS' },
          { key: 'rushingTD', label: 'RUSH TD' },
        ];
      } else if (pos === 'RB') {
        cols = [
          { key: 'rushingYards', label: 'RUSH YDS' },
          { key: 'rushingTD', label: 'RUSH TD' },
          { key: 'receivingYards', label: 'REC YDS' },
          { key: 'receivingTD', label: 'REC TD' },
        ];
      } else if (pos === 'WR' || pos === 'TE') {
        cols = [
          { key: 'receivingYards', label: 'REC YDS' },
          { key: 'receivingTD', label: 'TD' },
          { key: 'rushingYards', label: 'RUSH YDS' },
        ];
      } else if (pos === 'K') {
        cols = [
          { key: 'fieldGoalsMade', label: 'FG' },
          { key: 'fieldGoalsMissed', label: 'FG MISS' },
          { key: 'xpMade', label: 'XP' },
          { key: 'xpMissed', label: 'XP MISS' },
        ];
      } else {
        /* Defense */
        cols = [
          { key: 'tackles', label: 'TKL' },
          { key: 'sacks', label: 'SCK' },
          { key: 'interceptions', label: 'INT' },
        ];
      }

      /* Trim cols that are all zeros */
      cols = cols.filter(function (c) {
        return gameLogs.some(function (gl) {
          return (gl.s[c.key] || 0) > 0;
        });
      });
      if (!cols.length) return;

      /* Header row */
      var thead =
        '<tr>' +
        '<th style="text-align:center;font-size:10px;color:var(--muted);font-weight:600;padding:5px 8px">WK</th>' +
        '<th style="text-align:left;font-size:10px;color:var(--muted);font-weight:600;padding:5px 8px">OPP</th>' +
        '<th style="text-align:center;font-size:10px;color:var(--muted);font-weight:600;padding:5px 8px">RESULT</th>' +
        cols
          .map(function (c) {
            return (
              '<th style="text-align:right;font-size:10px;color:var(--muted);font-weight:600;padding:5px 8px">' +
              c.label +
              '</th>'
            );
          })
          .join('') +
        '</tr>';

      /* Data rows */
      var trows = gameLogs
        .map(function (gl) {
          var rc = gl.won ? '#4ade80' : gl.tied ? '#facc15' : '#f87171';

          /* Highlight standout performance — any key > threshold */
          var standout = cols.some(function (c) {
            var v = gl.s[c.key] || 0;
            if (c.key === 'passingYards') return v >= 300;
            if (c.key === 'rushingYards') return v >= 100;
            if (c.key === 'receivingYards') return v >= 100;
            if (c.key === 'passingTD' || c.key === 'rushingTD' || c.key === 'receivingTD') return v >= 3;
            if (c.key === 'sacks') return v >= 2;
            if (c.key === 'tackles') return v >= 10;
            return false;
          });

          return (
            '<tr style="' +
            (standout ? 'background:rgba(22,163,74,.06)' : '') +
            '">' +
            '<td style="text-align:center;font-size:12px;color:var(--muted2);padding:6px 8px">' +
            gl.week +
            '</td>' +
            '<td style="text-align:left;font-size:12px;padding:6px 8px">vs ' +
            gl.oppName +
            '</td>' +
            '<td style="text-align:center;font-size:12px;font-weight:600;color:' +
            rc +
            ';padding:6px 8px">' +
            gl.result +
            '</td>' +
            cols
              .map(function (c) {
                var v = gl.s[c.key] || 0;
                /* bold the stat if it's a standout value for that column */
                var hot = false;
                if (c.key === 'passingYards' && v >= 300) hot = true;
                if (c.key === 'rushingYards' && v >= 100) hot = true;
                if (c.key === 'receivingYards' && v >= 100) hot = true;
                if ((c.key === 'passingTD' || c.key === 'rushingTD' || c.key === 'receivingTD') && v >= 3) hot = true;
                if (c.key === 'sacks' && v >= 2) hot = true;
                if (c.key === 'tackles' && v >= 10) hot = true;
                return (
                  '<td style="text-align:right;font-size:12px;padding:6px 8px;' +
                  (hot ? 'font-weight:700;color:var(--accent2)' : 'color:var(--text)') +
                  '">' +
                  v +
                  '</td>'
                );
              })
              .join('') +
            '</tr>'
          );
        })
        .join('');

      /* Season averages footer */
      var avgRow =
        '<tr style="background:var(--surface2);border-top:1px solid var(--border)">' +
        '<td colspan="3" style="font-size:10px;font-weight:700;letter-spacing:.5px;' +
        'text-transform:uppercase;color:var(--muted2);padding:5px 8px">AVG</td>' +
        cols
          .map(function (c) {
            var total = gameLogs.reduce(function (acc, gl) {
              return acc + (gl.s[c.key] || 0);
            }, 0);
            var avg = gameLogs.length ? (total / gameLogs.length).toFixed(1) : '0';
            return '<td style="text-align:right;font-size:11px;color:var(--muted2);padding:5px 8px">' + avg + '</td>';
          })
          .join('') +
        '</tr>';

      /* Assemble section */
      var section = document.createElement('div');
      section.className = 'player-game-log';
      section.style.cssText =
        'margin-top:14px;background:var(--surface);border:1px solid var(--border);' + 'border-radius:10px;padding:16px';
      section.innerHTML =
        '<div style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;' +
        'color:var(--accent2);margin-bottom:10px;display:flex;align-items:center;' +
        'justify-content:space-between">' +
        '<span>Game Log</span>' +
        '<span style="font-size:11px;font-weight:400;letter-spacing:0;color:var(--muted2);' +
        'text-transform:none">' +
        gameLogs.length +
        ' game' +
        (gameLogs.length !== 1 ? 's' : '') +
        '</span>' +
        '</div>' +
        '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">' +
        '<table style="width:100%;border-collapse:collapse;min-width:280px">' +
        '<thead>' +
        thead +
        '</thead>' +
        '<tbody>' +
        trows +
        '</tbody>' +
        '<tfoot>' +
        avgRow +
        '</tfoot>' +
        '</table>' +
        '</div>';

      main.appendChild(section);
    }, 110);
  };

  /* ── Helper: find player on user roster ──────────────────── */
  function getMyPlayer(playerId) {
    var tid =
      typeof activeTeamId === 'function' ? activeTeamId() : typeof userTeamId !== 'undefined' ? userTeamId : null;
    var team = tid ? getTeamById(tid) : null;
    if (!team) return null;
    return (
      team.roster.find(function (x) {
        return String(x.id) === String(playerId);
      }) || null
    );
  }

  /* ── assignPersonality shim (may already exist) ──────────── */
  function ensurePersonality(p) {
    if (!p.personality && typeof assignPersonality === 'function') assignPersonality(p);
    if (!p.personality) {
      var opts = ['Balanced', 'Greedy', 'Loyal', 'RingChaser', 'SchemeFit', 'ShortDeal'];
      p.personality = opts[Math.floor(Math.random() * opts.length)];
    }
  }

  /* ── Interest score for re-sign (loyalty bonus built in) ─── */
  function reSignInterest(p, team, salary, years) {
    var mv = calculateMarketValue(p);
    var score = salary / mv.capHitPerYear;

    /* Always a loyalty bonus — player is already on this team */
    score *= 1.15;

    switch (p.personality) {
      case 'Greedy':
        score *= 1.05;
        break;
      case 'Loyal':
        score *= 1.25;
        break; /* extra loyalty boost */
      case 'RingChaser':
        score += (team.wins - team.losses) / 10;
        break;
      case 'SchemeFit':
        if (['QB', 'WR', 'RB'].indexOf(p.positions[0]) !== -1) score += team.coach.offenseRating / 200;
        else score += team.coach.defenseRating / 200;
        break;
      case 'ShortDeal':
        score *= years <= 2 ? 1.2 : 0.9;
        break;
    }

    return score;
  }

  /* ── Counter-offer for re-sign ───────────────────────────── */
  function reSignCounter(p) {
    var mv = calculateMarketValue(p);
    var salary = mv.capHitPerYear;
    var years = mv.years;

    /* Personality adjustments — player negotiates from market value
       but gives a small loyalty discount                            */
    if (p.personality === 'Greedy') salary = Math.round(salary * 1.2);
    if (p.personality === 'Loyal') salary = Math.round(salary * 0.9); /* takes less to stay */
    if (p.personality === 'ShortDeal') years = Math.min(2, years);

    return { salary: Math.round(salary), years: years };
  }

  /* ── Round 1 Screen ─────────────────────────────────────── */
  window.renderReSignScreen = function (playerId) {
    var p = getMyPlayer(playerId);
    if (!p) {
      alert('Player not found on your roster.');
      return;
    }

    ensurePersonality(p);
    var mv = calculateMarketValue(p);
    var cur = p.contract;
    var tid = typeof activeTeamId === 'function' ? activeTeamId() : userTeamId;
    var team = getTeamById(tid);

    reSignState = { playerId: playerId, round: 1, counterOffer: null };

    var curContract = cur
      ? '$' +
        cur.capHitPerYear.toLocaleString() +
        '/yr · ' +
        cur.years +
        ' yr' +
        (cur.years !== 1 ? 's' : '') +
        ' remaining'
      : 'Expiring';

    var capSpace = team.salaryCap - team.capUsed;
    var afterRelease = capSpace + (cur ? cur.capHitPerYear : 0); /* space once old deal freed */

    setMainContent(
      '<button onclick="renderPlayerDetail(\'' +
        playerId +
        '\')" style="width:auto;padding:5px 14px;margin-bottom:14px;font-size:12px">← Player Profile</button>' +
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;max-width:480px">' +
        '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:700;color:var(--accent2);margin-bottom:4px">📝 Re-sign ' +
        p.name +
        '</div>' +
        '<div style="font-size:12px;color:var(--muted2);margin-bottom:16px">' +
        p.positions.join('/') +
        ' · Age ' +
        p.age +
        ' · OVR <span style="color:' +
        ovrColor(p.attributes.overall) +
        ';font-weight:600">' +
        p.attributes.overall +
        '</span>' +
        ' · Personality: <strong style="color:var(--gold)">' +
        p.personality +
        '</strong>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">' +
        '<div style="background:var(--surface2);border-radius:8px;padding:12px">' +
        '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Current Contract</div>' +
        '<div style="font-size:13px;font-weight:500">' +
        curContract +
        '</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border-radius:8px;padding:12px">' +
        '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Market Value</div>' +
        '<div style="font-size:13px;font-weight:500;color:#4ade80">$' +
        mv.capHitPerYear.toLocaleString() +
        '/yr</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border-radius:8px;padding:12px">' +
        '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Available Cap Space</div>' +
        '<div style="font-size:13px;font-weight:500;color:' +
        (afterRelease < 0 ? '#f87171' : '#4ade80') +
        '">$' +
        afterRelease.toLocaleString() +
        '</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border-radius:8px;padding:12px">' +
        '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Market Years</div>' +
        '<div style="font-size:13px;font-weight:500">' +
        mv.years +
        ' yr' +
        (mv.years !== 1 ? 's' : '') +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--muted2);margin-bottom:6px">Your Offer</div>' +
        '<label style="font-size:12px;color:var(--muted2)">Contract Length</label>' +
        '<select id="resignYears" style="margin-bottom:10px">' +
        '<option value="1">1 year</option>' +
        '<option value="2">2 years</option>' +
        '<option value="3" ' +
        (mv.years >= 3 ? 'selected' : '') +
        '>3 years</option>' +
        '<option value="4" ' +
        (mv.years >= 4 ? 'selected' : '') +
        '>4 years</option>' +
        '<option value="5">5 years</option>' +
        '</select>' +
        '<label style="font-size:12px;color:var(--muted2)">Salary per Year ($)</label>' +
        '<input id="resignSalary" type="number" value="' +
        mv.capHitPerYear +
        '" style="margin-bottom:14px" />' +
        '<div style="display:flex;gap:8px">' +
        '<button onclick="window.submitReSignOffer()" style="flex:2;background:rgba(245,158,11,.2);border-color:#f59e0b;color:#fbbf24;font-weight:600">📤 Submit Offer</button>' +
        '<button onclick="renderPlayerDetail(\'' +
        playerId +
        '\')" style="flex:1;font-size:12px">Cancel</button>' +
        '</div>' +
        '</div>',
    );
  };

  /* ── Submit Round 1 ──────────────────────────────────────── */
  window.submitReSignOffer = function () {
    var playerId = reSignState.playerId;
    var p = getMyPlayer(playerId);
    if (!p) return;

    var tid = typeof activeTeamId === 'function' ? activeTeamId() : userTeamId;
    var team = getTeamById(tid);

    var salary = parseInt(document.getElementById('resignSalary').value) || 0;
    var years = parseInt(document.getElementById('resignYears').value) || 1;

    /* Cap check (net new money after releasing old deal) */
    var oldHit = p.contract ? p.contract.capHitPerYear : 0;
    var netDelta = salary - oldHit;
    if (team.capUsed + netDelta > team.salaryCap) {
      alert(
        'Not enough cap space. You need $' +
          (team.capUsed + netDelta - team.salaryCap).toLocaleString() +
          ' more room.',
      );
      return;
    }

    /* Round 1 → generate counter */
    reSignState.counterOffer = reSignCounter(p);
    reSignState.round = 2;

    var counter = reSignState.counterOffer;
    var interest = reSignInterest(p, team, salary, years);

    /* If offer already meets or beats what player wants → done */
    if (salary >= counter.salary && years >= counter.years) {
      window.finalizeReSign(salary, years);
      return;
    }

    /* Low-ball → outright rejection */
    if (interest < 0.75) {
      setMainContent(
        '<div class="welcome-hero" style="max-width:480px">' +
          '<h2 style="color:#f87171">❌ Offer Rejected</h2>' +
          '<p style="color:var(--muted2);font-size:13px">' +
          p.name +
          ' rejected your offer as too low. They feel undervalued and want to test the open market.' +
          '</p>' +
          '<button onclick="renderPlayerDetail(\'' +
          playerId +
          '\')" style="margin-top:10px">← Back to Profile</button>' +
          '</div>',
      );
      return;
    }

    /* Counter-offer round */
    setMainContent(
      '<button onclick="renderPlayerDetail(\'' +
        playerId +
        '\')" style="width:auto;padding:5px 14px;margin-bottom:14px;font-size:12px">← Player Profile</button>' +
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;max-width:480px">' +
        '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:700;color:var(--gold);margin-bottom:4px">💬 Counteroffer — ' +
        p.name +
        '</div>' +
        '<p style="font-size:13px;color:var(--muted2);margin-bottom:16px">' +
        p.name +
        ' reviewed your offer and came back with a counter.</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">' +
        '<div style="background:var(--surface2);border-radius:8px;padding:12px;border:1px solid var(--border)">' +
        '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Your Offer</div>' +
        '<div style="font-size:14px;font-weight:600">$' +
        salary.toLocaleString() +
        '/yr</div>' +
        '<div style="font-size:11px;color:var(--muted2)">' +
        years +
        ' yr' +
        (years !== 1 ? 's' : '') +
        '</div>' +
        '</div>' +
        '<div style="background:rgba(245,158,11,.1);border-radius:8px;padding:12px;border:1px solid #f59e0b">' +
        '<div style="font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Their Counter</div>' +
        '<div style="font-size:14px;font-weight:600;color:#fbbf24">$' +
        counter.salary.toLocaleString() +
        '/yr</div>' +
        '<div style="font-size:11px;color:var(--muted2)">' +
        counter.years +
        ' yr' +
        (counter.years !== 1 ? 's' : '') +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button onclick="window.acceptReSignCounter()" style="flex:1;background:rgba(34,197,94,.15);border-color:#22c55e;color:#4ade80;font-weight:600">✅ Accept Counter</button>' +
        '<button onclick="window.renderReSignRound2()" style="flex:1;background:rgba(59,130,246,.15);border-color:#3b82f6;color:#60a5fa;font-weight:600">🔄 Make Final Offer</button>' +
        '<button onclick="renderPlayerDetail(\'' +
        playerId +
        '\')" style="flex:1;font-size:12px">Walk Away</button>' +
        '</div>' +
        '</div>',
    );
  };

  /* ── Round 2 Screen ─────────────────────────────────────── */
  window.renderReSignRound2 = function () {
    var playerId = reSignState.playerId;
    var p = getMyPlayer(playerId);
    if (!p) return;
    var counter = reSignState.counterOffer;

    setMainContent(
      '<button onclick="renderPlayerDetail(\'' +
        playerId +
        '\')" style="width:auto;padding:5px 14px;margin-bottom:14px;font-size:12px">← Player Profile</button>' +
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;max-width:480px">' +
        '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:20px;font-weight:700;color:#60a5fa;margin-bottom:4px">🏁 Final Offer — ' +
        p.name +
        '</div>' +
        '<p style="font-size:12px;color:var(--muted2);margin-bottom:16px">' +
        'This is your last chance. ' +
        p.name +
        ' is asking for ' +
        '<strong style="color:#fbbf24">$' +
        counter.salary.toLocaleString() +
        '/yr</strong> over ' +
        '<strong style="color:#fbbf24">' +
        counter.years +
        ' yr' +
        (counter.years !== 1 ? 's' : '') +
        '</strong>.' +
        '</p>' +
        '<label style="font-size:12px;color:var(--muted2)">Contract Length</label>' +
        '<select id="resignYears" style="margin-bottom:10px">' +
        '<option value="1">1 year</option>' +
        '<option value="2">2 years</option>' +
        '<option value="3" ' +
        (counter.years >= 3 ? 'selected' : '') +
        '>3 years</option>' +
        '<option value="4" ' +
        (counter.years >= 4 ? 'selected' : '') +
        '>4 years</option>' +
        '<option value="5">5 years</option>' +
        '</select>' +
        '<label style="font-size:12px;color:var(--muted2)">Salary per Year ($)</label>' +
        '<input id="resignSalary" type="number" value="' +
        counter.salary +
        '" style="margin-bottom:14px" />' +
        '<div style="display:flex;gap:8px">' +
        '<button onclick="window.submitReSignFinal()" style="flex:2;background:rgba(59,130,246,.2);border-color:#3b82f6;color:#60a5fa;font-weight:600">📤 Submit Final Offer</button>' +
        '<button onclick="renderPlayerDetail(\'' +
        playerId +
        '\')" style="flex:1;font-size:12px">Walk Away</button>' +
        '</div>' +
        '</div>',
    );
  };

  /* ── Accept Counter ──────────────────────────────────────── */
  window.acceptReSignCounter = function () {
    var c = reSignState.counterOffer;
    window.finalizeReSign(c.salary, c.years);
  };

  /* ── Submit Final Offer ──────────────────────────────────── */
  window.submitReSignFinal = function () {
    var playerId = reSignState.playerId;
    var p = getMyPlayer(playerId);
    if (!p) return;
    var counter = reSignState.counterOffer;

    var salary = parseInt(document.getElementById('resignSalary').value) || 0;
    var years = parseInt(document.getElementById('resignYears').value) || 1;

    var tid = typeof activeTeamId === 'function' ? activeTeamId() : userTeamId;
    var team = getTeamById(tid);

    /* Cap check */
    var oldHit = p.contract ? p.contract.capHitPerYear : 0;
    var netDelta = salary - oldHit;
    if (team.capUsed + netDelta > team.salaryCap) {
      alert(
        'Not enough cap space. You need $' +
          (team.capUsed + netDelta - team.salaryCap).toLocaleString() +
          ' more room.',
      );
      return;
    }

    /* Does the final offer beat or meet their counter? */
    if (salary >= counter.salary && years >= counter.years) {
      window.finalizeReSign(salary, years);
      return;
    }

    /* Below counter — player walks */
    setMainContent(
      '<div class="welcome-hero" style="max-width:480px">' +
        '<h2 style="color:#f87171">❌ Negotiations Broke Down</h2>' +
        '<p style="color:var(--muted2);font-size:13px">' +
        p.name +
        " couldn't reach an agreement with your team. They will play out their current contract and test free agency when it expires." +
        '</p>' +
        '<button onclick="renderPlayerDetail(\'' +
        playerId +
        '\')" style="margin-top:10px">← Back to Profile</button>' +
        '</div>',
    );
  };

  /* ── Finalize Re-sign ────────────────────────────────────── */
  window.finalizeReSign = function (salary, years) {
    var playerId = reSignState.playerId;
    var p = getMyPlayer(playerId);
    if (!p) return;

    var tid = typeof activeTeamId === 'function' ? activeTeamId() : userTeamId;
    var team = getTeamById(tid);

    /* Cap adjustment: remove old cap hit, apply new */
    var oldHit = p.contract ? p.contract.capHitPerYear : 0;
    team.capUsed -= oldHit;
    team.capUsed += salary;

    /* Update contract in place — player stays on roster */
    p.contract = {
      years: years,
      totalValue: salary * years,
      capHitPerYear: salary,
    };

    /* Mark previous team for loyalty tracking */
    p.previousTeamId = team.id;

    if (typeof logTransaction === 'function') {
      logTransaction('Re-sign', team.city + ' ' + team.nickname + ' extended ' + p.name, team.id, p);
    }

    setMainContent(
      '<div class="welcome-hero" style="max-width:480px">' +
        '<h2 style="color:var(--accent2)">✅ Contract Extended!</h2>' +
        '<p style="font-size:14px;color:var(--text);margin-bottom:6px">' +
        '<strong>' +
        p.name +
        '</strong> has re-signed with the ' +
        '<strong>' +
        team.city +
        ' ' +
        team.nickname +
        '</strong>.' +
        '</p>' +
        '<p style="font-size:13px;color:var(--muted2)">' +
        'New deal: <strong style="color:#4ade80">$' +
        salary.toLocaleString() +
        '/yr</strong>' +
        ' over <strong>' +
        years +
        ' year' +
        (years !== 1 ? 's' : '') +
        '</strong>' +
        ' ($' +
        (salary * years).toLocaleString() +
        ' total)' +
        '</p>' +
        '<p style="font-size:12px;color:var(--muted);margin-top:8px">' +
        'Cap space remaining: <strong style="color:' +
        (team.salaryCap - team.capUsed < 0 ? '#f87171' : '#4ade80') +
        '">' +
        '$' +
        (team.salaryCap - team.capUsed).toLocaleString() +
        '</strong>' +
        '</p>' +
        '<div style="display:flex;gap:8px;margin-top:14px">' +
        '<button onclick="renderPlayerDetail(\'' +
        playerId +
        '\')" style="flex:1;background:rgba(22,163,74,.15);border-color:var(--accent);color:var(--accent2);font-weight:600">← View Player</button>' +
        '<button onclick="renderRoster()" style="flex:1">👥 Roster</button>' +
        '</div>' +
        '</div>',
    );
  };
})();
