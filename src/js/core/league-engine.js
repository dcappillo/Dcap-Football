/* ============================================================
   CORE JS: LEAGUE, ROSTERS, SCHEDULE, SIMULATION ENGINE
   ============================================================ */

const SALARY_CAP = 220_000_000;

const POSITIONS = [
  'QB',
  'RB',
  'TE',
  'WR',
  'T',
  'G',
  'C' /* OL split into specific roles */,
  'EDGE',
  'DT',
  'LB',
  'CB',
  'FS',
  'SS' /* S split into Free/Strong Safety */,
  'K',
  'P',
];

const TEAM_COLORS = [
  ['#003f5c', '#ffa600'],
  ['#2f4b7c', '#f95d6a'],
  ['#665191', '#ff7c43'],
  ['#a05195', '#d45087'],
  ['#d45087', '#2f4b7c'],
  ['#f95d6a', '#003f5c'],
  ['#ff7c43', '#665191'],
  ['#ffa600', '#a05195'],
];

const LEAGUE_TEMPLATE = {
  name: 'Gridiron Elite League',
  conferences: [
    {
      name: 'Atlantic Conference',
      divisions: [
        {
          name: 'Atlantic North',
          teams: [
            { city: 'Boston', nickname: 'Harpoons' },
            { city: 'New York', nickname: 'Empire' },
            { city: 'Buffalo', nickname: 'Blizzard' },
            { city: 'Toronto', nickname: 'Guardians' },
          ],
        },
        {
          name: 'Atlantic South',
          teams: [
            { city: 'Miami', nickname: 'Cyclones' },
            { city: 'Atlanta', nickname: 'Phoenix' },
            { city: 'Charlotte', nickname: 'Flight' },
            { city: 'Orlando', nickname: 'Storm' },
          ],
        },
        {
          name: 'Atlantic East',
          teams: [
            { city: 'Philadelphia', nickname: 'Liberty' },
            { city: 'Baltimore', nickname: 'Claws' },
            { city: 'Washington', nickname: 'Sentinels' },
            { city: 'Pittsburgh', nickname: 'Forge' },
          ],
        },
        {
          name: 'Atlantic West',
          teams: [
            { city: 'Cleveland', nickname: 'Lakes' },
            { city: 'Cincinnati', nickname: 'Queensmen' },
            { city: 'Detroit', nickname: 'Motors' },
            { city: 'Chicago', nickname: 'Wind' },
          ],
        },
      ],
    },
    {
      name: 'Pacific Conference',
      divisions: [
        {
          name: 'Pacific North',
          teams: [
            { city: 'Seattle', nickname: 'Sounders' },
            { city: 'Portland', nickname: 'Timberwolves' },
            { city: 'Vancouver', nickname: 'Mounties' },
            { city: 'San Francisco', nickname: 'Gold' },
          ],
        },
        {
          name: 'Pacific South',
          teams: [
            { city: 'Los Angeles', nickname: 'Stars' },
            { city: 'San Diego', nickname: 'Surge' },
            { city: 'Phoenix', nickname: 'Heatwave' },
            { city: 'Las Vegas', nickname: 'Mirage' },
          ],
        },
        {
          name: 'Pacific Central',
          teams: [
            { city: 'Denver', nickname: 'Altitude' },
            { city: 'Kansas City', nickname: 'Kings' },
            { city: 'Houston', nickname: 'Comets' },
            { city: 'Dallas', nickname: 'Outlaws' },
          ],
        },
        {
          name: 'Pacific East',
          teams: [
            { city: 'Minneapolis', nickname: 'Northern Lights' },
            { city: 'Green Bay', nickname: 'Glaciers' },
            { city: 'St. Louis', nickname: 'Archers' },
            { city: 'Nashville', nickname: 'Rhythm' },
          ],
        },
      ],
    },
  ],
};

let globalPlayerId = 1;

