/* ============================================================
   STATS + LEADERS (from Phase 3)
   ============================================================ */

/* ------------------ Standings (merged with League Overview) -------------- */

function renderLeagueOverview() {
  renderStandings();
} /* alias — redirects */

function renderStandings() {
  let html = `<h2>Standings</h2>`;
  html += `<p class="small">Sorted by record within each division. PD = point differential.</p>`;

  league.conferences.forEach((conf) => {
    html += `<h3>${conf.name}</h3>`;
    conf.divisions.forEach((div) => {
      const sorted = div.teams.slice().sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst);
      });

      html += `<h4>${div.name}</h4>`;
      html += `<table>
        <thead><tr>
          <th>Team</th>
          <th>Coach</th>
          <th>PWR</th>
          <th>W</th><th>L</th><th>T</th>
          <th>PF</th><th>PA</th><th>PD</th>
        </tr></thead>
        <tbody>`;

      sorted.forEach((team, idx) => {
        const pd = team.pointsFor - team.pointsAgainst;
        const pdTxt = pd > 0 ? `+${pd}` : `${pd}`;
        const bold =
          team === getTeamById(document.getElementById('teamSelect') && document.getElementById('teamSelect').value)
            ? 'background:rgba(22,163,74,0.08);'
            : '';

        html += `<tr style="${bold}">
          <td>${idx === 0 ? '🥇 ' : ''}${team.city} ${team.nickname}</td>
          <td style="color:var(--muted2);font-size:11px">${team.coach.name}</td>
          <td style="color:${team.powerRating >= 85 ? '#60a5fa' : team.powerRating >= 75 ? '#4ade80' : '#94a3b8'}">${team.powerRating}</td>
          <td style="color:#4ade80;font-weight:600">${team.wins}</td>
          <td style="color:#f87171">${team.losses}</td>
          <td>${team.ties}</td>
          <td>${team.pointsFor}</td>
          <td>${team.pointsAgainst}</td>
          <td style="color:${pd > 0 ? '#4ade80' : pd < 0 ? '#f87171' : '#94a3b8'}">${pdTxt}</td>
        </tr>`;
      });

      html += `</tbody></table>`;
    });
  });

  setMainContent(html);
}

/* ------------------ Week Results ------------------ */

