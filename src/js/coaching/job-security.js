/* ============================================================
   COACHING CAROUSEL: JOB SECURITY + FIRINGS + HIRING
   ============================================================ */

/* ------------------------------------------------------------
   1. Coach Job Security
------------------------------------------------------------ */

function initializeCoachJobSecurity() {
  const teams = listAllTeams(league);

  teams.forEach((team) => {
    if (team.coach.jobSecurity === undefined) {
      // Baseline: mid-range security
      team.coach.jobSecurity = randomInt(55, 80);
    }
  });
}

function updateCoachJobSecurityAfterSeason(team) {
  const wins = team.wins || 0;
  const losses = team.losses || 0;
  const games = wins + losses || 1;
  const winPct = wins / games;

  let delta = 0;

  // Performance
  if (winPct >= 0.7) delta += 10;
  else if (winPct >= 0.5) delta += 3;
  else if (winPct >= 0.35) delta -= 5;
  else delta -= 12;

  // Chemistry influence
  if (team.chemistry >= 80) delta += 3;
  else if (team.chemistry <= 40) delta -= 5;

  team.coach.jobSecurity = Math.max(0, Math.min(100, team.coach.jobSecurity + delta));
}

/* ------------------------------------------------------------
   2. Coach Free Agent Pool
------------------------------------------------------------ */

let coachFreeAgents = [];

function generateCoachFreeAgents() {
  coachFreeAgents = [];

  for (let i = 0; i < 15; i++) {
    coachFreeAgents.push({
      id: 'coachFA_' + i,
      name: generateRookieName(), // reuse name generator
      offenseRating: randomInt(60, 95),
      defenseRating: randomInt(60, 95),
      leadership: randomInt(60, 95),
      style: Math.random() < 0.5 ? 'Offensive' : 'Defensive',
    });
  }
}

/* ------------------------------------------------------------
   3. Firing Logic
------------------------------------------------------------ */

function evaluateCoachFiring(team) {
  // Auto-fire if job security very low
  if (team.coach.jobSecurity <= 25) return true;

  // Very bad season + low chemistry
  const wins = team.wins || 0;
  const losses = team.losses || 0;
  const games = wins + losses || 1;
  const winPct = wins / games;

  if (winPct <= 0.3 && team.chemistry <= 45) {
    return Math.random() < 0.5;
  }

  return false;
}

/* ------------------------------------------------------------
   7. Initialize on Load
------------------------------------------------------------ */

window.addEventListener('DOMContentLoaded', () => {
  initializeCoachJobSecurity();
});
