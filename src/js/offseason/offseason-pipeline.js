/* ============================================================
   FULL OFFSEASON MODE (PIPELINE + OFFSEASON HUB)
   ============================================================ */

/* ------------------------------------------------------------
   3. Cap Rollover
------------------------------------------------------------ */

function applyCapRollover() {
  const teams = listAllTeams(league);

  teams.forEach((team) => {
    const rollover = Math.max(0, team.salaryCap - team.capUsed);
    team.salaryCap += Math.floor(rollover * 0.5); // 50% rollover
  });
}

/* ------------------------------------------------------------
   4. Contract Expirations
------------------------------------------------------------ */

function processContractExpirations() {
  const teams = listAllTeams(league);

  teams.forEach((team) => {
    const remaining = [];

    team.roster.forEach((player) => {
      if (player.contract && player.contract.years <= 1) {
        // Remove cap hit before releasing
        team.capUsed -= player.contract.capHitPerYear || 0;
        // Tag with previous team before releasing so re-signings screen can find them
        player.previousTeamId = team.id;
        player.isFreeAgent = true;
        freeAgents.push(player);
      } else {
        if (player.contract) player.contract.years -= 1;
        remaining.push(player);
      }
    });

    team.roster = remaining;
    // Clamp capUsed to actual roster (catches any rounding drift)
    team.capUsed = Math.max(0, team.capUsed);
  });

  // Full recalculation as a safety net — source of truth is the roster
  recalcAllTeamCap();
}

/* Recalculate capUsed from scratch for all teams */
function recalcAllTeamCap() {
  if (!league || typeof listAllTeams !== 'function') return;
  listAllTeams(league).forEach(function (team) {
    team.capUsed = (team.roster || []).reduce(function (sum, p) {
      return sum + ((p.contract && p.contract.capHitPerYear) || 0);
    }, 0);
  });
}
window.recalcAllTeamCap = recalcAllTeamCap;

/* ------------------------------------------------------------
   7. Draft Class Generation
------------------------------------------------------------ */