function renderWeekResults(week) {
  var tid = (document.getElementById('teamSelect') || {}).value || userTeamId;

  /* Sort: user's game first */
  var games = (week.games || []).slice().sort(function (a, b) {
    var userInA = a.homeTeamId === tid || a.awayTeamId === tid ? -1 : 0;
    var userInB = b.homeTeamId === tid || b.awayTeamId === tid ? -1 : 0;
    return userInA - userInB;
  });

  function boxScore(g) {
    var home = getTeamById(g.homeTeamId);
    var away = getTeamById(g.awayTeamId);
    var isUser = g.homeTeamId === tid || g.awayTeamId === tid;

    var ht = g.homeTotals || {};
    var at = g.awayTotals || {};

    /* Winner highlight */
    var homeWon = g.homeScore > g.awayScore;
    var awayWon = g.awayScore > g.homeScore;

    function scoreStyle(won) {
      return (
        "font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:800;" +
        (won ? 'color:var(--accent2)' : 'color:var(--muted2)')
      );
    }

    /* Top score bar */
    var scoreBar =
      '<div style="display:flex;align-items:center;justify-content:space-between;' +
      'padding:12px 16px;background:var(--surface2);border-radius:8px 8px 0 0">' +
      '<div style="flex:1">' +
      '<div style="font-size:12px;color:var(--muted2);margin-bottom:2px">' +
      (awayWon ? '● ' : '') +
      'AWAY' +
      '</div>' +
      '<div style="font-size:14px;font-weight:600">' +
      away.city +
      ' ' +
      away.nickname +
      '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:baseline;gap:8px">' +
      '<span style="' +
      scoreStyle(awayWon) +
      '">' +
      g.awayScore +
      '</span>' +
      '<span style="color:var(--muted);font-size:14px">–</span>' +
      '<span style="' +
      scoreStyle(homeWon) +
      '">' +
      g.homeScore +
      '</span>' +
      '</div>' +
      '<div style="flex:1;text-align:right">' +
      '<div style="font-size:12px;color:var(--muted2);margin-bottom:2px">' +
      (homeWon ? '● ' : '') +
      'HOME' +
      '</div>' +
      '<div style="font-size:14px;font-weight:600">' +
      home.city +
      ' ' +
      home.nickname +
      '</div>' +
      '</div>' +
      '</div>';

    /* Stat rows — only if totals were stored (post-migration games) */
    var statRows = '';
    if (ht.passYds !== undefined || at.passYds !== undefined) {
      function statRow(label, awayVal, homeVal, higherIsBetter) {
        higherIsBetter = higherIsBetter !== false;
        var awayBetter = higherIsBetter ? awayVal > homeVal : awayVal < homeVal;
        var homeBetter = higherIsBetter ? homeVal > awayVal : homeVal < awayVal;
        return (
          '<div style="display:flex;align-items:center;padding:5px 14px;' +
          'border-bottom:1px solid rgba(30,45,71,.3)">' +
          '<div style="flex:1;font-size:13px;font-weight:' +
          (awayBetter ? '700' : '400') +
          ';' +
          'color:' +
          (awayBetter ? 'var(--text)' : 'var(--muted2)') +
          '">' +
          awayVal +
          '</div>' +
          '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;' +
          'letter-spacing:.8px;text-align:center;width:120px">' +
          label +
          '</div>' +
          '<div style="flex:1;text-align:right;font-size:13px;font-weight:' +
          (homeBetter ? '700' : '400') +
          ';' +
          'color:' +
          (homeBetter ? 'var(--text)' : 'var(--muted2)') +
          '">' +
          homeVal +
          '</div>' +
          '</div>'
        );
      }

      var aPass = at.passYds || 0,
        hPass = ht.passYds || 0;
      var aRush = at.rushYds || 0,
        hRush = ht.rushYds || 0;
      var aTD = (at.passTDs || 0) + (at.rushTDs || 0),
        hTD = (ht.passTDs || 0) + (ht.rushTDs || 0);
      var aTO = at.turnoversCommitted || 0,
        hTO = ht.turnoversCommitted || 0;
      var aFG = (at.fgMade || 0) + '/' + (at.fgAtt || 0),
        hFG = (ht.fgMade || 0) + '/' + (ht.fgAtt || 0);
      var aXP = (at.xpMade || 0) + '/' + (at.xpAtt || 0),
        hXP = (ht.xpMade || 0) + '/' + (ht.xpAtt || 0);
      var aSack = at.teamSacks || 0,
        hSack = ht.teamSacks || 0;

      statRows =
        '<div style="background:var(--surface);border-left:1px solid var(--border);' +
        'border-right:1px solid var(--border)">' +
        statRow('Pass Yds', aPass, hPass) +
        statRow('Rush Yds', aRush, hRush) +
        statRow('Total Yds', aPass + aRush, hPass + hRush) +
        statRow('Touchdowns', aTD, hTD) +
        statRow('Field Goals', aFG, hFG) +
        statRow('Extra Points', aXP, hXP) +
        statRow('Turnovers', aTO, hTO, false) /* lower is better */ +
        statRow('Sacks', aSack, hSack) +
        '</div>';
    }

    /* Expand/collapse toggle for full player box score */
    var gameId = g.homeTeamId + '_' + g.awayTeamId + '_W' + week.weekNumber;
    var playerBtn = isUser
      ? '<button onclick="togglePlayerBoxScore(\'' +
        gameId +
        "','" +
        g.homeTeamId +
        "','" +
        g.awayTeamId +
        '\')" ' +
        'style="width:100%;text-align:center;font-size:11px;' +
        'background:transparent;border:none;border-top:1px solid var(--border);' +
        'color:var(--muted2);padding:7px;cursor:pointer;' +
        'border-radius:0 0 8px 8px" ' +
        'id="pbtn-' +
        gameId +
        '">' +
        '▼ Player Box Score' +
        '</button>' +
        '<div id="pbs-' +
        gameId +
        '" style="display:none"></div>'
      : '';

    var borderColor = isUser ? 'var(--accent)' : 'var(--border)';
    var borderWidth = isUser ? '2px' : '1px';

    return (
      '<div style="border:' +
      borderWidth +
      ' solid ' +
      borderColor +
      ';' +
      'border-radius:10px;overflow:hidden;margin-bottom:12px' +
      (isUser ? ';box-shadow:0 0 0 1px rgba(22,163,74,.2)' : '') +
      '">' +
      scoreBar +
      statRows +
      playerBtn +
      '</div>'
    );
  }

  var weekTitle = week.isPlayoff && week.label ? week.label + ' Results' : 'Week ' + week.weekNumber + ' Results';
  var html = '<h2>' + weekTitle + '</h2>';
  html += games.map(boxScore).join('');

  setMainContent(html);
}

