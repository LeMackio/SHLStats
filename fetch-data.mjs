// Pulls SHL data from shl.se's public API, runs the projection model and builds the site into ./site.
// Run: node fetch-data.mjs
//
// Caching (the cache/ folder is kept between GitHub Actions runs):
//   cache/seasons/<year>.json   finished seasons, fetched once
//   cache/games/<id>.json       finished games, fetched once
//   cache/headshots.json        resolved headshot links for players not on a current roster
// history/odds.json is committed to the repository so odds history survives cache loss.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildRatings, simulate, winProb } from './model.mjs';

const API = 'https://www.shl.se/api';
const N_SEASONS = 5; // current + 4 previous, for career stats, past standings and head-to-head
const CODE_FIX = { 'ÖRE': 'OHK', 'SKE': 'SAIK' }; // standings use different codes than the schedule
const fix = (c) => CODE_FIX[c] || c;

const get = async (path, tries = 2) => {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(API + path, { headers: { 'user-agent': 'SHLstats (fan site data refresh)' } });
      if (!res.ok) throw new Error(`${res.status} ${path}`);
      return await res.json();
    } catch (e) {
      if (i + 1 >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
};
const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const writeJson = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v)); };
const inBatches = async (items, size, fn) => { for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn)); };
const toSec = (t) => {
  if (!t || typeof t !== 'string' || !t.includes(':')) return 0;
  const [m, s] = t.split(':').map(Number);
  return m * 60 + s;
};
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const stockholmDate = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const isFinal = (g) => g.state === 'post-game' && typeof g.hs === 'number';

// ---------- seasons ----------
const filter = await get('/sports-v2/season-series-game-types-filter');
const SERIES = filter.series.find((s) => s.code === 'SHL').uuid;
const REGULAR = filter.gameType.find((g) => g.code === 'regular').uuid;
const latest = await get(`/sports-v2/latest-ssgt/${SERIES}`);

const skaterRow = (r) => ({
  id: r.info.uuid, name: r.info.fullName, num: r.info.number, pos: r.info.position,
  born: r.info.birthDate, nat: r.info.nationality, team: r.info.teamCode,
  h: r.info.height?.value, w: r.info.weight?.value, ms: r.info.playerMedia?.mediaString,
  gp: r.GP, g: r.G, a: r.A, pts: r.TP, pim: r.PIM, ppg: r.PPG, gwg: r.GWG,
  sog: r.SOG, hits: r.Hits, blk: r.BkS, pm: r.PlusMinus, toi: toSec(r.TOI_GP),
});
const goalieRow = (r) => ({
  id: r.info.uuid, name: r.info.fullName, num: r.info.number, born: r.info.birthDate,
  nat: r.info.nationality, team: r.info.teamCode, pos: 'GK',
  h: r.info.height?.value, w: r.info.weight?.value, ms: r.info.playerMedia?.mediaString,
  gpi: r.GPI, sv: r.SVS, ga: r.GA, svp: parseFloat(r.SVSPerc) || 0, gaa: parseFloat(r.GAA) || 0,
  w_: r.W, l: r.L, so: r.SO, mins: toSec(r.MIP) / 60,
});

