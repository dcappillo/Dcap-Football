/* ============================================================
   DEPTH CHART v3 + OL SUB-POSITIONS + SS/FS SPLIT
   ─────────────────────────────────────────────────────────────
   1. Adds LT / LG / C / RG / RT to POS_OVR with distinct weights
   2. Updates Edit Position screen to show OL sub-position tiles
   3. Rebuilds renderDepthChart:
        • OL pool = any of OL/LT/LG/C/RG/RT, 5 starter slots
        • Safety split: SS group (1 starter) + FS group (1 starter)
        • DL pool  = DT + DL tagged players
   ============================================================ */
(function () {
  /* ── 1. OL sub-position POS_OVR formulas ─────────────────── */

  function extendOLPos() {
    var p = window.POS_OVR;
    if (!p) return;

    /* LT — blind-side pass protector; agility & footwork critical */
    if (!p.LT)
      p.LT = {
        passBlock: 22,
        passBlockFootwork: 22,
        passBlockStrength: 18,
        agility: 15,
        strength: 13,
        awareness: 10,
      };

    /* RT — right tackle; balanced pass/run but more physical */
    if (!p.RT)
      p.RT = {
        passBlock: 18,
        runBlock: 18,
        passBlockStrength: 16,
        runBlockStrength: 16,
        strength: 14,
        awareness: 10,
        agility: 8,
      };

    /* LG — left guard; run-block dominant, still passes too */
    if (!p.LG)
      p.LG = {
        runBlock: 20,
        passBlock: 18,
        strength: 18,
        runBlockStrength: 16,
        passBlockStrength: 14,
        runBlockFinesse: 8,
        awareness: 6,
      };

    /* RG — right guard; same profile as LG */
    if (!p.RG)
      p.RG = {
        runBlock: 20,
        passBlock: 18,
        strength: 18,
        runBlockStrength: 16,
        passBlockStrength: 14,
        runBlockFinesse: 8,
        awareness: 6,
      };

    /* C — center; awareness above all (ID blitzes, snap counts) */
    if (!p.C)
      p.C = {
        awareness: 28,
        passBlock: 18,
        passBlockStrength: 14,
        runBlock: 14,
        strength: 14,
        runBlockStrength: 12,
      };

    /* Ensure SS / FS / DL exist (also added by Edit Position script) */
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
  }

  /* ── 2. Updated Edit Position screen (OL → 5 sub-positions) ─ */

  var POSITIONS_DEF_v3 = [
    /* OL sub-positions */
    { pos: 'LT', label: 'Left Tackle', unit: 'offense' },
    { pos: 'LG', label: 'Left Guard', unit: 'offense' },
    { pos: 'C', label: 'Center', unit: 'offense' },
    { pos: 'RG', label: 'Right Guard', unit: 'offense' },
    { pos: 'RT', label: 'Right Tackle', unit: 'offense' },
    /* Other offense */
    { pos: 'QB', label: 'Quarterback', unit: 'offense' },
    { pos: 'RB', label: 'Running Back', unit: 'offense' },
    { pos: 'WR', label: 'Wide Receiver', unit: 'offense' },
    { pos: 'TE', label: 'Tight End', unit: 'offense' },
    /* Defense */
    { pos: 'DT', label: 'Def. Tackle', unit: 'defense' },
    { pos: 'EDGE', label: 'Edge Rusher', unit: 'defense' },
    { pos: 'LB', label: 'Linebacker', unit: 'defense' },
    { pos: 'CB', label: 'Cornerback', unit: 'defense' },
    { pos: 'SS', label: 'Strong Safety', unit: 'defense' },
    { pos: 'FS', label: 'Free Safety', unit: 'defense' },
    /* Special Teams */
    { pos: 'K', label: 'Kicker', unit: 'special' },
    { pos: 'P', label: 'Punter', unit: 'special' },
  ];

  var UNIT_CLR = {
    offense: { bg: 'rgba(22,163,74,.12)', border: '#16a34a', text: '#4ade80' },
    defense: { bg: 'rgba(59,130,246,.12)', border: '#3b82f6', text: '#60a5fa' },
    special: { bg: 'rgba(245,158,11,.12)', border: '#f59e0b', text: '#fbbf24' },
  };

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

  window.renderEditPositionScreen = function (playerId) {
    extendOLPos();

    var p = findPlayer(playerId);
    if (!p) return;

    var g = window.initGranularAttrs(p);
    var curPos = p.positions[0];

    function tileRow(defs) {
      return defs
        .map(function (def) {
          var isCurrent = def.pos === curPos;
          /* Current position tile always shows the real OVR — no recalculation */
          var projOVR = isCurrent
            ? p.attributes.overall
            : window.calcPosOVR
              ? window.calcPosOVR(g, def.pos)
              : p.attributes.overall;
          var projLabel = isCurrent ? 'current OVR' : 'proj OVR';
          var clr = UNIT_CLR[def.unit];
          return (
            '<button onclick="window.applyPositionChange(\'' +
            playerId +
            "','" +
            def.pos +
            '\')"' +
            ' style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
            'gap:3px;padding:12px 6px;border-radius:10px;cursor:pointer;' +
            'background:' +
            (isCurrent ? clr.bg : 'var(--surface2)') +
            ';' +
            'border:2px solid ' +
            (isCurrent ? clr.border : 'var(--border)') +
            ';width:100%">' +
            "<div style=\"font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;color:" +
            clr.text +
            ';line-height:1">' +
            def.pos +
            '</div>' +
            '<div style="font-size:9px;color:var(--muted2);text-align:center;line-height:1.2">' +
            def.label +
            '</div>' +
            '<div style="font-size:14px;font-weight:700;color:' +
            ovrColor(projOVR) +
            ';margin-top:3px">' +
            projOVR +
            '</div>' +
            '<div style="font-size:9px;color:var(--muted)">' +
            projLabel +
            '</div>' +
            (isCurrent
              ? '<div style="font-size:8px;font-weight:700;color:' + clr.text + ';letter-spacing:.5px">CURRENT</div>'
              : '') +
            '</button>'
          );
        })
        .join('');
    }

    function sect(icon, label, color, borderColor, defs, cols) {
      return (
        "<div style=\"font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:600;" +
        'letter-spacing:1.5px;text-transform:uppercase;color:' +
        color +
        ';margin-bottom:8px;' +
        'padding-bottom:4px;border-bottom:1px solid ' +
        borderColor +
        '">' +
        icon +
        ' ' +
        label +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(' +
        cols +
        ',1fr);gap:8px;margin-bottom:16px">' +
        tileRow(defs) +
        '</div>'
      );
    }

    /* OL shown as T / G / C — LT/RT/LG/RG are depth chart labels, not
       distinct positions. Converting to LT just makes you a Tackle (T). */
    var olDefs = [
      { pos: 'T', label: 'Tackle (LT/RT)', unit: 'offense' },
      { pos: 'G', label: 'Guard (LG/RG)', unit: 'offense' },
      { pos: 'C', label: 'Center', unit: 'offense' },
    ];
    var offOther = POSITIONS_DEF_v3.filter(function (d) {
      return ['QB', 'RB', 'WR', 'TE'].indexOf(d.pos) !== -1;
    });
    var defDefs = POSITIONS_DEF_v3.filter(function (d) {
      return d.unit === 'defense';
    });
    var stDefs = POSITIONS_DEF_v3.filter(function (d) {
      return d.unit === 'special';
    });

    setMainContent(
      '<button onclick="renderPlayerDetail(\'' +
        playerId +
        '\')" style="width:auto;padding:5px 14px;margin-bottom:14px;font-size:12px">← Player Profile</button>' +
        '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:700;color:var(--accent2);margin-bottom:2px">Edit Position — ' +
        p.name +
        '</div>' +
        '<div style="font-size:12px;color:var(--muted2);margin-bottom:4px">Current: <strong style="color:var(--text)">' +
        curPos +
        '</strong> · Age ' +
        p.age +
        ' · OVR <strong>' +
        p.attributes.overall +
        '</strong></div>' +
        '<p style="font-size:12px;color:var(--muted);margin-bottom:18px">Each tile shows this player\'s projected OVR using only the attributes that matter at that position.</p>' +
        sect('⚔', 'Offensive Line', '#4ade80', 'rgba(22,163,74,.3)', olDefs, 5) +
        sect('⚔', 'Other Offense', '#4ade80', 'rgba(22,163,74,.3)', offOther, 4) +
        sect('🛡', 'Defense', '#60a5fa', 'rgba(59,130,246,.3)', defDefs, 6) +
        sect('⭐', 'Special Teams', '#fbbf24', 'rgba(245,158,11,.3)', stDefs, 2),
    );
  };

  /* ── 3. Depth Chart v3 ───────────────────────────────────── */

  var LB_LBLS = ['WILL', 'MIKE', 'SAM'];
  var EDGE_LBLS = ['LE', 'RE'];
  var CB_LBLS = ['LC', 'RC', 'SlotC'];
  var WR_LBLS = ['X', 'Y', 'Slot'];

  /* Positions that belong to Safety pools */
  var SS_POS_SET = { SS: 1 };
  var FS_POS_SET = { FS: 1 };
  var S_POS_SET = { S: 1 };

  function _tbadge(p) {
    var t = p.devTrait;
    if (!t || t === 'Normal') return '';
    var c =
      t === 'Star' ? 'dc-badge-star' : t === 'Superstar' ? 'dc-badge-ss' : t === 'X-Factor' ? 'dc-badge-xfactor' : '';
    return c ? '<span class="dc-badge ' + c + '">' + t + '</span>' : '';
  }

  function _dcRow(p, label, isStarter, canUp, canDown) {
    var ovr = p.attributes ? p.attributes.overall : 70;
    var isSel = window._dcSelectedId && String(window._dcSelectedId) === String(p.id);
    var hasSel = !!window._dcSelectedId && !isSel;
    var rc =
      isStarter && label && label !== '●'
        ? '<span style="color:var(--accent2);font-size:9px;font-weight:700">' + label + '</span>'
        : isStarter
          ? '<span style="color:var(--accent2)">●</span>'
          : '<span style="color:var(--muted);font-size:11px">' + label + '</span>';
    var selStyle = isSel
      ? 'background:var(--accent-dim);border-left:3px solid var(--accent);cursor:pointer'
      : 'cursor:pointer' + (hasSel ? ';opacity:.80' : '');
    return (
      '<div class="dc-row' +
      (isStarter ? ' dc-starter' : '') +
      '" ' +
      'onclick="window.dcSelectPlayer(\'' +
      p.id +
      '\')" style="' +
      selStyle +
      '">' +
      '<div class="dc-rank">' +
      rc +
      '</div>' +
      '<div class="dc-info">' +
      '<span class="dc-name">' +
      p.name +
      '</span>' +
      (isSel
        ? '<span class="dc-meta" style="color:var(--accent2);font-size:10px">✎ tap another to swap</span>'
        : '<span class="dc-meta" style="color:' + ovrColor(ovr) + '">OVR ' + ovr + '</span>') +
      '</div>' +
      _tbadge(p) +
      (isSel ? '<span style="color:var(--accent2);font-size:13px;padding:0 8px">✎</span>' : '') +
      '</div>'
    );
  }

  function _dcFlexRow(p, fromPos) {
    var ovr = p.attributes ? p.attributes.overall : 70;
    return (
      '<div class="dc-row" style="border-left:2px solid var(--gold);opacity:.85">' +
      '<div class="dc-rank"><span style="font-size:8px;color:var(--gold);font-weight:700">FLEX</span></div>' +
      '<div class="dc-info">' +
      '<span class="dc-name">' +
      p.name +
      '</span>' +
      '<span class="dc-meta" style="color:' +
      ovrColor(ovr) +
      '">OVR ' +
      ovr +
      ' <span style="color:var(--gold)">· ' +
      fromPos +
      '</span></span>' +
      '</div>' +
      _tbadge(p) +
      '<div class="dc-arrows"><span class="dc-arr-ph"></span><span class="dc-arr-ph"></span></div>' +
      '</div>'
    );
  }

  function _dcGrp(headerText, primaryPlayers, numStarters, labelArr, flexPlayers) {
    if (!primaryPlayers.length && !(flexPlayers && flexPlayers.length)) return '';
    var rows = primaryPlayers
      .map(function (p, i) {
        var s = i < numStarters;
        var lbl = s && labelArr && labelArr[i] ? labelArr[i] : s ? '●' : String(i + 1);
        return _dcRow(p, lbl, s, i > 0, i < primaryPlayers.length - 1);
      })
      .join('');
    if (flexPlayers && flexPlayers.length) {
      rows += flexPlayers
        .map(function (e) {
          return _dcFlexRow(e.p, e.fromPos);
        })
        .join('');
    }
    return '<div class="dc-group"><div class="dc-pos-header">' + headerText + '</div>' + rows + '</div>';
  }

  function _dcSect(lbl, h) {
    return h ? '<div class="dc-section-label">' + lbl + '</div><div class="dc-grid">' + h + '</div>' : '';
  }

  window.renderDepthChart = function () {
    extendOLPos();

    var tid = document.getElementById('teamSelect') && document.getElementById('teamSelect').value;
    if (!tid) return;
    var team = getTeamById(tid);
    if (!team) return;
    if (typeof ensureDepthChart === 'function') ensureDepthChart(team);

    /* ── Pool buckets ── */
    var pools = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      T: [],
      G: [],
      C: [],
      DT: [],
      EDGE: [],
      LB: [],
      CB: [],
      SS: [],
      FS: [],
      K: [],
      P: [],
    };
    var flex = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      T: [],
      G: [],
      C: [],
      DT: [],
      EDGE: [],
      LB: [],
      CB: [],
      SS: [],
      FS: [],
      K: [],
      P: [],
    };

    /* S-players: split by alternating depth rank into SS/FS buckets */
    var sPlayers = [];
    team.roster.forEach(function (p) {
      var pos = p.positions[0];
      if (S_POS_SET[pos]) sPlayers.push(p);
    });
    sPlayers.sort(function (a, b) {
      return (a.depthChartRank || 999) - (b.depthChartRank || 999);
    });
    sPlayers.forEach(function (p, i) {
      (i % 2 === 0 ? pools['SS'] : pools['FS']).push(p);
    });

    team.roster.forEach(function (p) {
      var pos = p.positions[0];

      /* Primary bucket — route T/G/C and DT to their own groups */
      var primaryBucket =
        pos === 'T'
          ? 'T'
          : pos === 'G'
            ? 'G'
            : pos === 'C'
              ? 'C'
              : pos === 'DT'
                ? 'DT'
                : SS_POS_SET[pos]
                  ? 'SS'
                  : FS_POS_SET[pos]
                    ? 'FS'
                    : pos;
      if (pools[primaryBucket]) pools[primaryBucket].push(p);

      /* Secondary (flex) positions */
      for (var i = 1; i < p.positions.length; i++) {
        var sp = p.positions[i];
        var targetBucket =
          sp === 'T'
            ? 'T'
            : sp === 'G'
              ? 'G'
              : sp === 'C'
                ? 'C'
                : sp === 'DT'
                  ? 'DT'
                  : SS_POS_SET[sp]
                    ? 'SS'
                    : FS_POS_SET[sp]
                      ? 'FS'
                      : S_POS_SET[sp]
                        ? 'SS'
                        : sp;
        if (flex[targetBucket]) flex[targetBucket].push({ p: p, fromPos: pos });
      }
    });

    /* Sort all pools by depth chart rank */
    Object.keys(pools).forEach(function (k) {
      pools[k].sort(function (a, b) {
        return (a.depthChartRank || 999) - (b.depthChartRank || 999);
      });
    });

    /* ── OL: three separate tiles — T, G, C ─────────────────────── */
    var olHtml =
      _dcGrp('T — LT / RT', pools['T'] || [], 2, ['LT', 'RT'], flex['T'] || []) +
      _dcGrp('G — LG / RG', pools['G'] || [], 2, ['LG', 'RG'], flex['G'] || []) +
      _dcGrp('C', pools['C'] || [], 1, [], flex['C'] || []);

    var sn = team.dc && team.dc.scheme ? ' · Scheme: ' + team.dc.scheme : '';

    var offHtml =
      _dcGrp('QB', pools['QB'], 1, [], flex['QB']) +
      olHtml +
      _dcGrp('RB', pools['RB'], 1, [], flex['RB']) +
      _dcGrp('WR — X / Y / Slot', pools['WR'], 3, WR_LBLS, flex['WR']) +
      _dcGrp('TE', pools['TE'], 1, [], flex['TE']);

    var defHtml =
      _dcGrp('EDGE — LE / RE', pools['EDGE'], 2, EDGE_LBLS, flex['EDGE']) +
      _dcGrp('DT — Defensive Tackle', pools['DT'] || [], 2, [], flex['DT'] || []) +
      _dcGrp('LB — WILL / MIKE / SAM', pools['LB'], 3, LB_LBLS, flex['LB']) +
      _dcGrp('CB — LC / RC / SlotC', pools['CB'], 3, CB_LBLS, flex['CB']) +
      _dcGrp('SS — Strong Safety', pools['SS'], 1, ['SS'], flex['SS']) +
      _dcGrp('FS — Free Safety', pools['FS'], 1, ['FS'], flex['FS']);

    var stHtml = _dcGrp('K', pools['K'], 1, [], flex['K']) + _dcGrp('P', pools['P'], 1, [], flex['P']);

    setMainContent(
      '<h2>' +
        team.city +
        ' ' +
        team.nickname +
        ' — Depth Chart</h2>' +
        '<p class="small" style="margin-bottom:14px">' +
        '● = starter &nbsp;|&nbsp; ▲▼ = reorder &nbsp;|&nbsp; ' +
        '<span style="color:var(--gold)">FLEX</span> = secondary position' +
        sn +
        '</p>' +
        _dcSect('Offense', offHtml) +
        _dcSect('Defense', defHtml) +
        _dcSect('Special Teams', stHtml),
    );
  };
})();
