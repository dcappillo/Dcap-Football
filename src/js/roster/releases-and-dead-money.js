/* ============================================================
   PLAYER RELEASES + DEAD MONEY + ROSTER SIZE ENFORCEMENT
   ============================================================ */

/* ------------------------------------------------------------
   1. Dead Money Calculation
------------------------------------------------------------ */

function calculateDeadMoney(player) {
  if (!player.contract) return 0;

  const remainingYears = player.contract.years;
  const remainingValue = player.contract.capHitPerYear * remainingYears;

  // Simple realistic model:
  // 40% of remaining contract accelerates as dead money
  const deadMoney = Math.round(remainingValue * 0.4);

  return deadMoney;
}

/* ------------------------------------------------------------
   2. Release Player (User)
------------------------------------------------------------ */

function releasePlayer(team, playerId) {
  const player = team.roster.find((p) => p.id === playerId);
  if (!player) return;

  const deadMoney = calculateDeadMoney(player);

  // Subtract current cap hit first, then apply dead money (net = dead - salary)
  team.capUsed -= player.contract ? player.contract.capHitPerYear || 0 : 0;
  team.capUsed += deadMoney;

  // Remove from roster
  team.roster = team.roster.filter((p) => p.id !== playerId);

  // Add to free agent pool
  player.isFreeAgent = true;
  freeAgents.push(player);

  alert(`${player.name} released. Dead money: $${deadMoney.toLocaleString()}`);
}

/* ------------------------------------------------------------
   4. CPU Release Logic
------------------------------------------------------------ */

const REQUIRED_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'T', 'G', 'C', 'EDGE', 'DT', 'LB', 'CB', 'FS', 'SS', 'K', 'P'];

function cpuShouldRelease(player, team) {
  const ovr = player.attributes.overall;
  const age = player.age;

  // Never cut the last player at a required depth-chart position
  const pos = player.positions[0];
  if (REQUIRED_POSITIONS.includes(pos)) {
    const count = team.roster.filter((p) => p.positions[0] === pos).length;
    if (count <= 1) return false;
  }

  // CPU avoids cutting rookies unless terrible
  if (player.isRookie && ovr >= 65) return false;

  // Cut very old + low OVR
  if (age >= 32 && ovr <= 70) return true;

  // Cut expensive underperformers
  if (player.contract && player.contract.capHitPerYear > ovr * 30000 && ovr < 75) {
    return Math.random() < 0.5;
  }

  // Cut depth players if overloaded
  const posCount = team.roster.filter((p) => p.positions[0] === pos).length;
  if (posCount > 6 && ovr < 72) return Math.random() < 0.3;

  return false;
}

/* ------------------------------------------------------------
   5. CPU Roster Cleanup
------------------------------------------------------------ */

function cpuRosterCleanup() {
  const teams = listAllTeams(league);

  teams.forEach((team) => {
    if (team.id === userTeamId) return;

    // 1. Release bad fits
    team.roster.slice().forEach((player) => {
      if (cpuShouldRelease(player, team)) {
        const deadMoney = calculateDeadMoney(player);
        team.capUsed += deadMoney;

        team.roster = team.roster.filter((p) => p.id !== player.id);
        player.isFreeAgent = true;
        freeAgents.push(player);
      }
    });

    // 2. Enforce roster size limits
    const MIN_ROSTER = 37;
    const MAX_ROSTER = 55;

    // If too small → sign depth players
    while (team.roster.length < MIN_ROSTER) {
      const fa = freeAgents.sort((a, b) => b.attributes.overall - a.attributes.overall)[0];
      if (!fa) break;

      const mv = calculateMarketValue(fa);
      if (team.capUsed + mv.capHitPerYear > team.salaryCap) break;

      fa.contract = {
        years: mv.years,
        totalValue: mv.totalValue,
        capHitPerYear: mv.capHitPerYear,
      };

      team.roster.push(fa);
      team.capUsed += mv.capHitPerYear;

      freeAgents = freeAgents.filter((p) => p.id !== fa.id);
    }

    // If too large → cut lowest OVR players
    while (team.roster.length > MAX_ROSTER) {
      const worst = team.roster.sort((a, b) => a.attributes.overall - b.attributes.overall)[0];
      const deadMoney = calculateDeadMoney(worst);

      team.capUsed -= worst.contract ? worst.contract.capHitPerYear || 0 : 0;
      team.capUsed += deadMoney;
      team.roster = team.roster.filter((p) => p.id !== worst.id);

      worst.isFreeAgent = true;
      freeAgents.push(worst);
    }
  });
}

/* ------------------------------------------------------------
   CPU Roster Completion
   Before each season, make sure every CPU team can field a full
   lineup with backups and carries a realistic roster size.
   Signs the best available free agent at each short position,
   or a generated veteran if the market has none.
------------------------------------------------------------ */

var CPU_ROSTER_TARGET = 53;

/** Players a CPU team wants at each position (starters plus backups). */
var CPU_DEPTH_TARGET = {
  QB: 3,
  RB: 4,
  WR: 6,
  TE: 3,
  T: 4,
  G: 4,
  C: 2,
  EDGE: 5,
  DT: 5,
  LB: 6,
  CB: 6,
  FS: 2,
  SS: 2,
  K: 1,
  P: 1,
};

function cpuSignForDepth(team, pos) {
  const best = freeAgents
    .filter((p) => p.positions[0] === pos)
    .sort((a, b) => b.attributes.overall - a.attributes.overall)[0];
  const player = best || generateMarketPlayer(pos);
  if (best) freeAgents = freeAgents.filter((p) => p.id !== best.id);

  // Depth signings are one-year deals; minimum salary keeps capped-out teams legal
  const mv = calculateMarketValue(player);
  const salary = team.capUsed + mv.capHitPerYear <= team.salaryCap ? mv.capHitPerYear : 750000;
  player.contract = { years: 1, totalValue: salary, capHitPerYear: salary };
  player.isFreeAgent = false;
  team.roster.push(player);
  team.capUsed += salary;
}

function cpuCompleteRosters() {
  listAllTeams(league).forEach((team) => {
    if (team.id === userTeamId) return;

    const count = (pos) => team.roster.filter((p) => p.positions[0] === pos).length;
    const positions = Object.keys(CPU_DEPTH_TARGET);

    // Every position covered: starters plus at least one backup
    positions.forEach((pos) => {
      const minimum = Math.min(CPU_DEPTH_TARGET[pos], (STARTER_SLOTS[pos] || 1) + 1);
      while (count(pos) < minimum) cpuSignForDepth(team, pos);
    });

    // Fill toward a full roster at the thinnest positions
    while (team.roster.length < CPU_ROSTER_TARGET) {
      const neediest = positions
        .map((pos) => ({ pos, gap: CPU_DEPTH_TARGET[pos] - count(pos) }))
        .sort((a, b) => b.gap - a.gap)[0];
      if (neediest.gap <= 0) break;
      cpuSignForDepth(team, neediest.pos);
    }
  });
}
