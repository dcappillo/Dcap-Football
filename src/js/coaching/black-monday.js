/* ============================================================
   FULL COACHING CAROUSEL (BLACK MONDAY + POACHING + PROMOTIONS)
   ============================================================ */

/* ------------------------------------------------------------
   1. Coach Contract Structure
------------------------------------------------------------ */

function assignCoachContract(coach) {
  coach.contractYears = randomInt(2, 5);
  coach.contractRemaining = coach.contractYears;
}

/* ------------------------------------------------------------
   2. Build HC Candidate Pool (Promotions + Free Agents)
------------------------------------------------------------ */

let headCoachCandidates = [];

function buildHeadCoachCandidatePool() {
  headCoachCandidates = [];

  const teams = listAllTeams(league);

  // 1. Add coordinator promotions
  teams.forEach((team) => {
    const oc = team.oc;
    const dc = team.dc;

    // OC promotion candidate
    if (oc.offenseRating >= 80 || oc.leadership >= 75) {
      headCoachCandidates.push({
        name: oc.name,
        offenseRating: oc.offenseRating,
        defenseRating: randomInt(55, 75),
        leadership: randomInt(oc.leadership, 95),
        source: 'OC Promotion',
        id: 'HCcand_' + oc.name,
      });
    }

    // DC promotion candidate
    if (dc.defenseRating >= 80 || dc.leadership >= 75) {
      headCoachCandidates.push({
        name: dc.name,
        offenseRating: randomInt(55, 75),
        defenseRating: dc.defenseRating,
        leadership: randomInt(dc.leadership, 95),
        source: 'DC Promotion',
        id: 'HCcand_' + dc.name,
      });
    }
  });

  // 2. Add unemployed coaches
  coachFreeAgents.forEach((c) => {
    headCoachCandidates.push({
      name: c.name,
      offenseRating: c.offenseRating,
      defenseRating: c.defenseRating,
      leadership: c.leadership,
      source: 'Former HC',
      id: 'HCcand_FA_' + c.name,
    });
  });
}

/* ------------------------------------------------------------
   3. CPU Hiring Logic for Head Coaches
------------------------------------------------------------ */

function cpuHireHeadCoach(team) {
  if (headCoachCandidates.length === 0) buildHeadCoachCandidatePool();

  let best = null;
  let bestScore = -Infinity;

  headCoachCandidates.forEach((c) => {
    let score = c.leadership * 1.5;

    // Match team weakness
    const offWeak = (team.offenseOVR || 75) < (team.defenseOVR || 75);
    if (offWeak) score += c.offenseRating;
    else score += c.defenseRating;

    // Good teams attract better coaches
    score += (team.wins || 0) * 2;

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  });

  if (!best) return;

  team.coach = {
    name: best.name,
    offenseRating: best.offenseRating,
    defenseRating: best.defenseRating,
    leadership: best.leadership,
    jobSecurity: 60,
  };

  assignCoachContract(team.coach);

  logTransaction('Coach Hiring', `${team.city} ${team.nickname} hired ${best.name} as Head Coach`, team.id, null);

  // Remove from candidate pool
  headCoachCandidates = headCoachCandidates.filter((c) => c.id !== best.id);
}

/* ------------------------------------------------------------
   4. Coordinator Poaching (CPU steals your OC/DC)
------------------------------------------------------------ */

function cpuPoachCoordinators() {
  const teams = listAllTeams(league);

  teams.forEach((team) => {
    // Skip user team for hiring, but they can be poached FROM
    const candidates = [];

    // Add all OCs/DCs from all teams
    teams.forEach((t) => {
      if (t.id !== team.id) {
        candidates.push({
          coach: t.oc,
          type: 'OC',
          team: t,
        });
        candidates.push({
          coach: t.dc,
          type: 'DC',
          team: t,
        });
      }
    });

    // Pick best coordinator
    let best = null;
    let bestScore = -Infinity;

    candidates.forEach((c) => {
      let score = c.coach.leadership * 1.2;

      if (c.type === 'OC') score += c.coach.offenseRating;
      else score += c.coach.defenseRating;

      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    });

    if (!best) return;

    // Poach coordinator
    if (best.type === 'OC') {
      team.oc = {
        name: best.coach.name,
        offenseRating: best.coach.offenseRating,
        scheme: best.coach.scheme,
        jobSecurity: 60,
      };
    } else {
      team.dc = {
        name: best.coach.name,
        defenseRating: best.coach.defenseRating,
        scheme: best.coach.scheme,
        jobSecurity: 60,
      };
    }

    logTransaction(
      'Coordinator Poached',
      `${team.city} ${team.nickname} poached ${best.coach.name} from ${best.team.city} ${best.team.nickname}`,
      team.id,
      null,
    );
  });
}