/* ------------------ Utility Functions ------------------ */

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function generateRandomName() {
  const first = [
    'Alex',
    'Jordan',
    'Chris',
    'Taylor',
    'Morgan',
    'Devin',
    'Riley',
    'Casey',
    'Jalen',
    'Malik',
    'Evan',
    'Noah',
    'Liam',
    'Mason',
    'Logan',
    'Caleb',
  ];
  const last = [
    'Johnson',
    'Smith',
    'Williams',
    'Brown',
    'Davis',
    'Miller',
    'Wilson',
    'Moore',
    'Taylor',
    'Anderson',
    'Thomas',
    'Jackson',
    'White',
    'Harris',
    'Martin',
    'Thompson',
  ];
  return randomChoice(first) + ' ' + randomChoice(last);
}

var ROOKIE_TARGET_MEAN = 64;
var ROOKIE_TARGET_SPREAD = 8.5;

function _generateAttrsGranular(pos, tier) {
  /* Normalise position to POS_BIAS key */
  /* Normalise to a POS_BIAS key — T/G/C now have their own entries */
  var biasKey =
    pos === 'FS' || pos === 'SS'
      ? 'S'
      : pos === 'MLB' || pos === 'ILB' || pos === 'OLB'
        ? 'LB'
        : pos === 'FB'
          ? 'RB'
          : pos === 'LT' || pos === 'RT'
            ? 'T'
            : pos === 'LG' || pos === 'RG'
              ? 'G'
              : pos === 'DL' || pos === 'DE'
                ? 'DT'
                : pos;
  var bias = window.POS_BIAS[biasKey] || window.POS_BIAS.LB;
  var labels = window.ATTR_LABELS;

  /* Pick a target OVR for this player tier */
  var targetOVR;
  if (tier === 'rookie') {
    /* Normal distribution around ROOKIE_TARGET_MEAN (std ROOKIE_TARGET_SPREAD). Rookies enter
       below the league average and grow toward their Potential; set higher,
       every draft class raised the league average (see tests/balance.test.js). */
    var u1 = Math.random(),
      u2 = Math.random();
    var z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
    targetOVR = Math.max(50, Math.min(96, Math.round(ROOKIE_TARGET_MEAN + z * ROOKIE_TARGET_SPREAD)));
  } else {
    /* Veterans: broad spread 60-95 */
    targetOVR = randomInt(60, 95);
  }

  /* Generate every granular attribute.
     Each attribute's mean is anchored to targetOVR, scaled by its
     position-bias value.  High-bias (primary) attrs sit close to
     targetOVR; low-bias (secondary) attrs fall off significantly.  */
  var g = {};
  Object.keys(labels).forEach(function (k) {
    var b = bias[k] !== undefined ? bias[k] : 0.15;
    var attrMean = 40 + (targetOVR - 40) * Math.max(b, 0.08);
    var spread = 8 * (1.1 - b * 0.75);
    var r1 = Math.random(),
      r2 = Math.random();
    var zz = Math.sqrt(-2 * Math.log(Math.max(r1, 1e-10))) * Math.cos(2 * Math.PI * r2);
    g[k] = Math.max(20, Math.min(99, Math.round(attrMean + zz * spread)));
  });

  /* OVR is derived from the position-weighted formula — not rolled directly */
  var overall = window.calcPosOVR(g, pos);
  overall = Math.max(40, Math.min(99, overall));

  /* Composite attributes are derived from the granular set */
  var comp = window.deriveComposites(g);

  return {
    attrs: {
      overall: overall,
      athleticism: comp.athleticism,
      intelligence: comp.intelligence,
      toughness: comp.toughness,
      discipline: comp.discipline,
    },
    granular: g,
  };
}