/* ── Player box score for user's game ───────────────────── */
window.togglePlayerBoxScore = function (gameId, homeId, awayId) {
  var panel = document.getElementById('pbs-' + gameId);
  var btn = document.getElementById('pbtn-' + gameId);
  if (!panel) return;

  if (panel.style.display !== 'none') {
    panel.style.display = 'none';
    if (btn) btn.textContent = '▼ Player Box Score';
    return;
  }

  var tid = (document.getElementById('teamSelect') || {}).value || userTeamId;
  var home = getTeamById(homeId);
  var away = getTeamById(awayId);
  var isHomeUser = homeId === tid;
  var myTeam = isHomeUser ? home : away;
  var oppTeam = isHomeUser ? away : home;

  /* ── Look up stored per-game player stats from the game object ── */
  var gameObj = null;

  /* Search regular season schedule */
  if (typeof schedule !== 'undefined' && schedule) {
    for (var _wi = 0; _wi < schedule.length; _wi++) {
      var _wk = schedule[_wi];
      if (!_wk.games) continue;
      for (var _gi = 0; _gi < _wk.games.length; _gi++) {
        var _g = _wk.games[_gi];
        if (_g.homeTeamId === homeId && _g.awayTeamId === awayId && _g.played) {
          gameObj = _g;
        }
      }
    }
  }

  /* Also search playoff results (games live outside schedule[]) */
  if (!gameObj && window.playoffs && window.playoffs.results) {
    window.playoffs.results.forEach(function (r) {
      (r.games || []).forEach(function (g) {
        if (g.homeTeamId === homeId && g.awayTeamId === awayId && g.played) {
          gameObj = g;
        }
      });
    });
  }
  /* Also check the current in-progress playoff week */
  if (!gameObj && window.playoffs && window.playoffs.currentWeek) {
    (window.playoffs.currentWeek.games || []).forEach(function (g) {
      if (g.homeTeamId === homeId && g.awayTeamId === awayId && g.played) {
        gameObj = g;
      }
    });
  }
  var homePerGame = gameObj && gameObj.homePlayerStats;
  var awayPerGame = gameObj && gameObj.awayPlayerStats;

  /* Build a player table from a per-game stats map { playerId: {name,pos,ovr,stats} }
     or fall back to team.roster p.stats when no per-game data exists (old saves). */
  function playerTable(team, title, perGameMap) {
    /* Convert per-game map to flat array, or fall back to roster */
    var players;
    if (perGameMap && Object.keys(perGameMap).length > 0) {
      players = Object.keys(perGameMap).map(function (id) {
        var entry = perGameMap[id];
        return {
          id: id,
          name: entry.name,
          positions: [entry.pos],
          attributes: { overall: entry.ovr },
          stats: entry.stats,
        };
      });
    } else {
      /* Fallback: use cumulative roster stats */
      players = team.roster.filter(function (p) {
        var s = p.stats || {};
        return (s.gamesPlayed || 0) > 0;
      });
    }

    if (!players.length) return '';

    function gs(p) {
      return p.stats || {};
    }

    /* Offense */
    var qbs = players.filter(function (p) {
      var s = gs(p);
      return p.positions[0] === 'QB' && ((s.passingYards || 0) > 0 || (s.passingTD || 0) > 0);
    });
    var rushers = players
      .filter(function (p) {
        var s = gs(p);
        return (s.rushingYards || 0) > 0 || (s.rushingTD || 0) > 0;
      })
      .sort(function (a, b) {
        return (gs(b).rushingYards || 0) - (gs(a).rushingYards || 0);
      })
      .slice(0, 5);
    var receivers = players
      .filter(function (p) {
        var s = gs(p);
        return (s.receivingYards || 0) > 0 || (s.receivingTD || 0) > 0;
      })
      .sort(function (a, b) {
        return (gs(b).receivingYards || 0) - (gs(a).receivingYards || 0);
      })
      .slice(0, 6);

    /* Defense */
    var tacklers = players
      .filter(function (p) {
        return (gs(p).tackles || 0) > 0;
      })
      .sort(function (a, b) {
        return (gs(b).tackles || 0) - (gs(a).tackles || 0);
      })
      .slice(0, 6);
    var passRush = players
      .filter(function (p) {
        return (gs(p).sacks || 0) > 0 || (gs(p).interceptions || 0) > 0;
      })
      .sort(function (a, b) {
        return (
          (gs(b).sacks || 0) * 2 +
          (gs(b).interceptions || 0) * 3 -
          ((gs(a).sacks || 0) * 2 + (gs(a).interceptions || 0) * 3)
        );
      })
      .slice(0, 4);

    function pRow(p, cols) {
      var s = gs(p);
      var ovr = p.attributes ? p.attributes.overall : 70;
      return (
        '<tr>' +
        '<td style="white-space:nowrap"><span style="font-size:11px;font-weight:600;' +
        'color:' +
        ovrColor(ovr) +
        '">' +
        p.positions[0] +
        '</span>' +
        ' <span style="font-size:12px">' +
        p.name +
        '</span></td>' +
        cols
          .map(function (c) {
            return '<td style="text-align:right;font-size:12px">' + (s[c.key] || 0) + '</td>';
          })
          .join('') +
        '</tr>'
      );
    }

    function sect(label, players, cols) {
      if (!players.length) return '';
      return (
        '<div style="margin-bottom:12px">' +
        '<div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;' +
        'color:var(--accent2);margin-bottom:4px">' +
        label +
        '</div>' +
        '<table style="width:100%;font-size:11px"><thead><tr>' +
        '<th style="text-align:left;color:var(--muted);font-weight:600;font-size:10px">Player</th>' +
        cols
          .map(function (c) {
            return (
              '<th style="text-align:right;color:var(--muted);font-weight:600;font-size:10px">' + c.label + '</th>'
            );
          })
          .join('') +
        '</tr></thead><tbody>' +
        players
          .map(function (p) {
            return pRow(p, cols);
          })
          .join('') +
        '</tbody></table>' +
        '</div>'
      );
    }

    var inner =
      sect('Passing', qbs, [
        { key: 'passingYards', label: 'YDS' },
        { key: 'passingTD', label: 'TD' },
        { key: 'interceptionsThrown', label: 'INT' },
      ]) +
      sect('Rushing', rushers, [
        { key: 'rushingYards', label: 'YDS' },
        { key: 'rushingTD', label: 'TD' },
      ]) +
      sect('Receiving', receivers, [
        { key: 'receivingYards', label: 'YDS' },
        { key: 'receivingTD', label: 'TD' },
      ]) +
      sect('Tackles', tacklers, [
        { key: 'tackles', label: 'TKL' },
        { key: 'sacks', label: 'SCK' },
      ]) +
      sect('Pass Rush / Turnover', passRush, [
        { key: 'sacks', label: 'SCK' },
        { key: 'interceptions', label: 'INT' },
      ]);

    if (!inner) return '';
    return (
      '<div style="margin-bottom:16px">' +
      '<div style="font-size:12px;font-weight:700;color:var(--muted2);' +
      'text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">' +
      title +
      '</div>' +
      inner +
      '</div>'
    );
  }

  var myPerGame = isHomeUser ? homePerGame : awayPerGame;
  var oppPerGame = isHomeUser ? awayPerGame : homePerGame;

  panel.innerHTML =
    '<div style="padding:12px 14px;border-top:1px solid var(--border);background:var(--bg)">' +
    playerTable(myTeam, myTeam.city + ' ' + myTeam.nickname, myPerGame) +
    playerTable(oppTeam, oppTeam.city + ' ' + oppTeam.nickname, oppPerGame) +
    '</div>';

  panel.style.display = 'block';
  if (btn) btn.textContent = '▲ Hide Player Box Score';
};

