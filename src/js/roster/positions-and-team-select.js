/* ============================================================
   POSITION / ROSTER TEMPLATE / DEPTH CHART / TEAM SELECT
   ============================================================ */
(function () {
  /* ── Position compatibility: no nonsense dual roles ───── */
  var SECONDARY_POS_MAP = {
    QB: [],
    RB: ['WR'],
    WR: ['RB'],
    TE: ['WR', 'T'],
    T: ['G'],
    G: ['T', 'C'],
    C: ['G'],
    EDGE: ['DT', 'LB'],
    DT: ['EDGE'],
    LB: ['EDGE', 'SS'],
    CB: ['FS'],
    FS: ['CB', 'SS'],
    SS: ['FS', 'LB'],
    K: [],
    P: [],
  };

  window.generatePositionsForPlayer = function (primaryPos) {
    if (!primaryPos) {
      var FB = [
        'QB',
        'RB',
        'RB',
        'WR',
        'WR',
        'WR',
        'TE',
        'TE',
        'OL',
        'OL',
        'OL',
        'OL',
        'EDGE',
        'EDGE',
        'DT',
        'DT',
        'LB',
        'LB',
        'LB',
        'CB',
        'CB',
        'CB',
        'S',
        'S',
      ];
      primaryPos = FB[randomInt(0, FB.length - 1)];
    }
    var opts = SECONDARY_POS_MAP[primaryPos] || [];
    if (opts.length && Math.random() < 0.12) return [primaryPos, opts[Math.floor(Math.random() * opts.length)]];
    return [primaryPos];
  };

  /* ── 55-man roster template: exactly 1 K, 1 P ──────────
     3+5+7+3+9+4+5+6+7+4+1+1 = 55                          */
  var ROSTER_TEMPLATE = [
    { pos: 'QB', count: 3 },
    { pos: 'RB', count: 5 },
    { pos: 'WR', count: 7 },
    { pos: 'TE', count: 3 },
    { pos: 'T', count: 4 } /* Tackles: LT, RT + 2 depth */,
    { pos: 'G', count: 3 } /* Guards: LG, RG + 1 depth  */,
    { pos: 'C', count: 2 } /* Center + 1 backup          */,
    { pos: 'EDGE', count: 4 },
    { pos: 'DT', count: 5 },
    { pos: 'LB', count: 6 },
    { pos: 'CB', count: 7 },
    { pos: 'FS', count: 2 } /* Free Safety + backup       */,
    { pos: 'SS', count: 2 } /* Strong Safety + backup     */,
    { pos: 'K', count: 1 },
    { pos: 'P', count: 1 },
  ]; /* Total: 3+5+7+3+4+3+2+4+5+6+7+2+2+1+1 = 55 */

  var _origBL = window.buildLeague;
  window.buildLeague = function () {
    var lg = _origBL();
    listAllTeams(lg).forEach(function (team) {
      team.roster = [];
      team.capUsed = 0;
      ROSTER_TEMPLATE.forEach(function (slot) {
        for (var i = 0; i < slot.count; i++) {
          var p = generatePlayer(slot.pos); /* pass pos for attribute gen */
          p.positions = generatePositionsForPlayer(slot.pos);
          team.roster.push(p);
          if (p.contract) team.capUsed += p.contract.capHitPerYear;
        }
      });
      team.powerRating = computeTeamPowerRating(team);
    });
    return lg;
  };

  /* ── Depth chart with LT/LG/C/RG/RT, WILL/MIKE/SAM ───── */
  var OL_L = ['LT', 'LG', 'C', 'RG', 'RT'],
    LB_L = ['WILL', 'MIKE', 'SAM'],
    ED_L = ['LE', 'RE'],
    S_L = ['SS', 'FS'];

  /* ── Fix teamSelect: update the actual let variable ────── */
  window.addEventListener('DOMContentLoaded', function () {
    var sel = document.getElementById('teamSelect');
    if (!sel) return;
    sel.addEventListener('change', function () {
      /* Assign to the global let userTeamId directly */
      try {
        userTeamId = this.value;
      } catch (e) {}
      window._activeTeamId = this.value;
      var team = getTeamById(this.value);
      var h1 = document.querySelector('.header-brand h1');
      var sub = document.querySelector('.header-brand .sub');
      if (h1 && team) h1.textContent = '⚡ ' + team.city + ' ' + team.nickname;
      if (sub && team) sub.textContent = team.conference + ' · ' + team.division;
    });
  });

  if (typeof window.draftTrades === 'undefined') window.draftTrades = {};
})();
