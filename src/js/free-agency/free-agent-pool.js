/* ============================================================
   FREE AGENT POOL GENERATOR + UI
   ============================================================ */

/* ------------------------------------------------------------
   GLOBAL FREE AGENT POOL
------------------------------------------------------------ */

let freeAgents = [];

/* ------------------------------------------------------------
   Generate Free Agent Market
   - Undrafted rookies
   - Released veterans
   - Random market players
------------------------------------------------------------ */

/** Free agents this old retire instead of staying on the market. */
const FA_RETIREMENT_AGE = 34;
/** The market keeps at most this many players (the best by overall). */
const FA_POOL_MAX = 400;

/** A generated veteran for the open market. */
function generateMarketPlayer(pos) {
  const attributes = generateRookieAttributes(pos);
  const granularAttrs = attributes._granularBag; // keep the attributes his overall was derived from
  delete attributes._granularBag;
  return {
    id: 'fa_' + globalPlayerId++,
    name: generateRookieName(),
    positions: [pos],
    age: randomInt(23, 32),
    attributes,
    granularAttrs,
    contract: null,
    stats: defaultPlayerStats(),
    isFreeAgent: true,
  };
}

/**
 * Add undrafted rookies and generated veterans to the market. Players
 * already in the pool (expired contracts, releases) stay in it.
 */
function generateFreeAgentPool() {
  const inPool = new Set(freeAgents.map((p) => p.id));
  const add = (p) => {
    if (inPool.has(p.id)) return;
    p.isFreeAgent = true;
    freeAgents.push(p);
    inPool.add(p.id);
  };

  // 1. Undrafted rookies (from draft class)
  draftClass.filter((p) => !p.drafted).forEach(add);

  // 2. Generated market players (to keep FA pool interesting)
  for (let i = 0; i < 40; i++) add(generateMarketPlayer(generateRookiePosition()));

  // 3. Unsigned players retire: without this the pool (and save files) grew every year
  freeAgents = freeAgents
    .filter((p) => (p.age || 0) < FA_RETIREMENT_AGE)
    .sort((a, b) => b.attributes.overall - a.attributes.overall)
    .slice(0, FA_POOL_MAX);
}

/* ------------------------------------------------------------
   Market Value Calculation
   (Used later for contract offers)
------------------------------------------------------------ */

function calculateMarketValue(player) {
  /* ── Position-aware NFL salary curve ───────────────────────
     Base curve calibrated for a skill position at peak age.
     QB gets a large multiplier since they're paid 2x everyone
     else in the real NFL. All other positions have realistic
     individual caps based on actual market (2024 comps):
       EDGE/Pass rusher: tops ~$35M  (Parsons, Garrett)
       WR:               tops ~$30M  (Jefferson, Hill)
       CB:               tops ~$27M  (Ramsey, Gardner)
       LT/T:             tops ~$22M  (Tunsil, Brown)
       DT:               tops ~$20M  (Jones, Williams)
       LB:               tops ~$20M  (Warner, Davis)
       FS/SS:            tops ~$18M  (Adams, Smith)
       TE:               tops ~$17M  (Kelce, Andrews)
       RB:               tops ~$17M  (McCaffrey, Barkley)
       QB:               tops ~$55M  (Mahomes, Hurts, Lamar)  */

  var ovr = player.attributes.overall;
  var age = player.age;
  var pos = player.positions[0];

  /* Base curve — calibrated for non-QB skill positions */
  var base;
  if (ovr >= 95) base = 26_000_000;
  else if (ovr >= 90) base = 18_000_000 + (ovr - 90) * 1_600_000;
  else if (ovr >= 85) base = 12_000_000 + (ovr - 85) * 1_200_000;
  else if (ovr >= 80) base = 7_500_000 + (ovr - 80) * 900_000;
  else if (ovr >= 75) base = 4_500_000 + (ovr - 75) * 600_000;
  else if (ovr >= 70) base = 2_500_000 + (ovr - 70) * 400_000;
  else if (ovr >= 65) base = 1_200_000 + (ovr - 65) * 260_000;
  else base = 750_000 + Math.max(0, ovr - 55) * 45_000;

  /* Position multipliers — reflects real market demand */
  var posMult = {
    QB: 2.1 /* Mahomes/Lamar tier at OVR95 → ~$54M */,
    EDGE: 1.35 /* Parsons tier → ~$35M */,
    WR: 1.15 /* Jefferson tier → ~$30M */,
    CB: 1.05 /* Ramsey tier → ~$27M */,
    T: 0.9 /* Tunsil tier → ~$23M */,
    DT: 0.8 /* Jones tier → ~$21M */,
    LB: 0.78 /* Warner tier → ~$20M */,
    FS: 0.72 /* Adams tier → ~$19M */,
    SS: 0.7,
    TE: 0.68 /* Kelce tier → ~$18M */,
    RB: 0.65 /* CMC tier → ~$17M */,
    G: 0.7,
    C: 0.68,
    K: 0.2,
    P: 0.18,
  };
  var pm = posMult[pos] !== undefined ? posMult[pos] : 0.8;

  /* Age multiplier */
  var ageMult;
  if (age <= 23) ageMult = 1.08;
  else if (age <= 26) ageMult = 1.0;
  else if (age <= 29) ageMult = 0.88;
  else if (age <= 32) ageMult = 0.72;
  else ageMult = 0.52;

  var salary = Math.round(base * pm * ageMult);

  /* Contract length */
  var years = 1;
  if (ovr >= 85 && age <= 28) years = 4;
  else if (ovr >= 80 && age <= 30) years = 3;
  else if (ovr >= 72 && age <= 31) years = 2;

  return {
    years,
    totalValue: salary * years,
    capHitPerYear: salary,
  };
}
