/* ── Coaching Hub — home tile destination ─────────────────── */
window.renderCoachingHub = function () {
  var tid = document.getElementById('teamSelect') && document.getElementById('teamSelect').value;
  var team = tid && typeof getTeamById === 'function' ? getTeamById(tid) : null;
  if (!team) {
    setMainContent('<p>Select a team first.</p>');
    return;
  }

  var hc = team.coach || {};
  var oc = team.oc || {};
  var dc = team.dc || {};

  function stars(val) {
    val = val || 0;
    var filled = Math.round(val / 20);
    return '★'.repeat(filled) + '☆'.repeat(5 - filled);
  }

  function ratingBar(label, val) {
    val = val || 0;
    var c = val >= 88 ? '#c084fc' : val >= 80 ? '#60a5fa' : val >= 72 ? '#4ade80' : val >= 65 ? '#facc15' : '#f87171';
    return (
      '<div style="margin-bottom:7px">' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">' +
      '<span style="color:var(--muted2)">' +
      label +
      '</span>' +
      '<span style="font-weight:600;color:' +
      c +
      '">' +
      val +
      '</span>' +
      '</div>' +
      '<div style="height:4px;background:var(--surface3);border-radius:2px">' +
      '<div style="height:4px;width:' +
      val +
      '%;background:' +
      c +
      ';border-radius:2px"></div>' +
      '</div>' +
      '</div>'
    );
  }

  function card(title, icon, person, ratingRows, schemeNote, changeBtn) {
    var js = person.jobSecurity || 60;
    var jsC = js >= 70 ? '#4ade80' : js >= 45 ? '#facc15' : '#f87171';
    var ctrt =
      person.contractRemaining !== undefined
        ? person.contractRemaining + ' yr' + (person.contractRemaining !== 1 ? 's' : '') + ' left'
        : '';
    return (
      '<div style="background:var(--surface);border:1px solid var(--border);' +
      'border-radius:10px;padding:16px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
      '<span style="font-size:22px">' +
      icon +
      '</span>' +
      '<div>' +
      '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">' +
      title +
      '</div>' +
      "<div style=\"font-family:'Barlow Condensed',sans-serif;font-size:18px;" +
      'font-weight:700;color:var(--accent2)">' +
      (person.name || 'Vacant') +
      '</div>' +
      (schemeNote ? '<div style="font-size:11px;color:var(--gold)">' + schemeNote + '</div>' : '') +
      '</div>' +
      '</div>' +
      ratingRows +
      '<div style="display:flex;justify-content:space-between;align-items:center;' +
      'margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">' +
      '<span style="font-size:11px;color:var(--muted2)">' +
      'Job Security: <strong style="color:' +
      jsC +
      '">' +
      js +
      '</strong>' +
      (ctrt ? ' &nbsp;·&nbsp; Contract: ' + ctrt : '') +
      '</span>' +
      changeBtn +
      '</div>' +
      '</div>'
    );
  }

  /* Scheme matchup preview */
  var ocScheme = oc.scheme || '—';
  var dcScheme = dc.scheme || '—';

  /* Scheme fit score summary */
  var fitHtml = '';
  if (typeof calculateSchemeFit === 'function' && team.roster && team.roster.length) {
    var offPlayers = team.roster.filter(function (p) {
      return ['QB', 'RB', 'WR', 'TE', 'T', 'G', 'C'].indexOf(p.positions[0]) >= 0;
    });
    var defPlayers = team.roster.filter(function (p) {
      return ['EDGE', 'DT', 'LB', 'CB', 'FS', 'SS'].indexOf(p.positions[0]) >= 0;
    });
    function avgFit(players) {
      if (!players.length) return 0;
      return Math.round(
        players.reduce(function (s, p) {
          return s + calculateSchemeFit(p, team);
        }, 0) / players.length,
      );
    }
    var offFit = avgFit(offPlayers);
    var defFit = avgFit(defPlayers);
    var offFitC = offFit >= 75 ? '#4ade80' : offFit >= 60 ? '#facc15' : '#f87171';
    var defFitC = defFit >= 75 ? '#4ade80' : defFit >= 60 ? '#facc15' : '#f87171';
    fitHtml =
      '<div style="background:var(--surface);border:1px solid var(--border);' +
      'border-radius:10px;padding:14px;margin-bottom:12px">' +
      '<div style="font-size:10px;font-weight:600;letter-spacing:1px;' +
      'text-transform:uppercase;color:var(--accent2);margin-bottom:10px">Scheme Fit</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<div style="text-align:center">' +
      '<div style="font-size:26px;font-weight:700;color:' +
      offFitC +
      '">' +
      offFit +
      '</div>' +
      '<div style="font-size:10px;color:var(--muted2)">Offensive Fit</div>' +
      '<div style="font-size:11px;color:var(--gold);margin-top:2px">' +
      ocScheme +
      '</div>' +
      '</div>' +
      '<div style="text-align:center">' +
      '<div style="font-size:26px;font-weight:700;color:' +
      defFitC +
      '">' +
      defFit +
      '</div>' +
      '<div style="font-size:10px;color:var(--muted2)">Defensive Fit</div>' +
      '<div style="font-size:11px;color:var(--gold);margin-top:2px">' +
      dcScheme +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  var chem = typeof team.chemistry === 'number' ? team.chemistry : null;
  var chemHtml =
    chem === null
      ? ''
      : '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px">' +
        ratingBar('Team Chemistry', chem) +
        '<div class="small" style="color:var(--muted2)">' +
        (team.chemistryTrend > 0
          ? '▲ +' + team.chemistryTrend
          : team.chemistryTrend < 0
            ? '▼ ' + team.chemistryTrend
            : 'Steady') +
        ' this week' +
        (team.winningStreak
          ? ' · ' + Math.abs(team.winningStreak) + '-game ' + (team.winningStreak > 0 ? 'win' : 'losing') + ' streak'
          : '') +
        '. Driven by player morale, leadership and results; affects every game.</div>' +
        '</div>';

  var hcCard = card(
    'Head Coach',
    '🏈',
    hc,
    ratingBar('Offense Rating', hc.offenseRating) +
      ratingBar('Defense Rating', hc.defenseRating) +
      ratingBar('Leadership', hc.leadership),
    null,
    '<button onclick="typeof renderUserCoachHire===\'function\'&&renderUserCoachHire()" ' +
      'style="width:auto;padding:4px 10px;font-size:11px;' +
      'background:rgba(239,68,68,.12);border-color:#ef4444;color:#f87171">🔥 Replace</button>',
  );

  var ocCard = card(
    'Offensive Coordinator',
    '⚡',
    oc,
    ratingBar('Offense Rating', oc.offenseRating),
    'Scheme: ' + ocScheme,
    '<button onclick="typeof renderUserOCHire===\'function\'&&renderUserOCHire()" ' +
      'style="width:auto;padding:4px 10px;font-size:11px">Change</button>',
  );

  var dcCard = card(
    'Defensive Coordinator',
    '🛡',
    dc,
    ratingBar('Defense Rating', dc.defenseRating),
    'Scheme: ' + dcScheme,
    '<button onclick="typeof renderUserDCHire===\'function\'&&renderUserDCHire()" ' +
      'style="width:auto;padding:4px 10px;font-size:11px">Change</button>',
  );

  setMainContent(
    '<h2>' +
      team.city +
      ' ' +
      team.nickname +
      ' — Coaching Staff</h2>' +
      '<p class="small" style="margin-bottom:12px">Coaching ratings boost team performance each game. ' +
      'Scheme fit affects player morale and development.</p>' +
      fitHtml +
      chemHtml +
      '<div style="display:grid;grid-template-columns:1fr;gap:12px">' +
      hcCard +
      ocCard +
      dcCard +
      '</div>',
  );
};
