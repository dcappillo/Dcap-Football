/**
 * Roster and draft-class CSV files: export → import round trips, plus the
 * kinds of hand-edited files people actually make (position nicknames,
 * missing columns, typos).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startGame } = require('./helpers');

const PLAYERS = `JSON.stringify(listAllTeams(league).map(function (t) {
  return t.roster.map(function (p) {
    return [t.id, p.name, p.positions[0], p.age, p.attributes.overall, p.potential, p.devTrait || 'Normal',
      p.contract.capHitPerYear, p.contract.years].join('|');
  }).sort();
}))`;

const js = (s) => JSON.stringify(s);
/** Copy a value out of the jsdom window so assert.deepEqual compares it by value. */
const plain = (v) => JSON.parse(JSON.stringify(v));

test('the file columns match the game attributes', async () => {
  const { run } = await startGame({ seed: 1 });
  assert.deepEqual(plain(run('PLAYER_ATTR_COLUMNS')), plain(run('Object.keys(window.ATTR_LABELS)')));
});

test('exporting and re-importing the league roster changes nothing', async () => {
  const { run } = await startGame({ seed: 2 });
  run(`teamMap[userTeamId].roster[0].devTrait = 'Superstar'`); // make sure traits survive
  const before = JSON.parse(run(PLAYERS));
  const csv = run('buildRosterCsv()');

  const result = plain(run(`applyRosterCsv(${js(csv)})`));
  assert.deepEqual(result.errors, []);
  assert.equal(result.teams, 32);
  assert.deepEqual(JSON.parse(run(PLAYERS)), before);
});

test('an imported roster keeps its Potential when the game starts', async () => {
  const source = await startGame({ seed: 3 });
  const csv = source.run('buildRosterCsv()');
  const expected = JSON.parse(source.run(PLAYERS));

  const game = await startGame({ seed: 4, beforeCoachSaved: (run) => run(`applyRosterCsv(${js(csv)})`) });
  assert.deepEqual(JSON.parse(game.run(PLAYERS)), expected);
  game.click('btnSimWeek');
  assert.deepEqual(game.errors, []);
});

test('hand-edited files: position nicknames, bad rows and a legacy overall-only file', async () => {
  const { run } = await startGame({ seed: 5 });
  const team = run('Object.keys(teamMap)[0]');
  const other = run('Object.keys(teamMap)[1]');
  const name = run(`teamMap['${other}'].city + ' ' + teamMap['${other}'].nickname`);
  const csv = [
    'Team_ID,Team Name,Name,Position,Age,Overall,Dev Trait,Contract Salary,Contract Years',
    `${team},,Left Tackle Guy,LT,26,80,star,"$4,000,000",3`,
    `${team},,Edge Rusher,de,24,75,,,`,
    `${team},,Who Knows,S,25,70,,,`,
    `nope,,Lost Player,QB,25,70,,,`,
    `,${name},Matched By Name,QB,30,77,,,`,
    `${team},,,WR,25,70,,,`,
  ].join('\n');

  const r = plain(run(`applyRosterCsv(${js(csv)})`));
  assert.equal(r.players, 3);
  assert.equal(r.errors.length, 3); // unknown position, unknown team, missing name
  assert.match(r.errors.join(' '), /unknown position "S"/);
  assert.match(r.errors.join(' '), /unknown team "nope"/);

  const roster = run(`JSON.stringify(teamMap['${team}'].roster.map(function (p) {
    return [p.name, p.positions[0], p.attributes.overall, p.devTrait, p.contract.capHitPerYear, p.contract.years];
  }))`);
  assert.deepEqual(JSON.parse(roster), [
    ['Left Tackle Guy', 'T', 80, 'Star', 4000000, 3],
    ['Edge Rusher', 'EDGE', 75, 'Normal', JSON.parse(roster)[1][4], JSON.parse(roster)[1][5]],
  ]);
  assert.equal(run(`teamMap['${other}'].roster.length`), 1);
  assert.ok(r.warnings.some((w) => /min 37/.test(w)));
});

test('draft class export and import round trip', async () => {
  const { run } = await startGame({ seed: 6 });
  run('generateDraftClass()');
  const csv = run('buildDraftClassCsv()'); // assigns Potential to new prospects
  const before = run(`JSON.stringify(draftClass.map(function (p) {
    return [p.name, p.positions[0], p.age, p.attributes.overall, p.potential, p.devTrait || 'Normal'].join('|');
  }))`);
  const r = plain(run(`applyDraftClassCsv(${js(csv)})`));
  assert.deepEqual(r.errors, []);
  assert.equal(r.count, JSON.parse(before).length);
  const after = run(`JSON.stringify(draftClass.map(function (p) {
    return [p.name, p.positions[0], p.age, p.attributes.overall, p.potential, p.devTrait || 'Normal'].join('|');
  }))`);
  assert.deepEqual(JSON.parse(after), JSON.parse(before));
  assert.equal(run('draftClass.every(function (p) { return p.isRookie && p.contract === null; })'), true);
});
