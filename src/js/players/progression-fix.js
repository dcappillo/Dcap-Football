/* ============================================================
   GRANULAR ATTRIBUTE GENERATION KEEPS OVERALL

   Root cause 1 — initGranularAttrs overwrites player.attributes.overall
   ─────────────────────────────────────────────────────────────────────
   When a player's granular attributes are generated for the first time
   (at page load or new-game start), calcPosOVR() is called and the
   result is written back to player.attributes.overall.  Because the
   granular attrs are generated with a random spread, calcPosOVR rarely
   returns exactly the same number as the original OVR.  The player
   therefore appears to gain or lose rating points before a single game
   has been simulated.

   Fix: wrap window.initGranularAttrs so the original OVR is preserved
   after the first-time generation.  OVR is still recalculated by
   applyPositionChange() when the user explicitly changes a position.

   ============================================================ */
(function () {
  /* ── Fix 1: preserve OVR through initGranularAttrs ────────── */

  var _origIGA = window.initGranularAttrs;
  window.initGranularAttrs = function (player) {
    /* If granularAttrs already exist, just return them — no change */
    if (player.granularAttrs) return player.granularAttrs;

    /* Save the current OVR before generation overwrites it */
    var savedOVR = player.attributes ? player.attributes.overall : undefined;

    var g = _origIGA(player); /* generates granular attrs + recalcs OVR */

    /* Restore original OVR — granular generation must not move the needle.
       OVR is intentionally recalculated ONLY when the user explicitly
       changes position via applyPositionChange().                         */
    if (savedOVR !== undefined && player.attributes) {
      player.attributes.overall = savedOVR;
    }

    return g;
  };
})();
