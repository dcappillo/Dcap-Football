/* ── Trade rejection message helper ─────────────────────────
   Explains clearly WHICH team is over/underpaying and by how
   much, so the user knows exactly what to adjust.            */
window._tradeMsg = function (teamBGivingMore, teamA, teamB, valA, valB) {
  var diff = Math.abs(valB - valA);
  var pct = Math.round((diff / Math.max(valA, valB)) * 100);

  if (teamBGivingMore) {
    /* Team B is sending more value than they receive — B rejects */
    return (
      teamB.city +
      ' ' +
      teamB.nickname +
      ' would send <strong>' +
      valB.toLocaleString() +
      ' pts</strong> in value but only receive <strong>' +
      valA.toLocaleString() +
      " pts</strong> — they'd be overpaying by <strong>" +
      diff.toLocaleString() +
      ' pts (' +
      pct +
      '%)</strong>. ' +
      'Add more to <em>' +
      teamA.nickname +
      "'s</em> side to balance it out."
    );
  } else {
    /* Team A is sending more value than they receive — A "rejects" */
    return (
      "You'd be sending <strong>" +
      valA.toLocaleString() +
      ' pts</strong> in value but only receiving <strong>' +
      valB.toLocaleString() +
      ' pts</strong> from ' +
      teamB.city +
      ' ' +
      teamB.nickname +
      " — you'd be overpaying by <strong>" +
      diff.toLocaleString() +
      ' pts (' +
      pct +
      '%)</strong>. ' +
      'Remove some of your assets or ask <em>' +
      teamB.nickname +
      '</em> for more.'
    );
  }
};
