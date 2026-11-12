/**
 * Long-run balance test.
 *
 * Plays ten full seasons and checks that player ratings stay in a healthy
 * range: the league average doesn't drift, and the elite tier (90+ overall)
 * stays small. Before Potential existed, the average climbed from 72 to 86
 * and a third of the league was rated 90+ within six seasons.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startGame, playFullYear } = require('./helpers');

const SEASONS = 10;

const LEAGUE_SNAPSHOT = `JSON.stringify((function () {
  var ovr = [];
  listAllTeams(league).forEach(function (t) { t.roster.forEach(function (p) { ovr.push(p.attributes.overall); }); });
  return {
    average: ovr.reduce(function (s, x) { return s + x; }, 0) / ovr.length,
    elite: ovr.filter(function (x) { return x >= 90; }).length,
  };
})())`;

test(`ratings stay balanced over ${SEASONS} seasons`, { timeout: 180000 }, async () => {
  const game = await startGame({ seed: 4242 });
  const start = JSON.parse(game.run(LEAGUE_SNAPSHOT));

  for (let season = 1; season <= SEASONS; season++) {
    playFullYear(game);
    const now = JSON.parse(game.run(LEAGUE_SNAPSHOT));
    const drift = now.average - start.average;

    assert.ok(Math.abs(drift) <= 2.5, `season ${season}: league average drifted ${drift.toFixed(1)}`);
    // Target is 20–40 elite players; allow some slack for a single seed
    if (season >= 3) {
      assert.ok(now.elite >= 12 && now.elite <= 45, `season ${season}: ${now.elite} players rated 90+`);
    }
  }
  assert.deepEqual(game.errors, []);
});