function generateAttributes(pos) {
  /* Full granular system — available after all scripts parse (always true at runtime) */
  if (window.POS_BIAS && window.ATTR_LABELS && window.deriveComposites && window.calcPosOVR) {
    var result = _generateAttrsGranular(pos, 'veteran');
    result.attrs._granularBag = result.granular; /* caller extracts and stores on player */
    return result.attrs;
  }
  /* Safety fallback (build-time / test-only — should never fire in the browser) */
  var overall = randomInt(60, 95);
  return {
    overall: overall,
    athleticism: randomInt(55, 90),
    intelligence: randomInt(55, 90),
    toughness: randomInt(55, 90),
    discipline: randomInt(55, 90),
  };
}

function generateContract(overall, playerAge) {
  /* ── "Under contract" salaries — NOT free-agent market value ──
     Most NFL players are signed below their market rate.
     Young players (rookie deals) pay 35-50% of market.
     Prime players pay 50-65%. Veterans 60-75%.
     This keeps teams comfortably under the $220M cap while
     free agents (calculateMarketValue) still command full price. */
  var age = playerAge || randomInt(21, 32); /* use real age when known */
  var fakePlayer = { attributes: { overall: overall }, age: age, positions: ['RB'] };
  var market = calculateMarketValue(fakePlayer).capHitPerYear;

  /* Percentage of market value depending on age (contract timing) */
  var pct;
  if (age <= 24) pct = 0.35 + Math.random() * 0.15; /* rookie deal */
  else if (age <= 28) pct = 0.5 + Math.random() * 0.15; /* second contract */
  else pct = 0.6 + Math.random() * 0.15; /* vet deal */

  var salary = Math.max(750000, Math.round(market * pct));

  /* Contract length */
  var years = 1;
  if (overall >= 85 && age <= 28) years = 4;
  else if (overall >= 80 && age <= 30) years = 3;
  else if (overall >= 72 && age <= 31) years = 2;

  return { years, totalValue: salary * years, capHitPerYear: salary };
}

function defaultPlayerStats() {
  return {
    gamesPlayed: 0,
    passingYards: 0,
    passingTD: 0,
    interceptionsThrown: 0,
    rushingYards: 0,
    rushingTD: 0,
    receivingYards: 0,
    receivingTD: 0,
    tackles: 0,
    sacks: 0,
    interceptions: 0,
    fieldGoalsMade: 0,
    fieldGoalsMissed: 0,
    xpMade: 0,
    xpMissed: 0,
  };
}

function defaultTeamStats() {
  return {
    totalOffenseYards: 0,
    totalDefenseYards: 0,
    turnoversForced: 0,
    turnoversCommitted: 0,
  };
}

/* ------------------ Player + Coach Generation ------------------ */

function generatePlayer(pos) {
  var attributes = generateAttributes(pos);
  var granularBag = attributes._granularBag || null;
  delete attributes._granularBag;
  var positions = pos ? [pos] : generatePositionsForPlayer();
  var age = randomInt(21, 34);
  var contract = generateContract(attributes.overall);
  var player = {
    id: globalPlayerId++,
    name: generateRandomName(),
    positions: positions,
    age: age,
    attributes: attributes,
    contract: contract,
    stats: defaultPlayerStats(),
  };
  if (granularBag) player.granularAttrs = granularBag;
  return player;
}

function generateCoach(teamCity) {
  return {
    name: teamCity + ' Head Coach',
    offenseRating: randomInt(60, 95),
    defenseRating: randomInt(60, 95),
    leadership: randomInt(60, 95),
  };
}

/* Starter slots: the positions that fill a starting lineup and their counts */
var STARTER_SLOTS = {
  QB: 1,
  RB: 1,
  WR: 3,
  TE: 1,
  T: 2,
  G: 2,
  C: 1 /* 11 offense */,
  EDGE: 2,
  DT: 2,
  LB: 3,
  CB: 3,
  FS: 1,
  SS: 1 /* 12 defense */,
  K: 1,
  P: 1 /* 2 ST = 26 total */,
};

