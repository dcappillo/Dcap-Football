/* ============================================================
   ROOKIE PLAYER GENERATOR
   ============================================================ */

/* ------------------------------------------------------------
   Rookie Name Generator
------------------------------------------------------------ */

const ROOKIE_FIRST_NAMES = [
  'Jayden',
  'Khalil',
  'Darius',
  'Trevon',
  'Zay',
  'Micah',
  'Javon',
  'Tyrese',
  'Roman',
  'Kade',
  'Braylon',
  'Amari',
  'Jett',
  'Kason',
  'DeShawn',
  'Tariq',
  'Elijah',
  'Kamari',
  'Zion',
  'Devin',
  'Jalen',
  'Xavier',
  'Kyrie',
  'Bryce',
];

const ROOKIE_LAST_NAMES = [
  'Henderson',
  'Carter',
  'Mitchell',
  'Bennett',
  'Douglas',
  'Reed',
  'Walker',
  'Simmons',
  'Harris',
  'Wright',
  'Thompson',
  'Brooks',
  'Foster',
  'Hayes',
  'Parker',
  'Coleman',
  'Stevens',
  'Gibson',
  'Marshall',
  'Grant',
  'Dixon',
];

function generateRookieName() {
  return (
    ROOKIE_FIRST_NAMES[randomInt(0, ROOKIE_FIRST_NAMES.length - 1)] +
    ' ' +
    ROOKIE_LAST_NAMES[randomInt(0, ROOKIE_LAST_NAMES.length - 1)]
  );
}

/* ------------------------------------------------------------
   Rookie Attribute Curves (more variance than veterans)
------------------------------------------------------------ */

function generateRookieAttributes(position) {
  /* Use granular system when available — same pipeline as veterans but
     with 'rookie' tier so the target OVR follows N(72, 6).            */
  if (window.POS_BIAS && window.ATTR_LABELS && window.deriveComposites && window.calcPosOVR) {
    var result = _generateAttrsGranular(position, 'rookie');
    result.attrs._granularBag = result.granular;
    return result.attrs;
  }
  /* Safety fallback */
  var overall = Math.max(50, Math.min(96, Math.round(72 + (Math.random() - 0.5) * 16)));
  return {
    overall: overall,
    athleticism: randomInt(50, 85),
    intelligence: randomInt(50, 85),
    toughness: randomInt(50, 85),
    discipline: randomInt(50, 85),
  };
}

/* ------------------------------------------------------------
   Rookie Position Generator (weighted by NFL draft tendencies)
------------------------------------------------------------ */

function generateRookiePosition() {
  /* Uses exact roster positions (T/G/C for OL, FS/SS for S) */
  /* Weights increased for QB, TE, C, K, P, SS, FS per user request */
  const weighted = [
    'QB',
    'QB',
    'QB',
    'QB',
    'RB',
    'RB',
    'RB',
    'WR',
    'WR',
    'WR',
    'WR',
    'TE',
    'TE',
    'TE',
    'TE',
    'T',
    'T',
    'T',
    'T',
    'G',
    'G',
    'G',
    'C',
    'C',
    'C',
    'C',
    'EDGE',
    'EDGE',
    'EDGE',
    'DT',
    'DT',
    'LB',
    'LB',
    'LB',
    'CB',
    'CB',
    'CB',
    'CB',
    'FS',
    'FS',
    'FS',
    'FS',
    'SS',
    'SS',
    'SS',
    'SS',
    'K',
    'K',
    'K',
    'P',
    'P',
    'P',
  ];
  return weighted[randomInt(0, weighted.length - 1)];
}

/* ------------------------------------------------------------
   Rookie Player Object
------------------------------------------------------------ */

function generateRookie(pos) {
  if (!pos) pos = generateRookiePosition();
  var attributes = generateRookieAttributes(pos);
  var granularBag = attributes._granularBag || null;
  delete attributes._granularBag;
  var player = {
    id: 'rookie_' + globalPlayerId++,
    name: generateRookieName(),
    positions: [pos],
    age: randomInt(20, 23),
    attributes: attributes,
    contract: null,
    stats: defaultPlayerStats(),
    isRookie: true,
  };
  if (granularBag) player.granularAttrs = granularBag;
  return player;
}

/* ------------------------------------------------------------
   Draft Class Generator (7 rounds × 32 picks = 224 rookies)
   Guarantees minimum counts per position so every roster slot
   is always addressable in the draft.
------------------------------------------------------------ */

let draftClass = []; // array of rookie players

var DRAFT_POSITION_MINS = {
  QB: 16,
  RB: 14,
  WR: 24,
  TE: 16,
  T: 14,
  G: 10,
  C: 14,
  EDGE: 16,
  DT: 12,
  LB: 16,
  CB: 20,
  FS: 16,
  SS: 16,
  K: 12,
  P: 12,
};
