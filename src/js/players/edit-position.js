/* ============================================================
   EDIT POSITION SYSTEM
   Lets the user change a player's primary position from their
   profile page. OVR instantly recalculates using the granular
   attribute formulas specific to the new position.
   ============================================================ */
(function () {
  /* ── Position definitions shown to the user ─────────────── */

  /* ── Add SS, FS, DL to the POS_OVR table once it exists ──── */

  function extendPosOVR() {
    var p = window.POS_OVR;
    if (!p) return;

    /* DL — same emphasis as DT but label shown as "DL" */
    if (!p.DL)
      p.DL = {
        blockShedding: 20,
        powerMoves: 20,
        strength: 20,
        tackle: 15,
        pursuit: 10,
        awareness: 10,
        stamina: 5,
      };

    /* SS — run-stopper safety, physical, box presence */
    if (!p.SS)
      p.SS = {
        tackle: 25,
        hitPower: 15,
        strength: 15,
        manCoverage: 15,
        playRecognition: 15,
        speed: 10,
        awareness: 5,
      };

    /* FS — coverage safety, deep zone, rangy */
    if (!p.FS)
      p.FS = {
        zoneCoverage: 25,
        playRecognition: 20,
        speed: 15,
        awareness: 15,
        manCoverage: 10,
        tackle: 10,
        agility: 5,
      };
  }

  /* ── Helper: locate player anywhere ────────────────────────  */

  function findPlayer(playerId) {
    var p = null;
    listAllTeams(league).forEach(function (t) {
      t.roster.forEach(function (x) {
        if (String(x.id) === String(playerId)) p = x;
      });
    });
    if (!p && typeof freeAgents !== 'undefined') {
      freeAgents.forEach(function (x) {
        if (String(x.id) === String(playerId)) p = x;
      });
    }
    return p;
  }

  /* ── Apply the position change ──────────────────────────────  */

  /* Map depth-chart slot labels to canonical roster position codes.
     LT / RT are just slot labels for Tackle (T).
     LG / RG are just slot labels for Guard (G).               */
  var SLOT_TO_POS = { LT: 'T', RT: 'T', LG: 'G', RG: 'G', DL: 'DT' };

  window.applyPositionChange = function (playerId, newPos) {
    extendPosOVR();

    /* Normalise: LT/RT → T, LG/RG → G */
    newPos = SLOT_TO_POS[newPos] || newPos;

    var p = findPlayer(playerId);
    if (!p) return;

    var oldPos = p.positions[0];
    if (oldPos === newPos) {
      /* Already at that position — just go back */
      renderPlayerDetail(playerId);
      return;
    }

    /* Update primary position (keep secondary if it exists and differs) */
    p.positions[0] = newPos;

    /* Recalculate OVR for the new position using the canonical code */
    var g = window.initGranularAttrs(p);
    var newOVR = window.calcPosOVR ? window.calcPosOVR(g, newPos) : p.attributes.overall;
    var oldOVR = p.attributes.overall;
    p.attributes.overall = newOVR;

    /* Log the transaction */
    if (typeof logTransaction === 'function') {
      var tid = typeof activeTeamId === 'function' ? activeTeamId() : userTeamId;
      var team = getTeamById && tid ? getTeamById(tid) : null;
      var teamName = team ? team.city + ' ' + team.nickname : 'Team';
      logTransaction(
        'Position Change',
        teamName + ' converted ' + p.name + ' from ' + oldPos + ' to ' + newPos,
        tid,
        p,
      );
    }

    /* Brief confirmation flash, then return to player page */
    var ovrColor = function (v) {
      return v >= 90
        ? '#c084fc'
        : v >= 85
          ? '#60a5fa'
          : v >= 80
            ? '#4ade80'
            : v >= 75
              ? '#facc15'
              : v >= 70
                ? '#94a3b8'
                : '#f87171';
    };
    var delta = newOVR - oldOVR;
    var deltaHtml =
      delta === 0
        ? ''
        : ' <span style="color:' +
          (delta > 0 ? '#4ade80' : '#f87171') +
          ';font-size:14px">' +
          (delta > 0 ? '+' : '') +
          delta +
          '</span>';

    setMainContent(
      '<div class="welcome-hero" style="max-width:480px">' +
        '<h2 style="color:var(--accent2)">✅ Position Updated</h2>' +
        '<p style="font-size:14px;color:var(--text);margin-bottom:8px">' +
        '<strong>' +
        p.name +
        '</strong> has been converted from ' +
        '<strong style="color:var(--muted2)">' +
        oldPos +
        '</strong> → ' +
        '<strong style="color:var(--accent2)">' +
        newPos +
        '</strong>.' +
        '</p>' +
        '<p style="font-size:13px;color:var(--muted2);margin-bottom:4px">' +
        'New OVR at <strong>' +
        newPos +
        '</strong>: ' +
        '<strong style="color:' +
        ovrColor(newOVR) +
        ';font-size:16px">' +
        newOVR +
        '</strong>' +
        deltaHtml +
        '</p>' +
        '<p style="font-size:11px;color:var(--muted)">Only attributes relevant to ' +
        newPos +
        ' were used to calculate this rating.</p>' +
        '<div style="display:flex;gap:8px;margin-top:14px">' +
        '<button onclick="renderPlayerDetail(\'' +
        playerId +
        '\')" style="flex:1;background:rgba(22,163,74,.15);border-color:var(--accent);color:var(--accent2);font-weight:600">← View Player</button>' +
        '<button onclick="window.renderEditPositionScreen(\'' +
        playerId +
        '\')" style="flex:1">🔄 Change Again</button>' +
        '</div>' +
        '</div>',
    );
  };

  /* ── Inject "Edit Position" button into player detail page ── */

  var _origRPD_pos = window.renderPlayerDetail;
  window.renderPlayerDetail = function (playerId) {
    if (typeof _origRPD_pos === 'function') _origRPD_pos(playerId);

    setTimeout(function () {
      var main = document.getElementById('main');
      if (!main) return;

      /* Only for players on the user's team */
      var onMyTeam = false;
      var tid =
        typeof activeTeamId === 'function' ? activeTeamId() : typeof userTeamId !== 'undefined' ? userTeamId : null;
      if (!tid) return;
      listAllTeams(league).forEach(function (t) {
        if (t.id !== tid) return;
        t.roster.forEach(function (x) {
          if (String(x.id) === String(playerId)) onMyTeam = true;
        });
      });
      if (!onMyTeam) return;

      /* Avoid double-injection */
      if (main.querySelector('.editpos-btn')) return;

      var btn = document.createElement('button');
      btn.className = 'editpos-btn';
      btn.onclick = function () {
        window.renderEditPositionScreen(playerId);
      };
      btn.style.cssText = 'flex:1;background:rgba(251,191,36,.15);border-color:#f59e0b;color:#fbbf24;font-size:12px';
      btn.textContent = '🏷 Edit Pos';

      /* Find the Cut/Trade actions flex row */
      var actionsRow = null;
      main.querySelectorAll('div').forEach(function (div) {
        if (div.style && div.style.display === 'flex' && div.style.gap === '8px' && div.style.marginTop === '14px') {
          var btns = div.querySelectorAll('button');
          var hasCut = false;
          btns.forEach(function (b) {
            if (b.textContent.indexOf('Cut') !== -1) hasCut = true;
          });
          if (hasCut) actionsRow = div;
        }
      });

      if (actionsRow) actionsRow.appendChild(btn);
    }, 150); /* last in the chain: cut(0) → resign(50) → attrs(100) → pos(150) */
  };
})();