function computeTeamPowerRating(team) {
  if (!team.roster || !team.roster.length) return 70;

  /* Build position groups sorted by depth rank (then OVR as tiebreak) */
  var byPos = {};
  team.roster.forEach(function (p) {
    var pos = p.positions[0];
    if (!byPos[pos]) byPos[pos] = [];
    byPos[pos].push(p);
  });
  Object.keys(byPos).forEach(function (pos) {
    byPos[pos].sort(function (a, b) {
      var ra = a.depthChartRank != null ? a.depthChartRank : 999;
      var rb = b.depthChartRank != null ? b.depthChartRank : 999;
      return ra !== rb ? ra - rb : b.attributes.overall - a.attributes.overall;
    });
  });

  /* Collect starter OVRs — skip injured/suspended players (use next healthy backup) */
  function _isOut(p) {
    return (p.injury && p.injury.weeksRemaining > 0) || (p.suspension && p.suspension.weeksRemaining > 0);
  }
  var starterOVRs = [];
  Object.keys(STARTER_SLOTS).forEach(function (pos) {
    var n = STARTER_SLOTS[pos];
    var group = (byPos[pos] || []).filter(function (p) {
      return !_isOut(p);
    });
    for (var i = 0; i < n; i++) {
      if (group[i]) starterOVRs.push(group[i].attributes.overall);
      else starterOVRs.push(60); /* empty slot penalty */
    }
  });

  if (!starterOVRs.length) return 70;

  /* Mean OVR of all 26 starters */
  var starterMean =
    starterOVRs.reduce(function (s, v) {
      return s + v;
    }, 0) / starterOVRs.length;

  /* ── Coaching modifier ────────────────────────────────────
     Three coaching layers, each relative to league-average 70.
     HC leadership: motivates all 26 starters               (+/- 2 max)
     OC off rating: amplifies the 11 offensive starters     (+/- 1.5 max)
     DC def rating: amplifies the 12 defensive starters     (+/- 1.5 max)
     Total coaching swing: roughly -5 to +5                             */
  var hcLead = team.coach ? team.coach.leadership || 70 : 70;
  var ocOff = team.oc ? team.oc.offenseRating || 70 : 70;
  var dcDef = team.dc ? team.dc.defenseRating || 70 : 70;

  var leadershipMod = (hcLead - 70) / 15; /* each 15 pts above avg = +1  */
  var ocMod = (ocOff - 70) / 20; /* each 20 pts above avg = +1  */
  var dcMod = (dcDef - 70) / 20;

  var coachMod = leadershipMod + ocMod + dcMod;

  return Math.round(starterMean + coachMod);
}

/* ------------------ League Creation ------------------ */

function buildLeague() {
  let colorIndex = 0;

  const conferences = LEAGUE_TEMPLATE.conferences.map((confTemplate) => {
    const divisions = confTemplate.divisions.map((divTemplate) => {
      const teams = divTemplate.teams.map((teamTemplate) => {
        const colors = TEAM_COLORS[colorIndex % TEAM_COLORS.length];
        colorIndex++;

        const team = {
          id: (teamTemplate.city + '-' + teamTemplate.nickname).replace(/\s+/g, '_'),
          city: teamTemplate.city,
          nickname: teamTemplate.nickname,
          primaryColor: colors[0],
          secondaryColor: colors[1],
          conference: confTemplate.name,
          division: divTemplate.name,
          coach: generateCoach(teamTemplate.city),
          roster: [],
          salaryCap: SALARY_CAP,
          capUsed: 0,
          powerRating: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          teamStats: defaultTeamStats(),
        };

        for (let i = 0; i < 55; i++) {
          const player = generatePlayer();
          team.roster.push(player);
          team.capUsed += player.contract.capHitPerYear;
        }

        team.powerRating = computeTeamPowerRating(team);

        return team;
      });

      return { name: divTemplate.name, teams };
    });

    return { name: confTemplate.name, divisions };
  });

  return { name: LEAGUE_TEMPLATE.name, conferences };
}

