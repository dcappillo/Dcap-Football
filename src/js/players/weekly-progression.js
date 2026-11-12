/* ============================================================
   WEEKLY PLAYER GROWTH

   After every simulated week, each player under his Potential
   grows a little. How much depends on:
     • age          — young players grow fastest (seasonGrowthForAge)
     • dev trait    — Star 1.3×, Superstar 1.6×, X-Factor 2×
     • room to grow — growth slows over the last 5 points below
                      Potential and stops at it
     • elite zone   — growth slows to 75% at 90+ overall
     • playing time — players who didn't play this week grow at half speed
     • performance  — strong weekly production adds a bonus

   Players never decline during the season; aging is applied once
   at the end of the season (see players/potential.js).
   ============================================================ */
(function () {
  /* ── Dev trait multiplier ─────────────────────────────── */
  function devMult(p) {
    var t = p.devTrait || 'Normal';
    return t === 'X-Factor' ? 2.0 : t === 'Superstar' ? 1.6 : t === 'Star' ? 1.3 : 1.0;
  }
  /* Expose globally so other script blocks can call it */
  window.devMult = devMult;

  /* ── Position-aware performance score (per-game average) ─
     All scores calibrated so:
       "elite" starter = ~1.2+   (good perf bonus)
       "good"  starter = ~0.60+  (modest perf bonus)
       "poor"  / bench = < 0.30  (no perf bonus)           */
  function weeklyPerfScore(p) {
    var s = p.stats || {};
    var gp = Math.max(1, s.gamesPlayed || 1);
    var pos = p.positions[0];

    switch (pos) {
      case 'QB':
        /* Elite: 280+ yards/gm AND 2+ TDs/gm, clean */
        return (
          (s.passingYards || 0) / gp / 200 +
          ((s.passingTD || 0) / gp) * 0.65 -
          ((s.interceptionsThrown || 0) / gp) * 0.45 +
          (s.rushingYards || 0) / gp / 500
        );

      case 'RB':
        /* Elite: 90+ yards/gm OR 1+ TD/gm               */
        /* 100 yds/gm = 1.43, 1 TD/gm = 0.85 → combined = 2.28 */
        return (s.rushingYards || 0) / gp / 70 + ((s.rushingTD || 0) / gp) * 0.85 + (s.receivingYards || 0) / gp / 200;

      case 'WR':
        /* Elite: 80+ yds/gm or 1 TD/gm                  */
        return (s.receivingYards || 0) / gp / 65 + ((s.receivingTD || 0) / gp) * 0.8;

      case 'TE':
        /* Elite: 60+ yds/gm or 1 TD/gm                  */
        return (s.receivingYards || 0) / gp / 60 + ((s.receivingTD || 0) / gp) * 0.75;

      case 'T':
      case 'G':
      case 'C':
        /* OL: rewarded for consistent starts, capped at 1.4 */
        return Math.min(1.4, ((s.gamesPlayed || 0) / 17) * 1.6);

      case 'EDGE':
        /* Elite: 1 sack/gm OR strong tackle total        */
        return ((s.sacks || 0) / gp) * 1.2 + (s.tackles || 0) / gp / 10;

      case 'DT':
        /* Elite: 0.7 sacks/gm or strong tackle numbers  */
        return ((s.sacks || 0) / gp) * 0.9 + (s.tackles || 0) / gp / 10;

      case 'LB':
        /* Elite: 10 tackles/gm or sacks + INTs           */
        return (s.tackles || 0) / gp / 8 + ((s.sacks || 0) / gp) * 0.7 + ((s.interceptions || 0) / gp) * 1.2;

      case 'CB':
        /* DBs score well for tackles AND interceptions.
           Previously almost never hit elite since INTs are rare.
           Now: 7 tackles/gm = 0.88 (good), 1 INT/gm = 1.5 (elite) */
        return ((s.interceptions || 0) / gp) * 1.5 + (s.tackles || 0) / gp / 8;

      case 'FS':
        /* Free safety: range, coverage, turnovers */
        return ((s.interceptions || 0) / gp) * 1.4 + (s.tackles || 0) / gp / 9;

      case 'SS':
        /* Strong safety: tackling, run support, blitz */
        return ((s.interceptions || 0) / gp) * 1.0 + (s.tackles || 0) / gp / 7;

      case 'K':
        return (
          ((s.fieldGoalsMade || 0) / gp) * 0.45 -
          ((s.fieldGoalsMissed || 0) / gp) * 0.3 +
          ((s.xpMade || 0) / gp) * 0.1 -
          ((s.xpMissed || 0) / gp) * 0.15
        );

      default:
        return (s.gamesPlayed || 0) > 0 ? 0.15 : 0;
    }
  }

  window.weeklyPerfScore = weeklyPerfScore;

  var WEEKS_PER_SEASON = 17;

  /* Growth accumulates in p.devAccum; each full 1.0 becomes +1 overall. */
  function progressPlayerWeek(p) {
    ensurePotential(p);
    var s = p.stats || {};
    var room = p.potential - p.attributes.overall;

    /* Did he play this week? (gamesPlayed is season-to-date and resets each season) */
    if ((s.gamesPlayed || 0) < (p._gpSeen || 0)) p._gpSeen = 0;
    var played = (s.gamesPlayed || 0) > (p._gpSeen || 0);
    p._gpSeen = s.gamesPlayed || 0;

    if (room <= 0) {
      p.devAccum = 0;
      return;
    }

    var roomFactor = Math.min(1, room / 5);
    /* The last steps to elite are the hardest */
    var eliteFactor = p.attributes.overall >= 90 ? 0.75 : 1;
    var dm = devMult(p);
    var gain = (seasonGrowthForAge(p.age) / WEEKS_PER_SEASON) * (played ? 1 : 0.5);

    if (played) {
      var perf = weeklyPerfScore(p);
      if (perf >= 1.2) gain += 0.1;
      else if (perf >= 0.6) gain += 0.05;
      else if (perf >= 0.3) gain += 0.02;
    }

    p.devAccum = (p.devAccum || 0) + gain * dm * roomFactor * eliteFactor;

    var delta = 0;
    while (p.devAccum >= 1 && delta < room) {
      delta++;
      p.devAccum -= 1;
    }
    shiftOverall(p, delta);
  }

  var _origSW = window.simulateWeek;
  window.simulateWeek = function (week, teamMap, userStrategy, userTeamId) {
    if (typeof _origSW === 'function') _origSW(week, teamMap, userStrategy, userTeamId);
    listAllTeams(league).forEach(function (team) {
      team.roster.forEach(progressPlayerWeek);
    });
  };
})();
