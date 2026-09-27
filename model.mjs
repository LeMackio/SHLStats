// Team ratings, game odds and season/playoff simulation.
// Used by fetch-data.mjs at build time; results are shipped to the site as JSON.

export const SEASON_GAMES = 52;
export const PRIOR_W = 15;    // last season counts as this many games of evidence
export const REGRESS = 0.6;   // keep 60% of last season's distance from the league average
export const HOME = 1.05, AWAY = 0.96;

const totals = (games) => {
  const t = {};
  for (const g of games) for (const [c, f, a] of [[g.home, g.hs, g.as], [g.away, g.as, g.hs]]) {
    const r = (t[c] ??= { gp: 0, gf: 0, ga: 0 }); r.gp++; r.gf += f; r.ga += a;
  }
  return t;
};

/** Attack/defence ratings relative to the league average L (goals per team-game). */
export function buildRatings(prevGames, playedGames, codes) {
  const prevT = totals(prevGames), curT = totals(playedGames);
  const all = [...prevGames, ...playedGames];
  const L = all.reduce((s, g) => s + g.hs + g.as, 0) / (2 * Math.max(1, all.length));
  const rating = {};
  for (const c of codes) {
    const p = prevT[c];
    // Promoted teams (no SHL games last season) start slightly below average
    const pgf = p ? L + (p.gf / p.gp - L) * REGRESS : L * 0.93;
    const pga = p ? L + (p.ga / p.gp - L) * REGRESS : L * 1.07;
    const cu = curT[c] || { gp: 0, gf: 0, ga: 0 };
    rating[c] = {
      att: (pgf * PRIOR_W + cu.gf) / (PRIOR_W + cu.gp) / L,
      def: (pga * PRIOR_W + cu.ga) / (PRIOR_W + cu.gp) / L,
    };
  }
  return { L, rating, HOME, AWAY };
}

export const lambdas = (m, h, a) => [
  m.L * m.rating[h].att * m.rating[a].def * m.HOME,
  m.L * m.rating[a].att * m.rating[h].def * m.AWAY,
];

const poisPmf = (l, n = 15) => { const out = []; let p = Math.exp(-l); for (let k = 0; k < n; k++) { out.push(p); p *= l / (k + 1); } return out; };

/** Home win probability including overtime/shootout. */
export function winProb(m, h, a) {
  if (!m.rating[h] || !m.rating[a]) return 0.5;
  const [lh, la] = lambdas(m, h, a), ph = poisPmf(lh), pa = poisPmf(la);
  let hw = 0, tie = 0, tot = 0;
  for (let i = 0; i < ph.length; i++) for (let j = 0; j < pa.length; j++) {
    const p = ph[i] * pa[j]; tot += p; if (i > j) hw += p; else if (i === j) tie += p;
  }
  return (hw + tie * (lh / (lh + la))) / tot;
}

const poisSample = (l) => { const lim = Math.exp(-l); let k = 0, p = Math.random(); while (p > lim) { k++; p *= Math.random(); } return k; };

/**
 * Simulates the rest of the regular season and the playoffs.
 * table: [{code, pts, gf, ga}], remaining: [{home, away}]
 */
export function simulate(m, table, remaining, codes, N = 10000) {
  const n = codes.length, idx = Object.fromEntries(codes.map((c, i) => [c, i]));
  const basePts = new Float64Array(n), baseGd = new Float64Array(n);
  for (const r of table) if (idx[r.code] != null) { basePts[idx[r.code]] = r.pts; baseGd[idx[r.code]] = r.gf - r.ga; }
  const rem = remaining.filter((g) => idx[g.home] != null && idx[g.away] != null)
    .map((g) => { const [lh, la] = lambdas(m, g.home, g.away); return [idx[g.home], idx[g.away], lh, la, lh / (lh + la)]; });
  const neutral = codes.map((a) => codes.map((b) => a === b ? 0.5 : (winProb(m, a, b) + 1 - winProb(m, b, a)) / 2));
  const acc = codes.map(() => ({ pts: [], top6: 0, top10: 0, rel: 0, semi: 0, final: 0, gold: 0, rank: new Array(n).fill(0), qf: {} }));
  const pts = new Float64Array(n), gd = new Float64Array(n), tie = new Float64Array(n);
  const series = (a, b, bestOf) => {
    const need = (bestOf + 1) / 2, p = neutral[a][b]; let wa = 0, wb = 0;
    while (wa < need && wb < need) Math.random() < p ? wa++ : wb++;
    return wa === need ? a : b;
  };
  for (let s = 0; s < N; s++) {
    pts.set(basePts); gd.set(baseGd);
    for (const [h, a, lh, la, pOT] of rem) {
      const hg = poisSample(lh), ag = poisSample(la);
      gd[h] += hg - ag; gd[a] += ag - hg;
      if (hg > ag) pts[h] += 3; else if (ag > hg) pts[a] += 3;
      else if (Math.random() < pOT) { pts[h] += 2; pts[a] += 1; gd[h]++; gd[a]--; }
      else { pts[a] += 2; pts[h] += 1; gd[a]++; gd[h]--; }
    }
    for (let i = 0; i < n; i++) tie[i] = Math.random();
    const order = [...Array(n).keys()].sort((x, y) => pts[y] - pts[x] || gd[y] - gd[x] || tie[y] - tie[x]);
    order.forEach((t, rank) => {
      const A = acc[t]; A.pts.push(pts[t]); A.rank[rank]++;
      if (rank < 6) A.top6++; if (rank < 10) A.top10++; if (rank >= n - 2) A.rel++;
    });
    if (n < 10) continue;
    // Play-in 7v10 and 8v9 (best of 3), then reseeded best-of-7 rounds
    const seedOf = new Map(order.map((t, i) => [t, i]));
    const pi1 = series(order[6], order[9], 3), pi2 = series(order[7], order[8], 3);
    let alive = [...order.slice(0, 6), pi1, pi2], round = 0;
    while (alive.length > 1) {
      alive.sort((x, y) => seedOf.get(x) - seedOf.get(y));
      const pairs = [];
      for (let i = 0; i < alive.length / 2; i++) pairs.push([alive[i], alive[alive.length - 1 - i]]);
      if (round === 0) for (const [a, b] of pairs) { acc[a].qf[codes[b]] = (acc[a].qf[codes[b]] || 0) + 1; acc[b].qf[codes[a]] = (acc[b].qf[codes[a]] || 0) + 1; }
      if (alive.length === 4) for (const t of alive) acc[t].semi++;
      if (alive.length === 2) for (const t of alive) acc[t].final++;
      alive = pairs.map(([a, b]) => series(a, b, 7));
      round++;
    }
    acc[alive[0]].gold++;
  }
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];
  return Object.fromEntries(codes.map((c, i) => {
    const A = acc[i], sorted = A.pts.sort((x, y) => x - y);
    const r3 = (x) => Math.round(x / N * 1000) / 1000;
    return [c, {
      proj: Math.round(sorted.reduce((s, x) => s + x, 0) / N * 10) / 10,
      lo: q(sorted, 0.1), hi: q(sorted, 0.9),
      top6: r3(A.top6), top10: r3(A.top10), rel: r3(A.rel),
      semi: r3(A.semi), final: r3(A.final), gold: r3(A.gold),
      rank: A.rank.map(r3),
      qf: Object.fromEntries(Object.entries(A.qf).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => [k, r3(v)])),
    }];
  }));
}
