/* ============================================================
   TEAM NEEDS + CPU DRAFTING LOGIC
   ============================================================ */

/* ------------------------------------------------------------
   1. TEAM NEEDS MODEL
------------------------------------------------------------ */

function computeTeamNeeds(team) {
  const counts = {};
  POSITIONS.forEach((pos) => (counts[pos] = 0));

  team.roster.forEach((p) => {
    counts[p.positions[0]]++;
  });

  const needs = {};

  POSITIONS.forEach((pos) => {
    if (counts[pos] < 2)
      needs[pos] = 1.6; // Critical need
    else if (counts[pos] < 4)
      needs[pos] = 1.3; // Moderate need
    else if (counts[pos] < 6)
      needs[pos] = 1.1; // Mild need
    else needs[pos] = 0.8; // No need / surplus
  });

  return needs;
}
