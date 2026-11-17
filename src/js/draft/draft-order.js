/* ============================================================
   DRAFT ORDER SYSTEM
   ============================================================ */

let draftOrder = []; // Stores team IDs in draft order
let draftRound = 1; // Current round (1–7)
let draftIndex = 0; // Index within the round

/* ------------------------------------------------------------
   Calculate Draft Order (Worst → Best)
------------------------------------------------------------ */
function calculateDraftOrder() {
  const teams = listAllTeams(league);

  // Sort by record, then point differential
  teams.sort((a, b) => {
    const winA = a.wins,
      winB = b.wins;
    if (winA !== winB) return winA - winB; // worst first

    const diffA = a.pointsFor - a.pointsAgainst;
    const diffB = b.pointsFor - b.pointsAgainst;
    return diffA - diffB; // worst differential first
  });

  draftOrder = teams.map((t) => t.id);
  draftRound = 1;
  draftIndex = 0;
}
