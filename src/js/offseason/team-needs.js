/* ============================================================
   TEAM NEEDS
   How badly a team needs help at a position (0 = set, 1 = empty).
   Used by CPU drafting and trade logic.
   ============================================================ */

/* ------------------------------------------------------------
   3. Team Need Evaluation
------------------------------------------------------------ */

function getTeamNeedAtPosition(team, pos) {
  const playersAtPos = team.roster.filter((p) => p.positions[0] === pos);

  if (playersAtPos.length === 0) return 1.0;

  const avgOVR = playersAtPos.reduce((sum, p) => sum + p.attributes.overall, 0) / playersAtPos.length;

  if (avgOVR >= 85) return 0.0;
  if (avgOVR >= 80) return 0.2;
  if (avgOVR >= 75) return 0.5;
  if (avgOVR >= 70) return 0.7;
  return 1.0;
}