function generateDraftClass() {
  draftClass = [];
  const TOTAL_PICKS = 400; // 400 prospects per draft class

  /* Guarantee minimums per position (mirrors DRAFT_POSITION_MINS) */
  var mins =
    typeof DRAFT_POSITION_MINS !== 'undefined'
      ? DRAFT_POSITION_MINS
      : {
          QB: 16,
          RB: 14,
          WR: 24,
          TE: 16,
          T: 14,
          G: 10,
          C: 14,
          EDGE: 16,
          DT: 12,
          LB: 16,
          CB: 20,
          FS: 16,
          SS: 16,
          K: 12,
          P: 12,
        };
  var pool = [];
  Object.keys(mins).forEach(function (pos) {
    for (var i = 0; i < mins[pos]; i++) pool.push(pos);
  });
  while (pool.length < TOTAL_PICKS) pool.push(generateRookiePosition());
  for (var i = pool.length - 1; i > 0; i--) {
    var j = randomInt(0, i);
    var tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  for (let i = 0; i < TOTAL_PICKS; i++) {
    draftClass.push(generateRookie(pool[i]));
  }
}

/* ─── Download current draft class as a CSV template ─────────── */
window.downloadDraftTemplate = function () {
  if (!draftClass || !draftClass.length) {
    generateDraftClass();
  }
  var _DRAFT_ATTR_COLS = [
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
  var header = ['name', 'position', 'age', 'devTrait'].concat(_DRAFT_ATTR_COLS);
  var rows = [header.join('\t')];

  draftClass.forEach(function (p) {
    var g = p.granularAttrs || {};
    var dev = p.devTrait || 'Normal';
    var cols = [p.name, p.positions[0], p.age, dev].concat(
      _DRAFT_ATTR_COLS.map(function (k) {
        return g[k] !== undefined ? g[k] : p.attributes ? p.attributes[k] || 60 : 60;
      }),
    );
    rows.push(cols.join('\t'));
  });

  var blob = new Blob([rows.join('\n')], { type: 'text/tab-separated-values' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'draft_class_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof _toast === 'function') _toast('📥 draft_class_template.csv downloaded', true);
};

/* ─── Import a custom draft class from CSV/TSV ────────────────── */
window.importCustomDraftClass = function (file) {
  if (!file) return;
  var _DRAFT_ATTR_COLS = [
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
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var lines = e.target.result.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
      /* Auto-detect delimiter */
      var delim = lines[0].indexOf('\t') !== -1 ? '\t' : ',';
      function splitRow(row) {
        if (delim === '\t')
          return row.split('\t').map(function (c) {
            return c.trim();
          });
        var res = [],
          cur = '',
          inQ = false;
        for (var i = 0; i < row.length; i++) {
          var c = row[i];
          if (c === '"') {
            if (inQ && row[i + 1] === '"') {
              cur += '"';
              i++;
            } else inQ = !inQ;
          } else if (c === ',' && !inQ) {
            res.push(cur.trim());
            cur = '';
          } else cur += c;
        }
        res.push(cur.trim());
        return res;
      }
      var headers = splitRow(lines[0]).map(function (h) {
        return h
          .trim()
          .toLowerCase()
          .replace(/[^a-z_]/g, '');
      });
      var iName = headers.indexOf('name');
      var iPos = headers.indexOf('position');
      var iAge = headers.indexOf('age');
      var iDev = headers.indexOf('devtrait');
      var iOvr = headers.indexOf('overall');

      if (iName < 0 || iPos < 0) {
        if (typeof _toast === 'function') _toast('⚠ CSV must have name and position columns', false);
        return;
      }

      /* headers[] are lowercased+stripped — normalise the key the same way
         before looking it up, then store under the original camelCase key  */
      var attrIdx = {};
      _DRAFT_ATTR_COLS.forEach(function (k) {
        var normKey = k.toLowerCase().replace(/[^a-z_]/g, '');
        var idx = headers.indexOf(normKey);
        if (idx >= 0) attrIdx[k] = idx;
      });

      var prospects = [];
      for (var i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        var cols = splitRow(lines[i]);
        var pos = (cols[iPos] || 'QB').trim().toUpperCase();
        var name = (cols[iName] || 'Unknown').trim();
        var age = parseInt(cols[iAge]) || 21;
        var dev = iDev >= 0 ? (cols[iDev] || 'Normal').trim() : 'Normal';
        if (['Normal', 'Star', 'Superstar', 'X-Factor'].indexOf(dev) < 0) dev = 'Normal';

        /* Build granular attribute bag */
        var g = {};
        _DRAFT_ATTR_COLS.forEach(function (k) {
          if (attrIdx[k] !== undefined) {
            var val = parseInt(cols[attrIdx[k]]);
            g[k] = isNaN(val) ? 60 : Math.max(20, Math.min(99, val));
          }
        });

        /* Derive OVR — use calcPosOVR if available, else legacy overall col, else 72 */
        var overall = 72;
        if (Object.keys(g).length && typeof window.calcPosOVR === 'function') {
          overall = window.calcPosOVR(g, pos);
        } else if (iOvr >= 0) {
          overall = parseInt(cols[iOvr]) || 72;
        }
        overall = Math.max(40, Math.min(99, overall));

        var comp = { athleticism: 72, intelligence: 72, toughness: 72, discipline: 72 };
        if (Object.keys(g).length && typeof window.deriveComposites === 'function') {
          comp = window.deriveComposites(g);
        }

        var positions = typeof generatePositionsForPlayer === 'function' ? generatePositionsForPlayer(pos) : [pos];

        var p = {
          id: 'rookie_' + (typeof globalPlayerId !== 'undefined' ? globalPlayerId++ : Math.floor(Math.random() * 1e8)),
          name: name,
          positions: positions,
          age: age,
          devTrait: dev !== 'Normal' ? dev : undefined,
          attributes: {
            overall: overall,
            athleticism: comp.athleticism,
            intelligence: comp.intelligence,
            toughness: comp.toughness,
            discipline: comp.discipline,
          },
          granularAttrs: Object.keys(g).length ? g : undefined,
          contract: null,
          stats: typeof defaultPlayerStats === 'function' ? defaultPlayerStats() : {},
          isRookie: true,
        };
        prospects.push(p);
      }

      if (!prospects.length) {
        if (typeof _toast === 'function') _toast('⚠ No valid prospects found in file', false);
        return;
      }

      /* Replace the draft class */
      draftClass = prospects;
      window._customDraftImported = { count: prospects.length };

      /* Update badge if hub is still open */
      var badge = document.getElementById('_draftImportBadge');
      if (badge) {
        badge.innerHTML = '✅ ' + prospects.length + ' custom prospects loaded';
        badge.style.display = 'block';
      }
      if (typeof _toast === 'function') _toast('✅ Draft class imported — ' + prospects.length + ' prospects', true);
    } catch (err) {
      if (typeof _toast === 'function') _toast('⚠ Import failed: ' + err.message, false);
    }
  };
  reader.readAsText(file);
};

/* ------------------------------------------------------------
   9. UDFA Signing
------------------------------------------------------------ */

function runUDFA() {
  // Only undrafted players enter the FA pool — drafted players are already on rosters
  var undrafted = draftClass.filter(function (p) {
    return !p.drafted;
  });
  undrafted.forEach(function (player) {
    player.isRookie = true;
    player.isFreeAgent = true;
    freeAgents.push(player);
  });
}

/* ------------------------------------------------------------
   10. Preseason Cuts
------------------------------------------------------------ */

function runPreseasonCuts() {
  const teams = listAllTeams(league);

  teams.forEach((team) => {
    while (team.roster.length > 55) {
      const cut = team.roster.sort((a, b) => a.attributes.overall - b.attributes.overall)[0];
      freeAgents.push(cut);
      team.roster = team.roster.filter((p) => p.id !== cut.id);
    }
  });
}

/* ------------------------------------------------------------
   11. Reset Morale + Chemistry for New Season
------------------------------------------------------------ */

function resetMoraleAndChemistry() {
  const teams = listAllTeams(league);

  teams.forEach((team) => {
    team.chemistry = randomInt(55, 75);
    team.chemistryTrend = 0;

    team.roster.forEach((p) => {
      p.morale = randomInt(60, 85);
      p.moraleTrend = 0;
    });
  });
}
