/* ============================================================
   FA FIX + OVR DELTA + HOME TILE SYNC
   ============================================================ */
(function () {
  /* ── Type-safe FA player lookup ──────────────────────────
     IDs passed through onclick="fn('123')" arrive as strings.
     Stored IDs may be numbers or strings. Always compare as strings. */
  function findFA(playerId) {
    if (typeof freeAgents === 'undefined') return undefined;
    return freeAgents.find(function (x) {
      return String(x.id) === String(playerId);
    });
  }

  var _origRCO = window.renderContractOffer;
  if (typeof _origRCO === 'function') {
    window.renderContractOffer = function (playerId) {
      var p = findFA(playerId);
      if (p && typeof _origRCO === 'function') _origRCO(p.id);
    };
  }

  var _origSCO = window.submitContractOffer;
  if (typeof _origSCO === 'function') {
    window.submitContractOffer = function (playerId) {
      var p = findFA(playerId);
      if (p && typeof _origSCO === 'function') _origSCO(p.id);
    };
  }

  /* ── OVR Delta tracking ───────────────────────────────────
     Store each player's OVR at season start so we can show
     growth/regression deltas on the roster screen.           */

  function initSeasonOVR() {
    if (typeof league === 'undefined' || !league) return;
    listAllTeams(league).forEach(function (team) {
      team.roster.forEach(function (p) {
        /* Only set once per season — don't overwrite mid-season */
        if (p.seasonStartOVR === undefined || p._ovrSeasonSet !== window.simYear) {
          p.seasonStartOVR = p.attributes.overall;
          p._ovrSeasonSet = window.simYear || 1;
        }
      });
    });
  }

  /* Hook into game init */
  var _origInit = window.initPhase4Core;
  window.initPhase4Core = function () {
    if (typeof _origInit === 'function') _origInit();
    setTimeout(initSeasonOVR, 200);
  };

  /* Hook into new season start */
  var _origNS = window.beginNewSeason;
  window.beginNewSeason = function () {
    if (typeof _origNS === 'function') _origNS();
    /* beginNewSeason already increments simYear — do NOT increment again here */
    initSeasonOVR();
  };

  /* ── Override renderRoster to show OVR delta ─────────────
     Replaces the Patch 3 version with identical logic + delta. */

  /* Also show delta on player detail screen */
  var _origRPD = window.renderPlayerDetail;
  window.renderPlayerDetail = function (playerId) {
    /* Inject seasonStartOVR into the player before calling original
       so the delta is available if original ever uses it */
    if (typeof _origRPD === 'function') _origRPD(playerId);

    /* Patch the OVR badge in the already-rendered detail page */
    setTimeout(function () {
      var main = document.getElementById('main');
      if (!main) return;
      /* Find the player */
      var p = null;
      listAllTeams(league).forEach(function (t) {
        t.roster.forEach(function (x) {
          if (String(x.id) === String(playerId)) p = x;
        });
      });
      if (!p) return;
      var delta = p.seasonStartOVR !== undefined ? p.attributes.overall - p.seasonStartOVR : 0;
      if (delta === 0) return;

      /* Find the OVR badge div (contains the large OVR number) and
         append the delta label beneath it */
      var ovrDivs = main.querySelectorAll('div');
      ovrDivs.forEach(function (div) {
        if (div.textContent.trim() === String(p.attributes.overall) && div.style.fontSize === '26px') {
          if (!div.querySelector('.ovr-delta')) {
            var span = document.createElement('div');
            span.className = 'ovr-delta';
            span.style.cssText = 'font-size:11px;font-weight:600;color:' + (delta > 0 ? '#4ade80' : '#f87171');
            span.textContent = (delta > 0 ? '+' : '') + delta + ' this season';
            div.parentNode.appendChild(span);
          }
        }
      });
    }, 30);
  };

  /* Run OVR init once everything is loaded */
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(initSeasonOVR, 500);
  });
})();
