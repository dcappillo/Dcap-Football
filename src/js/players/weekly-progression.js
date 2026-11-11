/* ============================================================
   COMPREHENSIVE PLAYER PROGRESSION (FULL REWRITE)

   Changes from previous version:
   • Minimum baseline progression for ALL players every week
     (even bench warmers learn in practice)
   • Baseline scaled by age + dev trait (not just performance)
   • Performance bonus is ADDITIVE on top of baseline
   • RB scoring: lower yard threshold, higher TD weight
   • CB/S scoring: tackles now major contributor, not just INTs
   • OL scoring: based on games started, not runaway numbers
   • Floor fix: only blocks DROPS below seasonStartOVR,
     never blocks gains (previous logic would zero out +1
     if player ever dipped below their start OVR)
   • Dev trait multiplier on baseline AND performance
   ============================================================ */
(function () {
  /* ── Dev trait multiplier ─────────────────────────────── */
  function devMult(p) {
    var t = p.devTrait || 'Normal';
    return t === 'X-Factor' ? 2.0 : t === 'Superstar' ? 1.6 : t === 'Star' ? 1.3 : 1.0;
  }
  /* Expose globally so other script blocks can call it */
  window.devMult = devMult;

  /* ── OVR-relative gain multiplier ────────────────────────
     Lower OVR players benefit more from the same performance.
     OVR 60→1.67× | OVR 70→1.33× | OVR 80→1.0×
     OVR 85→0.83× | OVR 90→0.67× | OVR 95→0.50×           */
  function ovrGainMult(ovr) {
    return Math.max(0.15, Math.min(2.5, 1.0 + (80 - ovr) / 30));
  }

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

  /* ── Weekly progression — accumulator model ──────────────
     Every player has a devAccum bucket that fills each week.
     When it reaches 1.0 they gain +1 OVR. Remainder carries
     over so no week is ever wasted.

     Layer 1 — GUARANTEED baseline (deterministic, no RNG):
       Each week adds a fixed amount to devAccum.
       Young players fill the bucket in ≤17 weeks guaranteed.
       Calibrated so age ≤23 Normal always gets at least +1.

     Layer 2 — Performance bonus (additive on top of baseline,
       scales with game quality, still uses ovrGainMult so
       high-OVR stars develop slower than raw prospects).

     Layer 3 — Age regression (subtracts from the bucket for
       vets; can drive OVR below season floor for 30+).      */
  function progressTeamWeek(team) {
    team.roster.forEach(function (p) {
      var s = p.stats || {};
      var age = p.age;
      var ovr = p.attributes.overall;
      var dm = devMult(p);
      var gm = ovrGainMult(ovr);
      var floor = p.seasonStartOVR !== undefined ? p.seasonStartOVR : ovr;

      /* Init accumulator */
      if (p.devAccum === undefined) p.devAccum = 0;

      /* ── Layer 1: Guaranteed baseline (no RNG) ──────────
         baseRate × dm × 17 weeks = minimum OVR gain per season:
           age ≤23  Normal   0.280 × 1.0 × 17 = 4.76 → +4 guaranteed
           age ≤23  Star     0.280 × 1.3 × 17 = 6.19 → +6 guaranteed
           age ≤23  Superstar 0.280 × 1.6 × 17= 7.62 → +7 guaranteed
           age ≤23  X-Factor  0.280 × 2.0 × 17= 9.52 → +9 guaranteed
           age ≤25  Normal   0.240 × 1.0 × 17 = 4.08 → +4 guaranteed
           age ≤25  Star     0.240 × 1.3 × 17 = 5.30 → +5 guaranteed
           age ≤27  Normal   0.140 × 1.0 × 17 = 2.38 → +2 guaranteed
           age ≤29  Normal   0.048 × 1.0 × 17 = 0.82 → needs perf
           age 30+  → 0, performance only
         ovrGainMult NOT applied to baseline: high-OVR players
         get the same minimum guarantee as raw prospects.       */
      var baseRate = 0;
      if (age <= 23) baseRate = 0.28;
      else if (age <= 25) baseRate = 0.24;
      else if (age <= 27) baseRate = 0.14;
      else if (age <= 29) baseRate = 0.048;
      /* 30+ → 0 */

      p.devAccum += baseRate * dm;

      /* ── Layer 2: Performance bonus (uses ovrGainMult) ────
         Starters who play well add more to the bucket.
         Bench players only get baseline above.               */
      if (s.gamesPlayed && s.gamesPlayed > 0) {
        var perf = weeklyPerfScore(p);
        var bonus = 0;
        if (perf >= 1.2) bonus = 0.13;
        else if (perf >= 0.6) bonus = 0.055;
        else if (perf >= 0.3) bonus = 0.015;
        p.devAccum += bonus * dm * gm;
      }

      /* ── Layer 3: Age regression (subtracts from bucket) ──
         Vets drain the bucket weekly; heavy enough drain means
         they lose a point despite any baseline they had.      */
      var regRate = 0;
      if (age >= 36) regRate = 0.25;
      else if (age >= 33) regRate = 0.15;
      else if (age >= 30) regRate = 0.07;

      if (regRate > 0) {
        /* Elite play partially offsets regression */
        if (s.gamesPlayed > 0 && weeklyPerfScore(p) >= 1.2) regRate *= 0.55;
        p.devAccum -= regRate;
      }

      /* ── Apply accumulator ────────────────────────────────
         Gain: when bucket ≥ 1.0, award +1 and subtract 1.0
           (carry over remainder — no wasted accumulation).
         Loss: when bucket ≤ -1.0, apply -1 and add 1.0.
         Floor: young/prime players (age ≤29) cannot drop
           below their season-start OVR from regression alone. */
      var delta = 0;

      while (p.devAccum >= 1.0) {
        delta++;
        p.devAccum -= 1.0;
      }

      while (p.devAccum <= -1.0) {
        var drop = -1;
        /* Enforce floor for young players */
        if (age <= 29 && ovr + delta + drop < floor) {
          drop = 0;
          p.devAccum = -0.99;
        }
        delta += drop;
        p.devAccum += 1.0;
      }

      if (delta !== 0) {
        var newOvr = Math.max(40, Math.min(99, ovr + delta));
        p.attributes.overall = newOvr;

        /* ── Keep granularAttrs in sync with OVR drift ───────
           When OVR rises or falls, nudge every granular attr by
           the same delta so the two don't permanently diverge.
           We only move attrs that are in the player's primary
           position bias (bias > 0.5) to preserve position
           identity — secondary attrs stay unchanged.           */
        if (p.granularAttrs && window.POS_BIAS && p.positions && p.positions[0]) {
          var bias = window.POS_BIAS[p.positions[0]] || {};
          var gAttrs = p.granularAttrs;
          Object.keys(gAttrs).forEach(function (k) {
            var b = bias[k] !== undefined ? bias[k] : 0;
            if (b >= 0.5) {
              gAttrs[k] = Math.max(20, Math.min(99, gAttrs[k] + delta));
            }
          });
        }
      }
    });
  }

  /* ── Wrap simulateWeek ──────────────────────────────────── */
  var _origSW = window.simulateWeek;
  window.simulateWeek = function (week, teamMap, userStrategy, userTeamId) {
    if (typeof _origSW === 'function') _origSW(week, teamMap, userStrategy, userTeamId);
    if (typeof league !== 'undefined' && league && typeof listAllTeams === 'function') {
      listAllTeams(league).forEach(function (team) {
        progressTeamWeek(team);
      });
    }
  };
})();
