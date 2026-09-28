// SHLstats live relay: a Cloudflare Worker (free plan) for live scores, line-ups and push notifications.
//
// shl.se's API can't be read directly by another website (it sends no CORS headers), so the site asks
// this relay instead. Answers are cached for a few seconds so shl.se sees at most a handful of requests.
//
//   GET  /today?season=…&series=…&type=…   today's games: state and score
//   GET  /game/<id>                          one game's goals, penalties and shots on goal, plus the clock
//   GET  /lineup/<id>                        the teams' line-ups once the clubs have handed them in (before face-off)
//   POST /push/subscribe                     save a phone's notification subscription and chosen teams
//   POST /push/unsubscribe                   remove it
//   GET  /push/events?teams=FHC,BIF          the latest notification texts, read by the site's service worker
//
// Every minute (a cron trigger) the relay checks the followed teams' games and sends notifications:
// an hour before face-off, every goal, and the final score.
//
// Setup (Cloudflare dashboard → Workers & Pages → shlstats-live):
//   1. Edit code → paste this file → Deploy
//   2. Settings → Bindings → Add → KV namespace, variable name KV (create a namespace called shlstats)
//   3. Settings → Variables and secrets → add VAPID_PUBLIC and VAPID_PRIVATE (type Secret), values from vapid-keys.local.json
//   4. Settings → Trigger events → Add → Cron trigger, "* * * * *" (every minute)

const API = 'https://www.shl.se/api';
const SITE = 'https://shlstats.net';
const SITES = [SITE, 'https://www.shlstats.net', 'https://lemackio.github.io', 'http://localhost:4323'];
const ID = /^[A-Za-z0-9-]{4,40}$/;
const TEAM = /^[A-Z0-9ÅÄÖ]{2,5}$/;