async function loadSeason(s) {
  const y = Number(s.code);
  const label = `${String(y % 100).padStart(2, '0')}-${String((y + 1) % 100).padStart(2, '0')}`;
  const cacheFile = `cache/seasons/${s.code}.json`;
  const cached = readJson(cacheFile, null);
  if (cached) return cached;

  const sched = await get(`/sports-v2/game-schedule?seasonUuid=${s.uuid}&seriesUuid=${SERIES}&gameTypeUuid=${REGULAR}&gamePlace=all&played=all`);
  if (!sched.gameInfo?.length) return null;
  const ssgt = sched.gameInfo[0].ssgtUuid;
  const state = ssgt === latest.uuid && latest.state === 'active' ? 'active' : 'closed';
  const teams = {};
  const games = sched.gameInfo.map((g) => {
    for (const t of [g.homeTeamInfo, g.awayTeamInfo]) teams[t.code] ??= { code: t.code, name: t.names.long || t.names.full, logo: t.icon, uuid: t.uuid };
    return {
      id: g.uuid, start: g.startDateTime, state: g.state, ot: g.overtime, so: g.shootout,
      home: g.homeTeamInfo.code, away: g.awayTeamInfo.code, hs: g.homeTeamInfo.score, as: g.awayTeamInfo.score,
    };
  });
  let standings = [];
  try {
    const st = await get(`/statistics-v2/league-standings?ssgtUuid=${ssgt}`);
    standings = (st.leagueStandings || []).map((r, i) => ({
      rank: i + 1, code: fix(r.info.teamInfo.teamNames.code), gp: r.GP, w: r.W, otw: r.OTW, l: r.L, otl: r.OTL, gf: r.G, ga: r.GA, pts: r.Points,
    }));
  } catch (e) { console.warn('standings failed', label, e.message); }
  const statsModule = async (mod) => {
    try {
      const [r] = await get(`/statistics-v2/stats-info/${mod}?count=1000&ssgtUuid=${ssgt}&provider=statnet&state=${state}&moduleType=summary`);
      return r?.stats ?? [];
    } catch (e) { console.warn(mod, 'failed', label, e.message); return []; }
  };
  const season = {
    label, code: s.code, ssgt, state, teams, games, standings,
    skaters: (await statsModule('players_summary')).map(skaterRow).filter((p) => p.pos !== 'GK'),
    goalies: (await statsModule('goalkeepers_summary')).map(goalieRow),
  };
  if (state === 'closed' && season.skaters.length) writeJson(cacheFile, season);
  return season;
}

const SEASONS = [];
for (const s of [...filter.season].sort((a, b) => b.code - a.code)) {
  if (SEASONS.length === N_SEASONS) break;
  const season = await loadSeason(s);
  if (season) SEASONS.push(season);
}
if (SEASONS.length < 2) throw new Error('Could not find two SHL seasons with schedules');
const [cur, prev] = SEASONS;
const codes = Object.keys(cur.teams);

// ---------- player identity (game data uses numeric ids, the site uses uuids) ----------
const idByNameTeam = new Map(), idByName = new Map();
for (const p of [...cur.skaters, ...cur.goalies]) {
  idByNameTeam.set(norm(p.name) + '|' + p.team, p.id);
  idByName.set(norm(p.name), idByName.has(norm(p.name)) ? null : p.id); // null marks an ambiguous name
}
const refFor = (name, team, num) => ({
  id: idByNameTeam.get(norm(name) + '|' + team) ?? idByName.get(norm(name)) ?? null,
  name, num: num != null && num !== '' ? Number(num) : null,
});

