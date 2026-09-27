// SHLstats live relay: a Cloudflare Worker (free plan) that lets the site read live scores.
//
// shl.se's API can't be read directly by another website (it sends no CORS headers), so the site asks
// this relay instead. It only answers two questions, caches each answer for a few seconds so shl.se sees
// at most a handful of requests however many people watch, and trims the data to what the site needs.
//
//   /today?season=…&series=…&type=…   today's games: state and score
//   /game/<id>                          one game's goals, penalties and shots, plus the clock
//
// Setup: Cloudflare dashboard → Workers & Pages → Create → Worker → paste this file → Deploy.

const API = 'https://www.shl.se/api';
const SITES = ['https://shlstats.net', 'https://www.shlstats.net', 'https://lemackio.github.io', 'http://localhost:4323'];
const ID = /^[A-Za-z0-9-]{4,40}$/;

const upstream = async (path, ttl) => {
  const r = await fetch(API + path, { headers: { 'user-agent': 'SHLstats live relay' }, cf: { cacheTtl: ttl, cacheEverything: true } });
  if (!r.ok) throw new Error(`shl.se ${r.status}`);
  return r.json();
};

const stockholmDay = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

async function today(q) {
  const [season, series, type] = ['season', 'series', 'type'].map((k) => q.get(k));
  if (![season, series, type].every((v) => v && ID.test(v))) return { status: 400, body: { error: 'bad parameters' } };
  const s = await upstream(`/sports-v2/game-schedule?seasonUuid=${season}&seriesUuid=${series}&gameTypeUuid=${type}&gamePlace=all&played=all`, 20);
  const day = stockholmDay(new Date());
  const games = (s.gameInfo || [])
    .filter((g) => g.startDateTime.slice(0, 10) === day || (g.state !== 'pre-game' && g.state !== 'post-game'))
    .map((g) => ({ id: g.uuid, state: g.state, hs: g.homeTeamInfo.score, as: g.awayTeamInfo.score, ot: g.overtime, so: g.shootout }));
  return { status: 200, body: { day, games } };
}

async function game(id) {
  if (!ID.test(id)) return { status: 400, body: { error: 'bad id' } };
  const pbp = await upstream(`/gameday/play-by-play/${id}`, 10);
  const list = Array.isArray(pbp) ? pbp : [];
  const name = (p) => (p ? `${p.firstName} ${p.familyName}`.trim() : null);
  const latest = list.reduce((a, e) => (!a || e.eventId > a.eventId ? e : a), null);
  const events = list.filter((e) => ['goal', 'penalty', 'shot'].includes(e.type)).map((e) => ({
    type: e.type, p: e.period, t: e.time, side: e.eventTeam?.place,
    player: name(e.player), num: e.player?.jerseyToday ?? null,
    ...(e.type === 'goal' ? { a1: name(e.assists?.first), a2: name(e.assists?.second), str: e.goalStatus || 'EQ', en: !!e.isEmptyNetGoal, ps: !!e.isPenaltyShot, score: [e.homeGoals, e.awayGoals] } : {}),
    ...(e.type === 'penalty' ? { desc: e.variant?.description || '', off: e.offence || '' } : {}),
  }));
  return {
    status: 200,
    body: {
      state: latest?.gameState || null, p: latest?.period ?? null, t: latest?.time ?? null,
      hs: latest?.homeTeam?.score ?? 0, as: latest?.awayTeam?.score ?? 0,
      arena: latest?.arena || null, att: latest?.attendance || null, events,
    },
  };
}

export default {
  async fetch(req) {
    const origin = req.headers.get('origin') || '';
    const headers = {
      'access-control-allow-origin': SITES.includes(origin) ? origin : SITES[0],
      'vary': 'origin',
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=10',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    const url = new URL(req.url);
    let res;
    try {
      if (url.pathname === '/today') res = await today(url.searchParams);
      else if (url.pathname.startsWith('/game/')) res = await game(url.pathname.slice(6));
      else res = { status: 404, body: { error: 'not found' } };
    } catch (e) {
      res = { status: 502, body: { error: String(e.message || e) } };
    }
    return new Response(JSON.stringify(res.body), { status: res.status, headers });
  },
};
