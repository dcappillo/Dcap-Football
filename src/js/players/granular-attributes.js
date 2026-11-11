/* ============================================================
   GRANULAR ATTRIBUTES SYSTEM
   38 individual attributes across 7 categories, grouped and
   displayed per player. Composites (Athleticism, Intelligence,
   Toughness, Discipline) are derived from granular values.
   Overall is position-specific — only relevant attrs count.
   ============================================================ */
(function () {
  /* ── 1. Attribute Definitions ─────────────────────────────── */

  var ATTR_GROUPS = {
    Physical: ['speed', 'acceleration', 'agility', 'strength', 'stamina', 'awareness'],
    Passing: ['throwPower', 'throwAccShort', 'throwAccMid', 'throwAccDeep'],
    'Ball Carrier': ['elusiveness', 'trucking', 'jukeMoves', 'spinMove', 'ballCarrierVision', 'carrying'],
    Receiving: ['catching', 'catchInTraffic', 'routeRunning', 'release', 'spectacularCatch'],
    Blocking: [
      'passBlock',
      'runBlock',
      'passBlockStrength',
      'passBlockFootwork',
      'runBlockStrength',
      'runBlockFinesse',
    ],
    Defense: [
      'blockShedding',
      'tackle',
      'powerMoves',
      'finesseMoves',
      'pursuit',
      'playRecognition',
      'manCoverage',
      'zoneCoverage',
      'press',
      'hitPower',
    ],
    Kicking: ['kickPower', 'kickAccuracy'],
  };

  var ATTR_LABELS = {
    speed: 'Speed',
    acceleration: 'Acceleration',
    agility: 'Agility',
    strength: 'Strength',
    stamina: 'Stamina',
    awareness: 'Awareness',
    throwPower: 'Throw Power',
    throwAccShort: 'Short Accuracy',
    throwAccMid: 'Mid Accuracy',
    throwAccDeep: 'Deep Accuracy',
    elusiveness: 'Elusiveness',
    trucking: 'Trucking',
    jukeMoves: 'Juke Move',
    spinMove: 'Spin Move',
    ballCarrierVision: 'Carrier Vision',
    carrying: 'Carrying',
    catching: 'Catching',
    catchInTraffic: 'Catch in Traffic',
    routeRunning: 'Route Running',
    release: 'Release',
    spectacularCatch: 'Spec. Catch',
    passBlock: 'Pass Block',
    runBlock: 'Run Block',
    passBlockStrength: 'PB Strength',
    passBlockFootwork: 'PB Footwork',
    runBlockStrength: 'RB Strength',
    runBlockFinesse: 'RB Finesse',
    blockShedding: 'Block Shed',
    tackle: 'Tackle',
    powerMoves: 'Power Moves',
    finesseMoves: 'Finesse Moves',
    pursuit: 'Pursuit',
    playRecognition: 'Play Recog.',
    manCoverage: 'Man Coverage',
    zoneCoverage: 'Zone Coverage',
    press: 'Press',
    hitPower: 'Hit Power',
    kickPower: 'Kick Power',
    kickAccuracy: 'Kick Accuracy',
  };

  /* ── 2. Position-Specific OVR Formulas (weights sum to 100) ─ */

  var POS_OVR = {
    /* ── Offense ────────────────────────────────────────────────────────────
       Weights reflect how much each attribute contributes to positional value.
       All weights within a position sum to 100.                             */

    QB: {
      /* All three accuracy tiers weighted equally — arm talent alone doesn't win */
      throwAccShort: 16,
      throwAccMid: 16,
      throwAccDeep: 16,
      /* Awareness is the highest single weight — reads win games */
      awareness: 20,
      /* Mobility — real starter weight, not an afterthought */
      speed: 11,
      agility: 10,
      elusiveness: 11,
    },

    RB: {
      /* Elusiveness and vision are the separator traits */
      elusiveness: 13,
      ballCarrierVision: 13,
      /* Speed / quickness */
      speed: 14,
      acceleration: 11,
      agility: 10,
      /* Physicality and security */
      trucking: 10,
      carrying: 10,
      /* Receiving — valued equally with ball security */
      catching: 10,
      /* Shake at the second level */
      jukeMoves: 9,
    },

    WR: {
      /* The three pillars */
      speed: 18,
      routeRunning: 18,
      catching: 16,
      /* Release is what creates separation at the line */
      release: 14,
      acceleration: 10,
      /* Contested catching */
      catchInTraffic: 10,
      spectacularCatch: 6,
      /* Quickness through breaks */
      agility: 5,
      awareness: 3,
    },

    TE: {
      /* Receiving first — modern TE is a mismatch weapon */
      catching: 18,
      catchInTraffic: 13,
      routeRunning: 12,
      /* Blocking — equal pass/run weight */
      passBlock: 10,
      runBlock: 10,
      strength: 10,
      /* Athleticism */
      speed: 10,
      agility: 8,
      awareness: 7,
      /* Short-area burst */
      acceleration: 2,
    },

    /* ── Offensive Line — each position has distinct priorities ──────────── */

    /* Tackle: lateral footwork is the differentiator against speed rushers */
    T: {
      passBlockFootwork: 18,
      passBlockStrength: 15,
      runBlockStrength: 13,
      passBlock: 13,
      runBlockFinesse: 11,
      runBlock: 10,
      strength: 9,
      awareness: 7,
      agility: 4,
    },

    /* Guard: run-blocking and pulling emphasis; awareness elevated for line calls */
    G: {
      runBlockStrength: 16,
      runBlockFinesse: 15,
      passBlockStrength: 14,
      passBlock: 12,
      runBlock: 12,
      passBlockFootwork: 11,
      strength: 11,
      awareness: 7,
      agility: 2,
    },

    /* Center: unchanged — awareness as defining trait is correct */
    C: {
      awareness: 16,
      passBlockStrength: 13,
      passBlockFootwork: 13,
      runBlockStrength: 12,
      runBlockFinesse: 11,
      passBlock: 11,
      runBlock: 11,
      strength: 10,
      agility: 3,
    },

    /* Generic OL fallback (used if position normalizes to 'OL') */
    OL: {
      passBlockStrength: 14,
      runBlockStrength: 14,
      passBlockFootwork: 13,
      runBlockFinesse: 13,
      passBlock: 13,
      runBlock: 12,
      strength: 11,
      awareness: 7,
      agility: 3,
    },

    /* ── Defense ─────────────────────────────────────────────────────────── */

    EDGE: {
      /* Pass-rush toolkit */
      powerMoves: 18,
      finesseMoves: 16,
      blockShedding: 13,
      /* Explosion off the snap */
      acceleration: 12,
      speed: 10,
      strength: 10,
      /* Motor, gap discipline, and finishing */
      pursuit: 9,
      awareness: 7,
      tackle: 5,
    },

    DT: {
      /* Shed and penetrate */
      blockShedding: 20,
      powerMoves: 17,
      strength: 16,
      tackle: 13,
      /* Motor and gap recognition */
      pursuit: 10,
      finesseMoves: 10,
      awareness: 7,
      /* Conditioning */
      stamina: 4,
      hitPower: 3,
    },

    LB: {
      /* Run defense foundation */
      tackle: 17,
      playRecognition: 15,
      pursuit: 12,
      /* Modern LB must move and cover */
      speed: 10,
      zoneCoverage: 10,
      /* Physical tools */
      blockShedding: 9,
      strength: 9,
      hitPower: 7,
      /* Coverage and athleticism */
      agility: 6,
      manCoverage: 5,
    },

    CB: {
      /* Coverage is everything */
      manCoverage: 21,
      speed: 16,
      zoneCoverage: 14,
      /* Technique and quickness */
      agility: 11,
      press: 10,
      acceleration: 9,
      /* Football IQ */
      awareness: 8,
      /* Tackling matters — CBs make solo stops */
      tackle: 7,
      pursuit: 4,
    },

    /* ── Safeties split: SS is a run-first enforcer, FS is a coverage center-field */

    SS: {
      /* Physical enforcer — run support and box presence */
      tackle: 20,
      hitPower: 18,
      playRecognition: 14,
      /* Coverage responsibilities */
      zoneCoverage: 12,
      manCoverage: 10,
      /* Athletic tools */
      speed: 9,
      strength: 8,
      pursuit: 6,
      /* Field awareness */
      awareness: 3,
    },

    FS: {
      /* Center-field coverage and pre-snap reading */
      zoneCoverage: 20,
      playRecognition: 20,
      speed: 16,
      /* Coverage versatility */
      manCoverage: 12,
      awareness: 10,
      /* Range */
      pursuit: 8,
      acceleration: 7,
      agility: 4,
      /* Tackling — real but secondary */
      tackle: 3,
    },

    /* Keep S as fallback if anything still routes here */
    S: {
      zoneCoverage: 18,
      playRecognition: 18,
      tackle: 15,
      manCoverage: 11,
      hitPower: 10,
      speed: 10,
      awareness: 7,
      pursuit: 6,
      acceleration: 5,
    },

    /* ── Specialists ─────────────────────────────────────────────────────── */

    K: {
      /* Range vs precision — plus situational awareness */
      kickPower: 45,
      kickAccuracy: 45,
      awareness: 6,
      stamina: 4,
    },

    P: {
      /* Distance is king for punters; directional punting second */
      kickPower: 48,
      kickAccuracy: 42,
      awareness: 6,
      stamina: 4,
    },
  };

  /* ── 3. Position Bias — how relevant each attr is per position ─
     1.0 = position-defining attr (generated near overall)
     0.2 = irrelevant attr (generated low)                        */

  var POS_BIAS = {
    QB: {
      throwPower: 0.95,
      throwAccShort: 0.95,
      throwAccMid: 0.9,
      throwAccDeep: 0.85,
      awareness: 0.9,
      speed: 0.5,
      agility: 0.55,
      strength: 0.35,
      stamina: 0.6,
      acceleration: 0.45,
      elusiveness: 0.25,
      carrying: 0.2,
      catching: 0.2,
      routeRunning: 0.15,
      passBlock: 0.15,
      runBlock: 0.1,
      blockShedding: 0.1,
      tackle: 0.1,
      manCoverage: 0.1,
      zoneCoverage: 0.1,
      press: 0.1,
      hitPower: 0.15,
      powerMoves: 0.1,
      finesseMoves: 0.1,
      pursuit: 0.1,
      kickPower: 0.05,
      kickAccuracy: 0.05,
    },

    RB: {
      speed: 0.95,
      acceleration: 0.9,
      agility: 0.9,
      elusiveness: 0.9,
      trucking: 0.85,
      jukeMoves: 0.85,
      spinMove: 0.8,
      ballCarrierVision: 0.85,
      carrying: 0.85,
      stamina: 0.8,
      strength: 0.6,
      catching: 0.5,
      catchInTraffic: 0.45,
      awareness: 0.55,
      passBlock: 0.3,
      runBlock: 0.25,
      throwPower: 0.05,
      throwAccShort: 0.05,
      manCoverage: 0.1,
      zoneCoverage: 0.1,
      blockShedding: 0.1,
      tackle: 0.3,
      hitPower: 0.4,
      kickPower: 0.1,
      kickAccuracy: 0.1,
    },

    WR: {
      speed: 0.95,
      routeRunning: 0.95,
      catching: 0.95,
      catchInTraffic: 0.85,
      spectacularCatch: 0.85,
      release: 0.85,
      agility: 0.85,
      acceleration: 0.85,
      awareness: 0.65,
      elusiveness: 0.5,
      jukeMoves: 0.45,
      carrying: 0.3,
      stamina: 0.6,
      strength: 0.3,
      passBlock: 0.2,
      runBlock: 0.15,
      blockShedding: 0.1,
      throwPower: 0.05,
      throwAccShort: 0.05,
      manCoverage: 0.15,
      zoneCoverage: 0.15,
      kickPower: 0.1,
      kickAccuracy: 0.1,
    },

    TE: {
      catching: 0.8,
      routeRunning: 0.75,
      passBlock: 0.75,
      runBlock: 0.75,
      strength: 0.8,
      speed: 0.7,
      catchInTraffic: 0.75,
      agility: 0.65,
      spectacularCatch: 0.6,
      awareness: 0.65,
      stamina: 0.65,
      trucking: 0.55,
      carrying: 0.45,
      blockShedding: 0.35,
      tackle: 0.3,
      elusiveness: 0.3,
      throwPower: 0.05,
      throwAccShort: 0.05,
      manCoverage: 0.15,
      zoneCoverage: 0.2,
      kickPower: 0.05,
      kickAccuracy: 0.05,
    },

    /* Generic OL bias — used as fallback */
    OL: {
      passBlock: 0.95,
      runBlock: 0.95,
      passBlockStrength: 0.9,
      passBlockFootwork: 0.88,
      runBlockStrength: 0.9,
      runBlockFinesse: 0.85,
      strength: 0.88,
      awareness: 0.7,
      agility: 0.6,
      stamina: 0.7,
      tackle: 0.35,
      blockShedding: 0.35,
      hitPower: 0.4,
      speed: 0.35,
      acceleration: 0.35,
      catching: 0.1,
      routeRunning: 0.05,
      throwPower: 0.05,
      throwAccShort: 0.05,
      manCoverage: 0.1,
      zoneCoverage: 0.1,
      kickPower: 0.05,
      kickAccuracy: 0.05,
    },

    /* Tackle: pass-blocking technique is the differentiator */
    T: {
      passBlockFootwork: 0.95,
      passBlockStrength: 0.92,
      runBlockStrength: 0.88,
      runBlockFinesse: 0.82,
      passBlock: 0.92,
      runBlock: 0.85,
      strength: 0.88,
      awareness: 0.7,
      agility: 0.62,
      stamina: 0.7,
      tackle: 0.3,
      blockShedding: 0.3,
      hitPower: 0.35,
      speed: 0.3,
      acceleration: 0.3,
      catching: 0.05,
      routeRunning: 0.03,
      throwPower: 0.03,
      throwAccShort: 0.03,
      manCoverage: 0.05,
      zoneCoverage: 0.05,
      kickPower: 0.03,
      kickAccuracy: 0.03,
    },

    /* Guard: run-blocking and pulling emphasis */
    G: {
      runBlockStrength: 0.95,
      runBlockFinesse: 0.92,
      passBlockStrength: 0.9,
      passBlockFootwork: 0.86,
      passBlock: 0.9,
      runBlock: 0.95,
      strength: 0.9,
      awareness: 0.65,
      agility: 0.65,
      stamina: 0.7,
      tackle: 0.3,
      blockShedding: 0.3,
      hitPower: 0.38,
      speed: 0.32,
      acceleration: 0.32,
      catching: 0.05,
      routeRunning: 0.03,
      throwPower: 0.03,
      throwAccShort: 0.03,
      manCoverage: 0.05,
      zoneCoverage: 0.05,
      kickPower: 0.03,
      kickAccuracy: 0.03,
    },

    /* Center: awareness is uniquely elevated — makes protection calls */
    C: {
      awareness: 0.95,
      passBlockStrength: 0.9,
      passBlockFootwork: 0.9,
      runBlockStrength: 0.88,
      runBlockFinesse: 0.84,
      passBlock: 0.88,
      runBlock: 0.88,
      strength: 0.86,
      agility: 0.6,
      stamina: 0.7,
      tackle: 0.3,
      blockShedding: 0.3,
      hitPower: 0.35,
      speed: 0.28,
      acceleration: 0.28,
      catching: 0.05,
      routeRunning: 0.03,
      throwPower: 0.03,
      throwAccShort: 0.03,
      manCoverage: 0.05,
      zoneCoverage: 0.05,
      kickPower: 0.03,
      kickAccuracy: 0.03,
    },

    EDGE: {
      powerMoves: 0.92,
      finesseMoves: 0.92,
      blockShedding: 0.9,
      speed: 0.82,
      strength: 0.85,
      pursuit: 0.8,
      awareness: 0.75,
      tackle: 0.7,
      agility: 0.7,
      acceleration: 0.65,
      stamina: 0.7,
      hitPower: 0.75,
      passBlock: 0.25,
      runBlock: 0.2,
      catching: 0.1,
      routeRunning: 0.05,
      throwPower: 0.05,
      throwAccShort: 0.05,
      manCoverage: 0.2,
      zoneCoverage: 0.2,
      kickPower: 0.05,
      kickAccuracy: 0.05,
    },

    DT: {
      blockShedding: 0.92,
      powerMoves: 0.92,
      strength: 0.9,
      tackle: 0.82,
      pursuit: 0.8,
      awareness: 0.75,
      stamina: 0.72,
      hitPower: 0.75,
      finesseMoves: 0.7,
      agility: 0.55,
      speed: 0.45,
      passBlock: 0.2,
      runBlock: 0.15,
      manCoverage: 0.1,
      zoneCoverage: 0.1,
      throwPower: 0.05,
      throwAccShort: 0.05,
      kickPower: 0.05,
      kickAccuracy: 0.05,
    },

    LB: {
      tackle: 0.92,
      playRecognition: 0.88,
      zoneCoverage: 0.82,
      strength: 0.78,
      speed: 0.72,
      blockShedding: 0.78,
      pursuit: 0.82,
      hitPower: 0.85,
      awareness: 0.8,
      agility: 0.65,
      acceleration: 0.6,
      stamina: 0.72,
      manCoverage: 0.55,
      press: 0.4,
      powerMoves: 0.5,
      finesseMoves: 0.45,
      passBlock: 0.2,
      runBlock: 0.2,
      catching: 0.15,
      routeRunning: 0.1,
      throwPower: 0.05,
      throwAccShort: 0.05,
      kickPower: 0.05,
      kickAccuracy: 0.05,
    },

    CB: {
      manCoverage: 0.95,
      zoneCoverage: 0.9,
      press: 0.88,
      speed: 0.92,
      agility: 0.88,
      awareness: 0.82,
      tackle: 0.65,
      acceleration: 0.82,
      pursuit: 0.6,
      hitPower: 0.55,
      elusiveness: 0.5,
      passBlock: 0.15,
      runBlock: 0.1,
      catching: 0.3,
      routeRunning: 0.2,
      blockShedding: 0.2,
      strength: 0.4,
      throwPower: 0.05,
      throwAccShort: 0.05,
      kickPower: 0.05,
      kickAccuracy: 0.05,
    },

    SS: {
      tackle: 0.92,
      hitPower: 0.92,
      playRecognition: 0.82,
      zoneCoverage: 0.78,
      manCoverage: 0.72,
      speed: 0.75,
      strength: 0.8,
      pursuit: 0.72,
      awareness: 0.65,
      agility: 0.6,
      acceleration: 0.6,
      press: 0.45,
      blockShedding: 0.25,
      passBlock: 0.15,
      catching: 0.3,
      routeRunning: 0.15,
      throwPower: 0.05,
      throwAccShort: 0.05,
      kickPower: 0.05,
      kickAccuracy: 0.05,
    },

    FS: {
      zoneCoverage: 0.95,
      playRecognition: 0.95,
      speed: 0.88,
      manCoverage: 0.82,
      awareness: 0.9,
      pursuit: 0.8,
      acceleration: 0.78,
      agility: 0.72,
      tackle: 0.6,
      hitPower: 0.5,
      strength: 0.45,
      press: 0.5,
      blockShedding: 0.2,
      passBlock: 0.15,
      catching: 0.4,
      routeRunning: 0.25,
      throwPower: 0.05,
      throwAccShort: 0.05,
      kickPower: 0.05,
      kickAccuracy: 0.05,
    },

    /* S kept as fallback */
    S: {
      zoneCoverage: 0.92,
      playRecognition: 0.9,
      tackle: 0.87,
      manCoverage: 0.82,
      speed: 0.78,
      awareness: 0.88,
      hitPower: 0.82,
      strength: 0.65,
      agility: 0.7,
      acceleration: 0.7,
      pursuit: 0.75,
      press: 0.5,
      blockShedding: 0.3,
      passBlock: 0.15,
      catching: 0.35,
      routeRunning: 0.2,
      throwPower: 0.05,
      throwAccShort: 0.05,
      kickPower: 0.05,
      kickAccuracy: 0.05,
    },

    K: {
      kickPower: 0.95,
      kickAccuracy: 0.95,
      strength: 0.45,
      awareness: 0.55,
      speed: 0.3,
      agility: 0.3,
      acceleration: 0.3,
      stamina: 0.5,
      passBlock: 0.05,
      runBlock: 0.05,
      catching: 0.1,
      throwing: 0.05,
    },

    P: {
      kickPower: 0.95,
      kickAccuracy: 0.95,
      strength: 0.4,
      awareness: 0.55,
      speed: 0.3,
      agility: 0.3,
      acceleration: 0.3,
      stamina: 0.5,
    },
  };

  /* ── 4. Composite Derivation ─────────────────────────────── */

  function deriveComposites(g) {
    function avg(keys) {
      var s = 0;
      keys.forEach(function (k) {
        s += g[k] || 60;
      });
      return Math.round(s / keys.length);
    }
    return {
      athleticism: avg(['speed', 'acceleration', 'agility', 'strength', 'stamina']),
      intelligence: avg(['awareness', 'playRecognition', 'throwAccShort', 'routeRunning', 'ballCarrierVision']),
      toughness: avg(['strength', 'trucking', 'tackle', 'hitPower', 'blockShedding', 'carrying']),
      discipline: avg(['awareness', 'stamina', 'passBlockFootwork', 'runBlockFinesse', 'zoneCoverage', 'carrying']),
    };
  }

  /* ── 5. Position-Specific OVR ────────────────────────────── */

  function calcPosOVR(g, pos) {
    /* Normalise all roster slot variants → canonical POS_OVR key */
    if (pos === 'LT' || pos === 'RT') pos = 'T';
    if (pos === 'LG' || pos === 'RG') pos = 'G';
    if (pos === 'DL' || pos === 'DE') pos = 'DT';
    /* FS and SS have distinct formulas — do NOT collapse to S */
    if (pos === 'FS' && !POS_OVR['FS']) pos = 'S';
    if (pos === 'SS' && !POS_OVR['SS']) pos = 'S';
    if (pos === 'MLB' || pos === 'ILB' || pos === 'OLB') pos = 'LB';
    if (pos === 'FB') pos = 'RB';
    /* T, G, C fall back to generic OL if no specific formula exists */
    if ((pos === 'T' || pos === 'G' || pos === 'C') && !POS_OVR[pos]) pos = 'OL';
    var formula = POS_OVR[pos] || POS_OVR.LB;
    var total = 0,
      wsum = 0;
    Object.keys(formula).forEach(function (k) {
      total += (g[k] || 60) * formula[k];
      wsum += formula[k];
    });
    return Math.round(total / wsum);
  }

  /* ── 6. Granular Attribute Generation (lazy, cached) ─────── */

  window.initGranularAttrs = function (player) {
    if (player.granularAttrs) return player.granularAttrs;

    var a = player.attributes || {};
    var pos = (player.positions && player.positions[0]) || 'LB';
    var ovr = a.overall || 75;
    var ath = a.athleticism || ovr;
    var intel = a.intelligence || ovr;
    var tough = a.toughness || ovr;
    var disc = a.discipline || ovr;

    var bias = POS_BIAS[pos] || POS_BIAS.LB;

    /* Composite pools — which composite base to draw from per group */
    var POOL = {
      speed: 'ath',
      acceleration: 'ath',
      agility: 'ath',
      strength: 'tough',
      stamina: 'disc',
      awareness: 'intel',
      throwPower: 'ath',
      throwAccShort: 'intel',
      throwAccMid: 'intel',
      throwAccDeep: 'intel',
      elusiveness: 'ath',
      trucking: 'tough',
      jukeMoves: 'ath',
      spinMove: 'ath',
      ballCarrierVision: 'intel',
      carrying: 'disc',
      catching: 'intel',
      catchInTraffic: 'tough',
      routeRunning: 'intel',
      release: 'ath',
      spectacularCatch: 'ath',
      passBlock: 'tough',
      runBlock: 'tough',
      passBlockStrength: 'tough',
      passBlockFootwork: 'disc',
      runBlockStrength: 'tough',
      runBlockFinesse: 'intel',
      blockShedding: 'tough',
      tackle: 'tough',
      powerMoves: 'tough',
      finesseMoves: 'intel',
      pursuit: 'ath',
      playRecognition: 'intel',
      manCoverage: 'intel',
      zoneCoverage: 'intel',
      press: 'ath',
      hitPower: 'tough',
      kickPower: 'ath',
      kickAccuracy: 'intel',
    };

    var pools = { ath: ath, intel: intel, tough: tough, disc: disc };

    function gen(key) {
      var relevance = bias[key] !== undefined ? bias[key] : 0.2;
      var poolKey = POOL[key] || 'ath';
      var composite = pools[poolKey] || ovr;
      /* At relevance 1.0: target ≈ overall, small spread
         At relevance 0.2: target ≈ 40+(ovr-40)*0.2, larger spread */
      var target = 40 + (ovr - 40) * relevance;
      /* Blend in composite to reflect the player's underlying quality */
      var base = target * 0.75 + composite * 0.25 * relevance;
      var spread = 10 * (1.1 - relevance * 0.8);
      var val = base + (Math.random() - 0.5) * spread * 2;
      return Math.max(40, Math.min(99, Math.round(val)));
    }

    var g = {};
    /* Generate every defined attribute */
    Object.keys(ATTR_LABELS).forEach(function (k) {
      g[k] = gen(k);
    });

    player.granularAttrs = g;

    /* Update composite attributes to reflect generated values */
    var comp = deriveComposites(g);
    player.attributes.athleticism = comp.athleticism;
    player.attributes.intelligence = comp.intelligence;
    player.attributes.toughness = comp.toughness;
    player.attributes.discipline = comp.discipline;

    /* Update overall to position-specific value */
    player.attributes.overall = calcPosOVR(g, pos);

    return g;
  };

  /* ── 7. Render Attributes Screen ─────────────────────────── */

  window.renderAttributesScreen = function (playerId) {
    /* Guarantee snapshot exists before computing deltas */
    if (typeof window.initSeasonOVR === 'function') window.initSeasonOVR();

    /* Locate player across all teams, free agents, and draft class */
    var p = null,
      team = null;
    listAllTeams(league).forEach(function (t) {
      t.roster.forEach(function (x) {
        if (String(x.id) === String(playerId)) {
          p = x;
          team = t;
        }
      });
    });
    if (!p && typeof freeAgents !== 'undefined') {
      freeAgents.forEach(function (x) {
        if (String(x.id) === String(playerId)) p = x;
      });
    }
    /* Also check draftClass so attrs work on prospects before they're drafted */
    if (!p && typeof draftClass !== 'undefined') {
      draftClass.forEach(function (x) {
        if (String(x.id) === String(playerId)) p = x;
      });
    }
    if (!p) return;

    var g = window.initGranularAttrs(p);
    var pos = p.positions[0];
    var comp = deriveComposites(g);
    var gStart = p.seasonStartGranular || null;

    function bar(label, val, attrKey) {
      val = val || 0;
      var c = ovrColor(val);
      var deltaHtml = '';
      if (attrKey && gStart && gStart[attrKey] !== undefined) {
        var d = val - gStart[attrKey];
        if (d > 0)
          deltaHtml = '<span style="font-size:9px;color:#4ade80;margin-left:3px;font-weight:700">+' + d + '</span>';
        else if (d < 0)
          deltaHtml = '<span style="font-size:9px;color:#f87171;margin-left:3px;font-weight:700">' + d + '</span>';
      }
      return (
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">' +
        '<div style="width:118px;font-size:11px;color:var(--muted2);white-space:nowrap;flex-shrink:0">' +
        label +
        '</div>' +
        '<div style="flex:1;height:5px;background:var(--surface3);border-radius:3px">' +
        '<div style="height:5px;width:' +
        val +
        '%;background:' +
        c +
        ';border-radius:3px"></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:flex-end;width:52px;flex-shrink:0">' +
        '<span style="font-size:12px;font-weight:700;color:' +
        c +
        '">' +
        val +
        '</span>' +
        deltaHtml +
        '</div>' +
        '</div>'
      );
    }

    function groupCard(title, keys) {
      return (
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">' +
        '<div style="font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--accent2);margin-bottom:10px">' +
        title +
        '</div>' +
        keys
          .map(function (k) {
            return bar(ATTR_LABELS[k] || k, g[k], k);
          })
          .join('') +
        '</div>'
      );
    }

    /* Composite ratings card */
    var compCard =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">' +
      '<div style="font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--accent2);margin-bottom:10px">Composite Ratings</div>' +
      bar('Athleticism', comp.athleticism) +
      bar('Intelligence', comp.intelligence) +
      bar('Toughness', comp.toughness) +
      bar('Discipline', comp.discipline) +
      '</div>';

    /* Position OVR table — all positions listed */
    var posRows = Object.keys(POS_OVR)
      .map(function (pp) {
        var pOVR = calcPosOVR(g, pp);
        var isPrim = pp === pos;
        return (
          '<div style="display:flex;align-items:center;justify-content:space-between;' +
          'padding:5px 8px;border-radius:6px;margin-bottom:2px;' +
          'background:' +
          (isPrim ? 'rgba(22,163,74,.12)' : 'transparent') +
          '">' +
          '<span style="font-size:12px;color:' +
          (isPrim ? 'var(--accent2)' : 'var(--muted2)') +
          ';font-weight:' +
          (isPrim ? '600' : '400') +
          '">' +
          pp +
          (isPrim ? ' <span style="color:var(--gold);font-size:10px">★ primary</span>' : '') +
          '</span>' +
          '<span style="font-size:14px;font-weight:700;color:' +
          ovrColor(pOVR) +
          '">' +
          pOVR +
          '</span>' +
          '</div>'
        );
      })
      .join('');

    var posCard =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">' +
      '<div style="font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--accent2);margin-bottom:6px">Overall by Position</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Converting a player changes which attrs count toward their OVR.</div>' +
      posRows +
      '</div>';

    setMainContent(
      /* Back button */
      '<button onclick="renderPlayerDetail(\'' +
        playerId +
        '\')" style="width:auto;padding:5px 14px;margin-bottom:14px;font-size:12px">← Player Profile</button>' +
        /* Header */
        '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;font-weight:700;color:var(--accent2);margin-bottom:2px">' +
        p.name +
        '</div>' +
        '<div style="font-size:12px;color:var(--muted2);margin-bottom:16px">' +
        p.positions.join(' / ') +
        ' · Age ' +
        p.age +
        ' · <span style="color:' +
        ovrColor(p.attributes.overall) +
        ';font-weight:600">OVR ' +
        p.attributes.overall +
        '</span></div>' +
        /* Top row: composites + position OVR side-by-side */
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">' +
        compCard +
        posCard +
        '</div>' +
        /* Physical — full width */
        groupCard('Physical', ATTR_GROUPS['Physical']) +
        /* Specialist groups in two columns */
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        '<div>' +
        groupCard('Passing', ATTR_GROUPS['Passing']) +
        groupCard('Ball Carrier', ATTR_GROUPS['Ball Carrier']) +
        groupCard('Receiving', ATTR_GROUPS['Receiving']) +
        '</div>' +
        '<div>' +
        groupCard('Blocking', ATTR_GROUPS['Blocking']) +
        groupCard('Defense', ATTR_GROUPS['Defense']) +
        groupCard('Kicking', ATTR_GROUPS['Kicking']) +
        '</div>' +
        '</div>',
    );
  };

  /* ── 8. Inject "Attributes" button into player detail page ── */

  var _origRPD_attrs = window.renderPlayerDetail;
  window.renderPlayerDetail = function (playerId) {
    if (typeof _origRPD_attrs === 'function') _origRPD_attrs(playerId);

    setTimeout(function () {
      var main = document.getElementById('main');
      if (!main) return;

      /* Find the player */
      var p = null,
        onMyTeam = false;
      var tid =
        typeof activeTeamId === 'function' ? activeTeamId() : typeof userTeamId !== 'undefined' ? userTeamId : null;
      listAllTeams(league).forEach(function (t) {
        t.roster.forEach(function (x) {
          if (String(x.id) === String(playerId)) {
            p = x;
            if (tid && t.id === tid) onMyTeam = true;
          }
        });
      });
      if (!p) return;

      /* Pre-generate so OVR on the card is already position-specific */
      window.initGranularAttrs(p);

      /* Avoid double injection */
      if (main.querySelector('.attrs-btn')) return;

      var btn = document.createElement('button');
      btn.className = 'attrs-btn';
      btn.onclick = function () {
        window.renderAttributesScreen(playerId);
      };
      btn.style.cssText = 'flex:1;background:rgba(168,85,247,.15);border-color:#a855f7;color:#c084fc;font-size:12px';
      btn.textContent = '📊 Attributes';

      /* Find the Cut/Trade actions flex row */
      var actionsRow = null;
      main.querySelectorAll('div').forEach(function (div) {
        if (div.style && div.style.display === 'flex' && div.style.gap === '8px' && div.style.marginTop === '14px') {
          var btns = div.querySelectorAll('button');
          var hasCut = false;
          btns.forEach(function (b) {
            if (b.textContent.indexOf('Cut') !== -1) hasCut = true;
          });
          if (hasCut) actionsRow = div;
        }
      });

      if (actionsRow) {
        actionsRow.appendChild(btn);
      } else {
        /* Player not on user's team — append under the "view only" message */
        main.querySelectorAll('p').forEach(function (el) {
          if (el.textContent.indexOf('Not on your roster') !== -1) {
            var wrap = document.createElement('div');
            wrap.style.marginTop = '10px';
            wrap.appendChild(btn);
            el.parentNode.insertBefore(wrap, el.nextSibling);
          }
        });
      }
    }, 100); /* after re-sign patch (50ms) to ensure actionsRow is settled */
  };

  /* ── 9. Export shared functions for other scripts ─────────── */

  window.calcPosOVR = calcPosOVR;
  window.POS_OVR = POS_OVR;
  window.POS_BIAS = POS_BIAS;
  window.ATTR_LABELS = ATTR_LABELS;
  window.deriveComposites = deriveComposites;
  window.POS_OVR = POS_OVR;

  /* ── 10. Init all players at startup ─────────────────────── */

  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      if (typeof league === 'undefined' || !league) return;
      listAllTeams(league).forEach(function (t) {
        t.roster.forEach(function (p) {
          window.initGranularAttrs(p);
        });
      });
      if (typeof freeAgents !== 'undefined') {
        freeAgents.forEach(function (p) {
          window.initGranularAttrs(p);
        });
      }
    }, 1000);
  });
})();
