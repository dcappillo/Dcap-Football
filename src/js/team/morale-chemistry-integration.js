/* ============================================================
   MORALE + CHEMISTRY INTEGRATION WITH FA, TRADES, CONTRACTS
   ============================================================ */

/* ------------------------------------------------------------
   1. Morale Impact on Free Agency Interest
------------------------------------------------------------ */

function applyMoraleToFAInterest(player, baseInterest) {
  // Low morale players want a fresh start
  if (player.morale <= 40) baseInterest += 0.15;

  // High morale players prefer stability
  if (player.morale >= 80) baseInterest -= 0.1;

  return baseInterest;
}

/* ------------------------------------------------------------
   2. Chemistry Impact on Free Agency Interest
------------------------------------------------------------ */

function applyChemistryToFAInterest(team, baseInterest) {
  if (team.chemistry >= 80)
    baseInterest += 0.2; // destination team
  else if (team.chemistry >= 60) baseInterest += 0.05;
  else if (team.chemistry >= 40) baseInterest -= 0.1;
  else baseInterest -= 0.2; // toxic locker room

  return baseInterest;
}

/* ------------------------------------------------------------
   3. Integrate Morale + Chemistry into FA Acceptance
------------------------------------------------------------ */

const oldEvaluateOffer = evaluateOffer;

evaluateOffer = function (player, team, salary, years) {
  let score = oldEvaluateOffer(player, team, salary, years);

  // Morale factor
  score = applyMoraleToFAInterest(player, score);

  // Chemistry factor
  score = applyChemistryToFAInterest(team, score);

  return score;
};

/* ------------------------------------------------------------
   4. Morale Impact on Contract Negotiations
------------------------------------------------------------ */

function applyMoraleToNegotiationDifficulty(player, baseScore) {
  if (player.morale >= 80) return baseScore * 1.1; // easier to sign
  if (player.morale <= 40) return baseScore * 0.85; // harder to sign
  return baseScore;
}

const oldCalculateInterest = calculateInterest;

calculateInterest = function (player, team, salary, years) {
  let score = oldCalculateInterest(player, team, salary, years);
  return applyMoraleToNegotiationDifficulty(player, score);
};

/* ------------------------------------------------------------
   5. Chemistry Impact on Negotiations
------------------------------------------------------------ */

function applyChemistryToNegotiation(team, baseScore) {
  if (team.chemistry >= 80) return baseScore * 1.15;
  if (team.chemistry <= 40) return baseScore * 0.85;
  return baseScore;
}

const oldCalculateInterest2 = calculateInterest;

calculateInterest = function (player, team, salary, years) {
  let score = oldCalculateInterest2(player, team, salary, years);
  score = applyChemistryToNegotiation(team, score);
  return score;
};

/* ------------------------------------------------------------
   6. Morale Effects After Trades
------------------------------------------------------------ */

function applyTradeMoraleEffects(player, oldTeam, newTeam) {
  // Leaving a contender hurts morale
  if (oldTeam.chemistry >= 75) player.morale -= randomInt(3, 6);

  // Joining a contender boosts morale
  if (newTeam.chemistry >= 75) player.morale += randomInt(3, 6);

  // Being traded unexpectedly hurts morale
  player.morale -= randomInt(1, 4);

  // Cap morale between 0–100
  player.morale = Math.max(0, Math.min(100, player.morale));
}

/* ------------------------------------------------------------
   7. Integrate Morale Effects into Trade Execution
------------------------------------------------------------ */

const oldExecuteTrade2 = executeTrade;

executeTrade = function (teamA, teamB, playersA, playersB, picksA, picksB) {
  oldExecuteTrade2(teamA, teamB, playersA, playersB, picksA, picksB);

  // Apply morale effects for traded players
  playersA.forEach((p) => applyTradeMoraleEffects(p, teamA, teamB));
  playersB.forEach((p) => applyTradeMoraleEffects(p, teamB, teamA));
};

/* ------------------------------------------------------------
   8. Trade Requests (Low Morale)
------------------------------------------------------------ */

function checkForTradeRequests(team) {
  const requests = [];

  team.roster.forEach((player) => {
    if (player.morale <= 25 && Math.random() < 0.15) {
      requests.push(player);
    }
  });

  return requests;
}

function renderTradeRequests() {
  const team = getTeamById(userTeamId);
  const requests = checkForTradeRequests(team);

  if (requests.length === 0) {
    alert('No players are requesting trades.');
    return;
  }

  let html = `
    <h2>Trade Requests</h2>
    <p class="small">These players want out due to low morale.</p>

    <ul>
  `;

  requests.forEach((p) => {
    html += `<li>${p.name} (${p.positions[0]}, OVR ${p.attributes.overall})</li>`;
  });

  html += `
    </ul>
    <button onclick="renderRoster()">Back</button>
  `;

  setMainContent(html);
}
