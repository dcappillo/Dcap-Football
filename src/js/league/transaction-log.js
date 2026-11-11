/* ============================================================
   TRANSACTION LOG + OFFSEASON SUMMARY + TEAM REPORTS
   ============================================================ */

/* ------------------------------------------------------------
   1. Global Transaction Log
------------------------------------------------------------ */

let transactionLog = [];

/* Helper to add a log entry */
function logTransaction(type, description, teamId = null, player = null, extraTeamId = null) {
  transactionLog.push({
    timestamp: Date.now(),
    week: typeof currentWeekIndex !== 'undefined' ? currentWeekIndex + 1 : null,
    season: typeof window.simYear !== 'undefined' ? window.simYear : null,
    type,
    description,
    teamId,
    extraTeamId: extraTeamId || null,
    playerName: player ? player.name : null,
  });
}

/* Helper: log a trade with full player/pick detail for both teams */
function logTradeTransaction(teamA, plA, pkA, teamB, plB, pkB) {
  function pickStr(ids) {
    return ids.map(function (id) {
      var m = id.match(/_R(\d+)_Y(\d+)/);
      return m ? 'Yr' + m[2] + ' Rd' + m[1] + ' pick' : 'a pick';
    });
  }
  function sideStr(players, picks) {
    var parts = (players || [])
      .map(function (p) {
        return p.positions[0] + ' ' + p.name;
      })
      .concat(pickStr(picks || []));
    return parts.length ? parts.join(', ') : 'nothing';
  }
  var desc =
    teamA.city +
    ' ' +
    teamA.nickname +
    ' traded ' +
    sideStr(plA, pkA) +
    ' to ' +
    teamB.city +
    ' ' +
    teamB.nickname +
    ' for ' +
    sideStr(plB, pkB) +
    '.';
  logTransaction('Trade', desc, teamA.id, null, teamB.id);
}

/* ------------------------------------------------------------
   2. Hook into existing actions to log moves
------------------------------------------------------------ */

/* Free agent signing */
const oldSubmitContractOffer = submitContractOffer;
submitContractOffer = function (playerId) {
  const player = freeAgents.find((p) => p.id === playerId) || null; /* capture BEFORE removal */
  const before = freeAgents.length;
  oldSubmitContractOffer(playerId);

  const after = freeAgents.length;
  if (after < before) {
    logTransaction('Signing', `User signed a player`, userTeamId, player);
  }
};

/* CPU free agent signing */
const oldCpuSignPlayer = cpuSignPlayer;
cpuSignPlayer = function (player) {
  const result = oldCpuSignPlayer(player);
  if (result) {
    const team = listAllTeams(league).find((t) => t.roster.includes(player));
    logTransaction('Signing', `${team.city} ${team.nickname} signed ${player.name}`, team.id, player);
  }
  return result;
};

/* Player release */
const oldReleasePlayer = releasePlayer;
releasePlayer = function (team, playerId) {
  const player = team.roster.find((p) => p.id === playerId);
  oldReleasePlayer(team, playerId);
  logTransaction('Release', `${team.city} ${team.nickname} released ${player.name}`, team.id, player);
};

/* Trades (from Part 4) */
const oldExecuteTrade = executeTrade;
executeTrade = function (teamA, teamB, playersA, playersB, picksA, picksB) {
  oldExecuteTrade(teamA, teamB, playersA, playersB, picksA, picksB);

  let desc = `${teamA.city} ${teamA.nickname} and ${teamB.city} ${teamB.nickname} completed a trade.`;

  logTransaction('Trade', desc, null, null);
};

/* ------------------------------------------------------------
   5. Transaction Wire — full NFL-style transaction log
------------------------------------------------------------ */

