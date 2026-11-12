/**
 * Save/load round trips at every point a player might save: mid-season,
 * during the playoffs, in free agency and in the middle of the draft.
 * Each test saves, keeps playing, loads the save into a fresh game, plays
 * the same steps again, and checks both runs end in the same place.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startGame, FILL_USER_ROSTER } = require('./helpers');

const SNAPSHOT = `JSON.stringify({
  phase: window.gmPhase,
  year: window.simYear,
  week: currentWeekIndex,
  offseasonStep: league.offseasonStep || null,
  playoffs: window.playoffs && {
    round: window.playoffs.roundIdx,
    done: window.playoffs.done,
    alive: (window.playoffs.conf1 || []).concat(window.playoffs.conf2 || []).map(function (t) { return t && t.id; }),
    linked: (window.playoffs.conf1 || []).every(function (t) { return t === teamMap[t.id]; }),
  },
  drafted: draftClass.filter(function (p) { return p.drafted; }).length,
  records: listAllTeams(league).map(function (t) { return t.id + ':' + t.wins + '-' + t.losses; }),
  sections: ['section-free-agency', 'section-draft'].map(function (id) { return document.getElementById(id).style.display; }),
})`;

/** Play to a save point, save, then load that save into a brand-new game. */
async function saveAndReload(playTo) {
  const original = await startGame({ seed: 31337 });
  original.run(FILL_USER_ROSTER);
  playTo(original);
  const saveFile = original.run('saveGameToString()');
  const before = JSON.parse(original.run(SNAPSHOT));

  const reloaded = await startGame({ seed: 1 });
  assert.equal(reloaded.run(`loadGameFromString(${JSON.stringify(saveFile)})`), true);
  const after = JSON.parse(reloaded.run(SNAPSHOT));
  return { original, reloaded, before, after };
}

const toPlayoffs = (g) => {
  for (let week = 0; week < 17; week++) g.click('btnSimWeek');
  g.run('beginAwardsPhase()');
  g.run('beginPlayoffsPhase()');
  g.click('btnSimWeek'); // wild card round
};
const toFreeAgency = (g) => {
  toPlayoffs(g);
  for (let round = 0; round < 3; round++) g.click('btnSimWeek');
  g.run('beginBlackMonday()');
  g.run('beginFreeAgencyPhase()');
};
const toMidDraft = (g) => {
  toFreeAgency(g);
  g.run('beginDraftPhase()');
  g.run('launchDraft()');
};

test('mid-season save restores the week and records', async () => {
  const { before, after, reloaded } = await saveAndReload((g) => {
    for (let week = 0; week < 6; week++) g.click('btnSimWeek');
  });
  assert.deepEqual(after, before);
  reloaded.click('btnSimWeek');
  assert.equal(reloaded.run('currentWeekIndex'), 7);
  assert.deepEqual(reloaded.errors, []);
});

test('playoff save keeps the bracket linked to the league and finishes it', async () => {
  const { before, after, reloaded } = await saveAndReload(toPlayoffs);
  assert.equal(after.phase, 'postseason');
  assert.equal(after.playoffs.linked, true, 'bracket teams should be the league teams, not copies');
  assert.deepEqual(after, before);
  for (let round = 0; round < 3; round++) reloaded.click('btnSimWeek');
  assert.equal(reloaded.run('window.playoffs.done'), true);
  assert.deepEqual(reloaded.errors, []);
});

test('free agency save stays in the offseason with the FA controls visible', async () => {
  const { before, after, reloaded } = await saveAndReload(toFreeAgency);
  assert.equal(after.phase, 'offseason');
  assert.equal(after.offseasonStep, 'free-agency');
  assert.deepEqual(after.sections, ['', 'none']);
  assert.deepEqual(after, before);
  assert.equal(reloaded.window.getComputedStyle(reloaded.window.document.getElementById('btnSimWeek')).display, 'none');
  // Contract expirations must not run again
  const pool = reloaded.run('freeAgents.length');
  reloaded.run('beginFreeAgencyPhase()');
  assert.equal(reloaded.run('freeAgents.length'), pool);
});

test('mid-draft save resumes the draft where it stopped', async () => {
  const { before, after, reloaded } = await saveAndReload(toMidDraft);
  assert.equal(after.offseasonStep, 'draft');
  assert.deepEqual(after.sections, ['none', '']);
  assert.deepEqual(after, before);
  const drafted = after.drafted;
  reloaded.run(`userDraftPlayer(draftClass.filter(function (p) { return !p.drafted; })[0].id)`);
  assert.ok(reloaded.run('draftClass.filter(function (p) { return p.drafted; }).length') > drafted);
  reloaded.run('beginNewSeason()');
  assert.equal(reloaded.run('window.gmPhase'), 'season');
  assert.deepEqual(reloaded.errors, []);
});

test('a version 1 save (no phase recorded) still loads', async () => {
  const game = await startGame({ seed: 7 });
  game.run(FILL_USER_ROSTER);
  toFreeAgency(game);
  const v1 = JSON.parse(game.run('saveGameToString()'));
  v1.version = 1;
  ['gmPhase', 'playoffs', 'draftPickList', 'draftAbsIndex', 'customDraftImported', 'headCoachCandidates'].forEach(
    (k) => delete v1[k],
  );
  delete v1.league.offseasonStep;

  const reloaded = await startGame({ seed: 1 });
  assert.equal(reloaded.run(`loadGameFromString(${JSON.stringify(JSON.stringify(v1))})`), true);
  assert.equal(reloaded.run('window.gmPhase'), 'offseason');
  assert.equal(reloaded.run('league.offseasonStep'), 'free-agency');
  assert.deepEqual(reloaded.errors, []);
});
