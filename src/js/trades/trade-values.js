/* ============================================================
   TRADE VALUE SYSTEM (KTC-INSPIRED EXPONENTIAL CURVE)

   Problems with old linear pv():
   1. Ten 70-OVR players = one 90-OVR player (absurd)
   2. Only QB/EDGE/CB got scarcity premiums (×1.2 flat)
   3. No "anchor rule" — junk volume beat elite talent

   This patch replaces pv() with a dynasty-community-standard
   exponential curve and adds three safeguards:

   Rule 1 — EXPONENTIAL VALUE CURVE
     value = 10 × 1.25^(ovr - 65) × ageMult × posMult
     At OVR 70 = 30pts. OVR 80 = 284pts. OVR 90 = 2647pts.
     90 OVR needs THREE 85s to match — not nine 70s.

   Rule 2 — POSITION SCARCITY (6 tiers)
     QB 1.5×, EDGE 1.3×, T 1.2×, CB/FS 1.15×,
     WR/SS/C 1.1×, everything else 1.0×

   Rule 3 — BEST PLAYER ANCHOR RULE
     The single most valuable player on EACH side must be
     worth at least 45% of that side's total value.
     Prevents packaging 20 cheap players to match one star.

   Rule 4 — SIDE SIZE CAP (4 players + 3 picks max per side)
     Keeps trades readable and prevents volume spam.
   ============================================================ */
