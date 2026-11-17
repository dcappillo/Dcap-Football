/* ============================================================
   HOME BUTTON
   Captures the landing screen on load, exposes renderHome(),
   and injects a slim breadcrumb bar on every setMainContent page.
   ============================================================ */
(function () {
  var _homeHTML = null;

  /* Capture the landing screen once the DOM is ready */
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var main = document.getElementById('main');
      if (main) _homeHTML = main.innerHTML;
    }, 50);
  });

  /* Restore the landing screen */
  window.renderHome = function () {
    var main = document.getElementById('main');
    if (!main) return;
    if (_homeHTML) {
      main.innerHTML = _homeHTML;
      main.scrollTop = 0;
    }
    /* Re-sync the sim button label in case season ended */
    if (typeof syncSimButton === 'function') syncSimButton();
    /* syncBtn is the internal name used in patch 2 — try both */
    setTimeout(function () {
      var btn = document.getElementById('btnSimWeek');
      if (!btn) return;
      if (typeof schedule !== 'undefined' && typeof currentWeekIndex !== 'undefined') {
        var done = schedule && currentWeekIndex >= schedule.length;
        if (done) {
          btn.textContent = '🏆 Begin Offseason →';
          btn.style.cssText = 'background:var(--gold);border-color:var(--gold);color:#000;font-weight:700';
        }
      }
    }, 60);
  };

  /* Build the slim home breadcrumb injected at top of every page */
  function homeBar() {
    return (
      '<div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">' +
      '<button class="home-nav-btn" onclick="renderHome()">⌂ Home</button>' +
      '</div>'
    );
  }

  /* Patch setMainContent — wrap the chain that already exists.
     This runs LAST so our home bar is the very first thing rendered. */
  var _prevSMC = window.setMainContent;
  window.setMainContent = function (html) {
    /* Don't prepend the bar to the home screen itself */
    var isHome = html && (html.indexOf('welcome-hero') !== -1 || html.indexOf('quick-grid') !== -1);
    _prevSMC(isHome ? html : homeBar() + html);
  };
})();
