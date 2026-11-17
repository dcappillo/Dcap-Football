/* ============================================================
   DEPTH CHART SYSTEM
   Organise the user's roster by position with starter /
   backup / depth slots. Players can be reordered with ▲ / ▼.
   ============================================================ */

/* ── Ensure every player on a team has a depth-chart rank ── */
function ensureDepthChart(team) {
  var byPos = {};
  POSITIONS.forEach(function (pos) {
    byPos[pos] = [];
  });

  team.roster.forEach(function (p) {
    var pos = p.positions[0];
    if (byPos[pos]) byPos[pos].push(p);
  });

  POSITIONS.forEach(function (pos) {
    var group = byPos[pos];
    /* Sort: existing ranks first, then by OVR for unranked players */
    group.sort(function (a, b) {
      var ra = a.depthChartRank != null ? a.depthChartRank : 999;
      var rb = b.depthChartRank != null ? b.depthChartRank : 999;
      if (ra !== rb) return ra - rb;
      return b.attributes.overall - a.attributes.overall;
    });
    /* Re-number sequentially to keep ranks tidy */
    group.forEach(function (p, i) {
      p.depthChartRank = i + 1;
    });
  });
}

/* ── Move a player one slot up in their position group ─── */
/* ── Tap-to-select, tap-to-swap depth chart ──────────────────
   First tap  : select a player (highlighted).
   Second tap : swap selected player with tapped player
                (must be in the same position group).
   Same player: deselect.
──────────────────────────────────────────────────────────── */
window._dcSelectedId = null;

window.dcSelectPlayer = function (playerId) {
  var sel = window._dcSelectedId;

  /* Save scroll position so the page doesn't jump to top on re-render */
  function _rdcKeepScroll() {
    var m = document.getElementById('main');
    var savedTop = m ? m.scrollTop : 0;
    renderDepthChart();
    if (m) m.scrollTop = savedTop;
  }

  /* Tapping the already-selected player = deselect */
  if (sel && String(sel) === String(playerId)) {
    window._dcSelectedId = null;
    _rdcKeepScroll();
    return;
  }

  var team = getTeamById(userTeamId);
  if (!team) return;

  /* If nothing selected yet, just select this player */
  if (!sel) {
    window._dcSelectedId = playerId;
    _rdcKeepScroll();
    return;
  }

  /* A different player is already selected — attempt swap */
  var pA = team.roster.find(function (p) {
    return String(p.id) === String(sel);
  });
  var pB = team.roster.find(function (p) {
    return String(p.id) === String(playerId);
  });

  if (!pA || !pB) {
    window._dcSelectedId = null;
    _rdcKeepScroll();
    return;
  }

  /* Must be same position group */
  if (pA.positions[0] !== pB.positions[0]) {
    /* Different position — start a fresh selection */
    window._dcSelectedId = playerId;
    _rdcKeepScroll();
    return;
  }

  /* Swap their depthChartRanks */
  var tmp = pA.depthChartRank;
  pA.depthChartRank = pB.depthChartRank;
  pB.depthChartRank = tmp;

  window._dcSelectedId = null;
  _rdcKeepScroll();
};

/* ── Wire button on DOMContentLoaded ───────────────────── */
window.addEventListener('DOMContentLoaded', function () {
  var btn = document.getElementById('btnDepthChart');
  if (btn) btn.addEventListener('click', renderDepthChart);
});
