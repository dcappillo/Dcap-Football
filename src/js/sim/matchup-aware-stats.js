/* ============================================================
   MATCHUP-AWARE STAT GENERATION

   Connects four layers to game totals and individual stats:

   TEAM POWER RATING already drives the base totals via strengthMult.
   This patch adds on top of that:

   1. POSITIONAL MATCHUPS — group OVR comparisons adjust totals:
        QB + WR/TE  vs  CB/FS/SS  → pass yards & pass TDs
        RB + OL     vs  DT/LB     → rush yards & rush TDs
        Opp EDGE/DT vs  our OL    → INTs thrown (pressure)
        Our EDGE/DT vs  opp OL    → sacks generated

   2. INDIVIDUAL OVR WEIGHTS — stat splits use each player's OVR
      instead of hardcoded ratios. A 90 OVR WR1 genuinely
      outproduces a 70 OVR WR1 given the same team totals.

   3. SCHEME FIT — each player's scheme fit (0-100) scales their
      OVR weight by 0.80×–1.20×, so players in the wrong scheme
      give up a share of production to better-fitting teammates.

   Flow:
     outermost simulateGame wrapper (this patch)
       → computes group OVRs, stores home/away._matchups on teams
       → calls prior chain (coachingPowerBoost wrapper)
           → original simulateGame
               → patched generateGameTotals (reads _matchups)
               → patched distributeStatsToPlayers (OVR weights)
   ============================================================ */
