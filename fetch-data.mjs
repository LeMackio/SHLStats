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
import { processShots, trainXG, zoneOf } from './edge.mjs';

const API = 'https://www.shl.se/api';
const N_SEASONS = 5;      // current + 4 previous: past standings, head-to-head and team history
const MAX_CAREER = 25;    // player careers go back as far as shl.se has stats (at most this many seasons)
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
// The feed calls the shootout period "shootout"; everywhere else it is period 5
const periodNo = (p) => typeof p === 'number' ? p : /shoot/i.test(String(p)) ? 5 : Number(p) || 0;

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
    for (const t of [g.homeTeamInfo, g.awayTeamInfo]) teams[t.code] ??= { code: t.code, name: t.names.long || t.names.full, short: t.names.short || '', logo: t.icon, uuid: t.uuid };
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
    label, code: s.code, uuid: s.uuid, ssgt, state, teams, games, standings,
    skaters: (await statsModule('players_summary')).map(skaterRow).filter((p) => p.pos !== 'GK'),
    goalies: (await statsModule('goalkeepers_summary')).map(goalieRow),
  };
  if (state === 'closed' && season.skaters.length) writeJson(cacheFile, season);
  return season;
}

// Every season shl.se has stats for (finished seasons are cached, so this is a one-time download).
// The site's tables and history use the latest N_SEASONS; player careers use all of them.
const ALL_SEASONS = [];
for (const s of [...filter.season].sort((a, b) => b.code - a.code)) {
  if (ALL_SEASONS.length === MAX_CAREER) break;
  let season = null;
  try { season = await loadSeason(s); } catch (e) { console.warn('season failed', s.code, e.message); }
  if (season && (ALL_SEASONS.length < 2 || season.skaters.length)) ALL_SEASONS.push(season);
}
const SEASONS = ALL_SEASONS.slice(0, N_SEASONS);
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
        p: periodNo(e.period), t: e.time, team: side, scorer: pRef(e.player, side),
        a1: pRef(e.assists?.first, side), a2: pRef(e.assists?.second, side),
        str: e.goalStatus || 'EQ', en: !!e.isEmptyNetGoal, ps: !!e.isPenaltyShot,
        score: [e.homeGoals, e.awayGoals], x: e.locationX, y: e.locationY,
      });
    } else if (e.type === 'penalty') {
      pens.push({ p: periodNo(e.period), t: e.time, team: side, player: pRef(e.player, side), desc: e.variant?.description || '', off: e.offence || '' });
    } else if (e.type === 'shot' && e.goalSection > 0) { // on goal only; the feed's shot events also include blocked and missed shots
      shots.push({ p: periodNo(e.period), t: e.time, team: side, x: e.locationX, y: e.locationY });
    }
  }
  const stat = (side, period) => Object.fromEntries((ts[side]?.statistics?.find((s) => s.period === period)?.parsedTotalStatistics || []).map((k) => [k.key, k.value]));
  const periods = (ts.home?.statistics || []).map((s) => s.period).filter((p) => p > 0).sort()
    .map((p) => ({ p, h: stat('home', p).G ?? 0, a: stat('away', p).G ?? 0, hs: stat('home', p).SOG ?? 0, as: stat('away', p).SOG ?? 0 }));
  const first = Array.isArray(pbp) ? pbp[0] : null;
  return {
    v: 2, // cache version: 2 = shots on goal only
    id: g.id, start: g.start, home: g.home, away: g.away, hs: g.hs, as: g.as, ot: g.ot, so: g.so, state: g.state,
    arena: first?.arena || '', att: first?.attendance || null,
    periods, team: { home: stat('home', 0), away: stat('away', 0) },
    goals: goals.sort(byTime), pens: pens.sort(byTime), shots, box, gk,
  };
}

