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

/** Chance a CPU team re-signs one of its own expiring players. */
function cpuResignChance(player) {
  const ovr = player.attributes.overall;
  let chance = ovr >= 80 ? 0.85 : ovr >= 72 ? 0.6 : ovr >= 65 ? 0.4 : 0.2;
  if (player.age >= 33) chance *= 0.5;
  else if (player.age >= 30) chance *= 0.8;
  return chance;
}

function processContractExpirations() {
  const teams = listAllTeams(league);

  teams.forEach((team) => {
    const remaining = [];

    team.roster.forEach((player) => {
      const expiring = player.contract && player.contract.years <= 1;

      // CPU teams keep a share of their expiring players (the user re-signs from the roster screen)
      if (expiring && team.id !== userTeamId && Math.random() < cpuResignChance(player)) {
        const deal = generateContract(player.attributes.overall, player.age);
        if (team.capUsed - player.contract.capHitPerYear + deal.capHitPerYear <= team.salaryCap) {
          team.capUsed += deal.capHitPerYear - player.contract.capHitPerYear;
          player.contract = deal;
          remaining.push(player);
          return;
        }
      }

      if (expiring) {
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

/* ─── Draft class CSV (file format: game/player-csv.js) ───────── */

/** The current draft class as CSV text. */
window.buildDraftClassCsv = function () {
  if (!draftClass || !draftClass.length) generateDraftClass();
  var lines = [playerCsvHeader().join(',')];
  draftClass.forEach(function (p) {
    lines.push(playerCsvCells(p).map(csvCell).join(','));
  });
  return lines.join('\r\n');
};

/** Replace the draft class with the prospects in a CSV. Returns { count, errors }. */
window.applyDraftClassCsv = function (text) {
  var result = playersFromCsv(parseCsv(text), { idPrefix: 'rookie_', defaultAge: 21 });
  var prospects = result.players.map(function (p) {
    delete p.row;
    p.contract = null; // rookies sign when drafted
    p.isRookie = true;
    return p;
  });
  if (prospects.length) {
    draftClass = prospects;
    window._customDraftImported = { count: prospects.length };
  }
  return { count: prospects.length, errors: result.errors };
};

window.downloadDraftTemplate = function () {
  downloadTextFile(window.buildDraftClassCsv(), 'capfootball_draft_class.csv');
  showToast('📥 capfootball_draft_class.csv downloaded', true);
};

window.importCustomDraftClass = function (file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    var r;
    try {
      r = window.applyDraftClassCsv(e.target.result);
    } catch (err) {
      showToast('⚠ Import failed: ' + err.message, false);
      return;
    }
    var badge = document.getElementById('_draftImportBadge');
    if (badge && r.count) {
      badge.innerHTML = '✅ ' + r.count + ' custom prospects loaded' + window.importProblemsHtml(r.errors, []);
      badge.style.display = 'block';
    }
    showToast(
      r.count
        ? '✅ Draft class imported — ' +
            r.count +
            ' prospects' +
            (r.errors.length ? ' (' + r.errors.length + ' rows skipped)' : '')
        : '⚠ ' + (r.errors[0] || 'No valid prospects found in file'),
      !!r.count,
    );
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
    const count = (pos) => team.roster.filter((p) => p.positions[0] === pos).length;
    // Never cut a position below its starting lineup (low-OVR kickers and punters were being cut)
    const cuttable = (p) => count(p.positions[0]) > (STARTER_SLOTS[p.positions[0]] || 0);

    while (team.roster.length > 55) {
      const cut = team.roster.filter(cuttable).sort((a, b) => a.attributes.overall - b.attributes.overall)[0];
      if (!cut) break;
      team.capUsed -= cut.contract ? cut.contract.capHitPerYear || 0 : 0;
      cut.isFreeAgent = true;
      freeAgents.push(cut);
      team.roster = team.roster.filter((p) => p.id !== cut.id);
    }
  });
}

/* ------------------------------------------------------------
   11. Reset Morale + Chemistry for New Season
------------------------------------------------------------ */

function resetMoraleAndChemistry() {
  ensureMoraleAndChemistry();
  listAllTeams(league).forEach((team) => {
    /* Players who weren't on this roster at the start of last season.
       Saves from before continuity tracking have no stamps: skip the penalty. */
    const tracked = team.roster.some((p) => p.chemTeamId !== undefined);
    const newcomers = tracked ? team.roster.filter((p) => p.chemTeamId !== team.id).length : 0;
    const turnoverPenalty = Math.min(12, newcomers * 0.6);

    const chemistry = CHEMISTRY_BASELINE + (team.chemistry - CHEMISTRY_BASELINE) * 0.5 - turnoverPenalty;
    team.chemistryTrend = 0;
    team.chemistry = clampRating(chemistry);
    team.winningStreak = 0;

    team.roster.forEach((p) => {
      p.morale = clampRating(MORALE_BASELINE + (p.morale - MORALE_BASELINE) * 0.5);
      p.moraleTrend = 0;
    });
  });
  stampRosterContinuity();
}
