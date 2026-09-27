// Shot-level data and the expected-goals (xG) model behind the Avancerat page.
//
// Coordinates from the SHL play-by-play: x is the distance out from the attacked goal line and
// y the sideways distance from the middle of the ice, both in decimetres. The goal sits at (0, 0).

const secs = (p, t) => {
  const [m, s] = String(t || '0:0').split(':').map(Number);
  return (p - 1) * 1200 + (m || 0) * 60 + (s || 0);
};

/**
 * Turns one game's play-by-play into a list of shots on goal with the context an xG model needs:
 * distance, angle, rebound, manpower (from the penalty timeline), empty net and the goalie in net.
 */
export function processShots(pbp) {
  const events = (Array.isArray(pbp) ? pbp : [])
    .map((e) => ({ ...e, s: secs(e.period, e.time) }))
    .sort((a, b) => a.s - b.s || (a.eventId || 0) - (b.eventId || 0));
  const goalie = { home: null, away: null };        // who is in net right now, per side
  const pens = { home: [], away: [] };              // active penalties: end times in seconds
  const lastShot = { home: -99, away: -99 };        // for rebounds
  const other = (side) => (side === 'home' ? 'away' : 'home');
  const skaters = (side, t) => { pens[side] = pens[side].filter((p) => p.end > t); return Math.max(3, 5 - pens[side].length); };
  const shots = [];
  let agree = 0, checked = 0;

  for (const e of events) {
    const side = e.eventTeam?.place;
    if (e.type === 'goalkeeper' && side) {
      goalie[side] = e.isEntering ? `${e.player?.firstName || ''} ${e.player?.familyName || ''}`.trim() : null;
      continue;
    }
    if (e.type === 'penalty' && side) {
      const v = e.variant || {};
      const mins = Number(v.majorTime) || Number(v.doubleMinorTime) || Number(v.minorTime) || 0; // misconducts don't change manpower
      if (mins > 0) pens[side].push({ end: e.s + mins * 60, minor: mins <= 4 });
      continue;
    }
    if ((e.type !== 'shot' && e.type !== 'goal') || !side || e.locationX == null || e.period >= 5) continue;

    const opp = other(side), own = skaters(side, e.s), them = skaters(opp, e.s);
    const str = own > them ? 'PP' : own < them ? 'SH' : 'EV';
    const isGoal = e.type === 'goal';
    if (isGoal && e.goalStatus) { // check the penalty timeline against the official strength
      checked++;
      const official = /^PP/.test(e.goalStatus) ? 'PP' : /^(SH|BP)/.test(e.goalStatus) ? 'SH' : 'EV';
      if (official === str) agree++;
    }
    const x = e.locationX, y = e.locationY;
    shots.push({
      p: e.period, s: e.s, side, x, y,
      d: Math.hypot(x, y) / 10,                                  // metres to the net
      a: Math.atan2(Math.abs(y), Math.max(x, 1)),                // radians off the centre line
      g: isGoal ? 1 : 0,
      str,
      en: isGoal ? (e.isEmptyNetGoal ? 1 : 0) : (goalie[opp] ? 0 : 1),
      ps: e.isPenaltyShot ? 1 : 0,
      reb: e.s - lastShot[side] <= 3 ? 1 : 0,
      shooter: e.player ? `${e.player.firstName || ''} ${e.player.familyName || ''}`.trim() : null,
      num: e.player?.jerseyToday ?? null,
      goalie: goalie[opp],
    });
    lastShot[side] = e.s;
    // A power-play goal ends the shortest running minor of the team that is short-handed
    if (isGoal && them < own) {
      const minors = pens[opp].filter((p) => p.minor && p.end > e.s).sort((a, b) => a.end - b.end);
      if (minors[0]) minors[0].end = e.s;
    }
  }
  return { shots, strengthCheck: [agree, checked] };
}

// ---------- xG model: logistic regression on shots on goal ----------
const FEATURES = [
  ['Avstånd', (s) => s.d],
  ['Avstånd²', (s) => (s.d * s.d) / 100],
  ['Vinkel', (s) => s.a],
  ['Retur', (s) => s.reb],
  ['Powerplay', (s) => (s.str === 'PP' ? 1 : 0)],
  ['Boxplay', (s) => (s.str === 'SH' ? 1 : 0)],
  ['Tom kasse', (s) => s.en],
];
const usable = (s) => !s.ps && s.p <= 4;

export function trainXG(shots, { iters = 600, lr = 0.5, l2 = 1e-4 } = {}) {
  const data = shots.filter(usable);
  const X = data.map((s) => FEATURES.map(([, f]) => f(s)));
  const y = data.map((s) => s.g);
  const k = FEATURES.length;
  // Standardise features so plain gradient descent converges
  const mean = Array.from({ length: k }, (_, j) => X.reduce((t, r) => t + r[j], 0) / X.length);
  const sd = Array.from({ length: k }, (_, j) => Math.sqrt(X.reduce((t, r) => t + (r[j] - mean[j]) ** 2, 0) / X.length) || 1);
  const Z = X.map((r) => r.map((v, j) => (v - mean[j]) / sd[j]));
  let w = new Array(k).fill(0), b = Math.log(y.reduce((t, v) => t + v, 0) / (y.length - y.reduce((t, v) => t + v, 0)));
  const sig = (z) => 1 / (1 + Math.exp(-z));
  for (let it = 0; it < iters; it++) {
    const gw = new Array(k).fill(0); let gb = 0;
    for (let i = 0; i < Z.length; i++) {
      const err = sig(b + Z[i].reduce((t, v, j) => t + v * w[j], 0)) - y[i];
      gb += err; for (let j = 0; j < k; j++) gw[j] += err * Z[i][j];
    }
    b -= (lr * gb) / Z.length;
    w = w.map((wj, j) => wj - lr * (gw[j] / Z.length + l2 * wj));
  }
  const predict = (s) => sig(b + FEATURES.reduce((t, [, f], j) => t + ((f(s) - mean[j]) / sd[j]) * w[j], 0));
  // Fit report: log loss against always guessing the average, calibration, and ranking quality (AUC)
  const base = y.reduce((t, v) => t + v, 0) / y.length;
  let ll = 0, ll0 = 0, xgSum = 0;
  const preds = data.map((s, i) => { const p = Math.min(1 - 1e-9, Math.max(1e-9, predict(s))); ll -= y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p); ll0 -= y[i] * Math.log(base) + (1 - y[i]) * Math.log(1 - base); xgSum += p; return p; });
  const pos = preds.filter((_, i) => y[i]), neg = preds.filter((_, i) => !y[i]);
  let wins = 0; const negSorted = [...neg].sort((a, b2) => a - b2);
  for (const p of pos) { let lo = 0, hi = negSorted.length; while (lo < hi) { const m = (lo + hi) >> 1; negSorted[m] < p ? lo = m + 1 : hi = m; } wins += lo; }
  const report = { shots: data.length, goals: pos.length, xg: +xgSum.toFixed(1), logLoss: +(ll / data.length).toFixed(4), baseline: +(ll0 / data.length).toFixed(4), auc: +(wins / (pos.length * neg.length)).toFixed(3) };
  const coef = FEATURES.map(([name], j) => ({ name, weight: +(w[j] / sd[j]).toFixed(4) }));
  return { predict: (s) => (usable(s) ? predict(s) : s.ps ? 0.33 : 0), report, coef };
}

// Danger zones by chance quality
export const zoneOf = (xg) => (xg >= 0.15 ? 'hd' : xg >= 0.07 ? 'md' : 'ld');
