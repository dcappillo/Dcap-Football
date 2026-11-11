/* ============================================================
   CONTRACT OFFERS + PLAYER ACCEPTANCE LOGIC
   ============================================================ */

/* ------------------------------------------------------------
   2. Contract Offer Screen
------------------------------------------------------------ */

function renderContractOffer(playerId) {
  const p = freeAgents.find((x) => x.id === playerId);
  const mv = calculateMarketValue(p);

  let html = `
    <h2>Offer Contract — ${p.name}</h2>
    <p class="small">Market value: $${mv.capHitPerYear.toLocaleString()} / yr</p>

    <label>Years:</label>
    <select id="offerYears">
      <option value="1">1 year</option>
      <option value="2">2 years</option>
      <option value="3">3 years</option>
      <option value="4">4 years</option>
    </select>

    <label>Salary per year:</label>
    <input id="offerSalary" type="number" value="${mv.capHitPerYear}" />

    <button onclick="submitContractOffer('${p.id}')">Submit Offer</button>
    <button onclick="renderFreeAgencyScreen()">Back</button>
  `;

  setMainContent(html);
}

/* ------------------------------------------------------------
   3. Player Acceptance Logic
------------------------------------------------------------ */

function evaluateOffer(player, team, salary, years) {
  const mv = calculateMarketValue(player);

  // Salary competitiveness
  let score = salary / mv.capHitPerYear;

  // Team record attractiveness
  const recordScore = (team.wins - team.losses) / 10;
  score += recordScore;

  // Coach quality
  const coachScore = (team.coach.offenseRating + team.coach.defenseRating + team.coach.leadership) / 300;
  score += coachScore;

  // Scheme fit (simple: QB, WR, RB prefer high offense rating)
  if (['QB', 'WR', 'RB'].includes(player.positions[0])) {
    score += team.coach.offenseRating / 200;
  }

  // Age curve: older players prefer longer deals
  if (player.age >= 29 && years >= 3) score += 0.2;

  return score;
}

/* ------------------------------------------------------------
   4. CPU Teams Make Competing Offers
------------------------------------------------------------ */

function cpuOffersForPlayer(player) {
  const teams = listAllTeams(league);

  const offers = [];

  teams.forEach((team) => {
    if (team.id === userTeamId) return; // user handled separately

    // CPU only bids if they need the position
    const needs = computeTeamNeeds(team);
    const needFactor = needs[player.positions[0]];

    if (needFactor < 1.0) return; // not interested

    const mv = calculateMarketValue(player);

    // CPU offer salary
    let salary = mv.capHitPerYear * (0.9 + Math.random() * 0.4); // 90%–130% of MV
    salary = Math.round(salary);

    // CPU offer years
    let years = mv.years;
    if (Math.random() < 0.2) years += 1; // sometimes offer longer deals

    // Cap check
    if (team.capUsed + salary > team.salaryCap) return;

    const score = evaluateOffer(player, team, salary, years);

    offers.push({
      team,
      salary,
      years,
      score,
    });
  });

  return offers;
}

/* ------------------------------------------------------------
   5. Submit Contract Offer
------------------------------------------------------------ */

function submitContractOffer(playerId) {
  const player = freeAgents.find((p) => p.id === playerId);
  const team = getTeamById(userTeamId);

  const salary = parseInt($('offerSalary').value);
  const years = parseInt($('offerYears').value);

  // Cap check
  if (team.capUsed + salary > team.salaryCap) {
    alert('You do not have enough cap space.');
    return;
  }

  // User offer
  const userScore = evaluateOffer(player, team, salary, years);

  // CPU offers
  const cpu = cpuOffersForPlayer(player);

  // Determine winner
  let bestOffer = {
    team,
    salary,
    years,
    score: userScore,
  };

  cpu.forEach((o) => {
    if (o.score > bestOffer.score) bestOffer = o;
  });

  // Apply signing
  player.contract = {
    years: bestOffer.years,
    totalValue: bestOffer.salary * bestOffer.years,
    capHitPerYear: bestOffer.salary,
  };

  bestOffer.team.roster.push(player);
  bestOffer.team.capUsed += bestOffer.salary;

  // Remove from FA pool
  freeAgents = freeAgents.filter((p) => p.id !== player.id);

  // Feedback
  let html = `
    <h2>Signing Result</h2>
    <p>${player.name} has signed with the
    <strong>${bestOffer.team.city} ${bestOffer.team.nickname}</strong>.</p>

    <p>Contract: ${bestOffer.years} years,
    $${bestOffer.salary.toLocaleString()} per year</p>

    <button onclick="renderFreeAgencyScreen()">Back to Free Agency</button>
  `;

  setMainContent(html);
  /* Fire signing animation only when user's team got the player */
  if (bestOffer.team.id === userTeamId) {
    setTimeout(function () {
      if (typeof window._ctxAnimate === 'function') window._ctxAnimate('signing');
    }, 120);
  }
}