/* ------------------ Schedule Generation ------------------ */

function listAllTeams(league) {
  const arr = [];
  league.conferences.forEach((conf) => {
    conf.divisions.forEach((div) => {
      div.teams.forEach((team) => arr.push(team));
    });
  });
  return arr;
}

function generateSchedule(league) {
  const teams = listAllTeams(league);
  const weeks = [];
  const NUM_WEEKS = 17;

  for (let w = 1; w <= NUM_WEEKS; w++) {
    const shuffled = [...teams];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const games = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      games.push({
        homeTeamId: shuffled[i].id,
        awayTeamId: shuffled[i + 1].id,
        homeScore: null,
        awayScore: null,
        played: false,
      });
    }

    weeks.push({ weekNumber: w, games });
  }

  return weeks;
}

function buildTeamMap(league) {
  const map = {};
  league.conferences.forEach((conf) =>
    conf.divisions.forEach((div) =>
      div.teams.forEach((team) => {
        map[team.id] = team;
      }),
    ),
  );
  return map;
}

/* ------------------ Strategy System ------------------ */

function applyStrategyModifier(base, strat, team) {
  var mod = 0;
  var offStyle = strat.offensiveStyle || strat.offStyle || 'Balanced';
  var defStyle = strat.defensiveStyle || strat.defStyle || 'Balanced';
  var offPB = strat.offPlaybook || strat.offensivePlaybook || 'Balanced';
  var defPB = strat.defPlaybook || strat.defensivePlaybook || '4-3';

  /* Offensive style modifier */
  if (offStyle === 'Run Heavy') mod += 1;
  if (offStyle === 'Pass Heavy') mod += 1;

  /* Defensive style modifier */
  if (defStyle === 'Blitz Heavy') mod += 2;
  if (defStyle === 'Defend Run') mod += 1;
  if (defStyle === 'Defend Pass') mod += 1;

  /* Scheme match bonus — if playbook matches coordinator's scheme,
     the coordinator's expertise is fully utilized (+2 each side).
     Mismatching means running a scheme the coordinator isn't built for. */
  if (team) {
    var oc = team.oc || {};
    var dc = team.dc || {};
    if (oc.scheme && offPB === oc.scheme) mod += 2;
    if (dc.scheme && defPB === dc.scheme) mod += 2;
    /* Mismatch penalty: running opposite of what your coordinator knows */
    if (oc.scheme && offPB !== oc.scheme) mod -= 1;
    if (dc.scheme && defPB !== dc.scheme) mod -= 1;
  }

  return base + mod;
}

/* ── Game totals generator ──────────────────────────────────
   Generates realistic per-team offensive output scaled by the
   team's strength relative to the league average (75 OVR).
   Returns a totals object that BOTH the score derivation and
   the player stat distribution use — guaranteeing consistency.

   NFL calibration targets (per game):
     Pass yards:  ~240   Rush yards: ~110
     Pass TDs:    ~1.8   Rush TDs:   ~0.7
     FG made:     ~1.6   Turnovers:  ~1.2
     INT thrown:  ~0.8   Sacks:      ~2.5
     Tackles:     ~55    Def INTs:   ~0.6              */
