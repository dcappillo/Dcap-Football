/* ============================================================
   DRAFT PICK REGISTRY: COMPLETE RECONNECTION FIX

   Three root causes fixed:
   1. initDraftPicks only generated picks for simYear+1.
      Now generates picks for next 3 draft years so multi-year
      trading works correctly.
   2. Two parallel pick systems (old draftTrades + new pickRegistry)
      never connected. Old system now routes through pickRegistry.
   3. Trade center and draft screen read from different sources.
      Everything now reads from a single pickRegistry.
   ============================================================ */
(function () {
  /* ── 1. Override initDraftPicks to generate 3 years of picks ─ */
  window.initDraftPicks = function () {
    if (typeof league === 'undefined' || !league) return;
    if (!window.pickRegistry) window.pickRegistry = {};

    var baseYear = window.simYear || 1;

    /* Generate picks for years +1, +2, +3 */
    for (var yOff = 1; yOff <= 3; yOff++) {
      var yr = baseYear + yOff;

      listAllTeams(league).forEach(function (t) {
        if (!window.pickRegistry[t.id]) window.pickRegistry[t.id] = [];

        for (var r = 1; r <= 7; r++) {
          var pid = t.id + '_R' + r + '_Y' + yr;

          /* Only add if not already in registry (preserves traded state) */
          var exists = false;
          Object.keys(window.pickRegistry).forEach(function (tid) {
            if (!exists) {
              (window.pickRegistry[tid] || []).forEach(function (pk) {
                if (pk.pickId === pid) exists = true;
              });
            }
          });

          if (!exists) {
            window.pickRegistry[t.id].push({
              pickId: pid,
              round: r,
              year: yr,
              origOwner: t.id,
              curOwner: t.id,
            });
          }
        }
      });
    }
  };

  /* ── 2. picksOwnedBy — scans full registry for curOwner match ─ */
  window.picksOwnedBy = function (teamId) {
    var out = [];
    Object.keys(window.pickRegistry || {}).forEach(function (tid) {
      (window.pickRegistry[tid] || []).forEach(function (pk) {
        if (pk.curOwner === teamId) out.push(pk);
      });
    });
    return out.sort(function (a, b) {
      return a.year !== b.year ? a.year - b.year : a.round - b.round;
    });
  };

  /* ── 3. transferPick — moves pick between registry buckets ───── */
  window.transferPick = function (pickId, fromId, toId) {
    if (!window.pickRegistry) return false;

    /* Search all buckets — pick may have been traded already */
    var found = null,
      foundBucket = null;
    Object.keys(window.pickRegistry).forEach(function (tid) {
      (window.pickRegistry[tid] || []).forEach(function (pk, i) {
        if (pk.pickId === pickId && !found) {
          found = pk;
          foundBucket = tid;
        }
      });
    });

    if (!found) return false;

    /* Remove from current bucket */
    window.pickRegistry[foundBucket] = window.pickRegistry[foundBucket].filter(function (pk) {
      return pk.pickId !== pickId;
    });

    /* Update ownership */
    found.curOwner = toId;

    /* Add to new owner's bucket */
    if (!window.pickRegistry[toId]) window.pickRegistry[toId] = [];
    window.pickRegistry[toId].push(found);

    return true;
  };

  /* ── 4. pickValueById — reads round from registry ────────────── */
  var PICK_VALUES_R = [3200, 1600, 800, 400, 200, 100, 50];
  window.pickValueById = function (pickId) {
    var found = null;
    Object.keys(window.pickRegistry || {}).forEach(function (tid) {
      (window.pickRegistry[tid] || []).forEach(function (pk) {
        if (pk.pickId === pickId) found = pk;
      });
    });
    if (found) {
      var yearDiff = Math.max(0, (found.year || 2) - ((window.simYear || 1) + 1));
      var base = PICK_VALUES_R[(found.round || 4) - 1] || 50;
      return Math.round(base * Math.pow(0.9, yearDiff));
    }
    /* Fallback: parse round from ID string */
    var m = pickId.match(/_R(\d+)_/);
    return PICK_VALUES_R[(m ? parseInt(m[1]) : 4) - 1] || 50;
  };

  /* ── 5. buildDraftPickList — uses registry for traded picks ───── */
  window._buildDraftPickList = function () {
    if (typeof league === 'undefined' || !league) return [];

    /* Ensure picks exist for this draft year */
    window.initDraftPicks();

    var yr = (window.simYear || 1) + 1;

    /* Sort teams worst → best for draft order */
    var teams = listAllTeams(league)
      .slice()
      .sort(function (a, b) {
        if (a.wins !== b.wins) return a.wins - b.wins;
        return a.pointsFor - a.pointsAgainst - (b.pointsFor - b.pointsAgainst);
      });

    /* Build lookup of ALL registry picks for this year */
    var regMap = {};
    Object.keys(window.pickRegistry || {}).forEach(function (tid) {
      (window.pickRegistry[tid] || []).forEach(function (pk) {
        if (pk.year === yr) regMap[pk.pickId] = pk;
      });
    });

    var list = [];
    for (var round = 1; round <= 7; round++) {
      teams.forEach(function (origTeam, slot) {
        var pickId = origTeam.id + '_R' + round + '_Y' + yr;
        var regPick = regMap[pickId];
        list.push({
          pickId: pickId,
          round: round,
          slot: slot + 1,
          origOwner: origTeam.id,
          curOwner: regPick ? regPick.curOwner : origTeam.id,
          year: yr,
        });
      });
    }

    return list; /* 224 entries */
  };

  /* Patch calculateDraftOrder to use the new builder */
  var _origCDO = window.calculateDraftOrder;
  window.calculateDraftOrder = function () {
    if (typeof _origCDO === 'function') _origCDO();
    window._draftPickList = window._buildDraftPickList();
    window._draftAbsIndex = 0;
    draftRound = 1;
    draftIndex = 0;
  };

  /* ── 6. _consumePick — removes pick from registry after it's used ─ */
  window._consumePick = function (absIdx) {
    var pl = window._draftPickList;
    var pick = pl && pl[absIdx];
    if (!pick) return;
    Object.keys(window.pickRegistry || {}).forEach(function (tid) {
      window.pickRegistry[tid] = (window.pickRegistry[tid] || []).filter(function (pk) {
        return pk.pickId !== pick.pickId;
      });
    });
  };

  /* ── 7. Auto-init picks on game start and after load ─────────── */
  var _origIPHC = window.initPhase4Core;
  window.initPhase4Core = function () {
    if (typeof _origIPHC === 'function') _origIPHC();
    setTimeout(function () {
      if (!window.pickRegistry) window.pickRegistry = {};
      window.initDraftPicks();
    }, 300);
  };

  /* Re-init after save/load */
  var _origDL = window._doLoad;
  window._doLoad = function (slotIdx) {
    if (typeof _origDL === 'function') _origDL(slotIdx);
    setTimeout(function () {
      if (!window.pickRegistry) window.pickRegistry = {};
      window.initDraftPicks();
    }, 400);
  };

  /* Re-init at start of each new season */
  var _origBNS = window.beginNewSeason;
  window.beginNewSeason = function () {
    if (typeof _origBNS === 'function') _origBNS();
    setTimeout(window.initDraftPicks, 100);
  };

  /* ── 8. Ensure trade center calls initDraftPicks before rendering ─ */
  var _origRTPU = window.renderTradePicksUI;
  window.renderTradePicksUI = function (preSelectId) {
    if (!window.pickRegistry) window.pickRegistry = {};
    window.initDraftPicks();
    if (typeof _origRTPU === 'function') _origRTPU(preSelectId);
  };

  /* ── 9. My draft picks view ───────────────────────────────────── */
  window.renderMyPicks = function () {
    var sel = document.getElementById('teamSelect');
    var tid = sel && sel.value;
    var team = tid && typeof getTeamById === 'function' ? getTeamById(tid) : null;
    if (!team) {
      setMainContent('<p>Select a team first.</p>');
      return;
    }

    window.initDraftPicks();
    var picks = window.picksOwnedBy(tid);

    var rows = picks
      .map(function (pk) {
        var via =
          pk.origOwner !== tid
            ? ' <span style="font-size:10px;color:var(--gold)">(via ' +
              ((getTeamById(pk.origOwner) || {}).nickname || pk.origOwner) +
              ')</span>'
            : '';
        var val = window.pickValueById(pk.pickId);
        return (
          '<tr>' +
          '<td>Season ' +
          pk.year +
          '</td>' +
          '<td>Round ' +
          pk.round +
          via +
          '</td>' +
          '<td style="color:var(--muted2);font-size:11px">~' +
          val.toLocaleString() +
          ' pts</td>' +
          '</tr>'
        );
      })
      .join('');

    setMainContent(
      '<h2>' +
        team.city +
        ' ' +
        team.nickname +
        ' — Draft Picks</h2>' +
        '<p class="small">All picks currently owned by your team. Values discount for future years.</p>' +
        (picks.length
          ? '<table><thead><tr><th>Draft Year</th><th>Pick</th><th>Est. Value</th></tr></thead>' +
            '<tbody>' +
            rows +
            '</tbody></table>'
          : '<p style="color:var(--muted2)">No picks owned — trade for some.</p>') +
        '<button onclick="window.renderTradePicksUI&&window.renderTradePicksUI()" style="margin-top:12px">🔄 Go to Trade Center</button>',
    );
  };

  /* ── 10. Initialize on DOMContentLoaded ──────────────────────── */
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      if (!window.pickRegistry) window.pickRegistry = {};
      if (typeof league !== 'undefined' && league) window.initDraftPicks();
    }, 600);
  });
})();
