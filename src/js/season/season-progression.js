/* ============================================================
   SEASON PROGRESSION SYSTEM
   Hides offseason features from the sidebar and triggers them
   in the correct NFL calendar order:
     Regular Season → Awards → Black Monday →
     Free Agency → Draft → New Season
   ============================================================ */

(function () {
  /* ── Utility ──────────────────────────────────────────── */
  function showSection(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = '';
  }
  function hideSection(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
  function phaseCard(title, sub, body, buttons) {
    /* Renders a styled "phase announcement" card in #main */
    var btns = buttons
      .map(function (b) {
        return '<button onclick="' + b.fn + '" style="margin-top:8px">' + b.label + '</button>';
      })
      .join('');
    return (
      '<div class="welcome-hero" style="margin-bottom:16px">' +
      '<h2>' +
      title +
      '</h2>' +
      '<p style="color:var(--muted2);font-size:13px;margin-bottom:12px">' +
      sub +
      '</p>' +
      body +
      btns +
      '</div>'
    );
  }

  /* ── Wire the Transactions section buttons ───────────── */
  window.addEventListener('DOMContentLoaded', function () {
    /* Trade Center */
    var tcBtn = document.getElementById('btnTradeCenter');
    if (tcBtn)
      tcBtn.addEventListener('click', function () {
        window.renderTradePicksUI();
      });

    var gpBtn = document.getElementById('btnWeeklyGameplan');
    if (gpBtn)
      gpBtn.addEventListener('click', function () {
        if (typeof renderGameplanScreen === 'function') renderGameplanScreen();
      });

    var trBtn = document.getElementById('btnCheckTradeReqs');
    if (trBtn)
      trBtn.addEventListener('click', function () {
        if (typeof renderTradeRequests === 'function') renderTradeRequests();
      });

    /* Free Agency section buttons (hidden until unlocked) */
    var capBtn = document.getElementById('btnCapChart');
    if (capBtn)
      capBtn.addEventListener('click', function () {
        if (typeof renderCapChart === 'function') renderCapChart();
      });

    var simFABtn = document.getElementById('btnSimFA');
    if (simFABtn)
      simFABtn.addEventListener('click', function () {
        if (typeof simulateFullFreeAgency === 'function') simulateFullFreeAgency();
      });

    /* Draft section buttons (hidden until unlocked) */
    var draftOrderBtn = document.getElementById('btnViewDraftOrder');
    if (draftOrderBtn)
      draftOrderBtn.addEventListener('click', function () {
        if (typeof renderDraftOrder === 'function') renderDraftOrder();
      });

    var startDraftBtn = document.getElementById('btnStartDraft');
    if (startDraftBtn)
      startDraftBtn.addEventListener('click', function () {
        window.launchDraft();
      });
  });

  /* ── Patch renderWeekResults to trigger end-of-season ─ */
  var _origRWR = window.renderWeekResults;
  window.renderWeekResults = function (week) {
    _origRWR(week);
    /* currentWeekIndex was already incremented before this call */
    /* Only show the Regular Season Complete banner immediately after week 17.
       During playoffs (gmPhase==='postseason') this banner should stay hidden. */
    if (currentWeekIndex === schedule.length && window.gmPhase !== 'postseason') {
      var main = document.getElementById('main');
      if (!main) return;
      var banner = document.createElement('div');
      banner.className = 'welcome-hero';
      banner.style.marginTop = '16px';
      banner.innerHTML =
        '<h2 style="color:var(--gold)">🏁 Regular Season Complete</h2>' +
        '<p style="color:var(--muted2);font-size:13px">' +
        'All 17 weeks have been played. Time for the postseason.' +
        '</p>' +
        '<button onclick="beginAwardsPhase()" style="margin-top:10px">' +
        '🏆 View Awards &amp; Begin Offseason →' +
        '</button>';
      main.appendChild(banner);
    }
  };

  /* ── Phase 1: Awards ─────────────────────────────────── */
  window.beginAwardsPhase = function () {
    if (typeof renderAwards === 'function') renderAwards();
    /* Append a "Continue" button after awards render */
    setTimeout(function () {
      var main = document.getElementById('main');
      if (!main) return;
      var div = document.createElement('div');
      div.style.marginTop = '16px';
      div.innerHTML = '<button onclick="beginPlayoffsPhase()">' + '🏟️ Begin Playoffs →' + '</button>';
      main.appendChild(div);
    }, 50);
  };

  /* ═══════════════════════════════════════════════════════════
     PLAYOFF SYSTEM — week-by-week, driven by the Sim Week button
     ═══════════════════════════════════════════════════════════
     State stored on window.playoffs = {
       confNames: [str, str],
       rounds: ['Wild Card','Divisional','Conference Championship','Super Bowl'],
       roundIdx: 0,          // which round we're on
       conf1: [team...],     // survivors (shrinks each round)
       conf2: [team...],
       conf1Seeds: [7 teams], // original seeds
       conf2Seeds: [7 teams],
       userIn: bool,
       done: false,
       sbWinner: null
     }
     Each round builds a "playoff week" object identical in shape
     to a regular-season week (games[]) and passes it through the
     existing simulateWeek / renderWeekResults pipeline.
  ════════════════════════════════════════════════════════════ */

  window.beginPlayoffsPhase = function () {
    window.gmPhase = 'postseason';
    var allTeams = listAllTeams(league);

    /* Discover conference names */
    var confNames = [];
    allTeams.forEach(function (t) {
      if (t.conference && confNames.indexOf(t.conference) < 0) confNames.push(t.conference);
    });
    if (confNames.length < 2) confNames = [confNames[0] || 'Conference A', confNames[1] || 'Conference B'];

    function confStandings(name) {
      return allTeams
        .filter(function (t) {
          return t.conference === name;
        })
        .sort(function (a, b) {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return (b.pointsFor || 0) - (a.pointsFor || 0);
        });
    }

    function padTo7(arr) {
      var out = arr.slice(0, 7);
      while (out.length < 7) out.push(out[Math.max(0, out.length - 1)]);
      return out;
    }

    var c1Seeds = padTo7(confStandings(confNames[0]));
    var c2Seeds = padTo7(confStandings(confNames[1]));

    var tid = typeof userTeamId !== 'undefined' ? userTeamId : null;
    var userIn =
      tid &&
      c1Seeds.concat(c2Seeds).some(function (t) {
        return t.id === tid;
      });

    /* Store state */
    window.playoffs = {
      confNames: confNames,
      conf1Seeds: c1Seeds,
      conf2Seeds: c2Seeds,
      /* Wild Card survivors start as seeds 2-7; seed 1 gets a bye */
      conf1: c1Seeds.slice(1) /* will be replaced after WC */,
      conf2: c2Seeds.slice(1),
      conf1Bye: c1Seeds[0] /* seed 1 byes */,
      conf2Bye: c2Seeds[0],
      roundIdx: 0,
      rounds: ['Wild Card', 'Divisional Round', 'Conference Championship', 'Super Bowl'],
      userIn: userIn,
      done: false,
      sbWinner: null,
      results: [],
    };

    /* Build the first playoff week (Wild Card) and store it */
    window._buildNextPlayoffRound();

    /* Show the bracket / notification screen */
    window._renderPlayoffLobby();
  };

  /* ── Build the next round's game slate ───────────────────────── */
  window._buildNextPlayoffRound = function () {
    var ps = window.playoffs;
    if (!ps || ps.done) return;
    var round = ps.rounds[ps.roundIdx];
    var games = [];

    function makeGame(home, away) {
      return {
        homeTeamId: home.id,
        awayTeamId: away.id,
        played: false,
        isPlayoff: true,
        playoffRound: round,
        homeScore: 0,
        awayScore: 0,
      };
    }

    if (round === 'Wild Card') {
      /* Seed 1 has a bye. 2v7, 3v6, 4v5 per conference */
      var c1 = ps.conf1Seeds,
        c2 = ps.conf2Seeds;
      games.push(makeGame(c1[1], c1[6]));
      games.push(makeGame(c1[2], c1[5]));
      games.push(makeGame(c1[3], c1[4]));
      games.push(makeGame(c2[1], c2[6]));
      games.push(makeGame(c2[2], c2[5]));
      games.push(makeGame(c2[3], c2[4]));
    } else if (round === 'Divisional Round') {
      /* conf1: seed1 vs lowest WC winner; other two WC winners play each other */
      games.push(makeGame(ps.conf1Bye, ps.conf1[0]));
      games.push(makeGame(ps.conf1[1], ps.conf1[2]));
      games.push(makeGame(ps.conf2Bye, ps.conf2[0]));
      games.push(makeGame(ps.conf2[1], ps.conf2[2]));
    } else if (round === 'Conference Championship') {
      games.push(makeGame(ps.conf1[0], ps.conf1[1]));
      games.push(makeGame(ps.conf2[0], ps.conf2[1]));
    } else if (round === 'Super Bowl') {
      games.push(makeGame(ps.conf1[0], ps.conf2[0]));
    }

    /* Store as a week-shaped object the sim pipeline can use */
    ps.currentWeek = {
      weekNumber: 17 + ps.roundIdx + 1,
      label: round,
      games: games,
      isPlayoff: true,
    };
  };

  /* ── Advance survivors after a round completes ───────────────── */
  window._advancePlayoffRound = function () {
    var ps = window.playoffs;
    if (!ps) return;
    var round = ps.rounds[ps.roundIdx];
    var week = ps.currentWeek;

    function winner(game) {
      var h = getTeamById(game.homeTeamId);
      var a = getTeamById(game.awayTeamId);
      return game.homeScore >= game.awayScore ? h : a;
    }

    if (round === 'Wild Card') {
      /* Winners of each conf's 3 WC games, sorted by original seed (lowest seed # = higher seed) */
      function wcWinners(confSeeds, gameOffset) {
        var wc = week.games.slice(gameOffset, gameOffset + 3).map(winner);
        /* Sort by original seed rank */
        return wc.sort(function (a, b) {
          return confSeeds.indexOf(a) - confSeeds.indexOf(b);
        });
      }
      ps.conf1 = wcWinners(ps.conf1Seeds, 0);
      ps.conf2 = wcWinners(ps.conf2Seeds, 3);
      /* Byes (seed 1) are already stored in conf1Bye / conf2Bye */
    } else if (round === 'Divisional Round') {
      ps.conf1 = [winner(week.games[0]), winner(week.games[1])];
      ps.conf2 = [winner(week.games[2]), winner(week.games[3])];
    } else if (round === 'Conference Championship') {
      var champ1 = winner(week.games[0]);
      var champ2 = winner(week.games[1]);
      ps.conf1 = [champ1];
      ps.conf2 = [champ2];
    } else if (round === 'Super Bowl') {
      ps.sbWinner = winner(week.games[0]);
      ps.done = true;
    }

    ps.results.push({ round: round, games: week.games.slice() });
    ps.roundIdx++;

    if (!ps.done) {
      window._buildNextPlayoffRound();
    }
  };

  /* ── Playoff lobby / bracket status screen ───────────────────── */
  window._renderPlayoffLobby = function () {
    var ps = window.playoffs;
    if (!ps) return;
    var tid = typeof userTeamId !== 'undefined' ? userTeamId : null;
    var myTeam = tid && getTeamById(tid);

    /* User status banner */
    var userBanner = '';
    if (ps.userIn) {
      userBanner =
        '<div style="background:rgba(96,165,250,.12);border:1px solid #3b82f6;' +
        'border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#60a5fa;text-align:center">' +
        '🏟️ <strong>' +
        (myTeam ? myTeam.city + ' ' + myTeam.nickname : 'Your team') +
        '</strong> made the playoffs!' +
        '</div>';
    } else {
      userBanner =
        '<div style="background:rgba(148,163,184,.08);border:1px solid var(--border);' +
        'border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--muted2);text-align:center">' +
        'Your team did not qualify for the playoffs this season.' +
        '</div>';
    }

    /* Seed tables */
    function seedTable(seeds, confName) {
      var rows = seeds
        .map(function (t, i) {
          var isUser = tid && t.id === tid;
          return (
            '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;' +
            'background:' +
            (isUser ? 'rgba(96,165,250,.1)' : 'transparent') +
            ';border-radius:5px">' +
            '<span style="font-size:10px;font-weight:700;color:var(--muted2);min-width:18px">#' +
            (i + 1) +
            '</span>' +
            '<span style="font-size:12px;flex:1' +
            (isUser ? ';color:#60a5fa;font-weight:700' : '') +
            '">' +
            t.city +
            ' ' +
            t.nickname +
            '</span>' +
            '<span style="font-size:11px;color:var(--muted2)">' +
            t.wins +
            '-' +
            t.losses +
            '</span>' +
            '</div>'
          );
        })
        .join('');
      return (
        '<div style="flex:1;min-width:0">' +
        '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;' +
        'color:var(--accent2);margin-bottom:6px">' +
        confName +
        '</div>' +
        rows +
        '</div>'
      );
    }

    var round = ps.rounds[ps.roundIdx] || '';
    var nextRoundLabel = round === 'Wild Card' ? 'Wild Card' : round;

    setMainContent(
      '<div style="max-width:600px;margin:0 auto">' +
        '<h2 style="color:var(--gold);margin-bottom:4px">🏟️ Playoffs</h2>' +
        '<p style="color:var(--muted2);font-size:12px;margin-bottom:14px">Next round: <strong>' +
        nextRoundLabel +
        '</strong></p>' +
        userBanner +
        '<div style="display:flex;gap:12px;margin-bottom:16px">' +
        seedTable(ps.conf1Seeds, ps.confNames[0]) +
        seedTable(ps.conf2Seeds, ps.confNames[1]) +
        '</div>' +
        '<button onclick="renderHome()" ' +
        'style="width:100%;padding:16px;font-size:16px;font-weight:700;' +
        "font-family:'Barlow Condensed',sans-serif;letter-spacing:.5px;" +
        'background:var(--accent-dim);border-color:var(--accent);color:var(--accent2);margin-top:4px">' +
        '⚡ Sim ' +
        nextRoundLabel +
        ' →' +
        '</button>' +
        '</div>',
    );
  };

  /* ── Phase 3: Free Agency ────────────────────────────── */
  window.beginFreeAgencyPhase = function () {
    /* Process contract expirations + generate FA pool */
    if (typeof processContractExpirations === 'function') processContractExpirations();
    if (typeof generateFreeAgentPool === 'function') generateFreeAgentPool();
    if (typeof cpuRosterCleanup === 'function') cpuRosterCleanup();

    /* Unlock FA section in sidebar */
    showSection('section-free-agency');

    /* Navigate to FA screen */
    if (typeof renderFreeAgencyScreen === 'function') renderFreeAgencyScreen();
  };

  /* ── Phase 4: Draft ──────────────────────────────────── */
  window.beginDraftPhase = function () {
    /* CPU signs any remaining free agents */
    if (typeof simulateFullFreeAgency === 'function') {
      /* Run CPU waves silently without navigating away */
      if (typeof freeAgents !== 'undefined' && freeAgents.length > 0) {
        if (typeof simulateFreeAgencyWave === 'function') {
          simulateFreeAgencyWave(85, 99);
          simulateFreeAgencyWave(78, 84);
          simulateFreeAgencyWave(70, 77);
          simulateFreeAgencyWave(0, 69);
        }
      }
    }

    /* Hide FA section, show Draft section */
    hideSection('section-free-agency');
    showSection('section-draft');

    /* Calculate draft order + generate class */
    if (typeof calculateDraftOrder === 'function') calculateDraftOrder();
    if (typeof generateDraftClass === 'function') generateDraftClass();

    var _importBadge = window._customDraftImported
      ? '✅ ' + window._customDraftImported.count + ' custom prospects loaded'
      : '';

    var _draftBody =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
      '<button onclick="window.downloadDraftTemplate()" ' +
      'style="width:auto;padding:7px 14px;font-size:12px;font-weight:600;' +
      'background:rgba(59,130,246,.12);border-color:#3b82f6;color:#60a5fa">' +
      '📥 Download Draft Class Template' +
      '</button>' +
      '<button onclick="document.getElementById(\'_draftPhaseFileInput\').click()" ' +
      'style="width:auto;padding:7px 14px;font-size:12px;font-weight:600;' +
      'background:rgba(22,163,74,.12);border-color:var(--accent);color:var(--accent2)">' +
      '📂 Upload Custom Draft Class' +
      '</button>' +
      '<input type="file" id="_draftPhaseFileInput" accept=".csv" style="display:none" ' +
      'onchange="window.importCustomDraftClass(this.files[0]);this.value=\'\'">' +
      '</div>' +
      (_importBadge ? '<div style="font-size:12px;color:var(--accent2)">' + _importBadge + '</div>' : '');

    var html = phaseCard('🎯 NFL Draft', 'The draft order has been set. Worst record picks first.', _draftBody, [
      { label: '📋 View Draft Order', fn: 'renderDraftOrder()' },
      { label: '▶ Start Draft', fn: 'launchDraft()' },
    ]);
    setMainContent(html);
  };

  window.launchDraft = function () {
    draftRound = 1;
    draftIndex = 0;
    var first = getTeamOnClock ? getTeamOnClock() : null;
    if (first && first.id === userTeamId) {
      renderDraftScreen();
    } else if (typeof cpuDraftPlayer === 'function') {
      cpuDraftPlayer();
    }
  };

  window.beginNewSeason = function () {
    /* Increment tracked season year */
    window.simYear = (window.simYear || 1) + 1;

    /* Recalculate capUsed from actual rosters — removes any drift from
       trades, FA signings, and draft across the offseason              */
    if (typeof recalcAllTeamCap === 'function') recalcAllTeamCap();

    /* ── RESET all team records and season stats ── */
    if (typeof league !== 'undefined' && league) {
      listAllTeams(league).forEach(function (team) {
        team.wins = 0;
        team.losses = 0;
        team.ties = 0;
        team.pointsFor = 0;
        team.pointsAgainst = 0;
        team.teamStats = {
          totalOffenseYards: 0,
          totalDefenseYards: 0,
          turnoversForced: 0,
          turnoversCommitted: 0,
        };
        /* Reset each player's season stats */
        team.roster.forEach(function (p) {
          /* Archive this season into career before wiping */
          if (!p.careerStats) p.careerStats = {};
          var s = p.stats || {};
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
            p.careerStats[k] = (p.careerStats[k] || 0) + (s[k] || 0);
          });

          /* Wipe season stats */
          p.stats = {
            gamesPlayed: 0,
            passingYards: 0,
            passingTD: 0,
            interceptionsThrown: 0,
            rushingYards: 0,
            rushingTD: 0,
            receivingYards: 0,
            receivingTD: 0,
            tackles: 0,
            sacks: 0,
            interceptions: 0,
            fieldGoalsMade: 0,
            fieldGoalsMissed: 0,
            xpMade: 0,
            xpMissed: 0,
          };
          /* Record new season-start OVR for delta tracking */
          p.seasonStartOVR = p.attributes.overall;
          p._ovrYear = window.simYear;
          p.devAccum = 0; /* reset accumulator for new season */
        });
      });
    }

    /* Reset week counter */
    currentWeekIndex = 0;

    /* Run UDFA first — seeds undrafted rookies into the FA pool */
    if (typeof runUDFA === 'function') runUDFA();

    /* Run preseason roster cuts + morale/chemistry reset */
    if (typeof runPreseasonCuts === 'function') runPreseasonCuts();
    if (typeof resetMoraleAndChemistry === 'function') resetMoraleAndChemistry();
    if (typeof applyCapRollover === 'function') applyCapRollover();
    if (typeof initializeCoachSeasonBaselines === 'function') initializeCoachSeasonBaselines();

    /* Regenerate schedule */
    schedule = generateSchedule(league);
    updateWeekLabel();

    /* Hide offseason sections */
    hideSection('section-free-agency');
    hideSection('section-draft');

    /* ── Draft Grade Rankings ─────────────────────────────── */
    var _allTeams = typeof listAllTeams === 'function' && league ? listAllTeams(league) : [];
    var _userTeam = typeof teamMap !== 'undefined' && teamMap && userTeamId ? teamMap[userTeamId] : null;

    function _gradeDraft(team) {
      var rookies = team.roster.filter(function (p) {
        return p.isRookie;
      });
      if (!rookies.length) return { score: 38, rookies: 0, avgOVR: 0, needPct: 0, stars: 0 };

      var avgOVR =
        rookies.reduce(function (s, p) {
          return s + p.attributes.overall;
        }, 0) / rookies.length;

      /* Approximate pre-draft need by temporarily removing rookies */
      var preTeam = {
        roster: team.roster.filter(function (p) {
          return !p.isRookie;
        }),
      };
      var needSum = rookies.reduce(function (s, p) {
        var n = typeof getTeamNeedAtPosition === 'function' ? getTeamNeedAtPosition(preTeam, p.positions[0]) : 0.5;
        return s + n;
      }, 0);
      var needScore = needSum / rookies.length; /* 0.0 – 1.0 */

      /* Quality: normalize OVR (55–95) to 0–100 */
      var qualPct = Math.min(100, Math.max(0, ((avgOVR - 55) / 40) * 100));
      var needPct = needScore * 100;

      /* 60% quality, 40% need fulfilment */
      var score = qualPct * 0.6 + needPct * 0.4;

      /* Star-player bonus (OVR ≥ 88) */
      var stars = rookies.filter(function (p) {
        return p.attributes.overall >= 88;
      }).length;
      score = Math.min(100, score + stars * 3);

      /* Depth bonus */
      if (rookies.length >= 6) score = Math.min(100, score + 3);
      if (rookies.length >= 10) score = Math.min(100, score + 2);

      return {
        score: Math.round(score),
        rookies: rookies.length,
        avgOVR: Math.round(avgOVR),
        needPct: Math.round(needPct),
        stars: stars,
      };
    }

    function _letterGrade(s) {
      if (s >= 97) return 'A+';
      if (s >= 92) return 'A';
      if (s >= 87) return 'A-';
      if (s >= 82) return 'B+';
      if (s >= 77) return 'B';
      if (s >= 72) return 'B-';
      if (s >= 67) return 'C+';
      if (s >= 62) return 'C';
      if (s >= 57) return 'C-';
      if (s >= 50) return 'D+';
      if (s >= 44) return 'D';
      return 'D-';
    }

    function _gradeColor(g) {
      if (g[0] === 'A') return '#22c55e';
      if (g[0] === 'B') return '#3b82f6';
      if (g[0] === 'C') return '#f59e0b';
      return '#ef4444';
    }

    /* Rank all teams */
    var _ranked = _allTeams
      .map(function (t) {
        var g = _gradeDraft(t);
        return {
          team: t,
          letter: _letterGrade(g.score),
          score: g.score,
          rookies: g.rookies,
          avgOVR: g.avgOVR,
          needPct: g.needPct,
          stars: g.stars,
        };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });

    var _userEntry = _userTeam
      ? _ranked.find(function (r) {
          return r.team.id === _userTeam.id;
        })
      : null;
    var _userRank = _userEntry ? _ranked.indexOf(_userEntry) + 1 : null;

    /* Table rows */
    var _rows = _ranked
      .map(function (r, idx) {
        var isUser = _userTeam && r.team.id === _userTeam.id;
        var gc = _gradeColor(r.letter);
        var rowBg = isUser
          ? 'background:rgba(22,163,74,0.10);outline:1px solid var(--accent);outline-offset:-1px;'
          : '';
        var badge = isUser
          ? '<span style="margin-left:7px;font-size:10px;background:var(--accent-dim);color:var(--accent2);padding:1px 7px;border-radius:4px;font-weight:700;vertical-align:middle;letter-spacing:.5px">★ YOU</span>'
          : '';
        var starStr = r.stars > 0 ? '★'.repeat(Math.min(r.stars, 3)) : '—';
        return (
          '<tr style="' +
          rowBg +
          '">' +
          '<td style="font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:13px;color:var(--muted)">' +
          (idx + 1) +
          '</td>' +
          '<td style="font-weight:' +
          (isUser ? '700' : '500') +
          ';color:' +
          (isUser ? 'var(--text)' : 'inherit') +
          '">' +
          r.team.city +
          ' ' +
          r.team.nickname +
          badge +
          '</td>' +
          '<td style="text-align:center">' +
          '<span style="font-family:Barlow Condensed,sans-serif;font-size:17px;font-weight:700;color:' +
          gc +
          '">' +
          r.letter +
          '</span>' +
          '</td>' +
          '<td style="text-align:center;color:var(--muted2);font-size:12px">' +
          (r.avgOVR || '—') +
          '</td>' +
          '<td style="text-align:center;color:var(--muted2);font-size:12px">' +
          r.rookies +
          '</td>' +
          '<td style="text-align:center;color:var(--gold);letter-spacing:1px">' +
          starStr +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    /* User team callout card */
    var _userCard = '';
    if (_userEntry) {
      var _gc2 = _gradeColor(_userEntry.letter);
      _userCard =
        '<div style="background:var(--surface);border:1px solid var(--accent);border-radius:10px;padding:16px 18px;margin-bottom:16px;display:flex;align-items:center;gap:18px">' +
        '<div style="font-family:Barlow Condensed,sans-serif;font-size:52px;font-weight:700;color:' +
        _gc2 +
        ';line-height:1;min-width:64px;text-align:center">' +
        _userEntry.letter +
        '</div>' +
        '<div>' +
        '<div style="font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">' +
        '★ ' +
        _userTeam.city +
        ' ' +
        _userTeam.nickname +
        ' — Your Draft Grade' +
        '</div>' +
        '<div style="font-size:12px;color:var(--muted2);line-height:1.6">' +
        'Ranked <strong style="color:var(--text)">#' +
        _userRank +
        '</strong> of ' +
        _ranked.length +
        ' teams' +
        ' &nbsp;·&nbsp; ' +
        _userEntry.rookies +
        ' rookies on roster' +
        ' &nbsp;·&nbsp; Avg OVR <strong style="color:var(--text)">' +
        (_userEntry.avgOVR || '—') +
        '</strong>' +
        (_userEntry.stars > 0
          ? ' &nbsp;·&nbsp; <span style="color:var(--gold)">' +
            _userEntry.stars +
            ' star prospect' +
            (_userEntry.stars !== 1 ? 's' : '') +
            '</span>'
          : '') +
        '</div>' +
        '</div>' +
        '</div>';
    }

    /* Final page */
    setMainContent(
      '<div class="welcome-hero" style="margin-bottom:14px">' +
        '<h2 style="color:var(--accent2)">🏈 Season ' +
        window.simYear +
        ' Begins!</h2>' +
        '<p style="color:var(--muted2);font-size:13px;margin:0">Rosters are set. Records cleared. Time to play.</p>' +
        '</div>' +
        /* Home tile */
        '<button onclick="typeof renderHome===\'function\'&&renderHome()" ' +
        'style="display:inline-flex;align-items:center;gap:7px;width:auto;padding:7px 16px;' +
        'font-size:12px;margin-bottom:16px;background:transparent;border:1px solid var(--border);color:var(--muted2)">' +
        '🏠 Back to Home' +
        '</button>' +
        _userCard +
        '<h3 style="font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:600;' +
        'color:var(--accent2);margin:0 0 10px;padding-bottom:5px;border-bottom:1px solid var(--accent-dim)">' +
        '📋 Draft Class Rankings — All Teams' +
        '</h3>' +
        '<div class="table-wrap"><table>' +
        '<thead><tr>' +
        '<th>#</th>' +
        '<th>Team</th>' +
        '<th style="text-align:center">Grade</th>' +
        '<th style="text-align:center">Avg OVR</th>' +
        '<th style="text-align:center">Rookies</th>' +
        '<th style="text-align:center">Stars</th>' +
        '</tr></thead>' +
        '<tbody>' +
        _rows +
        '</tbody>' +
        '</table></div>',
    );
  };
})();