function renderTransactionLog(filterTeam, filterType) {
  filterTeam = filterTeam || 'all';
  filterType = filterType || 'all';

  /* ── Build team list for dropdown ── */
  var allTeams =
    typeof listAllTeams === 'function' && league
      ? listAllTeams(league)
          .slice()
          .sort(function (a, b) {
            return (a.city + a.nickname).localeCompare(b.city + b.nickname);
          })
      : [];

  var teamOptions = '<option value="all">All Teams</option>';
  if (allTeams.length) {
    teamOptions += '<optgroup label="── Teams ──">';
    allTeams.forEach(function (t) {
      var sel = filterTeam === t.id ? ' selected' : '';
      teamOptions +=
        '<option value="' +
        t.id +
        '"' +
        sel +
        '>' +
        t.city +
        ' ' +
        t.nickname +
        (t.id === userTeamId ? ' ★' : '') +
        '</option>';
    });
    teamOptions += '</optgroup>';
  }

  /* ── Type filter pills ── */
  var types = ['all', 'Trade', 'Signing', 'Re-sign', 'Release', 'Draft'];
  var typeLabels = {
    all: 'All',
    Trade: '🔄 Trades',
    Signing: '✍ Signings',
    'Re-sign': '🔒 Re-signs',
    Release: '✂ Cuts',
    Draft: '🎯 Draft',
  };

  function typePill(t) {
    var active = filterType === t;
    return (
      '<button onclick="renderTransactionLog(\'' +
      filterTeam +
      "','" +
      t +
      '\')" ' +
      'style="width:auto;padding:4px 11px;font-size:11px;font-weight:' +
      (active ? '700' : '400') +
      ';' +
      'background:' +
      (active ? 'var(--accent-dim)' : 'var(--surface2)') +
      ';' +
      'border:1px solid ' +
      (active ? 'var(--accent)' : 'var(--border)') +
      ';' +
      'color:' +
      (active ? 'var(--accent2)' : 'var(--muted2)') +
      ';' +
      'border-radius:99px;white-space:nowrap;margin-bottom:0">' +
      typeLabels[t] +
      '</button>'
    );
  }

  /* ── Type badge colours ── */
  function typeBadge(type) {
    var cfg = {
      Trade: { bg: 'rgba(59,130,246,.15)', border: '#3b82f6', color: '#60a5fa' },
      Signing: { bg: 'rgba(22,163,74,.15)', border: 'var(--accent)', color: 'var(--accent2)' },
      'Re-sign': { bg: 'rgba(34,197,94,.12)', border: '#16a34a', color: '#4ade80' },
      Release: { bg: 'rgba(248,113,113,.12)', border: '#f87171', color: '#fca5a5' },
      Draft: { bg: 'rgba(245,158,11,.12)', border: '#f59e0b', color: '#fbbf24' },
    };
    var c = cfg[type] || { bg: 'var(--surface3)', border: 'var(--border)', color: 'var(--muted2)' };
    return (
      '<span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;' +
      'font-weight:700;letter-spacing:.5px;background:' +
      c.bg +
      ';border:1px solid ' +
      c.border +
      ';' +
      'color:' +
      c.color +
      ';white-space:nowrap">' +
      type.toUpperCase() +
      '</span>'
    );
  }

  /* ── Filter entries ── */
  var entries = transactionLog.slice().reverse();
  if (filterTeam !== 'all') {
    entries = entries.filter(function (e) {
      return e.teamId === filterTeam || e.extraTeamId === filterTeam;
    });
  }
  if (filterType !== 'all') {
    entries = entries.filter(function (e) {
      return e.type === filterType;
    });
  }

  /* ── Week label helper ── */
  function weekLabel(e) {
    if (!e.season && !e.week) return '';
    var parts = [];
    if (e.season) parts.push('S' + e.season);
    if (e.week) parts.push('Wk ' + e.week);
    return parts.join(' · ');
  }

  /* ── Rows ── */
  var rows = '';
  if (!entries.length) {
    rows =
      '<tr><td colspan="3" style="text-align:center;color:var(--muted2);padding:24px 0">' +
      'No transactions match this filter.</td></tr>';
  } else {
    entries.forEach(function (e) {
      var isMyTeam = e.teamId === userTeamId || e.extraTeamId === userTeamId;
      var rowBg = isMyTeam ? 'rgba(22,163,74,.05)' : '';
      var wk = weekLabel(e);
      rows +=
        '<tr style="' +
        (rowBg ? 'background:' + rowBg + '!important' : '') +
        '">' +
        '<td style="min-width:80px">' +
        (wk ? '<div style="font-size:11px;font-weight:600;color:var(--accent2)">' + wk + '</div>' : '') +
        '<div style="font-size:10px;color:var(--muted)">' +
        new Date(e.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        '</div>' +
        '</td>' +
        '<td style="min-width:90px">' +
        typeBadge(e.type) +
        '</td>' +
        '<td style="white-space:normal;font-size:12px;line-height:1.5;padding:8px 10px">' +
        (isMyTeam ? '<span style="color:var(--accent2);font-weight:600">★ </span>' : '') +
        e.description +
        '</td>' +
        '</tr>';
    });
  }

  /* ── Summary counts ── */
  var trades = transactionLog.filter(function (e) {
    return e.type === 'Trade';
  }).length;
  var signings = transactionLog.filter(function (e) {
    return e.type === 'Signing' || e.type === 'Re-sign';
  }).length;
  var cuts = transactionLog.filter(function (e) {
    return e.type === 'Release';
  }).length;

  var html =
    '<div style="max-width:680px;margin:0 auto">' +
    /* back + title */
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">' +
    '<button onclick="setMainContent(document.querySelector(\'#homeHero\').parentElement.innerHTML)" ' +
    'style="width:auto;padding:5px 12px;font-size:12px">← Home</button>' +
    '<div>' +
    '<h2 style="margin:0;font-size:20px">Transaction Wire</h2>' +
    '<div style="font-size:11px;color:var(--muted2)">' +
    trades +
    ' trades · ' +
    signings +
    ' signings · ' +
    cuts +
    ' cuts' +
    '</div>' +
    '</div>' +
    '</div>' +
    /* stat chips */
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' +
    _txChip('🔄', 'Trades', trades) +
    _txChip('✍', 'Signings', signings) +
    _txChip('✂', 'Cuts', cuts) +
    '</div>' +
    /* team selector */
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
    '<label style="font-size:11px;color:var(--muted2);margin:0;white-space:nowrap">Filter by team:</label>' +
    '<select onchange="renderTransactionLog(this.value,\'' +
    filterType +
    '\')" ' +
    'style="width:auto;padding:5px 28px 5px 10px;font-size:12px;margin:0">' +
    teamOptions +
    '</select>' +
    '</div>' +
    /* type pills */
    '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">' +
    types.map(typePill).join('') +
    '</div>' +
    /* table */
    '<div class="table-wrap">' +
    '<table>' +
    '<thead><tr>' +
    '<th>When</th><th>Type</th><th>Transaction</th>' +
    '</tr></thead>' +
    '<tbody>' +
    rows +
    '</tbody>' +
    '</table>' +
    '</div>' +
    '</div>';

  setMainContent(html);
}

function _txChip(icon, label, count) {
  return (
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;' +
    'padding:8px 14px;display:flex;flex-direction:column;align-items:center;min-width:72px">' +
    '<div style="font-size:16px">' +
    icon +
    '</div>' +
    '<div style="font-size:18px;font-weight:700;font-family:\'Barlow Condensed\',sans-serif;line-height:1">' +
    count +
    '</div>' +
    '<div style="font-size:10px;color:var(--muted2)">' +
    label +
    '</div>' +
    '</div>'
  );
}
