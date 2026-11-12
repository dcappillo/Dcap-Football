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
const path = require('node:path');
const crypto = require('node:crypto');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');

const DIST_INDEX = path.resolve(__dirname, '..', 'dist', 'index.html');

/** Only load local files; skip external requests such as Google Fonts. */
class LocalOnlyLoader extends ResourceLoader {
  fetch(url, options) {
    return url.startsWith('file:') ? super.fetch(url, options) : Promise.resolve(Buffer.from(''));
  }
}

/** Replace timers, randomness and blocking dialogs with deterministic stand-ins. */
function makeDeterministic(window, seed, timers, alerts) {
  let state = seed;
  window.Math.random = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x80000000;
  };
  let nextId = 0;
  window.setTimeout = (fn, ms = 0) => {
    timers.push({ id: ++nextId, fn, ms });
    return nextId;
  };
  window.clearTimeout = (id) => {
    const i = timers.findIndex((t) => t.id === id);
    if (i !== -1) timers.splice(i, 1);
  };
  window.setInterval = () => 0;
  window.clearInterval = () => {};
  window.requestAnimationFrame = (fn) => window.setTimeout(fn, 16);
  window.alert = (message) => alerts.push(String(message));
  window.confirm = () => true;
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = () => {};
}

async function playSeason({ seed, teamIndex }) {
  const errors = [];
  const alerts = [];
  const timers = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (err) => errors.push(err.detail || err));

  const dom = await JSDOM.fromFile(DIST_INDEX, {
    runScripts: 'dangerously',
    resources: new LocalOnlyLoader(),
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse: (window) => makeDeterministic(window, seed, timers, alerts),
  });
  const { window } = dom;
  if (window.document.readyState !== 'complete') {
    await new Promise((resolve) => window.addEventListener('load', resolve));
  }

  const flushTimers = () => {
    for (let n = 0; timers.length && n < 5000; n++) {
      timers.sort((a, b) => a.ms - b.ms || a.id - b.id);
      timers.shift().fn();
    }
  };
  const run = (code) => {
    window.eval(code);
    flushTimers();
  };
  const click = (id) => {
    window.document.getElementById(id).click();
    flushTimers();
  };

  flushTimers();
  run('_doStartNewGame()');
  run(`renderCoachCreation(Object.keys(teamMap)[${teamIndex}])`);
  window.document.getElementById('coachNameInput').value = 'Test Coach';
  run('saveNewCoach()');

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
  run(`
    var team = teamMap[userTeamId];
    Object.keys(STARTER_SLOTS).forEach(function (pos) {
      while (team.roster.filter(function (p) { return p.positions[0] === pos; }).length < STARTER_SLOTS[pos] + 1) {
        cpuSignForDepth(team, pos);
      }
    });
    while (team.roster.length < 46) cpuSignForDepth(team, 'WR');
  `);
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
