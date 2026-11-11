/* ============================================================
   TEAM CHEMISTRY SYSTEM (0–100) + PERFORMANCE EFFECTS
   ============================================================ */

/* ------------------------------------------------------------
   1. Initialize Chemistry for All Teams
------------------------------------------------------------ */

function initializeTeamChemistry() {
  const teams = listAllTeams(league);

  teams.forEach((team) => {
    if (team.chemistry === undefined) {
      team.chemistry = randomInt(55, 75); // baseline chemistry
      team.chemistryTrend = 0;
    }
  });
}

/* ------------------------------------------------------------
   3. Chemistry Effects on Team OVR
------------------------------------------------------------ */

function getTeamChemistryOVRModifier(team) {
  if (team.chemistry >= 85) return +5;
  if (team.chemistry >= 70) return +2;
  if (team.chemistry >= 50) return 0;
  if (team.chemistry >= 30) return -3;
  return -6;
}

/* ------------------------------------------------------------
   8. Initialize Chemistry on Load
------------------------------------------------------------ */

window.addEventListener('DOMContentLoaded', () => {
  initializeTeamChemistry();
});
