/* ============================================================
   SORTABLE TABLES
   Patches setMainContent so every table rendered anywhere in
   the app gets clickable column headers with ↑ / ↓ indicators.
   ============================================================ */
(function () {
  function cellValue(cell) {
    if (!cell) return '';
    /* Skip cells that contain only a button — those are action columns */
    var text = cell.textContent.trim();
    if (!text || cell.querySelector('button')) return null; // null = unsortable

    /* Record strings like "5-3-0" → sort by wins (first number) */
    var recMatch = text.match(/^(\d+)-(\d+)/);
    if (recMatch) return parseInt(recMatch[1], 10) * 1000 - parseInt(recMatch[2], 10);

    /* Strip $, commas, %, "/ yr", letters after digits */
    var numeric = parseFloat(
      text
        .replace(/[$,%]/g, '')
        .replace(/[^\d.-]/g, ' ')
        .trim()
        .split(' ')[0],
    );
    if (!isNaN(numeric)) return numeric;

    return text.toLowerCase(); /* fall back to string */
  }

  function makeTablesSortable() {
    var main = document.getElementById('main');
    if (!main) return;

    main.querySelectorAll('table').forEach(function (table) {
      var ths = table.querySelectorAll('thead th');
      if (!ths.length) return;

      /* Avoid double-binding */
      if (table.dataset.sortable) return;
      table.dataset.sortable = '1';

      var sortCol = -1,
        sortDir = 1; /* 1 = asc, -1 = desc */

      ths.forEach(function (th, ci) {
        /* Peek at first data row to decide if column is sortable */
        var firstRow = table.querySelector('tbody tr');
        var firstCell = firstRow ? firstRow.cells[ci] : null;
        if (firstCell && firstCell.querySelector('button')) return; /* skip action cols */

        th.classList.add('th-sort');

        /* Indicator span */
        var icon = document.createElement('span');
        icon.className = 'sort-icon';
        icon.textContent = '⇅';
        th.appendChild(icon);

        th.addEventListener('click', function () {
          if (sortCol === ci) {
            sortDir *= -1;
          } else {
            sortCol = ci;
            sortDir = 1; /* always start descending-first for numeric makes more sense */
            /* Actually start with desc for numbers (highest first), asc for text */
            var sampleVal = firstCell ? cellValue(firstCell) : '';
            sortDir = typeof sampleVal === 'number' ? -1 : 1;
          }

          /* Update all icons */
          ths.forEach(function (h, i) {
            var ic = h.querySelector('.sort-icon');
            if (!ic) return;
            if (i === ci) {
              ic.textContent = sortDir === 1 ? '↑' : '↓';
              ic.classList.add('active');
            } else {
              ic.textContent = '⇅';
              ic.classList.remove('active');
            }
          });

          /* Sort rows */
          var tbody = table.querySelector('tbody');
          if (!tbody) return;
          var rows = Array.from(tbody.querySelectorAll('tr'));

          rows.sort(function (a, b) {
            var av = cellValue(a.cells[ci]);
            var bv = cellValue(b.cells[ci]);
            if (av === null || bv === null) return 0;
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
            if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * sortDir;
            return 0;
          });

          rows.forEach(function (r) {
            tbody.appendChild(r);
          });
        });
      });
    });
  }

  /* Patch setMainContent to call makeTablesSortable after each render */
  var _prev = window.setMainContent;
  window.setMainContent = function (html) {
    _prev(html);
    /* Small delay so the DOM has settled */
    setTimeout(makeTablesSortable, 0);
  };
})();
