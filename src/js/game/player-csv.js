/* ============================================================
   PLAYER CSV FORMAT
   Shared by the league roster file (game/new-game-flow.js) and the
   draft class file (offseason/offseason-pipeline.js).

   Columns (header names are case-insensitive; order doesn't matter):
     name, position, age              required
     team_id                          roster file only (required there)
     overall                          used only when a row has no attribute columns
     potential                        optional; rolled if blank
     dev_trait                        Normal | Star | Superstar | X-Factor
     contract_salary, contract_years  optional (roster file); generated if blank
     speed … kickAccuracy             the 39 granular attributes (PLAYER_ATTR_COLUMNS)

   When attribute columns are present they are the source of truth:
   overall is recalculated from them for the player's position.
   Files may be comma- or tab-separated.
   ============================================================ */

/** Every granular attribute, in file order. Must match ATTR_LABELS (checked by tests). */
var PLAYER_ATTR_COLUMNS = [
  'speed',
  'acceleration',
  'agility',
  'strength',
  'stamina',
  'awareness',
  'throwPower',
  'throwAccShort',
  'throwAccMid',
  'throwAccDeep',
  'elusiveness',
  'trucking',
  'jukeMoves',
  'spinMove',
  'ballCarrierVision',
  'carrying',
  'catching',
  'catchInTraffic',
  'routeRunning',
  'release',
  'spectacularCatch',
  'passBlock',
  'runBlock',
  'passBlockStrength',
  'passBlockFootwork',
  'runBlockStrength',
  'runBlockFinesse',
  'blockShedding',
  'tackle',
  'powerMoves',
  'finesseMoves',
  'pursuit',
  'playRecognition',
  'manCoverage',
  'zoneCoverage',
  'press',
  'hitPower',
  'kickPower',
  'kickAccuracy',
];

/** Common position names mapped to the codes the game uses. */
var POSITION_ALIASES = {
  LT: 'T',
  RT: 'T',
  OT: 'T',
  LG: 'G',
  RG: 'G',
  OG: 'G',
  DE: 'EDGE',
  OLB: 'LB',
  MLB: 'LB',
  ILB: 'LB',
  NT: 'DT',
  DL: 'DT',
  HB: 'RB',
  FB: 'RB',
  PK: 'K',
};

var DEV_TRAIT_NAMES = ['Normal', 'Star', 'Superstar', 'X-Factor'];

