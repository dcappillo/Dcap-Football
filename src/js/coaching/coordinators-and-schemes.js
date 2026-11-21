/* ============================================================
   COORDINATORS + SCHEMES + SCHEME FIT SYSTEM
   ============================================================ */

/* ------------------------------------------------------------
   1. Coordinator Schemes
------------------------------------------------------------ */

const OFFENSIVE_SCHEMES = ['West Coast', 'Air Raid', 'Spread', 'Power Run'];

const DEFENSIVE_SCHEMES = ['4-3', '3-4', 'Cover 2', 'Blitz Heavy'];

/* ------------------------------------------------------------
   2. Initialize Coordinators for Teams
------------------------------------------------------------ */

function initializeCoordinators() {
  const teams = listAllTeams(league);

  teams.forEach((team) => {
    if (!team.oc) {
      team.oc = {
        name: generateRookieName(),
        offenseRating: randomInt(60, 95),
        scheme: OFFENSIVE_SCHEMES[randomInt(0, OFFENSIVE_SCHEMES.length - 1)],
        jobSecurity: randomInt(55, 80),
      };
    }

    if (!team.dc) {
      team.dc = {
        name: generateRookieName(),
        defenseRating: randomInt(60, 95),
        scheme: DEFENSIVE_SCHEMES[randomInt(0, DEFENSIVE_SCHEMES.length - 1)],
        jobSecurity: randomInt(55, 80),
      };
    }
  });
}

/* ------------------------------------------------------------
   3. Scheme Fit Calculation
------------------------------------------------------------ */

