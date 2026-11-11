/* Wrap every rendered table so it scrolls horizontally on small screens. */
(function () {
  var _orig = window.setMainContent;
  window.setMainContent = function (html) {
    // Wrap bare tables for horizontal scroll on mobile
    html = html.replace(/<table(?=[^>]*>)/g, '<div class="table-wrap"><table').replace(/<\/table>/g, '</table></div>');
    _orig(html);
    closeDrawer();
    var m = document.getElementById('main');
    if (m) m.scrollTop = 0;
  };
})();
