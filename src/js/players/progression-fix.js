/* ============================================================
   PROGRESSION / REGRESSION BUG FIX

   Root cause 1 — initGranularAttrs overwrites player.attributes.overall
   ─────────────────────────────────────────────────────────────────────
   When a player's granular attributes are generated for the first time
   (at page load or new-game start), calcPosOVR() is called and the
   result is written back to player.attributes.overall.  Because the
   granular attrs are generated with a random spread, calcPosOVR rarely
   returns exactly the same number as the original OVR.  The player
   therefore appears to gain or lose rating points before a single game
   has been simulated.

   Fix: wrap window.initGranularAttrs so the original OVR is preserved
   after the first-time generation.  OVR is still recalculated by
   applyPositionChange() when the user explicitly changes a position.

   Root cause 2 — age regression fires even when gamesPlayed = 0
   ─────────────────────────────────────────────────────────────
   progressTeamWeek() applies age regression (−1 OVR chance for
   players aged 30+) on every call to simulateWeek().  For backups
   or players on bye, gamesPlayed may still be 0 when the function
   runs, meaning they can regress without ever seeing the field.

   Fix: wrap simulateWeek to skip age regression for any player whose
   gamesPlayed hasn't increased since the last call.  We do this by
   patching progressTeamWeek to gate the regression roll on whether
   the player has played at least 1 game in the season.
   ============================================================ */
(function () {
  /* ── Fix 1: preserve OVR through initGranularAttrs ────────── */

  var _origIGA = window.initGranularAttrs;
  window.initGranularAttrs = function (player) {
    /* If granularAttrs already exist, just return them — no change */
    if (player.granularAttrs) return player.granularAttrs;

    /* Save the current OVR before generation overwrites it */
    var savedOVR = player.attributes ? player.attributes.overall : undefined;

    var g = _origIGA(player); /* generates granular attrs + recalcs OVR */

    /* Restore original OVR — granular generation must not move the needle.
       OVR is intentionally recalculated ONLY when the user explicitly
       changes position via applyPositionChange().                         */
    if (savedOVR !== undefined && player.attributes) {
      player.attributes.overall = savedOVR;
    }

    return g;
  };

  /* ── Fix 2: gate age regression on gamesPlayed > 0 ────────── */

  /* We intercept the outer simulateWeek wrapper and, after the week
     runs, scan every team for players whose gamesPlayed is still 0 and
     undo any OVR drop that the progression logic may have applied.
     This is a safety-net approach: it works regardless of how many
     layers wrap simulateWeek.                                           */

  var _origSW2 = window.simulateWeek;
  window.simulateWeek = function (week, teamMap, userStrategy, uid) {
    /* Snapshot OVR for every player with gamesPlayed = 0 BEFORE the sim */
    var snapshots = {};
    if (typeof league !== 'undefined' && league && typeof listAllTeams === 'function') {
      listAllTeams(league).forEach(function (team) {
        team.roster.forEach(function (p) {
          if (!p.stats || !p.stats.gamesPlayed) {
            /* Player hasn't played yet — freeze their OVR */
            snapshots[p.id] = p.attributes ? p.attributes.overall : null;
          }
        });
      });
    }

    /* Run the real simulateWeek (which includes stats + progression) */
    if (typeof _origSW2 === 'function') _origSW2(week, teamMap, userStrategy, uid);

    /* After the sim: restore OVR for players who STILL haven't played */
    if (typeof league !== 'undefined' && league && typeof listAllTeams === 'function') {
      listAllTeams(league).forEach(function (team) {
        team.roster.forEach(function (p) {
          if (
            snapshots[p.id] !== undefined &&
            snapshots[p.id] !== null &&
            (!p.stats || !p.stats.gamesPlayed) &&
            p.attributes
          ) {
            /* Still 0 games — undo any regression the progression applied */
            p.attributes.overall = snapshots[p.id];
          }
        });
      });
    }
  };
})();
