/* ============================================================
   COACH DEVELOPMENT (PERFORMANCE-BASED GROWTH)
   ============================================================ */

/* ------------------------------------------------------------
   Hook coach growth into game simulation
------------------------------------------------------------ */

const oldSimulateGameWithCoaches = simulateGame;

simulateGame = function (game, tMap, userStrat, uid) {
  const result = oldSimulateGameWithCoaches(game, tMap, userStrat, uid);
  if (!result) return result;

  // Resolve team objects from the game/teamMap args
  var tMapRef = tMap || (typeof teamMap !== 'undefined' ? teamMap : {});
  var teamA = game && tMapRef ? tMapRef[game.homeTeamId] : null;
  var teamB = game && tMapRef ? tMapRef[game.awayTeamId] : null;
  if (!teamA || !teamB) return result;

  // Develop coaches for Team A
  if (result.statsA) {
    developOC(teamA, result.statsA);
    developDC(teamA, result.statsA);
    developHeadCoach(teamA, result.statsA, result.teamAWon);
  }

  // Develop coaches for Team B
  if (result.statsB) {
    developOC(teamB, result.statsB);
    developDC(teamB, result.statsB);
    developHeadCoach(teamB, result.statsB, result.teamBWon);
  }

  return result;
};
