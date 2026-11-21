/* ============================================================
   CONTRACT NEGOTIATION SYSTEM (3 ROUNDS + PERSONALITIES)
   ============================================================ */

/* ------------------------------------------------------------
   1. Assign Player Personalities
------------------------------------------------------------ */

const PERSONALITIES = ['Greedy', 'Loyal', 'RingChaser', 'SchemeFit', 'ShortDeal'];

function assignPersonality(player) {
  if (!player.personality) {
    player.personality = PERSONALITIES[randomInt(0, PERSONALITIES.length - 1)];
  }
}

/* ------------------------------------------------------------
   2. Negotiation State
------------------------------------------------------------ */

let negotiationState = {
  player: null,
  round: 1,
  userOffer: null,
  counterOffer: null,
};

/* ------------------------------------------------------------
   4. Player Interest Score
------------------------------------------------------------ */

function calculateInterest(player, team, salary, years) {
  const mv = calculateMarketValue(player);
  let score = salary / mv.capHitPerYear;

  // Personality modifiers
  switch (player.personality) {
    case 'Greedy':
      score *= 1.15;
      break;
    case 'Loyal':
      if (player.previousTeamId === team.id) score *= 1.2;
      break;
    case 'RingChaser':
      score += (team.wins - team.losses) / 10;
      break;
    case 'SchemeFit':
      if (['QB', 'WR', 'RB'].includes(player.positions[0])) {
        score += team.coach.offenseRating / 200;
      } else {
        score += team.coach.defenseRating / 200;
      }
      break;
    case 'ShortDeal':
      if (years <= 2) score *= 1.2;
      else score *= 0.9;
      break;
  }

  return score;
}

/* ------------------------------------------------------------
   5. Player Counteroffer Logic
------------------------------------------------------------ */

function generateCounterOffer(player, team) {
  const mv = calculateMarketValue(player);

  let salary = mv.capHitPerYear;
  let years = mv.years;

  // Personality adjustments
  if (player.personality === 'Greedy') salary *= 1.25;
  if (player.personality === 'ShortDeal') years = Math.min(2, years);

  salary = Math.round(salary);

  return { salary, years };
}

/* ------------------------------------------------------------
   6. Submit Negotiation Offer
------------------------------------------------------------ */

function submitNegotiationOffer() {
  const p = negotiationState.player;
  const team = getTeamById(userTeamId);

  const salary = parseInt($('negSalary').value);
  const years = parseInt($('negYears').value);

  const interest = calculateInterest(p, team, salary, years);

  negotiationState.userOffer = { salary, years };

  // Round 1 → Player counteroffers
  if (negotiationState.round === 1) {
    negotiationState.counterOffer = generateCounterOffer(p, team);

    let html = `
      <h2>Counteroffer from ${p.name}</h2>
      <p>They want: ${negotiationState.counterOffer.years} years,
      $${negotiationState.counterOffer.salary.toLocaleString()} per year.</p>

      <button onclick="renderNegotiationRound2()">Continue Negotiation</button>
      <button onclick="acceptCounterOffer()">Accept Counteroffer</button>
      <button onclick="renderFreeAgencyScreen()">Walk Away</button>
    `;

    negotiationState.round = 2;
    setMainContent(html);
    return;
  }

  // Round 2 → Final decision
  if (negotiationState.round === 2) {
    const counter = negotiationState.counterOffer;

    // If user beats counteroffer → accept
    if (salary >= counter.salary && years >= counter.years) {
      finalizeNegotiationSigning(team, p, salary, years);
      return;
    }

    // Otherwise → player chooses best offer
    const cpuOffers = cpuOffersForPlayer(p);
    const bestCPU = cpuOffers.length ? cpuOffers.sort((a, b) => b.score - a.score)[0] : null;

    const userScore = calculateInterest(p, team, salary, years);
    const cpuScore = bestCPU ? bestCPU.score : 0;

    if (userScore >= cpuScore) {
      finalizeNegotiationSigning(team, p, salary, years);
    } else {
      finalizeNegotiationSigning(bestCPU.team, p, bestCPU.salary, bestCPU.years);
    }
  }
}

/* ------------------------------------------------------------
   7. Round 2 Negotiation Screen
------------------------------------------------------------ */

function renderNegotiationRound2() {
  const p = negotiationState.player;
  const mv = calculateMarketValue(p);

  let html = `
    <h2>Final Offer — ${p.name}</h2>
    <p class="small">Counteroffer: ${negotiationState.counterOffer.years} years,
    $${negotiationState.counterOffer.salary.toLocaleString()} per year.</p>

    <label>Years:</label>
    <select id="negYears">
      <option value="1">1 year</option>
      <option value="2">2 years</option>
      <option value="3">3 years</option>
      <option value="4">4 years</option>
    </select>

    <label>Salary per year:</label>
    <input id="negSalary" type="number" value="${negotiationState.counterOffer.salary}" />

    <button onclick="submitNegotiationOffer()">Submit Final Offer</button>
    <button onclick="renderFreeAgencyScreen()">Walk Away</button>
  `;

  setMainContent(html);
}

/* ------------------------------------------------------------
   8. Accept Counteroffer
------------------------------------------------------------ */

function acceptCounterOffer() {
  const p = negotiationState.player;
  const team = getTeamById(userTeamId);
  const c = negotiationState.counterOffer;

  finalizeNegotiationSigning(team, p, c.salary, c.years);
}

/* ------------------------------------------------------------
   9. Finalize Signing
------------------------------------------------------------ */

function finalizeNegotiationSigning(team, player, salary, years) {
  player.contract = {
    years,
    totalValue: salary * years,
    capHitPerYear: salary,
  };

  team.roster.push(player);
  team.capUsed += salary;

  freeAgents = freeAgents.filter((p) => p.id !== player.id);

  logTransaction('Signing', `${team.city} ${team.nickname} signed ${player.name}`, team.id, player);

  let html = `
    <h2>Signed!</h2>
    <p>${player.name} has signed with the
    <strong>${team.city} ${team.nickname}</strong>.</p>

    <p>Contract: ${years} years,
    $${salary.toLocaleString()} per year</p>

    <button onclick="renderFreeAgencyScreen()">Back to Free Agency</button>
  `;

  setMainContent(html);
}
