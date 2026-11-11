/* Slide-out navigation drawer: open/close via the menu button and overlay. */
(function () {
  const menuBtn = document.getElementById('menuBtn');
  const closeBtn = document.getElementById('drawerClose');
  const overlay = document.getElementById('overlay');
  const drawer = document.getElementById('sidebar');

  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    menuBtn.classList.add('open');
  }

  window.closeDrawer = function () {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    menuBtn.classList.remove('open');
  };

  menuBtn.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);
})();