// The feed's shots on goal are right when each team's shots minus goals equals the other goalie's saves
const sogOk = (d) => ['home', 'away'].every((side) => {
  const me = d.team?.[side] || {}, them = d.team?.[side === 'home' ? 'away' : 'home'] || {};
  return me.SOG > me.G && them.Saves === me.SOG - me.G;
});
const gameDetails = {};
const toFetch = [];
for (const g of cur.games) {
  const file = `cache/games/${g.id}.json`;
  if (isFinal(g) && existsSync(file) && readJson(file).v === 2) {
    const d = readJson(file); // older cached games may still say "shootout"
    for (const k of ['goals', 'pens', 'shots']) d[k] = d[k].map((x) => ({ ...x, p: periodNo(x.p) })).sort((a, b) => a.p - b.p || String(a.t).localeCompare(String(b.t)));
    gameDetails[g.id] = d;
  }
  else if (g.state !== 'pre-game') toFetch.push(g); // finished but not cached yet, or live
}
let gameFails = 0;
await inBatches(toFetch, 3, async (g) => {
  try {
    const d = await fetchGame(g);
    gameDetails[g.id] = d;
    // Cache once the official shot numbers are consistent (the feed sometimes fixes them a while after the game)
    if (isFinal(g) && (sogOk(d) || Date.now() - Date.parse(g.start.replace(' ', 'T') + '+02:00') > 2 * 864e5)) writeJson(`cache/games/${g.id}.json`, d);
  } catch (e) { gameFails++; console.warn('game failed', g.id, e.message); }
});

// The feed's "SOG" (shots on goal) field actually counts goals, so shots on goal are counted from the
// play-by-play instead: shots on goal (goalSection > 0) plus goals, per period and in total. Saves follow from them.
for (const d of Object.values(gameDetails)) {
  if (sogOk(d)) continue; // the feed's own numbers are the official ones
  const sog = (side, p) => d.shots.filter((x) => x.team === side && x.p < 5 && (p == null || x.p === p)).length
    + d.goals.filter((x) => x.team === side && x.p < 5 && (p == null || x.p === p)).length; // SHL counts empty-net goals as shots on goal too
  for (const side of ['home', 'away']) d.team[side] = { ...d.team[side], SOG: sog(side) };
  for (const side of ['home', 'away']) {
    const other = side === 'home' ? 'away' : 'home';
    d.team[side].Saves = d.team[other].SOG - d.goals.filter((x) => x.team === other && x.p < 5).length;
  }
  d.periods = d.periods.map((p) => (p.p < 5 ? { ...p, hs: sog('home', p.p), as: sog('away', p.p) } : p));
}

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

// ---------- shot data and xG (Avancerat page) ----------
// Every shot on goal from this season and last season, with shooter, goalie and context.
// Finished games never change, so each is fetched once and cached in cache/shots/.
const shotGames = {}; // game id → { season, home, away, start, shots }
let shotFails = 0, strAgree = 0, strChecked = 0;
const shotTodo = [];
for (const s of [cur, prev]) for (const g of s.games.filter(isFinal)) {
  const file = `cache/shots/${g.id}.json`;
  const cached = readJson(file, null);
  if (cached?.v === 2) shotGames[g.id] = { ...cached, season: s.label };
  else shotTodo.push([s, g]);
}
await inBatches(shotTodo, 4, async ([s, g]) => {
  try {
    const { shots, strengthCheck } = processShots(await get(`/gameday/play-by-play/${g.id}`));
    const entry = { v: 2, home: g.home, away: g.away, start: g.start, shots, strengthCheck };
    writeJson(`cache/shots/${g.id}.json`, entry);
    shotGames[g.id] = { ...entry, season: s.label };
  } catch (e) { shotFails++; }
});
for (const sg of Object.values(shotGames)) { strAgree += sg.strengthCheck?.[0] || 0; strChecked += sg.strengthCheck?.[1] || 0; }
// Older cached games marked some saved shots as empty-net when the goalie feed had gaps; a saved shot always had a goalie in net
// Shootout attempts are not shots in the game; older cached games kept them with the period "shootout"
for (const sg of Object.values(shotGames)) sg.shots = sg.shots.filter((sh) => typeof sh.p === 'number' && sh.p < 5);
let enFixed = 0;
for (const sg of Object.values(shotGames)) for (const sh of sg.shots) if (!sh.g && sh.en) { sh.en = 0; enFixed++; }
const allShots = Object.values(shotGames).flatMap((sg) => sg.shots);
const xgModel = trainXG(allShots);

