/* ── Home dashboard: team select + division standings + last game ───── */
(function () {
  /* Populate homeTeamSelect from the same source as teamSelect */
  function populateHomeSelect() {
    var sel = document.getElementById('homeTeamSelect');
    var src = document.getElementById('teamSelect');
    if (!sel || !src) return;
    sel.innerHTML = src.innerHTML;
    sel.value = src.value;
  }

  /* Sync both dropdowns whenever either changes */
  function syncSelects(value) {
    var src = document.getElementById('teamSelect');
    var home = document.getElementById('homeTeamSelect');
    if (src && src.value !== value) src.value = value;
    if (home && home.value !== value) home.value = value;
    /* fire the existing change handler on the sidebar select */
    if (src) src.dispatchEvent(new Event('change'));
  }

  window.onHomeTeamChange = function (value) {
    syncSelects(value);
    renderHomeDashboard(value);
  };

  /* ── Render the dashboard panel ─────────────────────────── */
  window.renderHomeDashboard = function (tid) {
    var panel = document.getElementById('homeDashboard');
    if (!panel) return;

    if (!tid || typeof league === 'undefined' || !league || typeof teamMap === 'undefined' || !teamMap) {
      panel.innerHTML = '';
      return;
    }

    var team = typeof getTeamById === 'function' ? getTeamById(tid) : null;
    if (!team) {
      panel.innerHTML = '';
      return;
    }

    /* ── 1. Last game result ──────────────────────────────── */
    var lastGameHtml = '';
    if (typeof schedule !== 'undefined' && schedule && currentWeekIndex > 0) {
      /* Walk backward to find the most recent played game involving this team */
      var lastGame = null,
        lastWeekNum = 0;
      for (var w = currentWeekIndex - 1; w >= 0; w--) {
        var wk = schedule[w];
        if (!wk) continue;
        var g = (wk.games || []).find(function (g) {
          return g.played && (g.homeTeamId === tid || g.awayTeamId === tid);
        });
        if (g) {
          lastGame = g;
          lastWeekNum = wk.weekNumber;
          break;
        }
      }

      if (lastGame) {
        var isHome = lastGame.homeTeamId === tid;
        var oppId = isHome ? lastGame.awayTeamId : lastGame.homeTeamId;
        var opp = getTeamById(oppId) || { city: '', nickname: oppId };
        var myScore = isHome ? lastGame.homeScore : lastGame.awayScore;
        var oppScore = isHome ? lastGame.awayScore : lastGame.homeScore;
        var won = myScore > oppScore;
        var tied = myScore === oppScore;
        var resultTxt = won ? 'W' : tied ? 'T' : 'L';
        var resultColor = won ? '#4ade80' : tied ? '#facc15' : '#f87171';
        var locLabel = isHome ? 'vs' : '@';

        lastGameHtml =
          '<div style="background:var(--surface2);border-radius:8px;padding:10px 12px;margin-bottom:12px">' +
          '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;' +
          'letter-spacing:.8px;margin-bottom:6px">Week ' +
          lastWeekNum +
          ' Result</div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
          '<span style="font-size:20px;font-weight:800;color:' +
          resultColor +
          ';' +
          "font-family:'Barlow Condensed',sans-serif;min-width:20px\">" +
          resultTxt +
          '</span>' +
          '<div style="flex:1">' +
          '<div style="font-size:13px;font-weight:600">' +
          locLabel +
          ' ' +
          opp.city +
          ' ' +
          opp.nickname +
          '</div>' +
          '<div style="font-size:18px;font-weight:700;font-family:\'Barlow Condensed\',sans-serif">' +
          '<span style="color:' +
          resultColor +
          '">' +
          myScore +
          '</span>' +
          ' <span style="color:var(--muted);font-size:14px">–</span> ' +
          '<span>' +
          oppScore +
          '</span>' +
          '</div>' +
          '</div>' +
          '</div>' +
          '</div>';
      }
    }

    /* ── 2. Division standings ───────────────────────────── */
    var divTeams = [];
    if (league.conferences) {
      league.conferences.forEach(function (conf) {
        (conf.divisions || []).forEach(function (div) {
          var found = (div.teams || []).find(function (t) {
            return t.id === tid;
          });
          if (found) divTeams = div.teams.slice();
        });
      });
    }

    var standingsHtml = '';
    if (divTeams.length) {
      divTeams.sort(function (a, b) {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst);
      });

      var divName = '';
      league.conferences.forEach(function (conf) {
        (conf.divisions || []).forEach(function (div) {
          if (
            (div.teams || []).find(function (t) {
              return t.id === tid;
            })
          )
            divName = div.name;
        });
      });

      var rows = divTeams
        .map(function (t, idx) {
          var isUser = t.id === tid;
          var pd = t.pointsFor - t.pointsAgainst;
          var pdTxt = pd > 0 ? '+' + pd : String(pd);
          var rowBg = isUser ? 'background:rgba(22,163,74,.12);' : '';
          var leader = idx === 0 ? '🥇 ' : '';
          var nameStyle = isUser ? 'font-weight:700;color:var(--accent2)' : 'color:var(--text)';
          return (
            '<tr style="' +
            rowBg +
            '">' +
            '<td style="padding:5px 8px;' +
            nameStyle +
            ';font-size:12px">' +
            leader +
            t.city +
            ' ' +
            t.nickname +
            '</td>' +
            '<td style="padding:5px 8px;text-align:center;font-size:12px;color:#4ade80;font-weight:600">' +
            t.wins +
            '</td>' +
            '<td style="padding:5px 8px;text-align:center;font-size:12px;color:#f87171">' +
            t.losses +
            '</td>' +
            '<td style="padding:5px 8px;text-align:center;font-size:11px;color:var(--muted2)">' +
            (pd > 0
              ? '<span style="color:#4ade80">' + pdTxt + '</span>'
              : pd < 0
                ? '<span style="color:#f87171">' + pdTxt + '</span>'
                : pdTxt) +
            '</td>' +
            '</tr>'
          );
        })
        .join('');

      standingsHtml =
        '<div style="background:var(--surface2);border-radius:8px;overflow:hidden">' +
        '<div style="padding:7px 10px;font-size:10px;color:var(--accent2);font-weight:700;' +
        'text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border)">' +
        divName +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse">' +
        '<thead>' +
        '<tr>' +
        '<th style="padding:5px 8px;text-align:left;font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:600;border-bottom:1px solid var(--border)">Team</th>' +
        '<th style="padding:5px 8px;text-align:center;font-size:9px;color:var(--muted);letter-spacing:.8px;font-weight:600;border-bottom:1px solid var(--border)">W</th>' +
        '<th style="padding:5px 8px;text-align:center;font-size:9px;color:var(--muted);letter-spacing:.8px;font-weight:600;border-bottom:1px solid var(--border)">L</th>' +
        '<th style="padding:5px 8px;text-align:center;font-size:9px;color:var(--muted);letter-spacing:.8px;font-weight:600;border-bottom:1px solid var(--border)">PD</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        rows +
        '</tbody>' +
        '</table>' +
        '</div>';
    }

    /* ── 3. Team stat line ────────────────────────────────── */
    wk = typeof schedule !== 'undefined' && schedule ? currentWeekIndex : 0;
    var weekLabel = wk > 0 ? 'Through Week ' + wk + ' of ' + (schedule ? schedule.length : 17) : 'Pre-season';
    var capSpace = team.salaryCap - team.capUsed;
    var capColor = capSpace < 0 ? '#f87171' : '#4ade80';

    var _seasonLabel =
      '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;' +
      'letter-spacing:.8px;margin-bottom:3px">Season ' +
      (window.simYear || 1) +
      '</div>';

    var statLine =
      '<div style="display:flex;justify-content:space-between;align-items:center;' +
      'margin-bottom:10px;flex-wrap:wrap;gap:4px">' +
      '<div>' +
      _seasonLabel +
      "<div style=\"font-family:'Barlow Condensed',sans-serif;font-size:22px;" +
      'font-weight:700;color:var(--accent2)">' +
      team.wins +
      '-' +
      team.losses +
      (team.ties ? '-' + team.ties : '') +
      '</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--muted2);text-align:right">' +
      weekLabel +
      '<br>' +
      '<span style="color:' +
      capColor +
      '">$' +
      capSpace.toLocaleString() +
      ' cap space</span>' +
      '</div>' +
      '</div>';

    /* ── 4. This week's matchup (or bye week notice) ────────── */
    var matchupHtml = '';
    if (typeof schedule !== 'undefined' && schedule && currentWeekIndex < schedule.length) {
      var thisWeek = schedule[currentWeekIndex];
      var thisGame =
        thisWeek &&
        (thisWeek.games || []).find(function (g) {
          return g.homeTeamId === tid || g.awayTeamId === tid;
        });

      if (thisGame) {
        var mIsHome = thisGame.homeTeamId === tid;
        var mOppId = mIsHome ? thisGame.awayTeamId : thisGame.homeTeamId;
        var mOpp = getTeamById(mOppId) || { city: '', nickname: mOppId };
        var mLabel = mIsHome ? 'HOME' : 'AWAY';
        var mLoc = mIsHome ? 'vs' : '@';

        /* ── Unit ratings helper ───────────────────────────── */
        function unitRating(t, positions) {
          if (!t || !t.roster) return 70;
          var byPos = {};
          t.roster.forEach(function (p) {
            var pos = p.positions[0];
            if (!byPos[pos]) byPos[pos] = [];
            byPos[pos].push(p);
          });
          Object.keys(byPos).forEach(function (pos) {
            byPos[pos].sort(function (a, b) {
              var ra = a.depthChartRank != null ? a.depthChartRank : 999;
              var rb = b.depthChartRank != null ? b.depthChartRank : 999;
              return ra !== rb ? ra - rb : b.attributes.overall - a.attributes.overall;
            });
          });
          var ovrs = [],
            total = 0;
          positions.forEach(function (spec) {
            var pos = spec[0],
              n = spec[1];
            var grp = byPos[pos] || [];
            for (var i = 0; i < n; i++) {
              if (grp[i]) {
                ovrs.push(grp[i].attributes.overall);
                total++;
              }
            }
          });
          if (!ovrs.length) return 70;
          return Math.round(
            ovrs.reduce(function (s, v) {
              return s + v;
            }, 0) / ovrs.length,
          );
        }

        function coachRating(t) {
          if (!t) return 70;
          var hc = (t.coach && t.coach.leadership) || 70;
          var oc = (t.oc && t.oc.offenseRating) || 70;
          var dc = (t.dc && t.dc.defenseRating) || 70;
          return Math.round((hc + oc + dc) / 3);
        }

        var OFF_POS = [
          ['QB', 1],
          ['RB', 1],
          ['WR', 3],
          ['TE', 1],
          ['T', 2],
          ['G', 2],
          ['C', 1],
        ];
        var DEF_POS = [
          ['EDGE', 2],
          ['DT', 2],
          ['LB', 3],
          ['CB', 3],
          ['FS', 1],
          ['SS', 1],
        ];
        var ST_POS = [
          ['K', 1],
          ['P', 1],
        ];

        var myOff = unitRating(team, OFF_POS);
        var myDef = unitRating(team, DEF_POS);
        var myST = unitRating(team, ST_POS);
        var myCoach = coachRating(team);
        var myOVR = Math.round(computeTeamPowerRating(team));

        var opOff = unitRating(mOpp, OFF_POS);
        var opDef = unitRating(mOpp, DEF_POS);
        var opST = unitRating(mOpp, ST_POS);
        var opCoach = coachRating(mOpp);
        var opOVR = Math.round(computeTeamPowerRating(mOpp));

        var mFavored = myOVR >= opOVR;
        var mDiff = Math.abs(myOVR - opOVR);
        var mSpread = mFavored
          ? '<span style="color:#4ade80">Favored by ' + mDiff + '</span>'
          : mDiff === 0
            ? '<span style="color:#facc15">Pick\'em</span>'
            : '<span style="color:#f87171">Underdog by ' + mDiff + '</span>';

        /* ── Comparison row builder ────────────────────────── */
        function cmpRow(label, myVal, opVal) {
          var myWin = myVal > opVal;
          var opWin = opVal > myVal;
          var mc = myWin ? '#4ade80' : opWin ? '#f87171' : '#94a3b8';
          var oc = opWin ? '#4ade80' : myWin ? '#f87171' : '#94a3b8';
          /* Bar: total width 100%, split proportionally */
          var total = myVal + opVal || 1;
          var myPct = Math.round((myVal / total) * 100);
          var opPct = 100 - myPct;
          return (
            '<div style="margin-bottom:7px">' +
            '<div style="font-size:9px;color:var(--muted);text-transform:uppercase;' +
            'letter-spacing:.7px;text-align:center;margin-bottom:3px">' +
            label +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:5px">' +
            '<span style="font-size:12px;font-weight:700;color:' +
            mc +
            ';min-width:26px;text-align:right">' +
            myVal +
            '</span>' +
            '<div style="flex:1;height:5px;border-radius:3px;overflow:hidden;' +
            'background:var(--surface)">' +
            '<div style="display:flex;height:100%">' +
            '<div style="width:' +
            myPct +
            '%;background:' +
            mc +
            ';border-radius:3px 0 0 3px"></div>' +
            '<div style="width:' +
            opPct +
            '%;background:' +
            oc +
            ';border-radius:0 3px 3px 0"></div>' +
            '</div>' +
            '</div>' +
            '<span style="font-size:12px;font-weight:700;color:' +
            oc +
            ';min-width:26px">' +
            opVal +
            '</span>' +
            '</div>' +
            '</div>'
          );
        }

        matchupHtml =
          '<div style="background:var(--surface2);border:1px solid var(--border);' +
          'border-radius:8px;padding:10px 12px;margin-bottom:12px">' +
          /* Header row */
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
          '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Week ' +
          (currentWeekIndex + 1) +
          '</div>' +
          '<div style="font-size:10px;font-weight:700;color:var(--accent2);background:rgba(22,163,74,.15);border-radius:4px;padding:1px 7px">' +
          mLabel +
          '</div>' +
          '</div>' +
          /* Team names + overall */
          '<div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:10px">' +
          '<div style="flex:1;text-align:left">' +
          '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;color:var(--accent2);line-height:1.1">' +
          team.city +
          ' ' +
          team.nickname +
          '</div>' +
          '<div style="font-size:22px;font-weight:800;color:var(--accent2);font-family:\'Barlow Condensed\',sans-serif">' +
          myOVR +
          '</div>' +
          '</div>' +
          '<div style="font-size:11px;font-weight:700;color:var(--muted2);padding-bottom:6px">' +
          mLoc +
          '</div>' +
          '<div style="flex:1;text-align:right">' +
          '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;color:var(--text);line-height:1.1">' +
          mOpp.city +
          ' ' +
          mOpp.nickname +
          '</div>' +
          '<div style="font-size:22px;font-weight:800;color:var(--text);font-family:\'Barlow Condensed\',sans-serif">' +
          opOVR +
          '</div>' +
          '</div>' +
          '</div>' +
          /* Comparison bars */
          cmpRow('Offense', myOff, opOff) +
          cmpRow('Defense', myDef, opDef) +
          cmpRow('Special Teams', myST, opST) +
          cmpRow('Coaching', myCoach, opCoach) +
          /* Spread */
          '<div style="text-align:center;margin-top:8px;font-size:10px;font-weight:600">' +
          mSpread +
          '</div>' +
          '</div>';
      } else {
        /* Bye week */
        matchupHtml =
          '<div style="background:var(--surface2);border:1px solid var(--border);' +
          'border-radius:8px;padding:10px 12px;margin-bottom:12px;text-align:center">' +
          '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;' +
          'letter-spacing:.8px;margin-bottom:6px">Week ' +
          (currentWeekIndex + 1) +
          ' Matchup</div>' +
          '<div style="font-size:13px;font-weight:600;color:var(--muted2)">🛌 Bye Week</div>' +
          '<div style="font-size:11px;color:var(--muted);margin-top:2px">No game this week</div>' +
          '</div>';
      }
    }

    panel.innerHTML = statLine + lastGameHtml + matchupHtml + standingsHtml;
  };

  /* ── Wire up on DOM ready + after league init ──────────── */
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      populateHomeSelect();
      var tid = (document.getElementById('homeTeamSelect') || {}).value;
      if (tid) renderHomeDashboard(tid);
    }, 500);
  });

  /* Re-render dashboard when week is simulated */
  var _origRWR = window.renderWeekResults;
  window.renderWeekResults = function (week) {
    if (typeof _origRWR === 'function') _origRWR(week);
    /* Refresh home dashboard data silently (it reads from live state) */
  };

  document.addEventListener('teamChanged', function (e) {
    if (e.detail && e.detail.id) renderHomeDashboard(e.detail.id);
  });

  /* Patch renderHome to repopulate the select and refresh dashboard */
  var _origRH = window.renderHome;
  window.renderHome = function () {
    if (typeof _origRH === 'function') _origRH();
    setTimeout(function () {
      populateHomeSelect();
      var tid =
        (document.getElementById('homeTeamSelect') || {}).value || (document.getElementById('teamSelect') || {}).value;
      if (tid) renderHomeDashboard(tid);
    }, 80);
  };

  /* Also refresh after sim week completes */
  var _prevSMC = window.setMainContent;
  var _smcGuard = false;
  window.setMainContent = function (html) {
    if (typeof _prevSMC === 'function') _prevSMC(html);
    /* If home dashboard is visible, keep it current — guard against recursion */
    if (_smcGuard) return;
    var panel = document.getElementById('homeDashboard');
    if (panel && panel.innerHTML && document.getElementById('homeTeamSelect')) {
      var tid = (document.getElementById('homeTeamSelect') || {}).value;
      if (tid && typeof renderHomeDashboard === 'function') {
        _smcGuard = true;
        try {
          renderHomeDashboard(tid);
        } finally {
          _smcGuard = false;
        }
      }
    }
  };
})();