function calculateSchemeFit(player, team) {
  /* Returns 0-100. Measures how well this player's attribute
     profile matches what the coordinator's scheme demands.

     Scheme demands:
       West Coast   — intelligent QB, disciplined route runners,
                      pass-blocking OL, receiving TE
       Air Raid     — athletic QB, fast WRs, space-eating TE
       Spread       — mobile QB, versatile athletes everywhere
       Power Run    — tough RB, strong T/G/C, physical TE blocker
       4-3          — two-gap DTs, rangy LBs, man-coverage CBs
       3-4          — athletic EDGE (must drop into coverage),
                      versatile LBs, big strong NT
       Cover 2      — disciplined CBs in zone, fast FS with range
       Blitz Heavy  — explosive EDGE, physical SS, aggressive LBs
  */

  const pos = player.positions[0];
  const a = player.attributes || {};
  const oc = team.oc || {};
  const dc = team.dc || {};

  /* Helper: score an attribute check. Returns 0-30 based on how
     far above/below the threshold the player's attribute is.   */
  function attrScore(val, threshold, weight) {
    val = val || 0;
    if (val >= threshold + 10) return weight;
    if (val >= threshold) return Math.round(weight * 0.7);
    if (val >= threshold - 10) return Math.round(weight * 0.3);
    return 0;
  }

  let fit = 50;

  /* ── OFFENSIVE POSITIONS ─────────────────────────────── */
  const OFF_POS = ['QB', 'RB', 'WR', 'TE', 'T', 'G', 'C'];
  if (OFF_POS.includes(pos)) {
    const scheme = oc.scheme || '';

    if (scheme === 'West Coast') {
      /* Needs a smart QB, disciplined route runners, receiving TE,
         pass-blocking linemen. Slow & methodical progression reads. */
      if (pos === 'QB')
        fit +=
          attrScore(a.intelligence, 78, 25) +
          attrScore(a.throwAccuracy, 78, 15) -
          attrScore(a.speed, 82, 8); /* scrambling hurts WC timing */
      if (pos === 'WR') fit += attrScore(a.discipline, 75, 20) + attrScore(a.routeRunning || a.athleticism, 75, 15);
      if (pos === 'TE') fit += attrScore(a.catching, 75, 20) + attrScore(a.routeRunning || a.intelligence, 70, 10);
      if (pos === 'RB') fit += attrScore(a.catching || a.athleticism, 72, 15);
      if (pos === 'T' || pos === 'G' || pos === 'C') fit += attrScore(a.passBlock || a.intelligence, 75, 20);
    }

    if (scheme === 'Air Raid') {
      /* Needs a mobile QB who can extend plays, burner WRs,
         light protection schemes (quick release saves time). */
      if (pos === 'QB')
        fit += attrScore(a.speed || a.athleticism, 78, 20) + attrScore(a.throwPower || a.athleticism, 78, 15);
      if (pos === 'WR') fit += attrScore(a.speed || a.athleticism, 82, 25) + attrScore(a.catching, 75, 10);
      if (pos === 'TE') fit += attrScore(a.speed || a.athleticism, 75, 15) + attrScore(a.catching, 78, 10);
      if (pos === 'RB') fit += attrScore(a.speed || a.athleticism, 78, 10);
      if (pos === 'T' || pos === 'G') fit += attrScore(a.passBlock || a.athleticism, 72, 15);
      if (pos === 'C') fit += attrScore(a.intelligence || a.discipline, 75, 15);
    }

    if (scheme === 'Spread') {
      /* Needs a QB who reads fast, versatile athletes at every skill
         position. Space > power. Works best with athletic linemen. */
      if (pos === 'QB') fit += attrScore(a.intelligence, 75, 20) + attrScore(a.speed || a.athleticism, 75, 15);
      if (pos === 'WR') fit += attrScore(a.athleticism, 78, 20) + attrScore(a.speed || a.acceleration, 75, 10);
      if (pos === 'TE') fit += attrScore(a.athleticism, 72, 15);
      if (pos === 'RB')
        fit += attrScore(a.speed || a.athleticism, 78, 20) + attrScore(a.changeOfDirection || a.athleticism, 75, 10);
      if (pos === 'T' || pos === 'G' || pos === 'C') fit += attrScore(a.athleticism, 72, 12);
    }

    if (scheme === 'Power Run') {
      /* Needs a bruising RB, dominant T/G/C run blockers,
         blocking TE. QB doesn't need to be special. */
      if (pos === 'RB')
        fit +=
          attrScore(a.toughness, 82, 25) +
          attrScore(a.trucking || a.toughness, 80, 15) +
          attrScore(a.stiffArm || a.athleticism, 75, 5);
      if (pos === 'T') fit += attrScore(a.toughness, 80, 25) + attrScore(a.runBlock || a.toughness, 78, 15);
      if (pos === 'G') fit += attrScore(a.toughness, 80, 25) + attrScore(a.runBlock || a.toughness, 80, 15);
      if (pos === 'C')
        fit += attrScore(a.strength || a.toughness, 78, 20) + attrScore(a.runBlock || a.toughness, 75, 15);
      if (pos === 'TE') fit += attrScore(a.toughness, 78, 20) + attrScore(a.runBlock || a.toughness, 75, 10);
      if (pos === 'QB') fit += attrScore(a.toughness, 72, 10); /* pocket presence */
      if (pos === 'WR') fit += attrScore(a.toughness, 70, 8); /* blocks downfield */
    }

    /* OC quality adds up to ±8 */
    fit += Math.floor(((oc.offenseRating || 70) - 75) / 3);
  }

  /* ── DEFENSIVE POSITIONS ─────────────────────────────── */
  const DEF_POS = ['EDGE', 'DT', 'LB', 'CB', 'FS', 'SS'];
  if (DEF_POS.includes(pos)) {
    const scheme = dc.scheme || '';

    if (scheme === '4-3') {
      /* Two DTs hold the A/B gaps, 3 LBs roam, CBs in man/zone.
         Values disciplined, smart front seven. */
      if (pos === 'DT')
        fit +=
          attrScore(a.toughness, 80, 20) +
          attrScore(a.blockShedding || a.toughness, 78, 15) +
          attrScore(a.strength || a.toughness, 78, 10);
      if (pos === 'LB')
        fit +=
          attrScore(a.intelligence, 75, 25) +
          attrScore(a.tackle || a.toughness, 78, 15) +
          attrScore(a.playRecognition || a.intelligence, 75, 10);
      if (pos === 'EDGE')
        fit += attrScore(a.passRush || a.athleticism, 78, 20) + attrScore(a.speed || a.athleticism, 78, 10);
      if (pos === 'CB')
        fit += attrScore(a.manCoverage || a.discipline, 75, 20) + attrScore(a.tackle || a.toughness, 70, 10);
      if (pos === 'FS') fit += attrScore(a.zoneCoverage || a.intelligence, 75, 20);
      if (pos === 'SS')
        fit += attrScore(a.tackle || a.toughness, 75, 20) + attrScore(a.hitPower || a.toughness, 75, 10);
    }

    if (scheme === '3-4') {
      /* 3 DTs (including big NT), 4 LBs (2 OLBs must pass-rush),
         athletic EDGE who can set edge AND drop into zones. */
      if (pos === 'EDGE')
        fit +=
          attrScore(a.athleticism, 83, 25) +
          attrScore(a.passRush || a.athleticism, 80, 15) +
          attrScore(a.speed || a.athleticism, 78, 10);
      if (pos === 'DT')
        fit += attrScore(a.strength || a.toughness, 82, 25) /* NT eats blocks */ + attrScore(a.toughness, 80, 15);
      if (pos === 'LB')
        fit +=
          attrScore(a.discipline, 75, 20) +
          attrScore(a.athleticism, 78, 15) +
          attrScore(a.passRush || a.athleticism, 72, 10);
      if (pos === 'CB') fit += attrScore(a.manCoverage || a.discipline, 75, 15);
      if (pos === 'FS') fit += attrScore(a.athleticism, 78, 15) + attrScore(a.zoneCoverage || a.intelligence, 75, 15);
      if (pos === 'SS') fit += attrScore(a.athleticism, 78, 15);
    }

    if (scheme === 'Cover 2') {
      /* CBs own the flat zones, FS covers deep halves, LBs drop
         into hooks. Needs disciplined zone coverage everywhere. */
      if (pos === 'CB')
        fit +=
          attrScore(a.zoneCoverage || a.intelligence, 78, 25) +
          attrScore(a.discipline, 75, 15) +
          attrScore(a.tackle || a.toughness, 72, 10);
      if (pos === 'FS')
        fit +=
          attrScore(a.speed || a.athleticism, 80, 25) +
          attrScore(a.zoneCoverage || a.intelligence, 80, 20) +
          attrScore(a.catching || a.athleticism, 75, 10); /* range for INTs */
      if (pos === 'SS') fit += attrScore(a.discipline, 75, 15) + attrScore(a.zoneCoverage || a.intelligence, 72, 15);
      if (pos === 'LB') fit += attrScore(a.intelligence, 75, 15) + attrScore(a.zoneCoverage || a.discipline, 70, 10);
      if (pos === 'DT') fit += attrScore(a.toughness, 78, 15);
      if (pos === 'EDGE') fit += attrScore(a.passRush || a.athleticism, 75, 10);
    }

    if (scheme === 'Blitz Heavy') {
      /* Every snap is an attack. Needs explosive EDGE rushers,
         physical SS who can blitz, aggressive LBs. DBs must be
         able to survive in man coverage with no safety help. */
      if (pos === 'EDGE')
        fit +=
          attrScore(a.toughness, 82, 25) +
          attrScore(a.passRush || a.athleticism, 82, 20) +
          attrScore(a.hitPower || a.toughness, 78, 10);
      if (pos === 'LB')
        fit +=
          attrScore(a.athleticism, 78, 20) +
          attrScore(a.hitPower || a.toughness, 78, 15) +
          attrScore(a.passRush || a.athleticism, 72, 10);
      if (pos === 'SS') fit += attrScore(a.hitPower || a.toughness, 80, 25) + attrScore(a.athleticism, 78, 15);
      if (pos === 'CB') fit += attrScore(a.manCoverage || a.discipline, 78, 20); /* no safety help */
      if (pos === 'FS') fit += attrScore(a.manCoverage || a.athleticism, 75, 15);
      if (pos === 'DT')
        fit += attrScore(a.passRush || a.toughness, 75, 15) + attrScore(a.blockShedding || a.toughness, 75, 10);
    }

    /* DC quality adds up to ±8 */
    fit += Math.floor(((dc.defenseRating || 70) - 75) / 3);
  }

  return Math.max(0, Math.min(100, fit));
}

