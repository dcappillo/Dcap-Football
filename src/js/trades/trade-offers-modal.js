/* ============================================================
   TRADE PICK MODAL — offer-card version
   Mirrors renderTradeOffers: CPU teams auto-generate packages
   of players + picks in exchange for the user's current pick.
   After accepting, closes the modal and sims to next user pick.
   ============================================================ */
window.renderTradePickModal = function () {
  var pl = window._draftPickList;
  var absIdx = window._draftAbsIndex || 0;
  var myPick = pl && pl[absIdx];

  if (!myPick || String(myPick.curOwner) !== String(userTeamId)) {
    return;
  }

  var tv =
    window.tradeValueOf ||
    function (p) {
      return p.attributes ? p.attributes.overall * 50 : 0;
    };
  var pvById =
    window.pickValueById ||
    function () {
      return 200;
    };
  var myVal = pvById(myPick.pickId);
  var myLabel = 'Round ' + myPick.round + ', Pick ' + myPick.slot;
  var myTeam = getTeamById(userTeamId);

  /* ── Build offers from every CPU team ── */
  function picksForTeam(cpu) {
    var out = [];
    Object.keys(window.pickRegistry || {}).forEach(function (tid) {
      (window.pickRegistry[tid] || []).forEach(function (pk) {
        if (pk.curOwner === cpu.id) out.push(pk);
      });
    });
    return out.sort(function (a, b) {
      return pvById(b.pickId) - pvById(a.pickId);
    });
  }
  function picksVal(ids) {
    return ids.reduce(function (s, id) {
      return s + pvById(id);
    }, 0);
  }
  function greedyPlayers(pool, target, maxPl) {
    if (target <= 0) return [];
    var out = [],
      rem = target;
    pool
      .slice()
      .sort(function (a, b) {
        return tv(b) - tv(a);
      })
      .forEach(function (p) {
        if (out.length >= maxPl) return;
        var v = tv(p);
        if (v > target * 1.3) return;
        if (v <= rem * 1.25) {
          out.push(p);
          rem -= v;
        }
      });
    return out;
  }
  function greedyPicks(picks, target, max) {
    var out = [],
      rem = target;
    picks.forEach(function (pk) {
      if (out.length >= max) return;
      var v = pvById(pk.pickId);
      if (v <= rem * 1.3) {
        out.push(pk.pickId);
        rem -= v;
      }
    });
    return out;
  }
  function makeOffer(cpu, players, picks, interest, need) {
    var val =
      players.reduce(function (s, p) {
        return s + tv(p);
      }, 0) + picksVal(picks);
    if (val <= 0) return null;
    var max = Math.max(myVal * 2.0, myVal + 1000);
    if (val > max || val < myVal * 0.35) return null;
    return {
      team: cpu,
      players: players.slice(),
      picks: picks.slice(),
      value: val,
      gap: (myVal - val) / Math.max(myVal, 1),
      interest: interest,
      need: need,
    };
  }

  var offers = [];
  listAllTeams(league).forEach(function (cpu) {
    if (String(cpu.id) === String(userTeamId)) return;

    /* General need: fraction of roster spots that are thin */
    var need = 0.5;
    if (typeof getTeamNeedAtPosition === 'function') {
      var positions = ['QB', 'RB', 'WR', 'TE', 'T', 'G', 'C', 'EDGE', 'DT', 'LB', 'CB', 'FS', 'SS'];
      var totalNeed = positions.reduce(function (s, pos) {
        return s + getTeamNeedAtPosition(cpu, pos);
      }, 0);
      need = Math.min(1, (totalNeed / positions.length) * 2);
    }

    var interest = need * 0.55 + Math.random() * 0.55;
    if (interest < 0.32) return;

    var stretch = Math.min(1.25, 1.0 + (need > 0.6 ? (need - 0.6) * 0.6 : 0));
    var budget = Math.round(myVal * (0.7 + interest * 0.42) * stretch);

    var allSorted = (cpu.roster || [])
      .filter(function (p) {
        return p.contract && p.attributes && p.attributes.overall >= 60;
      })
      .sort(function (a, b) {
        return tv(b) - tv(a);
      });
    var reserve = need >= 0.85 ? 1 : 2;
    var tradeable = allSorted.slice(reserve);
    if (!tradeable.length && allSorted.length) tradeable = allSorted.slice(1);
    var cpuPicks = picksForTeam(cpu);

    /* Template A: players only */
    (function () {
      var p = greedyPlayers(tradeable, budget, 4);
      if (p.length) offers.push(makeOffer(cpu, p, [], interest, need));
    })();
    /* Template B: players + 1 pick */
    (function () {
      if (!cpuPicks.length) return;
      var pk1 = cpuPicks[0],
        pkV = pvById(pk1.pickId);
      var p = greedyPlayers(tradeable, budget - pkV, 3);
      if (p.length) offers.push(makeOffer(cpu, p, [pk1.pickId], interest, need));
    })();
    /* Template C: picks only */
    (function () {
      if (!cpuPicks.length) return;
      var pks = greedyPicks(cpuPicks, budget, 4);
      if (pks.length) offers.push(makeOffer(cpu, [], pks, interest, need));
    })();
    /* Template D: picks + 1 player */
    (function () {
      if (!cpuPicks.length || !tradeable.length) return;
      var topPks = cpuPicks.slice(0, 2).map(function (pk) {
        return pk.pickId;
      });
      var pkV = picksVal(topPks);
      var p = greedyPlayers(tradeable, budget - pkV, 2);
      if (p.length) offers.push(makeOffer(cpu, p, topPks, interest, need));
    })();
  });

  /* Deduplicate */
  var seen = {};
  offers = offers.filter(function (o) {
    var key =
      o.team.id +
      '|' +
      o.players
        .map(function (p) {
          return p.id;
        })
        .sort()
        .join(',') +
      '|' +
      o.picks.slice().sort().join(',');
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
  offers.sort(function (a, b) {
    return a.gap - b.gap;
  });
  offers = offers.slice(0, 24);

  /* ── Accept handler ── */
  window._acceptPickOffer = function (idx) {
    var o = offers[idx];
    if (!o) return;

    /* Transfer user's pick to CPU */
    window.transferPick(myPick.pickId, userTeamId, o.team.id);
    var pickList = window._draftPickList || [];
    var curIdx = window._draftAbsIndex || 0;
    if (pickList[curIdx]) pickList[curIdx].curOwner = o.team.id;

    /* Transfer CPU players to user */
    o.players.forEach(function (p) {
      o.team.roster = o.team.roster.filter(function (x) {
        return String(x.id) !== String(p.id);
      });
      if (p.contract) o.team.capUsed -= p.contract.capHitPerYear;
      myTeam.roster.push(p);
      if (p.contract) myTeam.capUsed += p.contract.capHitPerYear;
    });
    /* Transfer CPU picks to user */
    o.picks.forEach(function (id) {
      window.transferPick(id, o.team.id, userTeamId);
      pickList.forEach(function (pk) {
        if (pk.pickId === id) pk.curOwner = userTeamId;
      });
    });

    if (typeof logTradeTransaction === 'function')
      logTradeTransaction(myTeam, [], [myPick.pickId], o.team, o.players, o.picks);

    /* Close modal */
    var m = document.getElementById('_tradePickModal');
    if (m) m.remove();

    /* Decrement so advanceDraft re-processes the current slot (now CPU-owned) */
    window._draftAbsIndex = Math.max((window._draftAbsIndex || 1) - 1, 0);
    if (typeof window.advanceDraft === 'function') window.advanceDraft();
  };

  /* ── UI helpers ── */
  function interestLabel(i) {
    if (i >= 0.8) return { txt: '&#x1F525; Very Interested', c: '#f87171' };
    if (i >= 0.58) return { txt: '&#x2B50; Interested', c: '#facc15' };
    return { txt: '&#x1F4CB; Making an Offer', c: '#94a3b8' };
  }

  function offerCard(o, idx) {
    var good = o.gap < 0,
      fair = o.gap <= 0.12;
    var vc = good ? '#4ade80' : fair ? '#facc15' : '#f87171';
    var vl = good ? '&#x1F7E2; Above Market' : fair ? '&#x1F7E1; Fair Value' : '&#x1F534; Below Market';
    var pct = Math.abs(Math.round(o.gap * 100));
    var il = interestLabel(o.interest);

    var plRows = o.players
      .map(function (p) {
        return (
          '<div style="display:flex;align-items:center;gap:7px;padding:5px 0;' +
          'border-bottom:1px solid rgba(30,45,71,.3)">' +
          '<span style="font-size:11px;font-weight:700;color:var(--accent2);min-width:34px">' +
          p.positions[0] +
          '</span>' +
          '<div style="flex:1"><div style="font-size:12px;font-weight:500">' +
          p.name +
          '</div>' +
          '<div style="font-size:10px;color:var(--muted2)">Age ' +
          p.age +
          '</div></div>' +
          '<span style="font-size:13px;font-weight:700;color:' +
          ovrColor(p.attributes.overall) +
          '">' +
          p.attributes.overall +
          '</span>' +
          '<span style="font-size:10px;color:var(--muted2);min-width:50px;text-align:right">' +
          tv(p).toLocaleString() +
          ' pts</span>' +
          '</div>'
        );
      })
      .join('');

    var pkRows = o.picks
      .map(function (id) {
        var m2 = id.match(/_R(\d+)_Y(\d+)/);
        var origT = id.split('_R')[0];
        var via =
          origT && origT !== o.team.id
            ? ' <span style="color:var(--gold);font-size:9px">via ' +
              ((getTeamById(origT) || {}).nickname || '?') +
              '</span>'
            : '';
        return (
          '<div style="display:flex;align-items:center;gap:7px;padding:5px 0;' +
          'border-bottom:1px solid rgba(30,45,71,.3)">' +
          '<span style="font-size:10px;font-weight:700;color:#facc15;min-width:34px">PICK</span>' +
          '<div style="flex:1;font-size:12px">' +
          (m2 ? 'Season ' + m2[2] + ' &middot; Rd ' + m2[1] : id) +
          via +
          '</div>' +
          '<span style="font-size:10px;color:var(--muted2);min-width:50px;text-align:right">' +
          pvById(id).toLocaleString() +
          ' pts</span>' +
          '</div>'
        );
      })
      .join('');

    return (
      '<div style="background:var(--surface);border:1px solid ' +
      (good ? 'var(--accent)' : 'var(--border)') +
      ';border-radius:10px;' +
      'padding:14px;margin-bottom:10px' +
      (good ? ';box-shadow:0 0 0 1px rgba(22,163,74,.15)' : '') +
      '">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">' +
      '<div>' +
      '<div style="font-size:14px;font-weight:700;color:var(--accent2)">' +
      o.team.city +
      ' ' +
      o.team.nickname +
      '</div>' +
      '<div style="font-size:10px;color:' +
      il.c +
      ';margin-top:2px">' +
      il.txt +
      '</div>' +
      '</div>' +
      '<div style="text-align:right">' +
      '<div style="font-size:11px;font-weight:700;color:' +
      vc +
      '">' +
      vl +
      '</div>' +
      '<div style="font-size:10px;color:var(--muted2);margin-top:2px">' +
      o.value.toLocaleString() +
      ' vs ' +
      myVal.toLocaleString() +
      ' pts' +
      (pct > 0 ? ' (' + (good ? '+' : '-') + pct + '%)' : '') +
      '</div>' +
      '</div>' +
      '</div>' +
      (plRows || '') +
      (pkRows || '') +
      '<button onclick="window._acceptPickOffer(' +
      idx +
      ')" ' +
      'style="width:100%;margin-top:10px;font-size:12px;font-weight:600;' +
      'background:' +
      (good ? 'var(--accent-dim)' : 'var(--surface2)') +
      ';' +
      'border-color:' +
      (good ? 'var(--accent)' : 'var(--border)') +
      ';' +
      'color:' +
      (good ? 'var(--accent2)' : 'var(--muted2)') +
      '">' +
      'Accept Trade' +
      '</button>' +
      '</div>'
    );
  }

  var cards = offers.length
    ? offers.map(offerCard).join('')
    : '<p style="font-size:12px;color:var(--muted2);padding:12px 0">' +
      'No teams are making offers for this pick right now. Try again later.</p>';

  var viaNote =
    myPick.origOwner !== myPick.curOwner
      ? ' <span style="color:var(--gold);font-size:10px">(via ' +
        (getTeamById(myPick.origOwner) ? getTeamById(myPick.origOwner).nickname : '?') +
        ')</span>'
      : '';

  /* ── Build modal ── */
  var old = document.getElementById('_tradePickModal');
  if (old) old.remove();

  var modal = document.createElement('div');
  modal.id = '_tradePickModal';
  modal.style.cssText =
    'position:fixed;inset:0;z-index:9100;display:flex;' +
    'align-items:stretch;justify-content:flex-end;' +
    'background:rgba(0,0,0,.65);backdrop-filter:blur(2px)';

  modal.innerHTML =
    '<div style="width:min(400px,96vw);background:var(--surface);' +
    'border-left:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column">' +
    /* Header */
    '<div style="position:sticky;top:0;background:var(--surface);' +
    'border-bottom:1px solid var(--border);padding:12px 14px;' +
    'display:flex;align-items:center;justify-content:space-between;z-index:1">' +
    "<span style=\"font-family:'Barlow Condensed',sans-serif;font-size:15px;" +
    'font-weight:700;color:#fb923c">&#x1F504; Trade Finder &mdash; Current Pick</span>' +
    '<button onclick="document.getElementById(\'_tradePickModal\').remove()" ' +
    'style="width:auto;padding:4px 10px;font-size:12px;' +
    'background:var(--surface2);border-color:var(--border);color:var(--muted2)">&times; Close</button>' +
    '</div>' +
    '<div style="padding:14px">' +
    /* Pick summary */
    '<div style="background:var(--surface2);border-radius:8px;padding:10px 12px;margin-bottom:14px">' +
    '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;' +
    'letter-spacing:.8px;margin-bottom:4px">You Are Trading Away</div>' +
    '<div style="font-size:14px;font-weight:700;color:#fb923c">' +
    myLabel +
    viaNote +
    '</div>' +
    '<div style="font-size:11px;color:var(--muted2);margin-top:2px">Value: ' +
    myVal.toLocaleString() +
    ' pts</div>' +
    '</div>' +
    /* Offer count */
    (offers.length
      ? '<div style="font-size:11px;color:var(--muted2);margin-bottom:10px">' +
        offers.length +
        ' offer' +
        (offers.length !== 1 ? 's' : '') +
        ' from ' +
        new Set(
          offers.map(function (o) {
            return o.team.id;
          }),
        ).size +
        ' team' +
        (new Set(
          offers.map(function (o) {
            return o.team.id;
          }),
        ).size !== 1
          ? 's'
          : '') +
        ' &mdash; best deals first</div>'
      : '') +
    /* Offer cards */
    cards +
    '</div>' +
    '</div>';

  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
};

/* ============================================================
   SIM ENTIRE SEASON
   Simulates every remaining regular-season week sequentially
   (current week through week 17) with one button press, then
   hands off to the awards / postseason phase exactly as the
   normal week-by-week path would.
   ============================================================ */
(function () {
  window.simEntireSeason = function () {
    /* Guard: schedule must be loaded */
    if (typeof schedule === 'undefined' || !schedule || !schedule.length) {
      alert('No schedule found. Start a new game first.');
      return;
    }

    /* Guard: already in postseason */
    if (window.gmPhase === 'postseason') {
      alert('The regular season is already over.');
      return;
    }

    /* Guard: already finished */
    if (currentWeekIndex >= schedule.length) {
      alert('All regular-season weeks have already been simulated.');
      return;
    }

    var remaining = schedule.length - currentWeekIndex;
    if (
      !confirm(
        'Simulate all ' +
          remaining +
          ' remaining week(s) through Week 17?\n\nAll injuries, stat progressions, and weekly events will still apply \u2014 just no results screen between weeks.',
      )
    )
      return;

    /* Build strategy from DOM (same as the normal Sim Week button) */
    var strat = {
      offPlaybook: (document.getElementById('offPlaybook') || { value: 'West Coast' }).value,
      offensiveStyle: (document.getElementById('offStyle') || { value: 'Balanced' }).value,
      defPlaybook: (document.getElementById('defPlaybook') || { value: '4-3' }).value,
      defensiveStyle: (document.getElementById('defStyle') || { value: 'Balanced' }).value,
    };

    /* Sim every remaining week */
    while (currentWeekIndex < schedule.length) {
      var week = schedule[currentWeekIndex];
      simulateWeek(week, teamMap, strat, userTeamId);
      currentWeekIndex++;
    }

    /* Sync the header week label + Sim Week button text */
    if (typeof updateWeekLabel === 'function') updateWeekLabel();

    /* Transition to awards / offseason exactly as the normal path does */
    if (typeof beginAwardsPhase === 'function') {
      beginAwardsPhase();
    } else {
      setMainContent(
        '<div class="welcome-hero">' +
          '<h2 style="color:var(--gold)">\uD83C\uDFC1 Season Complete</h2>' +
          '<p style="color:var(--muted2);font-size:13px">All 17 weeks simulated.</p>' +
          '<button onclick="typeof renderAwards===\'function\'&&renderAwards()" style="margin-top:10px">\uD83C\uDFC6 View Awards</button>' +
          '<button onclick="typeof beginFreeAgencyPhase===\'function\'&&beginFreeAgencyPhase()" style="margin-top:8px">\uD83D\uDCBC Free Agency</button>' +
          '</div>',
      );
    }
  };
})();
