/* ============================================================
   SEASON END ROUTES TO OFFSEASON INSTEAD OF ALERT
   ============================================================ */
(function () {
  /* Pre-sim roster validation for the user's team.
     Returns a non-empty error string if the roster isn't sim-ready, or null if OK. */
  function checkRosterBeforeSim() {
    var team;
    try {
      team = getTeamById(userTeamId);
    } catch (e) {
      return null;
    }
    if (!team || !team.roster) return null;

    var MIN_ROSTER = 37;
    var MAX_ROSTER = 55;
    var REQUIRED = ['QB', 'RB', 'WR', 'TE', 'T', 'G', 'C', 'EDGE', 'DT', 'LB', 'CB', 'FS', 'SS', 'K', 'P'];

    if (team.roster.length < MIN_ROSTER) {
      return (
        'Your roster only has ' +
        team.roster.length +
        ' players (minimum is ' +
        MIN_ROSTER +
        '). Sign free agents before simulating.'
      );
    }
    if (team.roster.length > MAX_ROSTER) {
      return (
        'Your roster has ' +
        team.roster.length +
        ' players (maximum is ' +
        MAX_ROSTER +
        '). Release players before simulating.'
      );
    }

    var missing = REQUIRED.filter(function (pos) {
      return !team.roster.some(function (p) {
        return p.positions[0] === pos;
      });
    });
    if (missing.length > 0) {
      return (
        'Missing players at required position(s): ' +
        missing.join(', ') +
        '. Fill every depth-chart slot before simulating.'
      );
    }

    return null;
  }

  function syncBtn() {
    var btn = document.getElementById('btnSimWeek');
    if (!btn) return;
    /* Update button label during playoffs */
    if (window.gmPhase === 'postseason' && window.playoffs && !window.playoffs.done) {
      var round = window.playoffs.rounds[window.playoffs.roundIdx] || 'Playoff';
      btn.textContent = '⚡ Sim ' + round;
    } else if (window.gmPhase === 'season' || !window.gmPhase) {
      btn.textContent = '⚡ Simulate Week';
    }
    var done = schedule && currentWeekIndex >= schedule.length;
    if (done) {
      btn.textContent = '🏆 Begin Offseason →';
      btn.style.cssText = 'background:var(--gold);border-color:var(--gold);color:#000;font-weight:700';
    } else {
      btn.textContent = '⚡ Simulate Week';
      btn.style.cssText = '';
    }
  }

  var _uwl = window.updateWeekLabel;
  window.updateWeekLabel = function () {
    if (typeof _uwl === 'function') _uwl();
    syncBtn();
  };

  window.addEventListener('DOMContentLoaded', function () {
    var old = document.getElementById('btnSimWeek');
    if (!old) return;
    var btn = old.cloneNode(true);
    old.parentNode.replaceChild(btn, old);

    btn.addEventListener('click', function () {
      /* Offseason steps have their own buttons (FA, draft) */
      if (window.gmPhase === 'offseason') return;

      /* ── Roster validity check (blocks sim if team isn't ready) ── */
      var rosterErr = checkRosterBeforeSim();
      if (rosterErr) {
        alert(rosterErr);
        return;
      }

      /* ── Playoff round sim ─────────────────────────── */
      if (window.gmPhase === 'postseason' && window.playoffs && !window.playoffs.done) {
        closeDrawer();
        var ps = window.playoffs,
          week = ps.currentWeek;
        if (!week) return;
        var strat = {
          offPlaybook: (document.getElementById('offPlaybook') || { value: 'West Coast' }).value,
          offensiveStyle: (document.getElementById('offStyle') || { value: 'Balanced' }).value,
          defPlaybook: (document.getElementById('defPlaybook') || { value: '4-3' }).value,
          defensiveStyle: (document.getElementById('defStyle') || { value: 'Balanced' }).value,
        };
        simulateWeek(week, teamMap, strat, userTeamId);
        window._advancePlayoffRound();
        renderWeekResults(week);
        setTimeout(function () {
          var main = document.getElementById('main');
          if (!main) return;
          var div = document.createElement('div');
          div.style.marginTop = '16px';
          if (window.playoffs && window.playoffs.done) {
            var sb = window.playoffs.sbWinner;
            var tid = typeof userTeamId !== 'undefined' ? userTeamId : null;
            var uw = tid && sb && sb.id === tid;
            div.innerHTML =
              (uw
                ? '<div style="background:rgba(250,204,21,.12);border:1px solid #facc15;border-radius:8px;padding:12px;text-align:center;margin-bottom:12px;font-weight:700;color:#facc15">🎉 ' +
                  sb.city +
                  ' ' +
                  sb.nickname +
                  ' win the Super Bowl!</div>'
                : '<div style="background:rgba(22,163,74,.08);border:1px solid var(--accent);border-radius:8px;padding:12px;text-align:center;margin-bottom:12px;color:var(--accent2)">🏆 ' +
                  (sb ? sb.city + ' ' + sb.nickname : 'Champions') +
                  ' win the Super Bowl!</div>') +
              '<button onclick="beginBlackMonday()" style="width:100%;font-weight:700;background:rgba(239,68,68,.12);border-color:#ef4444;color:#f87171">🔥 Black Monday →</button>';
          } else {
            var nr = window.playoffs ? window.playoffs.rounds[window.playoffs.roundIdx] : '';
            div.innerHTML =
              '<button onclick="renderHome()" style="width:100%;background:var(--surface2);border-color:var(--border);color:var(--muted2)">← Home · next: ' +
              nr +
              '</button>';
          }
          main.appendChild(div);
        }, 80);
        return;
      }
      /* ── Playoffs done ───────────────────────────────── */
      if (window.gmPhase === 'postseason' && window.playoffs && window.playoffs.done) {
        closeDrawer();
        beginBlackMonday();
        return;
      }

      if (schedule && currentWeekIndex >= schedule.length) {
        closeDrawer();
        if (typeof beginAwardsPhase === 'function') {
          beginAwardsPhase();
          return;
        }
        setMainContent(
          '<div class="welcome-hero"><h2 style="color:var(--gold)">🏁 Season Complete</h2><button onclick="typeof renderAwards===\'function\'&&renderAwards()" style="margin-top:10px">🏆 View Awards</button><button onclick="typeof beginFreeAgencyPhase===\'function\'&&beginFreeAgencyPhase()" style="margin-top:8px">💼 Free Agency</button></div>',
        );
        return;
      }
      strat = {
        offPlaybook: (document.getElementById('offPlaybook') || { value: 'West Coast' }).value,
        offensiveStyle: (document.getElementById('offStyle') || { value: 'Balanced' }).value,
        defPlaybook: (document.getElementById('defPlaybook') || { value: '4-3' }).value,
        defensiveStyle: (document.getElementById('defStyle') || { value: 'Balanced' }).value,
      };
      week = schedule[currentWeekIndex];
      simulateWeek(week, teamMap, strat, userTeamId);
      currentWeekIndex++;
      updateWeekLabel();
      renderWeekResults(week);
      closeDrawer();
    });

    setTimeout(syncBtn, 150);
  });
})();
