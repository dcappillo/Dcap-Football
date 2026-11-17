/* ── Auto-sync playbook dropdowns to match current coordinator schemes ──
   When the page loads or a team is selected, pre-set the offensive and
   defensive playbook dropdowns to the coordinator's current scheme.
   The user can still override — this just gives them the optimal default. */
(function () {
  function syncPlaybookDropdowns() {
    var tid = document.getElementById('teamSelect');
    if (!tid || !tid.value) return;
    var team = typeof getTeamById === 'function' ? getTeamById(tid.value) : null;
    if (!team) return;

    var offPB = document.getElementById('offPlaybook');
    var defPB = document.getElementById('defPlaybook');

    if (offPB && team.oc && team.oc.scheme) {
      offPB.value = team.oc.scheme;
    }
    if (defPB && team.dc && team.dc.scheme) {
      defPB.value = team.dc.scheme;
    }
  }

  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(syncPlaybookDropdowns, 400);

    /* Re-sync when team changes */
    var sel = document.getElementById('teamSelect');
    if (sel)
      sel.addEventListener('change', function () {
        setTimeout(syncPlaybookDropdowns, 100);
      });
  });

  /* Expose so it can be called after hiring a new coordinator */
  window.syncPlaybookDropdowns = syncPlaybookDropdowns;
})();
