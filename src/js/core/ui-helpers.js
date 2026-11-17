/**
 * Colour used for an overall (OVR) rating everywhere in the UI.
 * @param {number} v Overall rating
 * @returns {string} CSS colour
 */
function ovrColor(v) {
  return v >= 90
    ? '#c084fc'
    : v >= 85
      ? '#60a5fa'
      : v >= 80
        ? '#4ade80'
        : v >= 75
          ? '#facc15'
          : v >= 70
            ? '#94a3b8'
            : '#f87171';
}
