/**
 * End-to-end smoke test.
 *
 * Loads the production build in jsdom with a seeded random number generator and
 * plays a full season: new game, 17 regular-season weeks, playoffs, Black Monday,
 * free agency, the draft and the start of the next season. It fails on any uncaught
 * error, and it checks that the same seed always produces the same league.
 *
 * Run with `npm test` (which builds first).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startGame, FILL_USER_ROSTER } = require('./helpers');

async function playSeason({ seed, teamIndex }) {
  const { window, run, click, errors, alerts } = await startGame({ seed, teamIndex });

  for (let week = 0; week < 17; week++) click('btnSimWeek');
  run('beginAwardsPhase()');
  run('beginPlayoffsPhase()');
  for (let round = 0; round < 4; round++) click('btnSimWeek');

  const endOfSeason = JSON.parse(
    window.eval(`JSON.stringify(listAllTeams(league).map(function (t) {
      return {
        chemistry: t.chemistry,
        wins: t.wins,
        moraleMissing: t.roster.filter(function (p) { return typeof p.morale !== 'number' || isNaN(p.morale); }).length
      };
    }))`),
  );

  for (const screen of [
    'renderRoster',
    'renderDepthChart',
    'renderStandings',
    'renderPlayerStats',
    'renderLeagueLeaders',
    'renderCoachingHub',
    'renderTradePicksUI',
    'renderSaveLoad',
  ]) {
    run(`${screen}()`);
  }

  run('beginBlackMonday()');
  run('beginFreeAgencyPhase()');
  run('beginDraftPhase()');
  run(`
    launchDraft();
    for (var guard = 0; guard < 40; guard++) {
      var team = getTeamOnClock();
      if (!team || team.id !== userTeamId) break;
      userDraftPlayer(draftClass.filter(function (p) { return !p.drafted; })[0].id);
    }
  `);
  run('beginNewSeason()');

  const rosterCheck = JSON.parse(
    window.eval(`JSON.stringify(listAllTeams(league).filter(function (t) { return t.id !== userTeamId; }).map(function (t) {
      var missing = Object.keys(STARTER_SLOTS).filter(function (pos) {
        return t.roster.filter(function (p) { return p.positions[0] === pos; }).length < STARTER_SLOTS[pos];
      });
      return { id: t.id, size: t.roster.length, missing: missing };
    }))`),
  );

  // Fill the user's roster the way a player would in free agency, then play into year two
  run(FILL_USER_ROSTER);
  const weekBefore = window.eval('currentWeekIndex');
  for (let week = 0; week < 3; week++) click('btnSimWeek');
  const yearTwoWeeks = window.eval('currentWeekIndex') - weekBefore;

  const snapshot = window.eval(`JSON.stringify({
    year: window.simYear,
    phase: window.gmPhase,
    champion: window.playoffs && window.playoffs.done,
    teams: listAllTeams(league).map(function (t) {
      return [t.id, t.roster.length, t.coach && t.coach.name, t.capUsed];
    })
  })`);
  window.close();
  return { errors, alerts, snapshot, endOfSeason, rosterCheck, yearTwoWeeks };
}

test('a full season and offseason play through without errors', async () => {
  const { errors, snapshot, endOfSeason, rosterCheck, yearTwoWeeks } = await playSeason({ seed: 12345, teamIndex: 5 });
  assert.deepEqual(errors, []);
  const state = JSON.parse(snapshot);
  assert.equal(state.year, 2);
  assert.equal(state.phase, 'season');
  assert.equal(state.teams.length, 32);
  for (const [id, rosterSize] of state.teams) assert.ok(rosterSize > 0, `${id} has an empty roster`);

  // CPU rosters survive the offseason: full size, every starting spot filled
  for (const team of rosterCheck) {
    assert.ok(team.size >= 46, `${team.id} has only ${team.size} players`);
    assert.deepEqual(team.missing, [], `${team.id} is missing starters`);
  }
  assert.equal(yearTwoWeeks, 3, 'year two should play');

  // Morale and chemistry are live: every player has morale, and chemistry tracks results.
  for (const team of endOfSeason) assert.equal(team.moraleMissing, 0);
  const byWins = [...endOfSeason].sort((a, b) => b.wins - a.wins);
  const avgChem = (teams) => teams.reduce((sum, t) => sum + t.chemistry, 0) / teams.length;
  assert.ok(avgChem(byWins.slice(0, 8)) > avgChem(byWins.slice(-8)), 'winning teams should have better chemistry');
});

test('the same seed always produces the same league', async () => {
  const hash = (s) => crypto.createHash('sha1').update(s).digest('hex');
  const first = await playSeason({ seed: 777, teamIndex: 0 });
  const second = await playSeason({ seed: 777, teamIndex: 0 });
  assert.equal(hash(first.snapshot), hash(second.snapshot));
});
