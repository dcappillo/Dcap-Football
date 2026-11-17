/* ============================================================
   SCHEME MATCHUP ACTUALLY APPLIED TO GAME OUTCOMES

   Problems fixed:
   1. Old Phase 6D hook calculated modifiers then tried to apply
      them to result.teamAWinChance which never exists — modifiers
      were calculated and immediately discarded.

   2. calculateTeamGameModifier used only the coordinator's
      scheme, not the playbook the user selected this week.

   3. Scheme matchup is now wired directly into coachingPowerBoost
      (the function that correctly applies to power ratings) using
      the user's actual weekly playbook selection.
   ============================================================ */
(function () {
  /* ── Full scheme matchup matrix (offense vs defense) ─────
     Positive = offense advantage, negative = defense advantage.
     Values are power rating points (scale: teams are 70-85).  */
  var SCHEME_MATRIX = {
    'Air Raid': {
      '4-3': +5 /* 4-3 is susceptible to spread passing */,
      '3-4': +2 /* decent vs Air Raid but beatable       */,
      'Cover 2': -5 /* Cover 2 designed to stop passing      */,
      'Blitz Heavy': -6 /* blitz disrupts QB rhythm               */,
    },
    'West Coast': {
      '4-3': +2 /* WC exploits 4-3 underneath zones      */,
      '3-4': -2 /* 3-4 OLBs pressure WC timing           */,
      'Cover 2': +5 /* WC attacks the Cover 2 seam perfectly  */,
      'Blitz Heavy': -4 /* blitz kills timing routes              */,
    },
    Spread: {
      '4-3': +4 /* Spread creates mismatches vs 4-3      */,
      '3-4': +1 /* slight advantage                      */,
      'Cover 2': -3 /* Cover 2 handles spread ok             */,
      'Blitz Heavy': -5 /* Spread QB needs time to read          */,
    },
    'Power Run': {
      '4-3': -2 /* 4-3 stacks box well                   */,
      '3-4': +7 /* Power Run gashes 3-4 gaps at LB level */,
      'Cover 2': +1 /* Cover 2 is vulnerable to runs         */,
      'Blitz Heavy': -1 /* blitz can disrupt run blocking         */,
    },
  };

  /* ── Defensive style vs offensive playbook counter-matrix ──
     The user's defensive style choice also matters.
     "Defend Run" is stronger vs Power Run, weaker vs passing etc. */
  var DEF_STYLE_VS_OFF = {
    'Defend Run': {
      'Power Run': +3 /* specifically prepared for runs */,
      'Air Raid': -2 /* light box = vulnerable to pass */,
      Spread: -1,
      'West Coast': -1,
    },
    'Defend Pass': {
      'Air Raid': +3 /* extra DBs vs passing           */,
      'West Coast': +3,
      Spread: +2,
      'Power Run': -3 /* light box struggles vs runs    */,
    },
    'Blitz Heavy': {
      'Air Raid': -4 /* quick passes beat blitz        */,
      'West Coast': -3 /* timing routes beat blitz       */,
      Spread: -2 /* Spread QB can audible out      */,
      'Power Run': +2 /* blitz in backfield disrupts RB */,
    },
    Balanced: { 'Air Raid': 0, 'West Coast': 0, Spread: 0, 'Power Run': 0 },
  };

  /* ── Override coachingPowerBoost to include scheme matchup ─── */
  window.coachingPowerBoost = function (team, opponent) {
    var oc = typeof safeOC === 'function' ? safeOC(team) : team.oc || { offenseRating: 70 };
    var dc = typeof safeDC === 'function' ? safeDC(team) : team.dc || { defenseRating: 70 };
    var coach = typeof safeCoach === 'function' ? safeCoach(team) : team.coach || { leadership: 70 };

    var chem = typeof getTeamChemistryOVRModifier === 'function' ? getTeamChemistryOVRModifier(team) : 0;

    /* Coordinator quality boosts */
    var offBoost = Math.floor((oc.offenseRating - 75) / 4);
    var defBoost = Math.floor((dc.defenseRating - 75) / 4);
    var leadBoost = Math.floor((coach.leadership - 75) / 6);

    /* Scheme fit: average roster fit vs coordinator scheme */
    var fitScore = 0;
    if (team.roster && team.roster.length && typeof calculateSchemeFit === 'function') {
      var sample = team.roster.slice(0, 22);
      fitScore = Math.floor(
        sample.reduce(function (s, p) {
          return s + calculateSchemeFit(p, team);
        }, 0) /
          sample.length /
          20 -
          2.5,
      );
    }

    var total = offBoost + defBoost + leadBoost + fitScore + chem;

    /* ── Scheme matchup vs opponent ──────────────────────────
       Use the playbook the team actually selected this week,
       falling back to the coordinator's scheme if not set.    */
    if (opponent) {
      var offPlaybook = team._offPlaybook || oc.scheme || 'Spread';
      var defPlaybook = team._defPlaybook || dc.scheme || '4-3';
      var oppOffPB = opponent._offPlaybook || (opponent.oc ? opponent.oc.scheme : 'Spread') || 'Spread';
      var defStyle = team._defStyle || 'Balanced';

      /* 1. Our offense vs their defense scheme */
      var oppDefPB = opponent._defPlaybook || (opponent.dc ? opponent.dc.scheme : '4-3') || '4-3';
      var offMatrix = SCHEME_MATRIX[offPlaybook];
      var offVsDef = offMatrix ? offMatrix[oppDefPB] || 0 : 0;

      /* 2. Our defense vs their offense scheme */
      var defMatrix = SCHEME_MATRIX[oppOffPB];
      var theirOff = defMatrix ? defMatrix[defPlaybook] || 0 : 0;
      var defVsOff = -theirOff; /* flip: positive = our defense wins the matchup */

      /* 3. Our defensive style vs their offensive playbook */
      var styleMatrix = DEF_STYLE_VS_OFF[defStyle] || {};
      var styleBonus = styleMatrix[oppOffPB] || 0;

      total += offVsDef + defVsOff + styleBonus;
    }

    return total;
  };

  /* not re-wrapping simulateGame directly */

  /* Instead, patch applyStrategyModifier to store playbook on team */
  var _origASM = window.applyStrategyModifier || applyStrategyModifier;
  window.applyStrategyModifier = function (base, strat, team) {
    if (team && strat) {
      team._offPlaybook = strat.offPlaybook || strat.offensivePlaybook || null;
      team._defPlaybook = strat.defPlaybook || strat.defensivePlaybook || null;
      team._defStyle = strat.defensiveStyle || strat.defStyle || 'Balanced';
    }
    return typeof _origASM === 'function' ? _origASM(base, strat, team) : base;
  };

  /* ── Also patch the coachingPowerBoost call inside simulateGame
     to pass the opponent object so the matchup can be calculated.
     The existing patch already calls coachingPowerBoost(home/away)
     without the opponent — patch it to pass both.               */
  var _origCPBWrap = window.simulateGame;
  window.simulateGame = function (game, teamMap, userStrategy, uid) {
    /* Apply strategy modifiers to store playbook onto teams BEFORE sim */
    if (game && teamMap) {
      var h = teamMap[game.homeTeamId];
      var a = teamMap[game.awayTeamId];
      if (h && a) {
        /* Temporarily boost with opponent-aware coaching modifier */
        var hBoost = window.coachingPowerBoost(h, a);
        var aBoost = window.coachingPowerBoost(a, h);
        h.powerRating += hBoost;
        a.powerRating += aBoost;
        try {
          /* Call the chain BELOW this wrapper (the original sim) */
          if (typeof _origCPBWrap === 'function') _origCPBWrap(game, teamMap, userStrategy, uid);
        } finally {
          h.powerRating -= hBoost;
          a.powerRating -= aBoost;
        }
        return;
      }
    }
    if (typeof _origCPBWrap === 'function') _origCPBWrap(game, teamMap, userStrategy, uid);
  };
})();
