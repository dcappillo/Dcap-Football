/* ============================================================
   IN-SEASON FREE AGENT SIGNING
   Removes the season-phase block so the user can sign free
   agents at any time during the regular season.

   What changes:
   • renderFreeAgencyScreen — always shows full offer buttons;
     banner text differs between in-season and offseason so
     the user knows what's happening
   • submitContractOffer / renderNegotiationScreen — unblocked
     in-season (cpuOffersForPlayer already returns [] during
     the season, so the user's offer is automatically the best;
     the player just evaluates salary vs market value)

   What stays gated to offseason:
   • simulateFullFreeAgency — CPU wave signing (only relevant
     after the season when new FAs flood the market)
   • cpuOffersForPlayer — returns [] during season (user faces
     no competition for in-season pool pickups)
   ============================================================ */
(function () {
  /* ── Helpers ──────────────────────────────────────────────── */

  function weeksRemaining() {
    if (typeof schedule === 'undefined' || !schedule) return null;
    return Math.max(0, schedule.length - (currentWeekIndex || 0));
  }

  /* ── In-season banner ─────────────────────────────────────── */

  function inSeasonBanner() {
    var wk = weeksRemaining();
    var wkStr =
      wk !== null ? (wk > 0 ? wk + ' week' + (wk !== 1 ? 's' : '') + ' left in the season.' : 'Season complete.') : '';
    return (
      '<div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.4);' +
      'border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:flex-start;gap:12px">' +
      '<span style="font-size:20px;line-height:1.4">🏈</span>' +
      '<div style="flex:1">' +
      '<div style="font-weight:600;color:#4ade80;font-size:13px">Mid-Season Free Agency</div>' +
      '<div style="font-size:11px;color:var(--muted2);margin-top:3px;line-height:1.5">' +
      'Sign available free agents now — no CPU teams are competing for mid-season pickups. ' +
      "Cap space and the player's market value still apply. " +
      (wkStr ? '<br>' + wkStr + ' New free agents (expiring contracts) join the pool at season end.' : '') +
      '</div>' +
      '<button onclick="window.renderQuickRoster()" ' +
      'style="margin-top:10px;width:auto;padding:5px 12px;font-size:11px;' +
      'background:rgba(59,130,246,.15);border-color:#3b82f6;color:#60a5fa">' +
      '👥 My Roster</button>' +
      '</div>' +
      '</div>'
    );
  }

  /* ── Offseason banner ─────────────────────────────────────── */

  function offseasonBanner() {
    return (
      '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.4);' +
      'border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:flex-start;gap:12px">' +
      '<span style="font-size:20px;line-height:1.4">🏆</span>' +
      '<div>' +
      '<div style="font-weight:600;color:#fbbf24;font-size:13px">Offseason Free Agency</div>' +
      '<div style="font-size:11px;color:var(--muted2);margin-top:3px;line-height:1.5">' +
      'All 32 teams are competing for free agents. CPU teams will also submit offers — ' +
      'pay above market value or sweeten the deal to win the bidding.' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
      '<button onclick="beginDraftPhase()" style="background:var(--accent-dim);' +
      'border-color:var(--accent);color:var(--accent2);font-weight:600;width:auto;padding:6px 14px;font-size:12px">' +
      '🎯 Close Free Agency &amp; Begin Draft →</button>' +
      '<button onclick="window.renderQuickRoster()" ' +
      'style="width:auto;padding:6px 14px;font-size:12px;' +
      'background:rgba(59,130,246,.15);border-color:#3b82f6;color:#60a5fa">' +
      '👥 My Roster</button>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  /* ── Rebuild renderFreeAgencyScreen — always allows signing ─ */

  window.renderFreeAgencyScreen = function () {
    if (typeof freeAgents === 'undefined') return;
    if (!freeAgents.length && typeof generateFreeAgentPool === 'function') {
      generateFreeAgentPool();
    }

    var isOffseason = window.gmPhase === 'offseason';
    var pool = freeAgents.slice().sort(function (a, b) {
      return b.attributes.overall - a.attributes.overall;
    });

    var rows = pool
      .map(function (p) {
        var mv = typeof calculateMarketValue === 'function' ? calculateMarketValue(p) : { capHitPerYear: 0, years: 1 };
        var ovr = p.attributes ? p.attributes.overall : 70;
        var dev =
          p.devTrait && p.devTrait !== 'Normal'
            ? ' <span style="font-size:9px;color:#facc15">' + p.devTrait + '</span>'
            : '';
        var age = p.age || '—';
        var capHit = mv.capHitPerYear ? '$' + mv.capHitPerYear.toLocaleString() + '/yr' : '—';

        /* Offer button — always active now */
        var offerBtn =
          '<button onclick="renderNegotiationScreen(\'' +
          p.id +
          '\')" ' +
          'style="font-size:11px;padding:4px 10px;background:rgba(34,197,94,.15);' +
          'border-color:var(--accent);color:var(--accent2)">Sign</button>';

        return (
          '<tr>' +
          '<td>' +
          p.name +
          dev +
          '</td>' +
          '<td>' +
          p.positions[0] +
          '</td>' +
          '<td>' +
          age +
          '</td>' +
          '<td style="color:' +
          ovrColor(ovr) +
          ';font-weight:600">' +
          ovr +
          '</td>' +
          '<td>' +
          capHit +
          '</td>' +
          '<td>' +
          offerBtn +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    var emptyMsg = '<p style="color:var(--muted2);font-size:13px">No free agents currently available.</p>';

    setMainContent(
      '<h2>Free Agents</h2>' +
        (isOffseason ? offseasonBanner() : inSeasonBanner()) +
        (pool.length
          ? '<table><thead><tr>' +
            '<th>Name</th><th>Pos</th><th>Age</th><th>OVR</th><th>Est. Value</th><th>Sign</th>' +
            '</tr></thead><tbody>' +
            rows +
            '</tbody></table>'
          : emptyMsg),
    );
  };

  /* ── Unblock submitContractOffer in-season ────────────────── */

  var _origSCO = window.submitContractOffer;
  window.submitContractOffer = function (playerId) {
    /* Always defer to the real function — cpuOffersForPlayer
       already returns [] in-season, so the user's offer wins
       automatically and the player just evaluates salary.      */
    if (typeof _origSCO === 'function') _origSCO(playerId);
  };

  /* ── Unblock renderNegotiationScreen in-season ────────────── */

  window.renderNegotiationScreen = function (playerId) {
    /* Find player in FA pool */
    var p = null;
    if (typeof freeAgents !== 'undefined') {
      freeAgents.forEach(function (x) {
        if (String(x.id) === String(playerId)) p = x;
      });
    }
    if (!p) {
      renderFreeAgencyScreen();
      return;
    }

    var mv = typeof calculateMarketValue === 'function' ? calculateMarketValue(p) : { capHitPerYear: 500000, years: 2 };

    var isOffseason = window.gmPhase === 'offseason';
    var competitionNote = isOffseason
      ? '<div style="font-size:11px;color:#fbbf24;margin-bottom:10px">⚠️ CPU teams are also interested — offer above market value to win.</div>'
      : '<div style="font-size:11px;color:#4ade80;margin-bottom:10px">✅ No competing offers mid-season — player evaluates your offer alone.</div>';

    /* Set negotiation state for round-2 logic */
    if (typeof negotiationState !== 'undefined') {
      negotiationState.player = p;
      negotiationState.round = 1;
    } else {
      window.negotiationState = { player: p, round: 1 };
    }

    setMainContent(
      '<h2>Offer Contract — ' +
        p.name +
        '</h2>' +
        '<p class="small" style="margin-bottom:4px">Position: <strong>' +
        p.positions[0] +
        '</strong>' +
        ' · Age: <strong>' +
        (p.age || '—') +
        '</strong>' +
        ' · OVR: <strong style="color:' +
        ovrColor(p.attributes.overall) +
        '">' +
        p.attributes.overall +
        '</strong></p>' +
        '<p class="small" style="margin-bottom:12px">Market value: <strong>$' +
        mv.capHitPerYear.toLocaleString() +
        '/yr</strong></p>' +
        competitionNote +
        '<label style="display:block;margin-bottom:4px">Years:</label>' +
        '<select id="negYears" style="margin-bottom:12px;width:100%;max-width:240px">' +
        '<option value="1">1 year</option>' +
        '<option value="2" selected>2 years</option>' +
        '<option value="3">3 years</option>' +
        '<option value="4">4 years</option>' +
        '</select>' +
        '<label style="display:block;margin-bottom:4px">Salary per year ($):</label>' +
        '<input id="negSalary" type="number" value="' +
        mv.capHitPerYear +
        '" ' +
        'style="margin-bottom:14px;width:100%;max-width:240px" />' +
        '<div style="display:flex;gap:8px;margin-top:4px">' +
        '<button onclick="submitNegotiationOffer()" ' +
        'style="flex:1;max-width:180px;background:rgba(34,197,94,.15);border-color:var(--accent);color:var(--accent2);font-weight:600">' +
        'Submit Offer' +
        '</button>' +
        '<button onclick="renderFreeAgencyScreen()" style="flex:1;max-width:180px">Cancel</button>' +
        '</div>',
    );
  };

  /* ── Wire the sidebar button (always open FA screen) ─────── */

  window.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('btnFreeAgency');
    if (btn) {
      /* Replace any prior listeners by cloning */
      var fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', function () {
        closeDrawer && closeDrawer();
        renderFreeAgencyScreen();
      });
    }
  });
})();