const upstream = async (path, ttl) => {
  const r = await fetch(API + path, { headers: { 'user-agent': 'SHLstats live relay' }, cf: { cacheTtl: ttl, cacheEverything: true } });
  if (!r.ok) throw new Error(`shl.se ${r.status}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
};
const stockholmDay = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
// "2026-09-29 19:00:00" in Stockholm time → a real timestamp (handles summer/winter time)
const stockholmEpoch = (s) => {
  const [d, tm = '00:00'] = s.split(' '), [y, m, dd] = d.split('-').map(Number), [h, mi] = tm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, dd, h, mi);
  const inSthlm = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
  const inUtc = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'UTC' }));
  return guess - (inSthlm - inUtc);
};
const name = (p) => (p ? `${p.firstName} ${p.familyName}`.trim() : null);
const shortName = (n) => { const p = String(n || '').split(/\s+/); return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : String(n || ''); };

/* ---------- live data for the site ---------- */
async function today(q) {
  const [season, series, type] = ['season', 'series', 'type'].map((k) => q.get(k));
  if (![season, series, type].every((v) => v && ID.test(v))) return { status: 400, body: { error: 'bad parameters' } };
  const s = await upstream(`/sports-v2/game-schedule?seasonUuid=${season}&seriesUuid=${series}&gameTypeUuid=${type}&gamePlace=all&played=all`, 20);
  const day = stockholmDay(new Date());
  const games = (s?.gameInfo || [])
    .filter((g) => g.startDateTime.slice(0, 10) === day || (g.state !== 'pre-game' && g.state !== 'post-game'))
    .map((g) => ({ id: g.uuid, state: g.state, hs: g.homeTeamInfo.score, as: g.awayTeamInfo.score, ot: g.overtime, so: g.shootout }));
  return { status: 200, body: { day, games } };
}

async function pbpOf(id) {
  const pbp = await upstream(`/gameday/play-by-play/${id}`, 10);
  return Array.isArray(pbp) ? pbp : [];
}

async function game(id) {
  if (!ID.test(id)) return { status: 400, body: { error: 'bad id' } };
  const list = await pbpOf(id);
  const latest = list.reduce((a, e) => (!a || e.eventId > a.eventId ? e : a), null);
  // Shot events with a positive goalSection are shots on goal; the rest were blocked or missed
  const events = list.filter((e) => ['goal', 'penalty'].includes(e.type) || (e.type === 'shot' && e.goalSection > 0)).map((e) => ({
    type: e.type, p: e.period, t: e.time, side: e.eventTeam?.place, x: e.locationX ?? null, y: e.locationY ?? null,
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

// The clubs' line-ups: shl.se's player list for the game fills in once the line-ups are handed in
async function lineup(id) {
  if (!ID.test(id)) return { status: 400, body: { error: 'bad id' } };
  const ps = await upstream(`/gameday/player-stats/${id}`, 60);
  const side = (key) => {
    const names = ps?.players?.[key] || {}, gnames = ps?.goalkeepers?.[key] || {};
    const skaters = (ps?.stats?.[key] || []).filter((r) => !r.info?.period).map((r) => ({ name: names[r.info.playerId]?.fullName || null, num: r.NR ?? null, pos: r.POS || '', line: r.LINE ?? null }));
    const goalies = (ps?.gkStats?.[key] || []).filter((r) => !r.info?.period).map((r) => ({ name: gnames[r.info.playerId]?.fullName || null, num: r.NR ?? null, pos: 'GK', line: r.LINE ?? null }));
    return [...goalies, ...skaters].filter((p) => p.name);
  };
  const home = side('homeTeamValue'), away = side('awayTeamValue');
  return { status: 200, body: { ready: home.length > 10 && away.length > 10, home, away } };
}

/* ---------- push notifications ---------- */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uText = (s) => b64u(new TextEncoder().encode(s));
const hashId = async (s) => b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).slice(0, 22);

// A web push "tickle" without a payload: the service worker then fetches the text from /push/events.
// That only needs a VAPID signature (no payload encryption).
async function vapidHeader(env, endpoint) {
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64uText(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64uText(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SITE }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}
async function tickle(env, sub) {
  const r = await fetch(sub.endpoint, { method: 'POST', headers: { TTL: '3600', Urgency: 'high', Authorization: await vapidHeader(env, sub.endpoint), 'Content-Length': '0' } });
  return r.status; // 404/410: the subscription is gone
}

const getJson = async (env, key, fallback) => { const v = await env.KV.get(key); return v ? JSON.parse(v) : fallback; };
const putJson = (env, key, value, ttl) => env.KV.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : undefined);

async function subscribe(req, env) {
  const b = await req.json().catch(() => null);
  const endpoint = b?.subscription?.endpoint;
  if (!endpoint || !/^https:\/\//.test(endpoint)) return { status: 400, body: { error: 'bad subscription' } };
  const teams = (b.teams || []).filter((t) => TEAM.test(t)).slice(0, 5);
  const prefs = { start: b.prefs?.start !== false, goals: b.prefs?.goals !== false, final: b.prefs?.final !== false };
  const id = await hashId(endpoint);
  const subs = (await getJson(env, 'subs', [])).filter((s) => s.id !== id);
  if (teams.length) subs.push({ id, endpoint, teams, prefs });
  await putJson(env, 'subs', subs);
  return { status: 200, body: { ok: true, teams } };
}
async function unsubscribe(req, env) {
  const b = await req.json().catch(() => null);
  if (!b?.endpoint) return { status: 400, body: { error: 'bad request' } };
  const id = await hashId(b.endpoint);
  await putJson(env, 'subs', (await getJson(env, 'subs', [])).filter((s) => s.id !== id));
  return { status: 200, body: { ok: true } };
}
async function events(q, env) {
  const teams = String(q.get('teams') || '').split(',').filter((t) => TEAM.test(t)).slice(0, 5);
  const all = (await Promise.all(teams.map((t) => getJson(env, `ev:${t}`, [])))).flat();
  const seen = new Set();
  return { status: 200, body: { events: all.filter((e) => !seen.has(e.id) && seen.add(e.id)).sort((a, b) => b.at - a.at).slice(0, 10) } };
}

// Every minute: look at today's games for followed teams and send what is new
async function checkGames(env) {
  if (!env.KV || !env.VAPID_PRIVATE) return;
  const subs = await getJson(env, 'subs', []);
  if (!subs.length) return;
  const wanted = new Set(subs.flatMap((s) => s.teams));
  const core = await (await fetch(`${SITE}/data/core.json`, { cf: { cacheTtl: 900, cacheEverything: true } })).json();
  const teamName = (c) => core.teams?.[c]?.name || c;
  const now = Date.now();
  const games = (core.games || []).filter((g) => (wanted.has(g.home) || wanted.has(g.away)) && (() => { const t = stockholmEpoch(g.start); return now > t - 65 * 60e3 && now < t + 5 * 3600e3; })());
  const fresh = []; // [event, game]
  for (const g of games) {
    const key = `st:${g.id}`, known = await getJson(env, key, null), st = known || { pre: 0, goals: [], final: 0 };
    let changed = false;
    const t = stockholmEpoch(g.start);
    // First look at a game that is already under way (e.g. right after setup): note what has happened, send nothing old
    if (!known && now > t + 3 * 60e3) {
      const list = await pbpOf(g.id).catch(() => []);
      st.pre = 1; st.goals = list.filter((x) => x.type === 'goal').map((x) => x.eventId);
      const latest = list.reduce((a, e) => (!a || e.eventId > a.eventId ? e : a), null);
      st.final = latest && /ended/i.test(String(latest.gameState)) ? 1 : 0;
      await putJson(env, key, st, 3 * 86400);
      continue;
    }
    if (!st.pre && now >= t - 62 * 60e3 && now < t - 5 * 60e3) {
      st.pre = 1; changed = true;
      fresh.push([{ id: `${g.id}:pre`, kind: 'start', title: `${teamName(g.home)} – ${teamName(g.away)}`, body: `Nedsläpp ${g.start.slice(11, 16)}${g.arena ? ` i ${g.arena}` : ''}.` }, g]);
    }
    if (now >= t - 5 * 60e3) {
      const list = await pbpOf(g.id).catch(() => []);
      for (const e of list.filter((x) => x.type === 'goal' && typeof x.period === 'number' && x.period < 5)) {
        if (st.goals.includes(e.eventId)) continue;
        st.goals.push(e.eventId); changed = true;
        const side = e.eventTeam?.place, scorer = name(e.player);
        fresh.push([{ id: `${g.id}:${e.eventId}`, kind: 'goals', scorer: g[side],
          title: `MÅL ${teamName(g[side])}! ${g.home} ${e.homeGoals}–${e.awayGoals} ${g.away}`,
          body: `${shortName(scorer) || 'Mål'} ${e.period === 4 ? 'i förlängningen' : `i period ${e.period}`} (${e.time})${e.goalStatus && /^PP/.test(e.goalStatus) ? ', powerplay' : ''}.` }, g]);
      }
      const latest = list.reduce((a, e) => (!a || e.eventId > a.eventId ? e : a), null);
      if (!st.final && latest && /ended/i.test(String(latest.gameState))) {
        st.final = 1; changed = true;
        const hs = latest.homeTeam?.score ?? 0, as = latest.awayTeam?.score ?? 0;
        fresh.push([{ id: `${g.id}:final`, kind: 'final', title: `Slut: ${teamName(g.home)} ${hs}–${as} ${teamName(g.away)}`, body: 'Se målen och matchrapporten.' }, g]);
      }
    }
    if (changed) await putJson(env, key, st, 3 * 86400);
  }
  if (!fresh.length) return;
  // Store the texts per team for the service worker, then wake the phones that follow those teams
  const byTeam = {};
  for (const [ev, g] of fresh) for (const c of [g.home, g.away]) (byTeam[c] ??= []).push({ ...ev, at: now, url: `${SITE}/#/match/${g.id}` });
  for (const [c, list] of Object.entries(byTeam)) await putJson(env, `ev:${c}`, [...list, ...(await getJson(env, `ev:${c}`, []))].slice(0, 20), 2 * 86400);
  const gone = new Set();
  for (const s of subs) {
    const hit = fresh.some(([ev, g]) => s.prefs?.[ev.kind] !== false && (s.teams.includes(g.home) || s.teams.includes(g.away)));
    if (!hit) continue;
    try { const code = await tickle(env, s); if (code === 404 || code === 410) gone.add(s.id); } catch { /* try again next event */ }
  }
  if (gone.size) await putJson(env, 'subs', subs.filter((s) => !gone.has(s.id)));
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '';
    const headers = {
      'access-control-allow-origin': SITES.includes(origin) ? origin : SITES[0],
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
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
      else if (url.pathname.startsWith('/lineup/')) res = await lineup(url.pathname.slice(8));
      else if (url.pathname === '/push/subscribe' && req.method === 'POST') res = await subscribe(req, env);
      else if (url.pathname === '/push/unsubscribe' && req.method === 'POST') res = await unsubscribe(req, env);
      else if (url.pathname === '/push/events') { res = await events(url.searchParams, env); headers['cache-control'] = 'no-store'; }
      else if (url.pathname === '/push/key') res = { status: 200, body: { key: env.VAPID_PUBLIC || null } };
      else res = { status: 404, body: { error: 'not found' } };
    } catch (e) {
      res = { status: 502, body: { error: String(e.message || e) } };
    }
    return new Response(JSON.stringify(res.body), { status: res.status, headers });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkGames(env));
  },
};