/* ------------------ Team Stats ------------------ */

function renderTeamStats() {
  let html = `<h2>Team Stats</h2>`;
  html += `<p class="small">Offense/defense yards and turnovers.</p>`;

  const allTeams = listAllTeams(league)
    .slice()
    .sort((a, b) => {
      return b.teamStats.totalOffenseYards - a.teamStats.totalOffenseYards;
    });

  html += `<table>
    <thead>
      <tr>
        <th>Team</th>
        <th>Record</th>
        <th>Off Yds</th>
        <th>Def Yds</th>
        <th>TO Forced</th>
        <th>TO Committed</th>
      </tr>
    </thead>
    <tbody>
  `;

  allTeams.forEach((team) => {
    const ts = team.teamStats;
    html += `
      <tr>
        <td>${team.city} ${team.nickname}</td>
        <td>${team.wins}-${team.losses}-${team.ties}</td>
        <td>${ts.totalOffenseYards}</td>
        <td>${ts.totalDefenseYards}</td>
        <td>${ts.turnoversForced}</td>
        <td>${ts.turnoversCommitted}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  setMainContent(html);
}

/* ------------------ League Leaders ------------------ */

function renderLeagueLeaders() {
  const allTeams = listAllTeams(league);
  const allPlayers = [];
  allTeams.forEach((t) => t.roster.forEach((p) => allPlayers.push({ team: t, player: p })));

  function topN(selector, n = 10) {
    return allPlayers
      .slice()
      .sort((a, b) => selector(b.player) - selector(a.player))
      .slice(0, n)
      .filter((entry) => selector(entry.player) > 0);
  }

  const passYds = topN((p) => p.stats.passingYards);
  const rushYds = topN((p) => p.stats.rushingYards);
  const recYds = topN((p) => p.stats.receivingYards);
  const sacks = topN((p) => p.stats.sacks);
  const tackles = topN((p) => p.stats.tackles);
  const ints = topN((p) => p.stats.interceptions);

  let html = `<h2>League Leaders</h2>`;
  html += `<p class="small">Top 10 in key categories.</p>`;

  function renderLeaderTable(title, list, selector, statLabel) {
    let h = `<h3>${title}</h3>`;
    h += `<table>
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Team</th>
          <th>${statLabel}</th>
        </tr>
      </thead>
      <tbody>
    `;
    list.forEach((entry, idx) => {
      h += `
        <tr>
          <td>${idx + 1}</td>
          <td>${entry.player.name}</td>
          <td>${entry.team.city} ${entry.team.nickname}</td>
          <td>${selector(entry.player)}</td>
        </tr>
      `;
    });
    h += `</tbody></table>`;
    return h;
  }

  html += renderLeaderTable('Passing Yards', passYds, (p) => p.stats.passingYards, 'Yards');
  html += renderLeaderTable('Rushing Yards', rushYds, (p) => p.stats.rushingYards, 'Yards');
  html += renderLeaderTable('Receiving Yards', recYds, (p) => p.stats.receivingYards, 'Yards');
  html += renderLeaderTable('Tackles', tackles, (p) => p.stats.tackles, 'Tackles');
  html += renderLeaderTable('Sacks', sacks, (p) => p.stats.sacks, 'Sacks');
  html += renderLeaderTable('Interceptions', ints, (p) => p.stats.interceptions, 'INT');

  setMainContent(html);
}