(function () {
  /* ── Exponential OVR-to-value curve ─────────────────────── */
  var POS_MULT = {
    QB: 1.5,
    EDGE: 1.3,
    T: 1.2,
    CB: 1.15,
    FS: 1.15,
    WR: 1.1,
    SS: 1.1,
    C: 1.1,
    /* All others default to 1.0 */
  };

  window.tradeValueOf = function (p) {
    if (!p || !p.attributes) return 0;
    var ovr = Math.max(40, Math.min(99, p.attributes.overall));
    var age = p.age || 27;
    var pos = p.positions ? p.positions[0] : 'RB';

    /* Exponential base: doubles roughly every 10 OVR above 75 */
    var base = 10 * Math.pow(1.25, ovr - 65);

    /* Age multiplier — mirrors KTC's youth premium */
    var ageMult;
    if (age <= 22) ageMult = 1.55;
    else if (age <= 24) ageMult = 1.3;
    else if (age <= 26) ageMult = 1.1;
    else if (age <= 28) ageMult = 0.95;
    else if (age <= 30) ageMult = 0.8;
    else if (age <= 32) ageMult = 0.6;
    else if (age <= 34) ageMult = 0.4;
    else ageMult = 0.2;

    /* Position scarcity */
    var posMult = POS_MULT[pos] || 1.0;

    return Math.round(base * ageMult * posMult);
  };

  /* ── Side validation: anchor rule + size cap ─────────────── */
  var MAX_PLAYERS_PER_SIDE = 4;
  var MAX_PICKS_PER_SIDE = 3;
  var ANCHOR_MIN_RATIO = 0.45; /* best player ≥ 45% of side total */

  function validateTradeSide(players, picks, sideLabel) {
    var errors = [];

    if (players.length > MAX_PLAYERS_PER_SIDE)
      errors.push(sideLabel + ': max ' + MAX_PLAYERS_PER_SIDE + ' players per side');
    if (picks.length > MAX_PICKS_PER_SIDE) errors.push(sideLabel + ': max ' + MAX_PICKS_PER_SIDE + ' picks per side');

    var total =
      players.reduce(function (s, p) {
        return s + window.tradeValueOf(p);
      }, 0) +
      picks.reduce(function (s, id) {
        return s + (typeof window.pickValueById === 'function' ? window.pickValueById(id) : 200);
      }, 0);

    if (players.length > 1 && total > 0) {
      var best = players.reduce(function (mx, p) {
        return Math.max(mx, window.tradeValueOf(p));
      }, 0);
      var anchorRatio = best / total;
      if (anchorRatio < ANCHOR_MIN_RATIO) {
        errors.push(
          sideLabel +
            ': trade looks like a salary dump — ' +
            'your best player must be worth at least 45% of your total offer. ' +
            'Current best: ' +
            best.toLocaleString() +
            ' pts / total: ' +
            total.toLocaleString() +
            ' pts' +
            ' (' +
            Math.round(anchorRatio * 100) +
            '%)',
        );
      }
    }

    return { errors: errors, total: total };
  }

  window._proposeTrade = function () {
    var selA = document.getElementById('tcTeamA');
    var selB = document.getElementById('tcTeamB');
    var result = document.getElementById('tcResult');
    if (!selA || !selB || !result) return;
    if (selA.value === selB.value) {
      result.innerHTML = '<p style="color:#f87171">Select two different teams.</p>';
      return;
    }

    var teamA = getTeamById(selA.value);
    var teamB = getTeamById(selB.value);
    var sel = window._tradeSelected;

    var plA = Array.from(sel.A.players)
      .map(function (id) {
        return teamA.roster.find(function (p) {
          return String(p.id) === id;
        });
      })
      .filter(Boolean);
    var plB = Array.from(sel.B.players)
      .map(function (id) {
        return teamB.roster.find(function (p) {
          return String(p.id) === id;
        });
      })
      .filter(Boolean);
    var pkA = Array.from(sel.A.picks);
    var pkB = Array.from(sel.B.picks);

    /* Must have assets on both sides */
    if (!plA.length && !pkA.length && !plB.length && !pkB.length) {
      result.innerHTML = '<p style="color:#f87171">Select assets on both sides.</p>';
      return;
    }
    if ((!plA.length && !pkA.length) || (!plB.length && !pkB.length)) {
      result.innerHTML = '<p style="color:#f87171">Both sides must offer at least one asset.</p>';
      return;
    }

    /* Validate both sides */
    var vA = validateTradeSide(plA, pkA, teamA.nickname);
    var vB = validateTradeSide(plB, pkB, teamB.nickname);

    var allErrors = vA.errors.concat(vB.errors);
    if (allErrors.length) {
      result.innerHTML =
        '<div style="background:rgba(239,68,68,.1);border:1px solid #ef4444;' +
        'border-radius:8px;padding:10px 14px;margin-bottom:10px">' +
        allErrors
          .map(function (e) {
            return '<p style="color:#f87171;font-size:12px;margin:4px 0">⚠ ' + e + '</p>';
          })
          .join('') +
        '</div>';
      return;
    }

    var valA = vA.total;
    var valB = vB.total;

    /* Value gap as percentage of the larger side */
    var larger = Math.max(valA, valB);
    var gap = Math.abs(valA - valB) / larger;

    /* Build value breakdown */
    function playerValueRow(p) {
      var v = window.tradeValueOf(p);
      return (
        '<div style="display:flex;justify-content:space-between;font-size:11px;' +
        'padding:2px 0;color:var(--muted2)">' +
        '<span>' +
        p.name +
        ' (' +
        p.positions[0] +
        ' · OVR ' +
        p.attributes.overall +
        ' · Age ' +
        p.age +
        ')</span>' +
        '<span style="color:var(--text);font-weight:600">' +
        v.toLocaleString() +
        ' pts</span>' +
        '</div>'
      );
    }

    function pickValueRow(id) {
      var v = typeof window.pickValueById === 'function' ? window.pickValueById(id) : 0;
      var m = id.match(/_R(\d+)_Y(\d+)/);
      var label = m ? 'Yr ' + m[2] + ' Rd ' + m[1] : id;
      return (
        '<div style="display:flex;justify-content:space-between;font-size:11px;' +
        'padding:2px 0;color:var(--muted2)">' +
        '<span>' +
        label +
        ' (pick)</span>' +
        '<span style="color:var(--text);font-weight:600">' +
        v.toLocaleString() +
        '</span>' +
        '</div>'
      );
    }

    var breakdown =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0">' +
      /* Side A */
      '<div style="background:var(--surface2);border-radius:8px;padding:10px">' +
      '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">' +
      teamA.nickname +
      ' gives' +
      '</div>' +
      plA.map(playerValueRow).join('') +
      pkA.map(pickValueRow).join('') +
      '<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;' +
      'display:flex;justify-content:space-between;font-size:13px;font-weight:700">' +
      '<span>Total</span>' +
      '<span style="color:var(--accent2)">' +
      valA.toLocaleString() +
      '</span>' +
      '</div>' +
      '</div>' +
      /* Side B */
      '<div style="background:var(--surface2);border-radius:8px;padding:10px">' +
      '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">' +
      teamB.nickname +
      ' gives' +
      '</div>' +
      plB.map(playerValueRow).join('') +
      pkB.map(pickValueRow).join('') +
      '<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px;' +
      'display:flex;justify-content:space-between;font-size:13px;font-weight:700">' +
      '<span>Total</span>' +
      '<span style="color:var(--accent2)">' +
      valB.toLocaleString() +
      '</span>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--muted2);margin-bottom:10px;text-align:center">' +
      'Gap: <strong>' +
      Math.round(gap * 100) +
      '%</strong> ' +
      (gap < 0.1 ? '✅ Fair' : gap < 0.22 ? '⚠️ Borderline' : '❌ Too lopsided') +
      '</div>';

    /* Decision */
    var teamBGivingMore = valB > valA;
    var rejectingTeam = teamBGivingMore ? teamB : teamA;

    function doExecute() {
      plA.forEach(function (p) {
        teamA.roster = teamA.roster.filter(function (x) {
          return String(x.id) !== String(p.id);
        });
        if (p.contract) teamA.capUsed -= p.contract.capHitPerYear;
        teamB.roster.push(p);
        if (p.contract) teamB.capUsed += p.contract.capHitPerYear;
      });
      plB.forEach(function (p) {
        teamB.roster = teamB.roster.filter(function (x) {
          return String(x.id) !== String(p.id);
        });
        if (p.contract) teamB.capUsed -= p.contract.capHitPerYear;
        teamA.roster.push(p);
        if (p.contract) teamA.capUsed += p.contract.capHitPerYear;
      });
      pkA.forEach(function (id) {
        window.transferPick && window.transferPick(id, teamA.id, teamB.id);
      });
      pkB.forEach(function (id) {
        window.transferPick && window.transferPick(id, teamB.id, teamA.id);
      });
      if (typeof logTradeTransaction === 'function') logTradeTransaction(teamA, plA, pkA, teamB, plB, pkB);

      result.innerHTML =
        breakdown +
        '<div style="background:rgba(22,163,74,.15);border:1px solid var(--accent);' +
        'border-radius:8px;padding:10px;text-align:center">' +
        '<span style="color:#4ade80;font-weight:700;font-size:14px">✅ Trade executed!</span>' +
        '</div>';

      setTimeout(function () {
        window.renderTradePicksUI && window.renderTradePicksUI();
      }, 2000);
    }

    if (gap <= 0.1) {
      doExecute();
    } else if (gap <= 0.22) {
      /* Borderline — CPU accepts if they have a strong positional need */
      var need = 0.5;
      if (typeof getTeamNeedAtPosition === 'function' && (plA[0] || plB[0])) {
        var keyPlayer = teamBGivingMore ? plA[0] && plA[0].positions[0] : plB[0] && plB[0].positions[0];
        if (keyPlayer) need = getTeamNeedAtPosition(rejectingTeam, keyPlayer);
      }
      if (need >= 0.7) {
        doExecute();
      } else {
        var msg =
          typeof _tradeMsg === 'function'
            ? _tradeMsg(teamBGivingMore, teamA, teamB, valA, valB)
            : rejectingTeam.nickname + ' wants more value.';
        result.innerHTML =
          breakdown +
          '<p style="color:#facc15;font-weight:600">⚠️ ' +
          rejectingTeam.nickname +
          ' hesitated — ' +
          msg +
          '</p>';
      }
    } else {
      msg =
        typeof _tradeMsg === 'function'
          ? _tradeMsg(teamBGivingMore, teamA, teamB, valA, valB)
          : rejectingTeam.nickname + ' rejected.';
      result.innerHTML =
        breakdown +
        '<p style="color:#f87171;font-weight:600">❌ ' +
        rejectingTeam.nickname +
        ' rejected — ' +
        msg +
        '</p>';
    }
  };

  /* ── Trade Offers: generate CPU offers for a specific player ── */
  window.renderTradeOffers = function (playerId) {
    /* Use activeTeamId() which reads from DOM — avoids stale userTeamId */
    var tid =
      typeof activeTeamId === 'function' ? activeTeamId() : typeof userTeamId !== 'undefined' ? userTeamId : null;

    /* Find player + team — search by active team first, then all teams */
    var myTeam = null,
      player = null;
    if (tid && typeof getTeamById === 'function') {
      myTeam = getTeamById(tid);
      if (myTeam)
        player = myTeam.roster.find(function (p) {
          return String(p.id) === String(playerId);
        });
    }
    /* Fallback: scan all teams (catches stale-ID edge case) */
    if (!player && typeof listAllTeams === 'function' && typeof league !== 'undefined') {
      listAllTeams(league).forEach(function (t) {
        if (player) return;
        var found = t.roster.find(function (p) {
          return String(p.id) === String(playerId);
        });
        if (found) {
          player = found;
          myTeam = t;
        }
      });
    }
    if (!player || !myTeam) return;

    var tv = window.tradeValueOf;
    var pvById =
      window.pickValueById ||
      function () {
        return 200;
      };
    var pos = player.positions[0];
    var pVal = tv(player);

    /* ── Build the picks list for a given team ──────────────── */
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

    /* ── Value of a picks array ─────────────────────────────── */
    function picksVal(pks) {
      return pks.reduce(function (s, id) {
        return s + pvById(id);
      }, 0);
    }

    /* ── Build + score one offer ────────────────────────────── */
    function makeOffer(cpu, pl, pks, interest, need) {
      var val =
        pl.reduce(function (s, p) {
          return s + tv(p);
        }, 0) + picksVal(pks);
      if (val <= 0) return null;
      /* Upper bound: whichever is greater of (2× asking value) OR (1000 pts above asking).
         Gives small players a generous floor so a team CAN overpay for a cheap TE,
         while preventing absurd offers on high-value players.                      */
      var maxOffer = Math.max(pVal * 2.0, pVal + 1000);
      if (val > maxOffer) return null;
      /* Also reject offers that are less than 35% of player value (insults) */
      if (val < pVal * 0.35) return null;
      var gap = (pVal - val) / Math.max(pVal, 1);
      return {
        team: cpu,
        players: pl.slice(),
        picks: pks.slice(),
        value: val,
        gap: gap,
        interest: interest,
        need: need,
      };
    }

    /* ── Greedy best-fit: pick up to `maxPl` players summing to `target` ─ */
    function greedyPlayers(pool, target, maxPl) {
      if (target <= 0) return [];
      var pl = [],
        rem = target;
      /* Sort descending by value */
      var sorted = pool.slice().sort(function (a, b) {
        return tv(b) - tv(a);
      });
      for (var i = 0; i < sorted.length && pl.length < maxPl; i++) {
        var p = sorted[i],
          v = tv(p);
        /* Skip players worth more than 130% of the TOTAL target (not just remaining)
           — prevents a single high-value player dominating a low-value trade        */
        if (v > target * 1.3) continue;
        /* Allow up to 25% overshoot of remaining budget per player */
        if (v <= rem * 1.25) {
          pl.push(p);
          rem -= v;
          if (rem <= 0) break;
        }
      }
      return pl;
    }

    /* ── Pick greedy fill: add picks until we hit target ─────── */
    function greedyPicks(picks, target, max) {
      var pks = [],
        rem = target;
      for (var i = 0; i < picks.length && pks.length < max; i++) {
        var v = pvById(picks[i].pickId);
        if (v <= rem * 1.3) {
          pks.push(picks[i].pickId);
          rem -= v;
          if (rem <= 0) break;
        }
      }
      return pks;
    }

    /* ─────────────────────────────────────────────────────────
       MAIN OFFER GENERATION
    ───────────────────────────────────────────────────────── */
    var offers = [];

    (listAllTeams(league) || []).forEach(function (cpu) {
      if (cpu.id === userTeamId) return;

      var need = typeof getTeamNeedAtPosition === 'function' ? getTeamNeedAtPosition(cpu, pos) : 0.5;

      var interest = need * 0.65 + Math.random() * 0.45;
      if (interest < 0.35) return;

      /* High-need teams are willing to overpay — but max 25% premium */
      var stretch = Math.min(1.25, 1.0 + (need > 0.7 ? (need - 0.7) * 0.8 : 0));
      var budget = Math.round(pVal * (0.72 + interest * 0.4) * stretch);

      var allSorted = (cpu.roster || [])
        .filter(function (p) {
          return p.contract && p.attributes && p.attributes.overall >= 60;
        })
        .sort(function (a, b) {
          return tv(b) - tv(a);
        });

      /* Tradeable = everyone below the top-1 UNLESS desperation (need>0.85) */
      var reserve = need >= 0.85 ? 1 : 2;
      var tradeable = allSorted.slice(reserve);
      /* Always have at least a small pool */
      if (!tradeable.length && allSorted.length) tradeable = allSorted.slice(1);

      /* Also offer "scheme misfits": players who fit poorly get prioritised
         as trade bait — the CPU is motivated to move them */
      var schemeMisfits = [];
      if (typeof calculateSchemeFit === 'function') {
        schemeMisfits = allSorted.filter(function (p) {
          return calculateSchemeFit(p, cpu) < 45 && tv(p) > 50;
        });
      }

      var cpuPicks = picksForTeam(cpu);

      /* ── Template A: Player package only (up to 4 players) ── */
      (function () {
        if (!tradeable.length) return;
        var pl = greedyPlayers(tradeable, budget, 4);
        if (pl.length) offers.push(makeOffer(cpu, pl, [], interest, need));
      })();

      /* ── Template B: 1-2 players + 1 pick ────────────────── */
      (function () {
        if (!tradeable.length || !cpuPicks.length) return;
        var pk1 = cpuPicks[0];
        var pkV = pvById(pk1.pickId);
        var pl = greedyPlayers(tradeable, budget - pkV, 3);
        if (pl.length) offers.push(makeOffer(cpu, pl, [pk1.pickId], interest, need));
      })();

      /* ── Template C: 1-3 players + 2 picks ───────────────── */
      (function () {
        if (!tradeable.length || cpuPicks.length < 2) return;
        var topPks = cpuPicks.slice(0, 2).map(function (pk) {
          return pk.pickId;
        });
        var pkV = picksVal(topPks);
        var pl = greedyPlayers(tradeable, budget - pkV, 3);
        if (pl.length) offers.push(makeOffer(cpu, pl, topPks, interest, need));
      })();

      /* ── Template D: Picks only ───────────────────────────── */
      (function () {
        if (!cpuPicks.length) return;
        var pks = greedyPicks(cpuPicks, budget, 4);
        if (pks.length) offers.push(makeOffer(cpu, [], pks, interest, need));
      })();

      /* ── Template E: Scheme misfit dump ──────────────────── */
      (function () {
        if (!schemeMisfits.length) return;
        /* CPU wants to unload a misfit — package them as the headliner */
        var misfit = schemeMisfits[0];
        var rem = budget - tv(misfit);
        var pl = [misfit];
        /* Supplement with picks or more players */
        if (rem > 0 && cpuPicks.length) {
          var pks = greedyPicks(cpuPicks, rem, 2);
          if (pks.length) {
            offers.push(makeOffer(cpu, pl, pks, interest, need));
            return;
          }
        }
        if (rem > 0) {
          var extra = greedyPlayers(
            tradeable.filter(function (p) {
              return p.id !== misfit.id;
            }),
            rem,
            2,
          );
          pl = pl.concat(extra);
        }
        offers.push(makeOffer(cpu, pl, [], interest, need));
      })();

      /* ── Template F: Desperate need — offer the 2nd-best player ─
         Only if the star's value is in the right ballpark (≤175% of
         pVal). Prevents a 94 OVR star being offered for a 64 OVR bench
         player just because the CPU needs that position.              */
      (function () {
        if (need < 0.75) return;
        var star = allSorted[1]; /* 2nd-best player on roster */
        if (!star) return;
        var starV = tv(star);
        /* Don't offer a player worth more than the same ceiling as makeOffer */
        var maxStarOffer = Math.max(pVal * 2.0, pVal + 1000);
        if (starV > maxStarOffer) return;
        var rem = budget - starV;
        var pl = [star];
        var pks = rem > 0 && cpuPicks.length ? greedyPicks(cpuPicks, rem, 2) : [];
        if (rem > 0 && !pks.length) {
          var extra = greedyPlayers(
            tradeable.filter(function (p) {
              return p.id !== star.id;
            }),
            rem,
            2,
          );
          pl = pl.concat(extra);
        }
        var o = makeOffer(cpu, pl, pks, interest, need);
        if (o) offers.push(o);
      })();
    });

    /* Deduplicate near-identical offers from same team */
    var seenKey = {};
    offers = offers.filter(function (o) {
      /* Key = team + rounded value bucket */
      var playerIds = o.players
        .map(function (p) {
          return p.id;
        })
        .sort()
        .join(',');
      var pickIds = o.picks.slice().sort().join(',');
      var key = o.team.id + '|' + playerIds + '|' + pickIds;
      if (seenKey[key]) return false;
      seenKey[key] = true;
      return true;
    });

    /* Sort: overpaying first (best deal for user), cap at 32 */
    offers.sort(function (a, b) {
      return a.gap - b.gap;
    });
    offers = offers.slice(0, 32);

    /* ── Helpers ─────────────────────────────────────────────── */
    function schemeTag(p) {
      if (typeof calculateSchemeFit !== 'function' || typeof getTeamById !== 'function') return '';
      var score = calculateSchemeFit(p, myTeam);
      if (score >= 65)
        return (
          ' <span style="font-size:9px;color:#4ade80;background:rgba(22,163,74,.15);' +
          'border-radius:3px;padding:1px 4px">✦ scheme fit</span>'
        );
      if (score < 45)
        return (
          ' <span style="font-size:9px;color:#f87171;background:rgba(239,68,68,.12);' +
          'border-radius:3px;padding:1px 4px">✦ poor fit</span>'
        );
      return '';
    }
    function interestLabel(i) {
      if (i >= 0.8) return { txt: '🔥 Very Interested', c: '#f87171' };
      if (i >= 0.6) return { txt: '⭐ Interested', c: '#facc15' };
      return { txt: '📋 Making an Offer', c: '#94a3b8' };
    }

    /* ── Execute accepted trade ─────────────────────────────── */
    window._acceptTradeOffer = function acceptOffer(idx) {
      var o = offers[idx];
      if (!o) return;
      myTeam.roster = myTeam.roster.filter(function (x) {
        return String(x.id) !== String(player.id);
      });
      if (player.contract) myTeam.capUsed -= player.contract.capHitPerYear;
      o.team.roster.push(player);
      if (player.contract) o.team.capUsed += player.contract.capHitPerYear;

      o.players.forEach(function (p) {
        o.team.roster = o.team.roster.filter(function (x) {
          return String(x.id) !== String(p.id);
        });
        if (p.contract) o.team.capUsed -= p.contract.capHitPerYear;
        myTeam.roster.push(p);
        if (p.contract) myTeam.capUsed += p.contract.capHitPerYear;
      });
      o.picks.forEach(function (id) {
        if (typeof window.transferPick === 'function') window.transferPick(id, o.team.id, myTeam.id);
      });
      if (typeof logTradeTransaction === 'function')
        logTradeTransaction(myTeam, [player], [], o.team, o.players, o.picks);

      var got = o.players
        .map(function (p) {
          return '<strong>' + p.name + '</strong> (' + p.positions[0] + ' · OVR ' + p.attributes.overall + ')';
        })
        .concat(
          o.picks.map(function (id) {
            var m = id.match(/_R(\d+)_Y(\d+)/);
            return m ? '<strong>Yr ' + m[2] + ' Rd ' + m[1] + ' pick</strong>' : '<strong>' + id + '</strong>';
          }),
        );

      setMainContent(
        '<div style="max-width:520px;margin:0 auto">' +
          '<div style="background:rgba(22,163,74,.12);border:1px solid var(--accent);border-radius:12px;' +
          'padding:22px 20px;text-align:center;margin-bottom:16px">' +
          '<div style="font-size:28px;margin-bottom:6px">🤝</div>' +
          '<div style="font-size:20px;font-weight:700;color:#4ade80;margin-bottom:8px;' +
          "font-family:'Barlow Condensed',sans-serif\">Trade Complete!</div>" +
          '<div style="font-size:13px;color:var(--muted2);margin-bottom:12px">' +
          '<strong style="color:var(--text)">' +
          player.name +
          '</strong>' +
          ' → ' +
          o.team.city +
          ' ' +
          o.team.nickname +
          '</div>' +
          '<div style="font-size:12px;color:var(--muted2);line-height:1.8">' +
          'You received:<br>' +
          (got.join('<br>') || '—') +
          '</div>' +
          '</div>' +
          '<button onclick="renderRoster()" style="width:100%;background:var(--accent-dim);' +
          'border-color:var(--accent);color:var(--accent2)">← Back to Roster</button>' +
          '</div>',
      );
      setTimeout(function () {
        if (typeof window._ctxAnimate === 'function') window._ctxAnimate('trade');
      }, 120);
    };

    /* ── Render one offer card ───────────────────────────────── */
    function offerCard(o, idx) {
      var il = interestLabel(o.interest);
      var good = o.gap < 0;
      var fair = o.gap <= 0.12;
      var vc = good ? '#4ade80' : fair ? '#facc15' : '#f87171';
      var vl = good ? '🟢 Above Market' : fair ? '🟡 Fair Value' : '🔴 Below Market';
      var pct = Math.abs(Math.round(o.gap * 100));

      /* Need indicator */
      var needPct = Math.round(o.need * 100);
      var needColor = o.need >= 0.75 ? '#f87171' : o.need >= 0.55 ? '#facc15' : '#94a3b8';
      var needTxt =
        o.need >= 0.75 ? '🚨 Desperate need' : o.need >= 0.55 ? '⚠ Has roster need' : '· filling a depth spot';

      var plRows = o.players
        .map(function (p) {
          return (
            '<div style="display:flex;align-items:center;gap:7px;padding:5px 0;' +
            'border-bottom:1px solid rgba(30,45,71,.3)">' +
            '<span style="font-size:11px;font-weight:700;color:var(--accent2);min-width:34px">' +
            p.positions[0] +
            '</span>' +
            '<div style="flex:1">' +
            '<div style="font-size:12px;font-weight:500">' +
            p.name +
            schemeTag(p) +
            '</div>' +
            '<div style="font-size:10px;color:var(--muted2)">Age ' +
            p.age +
            '</div>' +
            '</div>' +
            '<span style="font-size:13px;font-weight:700;color:' +
            ovrColor(p.attributes.overall) +
            '">' +
            p.attributes.overall +
            '</span>' +
            '<span style="font-size:10px;color:var(--muted2);min-width:52px;text-align:right">' +
            tv(p).toLocaleString() +
            ' pts</span>' +
            '</div>'
          );
        })
        .join('');

      var pkRows = o.picks
        .map(function (id) {
          var m = id.match(/_R(\d+)_Y(\d+)/);
          var origTeam = id.split('_R')[0];
          var via =
            origTeam && origTeam !== o.team.id
              ? ' <span style="color:var(--gold);font-size:9px">via ' +
                ((getTeamById(origTeam) || {}).nickname || '?') +
                '</span>'
              : '';
          return (
            '<div style="display:flex;align-items:center;gap:7px;padding:5px 0;' +
            'border-bottom:1px solid rgba(30,45,71,.3)">' +
            '<span style="font-size:10px;font-weight:700;color:#facc15;min-width:34px">PICK</span>' +
            '<div style="flex:1;font-size:12px">' +
            (m ? 'Season ' + m[2] + ' · Round ' + m[1] : id) +
            via +
            '</div>' +
            '<span style="font-size:10px;color:var(--muted2);min-width:52px;text-align:right">' +
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
        '<div style="font-size:10px;color:' +
        needColor +
        ';margin-top:1px">' +
        needTxt +
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
        pVal.toLocaleString() +
        ' pts' +
        (pct > 0 ? ' (' + (good ? '+' : '-') + pct + '%)' : '') +
        '</div>' +
        '</div>' +
        '</div>' +
        (plRows || '') +
        (pkRows || '') +
        '<button onclick="window._acceptTradeOffer(' +
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

    /* ── Trade preference: what the user wants back ───────────
       null = any, 'picks' = draft picks only, else = position code */
    if (window._tradePreference === undefined) window._tradePreference = null;

    var ALL_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'T', 'G', 'C', 'EDGE', 'DT', 'LB', 'CB', 'FS', 'SS', 'K', 'P'];

    function offerMatchesPref(o, pref) {
      if (!pref) return true;
      if (pref === 'picks') return o.picks.length > 0;
      return o.players.some(function (p) {
        return p.positions[0] === pref;
      });
    }

    function prefPanelHTML() {
      var pref = window._tradePreference;
      function pill(val, label) {
        var active = pref === val || (val === null && !pref);
        return (
          '<button onclick="window._setTradePref(\'' +
          val +
          "','" +
          playerId +
          '\')" ' +
          'style="width:auto;padding:4px 10px;font-size:11px;font-weight:' +
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
          'border-radius:99px;white-space:nowrap">' +
          label +
          '</button>'
        );
      }
      return (
        '<div style="background:var(--surface);border:1px solid var(--border);' +
        'border-radius:10px;padding:12px 14px;margin-bottom:14px">' +
        '<div style="font-size:10px;font-weight:700;text-transform:uppercase;' +
        'letter-spacing:.8px;color:var(--accent2);margin-bottom:8px">' +
        "📣 I'm looking for…" +
        (pref
          ? ' <span style="font-size:10px;color:var(--muted2);font-weight:400">' +
            '— filtering for ' +
            (pref === 'picks' ? 'draft picks' : pref) +
            '</span>'
          : '') +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:5px">' +
        pill(null, 'Any') +
        pill('picks', '🎯 Picks') +
        ALL_POSITIONS.map(function (p) {
          return pill(p, p);
        }).join('') +
        '</div>' +
        '</div>'
      );
    }

    window._setTradePref = function (pref, pid) {
      var cur = window._tradePreference;
      window._tradePreference = !pref || pref === 'null' || pref === cur ? null : pref;
      window.renderTradeOffers(pid);
    };

    var pref = window._tradePreference;
    var sortedOffers = offers.slice().sort(function (a, b) {
      var am = offerMatchesPref(a, pref) ? 0 : 1;
      var bm = offerMatchesPref(b, pref) ? 0 : 1;
      if (am !== bm) return am - bm;
      return a.gap - b.gap;
    });

    function offerCardWithPref(o, idx) {
      var base = offerCard(o, idx);
      if (!pref) return base;
      var matches = offerMatchesPref(o, pref);
      var badge = matches
        ? '<div style="font-size:10px;color:#4ade80;font-weight:600;margin-bottom:6px">✓ Matches your request</div>'
        : '<div style="font-size:10px;color:var(--muted);font-style:italic;margin-bottom:6px">' +
          '· No ' +
          (pref === 'picks' ? 'picks' : pref) +
          ' in this offer</div>';
      return '<div style="opacity:' + (matches ? '1' : '0.55') + '">' + badge + base + '</div>';
    }

    var uniqueTeams = new Set(
      offers.map(function (o) {
        return o.team.id;
      }),
    ).size;
    var matchCount = pref
      ? sortedOffers.filter(function (o) {
          return offerMatchesPref(o, pref);
        }).length
      : offers.length;

    var header =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<button onclick="renderPlayerDetail(\'' +
      playerId +
      '\')" ' +
      'style="width:auto;padding:5px 12px;font-size:12px">← Back</button>' +
      '<div>' +
      '<h2 style="margin:0;font-size:18px">Trade Offers — ' +
      player.name +
      '</h2>' +
      '<div style="font-size:11px;color:var(--muted2)">' +
      player.positions[0] +
      ' · OVR ' +
      player.attributes.overall +
      ' · ' +
      pVal.toLocaleString() +
      ' pts trade value' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<button onclick="window.renderQuickRoster()" ' +
      'style="width:auto;padding:5px 12px;font-size:11px;' +
      'background:rgba(59,130,246,.15);border-color:#3b82f6;color:#60a5fa">' +
      '👥 My Roster' +
      '</button>' +
      '</div>';

    var note = offers.length
      ? '<p class="small" style="color:var(--muted2);margin-bottom:12px">' +
        (pref
          ? matchCount +
            ' of ' +
            offers.length +
            ' offer' +
            (offers.length !== 1 ? 's' : '') +
            ' include ' +
            (pref === 'picks' ? 'draft picks' : pref)
          : offers.length +
            ' offer' +
            (offers.length !== 1 ? 's' : '') +
            ' from ' +
            uniqueTeams +
            ' team' +
            (uniqueTeams !== 1 ? 's' : '')) +
        ' · <span style="color:#4ade80">✦ scheme fit</span>' +
        ' / <span style="color:#f87171">✦ poor fit</span>' +
        '</p>'
      : '';

    var body = offers.length
      ? '<div style="max-width:580px;margin:0 auto">' +
        header +
        prefPanelHTML() +
        note +
        sortedOffers
          .map(function (o) {
            return offerCardWithPref(o, offers.indexOf(o));
          })
          .join('') +
        '</div>'
      : '<div style="max-width:580px;margin:0 auto">' +
        header +
        prefPanelHTML() +
        '<div style="background:var(--surface2);border-radius:8px;padding:24px;' +
        'text-align:center;color:var(--muted2);font-size:13px">' +
        'No teams are interested right now. Try next week or check a lower-demand player.' +
        '</div>' +
        '</div>';

    setMainContent(body);
  };

  /* ── Update _buildAssetPanel player rows to show trade value ─ */
  var _origBuildPanel = window._buildAssetPanel || function () {};
  /* Override _refreshTC to add value hints */
  var _origRefresh = window._refreshTC;
  window._refreshTC = function () {
    if (typeof _origRefresh === 'function') _origRefresh();
  };
})();
