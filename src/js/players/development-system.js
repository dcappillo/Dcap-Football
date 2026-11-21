/* ============================================================
   END-OF-SEASON DEVELOPMENT
   Dev-trait upgrades from season stats, aging and age decline,
   and Potential re-rolls for upgraded players. Runs once per
   season from beginAwardsPhase. Also: season-start OVR snapshots
   and the roster screen with OVR deltas.
   ============================================================ */
(function () {
  /* ── Dev trait upgrade check ────────────────────────────── */
  function checkDevUpgrade(player, team) {
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
      case 'FS':
      case 'SS':
        qualified = (s.interceptions || 0) >= 4;
        break;
      case 'T':
      case 'G':
      case 'C':
        /* Linemen have no counting stats: an 80+ OVR full-season starter on a winning team */
        qualified = (s.gamesPlayed || 0) >= 15 && player.attributes.overall >= 80 && !!team && team.wins > team.losses;
        break;
      case 'K':
        qualified = (s.fieldGoalsMade || 0) >= 28;
        break;
    }

    if (!qualified || (player.age || 0) > DEV_UPGRADE_MAX_AGE) return false;
    var next = DEV[cur + 1];
    if (Math.random() >= DEV_UPGRADE_CHANCE[next]) return false;
    player.devTrait = next;
    return true;
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
        ensurePotential(p);
        var upgraded = checkDevUpgrade(p, team);
        p.age++;
        applyAgeDecline(p);
        /* A new dev trait re-rolls Potential from the new trait, overall and age */
        if (upgraded) rerollPotentialForUpgrade(p);
        p.devAccum = 0;
      });
    });
  };

  window.runEndOfSeasonProgression = function () {
    window.runEndOfSeasonDevelopment();
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
          '<td style="color:' +
          ovrColor(ensurePotential(p)) +
          '">' +
          p.potential +
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
        '<th>#</th><th>Name</th><th>Pos</th><th>Age</th><th>OVR</th><th title="Potential: highest overall he can reach">POT</th><th>Yrs</th><th>Cap Hit</th>' +
        '</tr></thead><tbody>' +
        rows +
        '</tbody></table>',
    );
  };
})();
