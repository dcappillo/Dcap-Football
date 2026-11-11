/* ============================================================
   DRAFT PICK REGISTRY CONNECTION + PICK VALUE FIX

   Problem 1: pickV() used regex on the pick ID string.
   If it ever misses, defaults to round 4 (350), making
   traded picks look cheaper than they are.
   Fix: look up the actual round from the registry object.

   Problem 2: The draft used draftOrder[] (32 team IDs) with no
   knowledge of the pick registry. Traded picks were ignored.
   Fix: buildDraftPickList() creates an ordered 224-entry list
   from the registry. Every draft function now uses that list.
   ============================================================ */
(function () {
  /* R1-R7 */

  /* end _rewrittenProposeTrade */

  /* ══════════════════════════════════════════════════════════
     REGISTRY-CONNECTED DRAFT SYSTEM
     ════════════════════════════════════════════════════════ */

  /* Build an ordered 224-pick list from the registry.
     Slot order within each round = worst→best record (same
     as calculateDraftOrder). Current owner = whoever holds
     the pick after any trades.                              */
  function buildDraftPickList() {
    var yr = (window.simYear || 1) + 1;
    /* NOTE: Do NOT call initDraftPicks() here — it would create a circular
       call since initDraftPicks was patched to call buildDraftPickList. */

    /* Sort teams worst → best record for slot ordering */
    var teams = listAllTeams(league)
      .slice()
      .sort(function (a, b) {
        if (a.wins !== b.wins) return a.wins - b.wins;
        return a.pointsFor - a.pointsAgainst - (b.pointsFor - b.pointsAgainst);
      });

    /* Flat map: all registry picks keyed by pickId for O(1) lookup */
    var regMap = {};
    Object.keys(window.pickRegistry || {}).forEach(function (tid) {
      (window.pickRegistry[tid] || []).forEach(function (pk) {
        regMap[pk.pickId] = pk;
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
          slot: slot + 1 /* 1-based pick number within round */,
          origOwner: origTeam.id,
          curOwner: regPick ? regPick.curOwner : origTeam.id,
          year: yr,
        });
      });
    }

    return list; /* always 224 entries */
  }

  /* Absolute index into the pick list */
  window._draftAbsIndex = 0;
  window._draftPickList = [];

  /* ── calculateDraftOrder: also build pick list ─────────── */
  var _origCDO = window.calculateDraftOrder;
  window.calculateDraftOrder = function () {
    if (typeof _origCDO === 'function') _origCDO(); /* keep draftOrder for backward compat */
    window._draftPickList = buildDraftPickList();
    window._draftAbsIndex = 0;
    draftRound = 1;
    draftIndex = 0;
  };

  /* ── getTeamOnClock: use pick list ─────────────────────── */
  window.getTeamOnClock = function () {
    var pl = window._draftPickList;
    if (!pl || !pl.length) {
      /* Fallback: use computed absolute index to handle rounds 2+ correctly */
      var _fbIdx = (draftRound - 1) * 32 + draftIndex;
      return getTeamById(draftOrder[_fbIdx]);
    }
    var pick = pl[window._draftAbsIndex || 0];
    if (!pick) return null;
    return getTeamById(pick.curOwner);
  };

  /* ── advanceDraft: iterative loop — no recursion risk ───── */
  window.advanceDraft = function () {
    /* Iterate forward through the pick list, running CPU picks
       synchronously in a loop until it's the user's turn or done.
       This avoids a 200+ frame recursive call stack.            */
    while (true) {
      window._draftAbsIndex = (window._draftAbsIndex || 0) + 1;

      var pl = window._draftPickList;
      var idx = window._draftAbsIndex;

      if (!pl || idx >= pl.length) {
        renderDraftComplete();
        return;
      }

      var pick = pl[idx];
      draftRound = pick.round;
      draftIndex = pick.slot - 1;

      var team = getTeamById(pick.curOwner);
      if (!team) continue; /* skip orphaned picks, advance again */

      if (team.id === userTeamId) {
        renderDraftScreen();
        return; /* stop loop — wait for user input */
      }

      /* CPU pick — execute inline, then loop */
      _cpuPickInline(team);
      /* Loop continues to next pick */
    }
  };

  /* CPU picks one player for a team without calling advanceDraft */
  function _cpuPickInline(team) {
    var available = (draftClass || []).filter(function (p) {
      return !p.drafted;
    });
    if (!available.length) return;

    var best = available.reduce(
      function (b, p) {
        var need = typeof getTeamNeedAtPosition === 'function' ? getTeamNeedAtPosition(team, p.positions[0]) : 0.5;
        var score = p.attributes.overall + need * 20;
        return score > b.score ? { p: p, score: score } : b;
      },
      { p: available[0], score: 0 },
    ).p;

    best.drafted = true;
    best.contract = {
      years: 4,
      totalValue: best.attributes.overall * 200000 + 500000,
      capHitPerYear: Math.round((best.attributes.overall * 200000 + 500000) / 4),
    };
    team.roster.push(best);
    team.capUsed += best.contract.capHitPerYear;
    _consumePick(window._draftAbsIndex);
  }

  /* ── Team needs analysis for draft screen ─────────────────── */
  var _IDEAL_COUNTS = {
    QB: 3,
    RB: 5,
    WR: 7,
    TE: 3,
    T: 4,
    G: 3,
    C: 2,
    EDGE: 4,
    DT: 5,
    LB: 6,
    CB: 7,
    FS: 2,
    SS: 2,
    K: 1,
    P: 1,
  };

  function buildTeamNeeds(team) {
    var counts = {},
      topOVR = {};
    Object.keys(_IDEAL_COUNTS).forEach(function (pos) {
      counts[pos] = 0;
      topOVR[pos] = 99;
    });

    (team.roster || []).forEach(function (p) {
      var pos = p.positions[0];
      if (counts[pos] !== undefined) {
        counts[pos]++;
        /* Track LOWEST starter OVR (worst starter = biggest need) */
        var ovr = p.attributes ? p.attributes.overall : 70;
        if (ovr < topOVR[pos]) topOVR[pos] = ovr;
      }
    });

    var needs = [];
    Object.keys(_IDEAL_COUNTS).forEach(function (pos) {
      var ideal = _IDEAL_COUNTS[pos];
      var have = counts[pos];
      var starterOVR = topOVR[pos] === 99 ? 0 : topOVR[pos];
      var shortage = ideal - have;

      /* Priority: 3 = critical need, 2 = upgrade, 1 = depth */
      if (shortage > 0) {
        needs.push({
          pos: pos,
          type: 'fill',
          shortage: shortage,
          ovr: starterOVR,
          label: pos + ' (' + have + '/' + ideal + ')',
          priority: shortage >= 2 ? 3 : 2,
        });
      } else if (starterOVR < 72 && have > 0) {
        needs.push({
          pos: pos,
          type: 'upgrade',
          shortage: 0,
          ovr: starterOVR,
          label: pos + ' starter OVR ' + starterOVR,
          priority: starterOVR < 65 ? 3 : 1,
        });
      }
    });

    /* Sort: critical first, then alphabetical */
    needs.sort(function (a, b) {
      return b.priority - a.priority || a.pos.localeCompare(b.pos);
    });
    return needs;
  }

  function renderNeedsPill(need) {
    var color = need.priority === 3 ? '#f87171' : need.priority === 2 ? '#facc15' : '#94a3b8';
    var icon = need.type === 'fill' ? '⚠' : '↑';
    return (
      '<span style="display:inline-flex;align-items:center;gap:3px;' +
      'background:rgba(0,0,0,.25);border:1px solid ' +
      color +
      ';' +
      'border-radius:99px;padding:2px 8px;font-size:10px;' +
      'font-weight:600;color:' +
      color +
      ';white-space:nowrap;cursor:pointer" ' +
      'onclick="window._filterDraftByPos(\'' +
      need.pos +
      '\')" ' +
      'title="' +
      (need.type === 'fill' ? 'Roster spot needed' : 'Starter upgrade needed') +
      '">' +
      icon +
      ' ' +
      need.label +
      '</span>'
    );
  }

  /* ── Quick roster modal (no page nav — overlay over draft) ── */
  window.renderQuickRoster = function () {
    var myTeam = typeof getTeamById === 'function' ? getTeamById(userTeamId) : null;
    if (!myTeam) return;

    var byPos = {};
    (myTeam.roster || []).forEach(function (p) {
      var pos = p.positions[0];
      if (!byPos[pos]) byPos[pos] = [];
      byPos[pos].push(p);
    });
    Object.keys(byPos).forEach(function (pos) {
      byPos[pos].sort(function (a, b) {
        return b.attributes.overall - a.attributes.overall;
      });
    });

    function ovc(v) {
      return v >= 85 ? '#60a5fa' : v >= 78 ? '#4ade80' : v >= 70 ? '#facc15' : v >= 62 ? '#94a3b8' : '#f87171';
    }

    var posOrder = ['QB', 'RB', 'WR', 'TE', 'T', 'G', 'C', 'EDGE', 'DT', 'LB', 'CB', 'FS', 'SS', 'K', 'P'];
    var sections = posOrder
      .map(function (pos) {
        var players = byPos[pos] || [];
        var ideal = _IDEAL_COUNTS[pos] || 1;
        var countColor = players.length < ideal ? '#f87171' : '#4ade80';
        if (!players.length) return '';
        var pRows = players
          .map(function (p, i) {
            var ovr = p.attributes ? p.attributes.overall : 70;
            var starter = i === 0;
            return (
              '<div style="display:flex;align-items:center;gap:8px;' +
              'padding:4px 8px;border-bottom:1px solid rgba(30,45,71,.4);' +
              (starter ? 'background:rgba(22,163,74,.07)' : '') +
              '">' +
              '<span style="font-size:10px;color:var(--muted);width:14px">' +
              (starter ? '●' : i + 1) +
              '</span>' +
              '<span style="flex:1;font-size:12px">' +
              p.name +
              '</span>' +
              '<span style="font-size:11px;font-weight:600;color:' +
              ovc(ovr) +
              '">' +
              ovr +
              '</span>' +
              '</div>'
            );
          })
          .join('');
        return (
          '<div style="margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;' +
          'background:var(--surface2);padding:4px 8px;font-size:10px;' +
          'font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--accent2)">' +
          '<span>' +
          pos +
          '</span>' +
          '<span style="color:' +
          countColor +
          '">' +
          players.length +
          '/' +
          ideal +
          '</span>' +
          '</div>' +
          pRows +
          '</div>'
        );
      })
      .filter(Boolean)
      .join('');

    /* Inject overlay div */
    var existing = document.getElementById('_draftRosterModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = '_draftRosterModal';
    modal.style.cssText =
      'position:fixed;inset:0;z-index:9000;display:flex;' +
      'align-items:stretch;justify-content:flex-end;' +
      'background:rgba(0,0,0,.6);backdrop-filter:blur(2px)';

    modal.innerHTML =
      '<div style="width:min(340px,95vw);background:var(--surface);' +
      'border-left:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column">' +
      '<div style="position:sticky;top:0;background:var(--surface);' +
      'border-bottom:1px solid var(--border);padding:12px 14px;' +
      'display:flex;align-items:center;justify-content:space-between;z-index:1">' +
      "<span style=\"font-family:'Barlow Condensed',sans-serif;font-size:15px;" +
      'font-weight:700;color:var(--accent2)">' +
      myTeam.nickname +
      ' Roster</span>' +
      '<button onclick="document.getElementById(\'_draftRosterModal\').remove()" ' +
      'style="width:auto;padding:4px 10px;font-size:12px;' +
      'background:var(--accent-dim);border-color:var(--accent);color:var(--accent2)">← Back</button>' +
      '</div>' +
      '<div style="padding:10px 0">' +
      sections +
      '</div>' +
      '</div>';

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
  };

  /* ── Filter prospect table by position ─────────────────────── */
  window._draftCurrentFilter = null;
  window._filterDraftByPos = function (pos) {
    window._draftCurrentFilter = window._draftCurrentFilter === pos ? null : pos;
    window._renderDraftTable();
  };
  window._renderDraftTable = function () {
    var available = (draftClass || []).filter(function (p) {
      return !p.drafted;
    });
    var filter = window._draftCurrentFilter;
    if (filter)
      available = available.filter(function (p) {
        return p.positions[0] === filter;
      });

    available.sort(function (a, b) {
      return b.attributes.overall - a.attributes.overall;
    });

    var rows = available
      .slice(0, 50)
      .map(function (p, i) {
        var dev =
          p.devTrait && p.devTrait !== 'Normal'
            ? ' <span style="font-size:9px;color:#facc15">' + p.devTrait + '</span>'
            : '';
        return (
          '<tr>' +
          '<td>' +
          (i + 1) +
          '</td>' +
          '<td>' +
          p.name +
          dev +
          '</td>' +
          '<td>' +
          p.positions[0] +
          '</td>' +
          '<td>' +
          p.age +
          '</td>' +
          '<td style="font-weight:600;color:' +
          ovrColor(p.attributes.overall) +
          '">' +
          p.attributes.overall +
          '</td>' +
          '<td><button onclick="userDraftPlayer(\'' +
          p.id +
          '\')" ' +
          'style="width:auto;padding:3px 10px;font-size:11px">Draft</button></td>' +
          '</tr>'
        );
      })
      .join('');

    var tbody = document.getElementById('_draftTbody');
    if (tbody)
      tbody.innerHTML =
        rows || '<tr><td colspan="6" style="color:var(--muted2)">No prospects at this position.</td></tr>';

    /* Refresh position tab bar */
    var _tabsEl = document.getElementById('_draftPosTabs');
    if (_tabsEl) _tabsEl.innerHTML = window._buildDraftTabs();
  };

  /* ── Position tab bar builder ──────────────────────────────── */
  window._buildDraftTabs = function () {
    var all = (draftClass || []).filter(function (p) {
      return !p.drafted;
    });
    var cur = window._draftCurrentFilter;
    var pos15 = ['QB', 'RB', 'WR', 'TE', 'T', 'G', 'C', 'EDGE', 'DT', 'LB', 'CB', 'FS', 'SS', 'K', 'P'];
    var counts = {};
    all.forEach(function (p) {
      var pos = p.positions[0];
      counts[pos] = (counts[pos] || 0) + 1;
    });

    function tab(label, pos) {
      var active = pos === null ? !cur : cur === pos;
      var count = pos === null ? all.length : counts[pos] || 0;
      var dimmed = pos !== null && count === 0;
      var activeStyle = 'background:var(--accent-dim);border-color:var(--accent);color:var(--accent2);font-weight:700;';
      var dimStyle = 'opacity:.35;background:transparent;border-color:var(--border);color:var(--muted);';
      var normStyle = 'background:transparent;border-color:var(--border);color:var(--muted2);';
      return (
        '<button onclick="window._filterDraftByPos(' +
        (pos ? "'" + pos + "'" : 'null') +
        ')" ' +
        'style="display:inline-flex;align-items:center;gap:3px;width:auto;padding:3px 9px;' +
        'font-size:11px;margin-right:3px;white-space:nowrap;' +
        (active ? activeStyle : dimmed ? dimStyle : normStyle) +
        '">' +
        label +
        '<span style="font-size:9px;opacity:.7">(' +
        count +
        ')</span>' +
        '</button>'
      );
    }

    return (
      tab('ALL', null) +
      pos15
        .map(function (p) {
          return tab(p, p);
        })
        .join('')
    );
  };

  /* ── My Draft Picks slide-in panel ────────────────────────── */
  window.renderMyDraftPicks = function () {
    var myTeam = typeof getTeamById === 'function' ? getTeamById(userTeamId) : null;
    if (!myTeam) return;

    var picks = (myTeam.roster || []).filter(function (p) {
      return p.isRookie;
    });
    picks.sort(function (a, b) {
      return b.attributes.overall - a.attributes.overall;
    });

    var rows = picks.length
      ? picks
          .map(function (p) {
            var ovr = p.attributes ? p.attributes.overall : 70;
            var dev =
              p.devTrait && p.devTrait !== 'Normal'
                ? '<span style="font-size:9px;background:rgba(250,204,21,.2);color:#fde047;' +
                  'padding:1px 5px;border-radius:3px;margin-left:4px">' +
                  p.devTrait +
                  '</span>'
                : '';
            var rnd = p.draftedRound
              ? '<span style="font-size:10px;color:var(--muted);white-space:nowrap">R' +
                p.draftedRound +
                ' P' +
                p.draftedPick +
                '</span>'
              : '';
            return (
              '<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;' +
              'border-bottom:1px solid rgba(30,45,71,.4)">' +
              '<span style="font-size:11px;font-weight:700;color:var(--accent2);min-width:30px">' +
              p.positions[0] +
              '</span>' +
              '<span style="flex:1;font-size:12px">' +
              p.name +
              dev +
              '</span>' +
              rnd +
              '<span style="font-size:12px;font-weight:700;color:' +
              ovrColor(ovr) +
              ';margin-left:6px">' +
              ovr +
              '</span>' +
              '</div>'
            );
          })
          .join('')
      : '<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px">' +
        'No picks yet this draft.</div>';

    var existing = document.getElementById('_draftPicksModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = '_draftPicksModal';
    modal.style.cssText =
      'position:fixed;inset:0;z-index:9000;display:flex;' +
      'align-items:stretch;justify-content:flex-end;' +
      'background:rgba(0,0,0,.6);backdrop-filter:blur(2px)';

    modal.innerHTML =
      '<div style="width:min(340px,95vw);background:var(--surface);' +
      'border-left:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column">' +
      '<div style="position:sticky;top:0;background:var(--surface);' +
      'border-bottom:1px solid var(--border);padding:12px 14px;' +
      'display:flex;align-items:center;justify-content:space-between;z-index:1">' +
      '<div>' +
      "<div style=\"font-family:'Barlow Condensed',sans-serif;font-size:15px;" +
      'font-weight:700;color:var(--accent2)">' +
      myTeam.nickname +
      ' Draft Picks</div>' +
      '<div style="font-size:11px;color:var(--muted)">' +
      picks.length +
      ' player' +
      (picks.length !== 1 ? 's' : '') +
      ' drafted</div>' +
      '</div>' +
      '<button onclick="document.getElementById(\'_draftPicksModal\').remove()" ' +
      'style="width:auto;padding:4px 10px;font-size:12px;' +
      'background:var(--accent-dim);border-color:var(--accent);color:var(--accent2)">' +
      '← Back</button>' +
      '</div>' +
      '<div>' +
      rows +
      '</div>' +
      '</div>';

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.remove();
    });
    document.body.appendChild(modal);
  };

  /* ── renderDraftScreen: team needs + quick roster ────────────── */
  window.renderDraftScreen = function () {
    if (!draftClass || !draftClass.length) generateDraftClass();
    window._draftCurrentFilter = null;

    var pl = window._draftPickList;
    var idx = window._draftAbsIndex || 0;
    var pick = pl && pl[idx];
    var team = getTeamOnClock();
    if (!team) {
      renderDraftComplete();
      return;
    }

    /* My team for needs analysis */
    var myTeam = typeof getTeamById === 'function' ? getTeamById(userTeamId) : null;
    var needs = myTeam ? buildTeamNeeds(myTeam) : [];

    /* Via-trade note */
    var viaNote = '';
    if (pick && pick.origOwner !== pick.curOwner) {
      var origT = getTeamById(pick.origOwner);
      viaNote =
        ' <span style="color:var(--gold);font-size:11px">(acquired from ' + (origT ? origT.nickname : '?') + ')</span>';
    }

    /* Team needs panel */
    var needsHtml = '';
    if (myTeam && needs.length) {
      var pills = needs.slice(0, 10).map(renderNeedsPill).join(' ');
      needsHtml =
        '<div style="background:var(--surface);border:1px solid var(--border);' +
        'border-radius:10px;padding:12px 14px;margin-bottom:12px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;' +
        'margin-bottom:8px;flex-wrap:wrap;gap:6px">' +
        '<div>' +
        "<span style=\"font-family:'Barlow Condensed',sans-serif;font-size:14px;" +
        'font-weight:700;color:var(--accent2)">' +
        myTeam.nickname +
        ' Draft Needs</span>' +
        '<span style="font-size:11px;color:var(--muted);margin-left:8px">' +
        'Tap a need to filter prospects</span>' +
        '</div>' +
        '<div style="display:flex;gap:5px">' +
        '<button onclick="window.renderMyDraftPicks()" ' +
        'style="width:auto;padding:4px 10px;font-size:11px;' +
        'background:rgba(250,204,21,.12);border-color:rgba(250,204,21,.5);color:#fde047">' +
        '🎯 My Picks</button>' +
        '<button onclick="window.renderQuickRoster()" ' +
        'style="width:auto;padding:4px 10px;font-size:11px;' +
        'background:rgba(59,130,246,.15);border-color:#3b82f6;color:#60a5fa">' +
        '👥 Roster</button>' +
        '<button onclick="window.renderTradePickModal()" ' +
        'style="width:auto;padding:4px 10px;font-size:11px;' +
        'background:rgba(249,115,22,.15);border-color:#f97316;color:#fb923c">' +
        '🔄 Trade Pick</button>' +
        '</div>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:5px">' +
        pills +
        '</div>' +
        '</div>';
    } else if (myTeam) {
      needsHtml =
        '<div style="background:var(--surface);border:1px solid var(--border);' +
        'border-radius:10px;padding:10px 14px;margin-bottom:12px;' +
        'display:flex;align-items:center;justify-content:space-between">' +
        '<span style="font-size:12px;color:#4ade80">✅ ' +
        myTeam.nickname +
        ' roster is fully built</span>' +
        '<div style="display:flex;gap:5px">' +
        '<button onclick="window.renderMyDraftPicks()" ' +
        'style="width:auto;padding:4px 10px;font-size:11px;' +
        'background:rgba(250,204,21,.12);border-color:rgba(250,204,21,.5);color:#fde047">' +
        '🎯 My Picks</button>' +
        '<button onclick="window.renderQuickRoster()" ' +
        'style="width:auto;padding:4px 10px;font-size:11px;' +
        'background:rgba(59,130,246,.15);border-color:#3b82f6;color:#60a5fa">' +
        '👥 Roster</button>' +
        '<button onclick="window.renderTradePickModal()" ' +
        'style="width:auto;padding:4px 10px;font-size:11px;' +
        'background:rgba(249,115,22,.15);border-color:#f97316;color:#fb923c">' +
        '🔄 Trade Pick</button>' +
        '</div>' +
        '</div>';
    }

    setMainContent(
      '<h2 style="margin:0 0 4px">Draft — Round ' +
        draftRound +
        ', Pick ' +
        (draftIndex + 1) +
        '</h2>' +
        '<p class="small" style="margin-bottom:10px">On the clock: <strong>' +
        team.city +
        ' ' +
        team.nickname +
        '</strong>' +
        viaNote +
        '</p>' +
        needsHtml +
        '<div id="_draftPosTabs" style="overflow-x:auto;white-space:nowrap;padding:0 0 8px;' +
        '-webkit-overflow-scrolling:touch;scrollbar-width:thin"></div>' +
        '<table><thead><tr>' +
        '<th>#</th><th>Name</th><th>Pos</th><th>Age</th><th>OVR</th><th></th>' +
        '</tr></thead>' +
        '<tbody id="_draftTbody"></tbody></table>',
    );

    /* Populate table after DOM settles */
    setTimeout(window._renderDraftTable, 0);
  };

  /* ── userDraftPlayer: unchanged logic, reads from registry ─ */
  window.userDraftPlayer = function (playerId) {
    var team = getTeamOnClock();
    var rookie = (draftClass || []).find(function (p) {
      return String(p.id) === String(playerId);
    });
    if (!rookie || !team) return;

    rookie.drafted = true;
    rookie.draftedRound = draftRound;
    rookie.draftedPick = draftIndex + 1;
    rookie.contract = {
      years: 4,
      totalValue: rookie.attributes.overall * 200000 + 500000,
      capHitPerYear: Math.round((rookie.attributes.overall * 200000 + 500000) / 4),
    };
    team.roster.push(rookie);
    team.capUsed += rookie.contract.capHitPerYear;

    /* Remove the used pick from registry */
    _consumePick(window._draftAbsIndex);
    window.advanceDraft();
  };

  /* ── cpuDraftPlayer: now just a launchDraft entry point ─── */
  /* For the first pick if CPU goes first — then advanceDraft
     handles the rest iteratively via the while loop.         */
  window.cpuDraftPlayer = function () {
    var team = getTeamOnClock();
    if (!team) {
      window.advanceDraft();
      return;
    }
    _cpuPickInline(team);
    window.advanceDraft(); /* advanceDraft is iterative now — safe */
  };

  /* Remove a pick from the registry after it's been used */
  function _consumePick(absIdx) {
    var pl = window._draftPickList;
    var pick = pl && pl[absIdx];
    if (!pick) return;
    Object.keys(window.pickRegistry || {}).forEach(function (tid) {
      window.pickRegistry[tid] = (window.pickRegistry[tid] || []).filter(function (pk) {
        return pk.pickId !== pick.pickId;
      });
    });
  }

  /* ── renderDraftComplete: updated copy ──────────────────── */
  window.renderDraftComplete = function () {
    /* Patch 2 (season progression) owns the wiring of this to
       "Start New Season". We just set the content. */
    var html =
      '<div class="welcome-hero">' +
      '<h2>✅ Draft Complete</h2>' +
      '<p style="color:var(--muted2);font-size:13px">All 7 rounds finished. Rosters updated.</p>' +
      '<button onclick="typeof beginNewSeason===\'function\'&&beginNewSeason()" ' +
      'style="margin-top:10px;background:var(--accent-dim);border-color:var(--accent);color:var(--accent2);font-weight:600">' +
      '🏈 Start New Season →' +
      '</button>' +
      '</div>';
    setMainContent(html);
  };

  /* ── renderDraftOrder: show actual pick owners ──────────── */
  window.renderDraftOrder = function () {
    if (!window._draftPickList || !window._draftPickList.length) window.calculateDraftOrder();
    var list = window._draftPickList;
    var r1 = list.filter(function (pk) {
      return pk.round === 1;
    });

    var rows = r1
      .map(function (pk) {
        var owner = getTeamById(pk.curOwner);
        var orig = pk.curOwner !== pk.origOwner ? getTeamById(pk.origOwner) : null;
        return (
          '<tr>' +
          '<td>' +
          pk.slot +
          '</td>' +
          '<td>' +
          (owner ? owner.city + ' ' + owner.nickname : pk.curOwner) +
          '</td>' +
          '<td>' +
          (orig ? '<span style="color:var(--gold)">via ' + orig.nickname + '</span>' : '—') +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    /* Show as modal overlay so the user never leaves the current page */
    var existing = document.getElementById('_draftOrderModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = '_draftOrderModal';
    modal.style.cssText =
      'position:fixed;inset:0;z-index:9000;display:flex;' +
      'align-items:stretch;justify-content:flex-end;' +
      'background:rgba(0,0,0,.6);backdrop-filter:blur(2px)';

    modal.innerHTML =
      '<div style="width:min(380px,95vw);background:var(--surface);' +
      'border-left:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column">' +
      '<div style="position:sticky;top:0;background:var(--surface);' +
      'border-bottom:1px solid var(--border);padding:12px 14px;' +
      'display:flex;align-items:center;justify-content:space-between;z-index:1">' +
      "<span style=\"font-family:'Barlow Condensed',sans-serif;font-size:15px;" +
      'font-weight:700;color:var(--accent2)">📋 Draft Order — Round 1</span>' +
      '<button onclick="document.getElementById(\'_draftOrderModal\').remove()" ' +
      'style="width:auto;padding:4px 10px;font-size:12px;' +
      'background:var(--surface2);border-color:var(--border);color:var(--muted2)">× Close</button>' +
      '</div>' +
      '<p style="font-size:11px;color:var(--muted2);margin:8px 12px 4px">' +
      'Worst record picks first. Traded picks show original owner.</p>' +
      '<table style="width:100%"><thead><tr>' +
      '<th>Pick</th><th>Team</th><th>Acquired From</th>' +
      '</tr></thead><tbody>' +
      rows +
      '</tbody></table>' +
      '</div>';

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
  };
})();
