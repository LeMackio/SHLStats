// Pulls SHL data from shl.se's public API and builds the site into ./site.
// Run: node fetch-data.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const API = 'https://www.shl.se/api';

const get = async (path) => {
  const res = await fetch(API + path, { headers: { 'user-agent': 'SHLstats (fan site data refresh)' } });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
};

const toSec = (t) => {
  if (!t || typeof t !== 'string' || !t.includes(':')) return 0;
  const [m, s] = t.split(':').map(Number);
  return m * 60 + s;
};

// ---------- find the current and previous SHL regular seasons ----------
const filter = await get('/sports-v2/season-series-game-types-filter');
const SERIES = filter.series.find((s) => s.code === 'SHL').uuid;
const REGULAR = filter.gameType.find((g) => g.code === 'regular').uuid;
const latest = await get(`/sports-v2/latest-ssgt/${SERIES}`);

const schedule = (seasonUuid) =>
  get(`/sports-v2/game-schedule?seasonUuid=${seasonUuid}&seriesUuid=${SERIES}&gameTypeUuid=${REGULAR}&gamePlace=all&played=all`);

const SEASONS = [];
for (const s of [...filter.season].sort((a, b) => b.code - a.code)) {
  if (SEASONS.length === 2) break;
  const sched = await schedule(s.uuid);
  if (!sched.gameInfo?.length) continue; // season announced but no schedule yet
  const y = Number(s.code);
  const ssgt = sched.gameInfo[0].ssgtUuid;
  SEASONS.push({
    label: `${String(y % 100).padStart(2, '0')}-${String((y + 1) % 100).padStart(2, '0')}`,
    season: s.uuid, ssgt, sched,
    state: ssgt === latest.uuid && latest.state === 'active' ? 'active' : 'closed',
  });
}
if (SEASONS.length < 2) throw new Error('Could not find two SHL seasons with schedules');
const [cur, prev] = SEASONS;

// ---------- games ----------
const teams = {};
const games = cur.sched.gameInfo.map((g) => {
  for (const t of [g.homeTeamInfo, g.awayTeamInfo]) teams[t.code] ??= { code: t.code, name: t.names.long || t.names.full };
  return {
    id: g.uuid, start: g.startDateTime, state: g.state, ot: g.overtime, so: g.shootout,
    home: g.homeTeamInfo.code, away: g.awayTeamInfo.code,
    hs: g.homeTeamInfo.score, as: g.awayTeamInfo.score,
  };
});
// Last season's results seed the team-strength priors for the projection model.
const prevTeams = {};
const prevGames = prev.sched.gameInfo.filter((g) => g.state === 'post-game').map((g) => {
  for (const t of [g.homeTeamInfo, g.awayTeamInfo]) prevTeams[t.code] ??= { code: t.code, name: t.names.long || t.names.full };
  return { home: g.homeTeamInfo.code, away: g.awayTeamInfo.code, hs: g.homeTeamInfo.score, as: g.awayTeamInfo.score };
});

// ---------- standings ----------
const standingsRaw = await get(`/statistics-v2/league-standings?ssgtUuid=${cur.ssgt}`);
const standings = {
  groupings: (standingsRaw.groupings || []).map((g) => ({ label: g.description, first: g.first, last: g.last })),
  rows: (standingsRaw.leagueStandings || []).map((r) => ({
    code: r.info.teamInfo.teamNames.code, gp: r.GP, w: r.W, otw: r.OTW, l: r.L, otl: r.OTL,
    gf: r.G, ga: r.GA, pts: r.Points,
  })),
};

// ---------- player stats ----------
const statsModule = async (mod, s) => {
  const [r] = await get(`/statistics-v2/stats-info/${mod}?count=1000&ssgtUuid=${s.ssgt}&provider=statnet&state=${s.state}&moduleType=summary`);
  return r?.stats ?? [];
};
const skaterRow = (r) => ({
  id: r.info.uuid, name: r.info.fullName, num: r.info.number, pos: r.info.position,
  born: r.info.birthDate, nat: r.info.nationality, team: r.info.teamCode,
  gp: r.GP, g: r.G, a: r.A, pts: r.TP, pim: r.PIM, ppg: r.PPG, gwg: r.GWG,
  sog: r.SOG, hits: r.Hits, blk: r.BkS, pm: r.PlusMinus, toi: toSec(r.TOI_GP),
});
const goalieRow = (r) => ({
  id: r.info.uuid, name: r.info.fullName, num: r.info.number, born: r.info.birthDate,
  nat: r.info.nationality, team: r.info.teamCode,
  gpi: r.GPI, sv: r.SVS, ga: r.GA, svp: parseFloat(r.SVSPerc) || 0, gaa: parseFloat(r.GAA) || 0,
  w: r.W, l: r.L, so: r.SO, mins: toSec(r.MIP) / 60,
});
const seasons = {};
for (const s of SEASONS) {
  seasons[s.label] = {
    skaters: (await statsModule('players_summary', s)).map(skaterRow),
    goalies: (await statsModule('goalkeepers_summary', s)).map(goalieRow),
  };
}

// ---------- build ----------
const data = {
  updated: new Date().toISOString(), seasonOrder: [cur.label, prev.label],
  teams, prevTeams, games, prevGames, standings, seasons,
};
const dataJs = 'window.SHL_DATA = ' + JSON.stringify(data).replace(/</g, '\\u003c') + ';';
const page = readFileSync('template.html', 'utf8').replace('/*__DATA__*/', () => dataJs);
mkdirSync('site', { recursive: true });
writeFileSync('site/index.html',
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<meta name="description" content="SHL standings, playoff odds, player cards, leaderboards and goalie stats.">\n' +
  '<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n' + page + '\n</body>\n</html>\n');
writeFileSync('site/.nojekyll', '');

console.log(`Built site/index.html · seasons ${SEASONS.map((s) => `${s.label} (${s.state})`).join(', ')} · ` +
  `${games.length} games · ` +
  Object.entries(seasons).map(([k, v]) => `${k}: ${v.skaters.length} skaters, ${v.goalies.length} goalies`).join('; '));
