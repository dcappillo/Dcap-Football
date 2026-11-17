/* ============================================================
   SALARY CAP MANAGEMENT TOOLS + RESTRUCTURES
   ============================================================ */

/* ------------------------------------------------------------
   1. Render Cap Chart
------------------------------------------------------------ */

function renderCapChart() {
  const team = getTeamById(userTeamId);

  let html = `
    <h2>Salary Cap Overview</h2>

    <p><strong>Total Cap:</strong> $${team.salaryCap.toLocaleString()}</p>
    <p><strong>Cap Used:</strong> $${team.capUsed.toLocaleString()}</p>
    <p><strong>Cap Space:</strong> $${(team.salaryCap - team.capUsed).toLocaleString()}</p>

    <h3>Player Cap Hits</h3>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Pos</th>
          <th>Cap Hit</th>
          <th>Years Left</th>
          <th>Restructure</th>
        </tr>
      </thead>
      <tbody>
  `;

  team.roster.forEach((p) => {
    const hit = p.contract ? p.contract.capHitPerYear : 0;
    const years = p.contract ? p.contract.years : 0;

    html += `
      <tr>
        <td>${p.name}</td>
        <td>${p.positions[0]}</td>
        <td>$${hit.toLocaleString()}</td>
        <td>${years}</td>
        <td><button onclick="renderRestructureScreen('${p.id}')">Restructure</button></td>
      </tr>
    `;
  });

  html += `</tbody></table>`;

  setMainContent(html);
}

/* ------------------------------------------------------------
   2. Restructure Screen
------------------------------------------------------------ */

function renderRestructureScreen(playerId) {
  const team = getTeamById(userTeamId);
  const p = team.roster.find((x) => x.id === playerId);

  if (!p.contract) {
    alert('Cannot restructure a player without a contract.');
    return;
  }

  let html = `
    <h2>Restructure — ${p.name}</h2>
    <p class="small">Current cap hit: $${p.contract.capHitPerYear.toLocaleString()}</p>

    <label>Convert to Bonus:</label>
    <input id="bonusAmount" type="number" value="${Math.round(p.contract.capHitPerYear * 0.3)}" />

    <button onclick="applyRestructure('${p.id}')">Apply Restructure</button>
    <button onclick="renderCapChart()">Cancel</button>
  `;

  setMainContent(html);
}

/* ------------------------------------------------------------
   3. Apply Restructure
------------------------------------------------------------ */

function applyRestructure(playerId) {
  const team = getTeamById(userTeamId);
  const p = team.roster.find((x) => x.id === playerId);
  const bonus = parseInt($('bonusAmount').value);

  if (bonus <= 0 || bonus > p.contract.capHitPerYear * 0.5) {
    alert('Invalid bonus amount.');
    return;
  }

  const years = p.contract.years;

  // Reduce current cap hit
  p.contract.capHitPerYear -= bonus;

  // Spread bonus across remaining years
  const spread = Math.round(bonus / years);

  // Increase future cap hits
  p.contract.capHitPerYear += spread;

  // Apply immediate cap relief
  team.capUsed -= bonus;

  logTransaction('Restructure', `${p.name} restructured contract`, team.id, p);

  renderCapChart();
}
