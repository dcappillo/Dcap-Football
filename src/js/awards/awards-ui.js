/* ============================================================
   AWARDS UI + BUTTON WIRING + RENDERING
   ============================================================ */

/* ------------------ Award Criteria Screen ------------------ */

function renderAwardCriteria() {
  let html = `
    <h2>Award Criteria</h2>
    <p class="small">Awards are based on a weighted scoring formula using season stats.</p>

    <h3>Scoring Formula</h3>
    <ul>
      <li>Passing Yards × 0.05</li>
      <li>Passing TD × 6</li>
      <li>Interceptions Thrown × -3</li>
      <li>Rushing Yards × 0.1</li>
      <li>Rushing TD × 6</li>
      <li>Receiving Yards × 0.1</li>
      <li>Receiving TD × 6</li>
      <li>Tackles × 1</li>
      <li>Sacks × 3</li>
      <li>Interceptions × 4</li>
      <li>Field Goals Made × 3</li>
      <li>Field Goals Missed × -1</li>
    </ul>

    <h3>Awards</h3>
    <ul>
      <li><strong>League MVP</strong> — Highest score in the entire league</li>
      <li><strong>Conference MVPs</strong> — Highest score in each conference</li>
      <li><strong>Rookie of the Year</strong> — Best rookie in each conference</li>
      <li><strong>All‑Pro Team</strong> — Best player at each position</li>
      <li><strong>Pro Bowl</strong> — Top 2 players at each position</li>
    </ul>
  `;

  setMainContent(html);
}

/* ------------------ Awards Rendering ------------------ */

function renderAwards() {
  const awards = calculateAllAwards();

  let html = `<h2>Award Winners</h2>`;

  /* ------------------ League MVP ------------------ */
  const mvp = awards.leagueMVP;
  html += `
    <h3>League MVP</h3>
    <p><strong>${mvp.player.name}</strong> — ${mvp.team.city} ${mvp.team.nickname}
    <span class="small">(Score: ${mvp.score.toFixed(1)})</span></p>
  `;

  /* ------------------ Conference MVPs ------------------ */
  html += `<h3>Conference MVPs</h3>`;
  for (const conf in awards.conferenceMVPs) {
    const entry = awards.conferenceMVPs[conf];
    html += `
      <p><strong>${conf}:</strong> ${entry.player.name} — ${entry.team.city} ${entry.team.nickname}
      <span class="small">(Score: ${entry.score.toFixed(1)})</span></p>
    `;
  }

  /* ------------------ Rookie of the Year ------------------ */
  html += `<h3>Rookie of the Year</h3>`;
  for (const conf in awards.rookies) {
    const entry = awards.rookies[conf];
    if (!entry) {
      html += `<p><strong>${conf}:</strong> No rookies qualified.</p>`;
      continue;
    }
    html += `
      <p><strong>${conf}:</strong> ${entry.player.name} — ${entry.team.city} ${entry.team.nickname}
      <span class="small">(Score: ${entry.score.toFixed(1)})</span></p>
    `;
  }

  /* ------------------ All‑Pro Team ------------------ */
  html += `<h3>All‑Pro Team</h3>`;
  html += `<table>
    <thead>
      <tr>
        <th>Position</th>
        <th>Player</th>
        <th>Team</th>
      </tr>
    </thead>
    <tbody>
  `;

  for (const pos of POSITIONS) {
    const entry = awards.allPro[pos];
    if (!entry) continue;
    html += `
      <tr>
        <td>${pos}</td>
        <td>${entry.player.name}</td>
        <td>${entry.team.city} ${entry.team.nickname}</td>
      </tr>
    `;
  }

  html += `</tbody></table>`;

  /* ------------------ Pro Bowl ------------------ */
  html += `<h3>Pro Bowl Selections</h3>`;
  html += `<table>
    <thead>
      <tr>
        <th>Position</th>
        <th>Player 1</th>
        <th>Player 2</th>
      </tr>
    </thead>
    <tbody>
  `;

  for (const pos of POSITIONS) {
    const list = awards.proBowl[pos];
    const p1 = list[0];
    const p2 = list[1];

    html += `
      <tr>
        <td>${pos}</td>
        <td>${p1.player.name} (${p1.team.city})</td>
        <td>${p2 ? p2.player.name + ' (' + p2.team.city + ')' : '—'}</td>
      </tr>
    `;
  }

  html += `</tbody></table>`;

  setMainContent(html);
}

/* ------------------ Button Wiring ------------------ */

window.addEventListener('DOMContentLoaded', () => {
  $('btnAwards').addEventListener('click', () => {
    renderAwards();
  });

  $('btnAwardCriteria').addEventListener('click', () => {
    renderAwardCriteria();
  });

  /* Existing buttons from earlier phases */
  $('btnViewRoster').addEventListener('click', renderRoster);
  $('btnViewLeague').addEventListener('click', renderLeagueOverview);
  $('btnViewStandings').addEventListener('click', renderStandings);
  $('btnPlayerStats').addEventListener('click', renderPlayerStats);
  $('btnTeamStats').addEventListener('click', renderTeamStats);
  $('btnLeagueLeaders').addEventListener('click', renderLeagueLeaders);
});
