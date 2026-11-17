/* ============================================================
   TRADE CENTER: REPLACE NATIVE MULTI-SELECT WITH
   TAP-TO-TOGGLE CHECKLIST

   Problem: <select multiple> requires Ctrl+Click on desktop
   and is completely unusable on mobile — you can only ever
   select one item at a time.

   Fix: custom scrollable checklist with tap-to-toggle rows.
   Selected items highlight in green. _proposeTrade reads
   from window._tradeSelected instead of .selectedOptions.
   ============================================================ */
(function () {
  /* Per-side selection state: { A: {players:Set, picks:Set}, B: {...} } */
  window._tradeSelected = {
    A: { players: new Set(), picks: new Set() },
    B: { players: new Set(), picks: new Set() },
  };

  /* ── Toggle a player selection ─────────────────────────── */
  window._tcTogglePlayer = function (side, playerId) {
    var sel = window._tradeSelected[side].players;
    playerId = String(playerId);
    if (sel.has(playerId)) sel.delete(playerId);
    else sel.add(playerId);
    _updateRowHighlight('tcp-' + side + '-' + playerId);
    _updateSelectionCount(side, 'players');
  };

  /* ── Toggle a pick selection ───────────────────────────── */
  window._tcTogglePick = function (side, pickId) {
    var sel = window._tradeSelected[side].picks;
    /* pickIds can have special chars — encode for element ID */
    var safeId = encodePickId(pickId);
    if (sel.has(pickId)) sel.delete(pickId);
    else sel.add(pickId);
    _updateRowHighlight('tcp-' + side + '-pk-' + safeId);
    _updateSelectionCount(side, 'picks');
  };

  function encodePickId(id) {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
  }

  function _updateRowHighlight(elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    var checked = el.getAttribute('data-checked') === '1';
    var newState = !checked;
    el.setAttribute('data-checked', newState ? '1' : '0');
    el.style.background = newState ? 'rgba(22,163,74,.18)' : '';
    el.style.borderColor = newState ? 'var(--accent)' : 'transparent';
    var chk = el.querySelector('.tc-chk');
    if (chk) chk.textContent = newState ? '✓' : '○';
  }

  function _updateSelectionCount(side, type) {
    var count = type === 'players' ? window._tradeSelected[side].players.size : window._tradeSelected[side].picks.size;
    var label = document.getElementById('tc-count-' + side + '-' + type);
    if (label) label.textContent = count > 0 ? ' (' + count + ' selected)' : '';
  }

  /* ── Rebuild asset panel with tap-to-toggle rows ─────────── */
  function _buildAssetPanel(side, teamId) {
    var c = document.getElementById('tcAssets' + side);
    if (!c) return;
    var team = getTeamById(teamId);
    if (!team) return;

    /* Reset selection for this side when panel rebuilds */
    window._tradeSelected[side] = { players: new Set(), picks: new Set() };

    /* ── Player rows ──────────────────────────────────────── */
    var sortedRoster = team.roster.slice().sort(function (a, b) {
      return b.attributes.overall - a.attributes.overall;
    });

    var playerRows = sortedRoster
      .map(function (p) {
        var ovr = p.attributes ? p.attributes.overall : 70;
        var delta =
          p.seasonStartOVR !== undefined && ovr !== p.seasonStartOVR
            ? ovr > p.seasonStartOVR
              ? ' <span style="color:#4ade80;font-size:9px">▲</span>'
              : ' <span style="color:#f87171;font-size:9px">▼</span>'
            : '';
        var elId = 'tcp-' + side + '-' + p.id;
        return (
          '<div id="' +
          elId +
          '" data-checked="0" ' +
          'onclick="window._tcTogglePlayer(\'' +
          side +
          "','" +
          p.id +
          '\')" ' +
          'style="display:flex;align-items:center;gap:8px;padding:6px 10px;' +
          'cursor:pointer;border:1px solid transparent;border-radius:6px;' +
          'transition:background .12s,border-color .12s;margin-bottom:2px">' +
          '<span class="tc-chk" style="font-size:13px;color:var(--accent2);' +
          'width:16px;flex-shrink:0">○</span>' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
          p.name +
          delta +
          '</div>' +
          '<div style="font-size:10px;color:var(--muted2)">' +
          p.positions[0] +
          ' · Age ' +
          p.age +
          '</div>' +
          '</div>' +
          '<span style="font-size:12px;font-weight:700;color:' +
          ovrColor(ovr) +
          '">' +
          ovr +
          '</span>' +
          '</div>'
        );
      })
      .join('');

    /* ── Pick rows ───────────────────────────────────────── */
    var picks = typeof picksOwnedBy === 'function' ? picksOwnedBy(teamId) : [];
    var pickRows =
      picks
        .map(function (pk) {
          var via =
            pk.origOwner !== teamId
              ? ' <span style="color:var(--gold);font-size:9px">via ' +
                ((getTeamById(pk.origOwner) || {}).nickname || '?') +
                '</span>'
              : '';
          var safeId = encodePickId(pk.pickId);
          var elId = 'tcp-' + side + '-pk-' + safeId;
          var val = typeof pickValueById === 'function' ? pickValueById(pk.pickId) : 0;
          return (
            '<div id="' +
            elId +
            '" data-checked="0" ' +
            'onclick="window._tcTogglePick(\'' +
            side +
            "','" +
            pk.pickId.replace(/'/g, "\\'") +
            '\')" ' +
            'style="display:flex;align-items:center;gap:8px;padding:6px 10px;' +
            'cursor:pointer;border:1px solid transparent;border-radius:6px;' +
            'transition:background .12s,border-color .12s;margin-bottom:2px">' +
            '<span class="tc-chk" style="font-size:13px;color:var(--accent2);' +
            'width:16px;flex-shrink:0">○</span>' +
            '<div style="flex:1">' +
            '<div style="font-size:12px;font-weight:500">Yr ' +
            pk.year +
            ' Rd ' +
            pk.round +
            via +
            '</div>' +
            (val
              ? '<div style="font-size:10px;color:var(--muted2)">Trade value: ' + val.toLocaleString() + ' pts</div>'
              : '') +
            '</div>' +
            '</div>'
          );
        })
        .join('') || '<div style="font-size:11px;color:var(--muted);padding:6px 10px">No picks owned</div>';

    c.innerHTML =
      '<div style="font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;' +
      'color:var(--accent2);margin:10px 0 4px">' +
      team.city +
      ' Players' +
      '<span id="tc-count-' +
      side +
      '-players" style="color:var(--muted2);font-weight:400"></span>' +
      '</div>' +
      '<div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);' +
      'border-radius:8px;padding:4px;background:var(--surface2)">' +
      playerRows +
      '</div>' +
      '<div style="font-size:11px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;' +
      'color:var(--accent2);margin:10px 0 4px">' +
      team.city +
      ' Draft Picks' +
      '<span id="tc-count-' +
      side +
      '-picks" style="color:var(--muted2);font-weight:400"></span>' +
      '</div>' +
      '<div style="max-height:140px;overflow-y:auto;border:1px solid var(--border);' +
      'border-radius:8px;padding:4px;background:var(--surface2)">' +
      pickRows +
      '</div>';
  }

  /* ── Override _refreshTC to use new builder ─────────────── */
  window._refreshTC = function () {
    var selA = document.getElementById('tcTeamA');
    var selB = document.getElementById('tcTeamB');
    if (!selA || !selB) return;
    _buildAssetPanel('A', selA.value);
    _buildAssetPanel('B', selB.value);
  };
})();