// Current-season aggregates for players, goalies and teams
const edgeIds = [], edgeIdx = new Map();
const idIndex = (id) => { if (!edgeIdx.has(id)) { edgeIdx.set(id, edgeIds.length); edgeIds.push(id); } return edgeIdx.get(id); };
const eSk = {}, eGk = {}, eTeam = {}, eShots = [];
const gameXg = {}; // game id → [xG home, xG away, dangerous chances home, away, shots home, away]
const eGames = [], eGameIdx = new Map(), eClips = [];
const xgByClip = {}; // goal video id → [xG, empty net] for the Media page
const gameIndex = (gid, sg) => { if (!eGameIdx.has(gid)) { eGameIdx.set(gid, eGames.length); eGames.push([gid, sg.home, sg.away, sg.start.slice(0, 10)]); } return eGameIdx.get(gid); };
const league = { sa: 0, ga: 0, xga: 0, hd: [0, 0], md: [0, 0], ld: [0, 0] };
for (const [gid, sg] of Object.entries(shotGames)) {
  if (sg.season !== cur.label) continue;
  for (const code of [sg.home, sg.away]) (eTeam[code] ??= { gp: 0, sf: 0, gf: 0, xgf: 0, sa: 0, ga: 0, xga: 0, hdf: 0, hda: 0 }).gp++;
  for (const sh of sg.shots) {
    if (sh.p >= 5 || sh.ps) continue;
    const team = sg[sh.side], opp = sh.side === 'home' ? sg.away : sg.home;
    const xg = xgModel.predict(sh), zone = zoneOf(xg);
    const shooter = sh.shooter ? refFor(sh.shooter, team, sh.num).id : null;
    // When the feed doesn't say who was in net, credit the goalie who faced most of that team's shots
    const mainGoalie = () => [...(gameDetails[gid]?.gk?.[sh.side === 'home' ? 'away' : 'home'] || [])].sort((a, b) => b.soga - a.soga)[0]?.id || null;
    const goalieId = sh.en ? null : sh.goalie ? refFor(sh.goalie, opp).id : mainGoalie();
    const T = eTeam[team], O = eTeam[opp];
    const GX = (gameXg[gid] ??= [0, 0, 0, 0, 0, 0]), hi = sh.side === 'home' ? 0 : 1;
    GX[hi] += xg; GX[hi + 4]++; if (zone === 'hd') GX[hi + 2]++;
    T.sf++; T.gf += sh.g; T.xgf += xg; O.sa++; O.ga += sh.g; O.xga += xg;
    if (zone === 'hd') { T.hdf++; O.hda++; }
    if (shooter) {
      const P = (eSk[shooter] ??= { sog: 0, g: 0, xg: 0, hd: 0, hdg: 0, dist: 0, long: 0 });
      P.sog++; P.g += sh.g; P.xg += xg; P.dist += sh.d;
      if (zone === 'hd') { P.hd++; P.hdg += sh.g; }
      if (sh.g && !sh.en) P.long = Math.max(P.long, sh.d);
    }
    if (!sh.en) { // goalie numbers only count shots with a goalie in net
      league.sa++; league.ga += sh.g; league.xga += xg; league[zone][0]++; league[zone][1] += sh.g;
      if (goalieId) {
        const G = (eGk[goalieId] ??= { sa: 0, ga: 0, xga: 0, hd: [0, 0], md: [0, 0], ld: [0, 0] });
        G.sa++; G.ga += sh.g; G.xga += xg; G[zone][0]++; G[zone][1] += sh.g;
      }
    }
    // Compact shot list for the shot maps: shooter, goalie, x, y, goal, xG in thousandths, shooting team, empty net,
    // game state (0 even, 1 powerplay, 2 shorthanded), game, goal video (index into edge.clips, -1 if none)
    let clip = -1;
    if (sh.g) {
      const d = gameDetails[gid], goal = d?.goals.find((x) => x.p === sh.p && (x.p - 1) * 1200 + toSec(x.t) === sh.s);
      const c = goal && slimClip(clipOf(d, goal));
      if (c) { clip = eClips.length; eClips.push([c.embed, c.thumb]); xgByClip[c.id] = [Math.round(xg * 1000) / 1000, sh.en ? 1 : 0]; }
    }
    eShots.push([shooter ? idIndex(shooter) : -1, goalieId ? idIndex(goalieId) : -1, sh.x, sh.y, sh.g, Math.round(xg * 1000), team, sh.en,
      sh.str === 'PP' ? 1 : sh.str === 'SH' ? 2 : 0, gameIndex(gid, sg), clip]);
  }
}
const r3 = (x) => Math.round(x * 1000) / 1000;
const edge = {
  updated: new Date().toISOString(), season: cur.label,
  model: { ...xgModel.report, coef: xgModel.coef, zones: { hd: 0.15, md: 0.07 }, trainedOn: [cur.label, prev.label] },
  league: { ...league, xga: r3(league.xga) },
  ids: edgeIds,
  skaters: Object.fromEntries(Object.entries(eSk).map(([id, P]) => [id, [P.sog, P.g, r3(P.xg), P.hd, P.hdg, r3(P.dist / P.sog), r3(P.long)]])),
  goalies: Object.fromEntries(Object.entries(eGk).map(([id, G]) => [id, [G.sa, G.ga, r3(G.xga), ...G.hd, ...G.md, ...G.ld]])),
  teams: Object.fromEntries(Object.entries(eTeam).map(([c, T]) => [c, [T.gp, T.sf, T.gf, r3(T.xgf), T.sa, T.ga, r3(T.xga), T.hdf, T.hda]])),
  shots: eShots,
  games: eGames,  // [id, home, away, date]
  clips: eClips,  // [embed, thumb]
};

