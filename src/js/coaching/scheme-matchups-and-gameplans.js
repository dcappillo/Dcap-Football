/* ============================================================
   SCHEME MATCHUPS + GAMEPLANNING + COORDINATOR EFFECTS
   ============================================================ */

/* ------------------------------------------------------------
   1. Weekly Gameplan Options
------------------------------------------------------------ */

const GAMEPLANS = ['Balanced', 'Run Heavy', 'Pass Heavy', 'Aggressive Defense', 'Conservative Defense'];

function initializeGameplans() {
  const teams = listAllTeams(league);
  teams.forEach((team) => {
    if (!team.gameplan) team.gameplan = 'Balanced';
  });
}

/* ------------------------------------------------------------
   2. Gameplan UI
------------------------------------------------------------ */

function renderGameplanScreen() {
  const team = getTeamById(userTeamId);

  let html = `
    <h2>Weekly Gameplan</h2>
    <p class="small">Choose your team's strategic focus for this week.</p>

    <label>Select Gameplan:</label>
    <select id="gameplanSelect">
      ${GAMEPLANS.map((g) => `<option value="${g}" ${team.gameplan === g ? 'selected' : ''}>${g}</option>`).join('')}
    </select>

    <button onclick="applyGameplan()">Save Gameplan</button>
    <button onclick="renderRoster()">Back</button>
  `;

  setMainContent(html);
}

function applyGameplan() {
  const team = getTeamById(userTeamId);
  const gp = $('gameplanSelect').value;

  team.gameplan = gp;

  logTransaction('Gameplan', `${team.city} ${team.nickname} set gameplan to ${gp}`, team.id, null);

  renderRoster();
}

/* ------------------------------------------------------------
   3. Scheme Matchup Matrix
------------------------------------------------------------ */

function getSchemeMatchupModifier(offScheme, defScheme) {
  // Positive = offense advantage
  // Negative = defense advantage

  const matrix = {
    'Air Raid': {
      '4-3': +5,
      '3-4': +2,
      'Cover 2': -5,
      'Blitz Heavy': -8,
    },
    'West Coast': {
      '4-3': +2,
      '3-4': -2,
      'Cover 2': +6,
      'Blitz Heavy': -4,
    },
    Spread: {
      '4-3': +4,
      '3-4': +1,
      'Cover 2': -3,
      'Blitz Heavy': -6,
    },
    'Power Run': {
      '4-3': -2,
      '3-4': +8,
      'Cover 2': 0,
      'Blitz Heavy': -1,
    },
  };

  return matrix[offScheme]?.[defScheme] ?? 0;
}

/* ------------------------------------------------------------
   4. Coordinator Influence on Game Performance
------------------------------------------------------------ */

function getCoordinatorModifiers(team) {
  const oc = team.oc;
  const dc = team.dc;

  return {
    offenseBoost: Math.floor((oc.offenseRating - 75) / 3),
    defenseBoost: Math.floor((dc.defenseRating - 75) / 3),
    leadershipBoost: Math.floor((team.coach.leadership - 75) / 5),
  };
}

/* ------------------------------------------------------------
   5. Gameplan Effects on Win Probability
------------------------------------------------------------ */

function applyGameplanModifiers(baseChance, team) {
  /* Legacy gameplan field kept for compatibility */
  const gp = team.gameplan || 'Balanced';
  var mod = 0;

  /* Offensive style */
  if (gp === 'Run Heavy' || gp === 'Pass Heavy') mod += 2;

  /* Defensive style from weekly strategy (stored on team after each sim) */
  var defStyle = team._defStyle || 'Balanced';
  if (defStyle === 'Blitz Heavy') mod += 3;
  if (defStyle === 'Defend Run') mod += 1;
  if (defStyle === 'Defend Pass') mod += 1;

  return baseChance + mod;
}

/* ------------------------------------------------------------
   6. Full Game Simulation Modifier
------------------------------------------------------------ */

function calculateTeamGameModifier(team, opponent) {
  const ocScheme = team.oc.scheme;
  const dcScheme = team.dc.scheme;

  const oppOC = opponent.oc.scheme;
  const oppDC = opponent.dc.scheme;

  // Scheme matchup
  const offenseMatchup = getSchemeMatchupModifier(ocScheme, opponent.dc.scheme);
  const defenseMatchup = -getSchemeMatchupModifier(opponent.oc.scheme, dcScheme);

  // Coordinator ratings
  const coord = getCoordinatorModifiers(team);

  // Chemistry
  const chemMod = getTeamChemistryOVRModifier(team);

  // Gameplan
  let total =
    offenseMatchup + defenseMatchup + coord.offenseBoost + coord.defenseBoost + coord.leadershipBoost + chemMod;

  total = applyGameplanModifiers(total, team);

  return total;
}

/* ------------------------------------------------------------
   7. Integrate Into Game Simulation (Hook)
------------------------------------------------------------ */

const oldSimulateGame = simulateGame;

simulateGame = function (game, tMap, userStrat, uid) {
  // Base simulation
  let result = oldSimulateGame(game, tMap, userStrat, uid);
  if (!result) return result;

  // Resolve team objects from the game/teamMap args
  var tMapRef = tMap || (typeof teamMap !== 'undefined' ? teamMap : {});
  var teamA = game && tMapRef ? tMapRef[game.homeTeamId] : null;
  var teamB = game && tMapRef ? tMapRef[game.awayTeamId] : null;
  if (!teamA || !teamB) return result;

  // Apply scheme + coordinator modifiers
  const modA = calculateTeamGameModifier(teamA, teamB);
  const modB = calculateTeamGameModifier(teamB, teamA);

  // Adjust win probability
  result.teamAWinChance = (result.teamAWinChance || 50) + modA;
  result.teamBWinChance = (result.teamBWinChance || 50) + modB;

  // Normalize
  const total = result.teamAWinChance + result.teamBWinChance;
  result.teamAWinChance = (result.teamAWinChance / total) * 100;
  result.teamBWinChance = (result.teamBWinChance / total) * 100;

  return result;
};

window.addEventListener('DOMContentLoaded', initializeGameplans);
