/* ============================================================
   COACH REGRESSION SAFEGUARD
   Coaches cannot regress below their season baseline.
   ============================================================ */

/* ------------------------------------------------------------
   1. Initialize season baselines at season start
------------------------------------------------------------ */

function initializeCoachSeasonBaselines() {
  const teams = listAllTeams(league);

  teams.forEach((team) => {
    const hc = team.coach;
    const oc = team.oc;
    const dc = team.dc;

    // Head Coach
    hc.seasonBaseOff = hc.offenseRating;
    hc.seasonBaseDef = hc.defenseRating;
    hc.seasonBaseLead = hc.leadership;

    // OC
    oc.seasonBaseOff = oc.offenseRating;

    // DC
    dc.seasonBaseDef = dc.defenseRating;
  });
}

/* ------------------------------------------------------------
   2. Clamp ratings but never below season baseline
------------------------------------------------------------ */

function clampCoachRatingWithBaseline(value, baseline) {
  /* Guard against undefined/NaN baseline — use 40 as the hard floor */
  var floor = typeof baseline === 'number' && !isNaN(baseline) ? baseline : 40;
  var v = typeof value === 'number' && !isNaN(value) ? value : floor;
  return Math.max(floor, Math.min(99, v));
}

/* ------------------------------------------------------------
   3. Patch OC Development
------------------------------------------------------------ */

function developOC(team, gameStats) {
  const oc = team.oc;
  if (!oc) return;

  const passYds = gameStats.passYds || 0;
  const passTD = gameStats.passTD || 0;
  const rushYds = gameStats.rushYds || 0;
  const rushTD = gameStats.rushTD || 0;

  let delta = 0;

  // Passing performance
  if (passYds >= 275) delta += 1;
  if (passYds >= 325) delta += 1;
  if (passTD >= 2) delta += 1;

  // Rushing performance
  if (rushYds >= 100) delta += 1;
  if (rushYds >= 150) delta += 1;
  if (rushTD >= 1) delta += 1;

  // Scheme fit bonus
  if (oc.scheme === 'Air Raid' && passYds >= 300) delta += 1;
  if (oc.scheme === 'Power Run' && rushYds >= 120) delta += 1;

  // Underperformance penalty (small)
  if (passYds < 150 && rushYds < 60) delta -= 1;

  const newRating = oc.offenseRating + delta;

  oc.offenseRating = clampCoachRatingWithBaseline(newRating, oc.seasonBaseOff);
}

/* ------------------------------------------------------------
   4. Patch DC Development
------------------------------------------------------------ */

function developDC(team, gameStats) {
  const dc = team.dc;
  if (!dc) return;

  const ptsAllowed = gameStats.ptsAllowed || 0;
  const sacks = gameStats.sacks || 0;
  const turnovers = gameStats.turnovers || 0;
  const yardsAllowed = gameStats.yardsAllowed || 0;

  let delta = 0;

  // Strong defensive performance
  if (ptsAllowed <= 20) delta += 1;
  if (ptsAllowed <= 14) delta += 1;
  if (sacks >= 3) delta += 1;
  if (turnovers >= 2) delta += 1;

  // Scheme fit bonuses
  if (dc.scheme === 'Blitz Heavy' && sacks >= 4) delta += 1;
  if (dc.scheme === 'Cover 2' && ptsAllowed <= 17) delta += 1;

  // Bad defensive performance (small)
  if (ptsAllowed >= 35) delta -= 1;
  if (yardsAllowed >= 450) delta -= 1;

  const newRating = dc.defenseRating + delta;

  dc.defenseRating = clampCoachRatingWithBaseline(newRating, dc.seasonBaseDef);
}

/* ------------------------------------------------------------
   5. Patch Head Coach Development
------------------------------------------------------------ */

function developHeadCoach(team, gameStats, didWin) {
  const hc = team.coach;
  if (!hc) return;

  let deltaOff = 0;
  let deltaDef = 0;
  let deltaLead = 0;

  // Overachieving offense
  if (gameStats.passYds >= 300 || gameStats.rushYds >= 120) deltaOff += 1;

  // Overachieving defense
  if (gameStats.ptsAllowed <= 17) deltaDef += 1;

  // Leadership grows on wins
  if (didWin) deltaLead += 1;

  // Blowout win
  if (didWin && gameStats.margin >= 17) {
    deltaOff += 1;
    deltaDef += 1;
    deltaLead += 1;
  }

  // Embarrassing loss (small penalty)
  if (!didWin && gameStats.margin <= -21) {
    deltaOff -= 1;
    deltaDef -= 1;
    deltaLead -= 1;
  }

  // Apply with baseline protection
  hc.offenseRating = clampCoachRatingWithBaseline(hc.offenseRating + deltaOff, hc.seasonBaseOff);

  hc.defenseRating = clampCoachRatingWithBaseline(hc.defenseRating + deltaDef, hc.seasonBaseDef);

  hc.leadership = clampCoachRatingWithBaseline(hc.leadership + deltaLead, hc.seasonBaseLead);
}