// ---------- model ----------
const played = cur.games.filter(isFinal);
const prevPlayed = prev.games.filter(isFinal);
const model = buildRatings(prevPlayed, played, codes);
const remaining = cur.games.filter((g) => !isFinal(g));
const sim = simulate(model, cur.standings, remaining, codes, 10000);
// Arenas: played games have theirs in the play-by-play; games in the next three weeks are looked up
// once via game-info (cached); anything further ahead uses the home team's usual arena.
const ARENA_CACHE = 'cache/arenas.json';
const arenaCache = readJson(ARENA_CACHE, {});
for (const d of Object.values(gameDetails)) if (d.arena) arenaCache[d.id] = d.arena;
const soon = Date.now() + 21 * 864e5;
await inBatches(cur.games.filter((g) => !isFinal(g) && !arenaCache[g.id] && gameTime(g) < soon), 4, async (g) => {
  try { const r = await get(`/sports-v2/game-info/${g.id}`); if (r?.gameInfo?.arenaName) arenaCache[g.id] = r.gameInfo.arenaName; } catch {}
});
writeJson(ARENA_CACHE, arenaCache);
const homeArena = {}; // most common known arena for each team's home games
for (const g of cur.games) {
  const a = arenaCache[g.id]; if (!a) continue;
  const m = (homeArena[g.home] ??= {}); m[a] = (m[a] || 0) + 1;
}
const usualArena = (code) => Object.entries(homeArena[code] || {}).sort((a, b) => b[1] - a[1])[0]?.[0];