function generateGameTotals(team, strengthMult, oppStrengthMult) {
  /* strengthMult > 1 = better team, < 1 = weaker team
     oppStrengthMult used for defensive adjustments       */
  var sm = Math.max(0.6, Math.min(1.5, strengthMult || 1.0));
  var osm = Math.max(0.6, Math.min(1.5, oppStrengthMult || 1.0));

  /* Offensive style biases the pass/run split */
  var offStyle = team._offStyle || 'Balanced';
  var passBias = offStyle === 'Pass Heavy' ? 1.2 : offStyle === 'Run Heavy' ? 0.8 : 1.0;
  var runBias = offStyle === 'Run Heavy' ? 1.2 : offStyle === 'Pass Heavy' ? 0.8 : 1.0;

  /* Defensive strength of opponent reduces our output */
  var defMult = 2.0 - osm; /* opp stronger → we get less */

  /* ── Yards ──────────────────────────────────────────── */
  var basePassYds = 255,
    baseRushYds = 130;
  var passYds = Math.round((basePassYds + randomInt(-50, 65)) * sm * passBias * defMult);
  var rushYds = Math.round((baseRushYds + randomInt(-40, 70)) * sm * runBias * defMult);
  passYds = Math.max(60, passYds);
  rushYds = Math.max(15, rushYds);

  /* ── Touchdowns — Poisson-like: base rate × multipliers ─ */
  var passTDRate = 1.8 * sm * passBias * defMult;
  var rushTDRate = 0.7 * sm * runBias * defMult;

  var passTDs = poissonSample(passTDRate);
  var rushTDs = poissonSample(rushTDRate);

  /* Cap at realistic maximums */
  passTDs = Math.min(passTDs, 6);
  rushTDs = Math.min(rushTDs, 4);

  /* ── Field goals ────────────────────────────────────── */
  /* More FGs when drives stall (lower TD rate = more FG opps) */
  var fgRate = Math.max(0.5, 1.6 - (passTDs + rushTDs) * 0.15);
  var fgAtt = poissonSample(fgRate * 1.3);
  var fgMade = 0;
  for (var i = 0; i < fgAtt; i++) {
    if (Math.random() < 0.83) fgMade++; /* ~83% NFL avg FG% */
  }
  fgAtt = Math.min(fgAtt, 6);
  fgMade = Math.min(fgMade, fgAtt);

  /* ── Extra Points (PAT) — one attempt per TD, ~95% success ── */
  var totalTDs = passTDs + rushTDs;
  var xpMade = 0;
  for (i = 0; i < totalTDs; i++) {
    if (Math.random() < 0.945) xpMade++; /* ~94.5% NFL avg XP% */
  }
  var xpAtt = totalTDs;
  var xpMissed = xpAtt - xpMade;

  /* ── Turnovers ──────────────────────────────────────── */
  var intThrown = poissonSample(0.8 * (2.0 - sm) * osm);
  var fumbles = Math.random() < 0.25 ? 1 : 0;
  intThrown = Math.min(intThrown, 4);

  /* ── Defense stats ──────────────────────────────────── */
  var teamSacks = poissonSample(2.5 * osm * (2.0 - sm));
  var defInts = poissonSample(0.6 * osm);
  var teamTackles = 38 + randomInt(-8, 12); /* flat — game pace, not offensive strength */
  teamSacks = Math.min(teamSacks, 8);
  defInts = Math.min(defInts, 4);
  teamTackles = Math.max(22, Math.min(55, teamTackles));

  return {
    passYds,
    rushYds,
    passTDs,
    rushTDs,
    fgMade,
    fgAtt,
    xpMade,
    xpAtt,
    xpMissed,
    intThrown,
    fumbles,
    teamSacks,
    defInts,
    teamTackles,
    turnoversCommitted: intThrown + fumbles,
  };
}

