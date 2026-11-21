/* ============================================================
   AWARDS LOGIC (NEW)
   ============================================================ */

/* ------------------------------------------------------------
   Helper: Collect all players in the league
------------------------------------------------------------ */
function getAllPlayers() {
  const players = [];
  league.conferences.forEach((conf) =>
    conf.divisions.forEach((div) =>
      div.teams.forEach((team) => team.roster.forEach((player) => players.push({ team, player }))),
    ),
  );
  return players;
}

/* ------------------------------------------------------------
   Helper: Award Scoring Formula
   (Used for MVP, Conference MVP, All‑Pro, etc.)
------------------------------------------------------------ */
function awardScore(p) {
  const s = p.stats;
  return (
    s.passingYards * 0.05 +
    s.passingTD * 6 +
    s.interceptionsThrown * -3 +
    s.rushingYards * 0.1 +
    s.rushingTD * 6 +
    s.receivingYards * 0.1 +
    s.receivingTD * 6 +
    s.tackles * 1 +
    s.sacks * 3 +
    s.interceptions * 4 +
    s.fieldGoalsMade * 3 +
    s.fieldGoalsMissed * -1 +
    (s.xpMade || 0) * 1 +
    (s.xpMissed || 0) * -0.5
  );
}

/* ------------------------------------------------------------
   LEAGUE MVP
------------------------------------------------------------ */
function calculateLeagueMVP() {
  const all = getAllPlayers();
  let best = null;
  let bestScore = -Infinity;

  all.forEach((entry) => {
    const score = awardScore(entry.player);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  });

  return {
    player: best.player,
    team: best.team,
    score: bestScore,
  };
}

/* ------------------------------------------------------------
   CONFERENCE MVPs
------------------------------------------------------------ */
function calculateConferenceMVPs() {
  const results = {};

  league.conferences.forEach((conf) => {
    let best = null;
    let bestScore = -Infinity;

    conf.divisions.forEach((div) =>
      div.teams.forEach((team) =>
        team.roster.forEach((player) => {
          const score = awardScore(player);
          if (score > bestScore) {
            bestScore = score;
            best = { team, player };
          }
        }),
      ),
    );

    results[conf.name] = {
      player: best.player,
      team: best.team,
      score: bestScore,
    };
  });

  return results;
}

/* ------------------------------------------------------------
   ROOKIE OF THE YEAR (per conference)
------------------------------------------------------------ */
function calculateRookieOfYear() {
  const results = {};

  league.conferences.forEach((conf) => {
    let best = null;
    let bestScore = -Infinity;

    conf.divisions.forEach((div) =>
      div.teams.forEach((team) =>
        team.roster.forEach((player) => {
          if (!player.isRookie) return;
          const score = awardScore(player);
          if (score > bestScore) {
            bestScore = score;
            best = { team, player };
          }
        }),
      ),
    );

    results[conf.name] = best ? { player: best.player, team: best.team, score: bestScore } : null;
  });

  return results;
}

/* ------------------------------------------------------------
   ALL‑PRO TEAM (Top player at each position)
------------------------------------------------------------ */
function calculateAllProTeam() {
  const all = getAllPlayers();
  const bestByPos = {};

  POSITIONS.forEach((pos) => {
    bestByPos[pos] = null;
  });

  all.forEach((entry) => {
    entry.player.positions.forEach((pos) => {
      if (!bestByPos[pos]) bestByPos[pos] = null; /* init any unlisted position */
      const score = awardScore(entry.player);
      if (!bestByPos[pos] || score > awardScore(bestByPos[pos].player)) {
        bestByPos[pos] = entry;
      }
    });
  });

  return bestByPos;
}

/* ------------------------------------------------------------
   PRO BOWL (Top 2 players per position)
------------------------------------------------------------ */
function calculateProBowl() {
  const all = getAllPlayers();
  const buckets = {};

  POSITIONS.forEach((pos) => {
    buckets[pos] = [];
  });

  all.forEach((entry) => {
    entry.player.positions.forEach((pos) => {
      if (!buckets[pos]) buckets[pos] = []; /* handles any unlisted position */
      buckets[pos].push(entry);
    });
  });

  const results = {};

  POSITIONS.forEach((pos) => {
    const sorted = buckets[pos].slice().sort((a, b) => awardScore(b.player) - awardScore(a.player));

    results[pos] = sorted.slice(0, 2); // Top 2
  });

  return results;
}

/* ------------------------------------------------------------
   MASTER AWARDS FUNCTION
------------------------------------------------------------ */
function calculateAllAwards() {
  return {
    leagueMVP: calculateLeagueMVP(),
    conferenceMVPs: calculateConferenceMVPs(),
    rookies: calculateRookieOfYear(),
    allPro: calculateAllProTeam(),
    proBowl: calculateProBowl(),
  };
}