const games = cur.games.map((g) => ({
  ...g,
  ph: isFinal(g) ? undefined : Math.round(winProb(model, g.home, g.away) * 1000) / 1000,
  hv: videos[g.id]?.hl || videos[g.id]?.clips.length ? 1 : undefined, // game has video
  arena: arenaCache[g.id] || usualArena(g.home) || undefined,
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
      const sm = pickSize(srcset, 100), lg = pickSize(srcset, 640) || pickSize(srcset, 280);
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

// ---------- SHL news ----------
// The 5 latest items from shl.se's news list: headline, the SHL's own short intro, image and date.
// The site links to the full article on shl.se instead of copying it.
const NEWS_IMG_CACHE = 'cache/news-images.json';
const newsImgCache = readJson(NEWS_IMG_CACHE, {});
let news = [], shlArticles = [];
const articleOf = (a, host) => {
  const m = Array.isArray(a.mainMedia) ? a.mainMedia[0] : a.mainMedia;
  return {
    id: a.id, title: a.header.trim(), intro: (a.introRawText || a.intro || '').trim(), date: a.publishedAt,
    label: a.metadata?.label || '', ms: typeof m === 'string' ? m : m?.mediaString,
    url: a.externalUrl || `https://${host}/article/${a.id}/view`,
  };
};
try {
  const list = await get('/articles/site-news/list?page=0');
  shlArticles = (list?.data?.articleItems || []).filter((a) => a.header && !a.metadata?.isLocked).map((a) => articleOf(a, 'www.shl.se'));
  news = shlArticles.slice(0, 5);
  await inBatches(news.filter((n) => n.ms && !(n.ms in newsImgCache)), 3, async (n) => {
    try {
      const r = await get(`/media/render?mediaString=${encodeURIComponent(n.ms)}&isCroppingEnabled=false`);
      newsImgCache[n.ms] = pickSize(r.srcset, 1200) || r.url || null;
    } catch { newsImgCache[n.ms] = null; }
  });
  writeJson(NEWS_IMG_CACHE, newsImgCache);
  news = news.map(({ ms, ...n }) => ({ ...n, img: (ms && newsImgCache[ms]) || null }));
} catch (e) { console.warn('news failed', e.message); }

// ---------- team news ----------
// Each club's own site runs on the same platform as shl.se and has the same news list. We take the
// latest first-team items (headline, intro, image, link to the club's site) and add SHL articles that
// name the team. Linköping's site runs on another platform, so it only gets the SHL articles.
const CLUB_SITES = { BIF: 'www.brynas.se', DIF: 'www.difhockey.se', FBK: 'www.farjestadbk.se', FHC: 'www.frolundahockey.com', HV71: 'www.hv71.se',
  IFB: 'www.bjorkloven.com', LHF: 'www.luleahockey.se', MIF: 'www.malmoredhawks.com', OHK: 'www.orebrohockey.se', RBK: 'www.roglebk.se',
  SAIK: 'www.skellefteaaik.se', TIK: 'www.timraik.se', VLH: 'www.vaxjolakers.se', LIF: 'www.leksandsif.se', MODO: 'www.modohockey.se' };
const NOT_FIRST_TEAM = /\b(U\d{2}|J\d{2}|akademi\w*|junior\w*|SDHL|dam\w*|flick\w*|pojk\w*|ungdom\w*|TV-pucken|hockeyskola\w*)\b/i;
const teamNews = {};
let clubFails = 0;
await inBatches(codes, 4, async (code) => {
  const host = CLUB_SITES[code];
  let club = [];
  if (host) {
    try {
      const r = await fetch(`https://${host}/api/articles/site-news/list?page=0`, { headers: { 'user-agent': 'SHLstats (fan site data refresh)' } });
      if (!r.ok) throw new Error(r.status);
      const list = await r.json();
      club = (list?.data?.articleItems || []).filter((a) => a.header && !a.metadata?.isLocked && !NOT_FIRST_TEAM.test(a.header))
        .map((a) => ({ ...articleOf(a, host), src: host.replace(/^www\./, '') }));
    } catch { clubFails++; }
  }
  const names = [cur.teams[code].short, cur.teams[code].name].filter((n) => n && n.length > 2);
  const mentions = shlArticles.filter((a) => names.some((n) => new RegExp(`(^|[^\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(`${a.title} ${a.intro}`)))
    .map((a) => ({ ...a, src: 'shl.se' }));
  teamNews[code] = [...club, ...mentions].sort((a, b) => b.date.localeCompare(a.date)).filter((a, i, all) => all.findIndex((x) => x.title === a.title) === i).slice(0, 6);
});
const cardKey = (ms) => `card|${ms}`; // smaller image for the team page's news cards
await inBatches(Object.values(teamNews).flat().filter((n) => n.ms && !(cardKey(n.ms) in newsImgCache)), 6, async (n) => {
  try {
    const r = await get(`/media/render?mediaString=${encodeURIComponent(n.ms)}&isCroppingEnabled=false`);
    newsImgCache[cardKey(n.ms)] = pickSize(r.srcset, 640) || r.url || null;
  } catch { newsImgCache[cardKey(n.ms)] = null; }
});
writeJson(NEWS_IMG_CACHE, newsImgCache);
for (const code in teamNews) teamNews[code] = teamNews[code].map(({ ms, id, label, ...n }) => ({ ...n, intro: n.intro.slice(0, 220), img: (ms && newsImgCache[cardKey(ms)]) || null }));

// ---------- aggregates from game details ----------
const teamStats = Object.fromEntries(codes.map((c) => [c, { gp: 0, gf: 0, ga: 0, sog: 0, sa: 0, ppg: 0, ppo: 0, ppga: 0, pko: 0, shg: 0, fow: 0, fol: 0, hits: 0, blk: 0, pim: 0 }]));
const gamelogs = {}, goalieLogs = {}, teamLogs = {};
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
      // Game by game for the team page: id, home?, goals for/against, xG for/against, powerplay goals/chances, PP goals against/times shorthanded
      const X = gameXg[d.id], i = side === 'home' ? 0 : 1;
      (teamLogs[code] ??= []).push([d.id, i ? 0 : 1, side === 'home' ? d.hs : d.as, side === 'home' ? d.as : d.hs,
        X ? r3(X[i]) : null, X ? r3(X[1 - i]) : null, me.PPG || 0, me.NumPP || 0, me.PPGA || 0, me.NumSH || 0]);
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
// Older seasons often lack player IDs; match those rows to the player's ID by name and birth date
const idByNameBorn = new Map();
for (const s of ALL_SEASONS) for (const p of [...s.skaters, ...s.goalies]) if (p.id && p.born) idByNameBorn.set(`${norm(p.name)}|${p.born}`, p.id);
const pidOf = (p) => p.id || (p.born ? idByNameBorn.get(`${norm(p.name)}|${p.born}`) : null) || null;
for (const s of ALL_SEASONS) {
  for (const p of s.skaters) { const id = pidOf(p); if (id) (career[id] ??= []).push([s.label, p.team, p.gp, p.g, p.a, p.pts, p.pm, p.pim, p.sog, p.toi, p.ppg]); }
  for (const p of s.goalies) { const id = pidOf(p); if (id) (goalieCareer[id] ??= []).push([s.label, p.team, p.gpi, p.sv, p.ga, p.svp, p.gaa, p.so, p.w_, p.l, Math.round(p.mins)]); }
}
// Bio for everyone in the loaded seasons (newest season wins)
const bios = {};
for (const s of [...ALL_SEASONS].reverse()) for (const p of [...s.skaters, ...s.goalies]) {
  const id = pidOf(p); if (!id) continue;
  bios[id] = { name: p.name, num: p.num, pos: p.pos, born: p.born, nat: p.nat, team: p.team, h: p.h, w: p.w, last: s.label };
}

// ---------- goal clip index ----------
const goalClips = {}; // player id → [[gameId, clipId, thumb, embed, date, opponent]]
const allClips = [];
// The goal that decided the game: the winner's goal that put them one ahead of the loser's final total
const gwgOf = (d) => {
  if (d.so || d.hs === d.as) return null;
  const win = d.hs > d.as ? 'home' : 'away', l = Math.min(d.hs, d.as); let n = 0;
  for (const x of d.goals) if (x.p < 5 && x.team === win && ++n === l + 1) return x;
  return null;
};
for (const d of detailsByDate) {
  for (const x of d.goals) {
    const c = clipOf(d, x);
    if (!c) continue;
    const team = d[x.team], opp = x.team === 'home' ? d.away : d.home;
    allClips.push({ gid: d.id, date: d.start, p: x.p, t: x.t, team, opp, score: x.score, scorer: x.scorer, str: x.str, gwg: gwgOf(d) === x ? 1 : 0, ...slimClip(c) });
    if (x.scorer?.id) (goalClips[x.scorer.id] ??= []).push([d.id, c.id, c.thumb, c.embed, d.start.slice(0, 10), opp]);
  }
}
allClips.sort((a, b) => b.date.localeCompare(a.date) || b.p - a.p || b.t.localeCompare(a.t));
const highlights = detailsByDate.filter((d) => videos[d.id]?.hl).reverse().slice(0, 12)
  .map((d) => ({ gid: d.id, date: d.start, home: d.home, away: d.away, hs: d.hs, as: d.as, ...slimClip(videos[d.id].hl) }));

// ---------- write site ----------
const strip = (rows) => rows.map(({ ms, ...r }) => r);
// Rookies: no SHL games in the earlier loaded seasons, and at most 25 when the season starts
// (i = the season's place in ALL_SEASONS, 0 = current)
const markRookies = (rows, i = 0) => {
  const seenBefore = new Set(ALL_SEASONS.slice(i + 1).flatMap((s) => [...s.skaters, ...s.goalies].map(pidOf)).filter(Boolean));
  const startYear = Number(ALL_SEASONS[i].code);
  return rows.map((p) => {
    const age = p.born ? startYear - Number(p.born.slice(0, 4)) : 99;
    return !seenBefore.has(p.id) && age <= 25 ? { ...p, rk: 1 } : p;
  });
};
const core = {
  updated: new Date().toISOString(),
  seasonOrder: SEASONS.map((s) => s.label),
  cur: cur.label, prev: prev.label,
  teams: Object.fromEntries(Object.entries({ ...Object.assign({}, ...SEASONS.slice(1).map((s) => s.teams)), ...cur.teams }).map(([c, t]) => [c, { code: c, name: t.name, logo: t.logo }])),
  currentTeams: codes,
  games, standings: cur.standings, sim, model,
  history: history.days,
  seasons: { [cur.label]: { skaters: markRookies(strip(cur.skaters)), goalies: markRookies(strip(cur.goalies)) }, [prev.label]: { skaters: markRookies(strip(prev.skaters), 1), goalies: markRookies(strip(prev.goalies), 1) } },
  teamStats, lineups, rosters, headshots,
  pastStandings: Object.fromEntries(SEASONS.map((s) => [s.label, s.standings])),
  pastGames: SEASONS.slice(1).flatMap((s) => s.games.filter(isFinal).map((g) => [s.label, g.start.slice(0, 10), g.home, g.away, g.hs, g.as, g.ot || g.so ? 1 : 0])),
  recentClips: allClips.slice(0, 16),
  highlights,
  news,
  // What the live relay needs to ask shl.se for today's games
  live: { season: cur.uuid, series: SERIES, type: REGULAR },
};
mkdirSync('site/data/games', { recursive: true });
writeJson('site/data/core.json', core);
writeJson('site/data/players.json', { bios, career, goalieCareer, gamelogs, goalieLogs, goalClips });
writeJson('site/data/edge.json', edge);
writeJson('site/data/teams.json', { logs: teamLogs, news: teamNews });
// Media page (phones): goal videos from the last two weeks with their xG, and every highlights package this season
const mediaCut = Date.now() - 14 * 864e5;
writeJson('site/data/media.json', {
  clips: allClips.filter((c) => gameTime({ start: c.date }) > mediaCut).map((c) => ({ ...c, xg: xgByClip[c.id]?.[0] ?? null, en: xgByClip[c.id]?.[1] ?? 0 })),
  highlights: detailsByDate.filter((d) => videos[d.id]?.hl).reverse().map((d) => ({ gid: d.id, date: d.start, home: d.home, away: d.away, hs: d.hs, as: d.as, ...slimClip(videos[d.id].hl) })),
});
for (const d of Object.values(gameDetails)) {
  const v = videos[d.id], X = gameXg[d.id];
  writeJson(`site/data/games/${d.id}.json`, {
    ...d,
    xg: X ? X.map((x, i) => (i < 2 ? r3(x) : x)) : null,
    goals: d.goals.map((x) => ({ ...x, clip: slimClip(clipOf(d, x)) || undefined })),
    hl: slimClip(v?.hl) || null,
  });
}
for (const f of readdirSync('src')) cpSync(`src/${f}`, `site/${f}`, { recursive: true });
// Stamp every build with a version so browsers never mix a new page with an old cached stylesheet,
// script or data file after an update
const BUILD = Date.now().toString(36);
writeFileSync('site/index.html', readFileSync('site/index.html', 'utf8')
  .replace('href="styles.css"', `href="styles.css?v=${BUILD}"`)
  .replace('<script src="app.js"></script>', `<script>window.SHL_BUILD = '${BUILD}';</script>\n<script src="app.js?v=${BUILD}"></script>`));
writeFileSync('site/sw.js', readFileSync('site/sw.js', 'utf8').replaceAll('__BUILD__', BUILD));
writeFileSync('site/.nojekyll', '');

const rosterIds = new Set(Object.values(rosters).flat().map((p) => p.id));
const matched = cur.skaters.filter((p) => rosterIds.has(p.id)).length;
console.log([
  `Seasons: ${SEASONS.map((s) => `${s.label} (${s.state})`).join(', ')}; careers from ${ALL_SEASONS.length} seasons (${ALL_SEASONS[ALL_SEASONS.length - 1].label} onwards)`,
  `Games: ${games.length}, played ${played.length}, details ${Object.keys(gameDetails).length} (${toFetch.length} fetched, ${gameFails} failed)`,
  `Videos: ${Object.keys(videos).length} games, ${allClips.length} goal clips, ${highlights.length} highlight packages (${vidFails} failed)`,
  `Headshots: ${Object.keys(headshots).length} (${todo.length} looked up, ${hsFails} failed); roster ids matching stats: ${matched}/${cur.skaters.length}`,
  `Shots: ${allShots.length} from ${Object.keys(shotGames).length} games (${shotTodo.length} fetched, ${shotFails} failed); strength from penalty timeline matches ${strAgree}/${strChecked} official goal strengths`,
  `xG model: ${JSON.stringify(xgModel.report)} (${enFixed} saved shots no longer counted as empty-net)`,
  `xG weights: ${xgModel.coef.map((c) => `${c.name} ${c.weight}`).join(', ')}`,
  `Edge (${cur.label}): ${Object.keys(eSk).length} skaters, ${Object.keys(eGk).length} goalies, ${eShots.length} shots; unmatched shooters ${eShots.filter((s) => s[0] < 0).length}, unmatched goalies ${eShots.filter((s) => s[1] < 0 && !s[7]).length}`,
  `Team news: ${Object.entries(teamNews).map(([c, n]) => `${c} ${n.length}`).join(', ')} (${clubFails} club sites failed)`,
  `Unmatched game players:${Object.values(gameDetails).flatMap((d) => [...d.box.home, ...d.box.away]).filter((r) => !r.id).length}`,
].join('\n'));
