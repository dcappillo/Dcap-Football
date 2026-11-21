/* ============================================================
   INJURY / SUSPENSION POPUP + REPORT PAGE
   ============================================================ */
(function () {
  /* ── Modal popup for new injuries/suspensions ────────────── */
  function showInjuryModal(events, teamName) {
    /* Remove any stale modal */
    var old = document.getElementById('_injModal');
    if (old) old.remove();

    var rows = events
      .map(function (e) {
        var p = e.player;
        var pos = (p.positions && p.positions[0]) || '?';
        if (e.type === 'new_injury') {
          var sev = e.injury.severity;
          var smap = { minor: '#facc15', moderate: '#f97316', major: '#ef4444', careerThreatening: '#c084fc' };
          var slbl = { minor: 'Questionable', moderate: 'Out', major: 'IR', careerThreatening: 'Season' };
          var col = smap[sev] || '#f87171';
          return (
            '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(30,45,71,.3)">' +
            '<div style="min-width:36px;font-size:11px;font-weight:700;color:var(--accent2)">' +
            pos +
            '</div>' +
            '<div style="flex:1">' +
            '<div style="font-size:13px;font-weight:600">' +
            p.name +
            '</div>' +
            '<div style="font-size:11px;color:' +
            col +
            '">🤕 ' +
            e.injury.type +
            ' — ' +
            (slbl[sev] || sev) +
            ' · <span style="color:var(--muted2)">' +
            e.injury.weeksRemaining +
            ' week' +
            (e.injury.weeksRemaining !== 1 ? 's' : '') +
            '</span>' +
            '</div>' +
            '</div>' +
            '</div>'
          );
        }
        if (e.type === 'new_suspension') {
          return (
            '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(30,45,71,.3)">' +
            '<div style="min-width:36px;font-size:11px;font-weight:700;color:var(--accent2)">' +
            pos +
            '</div>' +
            '<div style="flex:1">' +
            '<div style="font-size:13px;font-weight:600">' +
            p.name +
            '</div>' +
            '<div style="font-size:11px;color:#c084fc">🚫 ' +
            e.reason +
            ' — ' +
            e.weeks +
            ' week' +
            (e.weeks !== 1 ? 's' : '') +
            '</div>' +
            '</div>' +
            '</div>'
          );
        }
        return '';
      })
      .filter(Boolean)
      .join('');

    if (!rows) return;

    var modal = document.createElement('div');
    modal.id = '_injModal';
    modal.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:99998;' +
      'display:flex;align-items:center;justify-content:center;padding:20px';

    modal.innerHTML =
      '<div style="background:var(--bg,#0f1923);border:1px solid var(--border,#1e2d47);' +
      'border-radius:14px;padding:20px;max-width:420px;width:100%;' +
      'box-shadow:0 8px 40px rgba(0,0,0,.7)">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
      '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:700;color:#f87171">' +
      '📋 Injury / Suspension News' +
      '</div>' +
      '<button onclick="document.getElementById(\'_injModal\').remove()" ' +
      'style="width:auto;padding:2px 10px;font-size:12px;border-radius:6px">✕</button>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--muted2,#4a5568);margin-bottom:10px">' +
      teamName +
      '</div>' +
      rows +
      '<button onclick="document.getElementById(\'_injModal\').remove()" ' +
      'style="width:100%;margin-top:14px;font-size:13px">Dismiss</button>' +
      '</div>';

    document.body.appendChild(modal);
    /* Close on backdrop click */
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.remove();
    });
  }

  /* ── Hook into simulateGame to fire popup for user's team ── */
  var _prevSG = window.simulateGame;
  window.simulateGame = function (game, tMap, userStrat, uid) {
    var result = typeof _prevSG === 'function' ? _prevSG.call(this, game, tMap, userStrat, uid) : undefined;

    /* Check if this game involved the user's team */
    var tid =
      (typeof userTeamId !== 'undefined' ? userTeamId : null) || (document.getElementById('teamSelect') || {}).value;
    if (!tid) return result;
    var tMapRef = tMap || (typeof teamMap !== 'undefined' ? teamMap : null);
    if (!tMapRef || !game) return result;

    var isUserGame = game.homeTeamId === tid || game.awayTeamId === tid;
    if (!isUserGame) return result;

    /* Gather new-injury and new-suspension events for user's team */
    var events = [];
    if (game._injuryEvents && game._injuryEvents[tid]) {
      events = game._injuryEvents[tid].filter(function (e) {
        return e.type === 'new_injury' || e.type === 'new_suspension';
      });
    }

    if (events.length) {
      var myTeam = tMapRef[tid];
      var teamName = myTeam ? myTeam.city + ' ' + myTeam.nickname : 'Your Team';
      setTimeout(function () {
        showInjuryModal(events, teamName);
      }, 400);
    }

    return result;
  };

  /* ── Update the injury badge count on the tile ──────────── */
  window._updateInjuryBadge = function () {
    var badge = document.getElementById('injBadgeCount');
    if (!badge) return;
    var tid =
      (typeof userTeamId !== 'undefined' ? userTeamId : null) || (document.getElementById('teamSelect') || {}).value;
    if (!tid || typeof getTeamById !== 'function') return;
    var team = getTeamById(tid);
    if (!team) return;
    var count = (team.roster || []).filter(function (p) {
      return (p.injury && p.injury.weeksRemaining > 0) || (p.suspension && p.suspension.weeksRemaining > 0);
    }).length;
    badge.style.display = count > 0 ? 'inline' : 'none';
    badge.textContent = count;
  };

  /* ── Injury Report screen ───────────────────────────────── */
  window.renderInjuryReport = function () {
    var tid =
      (typeof userTeamId !== 'undefined' ? userTeamId : null) || (document.getElementById('teamSelect') || {}).value;
    if (!tid || typeof getTeamById !== 'function') {
      setMainContent('<div class="welcome-hero"><p>Start a game first.</p></div>');
      return;
    }
    var team = getTeamById(tid);
    if (!team) return;

    var injured = [];
    var suspended = [];
    var healthy = [];

    (team.roster || []).forEach(function (p) {
      if (p.injury && p.injury.weeksRemaining > 0) injured.push(p);
      else if (p.suspension && p.suspension.weeksRemaining > 0) suspended.push(p);
      else healthy.push(p);
    });

    function playerRow(p, statusHtml) {
      var ovr = (p.attributes && p.attributes.overall) || 70;
      var ovc =
        ovr >= 90
          ? '#c084fc'
          : ovr >= 85
            ? '#60a5fa'
            : ovr >= 80
              ? '#4ade80'
              : ovr >= 75
                ? '#facc15'
                : ovr >= 70
                  ? '#94a3b8'
                  : '#f87171';
      return (
        '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;' +
        'border-bottom:1px solid rgba(30,45,71,.3)">' +
        '<span style="font-size:11px;font-weight:700;color:var(--accent2);min-width:36px">' +
        ((p.positions && p.positions[0]) || '?') +
        '</span>' +
        '<span style="flex:1;font-size:13px">' +
        p.name +
        '</span>' +
        '<span style="font-size:12px;font-weight:700;color:' +
        ovc +
        ';margin-right:8px">' +
        ovr +
        '</span>' +
        statusHtml +
        '</div>'
      );
    }

    var smap = { minor: '#facc15', moderate: '#f97316', major: '#ef4444', careerThreatening: '#c084fc' };
    var slbl = { minor: 'Questionable', moderate: 'Out', major: 'IR', careerThreatening: 'Season' };

    var injRows = injured
      .map(function (p) {
        var col = smap[p.injury.severity] || '#f87171';
        var lbl = slbl[p.injury.severity] || p.injury.severity;
        return playerRow(
          p,
          '<span style="font-size:11px;color:' +
            col +
            ';font-weight:600">' +
            '🤕 ' +
            p.injury.type +
            ' — ' +
            lbl +
            ' · ' +
            p.injury.weeksRemaining +
            'w</span>',
        );
      })
      .join('');

    var susRows = suspended
      .map(function (p) {
        return playerRow(
          p,
          '<span style="font-size:11px;color:#c084fc;font-weight:600">' +
            '🚫 Suspended · ' +
            p.suspension.weeksRemaining +
            'w</span>',
        );
      })
      .join('');

    function section(title, rows, emptyMsg) {
      return (
        '<div style="background:var(--surface);border:1px solid var(--border);' +
        'border-radius:10px;overflow:hidden;margin-bottom:12px">' +
        '<div style="background:var(--surface2);padding:8px 12px;font-size:10px;font-weight:700;' +
        'text-transform:uppercase;letter-spacing:.8px;color:var(--accent2);' +
        'border-bottom:1px solid var(--border)">' +
        title +
        '</div>' +
        (rows ||
          '<div style="padding:10px 12px;font-size:12px;color:var(--muted2);font-style:italic">' +
            emptyMsg +
            '</div>') +
        '</div>'
      );
    }

    var totalOut = injured.length + suspended.length;
    var healthyLine = healthy.length + ' player' + (healthy.length !== 1 ? 's' : '') + ' available';

    setMainContent(
      '<div style="max-width:560px;margin:0 auto">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">' +
        '<button onclick="renderHome()" style="width:auto;padding:5px 12px;font-size:12px">⌂ Home</button>' +
        '<h2 style="margin:0">📋 Injury / Suspension Report</h2>' +
        '</div>' +
        (totalOut === 0
          ? '<div style="background:rgba(22,163,74,.08);border:1px solid var(--accent);border-radius:8px;' +
            'padding:14px;text-align:center;margin-bottom:12px;color:var(--accent2);font-size:13px">' +
            '✅ No active injuries or suspensions — full squad available.' +
            '</div>'
          : '<div style="font-size:12px;color:var(--muted2);margin-bottom:12px">' +
            totalOut +
            ' player' +
            (totalOut !== 1 ? 's' : '') +
            ' unavailable · ' +
            healthyLine +
            '</div>') +
        section('Injuries (' + injured.length + ')', injRows, 'No active injuries') +
        section('Suspensions (' + suspended.length + ')', susRows, 'No active suspensions') +
        '</div>',
    );

    window._updateInjuryBadge();
  };

  /* ── Refresh badge whenever renderHome fires ─────────────── */
  var _prevRH = window.renderHome;
  window.renderHome = function () {
    if (typeof _prevRH === 'function') _prevRH();
    setTimeout(window._updateInjuryBadge, 200);
  };
})();
