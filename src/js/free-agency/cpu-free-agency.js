/* ============================================================
   CPU FREE AGENCY PERIOD (WAVES)
   ============================================================ */

/* ------------------------------------------------------------
   1. CPU Offer Generator
------------------------------------------------------------ */

function cpuGenerateOffer(player, team) {
  const mv = calculateMarketValue(player);
  const needs = computeTeamNeeds(team);

  // CPU only bids if they need the position
  const needFactor = needs[player.positions[0]];
  if (needFactor < 1.0) return null;

  // CPU salary offer (90%–140% of MV)
  let salary = mv.capHitPerYear * (0.9 + Math.random() * 0.5);
  salary = Math.round(salary);

  // CPU years (based on MV)
  let years = mv.years;
  if (Math.random() < 0.2) years += 1;

  // Cap check
  if (team.capUsed + salary > team.salaryCap) return null;

  const score = evaluateOffer(player, team, salary, years);

  return {
    team,
    salary,
    years,
    score,
  };
}

/* ------------------------------------------------------------
   2. CPU Signs a Single Player
------------------------------------------------------------ */

function cpuSignPlayer(player) {
  const teams = listAllTeams(league);

  const offers = [];

  teams.forEach((team) => {
    if (team.id === userTeamId) return; // user handled separately

    const offer = cpuGenerateOffer(player, team);
    if (offer) offers.push(offer);
  });

  if (offers.length === 0) return false;

  // Best offer wins
  offers.sort((a, b) => b.score - a.score);
  const best = offers[0];

  // Apply signing
  player.contract = {
    years: best.years,
    totalValue: best.salary * best.years,
    capHitPerYear: best.salary,
  };

  best.team.roster.push(player);
  best.team.capUsed += best.salary;

  // Remove from FA pool
  freeAgents = freeAgents.filter((p) => p.id !== player.id);

  return true;
}

/* ------------------------------------------------------------
   3. CPU Free Agency Waves
------------------------------------------------------------ */

function simulateFreeAgencyWave(minOVR, maxOVR) {
  const targets = freeAgents.filter((p) => p.attributes.overall >= minOVR && p.attributes.overall <= maxOVR);

  // Shuffle to avoid deterministic patterns
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }

  targets.forEach((player) => {
    cpuSignPlayer(player);
  });
}

/* ------------------------------------------------------------
   4. Full CPU Free Agency Simulation
------------------------------------------------------------ */

function simulateFullFreeAgency() {
  if (freeAgents.length === 0) generateFreeAgentPool();

  // Wave 1: Elite players (85+)
  simulateFreeAgencyWave(85, 99);

  // Wave 2: Starters (78–84)
  simulateFreeAgencyWave(78, 84);

  // Wave 3: Depth players (70–77)
  simulateFreeAgencyWave(70, 77);

  // Wave 4: Camp bodies (below 70)
  simulateFreeAgencyWave(0, 69);

  renderFreeAgencyResults();
}

/* ------------------------------------------------------------
   5. Free Agency Results Screen
------------------------------------------------------------ */

function renderFreeAgencyResults() {
  let html = `
    <h2>Free Agency Complete</h2>
    <p class="small">CPU teams have signed players based on needs and cap space.</p>

    <button onclick="renderFreeAgencyScreen()">View Remaining Free Agents</button>
  `;

  setMainContent(html);
}
