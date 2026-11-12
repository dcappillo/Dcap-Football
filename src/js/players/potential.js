/* ============================================================
   POTENTIAL + AGE CURVE

   Every player has a Potential: the highest overall he can reach.
   Growth slows as he nears it and stops at it. The only way past it
   is a development-trait upgrade, which re-rolls Potential from the
   new trait, his current overall and his age.

   Growth happens during the season (players/weekly-progression.js).
   Aging happens once, at the end of the season
   (players/development-system.js): everyone 30+ declines, faster
   each year, and their Potential comes down with them.

   Tuned so the league keeps a stable average and roughly 20–40
   players rated 90+ (see tests/balance.test.js).
   ============================================================ */

var DEV_TRAITS = ['Normal', 'Star', 'Superstar', 'X-Factor'];

/** Room above current overall for a new player, by age: [min, max]. */
function potentialHeadroomRange(age) {
  if (age <= 21) return [2, 16];
  if (age <= 22) return [2, 14];
  if (age <= 24) return [1, 10];
  if (age <= 26) return [0, 5];
  if (age <= 28) return [0, 2];
  return [0, 0];
}

/** Extra room from a development trait, on top of the age range. */
var TRAIT_HEADROOM = { Normal: 0, Star: 2, Superstar: 4, 'X-Factor': 6 };

/** Room granted by a dev-trait upgrade, before the age factor: [min, max]. */
var UPGRADE_HEADROOM = { Star: [1, 5], Superstar: [2, 7], 'X-Factor': [4, 9] };

/**
 * Meeting a dev-trait stat threshold earns the next tier only with this
 * probability (keyed by the tier being earned), and only through age 30.
 * Without it most productive starters climbed to X-Factor within 3 seasons.
 */
var DEV_UPGRADE_CHANCE = { Star: 0.6, Superstar: 0.35, 'X-Factor': 0.2 };
var DEV_UPGRADE_MAX_AGE = 30;

/** Expected overall gained over a full season by a starter with room to grow (Normal trait). */
function seasonGrowthForAge(age) {
  if (age <= 22) return 5;
  if (age <= 23) return 4.2;
  if (age <= 24) return 3.4;
  if (age <= 25) return 2.6;
  if (age <= 26) return 1.8;
  if (age <= 27) return 1.1;
  if (age <= 28) return 0.6;
  return 0.4; // only matters for veterans an upgrade gave room to grow
}

/** Average overall lost when a player turns this age. */
function ageDeclineForAge(age) {
  if (age <= 29) return 0;
  if (age === 30) return 1;
  if (age === 31) return 1.5;
  if (age === 32) return 2;
  if (age === 33) return 2.5;
  if (age === 34) return 3.5;
  if (age === 35) return 4.5;
  return 5.5;
}

/** Random integer in [min, max], skewed toward min (most players have modest upside). */
function skewedRoll(min, max) {
  return min + Math.floor(Math.pow(Math.random(), 1.3) * (max - min + 1));
}

/**
 * The opening league's players are generated fully formed (ratings don't depend
 * on age), so they get a fraction of the usual headroom. Without this, the
 * league's young starters all grew into a wave of 90+ players in years 3–7.
 */
var ESTABLISHED_HEADROOM_FACTOR = 0.4;

function rollPotential(player, headroomFactor) {
  var range = potentialHeadroomRange(player.age || 25);
  var bonus = TRAIT_HEADROOM[player.devTrait || 'Normal'] || 0;
  var headroom = range[1] > 0 ? skewedRoll(range[0], range[1]) + bonus : 0;
  /* A young player who is already very good has less left to gain */
  var ovr = player.attributes.overall;
  headroom = Math.round(headroom * Math.max(0.2, Math.min(1, (96 - ovr) / 20)) * (headroomFactor || 1));
  return Math.min(99, player.attributes.overall + headroom);
}

/** Give a player a Potential if he doesn't have one (new players, old saves). */
function ensurePotential(player) {
  if (typeof player.potential !== 'number' || isNaN(player.potential)) {
    player.potential = rollPotential(player);
  }
  if (player.potential < player.attributes.overall) player.potential = player.attributes.overall;
  return player.potential;
}

/** Potential for the opening league (new game). */
function initializeLeaguePotential() {
  listAllTeams(league).forEach(function (team) {
    team.roster.forEach(function (p) {
      p.potential = rollPotential(p, ESTABLISHED_HEADROOM_FACTOR);
    });
  });
  if (typeof freeAgents !== 'undefined' && Array.isArray(freeAgents)) freeAgents.forEach(ensurePotential);
}

function ensureLeaguePotential() {
  if (typeof league === 'undefined' || !league) return;
  /* Saves from before Potential existed: treat rostered veterans as established */
  listAllTeams(league).forEach(function (team) {
    team.roster.forEach(function (p) {
      if (typeof p.potential !== 'number' && !p.isRookie) p.potential = rollPotential(p, ESTABLISHED_HEADROOM_FACTOR);
      ensurePotential(p);
    });
  });
  if (typeof freeAgents !== 'undefined' && Array.isArray(freeAgents)) freeAgents.forEach(ensurePotential);
  if (typeof draftClass !== 'undefined' && Array.isArray(draftClass)) draftClass.forEach(ensurePotential);
}

/**
 * Called after a dev-trait upgrade: re-roll Potential from the new trait,
 * current overall and age. Never lowers it.
 */
function rerollPotentialForUpgrade(player) {
  var range = UPGRADE_HEADROOM[player.devTrait];
  if (!range) return;
  var age = player.age || 25;
  var ageFactor = age <= 25 ? 1 : age <= 28 ? 0.7 : age <= 31 ? 0.4 : 0.2;
  var rolled = player.attributes.overall + Math.round(skewedRoll(range[0], range[1]) * ageFactor);
  player.potential = Math.max(ensurePotential(player), Math.min(99, rolled));
}

/**
 * Move a player's overall by delta, keeping his granular attributes in step
 * (only attributes central to his position move, preserving his profile).
 */
function shiftOverall(player, delta) {
  if (!delta) return;
  player.attributes.overall = Math.max(40, Math.min(99, player.attributes.overall + delta));
  if (player.granularAttrs && window.POS_BIAS && player.positions && player.positions[0]) {
    var bias = window.POS_BIAS[player.positions[0]] || {};
    Object.keys(player.granularAttrs).forEach(function (k) {
      if ((bias[k] || 0) >= 0.5) {
        player.granularAttrs[k] = Math.max(20, Math.min(99, player.granularAttrs[k] + delta));
      }
    });
  }
}

/**
 * End-of-season aging for a player who has just turned a year older.
 * A strong season softens the decline. Potential comes down with him.
 */
function applyAgeDecline(player) {
  var base = ageDeclineForAge(player.age);
  if (!base) return;
  var strongSeason =
    typeof window.weeklyPerfScore === 'function' && (player.stats || {}).gamesPlayed >= 10
      ? window.weeklyPerfScore(player) >= 1.2
      : false;
  var amount = Math.round(base * (0.6 + Math.random() * 0.8) * (strongSeason ? 0.6 : 1));
  if (amount <= 0) return;
  shiftOverall(player, -amount);
  player.potential = Math.max(player.attributes.overall, (player.potential || 0) - amount);
}
