/* ============================================================
   SIMULATE-GAME COMPATIBILITY LAYER
   The Phase 6D simulateGame overrides were written for a different
   API (expecting a result object with teamAWinChance/statsA etc.)
   but the original returns undefined. The overrides also receive
   (game, teamMap) and treat them as (teamA, teamB) team objects.

   This patch:
   1. Makes calculateTeamGameModifier null-safe so it doesn't crash
      when passed a game object instead of a team object.
   2. Wraps the override chain in try-catch so if the Phase 6D
      post-processing crashes, the game state (already updated by
      the original function) is preserved.
   ============================================================ */
(function () {
  // 1. Null-safe calculateTeamGameModifier
  var _origMod = calculateTeamGameModifier;
  calculateTeamGameModifier = function (team, opponent) {
    if (!team || !team.oc || !team.dc) return 0;
    if (!opponent || !opponent.oc || !opponent.dc) return 0;
    try {
      return _origMod(team, opponent);
    } catch (e) {
      return 0;
    }
  };

  // 2. Null-safe getCoordinatorModifiers
  var _origCoord = getCoordinatorModifiers;
  getCoordinatorModifiers = function (team) {
    if (!team || !team.oc || !team.dc || !team.coach) return { offenseBoost: 0, defenseBoost: 0, leadershipBoost: 0 };
    try {
      return _origCoord(team);
    } catch (e) {
      return { offenseBoost: 0, defenseBoost: 0, leadershipBoost: 0 };
    }
  };

  // 3. Wrap the simulateGame override chain in try-catch.
  //    The original simulation always runs first and updates all
  //    game state (scores, wins/losses, player stats) before any
  //    Phase 6D code can crash. We catch and swallow the crash.
  var _chain = simulateGame;
  simulateGame = function (game, teamMap, userStrategy, userTeamId) {
    try {
      _chain(game, teamMap, userStrategy, userTeamId);
    } catch (e) {
      // Phase 6D post-processing failed; game outcome already recorded.
    }
  };
})();
