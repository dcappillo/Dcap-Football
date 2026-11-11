/* ============================================================
   COACHING SYSTEM COMPREHENSIVE FIX

   Bugs fixed:
   1. simulateGame scheme hook used wrong signature & expected
      return value that never existed. Replaced with direct
      power rating modifier applied inside simulateGame.
   2. developOC/DC/HC received undefined gameStats — now reads
      from player stats accumulated on the team after a game.
   3. runBlackMonday never called updateCoachJobSecurityAfterSeason
      so coaches almost never got fired. Fixed order.
   4. contractRemaining was never decremented each season.
   5. Black Monday now has a full interactive UI where the user
      can fire/keep their own coach and hire a replacement.
   6. calculateTeamGameModifier null-safety throughout.
   7. Coordinators re-initialized on save/load.
   ============================================================ */
(function () {
  /* ── Null-safe scheme/coordinator helpers ───────────────── */
  function safeOC(team) {
    if (!team.oc) {
      team.oc = { name: 'Unknown OC', offenseRating: 70, scheme: 'Balanced', jobSecurity: 60 };
    }
    return team.oc;
  }
  function safeDC(team) {
    if (!team.dc) {
      team.dc = { name: 'Unknown DC', defenseRating: 70, scheme: '4-3', jobSecurity: 60 };
    }
    return team.dc;
  }
  function safeCoach(team) {
    if (!team.coach) {
      team.coach = {
        name: 'Unknown HC',
        offenseRating: 70,
        defenseRating: 70,
        leadership: 70,
        jobSecurity: 60,
        contractRemaining: 2,
      };
    }
    if (team.coach.contractRemaining === undefined) team.coach.contractRemaining = 2;
    if (team.coach.jobSecurity === undefined) team.coach.jobSecurity = 60;
    return team.coach;
  }

  /* ── Fix 1: Apply scheme + coordinator boosts directly to
     simulateGame's power ratings instead of hooking a broken
     return-value API.                                         */
  function coachingPowerBoost(team) {
    var oc = safeOC(team);
    var dc = safeDC(team);
    var coach = safeCoach(team);
    var chem = typeof getTeamChemistryOVRModifier === 'function' ? getTeamChemistryOVRModifier(team) : 0;

    var offBoost = Math.floor((oc.offenseRating - 75) / 4);
    var defBoost = Math.floor((dc.defenseRating - 75) / 4);
    var leadBoost = Math.floor((coach.leadership - 75) / 6);

    /* Scheme fit: average of top-12 starters' fit scores */
    var fitScore = 0;
    if (team.roster && team.roster.length && typeof calculateSchemeFit === 'function') {
      var starters = team.roster.slice(0, 22);
      fitScore = Math.floor(
        starters.reduce(function (s, p) {
          return s + calculateSchemeFit(p, team);
        }, 0) /
          starters.length /
          20 /* map 50-100 fit → roughly -1 to +2 */ -
          2.5,
      );
    }

    return offBoost + defBoost + leadBoost + fitScore + chem;
  }

  /* Patch simulateGame to apply coaching boost to powerRatings */
  var _origSG = window.simulateGame;
  window.simulateGame = function (game, teamMap, userStrategy, userTeamId) {
    /* Temporarily bump power ratings, run sim, restore */
    if (teamMap && game) {
      var home = teamMap[game.homeTeamId];
      var away = teamMap[game.awayTeamId];
      if (home && away) {
        var hBoost = coachingPowerBoost(home);
        var aBoost = coachingPowerBoost(away);
        home.powerRating += hBoost;
        away.powerRating += aBoost;
        try {
          if (typeof _origSG === 'function') _origSG(game, teamMap, userStrategy, userTeamId);
        } finally {
          home.powerRating -= hBoost;
          away.powerRating -= aBoost;
        }
        return;
      }
    }
    if (typeof _origSG === 'function') _origSG(game, teamMap, userStrategy, userTeamId);
  };

  /* ── Fix 2: Coach development — read from team player stats ── */
  function teamOffensiveStats(team) {
    var qb = (team.roster || []).find(function (p) {
      return p.positions[0] === 'QB';
    });
    var s = qb ? qb.stats || {} : {};
    return {
      passYds: s.passingYards || 0,
      passTD: s.passingTD || 0,
      rushYds: (team.teamStats || {}).totalOffenseYards || 0,
      rushTD: 0,
      ptsAllowed: team.pointsAgainst || 0,
      sacks: (team.roster || []).reduce(function (n, p) {
        return n + (p.stats || {}).sacks || 0;
      }, 0),
      turnovers: (team.teamStats || {}).turnoversForced || 0,
      yardsAllowed: (team.teamStats || {}).totalDefenseYards || 0,
      margin: (team.pointsFor || 0) - (team.pointsAgainst || 0),
    };
  }

  function runCoachDevelopmentForAllTeams() {
    if (typeof league === 'undefined' || !league) return;
    listAllTeams(league).forEach(function (team) {
      var stats = teamOffensiveStats(team);
      var didWin = (team.wins || 0) > (team.losses || 0);
      if (typeof developOC === 'function') developOC(team, stats);
      if (typeof developDC === 'function') developDC(team, stats);
      if (typeof developHeadCoach === 'function') developHeadCoach(team, stats, didWin);
    });
  }

  /* ── Fix 3 & 4: runBlackMonday — update job security FIRST,
     decrement contracts, then evaluate firings.              */
  window.runBlackMonday = function () {
    if (typeof league === 'undefined' || !league) return [];
    var teams = listAllTeams(league);
    var firings = [];

    /* Run coach development end-of-season */
    runCoachDevelopmentForAllTeams();

    /* Apply scheme fit effects */
    if (typeof applySchemeFitMoraleEffects === 'function')
      teams.forEach(function (t) {
        applySchemeFitMoraleEffects(t);
      });
    if (typeof applySchemeFitChemistryEffects === 'function')
      teams.forEach(function (t) {
        applySchemeFitChemistryEffects(t);
      });

    /* Build candidate pool */
    if (typeof buildHeadCoachCandidatePool === 'function') buildHeadCoachCandidatePool();

    teams.forEach(function (team) {
      var hc = safeCoach(team);

      /* Decrement contract */
      hc.contractRemaining = Math.max(0, (hc.contractRemaining || 1) - 1);

      /* Update job security BEFORE firing decision */
      if (typeof updateCoachJobSecurityAfterSeason === 'function') updateCoachJobSecurityAfterSeason(team);

      /* Skip if contract protected and job security OK */
      if (hc.contractRemaining > 0 && hc.jobSecurity > 30) return;

      /* Evaluate whether to fire */
      var shouldFire = typeof evaluateCoachFiring === 'function' ? evaluateCoachFiring(team) : hc.jobSecurity <= 25;

      if (shouldFire) {
        firings.push({ team: team, coach: Object.assign({}, hc) });
        if (typeof logTransaction === 'function')
          logTransaction('Coach Firing', team.city + ' ' + team.nickname + ' fired ' + hc.name, team.id, null);
        coachFreeAgents.push({
          id: 'cfa_' + team.id,
          name: hc.name,
          offenseRating: hc.offenseRating,
          defenseRating: hc.defenseRating,
          leadership: hc.leadership,
          style: hc.offenseRating >= hc.defenseRating ? 'Offensive' : 'Defensive',
        });
        /* CPU teams auto-hire; user team waits for user input */
        if (team.id !== userTeamId) {
          if (typeof cpuHireHeadCoach === 'function') cpuHireHeadCoach(team);
        }
      }
    });

    /* Poach coordinators for CPU teams */
    if (typeof cpuPoachCoordinators === 'function') cpuPoachCoordinators();

    return firings;
  };

  /* ── Fix 5: Black Monday UI with user interaction ────────── */
  window.beginBlackMonday = function () {
    window.gmPhase = 'postseason';
    var firings = window.runBlackMonday();

    /* Separate user's team firing from CPU firings */
    var userFired = firings.find(function (f) {
      return f.team.id === userTeamId;
    });
    var cpuFired = firings.filter(function (f) {
      return f.team.id !== userTeamId;
    });

    var userTeam = typeof getTeamById === 'function' ? getTeamById(userTeamId) : null;
    var hc = userTeam ? safeCoach(userTeam) : null;

    /* Build CPU firings summary */
    var cpuRows = cpuFired.length
      ? cpuFired
          .map(function (f) {
            var newHC = safeCoach(f.team);
            return (
              '<tr>' +
              '<td>' +
              f.team.city +
              ' ' +
              f.team.nickname +
              '</td>' +
              '<td style="color:#f87171">' +
              f.coach.name +
              ' fired</td>' +
              '<td style="color:#4ade80">' +
              newHC.name +
              ' hired</td>' +
              '</tr>'
            );
          })
          .join('')
      : '<tr><td colspan="3" style="color:var(--muted2);text-align:center">No CPU coach changes</td></tr>';

    /* User coaching status */
    var userSection;
    if (userFired) {
      /* User's coach was automatically fired — must hire replacement */
      userSection =
        '<div style="background:rgba(239,68,68,.12);border:1px solid #ef4444;' +
        'border-radius:10px;padding:16px;margin-bottom:14px">' +
        '<div style="font-size:15px;font-weight:700;color:#f87171;margin-bottom:6px">' +
        '🔥 Your coach was fired</div>' +
        '<p style="font-size:13px;color:var(--muted2);margin:0 0 12px">' +
        hc.name +
        ' has been let go after a ' +
        userTeam.wins +
        '-' +
        userTeam.losses +
        ' season. ' +
        'Job security reached ' +
        (userFired.coach.jobSecurity || 0) +
        '.</p>' +
        '<button onclick="renderUserCoachHire()" ' +
        'style="background:var(--accent-dim);border-color:var(--accent);' +
        'color:var(--accent2);font-weight:600">👔 Hire New Head Coach →</button>' +
        '</div>';
    } else if (userTeam && hc) {
      var js = hc.jobSecurity || 60;
      var jsColor = js >= 70 ? '#4ade80' : js >= 45 ? '#facc15' : '#f87171';
      userSection =
        '<div style="background:var(--surface);border:1px solid var(--border);' +
        'border-radius:10px;padding:16px;margin-bottom:14px">' +
        '<div style="font-size:13px;font-weight:600;color:var(--accent2);margin-bottom:8px">' +
        'Your Coaching Staff</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
        /* HC card */
        '<div style="background:var(--surface2);border-radius:8px;padding:10px">' +
        '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Head Coach</div>' +
        '<div style="font-weight:600">' +
        hc.name +
        '</div>' +
        '<div style="font-size:11px;color:var(--muted2)">Off: ' +
        hc.offenseRating +
        ' | Def: ' +
        hc.defenseRating +
        ' | Lead: ' +
        hc.leadership +
        '</div>' +
        '<div style="font-size:11px;margin-top:4px">Job Security: <span style="font-weight:700;color:' +
        jsColor +
        '">' +
        js +
        '</span>' +
        ' | Contract: ' +
        (hc.contractRemaining || 0) +
        ' yr left</div>' +
        '</div>' +
        /* OC card */
        '<div style="background:var(--surface2);border-radius:8px;padding:10px">' +
        '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Coordinators</div>' +
        '<div style="font-size:12px"><strong>OC:</strong> ' +
        (userTeam.oc ? userTeam.oc.name : '—') +
        '</div>' +
        '<div style="font-size:11px;color:var(--muted2)">' +
        (userTeam.oc ? userTeam.oc.scheme : '—') +
        '</div>' +
        '<div style="font-size:12px;margin-top:4px"><strong>DC:</strong> ' +
        (userTeam.dc ? userTeam.dc.name : '—') +
        '</div>' +
        '<div style="font-size:11px;color:var(--muted2)">' +
        (userTeam.dc ? userTeam.dc.scheme : '—') +
        '</div>' +
        '</div>' +
        '</div>' +
        /* Action buttons */
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button onclick="renderUserCoachHire()" style="flex:1;font-size:12px;background:rgba(239,68,68,.12);border-color:#ef4444;color:#f87171">🔥 Fire &amp; Hire HC</button>' +
        '<button onclick="renderUserOCHire()" style="flex:1;font-size:12px">👔 Change OC</button>' +
        '<button onclick="renderUserDCHire()" style="flex:1;font-size:12px">🛡 Change DC</button>' +
        "<button onclick=\"if(window.gmPhase==='offseason'||window.gmPhase==='postseason')beginFreeAgencyPhase();else{if(typeof _toast==='function')_toast('⚠ Free Agency opens after the season',false);}\" style=\"flex:1;min-width:140px;font-size:12px;background:var(--accent-dim);border-color:var(--accent);color:var(--accent2);font-weight:600\">💼 Open Free Agency →</button>" +
        '</div>' +
        '</div>';
    } else {
      userSection = '';
    }

    var html =
      '<h2>🔥 Black Monday</h2>' +
      '<p class="small">Season review complete. Coaching changes have been processed.</p>' +
      userSection +
      '<h3>League-Wide Coaching Changes</h3>' +
      (cpuFired.length
        ? '<table><thead><tr><th>Team</th><th>Departure</th><th>Arrival</th></tr></thead>' +
          '<tbody>' +
          cpuRows +
          '</tbody></table>'
        : '<p class="small" style="color:var(--muted2)">No other coaching changes this offseason.</p>');

    setMainContent(html);
  };

  /* ── User HC hire screen ──────────────────────────────────── */
  window.renderUserCoachHire = function () {
    if (typeof coachFreeAgents === 'undefined') {
      coachFreeAgents = [];
    }
    if (typeof generateCoachFreeAgents === 'function' && coachFreeAgents.length < 5) generateCoachFreeAgents();

    var rows = coachFreeAgents
      .slice()
      .sort(function (a, b) {
        return b.offenseRating + b.defenseRating + b.leadership - (a.offenseRating + a.defenseRating + a.leadership);
      })
      .map(function (c) {
        var ovr = Math.round((c.offenseRating + c.defenseRating + c.leadership) / 3);
        return (
          '<tr>' +
          '<td><strong>' +
          c.name +
          '</strong><br><span style="font-size:10px;color:var(--muted2)">' +
          (c.style || 'Balanced') +
          '</span></td>' +
          '<td style="text-align:center">' +
          c.offenseRating +
          '</td>' +
          '<td style="text-align:center">' +
          c.defenseRating +
          '</td>' +
          '<td style="text-align:center">' +
          c.leadership +
          '</td>' +
          '<td style="text-align:center;font-weight:700;color:var(--accent2)">' +
          ovr +
          '</td>' +
          '<td><button onclick="userHireHC(\'' +
          c.id +
          '\')" ' +
          'style="width:auto;padding:4px 10px;font-size:11px;' +
          'background:var(--accent-dim);border-color:var(--accent);color:var(--accent2)">' +
          'Hire</button></td>' +
          '</tr>'
        );
      })
      .join('');

    setMainContent(
      '<h2>Hire Head Coach</h2>' +
        '<p class="small">Select a new head coach for your franchise.</p>' +
        '<table><thead><tr><th>Name</th><th>Off</th><th>Def</th><th>Lead</th><th>AVG</th><th></th></tr></thead>' +
        '<tbody>' +
        rows +
        '</tbody></table>' +
        (window.gmPhase === 'offseason' || window.gmPhase === 'postseason'
          ? '<button onclick="beginFreeAgencyPhase()" style="margin-top:12px;background:var(--accent-dim);border-color:var(--accent);color:var(--accent2);font-weight:600">Skip → Open Free Agency</button>'
          : '<button onclick="window.renderCoachingHub&&window.renderCoachingHub()" style="margin-top:12px">← Back to Coaching Hub</button>'),
    );
  };

  window.userHireHC = function (coachId) {
    var team = typeof getTeamById === 'function' ? getTeamById(userTeamId) : null;
    if (!team) return;
    var c = coachFreeAgents.find(function (x) {
      return x.id === coachId;
    });
    if (!c) return;

    /* Send old HC to pool */
    if (team.coach && team.coach.name) {
      coachFreeAgents.push({
        id: 'cfa_old_user',
        name: team.coach.name,
        offenseRating: team.coach.offenseRating,
        defenseRating: team.coach.defenseRating,
        leadership: team.coach.leadership,
        style: team.coach.offenseRating >= team.coach.defenseRating ? 'Offensive' : 'Defensive',
      });
    }

    var yrs = randomInt(2, 5);
    team.coach = {
      name: c.name,
      offenseRating: c.offenseRating,
      defenseRating: c.defenseRating,
      leadership: c.leadership,
      jobSecurity: 70,
      contractYears: yrs,
      contractRemaining: yrs,
    };
    coachFreeAgents = coachFreeAgents.filter(function (x) {
      return x.id !== coachId;
    });
    if (typeof logTransaction === 'function')
      logTransaction('Coach Hiring', team.city + ' ' + team.nickname + ' hired ' + c.name, team.id, null);
    if (typeof window.syncPlaybookDropdowns === 'function') window.syncPlaybookDropdowns();

    /* Only advance the offseason pipeline if we're actually in the offseason */
    if (window.gmPhase === 'offseason' || window.gmPhase === 'postseason') {
      beginFreeAgencyPhase();
    } else {
      /* Midseason hire — just return to coaching hub with confirmation */
      if (typeof window.renderCoachingHub === 'function') {
        window.renderCoachingHub();
      }
      if (typeof _toast === 'function') _toast('✅ ' + c.name + ' hired as Head Coach', true);
    }
  };

  /* ── User OC hire screen ─────────────────────────────────── */
  window.renderUserOCHire = function () {
    if (typeof coordinatorFreeAgents === 'undefined') {
      coordinatorFreeAgents = [];
    }
    if (typeof generateCoordinatorFreeAgents === 'function' && coordinatorFreeAgents.length < 5)
      generateCoordinatorFreeAgents();

    var ocs = coordinatorFreeAgents.filter(function (c) {
      return c.type === 'OC';
    });
    var rows = ocs
      .sort(function (a, b) {
        return b.offenseRating - a.offenseRating;
      })
      .map(function (c) {
        return (
          '<tr>' +
          '<td><strong>' +
          c.name +
          '</strong></td>' +
          '<td>' +
          c.scheme +
          '</td>' +
          '<td>' +
          c.offenseRating +
          '</td>' +
          '<td><button onclick="userHireOC(\'' +
          c.id +
          '\')" ' +
          'style="width:auto;padding:4px 10px;font-size:11px">Hire</button></td>' +
          '</tr>'
        );
      })
      .join('');

    setMainContent(
      '<h2>Hire Offensive Coordinator</h2>' +
        '<table><thead><tr><th>Name</th><th>Scheme</th><th>Off Rtg</th><th></th></tr></thead>' +
        '<tbody>' +
        (rows || '<tr><td colspan="4" style="color:var(--muted2)">No OC candidates available</td></tr>') +
        '</tbody></table>' +
        '<button onclick="window.gmPhase===\'offseason\'||window.gmPhase===\'postseason\'?beginBlackMonday():window.renderCoachingHub()" style="margin-top:10px">← Back</button>',
    );
  };

  window.userHireOC = function (coordId) {
    var team = getTeamById(userTeamId);
    if (!team) return;
    var c = coordinatorFreeAgents.find(function (x) {
      return x.id === coordId;
    });
    if (!c) return;
    team.oc = { name: c.name, offenseRating: c.offenseRating, scheme: c.scheme, jobSecurity: 70 };
    coordinatorFreeAgents = coordinatorFreeAgents.filter(function (x) {
      return x.id !== coordId;
    });
    if (typeof logTransaction === 'function')
      logTransaction('OC Hired', team.city + ' hired OC ' + c.name, team.id, null);
    if (typeof window.syncPlaybookDropdowns === 'function') window.syncPlaybookDropdowns();

    /* Never call beginBlackMonday() on a coordinator hire — return to coaching hub */
    if (typeof window.renderCoachingHub === 'function') window.renderCoachingHub();
    if (typeof _toast === 'function') _toast('✅ ' + c.name + ' hired as OC', true);
  };

  /* ── User DC hire screen ─────────────────────────────────── */
  window.renderUserDCHire = function () {
    if (typeof coordinatorFreeAgents === 'undefined') {
      coordinatorFreeAgents = [];
    }
    if (typeof generateCoordinatorFreeAgents === 'function' && coordinatorFreeAgents.length < 5)
      generateCoordinatorFreeAgents();

    var dcs = coordinatorFreeAgents.filter(function (c) {
      return c.type === 'DC';
    });
    var rows = dcs
      .sort(function (a, b) {
        return b.defenseRating - a.defenseRating;
      })
      .map(function (c) {
        return (
          '<tr>' +
          '<td><strong>' +
          c.name +
          '</strong></td>' +
          '<td>' +
          c.scheme +
          '</td>' +
          '<td>' +
          c.defenseRating +
          '</td>' +
          '<td><button onclick="userHireDC(\'' +
          c.id +
          '\')" ' +
          'style="width:auto;padding:4px 10px;font-size:11px">Hire</button></td>' +
          '</tr>'
        );
      })
      .join('');

    setMainContent(
      '<h2>Hire Defensive Coordinator</h2>' +
        '<table><thead><tr><th>Name</th><th>Scheme</th><th>Def Rtg</th><th></th></tr></thead>' +
        '<tbody>' +
        (rows || '<tr><td colspan="4" style="color:var(--muted2)">No DC candidates available</td></tr>') +
        '</tbody></table>' +
        '<button onclick="window.gmPhase===\'offseason\'||window.gmPhase===\'postseason\'?beginBlackMonday():window.renderCoachingHub()" style="margin-top:10px">← Back</button>',
    );
  };

  window.userHireDC = function (coordId) {
    var team = getTeamById(userTeamId);
    if (!team) return;
    var c = coordinatorFreeAgents.find(function (x) {
      return x.id === coordId;
    });
    if (!c) return;
    team.dc = { name: c.name, defenseRating: c.defenseRating, scheme: c.scheme, jobSecurity: 70 };
    coordinatorFreeAgents = coordinatorFreeAgents.filter(function (x) {
      return x.id !== coordId;
    });
    if (typeof logTransaction === 'function')
      logTransaction('DC Hired', team.city + ' hired DC ' + c.name, team.id, null);
    if (typeof window.syncPlaybookDropdowns === 'function') window.syncPlaybookDropdowns();

    /* Never call beginBlackMonday() on a coordinator hire — return to coaching hub */
    if (typeof window.renderCoachingHub === 'function') window.renderCoachingHub();
    if (typeof _toast === 'function') _toast('✅ ' + c.name + ' hired as DC', true);
  };

  /* ── Fix 7: Re-init coordinators after save/load ─────────── */
  var _origDoLoad = window._doLoad;
  window._doLoad = function (slotIdx) {
    if (typeof _origDoLoad === 'function') _origDoLoad(slotIdx);
    setTimeout(function () {
      if (
        typeof league !== 'undefined' &&
        league &&
        typeof listAllTeams === 'function' &&
        typeof initializeCoordinators === 'function'
      ) {
        listAllTeams(league).forEach(function (team) {
          if (!team.oc || !team.dc) initializeCoordinators();
        });
      }
      if (typeof initializeCoachJobSecurity === 'function') initializeCoachJobSecurity();
    }, 200);
  };
})();
