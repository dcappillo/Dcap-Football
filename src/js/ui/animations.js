/* ============================================================
   CONTEXT ANIMATIONS ENGINE
   Fired on: win, loss, trade complete, FA signing, draft pick
   ============================================================ */
(function () {
  function getOv() {
    var el = document.getElementById('_ctx_ov');
    if (!el) {
      el = document.createElement('div');
      el.id = '_ctx_ov';
      el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
      document.body.appendChild(el);
    }
    el.innerHTML = '';
    return el;
  }

  window._ctxAnimate = function (type) {
    if (!type) return;
    var ov = getOv();

    /* ── WIN ─ confetti rain + radial green flash ─────────── */
    if (type === 'win') {
      var flash = document.createElement('div');
      flash.style.cssText =
        'position:absolute;inset:0;' +
        'background:radial-gradient(ellipse at 50% 30%,rgba(34,197,94,.38) 0%,rgba(22,163,74,.16) 55%,transparent 100%);' +
        'animation:ctx-flash-green 1.8s ease-out forwards';
      ov.appendChild(flash);

      var COLORS = [
        '#22c55e',
        '#4ade80',
        '#86efac',
        '#f59e0b',
        '#fbbf24',
        '#3b82f6',
        '#93c5fd',
        '#e2e8f0',
        '#f0abfc',
        '#fda4af',
      ];
      var SHAPES = ['50%', '0%', '0% 50%'];
      for (var i = 0; i < 60; i++) {
        var c = document.createElement('div');
        var sz = 5 + Math.random() * 10;
        c.style.cssText =
          'position:absolute;top:-14px;' +
          'left:' +
          Math.random() * 102 +
          '%;' +
          'width:' +
          sz +
          'px;height:' +
          sz +
          'px;' +
          'background:' +
          COLORS[i % COLORS.length] +
          ';' +
          'border-radius:' +
          SHAPES[Math.floor(Math.random() * SHAPES.length)] +
          ';' +
          'animation:ctx-confetti-fall ' +
          (1.3 + Math.random() * 1.5) +
          's ' +
          Math.random() * 1.1 +
          's ease-in forwards';
        ov.appendChild(c);
      }

      var banner = document.createElement('div');
      banner.textContent = '🏆 VICTORY';
      banner.style.cssText =
        'position:absolute;bottom:20%;left:50%;' +
        'font-family:"Barlow Condensed",sans-serif;font-size:44px;font-weight:900;' +
        'color:#4ade80;letter-spacing:6px;white-space:nowrap;' +
        'text-shadow:0 0 24px rgba(74,222,128,.9),0 0 50px rgba(22,163,74,.5);' +
        'animation:ctx-float-up 2.2s 0.4s ease-out forwards';
      ov.appendChild(banner);
      setTimeout(function () {
        ov.innerHTML = '';
      }, 3900);

      /* ── LOSS ─ red flash + screen shake ─────────────────── */
    } else if (type === 'loss') {
      var rflash = document.createElement('div');
      rflash.style.cssText =
        'position:absolute;inset:0;' +
        'background:radial-gradient(ellipse at 50% 50%,rgba(239,68,68,.22) 0%,transparent 70%);' +
        'animation:ctx-flash-red 0.9s ease-out forwards';
      ov.appendChild(rflash);

      var sad = document.createElement('div');
      sad.textContent = '😔';
      sad.style.cssText =
        'position:absolute;top:38%;left:50%;' + 'font-size:56px;animation:ctx-float-up 1.4s 0.1s ease-out forwards';
      ov.appendChild(sad);

      var main = document.getElementById('main');
      if (main) {
        main.style.animation = 'ctx-shake 0.52s ease';
        setTimeout(function () {
          main.style.animation = '';
        }, 560);
      }
      setTimeout(function () {
        ov.innerHTML = '';
      }, 1300);

      /* ── TRADE ─ ink stamp + spark burst ─────────────────── */
    } else if (type === 'trade') {
      var stamp = document.createElement('div');
      stamp.textContent = '✓ DEAL';
      stamp.style.cssText =
        'position:absolute;top:44%;left:50%;' +
        'font-family:"Barlow Condensed",sans-serif;font-size:68px;font-weight:900;' +
        'color:#4ade80;letter-spacing:4px;white-space:nowrap;' +
        'border:5px solid #4ade80;border-radius:8px;padding:4px 18px;' +
        'text-shadow:0 0 20px rgba(74,222,128,.8);' +
        'box-shadow:0 0 30px rgba(34,197,94,.4),inset 0 0 20px rgba(34,197,94,.1);' +
        'animation:ctx-stamp 2s cubic-bezier(.175,.885,.32,1.275) forwards';
      ov.appendChild(stamp);

      var SPARK_C = ['#4ade80', '#fbbf24', '#60a5fa', '#f9a8d4', '#a78bfa', '#fb923c'];
      for (var si = 0; si < 14; si++) {
        var angle = (si / 14) * Math.PI * 2;
        var dist = 90 + Math.random() * 130;
        var sp = document.createElement('div');
        sp.style.cssText =
          'position:absolute;top:50%;left:50%;' +
          '--sx:' +
          Math.round(Math.cos(angle) * dist) +
          'px;' +
          '--sy:' +
          Math.round(Math.sin(angle) * dist) +
          'px;' +
          'width:9px;height:9px;border-radius:50%;' +
          'background:' +
          SPARK_C[si % SPARK_C.length] +
          ';' +
          'animation:ctx-spark 0.8s ' +
          (0.15 + Math.random() * 0.25) +
          's ease-out forwards';
        ov.appendChild(sp);
      }
      setTimeout(function () {
        ov.innerHTML = '';
      }, 2500);

      /* ── SIGNING ─ SVG checkmark draw + ripple ───────────── */
    } else if (type === 'signing') {
      var ring = document.createElement('div');
      ring.style.cssText =
        'position:absolute;top:40%;left:50%;' +
        'width:56px;height:56px;border-radius:50%;border:3px solid #4ade80;' +
        'animation:ctx-sign-ripple 1.1s ease-out forwards';
      ov.appendChild(ring);

      var NS = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 50 50');
      svg.style.cssText =
        'position:absolute;top:calc(40% - 52px);left:calc(50% - 52px);' + 'width:104px;height:104px;overflow:visible';
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', 'M 8 26 L 20 38 L 42 14');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#4ade80');
      path.setAttribute('stroke-width', '4.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-dasharray', '100');
      path.setAttribute('stroke-dashoffset', '100');
      path.style.cssText =
        'filter:drop-shadow(0 0 6px rgba(74,222,128,.8));' + 'animation:ctx-sign-check 1.2s ease-out forwards';
      svg.appendChild(path);
      ov.appendChild(svg);

      var lbl = document.createElement('div');
      lbl.textContent = '✍ Signed!';
      lbl.style.cssText =
        'position:absolute;top:37%;left:50%;' +
        'font-family:"Barlow Condensed",sans-serif;font-size:26px;font-weight:700;' +
        'color:#4ade80;letter-spacing:2px;white-space:nowrap;' +
        'text-shadow:0 0 14px rgba(74,222,128,.7);' +
        'animation:ctx-float-up 1.3s 0.25s ease-out forwards';
      ov.appendChild(lbl);
      setTimeout(function () {
        ov.innerHTML = '';
      }, 1800);

      /* ── DRAFT ─ gold spotlight + gold confetti ──────────── */
    } else if (type === 'draft') {
      var spot = document.createElement('div');
      spot.style.cssText =
        'position:absolute;top:0;left:50%;transform:translateX(-50%);' +
        'width:0;height:0;' +
        'border-left:200px solid transparent;border-right:200px solid transparent;' +
        'border-top:70vh solid rgba(245,158,11,.15);' +
        'filter:blur(22px);' +
        'animation:ctx-flash-green 2.2s ease-out forwards';
      ov.appendChild(spot);

      var pickLbl = document.createElement('div');
      pickLbl.textContent = '🎯 PICK MADE';
      pickLbl.style.cssText =
        'position:absolute;top:36%;left:50%;' +
        'font-family:"Barlow Condensed",sans-serif;font-size:38px;font-weight:900;' +
        'color:#fbbf24;letter-spacing:5px;white-space:nowrap;' +
        'text-shadow:0 0 22px rgba(251,191,36,.85);' +
        'animation:ctx-float-up 1.8s 0.2s ease-out forwards';
      ov.appendChild(pickLbl);

      var GOLD = ['#fbbf24', '#f59e0b', '#fde68a', '#fef3c7'];
      for (var di = 0; di < 30; di++) {
        var dc = document.createElement('div');
        var dsz = 4 + Math.random() * 7;
        dc.style.cssText =
          'position:absolute;top:-12px;' +
          'left:' +
          (20 + Math.random() * 60) +
          '%;' +
          'width:' +
          dsz +
          'px;height:' +
          dsz +
          'px;' +
          'background:' +
          GOLD[di % GOLD.length] +
          ';border-radius:50%;' +
          'animation:ctx-confetti-fall ' +
          (1.1 + Math.random() * 1.0) +
          's ' +
          Math.random() * 0.8 +
          's ease-in forwards';
        ov.appendChild(dc);
      }
      setTimeout(function () {
        ov.innerHTML = '';
      }, 2700);
    }
  };

  /* ── Auto-trigger: win / loss after week results ─────────── */
  var _origRWR_anim = window.renderWeekResults;
  window.renderWeekResults = function (week) {
    if (typeof _origRWR_anim === 'function') _origRWR_anim(week);
    var tid =
      (document.getElementById('teamSelect') || {}).value || (typeof userTeamId !== 'undefined' ? userTeamId : null);
    if (!tid || !week || !week.games) return;
    week.games.forEach(function (g) {
      if (!g.played) return;
      if (g.homeTeamId !== tid && g.awayTeamId !== tid) return;
      var isHome = g.homeTeamId === tid;
      var mine = isHome ? g.homeScore : g.awayScore;
      var opp = isHome ? g.awayScore : g.homeScore;
      setTimeout(function () {
        window._ctxAnimate(mine > opp ? 'win' : mine < opp ? 'loss' : null);
      }, 280);
    });
  };
})();
