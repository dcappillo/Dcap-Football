/* ── Global fitBadge — scheme fit symbol for roster screen ── */
window.fitBadge = function (p, team) {
  /* If team not passed, try to get the active team */
  if (!team) {
    var tid = document.getElementById('teamSelect') && document.getElementById('teamSelect').value;
    team = tid && typeof getTeamById === 'function' ? getTeamById(tid) : null;
  }
  if (!team || typeof calculateSchemeFit !== 'function') return '';
  var score = calculateSchemeFit(p, team);
  var color = score >= 65 ? '#4ade80' : score < 45 ? '#f87171' : '#64748b';
  var label = score >= 65 ? 'Scheme fit' : score < 45 ? 'Poor fit' : 'Neutral fit';
  return (
    '<span title="' +
    label +
    ': ' +
    score +
    '" style="font-size:11px;' +
    'font-weight:700;color:' +
    color +
    ';margin-left:4px;cursor:default">✦</span>'
  );
};
