/* ============================================================
   DYNAMIC PLAYER + PICK TRADING SYSTEM
   ============================================================ */

/* ------------------------------------------------------------
   8. Execute Trade
------------------------------------------------------------ */

function executeTrade(teamA, teamB, playersA, playersB, picksA, picksB) {
  // Swap players
  playersA.forEach((p) => {
    teamA.roster = teamA.roster.filter((x) => x.id !== p.id);
    teamB.roster.push(p);
  });
  playersB.forEach((p) => {
    teamB.roster = teamB.roster.filter((x) => x.id !== p.id);
    teamA.roster.push(p);
  });

  // Swap picks
  picksA.forEach((pk) => {
    const key = `${pk.round}-${pk.pick}`;
    draftTrades[key] = { from: teamA.id, to: teamB.id };
  });
  picksB.forEach((pk) => {
    const key = `${pk.round}-${pk.pick}`;
    draftTrades[key] = { from: teamB.id, to: teamA.id };
  });

  renderTradePicksUI();
}