(function () {
  /* ── Group OVR helper ──────────────────────────────────────
     Average OVR of the top-n healthy starters across positions. */
  function groupOVR(team, positions, n) {
    var players = [];
    positions.forEach(function (pos) {
      (team.roster || []).forEach(function (p) {
        if (
          p.positions[0] === pos &&
          !(p.injury && p.injury.weeksRemaining > 0) &&
          !(p.suspension && p.suspension.weeksRemaining > 0)
        ) {
          players.push(p);
        }
      });
    });
    players.sort(function (a, b) {
      var ra = a.depthChartRank != null ? a.depthChartRank : 999;
      var rb = b.depthChartRank != null ? b.depthChartRank : 999;
      return ra !== rb ? ra - rb : b.attributes.overall - a.attributes.overall;
    });
    var top = players.slice(0, n);
    if (!top.length) return 72;
    return (
      top.reduce(function (s, p) {
        return s + p.attributes.overall;
      }, 0) / top.length
    );
  }

  /* ── Matchup multiplier ────────────────────────────────────
     +10 OVR edge → ×1.08,  -10 OVR → ×0.92.  Capped ±20%. */
  function matchupMult(ourOVR, theirOVR) {
    return Math.max(0.8, Math.min(1.2, 1.0 + (ourOVR - theirOVR) * 0.008));
  }

  /* ── 1. Patch generateGameTotals ──────────────────────────
     Reads team._matchups (set by the simulateGame wrapper)
     and adjusts the raw totals the original function produces. */
  var _origGGT = typeof generateGameTotals !== 'undefined' ? generateGameTotals : null;
  if (_origGGT) {
    window.generateGameTotals = function (team, strengthMult, oppStrengthMult) {
      var totals = _origGGT(team, strengthMult, oppStrengthMult);
      var m = team._matchups;
      if (!m) return totals;

      /* Passing: QB/WR/TE OVR vs opponent CB/FS/SS OVR */
      totals.passYds = Math.max(60, Math.round(totals.passYds * m.passMult));
      totals.passTDs = Math.max(0, Math.min(6, Math.round(totals.passTDs * m.passMult)));

      /* Rushing: RB+OL OVR vs opponent DT/LB OVR */
      totals.rushYds = Math.max(15, Math.round(totals.rushYds * m.rushMult));
      totals.rushTDs = Math.max(0, Math.min(4, Math.round(totals.rushTDs * m.rushMult)));

      /* Pressure: opponent EDGE/DT vs our OL → drives INT rate up */
      totals.intThrown = Math.max(0, Math.min(4, Math.round(totals.intThrown * m.pressureMult)));

      /* Our pass rush vs opponent OL → drives sacks up */
      totals.teamSacks = Math.max(0, Math.min(8, Math.round(totals.teamSacks * m.ourRushMult)));

      /* Keep turnoversCommitted in sync */
      totals.turnoversCommitted = totals.intThrown + (totals.fumbles || 0);

      return totals;
    };
  }

  /* ── 2 & 3. Patch distributeStatsToPlayers ────────────────
     Replaces hardcoded split weights with per-player OVR × scheme-fit.
     The starter selection logic (depth rank, injury check) is unchanged. */
  window.distributeStatsToPlayers = function (team, off, def) {
    var _played = {};

    function markPlayed(players) {
      players.forEach(function (p) {
        if (!_played[p.id]) {
          p.stats.gamesPlayed = (p.stats.gamesPlayed || 0) + 1;
          _played[p.id] = true;
        }
      });
    }

    function playerOut(p) {
      return (p.injury && p.injury.weeksRemaining > 0) || (p.suspension && p.suspension.weeksRemaining > 0);
    }

    function best(pos, n) {
      var pool = (team.roster || [])
        .filter(function (p) {
          return p.positions.indexOf(pos) !== -1;
        })
        .sort(function (a, b) {
          var aOut = playerOut(a) ? 1 : 0,
            bOut = playerOut(b) ? 1 : 0;
          if (aOut !== bOut) return aOut - bOut;
          var ra = a.depthChartRank != null ? a.depthChartRank : 999;
          var rb = b.depthChartRank != null ? b.depthChartRank : 999;
          return ra !== rb ? ra - rb : b.attributes.overall - a.attributes.overall;
        });
      var healthy = pool.filter(function (p) {
        return !playerOut(p);
      });
      var result = healthy.slice(0, n);
      if (result.length < n) {
        var injured = pool.filter(function (p) {
          return playerOut(p);
        });
        for (var i = 0; result.length < n && i < injured.length; i++) result.push(injured[i]);
      }
      return result;
    }

    /* Offensive weight — squared curve so stars dominate:
       70 OVR→1.00, 80 OVR→1.78, 90 OVR→2.67  (vs linear 1.0/1.33/1.67)
       Multiplied by scheme fit: 0→0.80×, 50→1.00×, 100→1.20× */
    function offWeight(p) {
      var ovr = (p.attributes && p.attributes.overall) || 70;
      var base = Math.pow(Math.max(0.3, (ovr - 40) / 30), 2);
      var fit = 50;
      if (typeof calculateSchemeFit === 'function') {
        try {
          fit = calculateSchemeFit(p, team);
        } catch (e) {}
      }
      return base * (0.8 + (Math.max(0, Math.min(100, fit)) / 100) * 0.4);
    }

    /* Defensive weight — power-1.5 curve (used for sacks/ints only)
       70 OVR→1.00, 80 OVR→1.49, 90 OVR→2.05 */
    function defWeight(p) {
      var ovr = (p.attributes && p.attributes.overall) || 70;
      var base = Math.pow(Math.max(0.3, (ovr - 40) / 30), 1.5);
      var fit = 50;
      if (typeof calculateSchemeFit === 'function') {
        try {
          fit = calculateSchemeFit(p, team);
        } catch (e) {}
      }
      return base * (0.8 + (Math.max(0, Math.min(100, fit)) / 100) * 0.4);
    }

    /* Tackle weight — flatter OVR curve (power 1.1) multiplied by a
       position role factor so the position distribution is realistic:
       LBs dominate, then Safeties, then CBs; DL get a small share.
       LB:2.0  SS/FS:1.5  CB:0.9  DT:0.45  EDGE:0.55 */
    function tackleWeight(p) {
      var ovr = (p.attributes && p.attributes.overall) || 70;
      var base = Math.pow(Math.max(0.3, (ovr - 40) / 30), 1.1);
      var pos = p.positions || [];
      var posMult = 0.55;
      if (pos.indexOf('LB') !== -1) {
        var rank = p.depthChartRank || 3;
        var lbMultipliers = [2.0, 1.8, 1.5, 1.0, 0.6];
        posMult = lbMultipliers[Math.min(rank - 1, 4)];
      } else if (pos.indexOf('SS') !== -1) posMult = 1.5;
      else if (pos.indexOf('FS') !== -1) posMult = 1.5;
      else if (pos.indexOf('CB') !== -1) posMult = 0.9;
      else if (pos.indexOf('DT') !== -1) posMult = 0.45;
      return base * posMult;
    }

    function wtsOff(players) {
      return players.map(offWeight);
    }
    function wtsDef(players) {
      return players.map(defWeight);
    }
    function wtsTackle(players) {
      return players.map(tackleWeight);
    }

    function split(players, total, key, wFn) {
      if (!players.length || total <= 0) return;
      wFn = wFn || wtsOff;
      var w = wFn(players);
      var sumW = w.reduce(function (a, b) {
        return a + b;
      }, 0);
      var rem = total;
      players.forEach(function (p, i) {
        if (rem <= 0) return;
        var share =
          i === players.length - 1
            ? Math.min(rem, Math.round(((total * w[i]) / sumW) * 1.15))
            : Math.min(rem, Math.max(0, Math.round(((total * w[i]) / sumW) * (0.85 + Math.random() * 0.3))));
        p.stats[key] = (p.stats[key] || 0) + share;
        rem -= share;
      });
    }

    function lottery(players, total, key, wFn) {
      if (!players.length || total <= 0) return;
      wFn = wFn || wtsOff;
      var w = wFn(players);
      var sumW = w.reduce(function (a, b) {
        return a + b;
      }, 0);
      for (var n = 0; n < total; n++) {
        var r = Math.random() * sumW,
          cum = 0;
        for (var j = 0; j < players.length; j++) {
          cum += w[j];
          if (r <= cum) {
            players[j].stats[key] = (players[j].stats[key] || 0) + 1;
            break;
          }
        }
      }
    }

    /* ── QB ── */
    var qbs = best('QB', 1);
    markPlayed(qbs);
    var qb = qbs[0];
    if (qb) {
      qb.stats.passingYards = (qb.stats.passingYards || 0) + off.passYds;
      qb.stats.passingTD = (qb.stats.passingTD || 0) + off.passTDs;
      qb.stats.interceptionsThrown = (qb.stats.interceptionsThrown || 0) + off.intThrown;
      qb.stats.rushingYards = (qb.stats.rushingYards || 0) + randomInt(0, 30);
      if (Math.random() < 0.07) qb.stats.rushingTD = (qb.stats.rushingTD || 0) + 1;
    }

    /* ── Receiving — OVR² weighted (stars dominate) ── */
    var wrs = best('WR', 4);
    var tes = best('TE', 2);
    var rbR = best('RB', 1);
    var seen = {};
    var recGrp = wrs
      .concat(tes)
      .concat(rbR)
      .filter(function (p) {
        if (seen[p.id]) return false;
        seen[p.id] = true;
        return true;
      });
    markPlayed(recGrp);
    split(recGrp, off.passYds, 'receivingYards', wtsOff);
    lottery(recGrp, off.passTDs, 'receivingTD', wtsOff);

    /* ── Rushing — OVR² weighted ── */
    var rbs = best('RB', 3);
    markPlayed(rbs);
    split(rbs, off.rushYds, 'rushingYards', wtsOff);
    lottery(rbs, off.rushTDs, 'rushingTD', wtsOff);

    /* ── OL — mark played only ── */
    markPlayed(best('T', 2));
    markPlayed(best('G', 2));
    markPlayed(best('C', 1));

    /* ── Defense — extended pools so backups get real reps ──
       Starters + depth players all see the field; OVR^1.5 weights
       mean starters lead but backups accumulate realistic totals. */
    var lbs = best('LB', 5); /* 3 starters + 2 depth */
    var safes = best('SS', 2).concat(best('FS', 2)); /* starter + backup each */
    var cbs = best('CB', 5); /* 3 starters + 2 nickel/depth */
    var dts = best('DT', 4); /* 2 starters + 2 depth */
    var edges = best('EDGE', 3); /* 2 starters + 1 rotational */
    var defAll = lbs.concat(safes).concat(cbs).concat(dts).concat(edges);
    markPlayed(defAll);
    split(defAll, def.teamTackles, 'tackles', wtsTackle);
    lottery(edges.concat(dts).concat(lbs.slice(0, 1)), def.teamSacks, 'sacks', wtsDef);
    lottery(cbs.concat(safes), def.defInts, 'interceptions', wtsDef);

    /* ── Kicker ── */
    var k = best('K', 1)[0];
    if (k && !_played[k.id]) {
      k.stats.gamesPlayed = (k.stats.gamesPlayed || 0) + 1;
      _played[k.id] = true;
    }
    if (k) {
      k.stats.fieldGoalsMade = (k.stats.fieldGoalsMade || 0) + off.fgMade;
      k.stats.fieldGoalsMissed = (k.stats.fieldGoalsMissed || 0) + (off.fgAtt - off.fgMade);
      k.stats.xpMade = (k.stats.xpMade || 0) + (off.xpMade || 0);
      k.stats.xpMissed = (k.stats.xpMissed || 0) + (off.xpMissed || 0);
    }
    markPlayed(best('P', 1));
  };

  /* ── 4. Outermost simulateGame wrapper ─────────────────────
     Computes positional group OVRs for both teams, stores them
     as _matchups on each team before the sim chain runs, then
     cleans up. The chain eventually calls the original
     simulateGame which now uses the two patched functions above. */
  var _prevSG = window.simulateGame;
  window.simulateGame = function (game, tMap, userStrategy, uid) {
    var home = tMap && game ? tMap[game.homeTeamId] : null;
    var away = tMap && game ? tMap[game.awayTeamId] : null;

    if (home && away) {
      /* ── Gather group OVRs ── */
      var hQB = groupOVR(home, ['QB'], 1);
      var hRec = groupOVR(home, ['WR', 'TE'], 3);
      var hRB = groupOVR(home, ['RB'], 2);
      var hOL = groupOVR(home, ['T', 'G', 'C'], 5);
      var hDB = groupOVR(home, ['CB', 'FS', 'SS'], 4);
      var hEDG = groupOVR(home, ['EDGE'], 2);
      var hDL = groupOVR(home, ['DT', 'LB'], 4);

      var aQB = groupOVR(away, ['QB'], 1);
      var aRec = groupOVR(away, ['WR', 'TE'], 3);
      var aRB = groupOVR(away, ['RB'], 2);
      var aOL = groupOVR(away, ['T', 'G', 'C'], 5);
      var aDB = groupOVR(away, ['CB', 'FS', 'SS'], 4);
      var aEDG = groupOVR(away, ['EDGE'], 2);
      var aDL = groupOVR(away, ['DT', 'LB'], 4);

      /* Blended offense groups */
      var hPassOff = hQB * 0.5 + hRec * 0.5; /* home passing offense  */
      var aPassOff = aQB * 0.5 + aRec * 0.5; /* away passing offense  */
      var hRushOff = hOL * 0.6 + hRB * 0.4; /* home run game         */
      var aRushOff = aOL * 0.6 + aRB * 0.4; /* away run game         */

      /* Blended pass-rush groups (EDGE leads, DL supports) */
      var hPassRush = hEDG * 0.7 + hDL * 0.3;
      var aPassRush = aEDG * 0.7 + aDL * 0.3;

      /* HOME team matchups (home offense vs away defense, and vice-versa) */
      home._matchups = {
        passMult: matchupMult(hPassOff, aDB) /* home WR/TE vs away CBs/Ss  */,
        rushMult: matchupMult(hRushOff, aDL) /* home RB/OL vs away DL/LB   */,
        pressureMult: matchupMult(aPassRush, hOL) /* away pass rush vs home OL  → home INTs */,
        ourRushMult: matchupMult(hPassRush, aOL) /* home pass rush vs away OL  → home sacks */,
      };

      /* AWAY team matchups */
      away._matchups = {
        passMult: matchupMult(aPassOff, hDB),
        rushMult: matchupMult(aRushOff, hDL),
        pressureMult: matchupMult(hPassRush, aOL) /* home pass rush vs away OL  → away INTs */,
        ourRushMult: matchupMult(aPassRush, hOL) /* away pass rush vs home OL  → away sacks */,
      };
    }

    try {
      if (typeof _prevSG === 'function') _prevSG(game, tMap, userStrategy, uid);
    } finally {
      if (home) delete home._matchups;
      if (away) delete away._matchups;
    }
  };
})();