/* Simple Poisson sampler — gives realistic TD/FG variance */
function poissonSample(lambda) {
  if (lambda <= 0) return 0;
  var L = Math.exp(-lambda),
    k = 0,
    p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

/* Score derived from stats — the ONLY place score is computed */
function scoreFromTotals(totals) {
  return (
    totals.passTDs * 6 /* TD = 6 pts */ +
    totals.rushTDs * 6 +
    (totals.xpMade || 0) * 1 /* PAT = 1 pt each */ +
    totals.fgMade * 3
  );
}

function simulateGame(game, teamMap, userStrategy, userTeamId) {
  const home = teamMap[game.homeTeamId];
  const away = teamMap[game.awayTeamId];

  /* Recompute live from current starters — reflects trades,
     injuries, and OVR changes since last rebuild             */
  home.powerRating = computeTeamPowerRating(home);
  away.powerRating = computeTeamPowerRating(away);

  let homeRating = home.powerRating;
  let awayRating = away.powerRating;

  const randomStrategy = (team) => {
    var oc = team && team.oc ? team.oc.scheme : 'West Coast';
    var dc = team && team.dc ? team.dc.scheme : '4-3';
    return {
      offPlaybook: oc,
      offensiveStyle: randomChoice(['Run Heavy', 'Balanced', 'Pass Heavy']),
      defPlaybook: dc,
      defensiveStyle: randomChoice(['Defend Run', 'Balanced', 'Defend Pass', 'Blitz Heavy']),
    };
  };

  const homeStrat = home.id === userTeamId ? userStrategy : randomStrategy(home);
  const awayStrat = away.id === userTeamId ? userStrategy : randomStrategy(away);

  home._defStyle = homeStrat.defensiveStyle || 'Balanced';
  away._defStyle = awayStrat.defensiveStyle || 'Balanced';
  home._offStyle = homeStrat.offensiveStyle || 'Balanced';
  away._offStyle = awayStrat.offensiveStyle || 'Balanced';

  homeRating = applyStrategyModifier(homeRating, homeStrat, home);
  awayRating = applyStrategyModifier(awayRating, awayStrat, away);

  /* Strength multipliers relative to league average (75) */
  const homeMult = homeRating / 75;
  const awayMult = awayRating / 75;

  /* Generate game totals — stats and score derived from same numbers */
  const homeTotals = generateGameTotals(home, homeMult, awayMult);
  const awayTotals = generateGameTotals(away, awayMult, homeMult);

  /* Home field advantage: ~3% scoring boost */
  const homeBonus = Math.random() < 0.55 ? 0 : 3;

  const homeScore = Math.max(0, scoreFromTotals(homeTotals) + homeBonus);
  const awayScore = Math.max(0, scoreFromTotals(awayTotals));

  game.homeScore = homeScore;
  game.awayScore = awayScore;
  game.played = true;

  /* Store totals on game for box score access later */
  game.homeTotals = homeTotals;
  game.awayTotals = awayTotals;

  /* ── Snapshot player stats BEFORE distribution ─────────── */
  var _statKeys = [
    'passingYards',
    'passingTD',
    'interceptionsThrown',
    'rushingYards',
    'rushingTD',
    'receivingYards',
    'receivingTD',
    'tackles',
    'sacks',
    'interceptions',
    'gamesPlayed',
    'fieldGoalsMade',
    'fieldGoalsMissed',
    'xpMade',
    'xpMissed',
  ];
  function _snapTeam(team) {
    var snap = {};
    team.roster.forEach(function (p) {
      snap[p.id] = {};
      _statKeys.forEach(function (k) {
        snap[p.id][k] = p.stats[k] || 0;
      });
    });
    return snap;
  }
  var _homeSnap = _snapTeam(home);
  var _awaySnap = _snapTeam(away);

  home.pointsFor += homeScore;
  home.pointsAgainst += awayScore;
  away.pointsFor += awayScore;
  away.pointsAgainst += homeScore;

  home.teamStats.totalOffenseYards += homeTotals.passYds + homeTotals.rushYds;
  home.teamStats.totalDefenseYards += awayTotals.passYds + awayTotals.rushYds;
  home.teamStats.turnoversForced += awayTotals.turnoversCommitted;
  home.teamStats.turnoversCommitted += homeTotals.turnoversCommitted;

  away.teamStats.totalOffenseYards += awayTotals.passYds + awayTotals.rushYds;
  away.teamStats.totalDefenseYards += homeTotals.passYds + homeTotals.rushYds;
  away.teamStats.turnoversForced += homeTotals.turnoversCommitted;
  away.teamStats.turnoversCommitted += awayTotals.turnoversCommitted;

  if (homeScore > awayScore) {
    home.wins++;
    away.losses++;
  } else if (awayScore > homeScore) {
    away.wins++;
    home.losses++;
  } else {
    home.ties++;
    away.ties++;
  }
  recordMoraleAndChemistry(home, away, homeScore, awayScore);

  /* Distribute totals to individual players */
  distributeStatsToPlayers(home, homeTotals, awayTotals);
  distributeStatsToPlayers(away, awayTotals, homeTotals);

  /* ── Compute per-game deltas and store on game object ────── */
  /* Is this player actually playing this game? */
  function _isPlayingThisGame(p) {
    return !((p.injury && p.injury.weeksRemaining > 0) || (p.suspension && p.suspension.weeksRemaining > 0));
  }

  function _buildGameStats(team, snap) {
    var result = {};
    team.roster.forEach(function (p) {
      var pre = snap[p.id] || {};
      var delta = {};
      _statKeys.forEach(function (k) {
        delta[k] = (p.stats[k] || 0) - (pre[k] || 0);
      });

      /* Injured/suspended players: undo any stats they received and show 0 */
      if (!_isPlayingThisGame(p)) {
        _statKeys.forEach(function (k) {
          if (delta[k]) {
            p.stats[k] = (p.stats[k] || 0) - delta[k]; /* reverse accumulation */
            delta[k] = 0;
          }
        });
        return; /* don't include in box score */
      }

      var hasActivity = _statKeys.some(function (k) {
        return delta[k] > 0;
      });
      if (hasActivity) {
        result[p.id] = {
          name: p.name,
          pos: p.positions[0],
          ovr: p.attributes ? p.attributes.overall : 70,
          stats: delta,
        };
      }
    });
    return result;
  }
  game.homePlayerStats = _buildGameStats(home, _homeSnap);
  game.awayPlayerStats = _buildGameStats(away, _awaySnap);
}

function simulateWeek(week, teamMap, userStrategy, userTeamId) {
  week.games.forEach((g) => {
    if (!g.played) simulateGame(g, teamMap, userStrategy, userTeamId);
  });
}

/* ------------------ Global State ------------------ */

let league = null;
let schedule = null;
let currentWeekIndex = 0;
let teamMap = null;
let userTeamId = null;

/* ------------------ UI Helpers ------------------ */

function $(id) {
  return document.getElementById(id);
}

function setMainContent(html) {
  $('main').innerHTML = html;
}

function getTeamById(id) {
  return teamMap[id] || null;
}

function updateWeekLabel() {
  const label = $('currentWeekLabel');
  const weekNumber = currentWeekIndex + 1;
  if (weekNumber <= schedule.length) {
    label.textContent = `Current Week: ${weekNumber} of ${schedule.length}`;
  } else {
    label.textContent = `Regular season complete`;
  }
}

/* ------------------ Team Select Rendering ------------------ */

function renderTeamSelect() {
  const select = $('teamSelect');
  select.innerHTML = '';

  const allTeams = listAllTeams(league);
  allTeams.forEach((team) => {
    const opt = document.createElement('option');
    opt.value = team.id;
    opt.textContent = `${team.city} ${team.nickname}`;
    select.appendChild(opt);
  });

  if (allTeams.length > 0) {
    /* Preserve an already-chosen team (set via New Game flow) */
    var chosen =
      userTeamId &&
      allTeams.find(function (t) {
        return t.id === userTeamId;
      });
    if (!chosen) {
      userTeamId = allTeams[0].id;
    }
    select.value = userTeamId;
  }
}

/* ------------------ INIT ------------------ */

function initPhase4Core() {
  league = buildLeague();
  schedule = generateSchedule(league);
  teamMap = buildTeamMap(league);
  currentWeekIndex = 0;

  $('seasonInfo').textContent = league.name + ' • Season 1';
  renderTeamSelect();
  updateWeekLabel();
}

window.addEventListener('DOMContentLoaded', initPhase4Core);