// ---------- games ----------
async function fetchGame(g) {
  const [ps, pbp, ts] = await Promise.all([
    get(`/gameday/player-stats/${g.id}`), get(`/gameday/play-by-play/${g.id}`), get(`/gameday/team-stats/${g.id}`),
  ]);
  const teamOf = { home: g.home, away: g.away };
  const box = {}, gk = {};
  for (const side of ['home', 'away']) {
    const key = side + 'TeamValue';
    const names = ps.players?.[key] || {}, gnames = ps.goalkeepers?.[key] || {};
    box[side] = (ps.stats?.[key] || []).filter((r) => !r.info?.period).map((r) => {
      const n = names[r.info.playerId]?.fullName;
      return {
        ...refFor(n, teamOf[side], r.NR), pos: r.POS, line: r.LINE,
        g: r.G, a: r.A, pm: r['+/-'], toi: toSec(r.TOI), sog: r.SOG, pim: r.PIM, ppg: r.PPG,
        hits: r.Hits, blk: r.BkS, fow: r.FOW, fol: r.FOL,
      };
    });
    gk[side] = (ps.gkStats?.[key] || []).filter((r) => !r.info?.period).map((r) => ({
      ...refFor(gnames[r.info.playerId]?.fullName, teamOf[side], r.NR), line: r.LINE,
      ga: r.GA, soga: r.SOGA, svs: r.SVS,
    }));
  }
  const pRef = (p, side) => p ? refFor(`${p.firstName} ${p.familyName}`, teamOf[side], p.jerseyToday) : null;
  const byTime = (a, b) => a.p - b.p || a.t.localeCompare(b.t);
  const goals = [], pens = [], shots = [];
  for (const e of Array.isArray(pbp) ? pbp : []) {
    const side = e.eventTeam?.place;
    if (e.type === 'goal') {
      goals.push({
        p: e.period, t: e.time, team: side, scorer: pRef(e.player, side),
        a1: pRef(e.assists?.first, side), a2: pRef(e.assists?.second, side),
        str: e.goalStatus || 'EQ', en: !!e.isEmptyNetGoal, ps: !!e.isPenaltyShot,
        score: [e.homeGoals, e.awayGoals], x: e.locationX, y: e.locationY,
      });
    } else if (e.type === 'penalty') {
      pens.push({ p: e.period, t: e.time, team: side, player: pRef(e.player, side), desc: e.variant?.description || '', off: e.offence || '' });
    } else if (e.type === 'shot') {
      shots.push({ p: e.period, t: e.time, team: side, x: e.locationX, y: e.locationY });
    }
  }
  const stat = (side, period) => Object.fromEntries((ts[side]?.statistics?.find((s) => s.period === period)?.parsedTotalStatistics || []).map((k) => [k.key, k.value]));
  const periods = (ts.home?.statistics || []).map((s) => s.period).filter((p) => p > 0).sort()
    .map((p) => ({ p, h: stat('home', p).G ?? 0, a: stat('away', p).G ?? 0, hs: stat('home', p).SOG ?? 0, as: stat('away', p).SOG ?? 0 }));
  const first = Array.isArray(pbp) ? pbp[0] : null;
  return {
    id: g.id, start: g.start, home: g.home, away: g.away, hs: g.hs, as: g.as, ot: g.ot, so: g.so, state: g.state,
    arena: first?.arena || '', att: first?.attendance || null,
    periods, team: { home: stat('home', 0), away: stat('away', 0) },
    goals: goals.sort(byTime), pens: pens.sort(byTime), shots, box, gk,
  };
}

const gameDetails = {};
const toFetch = [];
for (const g of cur.games) {
  const file = `cache/games/${g.id}.json`;
  if (isFinal(g) && existsSync(file)) gameDetails[g.id] = readJson(file);
  else if (g.state !== 'pre-game') toFetch.push(g); // finished but not cached yet, or live
}
let gameFails = 0;
await inBatches(toFetch, 3, async (g) => {
  try {
    const d = await fetchGame(g);
    gameDetails[g.id] = d;
    if (isFinal(g)) writeJson(`cache/games/${g.id}.json`, d);
  } catch (e) { gameFails++; console.warn('game failed', g.id, e.message); }
});

// ---------- highlight videos ----------
// The SHL publishes a highlights package and one clip per goal on its Staylive channel.
// We store ids and thumbnails and embed the official player; no video is copied.
// Clips appear a while after the final horn, so games under three days old without a
// highlights package are checked again on later runs.
const videos = {};
let vidFails = 0;
const gameTime = (g) => Date.parse(g.start.replace(' ', 'T') + '+02:00');
await inBatches(cur.games.filter(isFinal), 4, async (g) => {
  const file = `cache/videos/${g.id}.json`;
  const cached = readJson(file, null);
  if (cached && (cached.hl || Date.now() - gameTime(g) > 3 * 864e5)) { videos[g.id] = cached; return; }
  try {
    const r = await get(`/media/videos-for-game?gameUuid=${g.id}`);
    const items = (r.items || []).filter((v) => !v.locked).map((v) => ({
      id: v.id, name: v.name || '', desc: v.description || '', tags: v.tags || [],
      thumb: v.thumbnail || v.renderedMedia?.url || '', embed: v.renderedMedia?.videourl || '',
      dur: (v.duration?.h || 0) * 3600 + (v.duration?.m || 0) * 60 + (v.duration?.s || 0),
    }));
    const hl = items.find((v) => v.tags.includes('custom.highlights')) || null;
    const clips = items.filter((v) => v.tags.some((t) => t.startsWith('goal.')));
    videos[g.id] = { hl, clips };
    writeJson(file, videos[g.id]);
  } catch (e) { vidFails++; if (cached) videos[g.id] = cached; }
});
const clipOf = (d, goal) => videos[d.id]?.clips.find((c) => c.tags.includes(`goal.${goal.score[0]}-${goal.score[1]}`));
const slimClip = (c) => c && { id: c.id, thumb: c.thumb, embed: c.embed, dur: c.dur };

