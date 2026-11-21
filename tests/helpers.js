/**
 * Shared test harness: loads the production build in jsdom with a seeded
 * random number generator and synchronous timers, so a whole season can be
 * played deterministically in a few seconds.
 */
'use strict';

const path = require('node:path');
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

/**
 * Load the game, start a new league as the team at `teamIndex`, and return driving helpers.
 * `beforeCoachSaved(run)` runs on the coach-creation screen, where roster imports happen.
 */
async function startGame({ seed, teamIndex = 5, beforeCoachSaved }) {
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
    const result = window.eval(code);
    flushTimers();
    return result;
  };
  const click = (id) => {
    window.document.getElementById(id).click();
    flushTimers();
  };

  flushTimers();
  run('_doStartNewGame()');
  run(`renderCoachCreation(Object.keys(teamMap)[${teamIndex}])`);
  window.document.getElementById('coachNameInput').value = 'Test Coach';
  if (beforeCoachSaved) beforeCoachSaved(run); // e.g. import a roster on the coach screen
  run('saveNewCoach()');

  return { window, run, click, errors, alerts };
}

/** Give the user's team a legal roster (every starter plus a backup, 46–55 players). */
const FILL_USER_ROSTER = `
  (function () {
    var team = teamMap[userTeamId];
    var count = function (pos) { return team.roster.filter(function (p) { return p.positions[0] === pos; }).length; };
    Object.keys(STARTER_SLOTS).forEach(function (pos) {
      while (count(pos) < STARTER_SLOTS[pos] + 1) cpuSignForDepth(team, pos);
    });
    while (team.roster.length < 46) cpuSignForDepth(team, 'WR');
    while (team.roster.length > 55) {
      var cut = team.roster
        .filter(function (p) { return count(p.positions[0]) > STARTER_SLOTS[p.positions[0]] + 1; })
        .sort(function (a, b) { return a.attributes.overall - b.attributes.overall; })[0];
      team.roster = team.roster.filter(function (p) { return p !== cut; });
      freeAgents.push(cut);
    }
  })();
`;

/** Play from the current week through the regular season, playoffs and offseason into the next season. */
function playFullYear({ run, click }) {
  run(FILL_USER_ROSTER);
  for (let week = 0; week < 17; week++) click('btnSimWeek');
  run('beginAwardsPhase()');
  run('beginPlayoffsPhase()');
  for (let round = 0; round < 4; round++) click('btnSimWeek');
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
}

module.exports = { startGame, playFullYear, FILL_USER_ROSTER };