/* ------------------------------------------------------------
   4. Scheme Fit Effects on Morale + Chemistry
------------------------------------------------------------ */

function applySchemeFitMoraleEffects(team) {
  team.roster.forEach((player) => {
    const fit = calculateSchemeFit(player, team);

    if (fit >= 80) player.morale += randomInt(1, 3);
    else if (fit <= 40) player.morale -= randomInt(1, 3);

    player.morale = Math.max(0, Math.min(100, player.morale));
  });
}

function applySchemeFitChemistryEffects(team) {
  const avgFit = team.roster.reduce((sum, p) => sum + calculateSchemeFit(p, team), 0) / team.roster.length;

  if (avgFit >= 75) team.chemistry += 3;
  else if (avgFit <= 45) team.chemistry -= 3;

  team.chemistry = Math.max(0, Math.min(100, team.chemistry));
}

/* ------------------------------------------------------------
   5. Coordinator Free Agent Pool
------------------------------------------------------------ */

let coordinatorFreeAgents = [];

function generateCoordinatorFreeAgents() {
  coordinatorFreeAgents = [];

  for (let i = 0; i < 20; i++) {
    const coordType = Math.random() < 0.5 ? 'OC' : 'DC';
    /* OCs only get offensive schemes, DCs only get defensive schemes */
    const schemePool = coordType === 'OC' ? OFFENSIVE_SCHEMES : DEFENSIVE_SCHEMES;
    coordinatorFreeAgents.push({
      id: 'coordFA_' + i,
      name: generateRookieName(),
      offenseRating: randomInt(60, 95),
      defenseRating: randomInt(60, 95),
      leadership: randomInt(60, 95),
      type: coordType,
      scheme: schemePool[randomInt(0, schemePool.length - 1)],
    });
  }
}

/* ------------------------------------------------------------
   8. Initialize Coordinators on Load
------------------------------------------------------------ */

window.addEventListener('DOMContentLoaded', () => {
  initializeCoordinators();
});