// ---------- model ----------
const played = cur.games.filter(isFinal);
const prevPlayed = prev.games.filter(isFinal);
const model = buildRatings(prevPlayed, played, codes);
const remaining = cur.games.filter((g) => !isFinal(g));
const sim = simulate(model, cur.standings, remaining, codes, 10000);
const games = cur.games.map((g) => ({
  ...g,
  ph: isFinal(g) ? undefined : Math.round(winProb(model, g.home, g.away) * 1000) / 1000,
  hv: videos[g.id]?.hl || videos[g.id]?.clips.length ? 1 : undefined, // game has video
}));

// Odds history: one entry per day, updated only when new results have come in
const HISTORY = 'history/odds.json';
const history = readJson(HISTORY, { days: {} });
const lastDay = Object.keys(history.days).sort().pop();
if (!lastDay || history.days[lastDay].played !== played.length) {
  history.days[stockholmDate()] = {
    played: played.length,
    t: Object.fromEntries(codes.map((c) => [c, [sim[c].top6, sim[c].top10, sim[c].gold, sim[c].proj]])),
  };
  writeJson(HISTORY, history);
}

// ---------- rosters and headshots ----------
const pickSize = (srcset, want) => {
  const set = (srcset || '').split(/,\s*(?=https)/).map((s) => {
    const t = s.trim(), i = t.lastIndexOf(' ');
    return { w: parseInt(t.slice(i + 1)), url: t.slice(0, i) };
  }).filter((x) => x.w);
  return set.find((x) => x.w >= want)?.url;
};
const headshots = {};
const rosters = {};
await inBatches(codes, 4, async (code) => {
  const uuid = cur.teams[code].uuid;
  try {
    const groups = await get(`/sports-v2/athletes/by-team-uuid/${uuid}`);
    rosters[code] = groups.flatMap((grp) => grp.players.map((p) => {
      const srcset = p.renderedLatestPortrait?.srcset;
      const sm = pickSize(srcset, 100), lg = pickSize(srcset, 280);
      if (sm && lg) headshots[p.uuid] = [sm, lg];
      return { id: p.uuid, name: p.fullName, num: p.jerseyNumber, pos: grp.positionCode, nat: p.nationality };
    }));
  } catch (e) { console.warn('roster failed', code, e.message); rosters[code] = []; }
});
// Players not on a current roster (moved on, retired) resolve through the media service once, then stay cached
const HS_CACHE = 'cache/headshots.json';
const hsCache = readJson(HS_CACHE, {});
const mediaOf = {};
for (const s of [cur, prev]) for (const p of [...s.skaters, ...s.goalies]) if (p.ms) mediaOf[p.id] ??= p.ms;
const todo = [...new Set(Object.entries(mediaOf).filter(([id, ms]) => !headshots[id] && !(ms in hsCache)).map(([, ms]) => ms))];
let hsFails = 0;
await inBatches(todo, 6, async (ms) => {
  try {
    const r = await get(`/media/render?mediaString=${encodeURIComponent(ms)}&isCroppingEnabled=false`);
    const sm = pickSize(r.srcset, 100), lg = pickSize(r.srcset, 280);
    hsCache[ms] = sm && lg ? [sm, lg] : null;
  } catch { hsFails++; }
});
writeJson(HS_CACHE, hsCache);
for (const [id, ms] of Object.entries(mediaOf)) if (!headshots[id] && hsCache[ms]) headshots[id] = hsCache[ms];