/** Lower-case and strip punctuation so "Dev Trait", "dev_trait" and "devTrait" all match. */
function normalizeCsvHeader(h) {
  return String(h)
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** Parse comma- or tab-separated text into { headers, rows } (headers normalized). */
function parseCsv(text) {
  var lines = String(text)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter(function (line) {
      return line.trim() !== '';
    });
  if (!lines.length) return { headers: [], rows: [] };
  var delim = lines[0].indexOf('\t') !== -1 ? '\t' : ',';

  function splitRow(row) {
    if (delim === '\t')
      return row.split('\t').map(function (c) {
        return c.trim();
      });
    var cells = [];
    var cur = '';
    var quoted = false;
    for (var i = 0; i < row.length; i++) {
      var c = row[i];
      if (c === '"') {
        if (quoted && row[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === ',' && !quoted) {
        cells.push(cur.trim());
        cur = '';
      } else cur += c;
    }
    cells.push(cur.trim());
    return cells;
  }

  return {
    headers: splitRow(lines[0]).map(normalizeCsvHeader),
    rows: lines.slice(1).map(splitRow),
  };
}

/** One CSV cell, quoted only when needed. */
function csvCell(value) {
  var s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Map a position from a file to a game position code, or null if unknown. */
function normalizePosition(raw) {
  var code = String(raw || '')
    .trim()
    .toUpperCase();
  code = POSITION_ALIASES[code] || code;
  return Object.prototype.hasOwnProperty.call(STARTER_SLOTS, code) ? code : null;
}

/** Header for a player file. `leading` columns go first (e.g. team_id, team_name). */
function playerCsvHeader(leading) {
  return (leading || [])
    .concat(['name', 'position', 'age', 'overall', 'potential', 'dev_trait', 'contract_salary', 'contract_years'])
    .concat(PLAYER_ATTR_COLUMNS);
}

/** A player as CSV cells, matching playerCsvHeader (without the leading columns). */
function playerCsvCells(p) {
  var g = p.granularAttrs || (typeof window.initGranularAttrs === 'function' ? window.initGranularAttrs(p) : {}) || {};
  return [
    p.name,
    p.positions[0],
    p.age,
    p.attributes.overall,
    ensurePotential(p),
    p.devTrait || 'Normal',
    p.contract ? p.contract.capHitPerYear : '',
    p.contract ? p.contract.years : '',
  ].concat(
    PLAYER_ATTR_COLUMNS.map(function (k) {
      return g[k] !== undefined ? g[k] : '';
    }),
  );
}

/**
 * Turn parsed rows into players. Returns { players, errors }; rows with an
 * unknown position or no name are skipped and reported (with line numbers).
 * Each player keeps `row` (the raw cells) so callers can read extra columns.
 */
function playersFromCsv(parsed, options) {
  var h = parsed.headers;
  var col = function (name) {
    return h.indexOf(normalizeCsvHeader(name));
  };
  var iName = col('name');
  var iPos = col('position');
  var iAge = col('age');
  var iOvr = col('overall');
  var iPot = col('potential');
  var iDev = col('dev_trait');
  var iSalary = col('contract_salary');
  var iYears = col('contract_years');
  var attrIdx = {};
  PLAYER_ATTR_COLUMNS.forEach(function (k) {
    var i = col(k);
    if (i >= 0) attrIdx[k] = i;
  });

  var errors = [];
  if (iName < 0 || iPos < 0) return { players: [], errors: ['The file needs name and position columns.'] };
  if (!Object.keys(attrIdx).length && iOvr < 0) {
    return { players: [], errors: ['The file needs attribute columns or an overall column.'] };
  }

  var int = function (cells, i) {
    if (i < 0) return NaN;
    return parseInt(String(cells[i] || '').replace(/[$,\s]/g, ''), 10);
  };

  var players = [];
  parsed.rows.forEach(function (cells, r) {
    var line = r + 2; // 1-based, after the header
    var name = (cells[iName] || '').trim();
    var pos = normalizePosition(cells[iPos]);
    if (!name) return errors.push('Line ' + line + ': missing name');
    if (!pos) return errors.push('Line ' + line + ' (' + name + '): unknown position "' + (cells[iPos] || '') + '"');

    var age = int(cells, iAge);
    if (isNaN(age)) age = options.defaultAge;
    age = Math.max(18, Math.min(45, age));

    var g = {};
    Object.keys(attrIdx).forEach(function (k) {
      var v = int(cells, attrIdx[k]);
      g[k] = isNaN(v) ? 60 : Math.max(20, Math.min(99, v));
    });

    var attributes;
    if (Object.keys(g).length) {
      var comp = window.deriveComposites(g);
      attributes = {
        overall: Math.max(40, Math.min(99, window.calcPosOVR(g, pos))),
        athleticism: comp.athleticism,
        intelligence: comp.intelligence,
        toughness: comp.toughness,
        discipline: comp.discipline,
      };
    } else {
      var ovr = int(cells, iOvr);
      ovr = isNaN(ovr) ? 70 : Math.max(40, Math.min(99, ovr));
      attributes = { overall: ovr, athleticism: ovr, intelligence: ovr, toughness: ovr, discipline: ovr };
    }

    var dev = iDev >= 0 ? (cells[iDev] || '').trim() : '';
    var devTrait =
      DEV_TRAIT_NAMES.find(function (t) {
        return t.toLowerCase() === dev.toLowerCase();
      }) || 'Normal';

    var player = {
      id: options.idPrefix + globalPlayerId++,
      name: name,
      positions: generatePositionsForPlayer(pos),
      age: age,
      devTrait: devTrait,
      attributes: attributes,
      granularAttrs: Object.keys(g).length ? g : undefined,
      contract: null,
      stats: defaultPlayerStats(),
      row: cells,
    };
    if (!player.granularAttrs) window.initGranularAttrs(player); // keeps the given overall

    var pot = int(cells, iPot);
    if (!isNaN(pot)) player.potential = Math.max(attributes.overall, Math.min(99, pot));

    var salary = int(cells, iSalary);
    var years = int(cells, iYears);
    if (salary > 0 && years > 0) {
      player.contract = { years: years, capHitPerYear: salary, totalValue: salary * years };
    }

    players.push(player);
  });
  return { players: players, errors: errors };
}

/** Trigger a download of `text` as `filename`. */
function downloadTextFile(text, filename, type) {
  var url = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' }));
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
