/* ============================================================
   PLAYER MORALE + TEAM CHEMISTRY

   Morale (0–100, per player) moves after every game. Wins lift it
   and losses drop it. Starters feel results more, players who fit
   their coordinators' schemes are happier, and good players stuck
   on the bench slowly sour. It drifts back toward a baseline, so it
   reflects recent form instead of piling up all season.

   Chemistry (0–100, per team) follows the roster's mood, the head
   coach's leadership, how happy the stars are and the current
   streak. It moves gradually week to week and feeds the game sim
   through getTeamChemistryOVRModifier (used by coachingPowerBoost).

   Morale also drives free agent interest, contract negotiations
   and trade requests (team/morale-chemistry-integration.js).
   Between seasons both regress halfway to baseline, and roster
   turnover costs chemistry (offseason/offseason-pipeline.js).
   ============================================================ */

var MORALE_BASELINE = 70;
var CHEMISTRY_BASELINE = 65;

/** A good player who isn't starting loses this much morale per game. */
var BENCH_FRUSTRATION_OVR = 78;

function clampRating(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function initializeMoraleForPlayer(player) {
  if (typeof player.morale !== 'number' || isNaN(player.morale)) {
    player.morale = randomInt(60, 85);
    player.moraleTrend = 0;
  }
}

/**
 * Give every player and team a morale/chemistry value if they don't have one.
 * Safe to call any time: new games, loaded saves, newly generated players.
 */
function ensureMoraleAndChemistry() {
  if (typeof league === 'undefined' || !league) return;
  listAllTeams(league).forEach(function (team) {
    if (typeof team.chemistry !== 'number' || isNaN(team.chemistry)) {
      team.chemistry = randomInt(55, 75);
      team.chemistryTrend = 0;
    }
    if (typeof team.winningStreak !== 'number') team.winningStreak = 0;
    team.roster.forEach(initializeMoraleForPlayer);
  });
  if (typeof freeAgents !== 'undefined' && Array.isArray(freeAgents)) {
    freeAgents.forEach(initializeMoraleForPlayer);
  }
}

/** Record which team each player belongs to, so next offseason can measure roster turnover. */
function stampRosterContinuity() {
  listAllTeams(league).forEach(function (team) {
    team.roster.forEach(function (p) {
      p.chemTeamId = team.id;
    });
  });
}

/** IDs of the healthy players currently starting, using the same rules as the power rating. */
function getStarterIds(team) {
  var byPos = {};
  team.roster.forEach(function (p) {
    var out = (p.injury && p.injury.weeksRemaining > 0) || (p.suspension && p.suspension.weeksRemaining > 0);
    if (out) return;
    var pos = p.positions[0];
    (byPos[pos] = byPos[pos] || []).push(p);
  });
  var ids = new Set();
  Object.keys(STARTER_SLOTS).forEach(function (pos) {
    (byPos[pos] || [])
      .sort(function (a, b) {
        var ra = a.depthChartRank != null ? a.depthChartRank : 999;
        var rb = b.depthChartRank != null ? b.depthChartRank : 999;
        return ra !== rb ? ra - rb : b.attributes.overall - a.attributes.overall;
      })
      .slice(0, STARTER_SLOTS[pos])
      .forEach(function (p) {
        ids.add(p.id);
      });
  });
  return ids;
}

/** @param {number} result 1 = win, 0 = tie, -1 = loss */
function updateMoraleAfterGame(team, result) {
  var starters = getStarterIds(team);
  team.roster.forEach(function (p) {
    initializeMoraleForPlayer(p);
    var change = result > 0 ? randomInt(1, 3) : result < 0 ? -randomInt(1, 4) : 0;

    if (starters.has(p.id)) {
      change *= 1.3;
    } else {
      var out = (p.injury && p.injury.weeksRemaining > 0) || (p.suspension && p.suspension.weeksRemaining > 0);
      if (!out && p.attributes.overall >= BENCH_FRUSTRATION_OVR) change -= 1;
    }

    if (typeof calculateSchemeFit === 'function') {
      var fit = calculateSchemeFit(p, team);
      if (fit >= 80) change += 1;
      else if (fit <= 40) change -= 1;
    }

    change += (MORALE_BASELINE - p.morale) * 0.08;

    var next = clampRating(p.morale + change);
    p.moraleTrend = next - p.morale;
    p.morale = next;
  });
}

function updateTeamChemistry(team) {
  var players = team.roster;
  if (!players.length) return;

  var avg = function (list) {
    return (
      list.reduce(function (sum, p) {
        return sum + p.morale;
      }, 0) / list.length
    );
  };
  var avgMorale = avg(players);
  var stars = players.filter(function (p) {
    return p.attributes.overall >= 85;
  });
  var starMorale = stars.length ? avg(stars) : avgMorale;
  var leadership = (team.coach && team.coach.leadership) || 70;
  var streak = Math.max(-5, Math.min(5, team.winningStreak || 0));

  var target = avgMorale * 0.4 + leadership * 0.2 + starMorale * 0.2 + streak * 2 + 10;
  var next = clampRating(team.chemistry * 0.75 + target * 0.25);

  team.chemistryTrend = next - team.chemistry;
  team.chemistry = next;
}

function updateStreak(team, result) {
  var s = team.winningStreak || 0;
  team.winningStreak = result > 0 ? (s > 0 ? s + 1 : 1) : result < 0 ? (s < 0 ? s - 1 : -1) : 0;
}

/** Called by simulateGame once the final score is known. */
function recordMoraleAndChemistry(home, away, homeScore, awayScore) {
  ensureMoraleAndChemistry();
  var result = homeScore > awayScore ? 1 : homeScore < awayScore ? -1 : 0;
  updateStreak(home, result);
  updateStreak(away, -result);
  updateMoraleAfterGame(home, result);
  updateMoraleAfterGame(away, -result);
  updateTeamChemistry(home);
  updateTeamChemistry(away);
}

/** Power-rating modifier applied in every game (see coachingPowerBoost). */
function getTeamChemistryOVRModifier(team) {
  if (team.chemistry >= 85) return +5;
  if (team.chemistry >= 70) return +2;
  if (team.chemistry >= 50) return 0;
  if (team.chemistry >= 30) return -3;
  return -6;
}