// ---------- aggregates from game details ----------
const teamStats = Object.fromEntries(codes.map((c) => [c, { gp: 0, gf: 0, ga: 0, sog: 0, sa: 0, ppg: 0, ppo: 0, ppga: 0, pko: 0, shg: 0, fow: 0, fol: 0, hits: 0, blk: 0, pim: 0 }]));
const gamelogs = {}, goalieLogs = {};
const lineups = {};
const detailsByDate = Object.values(gameDetails).filter((d) => isFinal(d)).sort((a, b) => a.start.localeCompare(b.start));
for (const d of detailsByDate) {
  for (const side of ['home', 'away']) {
    const other = side === 'home' ? 'away' : 'home';
    const code = d[side], opp = d[other], T = teamStats[code];
    const me = d.team[side] || {}, them = d.team[other] || {};
    if (T) {
      T.gp++; T.gf += side === 'home' ? d.hs : d.as; T.ga += side === 'home' ? d.as : d.hs;
      T.sog += me.SOG || 0; T.sa += them.SOG || 0; T.ppg += me.PPG || 0; T.ppo += me.NumPP || 0;
      T.ppga += me.PPGA || 0; T.pko += me.NumSH || 0; T.shg += me.SHG || 0;
      T.fow += me.FOW || 0; T.fol += them.FOW || 0; T.hits += me.Hits || 0; T.blk += me.BkS || 0; T.pim += me.PIM || 0;
    }
    const won = side === 'home' ? d.hs > d.as : d.as > d.hs;
    for (const r of d.box[side] || []) if (r.id) (gamelogs[r.id] ??= []).push([d.id, code, opp, side === 'home' ? 1 : 0, r.g, r.a, r.pm, r.toi, r.sog, r.pim, r.hits, r.blk]);
    for (const r of d.gk[side] || []) if (r.id && r.soga > 0) (goalieLogs[r.id] ??= []).push([d.id, code, opp, side === 'home' ? 1 : 0, r.ga, r.soga, r.svs, won ? 1 : 0]);
    // The most recent game's line combinations become the projected lineup
    const lineRef = (r) => ({ id: r.id, name: r.name, num: r.num, pos: r.pos });
    const F = {}, D = {};
    for (const r of d.box[side] || []) {
      if (!r.line) continue;
      if (['LD', 'RD', 'D'].includes(r.pos)) (D[r.line] ??= []).push(lineRef(r));
      else (F[r.line] ??= []).push(lineRef(r));
    }
    const order = { LW: 0, CE: 1, C: 1, RW: 2, F: 1, LD: 0, RD: 1, D: 0 };
    for (const grp of [F, D]) for (const k in grp) grp[k].sort((a, b) => (order[a.pos] ?? 1) - (order[b.pos] ?? 1));
    const G = [...(d.gk[side] || [])].sort((a, b) => (b.soga > 0) - (a.soga > 0) || a.line - b.line).map((r) => ({ id: r.id, name: r.name, num: r.num, pos: 'GK' }));
    lineups[code] = { gid: d.id, date: d.start.slice(0, 10), opp, F, D, G };
  }
}

// ---------- career rows across the loaded seasons ----------
const career = {}, goalieCareer = {};
for (const s of SEASONS) {
  for (const p of s.skaters) (career[p.id] ??= []).push([s.label, p.team, p.gp, p.g, p.a, p.pts, p.pm, p.pim, p.sog, p.toi, p.ppg]);
  for (const p of s.goalies) (goalieCareer[p.id] ??= []).push([s.label, p.team, p.gpi, p.sv, p.ga, p.svp, p.gaa, p.so, p.w_, p.l, Math.round(p.mins)]);
}
// Bio for everyone in the loaded seasons (newest season wins)
const bios = {};
for (const s of [...SEASONS].reverse()) for (const p of [...s.skaters, ...s.goalies]) {
  bios[p.id] = { name: p.name, num: p.num, pos: p.pos, born: p.born, nat: p.nat, team: p.team, h: p.h, w: p.w, last: s.label };
}

