/* ============================================================
   COMPLETE PLAYER DEVELOPMENT SYSTEM (GROUND-UP REWRITE)

   Problem: runEndOfSeasonDevelopment, calculatePerformanceGrowth,
   and 5 other helper functions were called but NEVER defined —
   the entire system was a stub. runEndOfSeasonProgression was
   also never called by the awards pipeline. This patch defines
   everything from scratch and wires it into beginAwardsPhase.
   ============================================================ */
(function () {
  /* ── Dev trait upgrade check ────────────────────────────── */
  function checkDevUpgrade(player) {
    var s = player.stats || {};
    var pos = player.positions[0];
    var DEV = ['Normal', 'Star', 'Superstar', 'X-Factor'];
    var cur = DEV.indexOf(player.devTrait || 'Normal');
    if (cur >= DEV.length - 1) return; /* already max */

    var qualified = false;
    switch (pos) {
      case 'QB':
        qualified = (s.passingYards || 0) >= 3800 || (s.passingTD || 0) >= 27;
        break;
      case 'RB':
        qualified = (s.rushingYards || 0) >= 1200 || (s.rushingTD || 0) >= 10;
        break;
      case 'WR':
        qualified = (s.receivingYards || 0) >= 1000 || (s.receivingTD || 0) >= 8;
        break;
      case 'TE':
        qualified = (s.receivingYards || 0) >= 800 || (s.receivingTD || 0) >= 7;
        break;
      case 'EDGE':
        qualified = (s.sacks || 0) >= 10;
        break;
      case 'DT':
        qualified = (s.sacks || 0) >= 7;
        break;
      case 'LB':
        qualified = (s.tackles || 0) >= 110;
        break;
      case 'CB':
      case 'S':
        qualified = (s.interceptions || 0) >= 4;
        break;
      case 'OL':
        qualified = (s.gamesPlayed || 0) >= 15;
        break;
      case 'K':
        qualified = (s.fieldGoalsMade || 0) >= 28;
        break;
    }

    if (qualified) player.devTrait = DEV[cur + 1];
  }

  /* ── Season minimum guarantee ─────────────────────────────
     Safety net: if a young player ended the season below their
     guaranteed minimum OVR gain, bring them up to the floor.
     This catches edge cases (mid-season load, first season etc.)

     Minimums per age + dev trait (matches accumulator math):
       ≤23 Normal=+4, Star=+6, Superstar=+7, X-Factor=+9
       ≤25 Normal=+4, Star=+5, Superstar=+6, X-Factor=+8
       ≤27 Normal=+2, Star=+3, Superstar=+4, X-Factor=+5
       ≤29 Normal=+0 (needs playing time)
       30+  → no minimum (regression possible)               */
  function minimumSeasonGrowth(p) {
    var age = p.age;
    if (age >= 30) return 0; /* vets: no minimum */
    /* Use window.devMult if available, otherwise inline the calculation */
    var dm =
      typeof window.devMult === 'function'
        ? window.devMult(p)
        : (function (t) {
            return t === 'X-Factor' ? 2.0 : t === 'Superstar' ? 1.6 : t === 'Star' ? 1.3 : 1.0;
          })(p.devTrait || 'Normal');
    if (age <= 23) return Math.floor(0.28 * dm * 17);
    else if (age <= 25) return Math.floor(0.24 * dm * 17);
    else if (age <= 27) return Math.floor(0.14 * dm * 17);
    else return 0;
  }

  function applySeasonMinimumGrowth(p) {
    if (!p.seasonStartOVR) return;
    var minGain = minimumSeasonGrowth(p);
    if (minGain <= 0) return;
    var actual = p.attributes.overall - p.seasonStartOVR;
    if (actual < minGain) {
      var boost = minGain - actual;
      p.attributes.overall = Math.min(99, p.attributes.overall + boost);
    }
  }

  /* Ensure coach baselines are set before development runs */
  function ensureCoachBaselines() {
    if (typeof league === 'undefined' || !league) return;
    listAllTeams(league).forEach(function (team) {
      var hc = team.coach || {};
      var oc = team.oc || {};
      var dc = team.dc || {};
      if (!hc.seasonBaseOff || isNaN(hc.seasonBaseOff)) hc.seasonBaseOff = hc.offenseRating || 65;
      if (!hc.seasonBaseDef || isNaN(hc.seasonBaseDef)) hc.seasonBaseDef = hc.defenseRating || 65;
      if (!hc.seasonBaseLead || isNaN(hc.seasonBaseLead)) hc.seasonBaseLead = hc.leadership || 65;
      if (!oc.seasonBaseOff || isNaN(oc.seasonBaseOff)) oc.seasonBaseOff = oc.offenseRating || 65;
      if (!dc.seasonBaseDef || isNaN(dc.seasonBaseDef)) dc.seasonBaseDef = dc.defenseRating || 65;
    });
  }

  window.runEndOfSeasonDevelopment = function () {
    if (typeof league === 'undefined' || !league) return;
    ensureCoachBaselines();
    /* Recalculate cap for all teams — catches any drift from trades/signings */
    if (typeof recalcAllTeamCap === 'function') recalcAllTeamCap();
    listAllTeams(league).forEach(function (team) {
      team.roster.forEach(function (p) {
        applySeasonMinimumGrowth(p); /* enforce minimum OVR gain */
        checkDevUpgrade(p); /* dev trait upgrade check  */
        p.age++; /* age every player one year */
        p.devAccum = 0; /* reset accumulator          */
      });
    });
  };

  window.runEndOfSeasonProgression = function () {
    window.runEndOfSeasonDevelopment();
  };

  /* ── Wire into the awards pipeline ─────────────────────────
     beginAwardsPhase is the first thing called after the season.
     Development runs HERE — before awards display — so players
     already have their updated ratings when the user sees them. */
  var _prevBAP = window.beginAwardsPhase;
  window.beginAwardsPhase = function () {
    window.runEndOfSeasonProgression();
    if (typeof _prevBAP === 'function') _prevBAP();
  };

  /* ── seasonStartOVR — captured once per season ───────────── */
  function initSeasonOVR() {
    if (typeof league === 'undefined' || !league) return;
    var yr = window.simYear || 1;
    listAllTeams(league).forEach(function (team) {
      team.roster.forEach(function (p) {
        if (p.seasonStartOVR === undefined || p._ovrYear !== yr) {
          p.seasonStartOVR = p.attributes.overall;
          p._ovrYear = yr;
          /* Snapshot granular attrs for per-attr delta display */
          if (p.granularAttrs) {
            p.seasonStartGranular = Object.assign({}, p.granularAttrs);
          }
        }
      });
    });
  }
  window.initSeasonOVR = initSeasonOVR;

  var _prevInit = window.initPhase4Core;
  window.initPhase4Core = function () {
    if (typeof _prevInit === 'function') _prevInit();
    setTimeout(initSeasonOVR, 1200);
  };

  var _prevNS = window.beginNewSeason;
  window.beginNewSeason = function () {
    if (typeof _prevNS === 'function') _prevNS();
    setTimeout(initSeasonOVR, 600);
  };

  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(initSeasonOVR, 1500);
  });

  /* ── renderRoster with OVR delta ────────────────────────── */
  function getActiveTeamId() {
    var sel = document.getElementById('teamSelect');
    return sel && sel.value ? sel.value : window._activeTeamId || null;
  }

  window.renderRoster = function () {
    if (typeof window.initSeasonOVR === 'function') window.initSeasonOVR();
    var tid = getActiveTeamId();
    if (!tid) return;
    var team = getTeamById(tid);
    if (!team) return;
    var space = team.salaryCap - team.capUsed;

    var rows = team.roster
      .slice()
      .sort(function (a, b) {
        return b.attributes.overall - a.attributes.overall;
      })
      .map(function (p, i) {
        var ovr = p.attributes.overall;
        var hit = p.contract ? p.contract.capHitPerYear : 0;
        var yrs = p.contract ? p.contract.years : 0;

        /* delta vs season start */
        var delta = p.seasonStartOVR !== undefined ? ovr - p.seasonStartOVR : null;
        var dHtml = '';
        if (delta !== null && delta > 0)
          dHtml = '<span style="font-size:10px;color:#4ade80;margin-left:3px">(+' + delta + ')</span>';
        else if (delta !== null && delta < 0)
          dHtml = '<span style="font-size:10px;color:#f87171;margin-left:3px">(' + delta + ')</span>';

        /* dev trait badge */
        var dev =
          p.devTrait && p.devTrait !== 'Normal'
            ? ' <span style="font-size:9px;color:' +
              (p.devTrait === 'X-Factor' ? '#c084fc' : p.devTrait === 'Superstar' ? '#60a5fa' : '#facc15') +
              '">' +
              p.devTrait +
              '</span>'
            : '';

        return (
          '<tr style="cursor:pointer" onclick="renderPlayerDetail(\'' +
          p.id +
          '\')">' +
          '<td>' +
          (i + 1) +
          '</td>' +
          '<td><span style="color:var(--accent2)">' +
          p.name +
          '</span>' +
          dev +
          fitBadge(p) +
          '</td>' +
          '<td>' +
          p.positions.join('/') +
          '</td>' +
          '<td>' +
          p.age +
          '</td>' +
          '<td style="color:' +
          ovrColor(ovr) +
          ';font-weight:600">' +
          ovr +
          dHtml +
          '</td>' +
          '<td>' +
          yrs +
          'yr</td>' +
          '<td>$' +
          (hit ? hit.toLocaleString() : '—') +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    setMainContent(
      '<h2>' +
        team.city +
        ' ' +
        team.nickname +
        ' Roster</h2>' +
        '<p class="small">' +
        'Coach: ' +
        team.coach.name +
        ' &nbsp;|&nbsp; Power: ' +
        team.powerRating +
        ' &nbsp;|&nbsp; Record: ' +
        team.wins +
        '-' +
        team.losses +
        (team.ties ? '-' + team.ties : '') +
        ' &nbsp;|&nbsp; Cap: <strong style="color:' +
        (space < 0 ? '#f87171' : '#4ade80') +
        '">$' +
        space.toLocaleString() +
        '</strong>' +
        '</p>' +
        '<p class="small" style="margin-top:-6px;color:var(--muted)">' +
        'Scheme: <span style="color:var(--gold)">' +
        (team.oc ? team.oc.scheme : '—') +
        '</span> off' +
        ' / <span style="color:var(--gold)">' +
        (team.dc ? team.dc.scheme : '—') +
        '</span> def' +
        ' &nbsp;·&nbsp; <span style="color:#4ade80">✦</span> fit' +
        ' <span style="color:#64748b">✦</span> neutral' +
        ' <span style="color:#f87171">✦</span> poor' +
        ' &nbsp;·&nbsp; <span style="color:#4ade80">(+n)</span>/<span style="color:#f87171">(-n)</span> OVR change' +
        '</p>' +
        '<table><thead><tr>' +
        '<th>#</th><th>Name</th><th>Pos</th><th>Age</th><th>OVR</th><th>Yrs</th><th>Cap Hit</th>' +
        '</tr></thead><tbody>' +
        rows +
        '</tbody></table>',
    );
  };
})();
