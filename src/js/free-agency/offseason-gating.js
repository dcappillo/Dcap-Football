/* ============================================================
   GATE FREE AGENCY TO OFFSEASON ONLY

   Problem: cpuOffersForPlayer() runs any time the user makes
   an offer, including mid-season. CPU teams would outbid the
   user even in Week 3. FA should only be competitive during
   the designated offseason phase.

   Fix:
   1. window.gmPhase tracks 'season' | 'offseason'
   2. cpuOffersForPlayer() returns [] during season
   3. cpuSignPlayer() is a no-op during season
   4. renderFreeAgencyScreen() shows scout-mode banner
      with disabled offer buttons during the season
   5. Phase transitions set gmPhase correctly
   ============================================================ */
(function () {
  /* Default to 'season' — offseason is unlocked by the pipeline */
  window.gmPhase = window.gmPhase || 'season';

  /* ── Set offseason when FA phase opens ─────────────────── */
  var _prevBFAP = window.beginFreeAgencyPhase;
  window.beginFreeAgencyPhase = function () {
    window.gmPhase = 'offseason';
    if (typeof _prevBFAP === 'function') _prevBFAP();
  };

  /* ── Reset to season when new season starts ─────────────── */
  var _prevBNS = window.beginNewSeason;
  window.beginNewSeason = function () {
    window.gmPhase = 'season';
    if (typeof _prevBNS === 'function') _prevBNS();
  };

  /* ── Gate: cpuOffersForPlayer — no CPU bidding in-season ── */
  var _origCOFP = window.cpuOffersForPlayer || cpuOffersForPlayer;
  window.cpuOffersForPlayer = function (player) {
    if (window.gmPhase !== 'offseason') return [];
    return typeof _origCOFP === 'function' ? _origCOFP(player) : [];
  };

  /* ── Gate: cpuSignPlayer — no CPU signings in-season ────── */
  var _origCSP = window.cpuSignPlayer || cpuSignPlayer;
  window.cpuSignPlayer = function (player) {
    if (window.gmPhase !== 'offseason') return false;
    return typeof _origCSP === 'function' ? _origCSP(player) : false;
  };

  /* ── Gate: simulateFullFreeAgency — offseason only ──────── */
  var _origSFFA = window.simulateFullFreeAgency;
  window.simulateFullFreeAgency = function () {
    if (window.gmPhase !== 'offseason') return;
    if (typeof _origSFFA === 'function') _origSFFA();
  };

  /* ── Block user from submitting offers in-season too ────── */
  var _origSCO2 = window.submitContractOffer;
  window.submitContractOffer = function (playerId) {
    if (window.gmPhase !== 'offseason') {
      setMainContent(
        '<div class="welcome-hero">' +
          '<h2 style="color:#f87171">🚫 Signing Unavailable</h2>' +
          '<p style="color:var(--muted2);font-size:13px">Player signings are only allowed during the offseason free agency period. Finish the regular season first.</p>' +
          '<button onclick="renderFreeAgencyScreen()" style="margin-top:10px">← Back to Scouting</button>' +
          '</div>',
      );
      return;
    }
    if (typeof _origSCO2 === 'function') _origSCO2(playerId);
  };
})();