// ---------- goal clip index ----------
const goalClips = {}; // player id → [[gameId, clipId, thumb, embed, date, opponent]]
const allClips = [];
for (const d of detailsByDate) {
  for (const x of d.goals) {
    const c = clipOf(d, x);
    if (!c) continue;
    const team = d[x.team], opp = x.team === 'home' ? d.away : d.home;
    allClips.push({ gid: d.id, date: d.start, p: x.p, t: x.t, team, opp, score: x.score, scorer: x.scorer, ...slimClip(c) });
    if (x.scorer?.id) (goalClips[x.scorer.id] ??= []).push([d.id, c.id, c.thumb, c.embed, d.start.slice(0, 10), opp]);
  }
}
allClips.sort((a, b) => b.date.localeCompare(a.date) || b.p - a.p || b.t.localeCompare(a.t));
const highlights = detailsByDate.filter((d) => videos[d.id]?.hl).reverse().slice(0, 12)
  .map((d) => ({ gid: d.id, date: d.start, home: d.home, away: d.away, hs: d.hs, as: d.as, ...slimClip(videos[d.id].hl) }));

// ---------- write site ----------
const strip = (rows) => rows.map(({ ms, ...r }) => r);
const core = {
  updated: new Date().toISOString(),
  seasonOrder: SEASONS.map((s) => s.label),
  cur: cur.label, prev: prev.label,
  teams: Object.fromEntries(Object.entries({ ...Object.assign({}, ...SEASONS.slice(1).map((s) => s.teams)), ...cur.teams }).map(([c, t]) => [c, { code: c, name: t.name, logo: t.logo }])),
  currentTeams: codes,
  games, standings: cur.standings, sim, model,
  history: history.days,
  seasons: { [cur.label]: { skaters: strip(cur.skaters), goalies: strip(cur.goalies) }, [prev.label]: { skaters: strip(prev.skaters), goalies: strip(prev.goalies) } },
  teamStats, lineups, rosters, headshots,
  pastStandings: Object.fromEntries(SEASONS.map((s) => [s.label, s.standings])),
  pastGames: SEASONS.slice(1).flatMap((s) => s.games.filter(isFinal).map((g) => [s.label, g.start.slice(0, 10), g.home, g.away, g.hs, g.as, g.ot || g.so ? 1 : 0])),
  recentClips: allClips.slice(0, 16),
  highlights,
  // Site logo supplied by the owner in src/ (the page falls back to its built-in mark)
  logo: ['logo.svg', 'logo.png'].find((f) => existsSync(`src/${f}`)) || null,
};
mkdirSync('site/data/games', { recursive: true });
writeJson('site/data/core.json', core);
writeJson('site/data/players.json', { bios, career, goalieCareer, gamelogs, goalieLogs, goalClips });
for (const d of Object.values(gameDetails)) {
  const v = videos[d.id];
  writeJson(`site/data/games/${d.id}.json`, {
    ...d,
    goals: d.goals.map((x) => ({ ...x, clip: slimClip(clipOf(d, x)) || undefined })),
    hl: slimClip(v?.hl) || null,
  });
}
for (const f of readdirSync('src')) cpSync(`src/${f}`, `site/${f}`);
// Stamp every build with a version so browsers never mix a new page with an old cached stylesheet,
// script or data file after an update
const BUILD = Date.now().toString(36);
writeFileSync('site/index.html', readFileSync('site/index.html', 'utf8')
  .replace('href="styles.css"', `href="styles.css?v=${BUILD}"`)
  .replace('<script src="app.js"></script>', `<script>window.SHL_BUILD = '${BUILD}';</script>\n<script src="app.js?v=${BUILD}"></script>`));
writeFileSync('site/.nojekyll', '');

const rosterIds = new Set(Object.values(rosters).flat().map((p) => p.id));
const matched = cur.skaters.filter((p) => rosterIds.has(p.id)).length;
console.log([
  `Seasons: ${SEASONS.map((s) => `${s.label} (${s.state})`).join(', ')}`,
  `Games: ${games.length}, played ${played.length}, details ${Object.keys(gameDetails).length} (${toFetch.length} fetched, ${gameFails} failed)`,
  `Videos: ${Object.keys(videos).length} games, ${allClips.length} goal clips, ${highlights.length} highlight packages (${vidFails} failed)`,
  `Headshots: ${Object.keys(headshots).length} (${todo.length} looked up, ${hsFails} failed); roster ids matching stats: ${matched}/${cur.skaters.length}`,
  `Unmatched game players: ${Object.values(gameDetails).flatMap((d) => [...d.box.home, ...d.box.away]).filter((r) => !r.id).length}`,
].join('\n'));
