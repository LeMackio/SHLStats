(() => {
'use strict';

/* =====================================================================
   Helpers
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const app = $('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dec = (x, n = 1) => (x == null || !isFinite(x)) ? '–' : x.toFixed(n).replace('.', ',');
const pctTxt = (p, n = 0) => (p == null || !isFinite(p)) ? '–' : dec(p * 100, n) + ' %';
const oddsTxt = (p) => p == null ? '–' : p >= 0.995 ? '>99 %' : p <= 0 ? '–' : p < 0.005 ? '<1 %' : Math.round(p * 100) + ' %';
const signed = (v) => v > 0 ? '+' + v : String(v);
const mmss = (s) => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '–';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const DAYS = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
const dateParts = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return { y, m, d, wd: new Date(y, m - 1, d).getDay() }; };
const fmtDay = (s) => { const p = dateParts(s); return `${DAYS[p.wd]} ${p.d} ${MONTHS[p.m - 1]}`; };
const fmtDate = (s) => { const p = dateParts(s); return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`; };
const fmtTime = (s) => s.slice(11, 16);
const todayStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const ageOf = (born) => {
  if (!born) return '–';
  const b = new Date(born), n = new Date(); let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a;
};
const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('');
const normName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isFinal = (g) => g.state === 'post-game' && typeof g.hs === 'number';
const isLive = (g) => g.state !== 'pre-game' && !isFinal(g);
const sum = (a) => a.reduce((s, x) => s + x, 0);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

const POS = { D: 'Back', LD: 'Back', RD: 'Back', CE: 'Center', C: 'Center', LW: 'Forward', RW: 'Forward', F: 'Forward', GK: 'Målvakt' };
const POS_SHORT = { D: 'B', LD: 'B', RD: 'B', CE: 'C', C: 'C', LW: 'VF', RW: 'HF', F: 'F', GK: 'MV' };
const posGroup = (p) => p === 'GK' ? 'G' : ['D', 'LD', 'RD'].includes(p) ? 'D' : 'F';
const NAT = { SE: 'Sverige', FI: 'Finland', NO: 'Norge', DK: 'Danmark', CA: 'Kanada', US: 'USA', CZ: 'Tjeckien', SK: 'Slovakien', CH: 'Schweiz', DE: 'Tyskland', AT: 'Österrike', LV: 'Lettland', RU: 'Ryssland', FR: 'Frankrike', SI: 'Slovenien', IT: 'Italien', BY: 'Belarus', KZ: 'Kazakstan', GB: 'Storbritannien', NL: 'Nederländerna', PL: 'Polen', HU: 'Ungern', UA: 'Ukraina', EE: 'Estland', LT: 'Litauen', JP: 'Japan', AU: 'Australien' };
const OFFENCE = {
  HOOK: 'Hakning', TRIP: 'Fällning', SLASH: 'Slag', ROUGH: 'Ruffighet', HOLD: 'Fasthållning', 'HO-ST': 'Fasthållning av klubba',
  INTRF: 'Obstruktion', INTERF: 'Obstruktion', 'TOO-M': 'För många spelare på isen', 'HI-ST': 'Hög klubba', CROSS: 'Crosscheck',
  BOARD: 'Boarding', CHARG: 'Charging', DIV: 'Filmning', ELBOW: 'Armbåge', 'DE-GA': 'Fördröjning av spelet', DELAY: 'Fördröjning av spelet',
  UNSP: 'Osportsligt uppträdande', 'UN-SP': 'Osportsligt uppträdande', FIGHT: 'Slagsmål', KNEE: 'Knä', 'HE-CO': 'Huvudtackling',
  'CH-HE': 'Huvudtackling', 'CH-BE': 'Tackling bakifrån', SPEAR: 'Spjutning', KICK: 'Sparkning', 'IL-EQ': 'Otillåten utrustning',
  'BR-ST': 'Bruten klubba', THROW: 'Kastad klubba', 'CL-FA': 'Täppa puck', 'HA-PA': 'Handpass', 'LE-BE': 'Lämnar spelarbåset',
};
const strengthTag = (g) => g.ps ? 'STRAFF' : g.en ? 'TOM KASSE' : /^PP/.test(g.str) ? 'PP' : /^(SH|BP)/.test(g.str) ? 'BP' : '';

// Approximate club colours for badge fallbacks and tints: [background, text]
const TC = {
  BIF: ['#c8202f', '#fff'], DIF: ['#0b2d6b', '#fff'], FBK: ['#f3c316', '#10220f'], FHC: ['#0f6b3f', '#fff'],
  HV71: ['#1545a3', '#ffd400'], IFB: ['#11804a', '#fff'], LHC: ['#0a5bb4', '#fff'], LHF: ['#b3122f', '#fff'],
  MIF: ['#d31c35', '#fff'], OHK: ['#1d2330', '#fff'], RBK: ['#1a8a3e', '#fff'], SAIK: ['#1b1b1b', '#f5c400'],
  TIK: ['#b8233a', '#fff'], VLH: ['#c21f2e', '#fff'], LIF: ['#1a4fa0', '#fff'], IKO: ['#e2231a', '#fff'], MODO: ['#b01f2e', '#fff'],
};
const tColor = (c) => (TC[c] || ['#5b6b7e'])[0];

// Colour maths for picking a readable team accent against the current card colour
const hexToRgb = (h) => {
  let s = String(h).replace('#', '');
  if (s.length === 3) s = [...s].map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
const lum = (h) => { const c = hexToRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mixHex = (a, b, t) => '#' + hexToRgb(a).map((v, i) => Math.round(v + (hexToRgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
function teamAccent(code) {
  const [bg, fg] = TC[code] || [];
  if (!bg) return null;
  const panelColor = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#212934';
  const dark = lum(panelColor) < 0.2;
  const options = dark ? [bg, fg, mixHex(bg, '#ffffff', 0.35), mixHex(bg, '#ffffff', 0.6)] : [bg, mixHex(bg, '#000000', 0.25), fg, mixHex(bg, '#000000', 0.5)];
  const pick = options.find((c) => contrast(c, panelColor) >= 3) || options[options.length - 1];
  return { accent: pick, ink: lum(pick) > 0.35 ? '#10151c' : '#ffffff' };
}

// Line icons (drawn for this site), rendered at the current text colour
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  table: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9 4v16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.4-3.6 4.3-5.5 7.5-5.5s6.1 1.9 7.5 5.5"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c1-3.4 3.6-5.3 6.5-5.3s5.5 1.9 6.5 5.3"/><path d="M15.5 5.2a3.4 3.4 0 0 1 0 6.6M17.5 14.9c1.9.6 3.3 2.2 4 4.6"/>',
  shield: '<path d="M12 3.2 19.5 6v6c0 4.6-3.2 7.7-7.5 8.8C7.7 19.7 4.5 16.6 4.5 12V6z"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>',
  swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
  chart: '<path d="M4 20v-8M10 20V5M16 20v-9M2.5 20h19"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.6M16 6h2.5a2.5 2.5 0 0 1-2.6 3.6M12 13v3.5M8.5 20h7M10 16.5h4"/>',
};
const icon = (n) => ICONS[n] ? `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>` : '';

// Game start times are Stockholm local time; convert to a real timestamp (handles summer/winter time)
const stockholmEpoch = (s) => {
  const [d, tm = '00:00'] = s.split(' ');
  const [y, m, dd] = d.split('-').map(Number), [h, mi] = tm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, dd, h, mi);
  const asStockholm = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
  const asUtc = new Date(new Date(guess).toLocaleString('en-US', { timeZone: 'UTC' }));
  return guess - (asStockholm - asUtc);
};

/* =====================================================================
   Data
   ===================================================================== */
let D, CUR, PREV, TEAMS, LOGOS, HS, GAMES, GAMES_BY_ID, TABLE, SIM, MODEL, CODES, stampTxt = '';
let PLAYERS = null; // players.json, loaded on demand
let FAV = store.get('shlstats-fav');
const gameCache = {};
// Data URLs carry the build version so an update is never mixed with old cached data
const dataUrl = (path) => `data/${path}?v=${window.SHL_BUILD || ''}`;
const loadPlayers = async () => PLAYERS ??= await (await fetch(dataUrl('players.json'))).json();
const loadGame = async (id) => {
  if (id in gameCache) return gameCache[id];
  try { const r = await fetch(dataUrl(`games/${encodeURIComponent(id)}.json`)); gameCache[id] = r.ok ? await r.json() : null; }
  catch { gameCache[id] = null; }
  return gameCache[id];
};
let TEAMDATA = null; // teams.json: game-by-game logs and club news, loaded on demand
const loadTeams = async () => TEAMDATA ??= await (await fetch(dataUrl('teams.json'))).json();

/* ---------- Live ---------- */
// shl.se's API can't be read directly from another website, so live scores come through a small relay
// (live-relay/worker.js, a free Cloudflare Worker). Without it the site shows the score from the latest
// data refresh. Locally the relay can run on port 8787.
const LIVE_API = location.hostname === 'localhost' ? 'http://localhost:8787' : 'https://shlstats-live.marcuskbroman.workers.dev';
const LIVE = {}; // game id → { at, data } from the relay
let liveTimer = null, liveSig = '';
// Local testing only: ?livetest=<game id> shows a finished game as if it were being played
const LIVE_TEST = LIVE_API && location.hostname === 'localhost' ? new URLSearchParams(location.search).get('livetest') : null;
const liveDue = () => GAMES.filter((g) => {
  if (g.id === LIVE_TEST) return true;
  if (isFinal(g)) return false;
  const t = stockholmEpoch(g.start), now = Date.now();
  return now > t - 10 * 60e3 && now < t + 5 * 3600e3; // from 10 minutes before face-off until it must be over
});
async function loadLive(id, maxAge = 15000) {
  const c = LIVE[id];
  if (c && Date.now() - c.at < maxAge) return c.data;
  try {
    const r = await fetch(`${LIVE_API}/game/${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    // The feed calls the shootout period "shootout"; use 5 like the rest of the site
    const per = (p) => typeof p === 'number' ? p : /shoot/i.test(String(p)) ? 5 : Number(p) || null;
    data.p = per(data.p); for (const e of data.events || []) e.p = per(e.p) || 0;
    LIVE[id] = { at: Date.now(), data };
  } catch { /* keep the last answer if there is one */ }
  return LIVE[id]?.data ?? null;
}
const PERIOD_NAME = (p) => p === 4 ? 'Förlängning' : p >= 5 ? 'Straffar' : `Period ${p}`;
// "Period 2 · 12:34", or a pause between periods
const liveClock = (L) => {
  if (!L || !L.p) return 'Pågår';
  const st = String(L.state || '');
  if (/end/i.test(st) && L.t === '20:00' && L.p < 3) return `Paus efter period ${L.p}`;
  if (/intermission|break|pause/i.test(st)) return `Paus efter period ${L.p}`;
  return `${PERIOD_NAME(L.p)} · ${L.t}`;
};
// The relay's events in the same shape as a finished game's data, so the match page can show them
function liveDetails(g, L, base) {
  const people = [...skaters(), ...goalies()];
  const ref = (name, side) => {
    if (!name) return null;
    const n = normName(name), code = g[side];
    const p = people.find((x) => x.team === code && normName(x.name) === n) || people.find((x) => normName(x.name) === n);
    return { id: p?.id || null, name };
  };
  const ev = L.events || [], byTime = (a, b) => a.p - b.p || a.t.localeCompare(b.t);
  const goals = ev.filter((e) => e.type === 'goal').map((e) => ({ p: e.p, t: e.t, team: e.side, scorer: ref(e.player, e.side), a1: ref(e.a1, e.side), a2: ref(e.a2, e.side), str: e.str, en: e.en, ps: e.ps, score: e.score })).sort(byTime);
  const pens = ev.filter((e) => e.type === 'penalty').map((e) => ({ p: e.p, t: e.t, team: e.side, player: ref(e.player, e.side), desc: e.desc, off: e.off })).sort(byTime);
  const sog = (side, p) => ev.filter((e) => (e.type === 'shot' || (e.type === 'goal' && !e.en)) && e.side === side && (p == null || e.p === p)).length;
  const periods = [];
  for (let p = 1; p <= Math.max(L.p || 1, ...goals.map((x) => x.p)); p++) {
    periods.push({ p, h: goals.filter((x) => x.p === p && x.team === 'home').length, a: goals.filter((x) => x.p === p && x.team === 'away').length, hs: sog('home', p), as: sog('away', p) });
  }
  const pim = (side) => sum(pens.filter((x) => x.team === side).map((x) => parseInt(x.desc) || 0));
  const team = (side) => ({ SOG: sog(side), PIM: pim(side), PPG: goals.filter((x) => x.team === side && /^PP/.test(x.str || '')).length, NumPP: pens.filter((x) => x.team !== side && /^2/.test(x.desc)).length });
  return {
    ...(base || { box: { home: [], away: [] }, gk: { home: [], away: [] }, shots: [] }),
    id: g.id, home: g.home, away: g.away, hs: L.hs, as: L.as, arena: L.arena || base?.arena, att: L.att || base?.att,
    goals, pens, periods, team: { home: team('home'), away: team('away') }, live: L,
  };
}
function startLive() {
  if (!LIVE_API) return;
  if (LIVE_TEST && GAMES_BY_ID[LIVE_TEST]) { GAMES_BY_ID[LIVE_TEST].state = 'live'; renderStrip(); }
  const tick = async () => {
    clearTimeout(liveTimer);
    const due = liveDue();
    if (due.length && !document.hidden) {
      let changed = false;
      try {
        const r = await fetch(`${LIVE_API}/today?season=${D.live.season}&series=${D.live.series}&type=${D.live.type}`);
        for (const x of (await r.json()).games || []) {
          const g = GAMES_BY_ID[x.id];
          if (!g || x.id === LIVE_TEST) continue;
          for (const k of ['state', 'hs', 'as', 'ot', 'so']) if (x[k] != null && g[k] !== x[k]) { g[k] = x[k]; changed = true; }
        }
      } catch { /* relay unreachable: try again next time */ }
      if (LIVE_TEST) {
        const g = GAMES_BY_ID[LIVE_TEST], L = await loadLive(LIVE_TEST, 0);
        if (g && L && (g.hs !== L.hs || g.as !== L.as)) { g.hs = L.hs; g.as = L.as; changed = true; }
      }
      if (changed) renderStrip(true);
      // An open match page of a game being played follows along
      const m = location.hash.match(/^#\/match\/([^/?]+)/), g = m && GAMES_BY_ID[decodeURIComponent(m[1])];
      if (g && isLive(g)) {
        const L = await loadLive(g.id, 0);
        const sig = L ? `${g.id}|${L.hs}|${L.as}|${L.events.length}|${L.state}|${L.p}|${L.t}` : '';
        if (L && (L.hs !== g.hs || L.as !== g.as)) { g.hs = L.hs; g.as = L.as; renderStrip(true); }
        if (sig && sig !== liveSig) { liveSig = sig; route(); }
      } else if (/^#\/matcher/.test(location.hash) && isNarrow() && DAY_SHOWN) {
        let sig = '';
        for (const x of GAMES.filter((x) => x.start.startsWith(DAY_SHOWN) && isLive(x))) {
          const L = await loadLive(x.id, 0);
          if (L) sig += `${x.id}|${L.hs}|${L.as}|${L.events.length}|${L.state}|${L.p}|${L.t};`;
        }
        if (changed || (sig && sig !== liveSig)) { liveSig = sig; route(); }
      } else if (changed && /^#\/(match|matcher)/.test(location.hash)) route();
    }
    liveTimer = setTimeout(tick, due.length ? 20000 : 5 * 60e3);
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  tick();
}

/* =====================================================================
   Components
   ===================================================================== */
const tName = (c) => TEAMS[c]?.name || c;
const tb = (code, size = '') => {
  const [bg, fg] = TC[code] || ['#5b6b7e', '#fff'];
  const img = LOGOS[code] ? `<img src="${esc(LOGOS[code])}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<span class="tb ${size}" style="--tc:${bg};--tt:${fg}" title="${esc(tName(code))}">${esc(code)}${img}</span>`;
};
const teamLink = (code, { name = false, size = '' } = {}) =>
  `<a class="teamlink" href="#/lag/${encodeURIComponent(code)}">${tb(code, size)}${name ? `<span>${esc(tName(code))}</span>` : ''}</a>`;
const avatar = (id, name, team, size = '') => {
  const h = id && HS[id];
  const ini = esc(initials(name));
  return `<span class="av ${size}" style="--tc:${tColor(team)}" data-ini="${ini}">${h
    ? `<img src="${esc(h[0])}" alt="" loading="lazy" onload="this.classList.add('in')" onerror="this.parentNode.textContent=this.parentNode.dataset.ini">`
    : ini}</span>`;
};
// Initials sit behind the photo and only show when there is no photo or it fails to load
const portrait = (id, name, team, size = '') => {
  const h = id && HS[id];
  return `<div class="portrait ${size}" style="--tc:${tColor(team)}">${h
    ? `<img src="${esc(h[1])}" alt="" onload="this.classList.add('in')" onerror="this.remove()">` : ''}<span class="ini">${esc(initials(name))}</span></div>`;
};
const pLink = (id, name) => id ? `<a href="#/spelare/${encodeURIComponent(id)}">${esc(name)}</a>` : esc(name);
const playerCell = (p, team, sub = '') =>
  `<div class="pcell">${avatar(p.id, p.name, team)}<div>${pLink(p.id, p.name)}${sub ? `<br><small>${sub}</small>` : ''}</div></div>`;

const statusTxt = (g) => isFinal(g) ? (g.so ? 'Slut/str' : g.ot ? 'Slut/ÖT' : 'Slut') : isLive(g) ? 'Live' : fmtTime(g.start);
const pillStyle = (p) => {
  const hue = p >= 0.5 ? 'var(--accent)' : 'var(--bad)';
  return `background:color-mix(in srgb, ${hue} ${Math.round(18 + Math.abs(p - 0.5) * 90)}%, transparent)`;
};
const oddsBar = (ph) => {
  const h = Math.round(ph * 100), a = 100 - h;
  return `<div class="oddsbar" title="Vinstchans: hemma ${h} %, borta ${a} %"><span style="width:${h}%;background:var(--accent)">${h}%</span><span style="width:${a}%;background:var(--faint)">${a}%</span></div>`;
};
// Result for a team in a finished game: v (win), ov (OT/SO win), of (OT/SO loss), f (loss)
const resultFor = (g, code) => {
  const home = g.home === code, mine = home ? g.hs : g.as, theirs = home ? g.as : g.hs, extra = g.ot || g.so;
  return mine > theirs ? (extra ? 'ov' : 'v') : (extra ? 'of' : 'f');
};
const formChips = (code, n = 5) => {
  const last = GAMES.filter((g) => isFinal(g) && (g.home === code || g.away === code)).slice(-n);
  if (!last.length) return '<span class="faint">Inga matcher än</span>';
  const map = { v: ['w', 'V', 'Vinst'], ov: ['o', 'V', 'Vinst efter övertid/straffar'], of: ['ol', 'F', 'Förlust efter övertid/straffar'], f: ['l', 'F', 'Förlust'] };
  return `<div class="form">${last.map((g) => { const [c, t, tt] = map[resultFor(g, code)]; const opp = g.home === code ? g.away : g.home;
    return `<a href="#/match/${g.id}" title="${tt} mot ${esc(tName(opp))}, ${g.hs}–${g.as}"><i class="${c}">${t}</i></a>`; }).join('')}</div>`;
};

/* ---------- layout: panels, masonry board, tabs ---------- */
const panel = (title, body, { sub = '', more = '', foot = '', cls = '', id = '' } = {}) =>
  `<section class="panel ${cls}" ${id ? `id="${id}"` : ''}>${title ? `<div class="p-head"><h2>${title}</h2>${more}${sub ? `<p class="p-sub">${sub}</p>` : ''}</div>` : ''}<div class="p-body">${body}</div>${foot ? `<div class="p-foot">${foot}</div>` : ''}</section>`;
const moreLink = (href, txt) => `<a class="more-link" href="${href}">${txt} ›</a>`;
const board = (items, cls = '') => `<div class="board ${cls}">${items.filter(Boolean).join('')}</div>`;
const TAB_ICON = { '': 'grid', video: 'play', spelare: 'users', skott: 'target', uppstallning: 'users', inbordes: 'swap', trupp: 'users',
  schema: 'calendar', historik: 'clock', karriar: 'chart', form: 'chart', matchlogg: 'list', mal: 'play', spelade: 'list', alla: 'calendar' };
// Tab entries are [key, label, count?, icon?]
const tabs = (base, list, active) => `<nav class="tabs" aria-label="Flikar">${list.map(([key, label, count, ic]) =>
  `<a href="#${base}${key ? '/' + key : ''}" class="${key === active ? 'on' : ''}" ${key === active ? 'aria-current="page"' : ''}>${icon(ic || TAB_ICON[key])}${label}${count ? `<span class="count">${count}</span>` : ''}</a>`).join('')}</nav>`;
const skeleton = () => `<div class="skel-page" aria-label="Laddar"><div class="skel skel-hero"></div><div class="skel-grid"><div class="skel skel-card"></div><div class="skel skel-card"></div></div></div>`;

// Each board item spans rows equal to its measured height, so shorter panels
// slot into the shortest column and no holes are left between them.
const ROW = 4, GAP = 20;
const spanOf = (el) => { el.style.gridRowEnd = `span ${Math.max(1, Math.ceil((el.getBoundingClientRect().height + GAP) / ROW))}`; };
const RO = new ResizeObserver((entries) => { for (const e of entries) spanOf(e.target); });
function layoutBoards() {
  RO.disconnect();
  document.querySelectorAll('.board').forEach((b) => [...b.children].forEach((el, i) => {
    el.style.setProperty('--i', Math.min(i, 10)); // staggered fade-in
    RO.observe(el); spanOf(el);
  }));
}
// Stat numbers count up from zero when a page opens
function countUpEl(el, dur = 650) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const m = el.textContent.trim().match(/^([+<>]?)(-?\d+)(,\d+)?(\s?%?)$/);
  if (!m) return; // times, ranges and dashes stay as they are
  const decs = m[3] ? m[3].length - 1 : 0, target = parseFloat(m[2] + (m[3] ? '.' + m[3].slice(1) : ''));
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3;
    el.textContent = m[1] + (target * e).toFixed(decs).replace('.', ',') + m[4];
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function countUp(root) {
  root.querySelectorAll('.tile .v, .ltop .big, .lfeat-val').forEach((el) => countUpEl(el));
}

/* ---------- video ---------- */
const safeEmbed = (url) => { try { const u = new URL(url); return u.protocol === 'https:' && /(^|\.)staylive\.tv$/.test(u.hostname) ? u.href : null; } catch { return null; } };
const durTxt = (s) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '';
const clipCard = (c, title, sub = '', big = false) => {
  if (!c || !safeEmbed(c.embed)) return '';
  return `<button class="clip ${big ? 'big' : ''}" data-embed="${esc(c.embed)}" data-title="${esc(title)}">
    <span class="thumb">${c.thumb ? `<img src="${esc(c.thumb)}" alt="" loading="lazy">` : ''}<span class="play-ic"></span>${c.dur ? `<span class="dur">${durTxt(c.dur)}</span>` : ''}</span>
    <span class="ct">${title}</span>${sub ? `<span class="cs">${sub}</span>` : ''}</button>`;
};
const playBtn = (c, title) => c && safeEmbed(c.embed) ? `<button class="playbtn" data-embed="${esc(c.embed)}" data-title="${esc(title)}">Video</button>` : '';
function setupVideo() {
  const dlg = $('video'), frame = $('video-frame');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-embed]');
    if (!b) return;
    const url = safeEmbed(b.dataset.embed);
    if (!url) return;
    e.preventDefault();
    $('video-title').textContent = b.dataset.title || 'Video';
    frame.src = url;
    dlg.showModal();
  });
  // Every way of closing goes through here so the video always stops
  const closeVideo = () => { frame.removeAttribute('src'); frame.src = 'about:blank'; if (dlg.open) dlg.close(); };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeVideo(); }); // Escape key
  dlg.addEventListener('close', () => { if (frame.src !== 'about:blank') frame.src = 'about:blank'; });
  $('video-close').onclick = closeVideo;
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeVideo(); }); // click on backdrop
}

/* ---------- sortable table ---------- */
function sortable(el, cols, rows, { key, desc = true, limit = 0 } = {}) {
  let k = key, d = desc, lim = limit;
  const colOf = (kk) => cols.find((c) => c.k === kk);
  const draw = () => {
    const c = colOf(k), val = c.v || ((r) => r[c.k]);
    const sorted = [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      if (typeof x === 'string' || typeof y === 'string') return (d ? -1 : 1) * String(x ?? '').localeCompare(String(y ?? ''), 'sv');
      const xx = x ?? (d ? -Infinity : Infinity), yy = y ?? (d ? -Infinity : Infinity);
      return d ? yy - xx : xx - yy;
    });
    const shown = lim ? sorted.slice(0, lim) : sorted;
    el.innerHTML = `<thead><tr>${cols.map((cc) => `<th class="${cc.l ? 'l' : ''} ${cc.noSort ? '' : 'sortable'} ${cc.k === k ? 'sorted' + (d ? '' : ' asc') : ''}" data-k="${cc.k}" ${cc.title ? `title="${esc(cc.title)}"` : ''}>${cc.label}${cc.sub ? `<small>${cc.sub}</small>` : ''}</th>`).join('')}</tr></thead>
      <tbody>${shown.map((r, i) => `<tr class="${r.team && r.team === FAV ? 'fav' : ''}">${cols.map((cc) => `<td class="${cc.l ? 'l' : ''} ${cc.k === k && !cc.l ? 'hl' : ''}">${cc.h ? cc.h(r, i) : fmtCell((cc.v || ((rr) => rr[cc.k]))(r), cc)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    if (el.parentElement.nextElementSibling?.classList.contains('more')) el.parentElement.nextElementSibling.remove();
    if (limit && sorted.length > limit) {
      const b = document.createElement('button'); b.className = 'more';
      b.textContent = lim ? `Visa alla ${sorted.length}` : 'Visa färre';
      b.onclick = () => { lim = lim ? 0 : limit; draw(); };
      el.parentElement.after(b);
    }
  };
  el.onclick = (e) => {
    const th = e.target.closest('th.sortable'); if (!th) return;
    if (th.dataset.k === k) d = !d; else { k = th.dataset.k; d = !colOf(k).asc; }
    draw();
  };
  draw();
}
const fmtCell = (v, c) => v == null ? '–' : c.f ? c.f(v) : typeof v === 'number' && !Number.isInteger(v) ? dec(v, 1) : esc(v);

/* ---------- charts (SVG) ---------- */
// Phones: charts are drawn at the screen's real width so their text stays full size
const isNarrow = () => window.innerWidth < 700;
const cw = (w) => isNarrow() ? Math.max(300, Math.min(w, window.innerWidth - 40)) : w;
function hBars(items, { max, fmt = (v) => oddsTxt(v), color = () => 'var(--accent)', labelW = 150, rowH = 24, W = 600, logos = false } = {}) {
  W = cw(W);
  // Narrow screens show team codes instead of full names so the bars keep their room
  if (isNarrow() && labelW > 90 && items.every((it) => it.code)) { items = items.map((it) => ({ ...it, label: it.code })); labelW = 52; rowH = Math.max(rowH, 28); }
  const mx = max ?? Math.max(1e-9, ...items.map((i) => i.v));
  const lw = labelW + (logos ? 26 : 0), plotW = W - lw - 58, H = items.length * rowH + 4;
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${items.map((it, i) => {
    const y = i * rowH + 2, w = Math.max(it.v > 0 ? 2 : 0, it.v / mx * plotW);
    const logo = logos && it.code && LOGOS[it.code] ? `<image href="${esc(LOGOS[it.code])}" x="${lw - 24}" y="${y + 3}" width="${rowH - 6}" height="${rowH - 6}"/>` : '';
    return `<text x="${labelW - 6}" y="${y + rowH / 2 + 4}" text-anchor="end" font-size="13" style="fill:var(--text)">${esc(it.label)}</text>${logo}
      <rect x="${lw}" y="${y + 5}" width="${plotW}" height="${rowH - 10}" rx="3" style="fill:var(--panel-2)"/>
      <rect x="${lw}" y="${y + 5}" width="${w}" height="${rowH - 10}" rx="3" style="fill:${color(it, i)}"><title>${esc(it.label)}: ${esc(fmt(it.v))}</title></rect>
      <text x="${lw + w + 6}" y="${y + rowH / 2 + 4}" font-size="12" font-weight="600" style="fill:var(--muted)">${esc(fmt(it.v))}</text>`;
  }).join('')}</svg>`;
}
function lineChart(series, { W = 640, H = 220, yMax, yMin = 0, yFmt = (v) => v, xLabels = [], pad = { l: 44, r: 16, t: 12, b: 26 } } = {}) {
  if (isNarrow()) { const w = cw(W); H = Math.round(H * Math.max(0.8, w / W)); W = w; }
  const n = Math.max(...series.map((s) => s.pts.length));
  const top = yMax ?? Math.max(1, ...series.flatMap((s) => s.pts)) * 1.05;
  const x = (i) => pad.l + (n <= 1 ? 0 : i / (n - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - yMin) / (top - yMin || 1)) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + t * (top - yMin));
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
  for (const t of ticks) svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" style="stroke:var(--line)"/><text x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" style="fill:var(--faint)">${esc(yFmt(t))}</text>`;
  const step = Math.max(1, Math.ceil(xLabels.length / 7));
  xLabels.forEach((lab, i) => { if (i % step === 0 || i === xLabels.length - 1) svg += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="11" style="fill:var(--faint)">${esc(lab)}</text>`; });
  for (const s of series) {
    const d = s.pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    if (s.area) svg += `<path d="${d}L${x(s.pts.length - 1)},${y(yMin)}L${x(0)},${y(yMin)}Z" style="fill:${s.color};opacity:.12"/>`;
    svg += `<path d="${d}" style="fill:none;stroke:${s.color}" stroke-width="2.4" stroke-linejoin="round"/>`;
    const li = s.pts.length - 1;
    svg += `<circle cx="${x(li)}" cy="${y(s.pts[li])}" r="4" style="fill:${s.color}"/>`;
  }
  return svg + '</svg>';
}

/* =====================================================================
   Player model: percentile cards
   ===================================================================== */
const METRICS = [
  { k: 'p60', label: 'Poäng/60', f: (x) => x.pts / x.hrs },
  { k: 'g60', label: 'Mål/60', f: (x) => x.g / x.hrs },
  { k: 'a60', label: 'Assist/60', f: (x) => x.a / x.hrs },
  { k: 's60', label: 'Skott/60', f: (x) => x.sog / x.hrs },
  { k: 'fin', label: 'Avslutning', f: (x) => (x.g + 0.1 * 25) / (x.sog + 25) },
  { k: 'pp', label: 'PP-mål', f: (x) => x.ppg / x.gp },
  { k: 'pm', label: 'Plus/minus', f: (x) => x.pm / x.gp },
  { k: 'toi', label: 'Istid', f: (x) => x.toiSec / x.gp },
  { k: 'hit', label: 'Tacklingar', f: (x) => x.hits / x.gp },
  { k: 'blk', label: 'Blockerade skott', f: (x) => x.blk / x.gp },
  { k: 'dis', label: 'Disciplin', f: (x) => -x.pim / x.gp },
];
const IMPACT_W = {
  F: { p60: .30, toi: .20, pm: .15, s60: .10, fin: .05, pp: .05, dis: .05, hit: .05, blk: .05 },
  D: { p60: .20, toi: .25, pm: .20, s60: .05, blk: .10, hit: .05, dis: .05, pp: .05, fin: .05 },
};
const MIN_GP = 10;
let CARD = new Map();
function buildCards() {
  const W = { [PREV]: 1, [CUR]: 1.5 };
  const players = new Map();
  for (const season of [PREV, CUR]) for (const p of D.seasons[season].skaters) {
    if (!p.pos || !p.gp) continue;
    const w = W[season];
    const x = players.get(p.id) || { id: p.id, name: p.name, born: p.born, nat: p.nat, splits: [], gp: 0, g: 0, a: 0, pts: 0, sog: 0, ppg: 0, pm: 0, hits: 0, blk: 0, pim: 0, toiSec: 0 };
    x.pos = p.pos; x.grp = posGroup(p.pos) === 'D' ? 'D' : 'F'; x.team = p.team; x.num = p.num;
    x.splits.push({ season, ...p });
    x.gp += p.gp * w;
    for (const k of ['g', 'a', 'pts', 'sog', 'ppg', 'pm', 'hits', 'blk', 'pim']) x[k] += (p[k] || 0) * w;
    x.toiSec += p.toi * p.gp * w;
    players.set(p.id, x);
  }
  const list = [...players.values()].filter((x) => x.toiSec > 0);
  for (const x of list) { x.hrs = x.toiSec / 3600; x.vals = Object.fromEntries(METRICS.map((m) => [m.k, m.f(x)])); }
  const pctOf = (sorted, v) => {
    let lo = 0, hi = sorted.length; while (lo < hi) { const mid = (lo + hi) >> 1; sorted[mid] < v ? lo = mid + 1 : hi = mid; }
    let eq = lo; while (eq < sorted.length && sorted[eq] === v) eq++;
    return (lo + (eq - lo) / 2) / Math.max(1, sorted.length);
  };
  for (const grp of ['F', 'D']) {
    const pool = list.filter((x) => x.grp === grp && x.gp >= MIN_GP);
    const sortedBy = Object.fromEntries(METRICS.map((m) => [m.k, pool.map((x) => x.vals[m.k]).sort((a, b) => a - b)]));
    const members = list.filter((x) => x.grp === grp);
    for (const x of members) {
      x.pct = Object.fromEntries(METRICS.map((m) => [m.k, pctOf(sortedBy[m.k], x.vals[m.k])]));
      x.composite = Object.entries(IMPACT_W[grp]).reduce((s, [k, w]) => s + w * x.pct[k], 0);
    }
    const comp = pool.map((x) => x.composite).sort((a, b) => a - b);
    for (const x of members) x.impact = pctOf(comp, x.composite);
  }
  const byTeam = {};
  for (const x of list) (byTeam[x.team + x.grp] ??= []).push(x);
  for (const arr of Object.values(byTeam)) arr.filter((x) => x.gp >= 3).sort((a, b) => b.vals.toi - a.vals.toi).forEach((x, i) => {
    x.role = x.grp === 'F' ? ['1:a kedjan', '2:a kedjan', '3:e kedjan', 'Djupet'][Math.min(3, Math.floor(i / 3))] : ['1:a backpar', '2:a backpar', '3:e backpar'][Math.min(2, Math.floor(i / 2))];
  });
  CARD = new Map(list.map((x) => [x.id, x]));
}
const LOW = [217, 72, 95], MID = [128, 140, 156], HIGH = [74, 146, 224];
const pColor = (p) => {
  const [a, b, t] = p < 0.5 ? [LOW, MID, p / 0.5] : [MID, HIGH, (p - 0.5) / 0.5];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
};
function cardHtml(x, { link = true } = {}) {
  const grpName = x.grp === 'D' ? 'backar' : 'forwards';
  const rows = METRICS.map((m) => {
    const p = x.pct[m.k];
    return `<div class="metric"><span>${m.label}</span><span class="bar"><i style="width:${Math.max(3, p * 100)}%;background:${pColor(p)}"></i></span><span class="pct num" style="color:${pColor(p)}">${Math.round(p * 100)}%</span></div>`;
  }).join('');
  const small = x.gp < MIN_GP ? `<span class="small-sample">Litet underlag (${Math.round(x.gp)} viktade matcher). Tolka rankningarna försiktigt.</span>` : '';
  return `<article class="pcard" style="--tc:${tColor(x.team)}">
    <div class="pc-top">
      ${portrait(x.id, x.name, x.team, 'sm')}
      <div class="pc-info">
        <h3 class="pc-name">${link ? pLink(x.id, x.name) : esc(x.name)}</h3>
        <div class="pc-meta">
          <span>${teamLink(x.team, { name: true })}</span>
          <span>#<b>${esc(x.num ?? '–')}</b></span>
          <span>Pos <b>${POS_SHORT[x.pos] || 'F'}</b></span>
          <span>Ålder <b>${ageOf(x.born)}</b></span>
          <span>Roll <b>${x.role || '–'}</b></span>
        </div>
      </div>
      <div class="pc-war"><span class="lbl">Påverkan</span><span class="big num" style="color:${pColor(x.impact)}">${Math.round(x.impact * 100)}%</span></div>
    </div>
    <div class="pc-grid">${rows}</div>
    <div class="pc-foot"><span>Viktat urval ${PREV} + ${CUR}, percentil bland SHL-${grpName} (minst ${MIN_GP} matcher). ${small}</span><span class="mark">SHLSTATS</span></div>
  </article>`;
}

/* =====================================================================
   Score strip
   ===================================================================== */
function renderStrip(keepScroll = false) {
  const track = $('strip'), keepLeft = track.scrollLeft;
  const byDate = new Map();
  for (const g of GAMES) { const d = g.start.slice(0, 10); if (!byDate.has(d)) byDate.set(d, []); byDate.get(d).push(g); }
  const dates = [...byDate.keys()].sort();
  const today = todayStr();
  const anchorDate = dates.find((d) => d >= today) || dates[dates.length - 1];
  let html = '';
  for (const d of dates) {
    const p = dateParts(d);
    // Dates and games are siblings in one flat row, each with a fixed width, so nothing can be squeezed
    html += `<div class="s-date ${d === today ? 'today' : ''}" ${d === anchorDate ? 'id="strip-anchor"' : ''}><b>${d === today ? 'idag' : DAYS[p.wd]}</b><span>${p.d}</span><b>${MONTHS[p.m - 1]}</b></div>`;
    for (const g of byDate.get(d).sort((a, b) => a.start.localeCompare(b.start))) {
      const done = isFinal(g), live = isLive(g), fav = FAV && (g.home === FAV || g.away === FAV);
      const row = (c, right, loser) => `<div class="s-row${loser ? ' loser' : ''}">${tb(c)}<span class="code">${esc(c)}</span>${right}</div>`;
      const pill = (pp) => `<span class="wp num" style="${pillStyle(pp)}">${Math.round(pp * 100)}%</span>`;
      const sc = (s) => `<span class="score">${s}</span>`;
      html += `<a class="s-game ${fav ? 'fav' : ''}" href="#/match/${g.id}" draggable="false" title="${esc(tName(g.home))} – ${esc(tName(g.away))}">
        <div class="s-status ${live ? 'live' : ''}"><span>${live ? 'Live' : statusTxt(g)}</span></div>${done || live
        ? row(g.away, sc(g.as ?? ''), done && g.as < g.hs) + row(g.home, sc(g.hs ?? ''), done && g.hs < g.as)
        : row(g.away, pill(1 - g.ph)) + row(g.home, pill(g.ph))}</a>`;
    }
  }
  track.innerHTML = html;
  const toToday = (smooth) => {
    const anchor = $('strip-anchor'); if (!anchor) return;
    track.style.scrollBehavior = smooth ? 'smooth' : 'auto';
    track.scrollLeft = Math.max(0, anchor.offsetLeft - track.offsetLeft - 20);
    track.style.scrollBehavior = '';
  };
  if (keepScroll) track.scrollLeft = keepLeft; else toToday(false);
  $('strip-today').onclick = () => toToday(true);
  $('strip-prev').onclick = () => track.scrollBy({ left: -track.clientWidth * 0.8 });
  $('strip-next').onclick = () => track.scrollBy({ left: track.clientWidth * 0.8 });
}
function setupStripScrolling() {
  const track = $('strip');
  // Mouse wheel scrolls sideways, click-and-drag pans
  track.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { track.style.scrollBehavior = 'auto'; track.scrollLeft += e.deltaY; track.style.scrollBehavior = ''; e.preventDefault(); }
  }, { passive: false });
  let startX = 0, startLeft = 0, down = false, moved = false;
  track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft; });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) { moved = true; track.classList.add('dragging'); }
    if (moved) track.scrollLeft = startLeft - dx;
  });
  window.addEventListener('pointerup', () => { down = false; setTimeout(() => track.classList.remove('dragging'), 0); });
  track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);
}

/* =====================================================================
   Header: theme, logo, search, favourite team
   ===================================================================== */
function setupTheme() {
  const root = document.documentElement;
  // Two themes: Mörkt (dark) and Ljust (light). With no choice saved, the phone or computer's own setting decides.
  const THEMES = ['dark', 'light'];
  if (!THEMES.includes(root.dataset.theme)) delete root.dataset.theme; // e.g. a removed theme still saved in the browser
  const sync = () => {
    const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    for (const t of THEMES) $('theme-' + t).setAttribute('aria-pressed', t === current);
  };
  // Re-render after a theme switch so colours picked for contrast (team accents) are recalculated
  for (const t of THEMES) $('theme-' + t).addEventListener('click', () => { root.dataset.theme = t; store.set('shlstats-theme', t); sync(); route(); });
  sync();
}
let SEARCH_INDEX = [];
function setupSearch() {
  const seen = new Set();
  for (const season of [CUR, PREV]) for (const p of [...D.seasons[season].skaters, ...D.seasons[season].goalies]) {
    if (seen.has(p.id)) continue; seen.add(p.id);
    SEARCH_INDEX.push({ type: 'p', id: p.id, name: p.name, team: p.team, pos: p.pos, key: normName(p.name), gp: (p.gp || p.gpi || 0) + (season === CUR ? 100 : 0) });
  }
  for (const c of CODES) SEARCH_INDEX.push({ type: 't', id: c, name: tName(c), team: c, key: normName(tName(c) + ' ' + c), gp: 1000 });
  bindSearch($('gsearch'), $('gsearch-results'), (item) => { location.hash = item.type === 't' ? `#/lag/${item.id}` : `#/spelare/${item.id}`; });
  // "/" focuses search from anywhere
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !$('video').open) { e.preventDefault(); $('gsearch').focus(); }
  });
}
function bindSearch(input, res, onPick, filter = () => true) {
  let hits = [], sel = 0;
  const draw = () => {
    res.innerHTML = hits.map((x, i) => `<a href="${x.type === 't' ? '#/lag/' + x.id : '#/spelare/' + x.id}" data-i="${i}" class="${i === sel ? 'on' : ''}">${x.type === 't' ? tb(x.id) : avatar(x.id, x.name, x.team) + tb(x.team)} ${esc(x.name)} <small>${x.type === 't' ? 'Lag' : POS[x.pos] || ''}</small></a>`).join('')
      || '<div class="empty">Inga träffar.</div>';
    res.hidden = false;
  };
  input.addEventListener('input', () => {
    const q = normName(input.value.trim());
    if (!q) { res.hidden = true; return; }
    hits = SEARCH_INDEX.filter((x) => filter(x) && x.key.includes(q)).sort((a, b) => (b.key.startsWith(q) - a.key.startsWith(q)) || b.gp - a.gp).slice(0, 8);
    sel = 0; draw();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { res.hidden = true; input.blur(); return; }
    if (res.hidden || !hits.length) return;
    if (e.key === 'ArrowDown') { sel = (sel + 1) % hits.length; draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = (sel - 1 + hits.length) % hits.length; draw(); e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(hits[sel]); }
  });
  const pick = (x) => { input.value = ''; res.hidden = true; input.blur(); onPick(x); };
  res.addEventListener('click', (e) => { const a = e.target.closest('a[data-i]'); if (a) { e.preventDefault(); pick(hits[+a.dataset.i]); } });
  document.addEventListener('click', (e) => { if (!res.contains(e.target) && e.target !== input) res.hidden = true; });
}
function setFav(code) {
  FAV = code || null;
  store.set('shlstats-fav', FAV);
  renderFavLink();
  renderStrip();
  route();
}
function renderFavLink() {
  const a = $('favlink');
  if (!FAV || !TEAMS[FAV]) { a.hidden = true; return; }
  a.hidden = false; a.href = `#/lag/${FAV}`; a.title = `Mitt lag: ${tName(FAV)}`;
  a.innerHTML = `${tb(FAV)}<span>${esc(FAV)}</span>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-fav]');
  if (b) { e.preventDefault(); setFav(b.dataset.fav === FAV ? null : b.dataset.fav); }
});

/* =====================================================================
   Shared page pieces
   ===================================================================== */
// mode: 'full' (standings page), 'stats' (compact, results only) or 'proj' (compact, predictions)
function standingsTable({ mode = 'full' } = {}) {
  const compact = mode !== 'full';
  const zone = (r) => r <= 6 ? 'var(--accent)' : r <= 10 ? 'color-mix(in srgb, var(--accent) 60%, var(--muted))' : r >= 13 ? 'var(--bad)' : 'var(--faint)';
  const shade = (p, color = 'var(--accent)') => p <= 0.005 ? '' : `background:color-mix(in srgb, ${color} ${Math.round(8 + p * 62)}%, transparent)`;
  const head = {
    stats: `<th class="rank">#</th><th class="l">Lag</th><th>SM</th><th>V</th><th class="hide-sm">ÖV</th><th class="hide-sm">ÖF</th><th>F</th><th class="hide-sm">GM–IM</th><th>+/-</th><th>P</th>`,
    proj: `<th class="rank">#</th><th class="l">Lag</th><th>P</th><th>Proj.<small>poäng</small></th><th class="hide-sm">Topp 6</th><th>Slutspel<small>topp 10</small></th><th class="hide-sm">SHL-kval</th><th>Guld</th>`,
    full: `<th class="rank">#</th><th class="l">Lag</th><th>SM</th><th>V</th><th>ÖV</th><th>ÖF</th><th>F</th><th>GM–IM</th><th>P</th><th>Takt<small>52 matcher</small></th><th>Proj.<small>poäng</small></th>
       <th>Topp 6<small>direkt KF</small></th><th>Slutspel<small>topp 10</small></th><th>SHL-kval<small>plats 13–14</small></th><th>SM-guld</th>`,
  }[mode];
  const rows = TABLE.map((r, i) => {
    const s = SIM[r.code] || {}, rank = i + 1, pace = r.gp ? Math.round(r.pts / r.gp * 52) : '–';
    const team = `<td class="l"><a class="teamcell" href="#/lag/${r.code}">${tb(r.code, compact ? '' : 'md')}<div class="nm"><b>${esc(compact ? r.code : tName(r.code))}</b>${compact ? '' : `<span>${esc(r.code)}</span>`}</div></a></td>`;
    const odds = (p, c) => `<td class="odds"><span style="${shade(p, c)}">${oddsTxt(p)}</span></td>`;
    // Gold odds are small numbers, so their shading is stretched 3× to stay visible
    const gold = `<td class="odds"><span style="${shade(Math.min(1, s.gold * 3), 'var(--gold)')}">${oddsTxt(s.gold)}</span></td>`;
    const cls = [[6, 10, 12].includes(i) ? 'cut' : '', r.code === FAV ? 'fav' : ''].join(' ');
    const cells = {
      stats: `<td>${r.gp}</td><td>${r.w}</td><td class="hide-sm">${r.otw}</td><td class="hide-sm">${r.otl}</td><td>${r.l}</td><td class="hide-sm">${r.gf}–${r.ga}</td><td>${signed(r.gf - r.ga)}</td><td><b>${r.pts}</b></td>`,
      proj: `<td><b>${r.pts}</b></td><td>${Math.round(s.proj)}</td>${odds(s.top6).replace('<td class="odds">', '<td class="odds hide-sm">')}${odds(s.top10)}${odds(s.rel, 'var(--bad)').replace('<td class="odds">', '<td class="odds hide-sm">')}${gold}`,
      full: `<td>${r.gp}</td><td>${r.w}</td><td>${r.otw}</td><td>${r.otl}</td><td>${r.l}</td><td>${r.gf}–${r.ga}</td><td><b>${r.pts}</b></td><td>${pace}</td><td><b>${Math.round(s.proj)}</b></td>
         ${odds(s.top6)}${odds(s.top10)}${odds(s.rel, 'var(--bad)')}${gold}`,
    }[mode];
    return `<tr class="${cls}"><td class="rank" style="--zone:${zone(rank)}">${rank}</td>${team}${cells}</tr>`;
  }).join('');
  return `<div class="tscroll"><table class="t ${compact ? 'compact' : ''}" style="min-width:${compact ? 300 : 900}px"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
const legendHtml = `<div class="legend"><span><i style="background:var(--accent)"></i>Kvartsfinal (1–6)</span><span><i style="background:color-mix(in srgb, var(--accent) 60%, var(--muted))"></i>Play in (7–10)</span><span><i style="background:var(--bad)"></i>SHL-kval (13–14)</span></div>`;

// A game as a clickable row. Inside a day group the date is already in the heading, so it's left out.
function gameRow(g, { dated = false } = {}) {
  const done = isFinal(g), live = isLive(g);
  const side = (c, lose, cls) => `<div class="side ${cls} ${lose ? 'lose' : ''}">${tb(c, 'md')}<b class="full">${esc(tName(c))}</b><b class="short">${esc(c)}</b></div>`;
  const mid = done || live
    ? `<div class="res num">${g.hs}–${g.as}<small>${statusTxt(g)}</small></div>`
    : `<div class="res">${fmtTime(g.start)}<small>Nedsläpp</small></div>`;
  const end = done ? `<span class="cta">${g.hv ? '<span class="vid-dot">Video</span>' : ''}<span class="cta-txt">Matchfakta</span><span class="chev">›</span></span>` : live ? '<span class="tag bad">LIVE</span>' : oddsBar(g.ph);
  const fav = FAV && (g.home === FAV || g.away === FAV);
  return `<a class="grow ${dated ? 'dated' : ''} ${fav ? 'fav' : ''}" href="#/match/${g.id}">${dated ? `<span class="time">${fmtDay(g.start)}</span>` : ''}${side(g.home, done && g.hs < g.as, 'home')}${mid}${side(g.away, done && g.as < g.hs, 'away')}${end}</a>`;
}
const gameList = (games, opts) => `<div class="day">${games.map((g) => gameRow(g, opts)).join('')}</div>`;

function leaderList(rows, { val, fmt = (v) => v, team = (r) => r.team, n = 10, sub = null, avatars = true }) {
  if (!rows.length) return '<p class="empty-state">Ingen statistik ännu.</p>';
  return `<ol class="lb ${avatars ? '' : 'noav'}">${rows.slice(0, n).map((r, i) => `<li><span class="r num">${i + 1}.</span>${tb(team(r), avatars ? '' : 'md')}${avatars ? avatar(r.id, r.name, team(r)) : ''}<span class="n">${pLink(r.id, r.name)}${sub ? `<small>${sub(r)}</small>` : ''}</span><span class="v">${fmt(val(r))}</span></li>`).join('')}</ol>`;
}
function leaderTile(title, rows, { val, fmt = (v) => v, n = 5 }) {
  if (!rows.length) return `<div class="ltile"><h3>${title}</h3><span class="faint">Inga spelare ännu.</span></div>`;
  const t = rows[0];
  return `<div class="ltile" style="--tc:${tColor(t.team)}"><h3>${title}</h3>
    <div class="ltop">${avatar(t.id, t.name, t.team, 'md')}<div class="ltop-name">${tb(t.team)}${pLink(t.id, t.name)}</div><span class="big">${fmt(val(t))}</span></div>
    <ol>${rows.slice(1, n).map((r, i) => `<li><span class="faint">${i + 2}</span>${tb(r.team)}${pLink(r.id, r.name)}<b>${fmt(val(r))}</b></li>`).join('')}</ol></div>`;
}
const skaters = (season = CUR) => D.seasons[season].skaters;
const goalies = (season = CUR) => D.seasons[season].goalies;
const goalieMinGp = (season) => Math.max(1, Math.round(Math.max(0, ...goalies(season).map((g) => g.gpi)) * 0.3));
const lgSv = (season) => { const gs = goalies(season); const sv = sum(gs.map((g) => g.sv)), ga = sum(gs.map((g) => g.ga)); return sv / Math.max(1, sv + ga); };
const gsaa = (g, season) => g.sv - (g.sv + g.ga) * lgSv(season);

function gsaaChart(season) {
  const minMin = season === CUR ? 60 : 600;
  const rows = goalies(season).filter((g) => g.mins >= minMin).map((g) => ({ ...g, v: gsaa(g, season) })).sort((a, b) => b.v - a.v);
  if (!rows.length) return '<p class="empty-state">Inga målvakter med tillräckligt många minuter ännu.</p>';
  const W = cw(640), rowH = isNarrow() ? 28 : 22, top = 26, left = isNarrow() ? 140 : 160, right = 46, plotW = W - left - right, H = top + rows.length * rowH + 8;
  const ext = Math.max(1, ...rows.map((g) => Math.abs(g.v)));
  const step = ext > 20 ? 10 : ext > 8 ? 5 : ext > 4 ? 2 : 1, lim = Math.ceil(ext / step) * step;
  const x = (v) => left + (v + lim) / (2 * lim) * plotW;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Räddade mål över genomsnittet, ${season}">`;
  for (let t = -lim; t <= lim; t += step) svg += `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 6}" y2="${H - 6}" style="stroke:var(--line)" stroke-width="${t === 0 ? 1.5 : 1}"/><text x="${x(t)}" y="${top - 12}" text-anchor="middle" font-size="11" style="fill:var(--muted)">${t > 0 ? '+' : ''}${t}</text>`;
  const fs = isNarrow() ? 13.5 : 12.5, mid = rowH / 2; // text sits on the row's centre line
  rows.forEach((g, i) => {
    const y = top + i * rowH, v = g.v, x0 = x(0), x1 = x(v);
    svg += `<a href="#/spelare/${encodeURIComponent(g.id)}"><text x="${left - 34}" y="${y + mid + 4.5}" text-anchor="end" font-size="${fs}" style="fill:var(--text)">${esc(g.name)}</text></a>`;
    const badge = `<g ${LOGOS[g.team] ? 'style="opacity:0"' : ''}><rect x="${left - 29}" y="${y + mid - 8}" width="24" height="16" rx="4" style="fill:${tColor(g.team)}"/><text x="${left - 17}" y="${y + mid + 3.5}" text-anchor="middle" font-size="8.5" font-weight="700" style="fill:${(TC[g.team] || [0, '#fff'])[1]}">${esc(g.team)}</text></g>`;
    svg += badge + (LOGOS[g.team] ? `<image href="${esc(LOGOS[g.team])}" x="${left - 27}" y="${y + mid - 10}" width="20" height="20" onerror="this.previousElementSibling.style.opacity=1;this.remove()"/>` : '');
    svg += `<rect x="${Math.min(x0, x1)}" y="${y + 4}" width="${Math.max(1, Math.abs(x1 - x0))}" height="${rowH - 8}" rx="3" style="fill:${v >= 0 ? 'var(--accent)' : 'var(--bad)'}"><title>${esc(g.name)}: ${dec(v)} GSAA, ${dec(g.svp, 2)} % räddningar, ${g.gpi} matcher</title></rect>`;
    svg += `<text x="${v >= 0 ? x1 + 5 : x1 - 5}" y="${y + mid + 4}" text-anchor="${v >= 0 ? 'start' : 'end'}" font-size="${fs - 0.5}" font-weight="600" style="fill:var(--muted)">${v > 0 ? '+' : ''}${dec(v)}</text>`;
  });
  return svg + '</svg>';
}
const clipTitle = (c) => `${esc(c.scorer?.name || 'Mål')}`;
const clipSub = (c) => `${esc(c.team)} mot ${esc(c.opp)} · ${c.score[0]}–${c.score[1]} · ${fmtDay(c.date)}`;

/* =====================================================================
   Pages
   ===================================================================== */
function setTitle(t) { document.title = t ? `${t} · SHLstats` : 'SHLstats'; }
// The page name in the phone header
const mTitle = (t) => { const el = $('m-title'); if (el) el.textContent = t; };
const render = (html) => { app.innerHTML = html; layoutBoards(); countUp(app); };

/* ---------- Översikt ---------- */
// Top of the overview: SHL news rotating on the left; your team (or a team picker) on the right
const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };
function newsBox() {
  const news = D.news || [];
  const slides = news.map((n, i) => `<a class="nslide ${i === 0 ? 'on' : ''}" href="#/nyheter/${encodeURIComponent(n.id)}" data-i="${i}" ${i ? 'aria-hidden="true" tabindex="-1"' : ''}>
      ${n.img ? `<img src="${esc(n.img)}" alt="" ${i ? 'loading="lazy"' : ''}>` : ''}
      <span class="nslide-shade"></span>
      <span class="nslide-text"><span class="nslide-meta">${n.label ? `${esc(n.label)} · ` : ''}${fmtDay(n.date)}</span><b>${esc(n.title)}</b><span class="nslide-intro">${esc(n.intro)}</span></span>
    </a>`).join('');
  return news.length
    ? `<div class="news" id="news" aria-roledescription="karusell" aria-label="Senaste nyheterna från SHL"><div class="nslides">${slides}</div>
        <div class="nctrl"><button class="nnav" data-d="-1" aria-label="Föregående nyhet">‹</button>${news.map((_, i) => `<button class="ndot ${i === 0 ? 'on' : ''}" data-i="${i}" aria-label="Nyhet ${i + 1}"></button>`).join('')}<button class="nnav" data-d="1" aria-label="Nästa nyhet">›</button></div></div>`
    : '<div class="news news-empty"><p>Inga nyheter just nu.</p></div>';
}
function newsHero() {
  const fav = FAV && SIM[FAV] ? FAV : null;
  return `<section class="panel mday newshero"><div class="mday-grid">${newsBox()}${fav ? myTeamSide(fav) : pickerSide()}</div></section>`;
}
function myTeamSide(fav) {
  const r = TABLE.find((t) => t.code === fav), s = SIM[fav];
  const next = GAMES.find((x) => !isFinal(x) && (x.home === fav || x.away === fav));
  const last = [...GAMES].reverse().find((x) => isFinal(x) && (x.home === fav || x.away === fav));
  const mini = (g, lbl) => g
    ? `<a class="mini-game" href="#/match/${g.id}"><span class="mini-lbl">${lbl}</span>
        <span class="mg-teams">${tb(g.home, 'md')}<b class="num">${isFinal(g) ? `${g.hs}–${g.as}` : fmtTime(g.start)}</b>${tb(g.away, 'md')}</span>
        <span class="mg-sub">${fmtDay(g.start)}${isFinal(g) && (g.ot || g.so) ? ' · ÖT' : ''}</span></a>`
    : `<div class="mini-game"><span class="mini-lbl">${lbl}</span><span class="mg-sub">Ingen match</span></div>`;
  return `<div class="mday-side">
      <span class="mini-lbl">Mitt lag</span>
      <a class="mday-teamname" href="#/lag/${fav}">${tb(fav, 'lg')}<span><b>${esc(tName(fav))}</b><small>Plats ${TABLE.indexOf(r) + 1} · ${r.pts} poäng · ${r.gp} matcher</small></span></a>
      ${formChips(fav)}
      <div class="mday-stats">
        <div><b>${oddsTxt(s.top10)}</b><span>Slutspel</span></div>
        <div><b>${oddsTxt(s.top6)}</b><span>Topp 6</span></div>
        <div><b>${oddsTxt(s.gold)}</b><span>SM-guld</span></div>
        <div><b>${dec(s.proj, 0)}</b><span>Proj. poäng</span></div>
      </div>
      <div class="mini-games">${mini(last, 'Senaste match')}${mini(next, 'Nästa match')}</div>
      <button class="linkbtn" data-fav="${fav}">Sluta följa ${esc(fav)}</button>
    </div>`;
}
function pickerSide() {
  return `<div class="mday-side">
      <span class="mini-lbl">Följ ditt lag</span>
      <p class="muted" style="margin:0;font-size:14px">Välj ett lag så visas dess tabellplats, odds och matcher här, och lagets matcher lyfts fram över hela sajten.</p>
      <div class="pickteams sm">${[...CODES].sort((a, b) => tName(a).localeCompare(tName(b), 'sv')).map((c) => `<button data-fav="${c}" title="Följ ${esc(tName(c))}" aria-label="Följ ${esc(tName(c))}">${tb(c, 'md')}</button>`).join('')}</div>
    </div>`;
}
// Rotates the news every 7 seconds; pauses while you hover or focus it; arrows, dots and swipe
let newsTimer = null;
function setupNewsCarousel() {
  clearInterval(newsTimer);
  const box = $('news'); if (!box) return;
  const slides = [...box.querySelectorAll('.nslide')], dots = [...box.querySelectorAll('.ndot')];
  if (slides.length < 2) return;
  let i = 0, paused = false;
  const go = (n) => {
    i = (n + slides.length) % slides.length;
    slides.forEach((s, k) => { s.classList.toggle('on', k === i); s.setAttribute('aria-hidden', k !== i); s.tabIndex = k === i ? 0 : -1; });
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) newsTimer = setInterval(() => { if (!paused && document.visibilityState === 'visible') go(i + 1); }, 7000);
  box.addEventListener('mouseenter', () => { paused = true; });
  box.addEventListener('mouseleave', () => { paused = false; });
  box.addEventListener('focusin', () => { paused = true; });
  box.addEventListener('focusout', () => { paused = false; });
  box.querySelector('.nctrl').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.d) go(i + Number(b.dataset.d)); else go(Number(b.dataset.i));
  };
  let x0 = null;
  box.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { go(i + (dx < 0 ? 1 : -1)); paused = true; }
  });
}
// A news item on this site: headline, image and the SHL's own intro, with the full article on shl.se
function pageNews(id) {
  const n = (D.news || []).find((x) => x.id === id);
  if (!n) return notFound('Nyheten finns inte längre bland de senaste nyheterna.');
  setTitle(n.title);
  const url = safeUrl(n.url);
  const others = (D.news || []).filter((x) => x.id !== id);
  render(`<div class="crumbs"><a href="#/">Översikt</a> / Nyheter</div>
    <article class="panel narticle">
      ${n.img ? `<img class="narticle-img" src="${esc(n.img)}" alt="">` : ''}
      <div class="narticle-body">
        <span class="mini-lbl">${n.label ? `${esc(n.label)} · ` : ''}${fmtDay(n.date)} ${dateParts(n.date).y}</span>
        <h1>${esc(n.title)}</h1>
        <p class="narticle-intro">${esc(n.intro)}</p>
        ${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Läs hela artikeln på shl.se ↗</a>` : ''}
        <p class="note">Artikeln är skriven av SHL och publiceras på shl.se.</p>
      </div>
    </article>
    ${others.length ? panel('Fler nyheter', `<div class="nlist">${others.map((o) => `<a class="nitem" href="#/nyheter/${encodeURIComponent(o.id)}">
      ${o.img ? `<img src="${esc(o.img)}" alt="" loading="lazy">` : '<span></span>'}<span><span class="mini-lbl">${fmtDay(o.date)}</span><b>${esc(o.title)}</b></span></a>`).join('')}</div>`) : ''}`);
}

function pageOverview() {
  if (isNarrow()) return pageHome(); // phones get their own Hem page
  setTitle('');
  const today = todayStr();
  const upcoming = GAMES.filter((g) => !isFinal(g));
  const finals = GAMES.filter(isFinal);
  const lastDate = finals[finals.length - 1]?.start.slice(0, 10);
  const lastGames = finals.filter((g) => g.start.slice(0, 10) === lastDate);
  // Upcoming games by day, whole days only, until the card roughly matches the results card beside it
  const comingDays = [];
  for (const g of upcoming) {
    const d = g.start.slice(0, 10), last = comingDays[comingDays.length - 1];
    if (last && last[0] === d) last[1].push(g);
    else if (sum(comingDays.map((x) => x[1].length)) < Math.max(lastGames.length, 5)) comingDays.push([d, [g]]);
    else break;
  }
  const gmin = goalieMinGp(CUR);
  const gold = CODES.map((c) => ({ label: tName(c), code: c, v: SIM[c].gold })).sort((a, b) => b.v - a.v);
  const race = CODES.map((c) => ({ label: tName(c), code: c, v: SIM[c].top10 })).sort((a, b) => b.v - a.v);
  const hls = (D.highlights || []).slice(0, 6);
  const seg = (id, opts, on) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${v === on}">${l}</button>`).join('')}</div>`;
  const tableMode = store.get('shlstats-ovtable') === 'proj' ? 'proj' : 'stats';
  // Rows of cards; cards in the same row always share the same height
  const row = (cls, items) => `<div class="ov-row ${cls}">${items.filter(Boolean).join('')}</div>`;
  const section = (ic, title) => `<h2 class="section-title">${icon(ic)}${title}</h2>`;

  render(`
    ${newsHero()}
    ${section('table', 'Tabell')}
    ${row('r-leaders', [
      panel('Tabell', `<div id="ov-table">${standingsTable({ mode: tableMode })}</div>${legendHtml}`,
        { more: seg('ov-table-mode', [['stats', 'Tabell'], ['proj', 'Odds']], tableMode), foot: `${moreLink('#/tabell', 'Hela tabellen')}<span class="stamp">Uppdaterad ${esc(stampTxt)}</span>` }),
      panel('Spelare', '<div id="ov-sk" class="fill"></div>', { more: seg('ov-sk-stat', [['pts', 'Poäng'], ['g', 'Mål'], ['a', 'Assist']], 'pts'), foot: moreLink('#/statistik', 'All statistik') }),
      panel('Målvakter', '<div id="ov-gk" class="fill"></div>', { more: seg('ov-gk-stat', [['svp', 'Rädd%'], ['gaa', 'GAA'], ['gsaa', 'GSAA']], 'svp'),
        foot: `${moreLink('#/statistik', 'Alla målvakter')}<span class="stamp">Minst ${gmin} matcher</span>` }),
    ])}
    ${section('calendar', 'Matcher')}
    ${row('r-two', [
      panel('Kommande matcher', comingDays.length ? comingDays.map(([d, gs]) => `<div class="day"><h3>${d === today ? 'Idag' : fmtDay(d)}</h3>${gs.map((g) => gameRow(g)).join('')}</div>`).join('') : '<p class="empty-state">Inga fler matcher i grundserien.</p>',
        { more: moreLink('#/matcher', 'Alla matcher') }),
      panel('Senaste resultat', lastGames.length ? `<div class="day"><h3>${fmtDay(lastDate)}</h3>${lastGames.map((g) => gameRow(g)).join('')}</div>` : '<p class="empty-state">Inga spelade matcher ännu.</p>',
        { more: moreLink('#/matcher/spelade', 'Alla resultat') }),
    ])}
    ${hls.length ? row('r-one', [panel('Matchsammandrag', `<div class="clips six">${hls.map((h) => clipCard(h, `${esc(h.home)} ${h.hs}–${h.as} ${esc(h.away)}`, fmtDay(h.date))).join('')}</div>`)]) : ''}
    ${section('chart', 'Odds')}
    ${row('r-two', [
      panel('Slutspelsstrecket', `<div class="chart">${hBars(race, { max: 1, labelW: 140, logos: true, color: (it) => it.v >= 0.5 ? 'var(--accent)' : 'var(--bad)' })}</div>`, { sub: 'Chans att sluta topp 10 och nå slutspel.' }),
      panel('Chans till SM-guld', `<div class="chart">${hBars(gold, { labelW: 140, logos: true })}</div>`, { sub: 'Andel av 10 000 simuleringar där laget vinner SM-finalen.', more: moreLink('#/tabell', 'Alla odds') }),
    ])}`);

  // Toggles: table vs. predictions, and the stat shown in each top-10 list
  const bindSeg = (id, draw) => {
    const el = $(id);
    el.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; [...el.children].forEach((c) => c.setAttribute('aria-pressed', c === b)); draw(b.dataset.v); };
  };
  bindSeg('ov-table-mode', (v) => { store.set('shlstats-ovtable', v); $('ov-table').innerHTML = standingsTable({ mode: v }); });
  const SK_OPTS = { pts: [(p) => p.pts * 1000 + p.g, (p) => p.pts], g: [(p) => p.g * 1000 + p.pts, (p) => p.g], a: [(p) => p.a * 1000 + p.pts, (p) => p.a] };
  const drawSk = (k) => {
    const [order, val] = SK_OPTS[k];
    $('ov-sk').innerHTML = leaderList([...skaters()].sort((a, b) => order(b) - order(a)), { val, avatars: false, sub: (p) => `${p.g}+${p.a} på ${p.gp} matcher` });
  };
  const GK_OPTS = {
    svp: [(g) => g.svp, (g) => dec(g.svp, 2)],
    gaa: [(g) => -g.gaa, (g) => dec(g.gaa, 2)],
    gsaa: [(g) => gsaa(g, CUR), (g) => { const v = gsaa(g, CUR); return (v > 0 ? '+' : '') + dec(v); }],
  };
  const drawGk = (k) => {
    const [order, fmt] = GK_OPTS[k];
    $('ov-gk').innerHTML = leaderList(goalies().filter((g) => g.gpi >= gmin).sort((a, b) => order(b) - order(a)),
      { val: (g) => g, fmt, avatars: false, sub: (g) => `${g.gpi} matcher` });
  };
  bindSeg('ov-sk-stat', drawSk); bindSeg('ov-gk-stat', drawGk);
  drawSk('pts'); drawGk('svp');
  setupNewsCarousel();
}

/* ---------- Matcher ---------- */
let gamesTeam = 'ALL';
function pageGames(view = 'kommande') {
  if (isNarrow()) return pageDay(view); // phones: one game day at a time
  if (!['kommande', 'spelade', 'alla'].includes(view)) view = 'kommande';
  setTitle('Matcher');
  gamesTeam = gamesTeam === 'ALL' && FAV && store.get('shlstats-gfilter') === 'fav' ? FAV : gamesTeam;
  render(`
    <div class="page-head"><div><h1>Matcher & resultat</h1><p>Hela grundseriens spelschema ${CUR.replace('-', '/')} med resultat, målvideor och vinstchanser.</p></div></div>
    <section class="panel">${tabs('/matcher', [['', 'Kommande', '', 'clock'], ['spelade', 'Spelade'], ['alla', 'Alla']], view === 'kommande' ? '' : view)}
      <div class="p-body" style="padding-top:16px">
        <div class="controls"><label class="field">Lag <select id="gt"><option value="ALL">Alla lag</option>${[...CODES].sort((a, b) => tName(a).localeCompare(tName(b), 'sv')).map((c) => `<option value="${c}" ${gamesTeam === c ? 'selected' : ''}>${esc(tName(c))}${c === FAV ? ' (mitt lag)' : ''}</option>`).join('')}</select></label></div>
        <div id="glist" style="display:grid;gap:16px"></div>
      </div></section>`);
  const draw = () => {
    let list = GAMES.filter((g) => gamesTeam === 'ALL' || g.home === gamesTeam || g.away === gamesTeam);
    if (view === 'kommande') list = list.filter((g) => !isFinal(g));
    if (view === 'spelade') list = list.filter(isFinal).reverse();
    const byDate = new Map();
    for (const g of list) { const d = g.start.slice(0, 10); if (!byDate.has(d)) byDate.set(d, []); byDate.get(d).push(g); }
    $('glist').innerHTML = [...byDate].map(([d, gs]) => `<div class="day"><h3>${fmtDay(d)} ${dateParts(d).y}</h3>${gs.map((g) => gameRow(g)).join('')}</div>`).join('') || '<p class="empty-state">Inga matcher att visa.</p>';
  };
  $('gt').onchange = (e) => { gamesTeam = e.target.value; store.set('shlstats-gfilter', gamesTeam === FAV ? 'fav' : null); draw(); };
  draw();
}

/* ---------- Match ---------- */
async function pageMatch(id, tab = '') {
  const g = GAMES_BY_ID[id];
  if (!g) return notFound('Matchen hittades inte.');
  setTitle(`${g.home}–${g.away}`); mTitle(`${g.home}–${g.away}`);
  const done = isFinal(g), live = isLive(g);
  const rec = (c) => { const r = TABLE.find((t) => t.code === c); return r ? `${r.pts} p · plats ${TABLE.indexOf(r) + 1}` : ''; };
  if ((done || live) && !(id in gameCache)) app.innerHTML = skeleton();
  let d = done || live ? await loadGame(id) : null;
  if (live && LIVE_API) {
    const L = await loadLive(id);
    if (L) {
      d = liveDetails(g, L, d);
      liveSig = `${g.id}|${L.hs}|${L.as}|${L.events.length}|${L.state}|${L.p}|${L.t}`;
      g.hs = L.hs; g.as = L.as;
    }
  }
  const base = `/match/${id}`;
  const tabList = done || live
    ? [['', 'Översikt'], ['video', 'Video', d ? d.goals.filter((x) => x.clip).length + (d.hl ? 1 : 0) || '' : ''], ['spelare', 'Spelare'], ['skott', 'Skott & utvisningar']]
    : [['', 'Förhandstips'], ['uppstallning', 'Uppställningar'], ['inbordes', 'Inbördes möten']];
  if (!tabList.some(([k]) => k === tab)) tab = '';
  const meta = [`${fmtDay(g.start)} ${dateParts(g.start).y}, ${fmtTime(g.start)}`, d?.arena || g.arena, d?.att ? `Publik ${d.att.toLocaleString('sv-SE')}` : ''].filter(Boolean);
  const head = `<section class="panel mpanel" style="--hc:${pairColors(g.home, g.away)[0]};--ac:${pairColors(g.home, g.away)[1]}">
    <div class="band">
    <div class="crumbs" style="padding:16px 22px 0"><a href="#/matcher">Matcher</a> / ${esc(tName(g.home))} – ${esc(tName(g.away))}</div>
    <div class="mhead">
      <a class="mteam" href="#/lag/${g.home}">${tb(g.home, 'xl')}<b>${esc(tName(g.home))}</b><span>Hemma · ${rec(g.home)}</span></a>
      <div class="mscore">${done || live ? `<div class="sc">${g.hs}–${g.as}</div>` : `<div class="sc sm">${fmtTime(g.start)}</div>`}
        <div class="st ${live ? 'live' : ''}">${done ? statusTxt(g) : live ? `<i class="live-dot"></i>${esc(liveClock(d?.live))}` : fmtDay(g.start)}</div></div>
      <a class="mteam" href="#/lag/${g.away}">${tb(g.away, 'xl')}<b>${esc(tName(g.away))}</b><span>Borta · ${rec(g.away)}</span></a>
    </div>
    </div>
    <div class="mmeta" style="padding-top:14px">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>
    ${tabs(base, tabList, tab)}
  </section>`;
  let body;
  if (done || live) {
    if (!d) body = panel('Matchfakta', '<p class="empty-state">Detaljerad matchdata finns inte för den här matchen ännu. Den hämtas vid nästa uppdatering.</p>');
    else body = tab === 'video' ? matchVideo(d) : tab === 'spelare' ? matchPlayers(d) : tab === 'skott' ? matchEvents(d) : matchSummary(d, done);
  } else {
    body = tab === 'uppstallning' ? (isNarrow()
        ? panel('Projicerad uppställning', `<div class="tt">${teamToggle(g.home, g.away)}<div data-pane="home">${lineupHtml(g.home)}</div><div data-pane="away" hidden>${lineupHtml(g.away)}</div></div>`)
        : board([panel(`Projicerad uppställning: ${esc(tName(g.home))}`, lineupHtml(g.home)), panel(`Projicerad uppställning: ${esc(tName(g.away))}`, lineupHtml(g.away))]))
      : tab === 'inbordes' ? matchH2H(g) : matchPreview(g);
  }
  render(head + body);
  if ((done || live) && d && tab === 'spelare') for (const side of ['home', 'away']) boxTable(d, side);
}

function goalEvents(d, { compact = false } = {}) {
  const pName = (p) => p === 4 ? 'Övertid' : p >= 5 ? 'Straffar' : `Period ${p}`;
  const periods = [...new Set(d.goals.map((x) => x.p))].sort();
  if (!d.goals.length) return '<p class="empty-state">Inga mål i matchen.</p>';
  return `<div class="timeline">${periods.map((p) => `<h4>${pName(p)}</h4>` + d.goals.filter((x) => x.p === p).map((x) => {
    const team = d[x.team], st = strengthTag(x);
    const assists = [x.a1, x.a2].filter(Boolean).map((a) => pLink(a.id, a.name)).join(', ');
    return `<div class="ev"><span class="t">${esc(x.t)}</span>${tb(team)}<div class="who">${pLink(x.scorer?.id, x.scorer?.name || 'Okänd')}${st ? `<span class="tag">${st}</span>` : ''}<small>${assists ? 'Assist: ' + assists : 'Ingen assist'}</small></div>
      <span class="ev-end"><span class="sc">${x.score[0]}–${x.score[1]}</span>${x.clip && safeEmbed(x.clip.embed) ? `<button class="playic" data-embed="${esc(x.clip.embed)}" data-title="${esc(`${x.scorer?.name || 'Mål'} ${x.score[0]}–${x.score[1]}`)}" aria-label="Spela upp målet">${PLAY_SVG}</button>` : ''}</span></div>`;
  }).join('')).join('')}</div>`;
}
function teamCompare(d) {
  const H = d.team.home || {}, A = d.team.away || {};
  const has = (k) => H[k] != null || A[k] != null; // live games only have some of the numbers
  const row = (label, h, a, hv = h, av = a) => {
    const tot = (hv || 0) + (av || 0), hp = tot ? hv / tot * 100 : 50;
    return `<div class="cmp-row"><span class="v">${h}</span><div class="mid"><span class="lbl">${label}</span><div class="cmp-bar"><i style="width:${hp}%"></i><i style="width:${100 - hp}%"></i></div></div><span class="v">${a}</span></div>`;
  };
  return `<div class="cmp" style="--h-color:${pairColors(d.home, d.away)[0]};--a-color:${pairColors(d.home, d.away)[1]}">
    <div class="cmp-row cmp-head"><span class="v">${tb(d.home, 'md')}</span><span></span><span class="v">${tb(d.away, 'md')}</span></div>
    ${row('Skott på mål', H.SOG ?? 0, A.SOG ?? 0)}
    ${row('Powerplay', `${H.PPG ?? 0}/${H.NumPP ?? 0}`, `${A.PPG ?? 0}/${A.NumPP ?? 0}`, H.PPG || 0, A.PPG || 0)}
    ${has('FOW') ? row('Vunna tekningar', H.FOW ?? 0, A.FOW ?? 0) : ''}
    ${has('Hits') ? row('Tacklingar', H.Hits ?? 0, A.Hits ?? 0) : ''}
    ${has('BkS') ? row('Blockerade skott', H.BkS ?? 0, A.BkS ?? 0) : ''}
    ${row('Utvisningsminuter', H.PIM ?? 0, A.PIM ?? 0)}
    ${has('Saves') ? row('Räddningar', H.Saves ?? 0, A.Saves ?? 0) : ''}
  </div>`;
}
function matchSummary(d, done = true) {
  const per = d.periods.length ? `<div class="tscroll"><table class="t"><thead><tr><th class="l">Lag</th>${d.periods.map((p) => `<th>${p.p <= 3 ? p.p : p.p === 4 ? 'ÖT' : 'STR'}</th>`).join('')}<th>Mål</th><th>Skott</th></tr></thead><tbody>
    ${['home', 'away'].map((s) => `<tr><td class="l">${teamLink(d[s], { name: true })}</td>${d.periods.map((p) => `<td>${s === 'home' ? p.h : p.a}</td>`).join('')}<td class="hl">${s === 'home' ? d.hs : d.as}</td><td>${d.team[s].SOG ?? '–'}</td></tr>`).join('')}</tbody></table></div>` : '';
  return board([
    d.live ? liveBanner(d) : '',
    panel('Mål', goalEvents(d), { cls: 'wide' }),
    done ? matchRecap(d) : '',
    panel('Lagstatistik', teamCompare(d)),
    per ? panel('Periodresultat', per) : '',
  ]);
}

// A game being played: the clock, shots and the latest goal, refreshed automatically
function liveBanner(d) {
  const L = d.live, last = d.goals[d.goals.length - 1];
  return `<section class="panel wide live-card" style="--hc:${pairColors(d.home, d.away)[0]};--ac:${pairColors(d.home, d.away)[1]}"><div class="p-body">
    <div class="live-top"><span class="live-badge"><i class="live-dot"></i>Live</span><b>${esc(liveClock(L))}</b><span class="faint">Uppdateras automatiskt</span></div>
    <div class="live-nums">
      <div><span class="k">Skott på mål</span><span class="v num">${d.team.home.SOG}–${d.team.away.SOG}</span></div>
      <div><span class="k">Utvisningsminuter</span><span class="v num">${d.team.home.PIM}–${d.team.away.PIM}</span></div>
      <div><span class="k">Senaste mål</span><span class="v sm">${last ? `${esc(last.scorer?.name || 'Mål')} <span class="faint">${esc(d[last.team])} · ${esc(PERIOD_NAME(last.p).toLowerCase())} ${esc(last.t)}</span>` : 'Inga mål ännu'}</span></div>
    </div></div></section>`;
}

/* ---------- Match report: summary text, three stars, xG and key moments (finished games) ---------- */
const clockSec = (x) => { const [m, s] = String(x.t || '0:0').split(':').map(Number); return (x.p - 1) * 1200 + m * 60 + s; };
const whenTxt = (x) => x.p === 4 ? `i förlängningen (${x.t})` : x.p >= 5 ? 'i straffläggningen' : `i ${['första', 'andra', 'tredje'][x.p - 1]} perioden (${x.t})`;
// Swedish genitive: Växjö Lakers, Örebro Hockeys, Frölunda HC:s, HV71:s
const gen = (n) => /[sxz]$/.test(n) ? n : /[A-ZÅÄÖ0-9]$/.test(n) ? n + ':s' : n + 's';
const countTxt = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function recapFacts(d) {
  const winSide = d.hs > d.as ? 'home' : 'away', loseSide = winSide === 'home' ? 'away' : 'home';
  const w = Math.max(d.hs, d.as), l = Math.min(d.hs, d.as);
  const goals = d.goals.filter((x) => x.p < 5), so = d.goals.filter((x) => x.p >= 5);
  // Score progression, seen from the winner
  let worst = 0, worstAt = null, changes = 0, leader = null, alwaysAhead = true;
  for (const x of goals) {
    const [h, a] = x.score, diff = winSide === 'home' ? h - a : a - h;
    if (-diff > worst) { worst = -diff; worstAt = x.score; }
    if (diff <= 0) alwaysAhead = false;
    const now = h > a ? 'home' : a > h ? 'away' : null;
    if (now && leader && now !== leader) changes++;
    if (now) leader = now;
  }
  // Game-winning goal: the winner's goal that put them one ahead of the loser's final total
  let n = 0, gwg = null;
  for (const x of goals) if (x.team === winSide && ++n === l + 1) gwg = x;
  if (d.so) gwg = [...so].reverse().find((x) => x.team === winSide) || null;
  const box = (side) => (d.box[side] || []).map((r) => ({ ...r, side, team: d[side] }));
  const sk = [...box('home'), ...box('away')];
  const gks = ['home', 'away'].flatMap((side) => (d.gk[side] || []).filter((r) => r.soga > 0).map((r) => ({ ...r, side, team: d[side] })));
  return { winSide, loseSide, W: d[winSide], L: d[loseSide], w, l, goals, so, worst, worstAt, changes, alwaysAhead, gwg, sk, gks };
}
function threeStars(d, F) {
  const rated = [
    ...F.sk.map((r) => ({ ...r, kind: 'sk', score: r.g * 3 + r.a * 2 + (r.pm || 0) * 0.5 + (r.sog || 0) * 0.15 + (F.gwg?.scorer?.id && F.gwg.scorer.id === r.id ? 1 : 0) })),
    ...F.gks.map((r) => ({ ...r, kind: 'gk', score: (r.svs - r.soga * 0.9) * 1.5 + (r.ga === 0 && r.soga >= 15 ? 3 : 0) + (r.side === F.winSide ? 1 : 0) })),
  ].filter((r) => r.name).sort((a, b) => b.score - a.score);
  return rated.slice(0, 3).map((r) => ({
    ...r,
    line: r.kind === 'gk'
      ? `${r.svs} räddningar · ${dec(r.svs / r.soga * 100, 1)} %${r.ga === 0 ? ' · nolla' : ''}`
      : [r.g ? countTxt(r.g, 'mål', 'mål') : '', r.a ? countTxt(r.a, 'assist', 'assist') : ''].filter(Boolean).join(', ') || `${r.sog || 0} skott, ${signed(r.pm || 0)}`,
  }));
}
function recapText(d, F) {
  const nm = tName, where = F.winSide === 'home' ? 'hemma' : 'borta';
  const s = [];
  // 1. The result
  if (d.so || d.ot) s.push(`${nm(F.W)} vann ${where} mot ${nm(F.L)} med ${F.w}–${F.l} efter ${d.so ? 'straffläggning' : 'förlängning'}.`);
  else if (F.w - F.l >= 3) s.push(`${nm(F.W)} tog en klar ${where}seger mot ${nm(F.L)} och vann med ${F.w}–${F.l}.`);
  else s.push(`${nm(F.W)} vann ${where} mot ${nm(F.L)} med ${F.w}–${F.l}${F.w + F.l >= 9 ? ' i en målrik match' : F.w - F.l === 1 ? ' efter en jämn match' : ''}.`);
  // 2. How it went
  if (F.worst >= 2) s.push(`${nm(F.W)} låg under med ${F.winSide === 'home' ? F.worstAt.join('–') : [...F.worstAt].reverse().join('–')} men vände matchen.`);
  else if (F.changes >= 2) s.push(`Ledningen bytte lag ${F.changes} gånger.`);
  else if (F.alwaysAhead && F.goals.length && F.goals[0].team === F.winSide && F.w - F.l >= 2) s.push(`${nm(F.W)} gjorde första målet ${whenTxt(F.goals[0])} och släppte aldrig ledningen.`);
  // 3. The decider, told together with a late equaliser from the losing side when there was one
  const who = F.gwg?.scorer?.name;
  const lateTie = [...F.goals].reverse().find((x) => x.p === 3 && x.team === F.loseSide && x.score[0] === x.score[1]);
  if (d.so) s.push(who ? `${who} satte det avgörande straffslaget.` : 'Matchen avgjordes i straffläggningen.');
  else if (who && lateTie && clockSec(lateTie) < clockSec(F.gwg)) {
    const gap = clockSec(F.gwg) - clockSec(lateTie);
    const later = F.gwg.p !== lateTie.p ? whenTxt(F.gwg) : gap < 60 ? `bara ${gap} sekunder senare` : gap < 90 ? 'en minut senare' : `${Math.round(gap / 60)} minuter senare`;
    s.push(`${nm(F.L)} kvitterade till ${lateTie.score.join('–')} ${whenTxt(lateTie)}, men ${who} avgjorde ${later}.`);
  }
  else if (d.ot && who) s.push(`${who} avgjorde ${whenTxt(F.gwg)}.`);
  else if (who && F.w - F.l <= 2) s.push(`Det matchavgörande målet gjorde ${who} ${whenTxt(F.gwg)}.`);
  // 4. Standout skaters: hat-tricks, then the top point scorer
  const hat = F.sk.filter((r) => r.g >= 3);
  for (const r of hat) s.push(`${r.name} gjorde ${r.g === 3 ? 'hattrick' : `${r.g} mål`} för ${nm(r.team)}${r.a ? ` och hade dessutom ${countTxt(r.a, 'assist', 'assist')}` : ''}.`);
  const top = [...F.sk].sort((a, b) => (b.g + b.a) - (a.g + a.a) || b.g - a.g)[0];
  if (top && !hat.includes(top) && top.g + top.a >= 3) s.push(`${top.name} var matchens poängkung med ${[top.g ? countTxt(top.g, 'mål', 'mål') : '', top.a ? countTxt(top.a, 'assist', 'assist') : ''].filter(Boolean).join(' och ')}.`);
  // 5. Chances (xG)
  if (d.xg) {
    const xw = d.xg[F.winSide === 'home' ? 0 : 1], xl = d.xg[F.winSide === 'home' ? 1 : 0];
    if (Math.abs(xw - xl) < 0.3) s.push(`Chanserna var jämnt fördelade enligt xG, ${dec(xw, 1)}–${dec(xl, 1)}.`);
    else if (xw > xl) s.push(`${nm(F.W)} skapade också de farligaste chanserna, ${dec(xw, 1)}–${dec(xl, 1)} i xG.`);
    else s.push(`${nm(F.L)} skapade egentligen mer enligt xG (${dec(xl, 1)}–${dec(xw, 1)}), men ${nm(F.W)} var effektivare framför mål.`);
  }
  // 6. Goalie
  // The winning goalie when he stood out; the losing one only after a big night in a close game
  const gk = [...F.gks].filter((r) => r.soga >= 15 && (r.side === F.winSide ? r.ga === 0 || r.svs / r.soga >= 0.93 : r.soga >= 30 && r.svs / r.soga >= 0.95 && F.w - F.l <= 1))
    .sort((a, b) => (b.side === F.winSide) - (a.side === F.winSide) || (b.svs / b.soga) - (a.svs / a.soga))[0];
  if (gk) s.push(`${gk.name} i ${gen(nm(gk.team))} mål räddade ${gk.svs} av ${gk.soga} skott${gk.ga === 0 ? ' och höll nollan' : ''}.`);
  return s;
}
function keyMoments(d, F) {
  const m = new Map(); // goal → labels
  const add = (x, label) => { if (!x) return; const e = m.get(x) || []; if (!e.includes(label)) e.push(label); m.set(x, e); };
  if (F.goals[0]) add(F.goals[0], 'Första målet');
  const tally = {};
  for (const [i, x] of F.goals.entries()) {
    const [h, a] = x.score;
    if (h === a && x.p >= 3) add(x, 'Kvittering');
    const who = x.scorer?.name;
    if (who && (tally[who] = (tally[who] || 0) + 1) === 3) add(x, 'Hattrick');
    const prev = F.goals[i - 1];
    if (prev && prev.team === x.team && clockSec(x) - clockSec(prev) <= 60) add(x, `Två mål på ${clockSec(x) - clockSec(prev)} sek`);
  }
  if (F.worst >= 2) { // the goal that started the comeback
    const low = F.goals.findIndex((y) => y.score === F.worstAt);
    add(F.goals.slice(low + 1).find((x) => x.team === F.winSide), 'Vändningen börjar');
  }
  if (d.so) add(F.gwg, 'Avgörande straff');
  else if (d.ot) add(F.gwg, 'Avgjorde i förlängningen');
  else add(F.gwg, 'Matchavgörande');
  return [...m].sort((a, b) => clockSec(a[0]) - clockSec(b[0])).slice(-6);
}
function matchRecap(d) {
  if (!d.goals.length || d.hs === d.as) return '';
  const F = recapFacts(d), text = recapText(d, F), stars = threeStars(d, F), moments = keyMoments(d, F);
  const xg = d.xg ? (() => {
    const [xh, xa, hdh, hda, sh, sa] = d.xg, hp = xh + xa ? xh / (xh + xa) * 100 : 50, win = xh >= xa ? d.home : d.away;
    return `<div class="rx" style="--hc:${pairColors(d.home, d.away)[0]};--ac:${pairColors(d.home, d.away)[1]}">
      <div class="rx-head"><h3>Förväntade mål (xG)</h3><span class="rx-win">${tb(win)}${esc(tName(win))} vann chanskampen</span></div>
      <div class="rx-bar"><span class="num">${dec(xh, 2)}</span><div class="rx-track"><i style="width:${hp}%"></i><i style="width:${100 - hp}%"></i></div><span class="num">${dec(xa, 2)}</span></div>
      <div class="rx-sub"><span>${tb(d.home)}${d.hs} mål</span><span>Farliga chanser ${hdh}–${hda} · Skott på mål ${sh}–${sa}</span><span>${d.as} mål${tb(d.away)}</span></div>
    </div>`;
  })() : '';
  const starHtml = stars.length ? `<div class="rstars"><h3>Matchens tre stjärnor</h3><ol>${stars.map((r, i) => `<li>
      <span class="rs-n">${'★'.repeat(3 - i)}</span>${avatar(r.id, r.name, r.team, 'md')}
      <div class="rs-who">${r.id ? pLink(r.id, r.name) : `<b>${esc(r.name)}</b>`}<small>${tb(r.team)}${esc(r.line)}</small></div></li>`).join('')}</ol></div>` : '';
  const momentHtml = moments.length ? `<div class="rmoments"><h3>Nyckelögonblick</h3><ol>${moments.map(([x, labels]) => `<li>
      <span class="rm-t num">${x.p <= 3 ? `P${x.p}` : x.p === 4 ? 'ÖT' : 'STR'} ${x.p >= 5 ? '' : esc(x.t)}</span>
      <span class="rm-dot" style="background:${tColor(d[x.team])}"></span>
      <div class="rm-what"><span class="rm-tags">${labels.map((t) => `<span class="rm-tag">${esc(t)}</span>`).join('')}</span><span>${x.scorer?.id ? pLink(x.scorer.id, x.scorer.name) : esc(x.scorer?.name || 'Mål')} <span class="faint">${esc(d[x.team])}</span></span></div>
      <span class="rm-sc num">${x.score[0]}–${x.score[1]}</span></li>`).join('')}</ol></div>` : '';
  return `<section class="panel wide recap"><div class="p-head"><h2>Matchrapport</h2></div><div class="p-body">
    <div class="recap-grid">
      <div class="recap-main"><p class="recap-lead">${esc(text[0])}</p>${text.length > 1 ? `<p class="recap-text">${esc(text.slice(1).join(' '))}</p>` : ''}${xg}</div>
      ${starHtml}
    </div>${momentHtml}</div></section>`;
}
function matchVideo(d) {
  const clips = d.goals.filter((x) => x.clip);
  if (!clips.length && !d.hl) return panel('Video', '<p class="empty-state">Inga videor publicerade för den här matchen ännu. De brukar komma någon timme efter slutsignalen.</p>');
  return board([
    d.hl ? panel('Sammandrag', clipCard(d.hl, `${esc(tName(d.home))} ${d.hs}–${d.as} ${esc(tName(d.away))}`, 'Matchens höjdpunkter', true), { cls: 'wide' }) : '',
    clips.length ? panel('Alla mål', `<div class="clips">${clips.map((x) => clipCard(x.clip, `${esc(x.scorer?.name || 'Mål')} ${x.score[0]}–${x.score[1]}`,
      `${esc(d[x.team])} · ${x.p <= 3 ? 'period ' + x.p : x.p === 4 ? 'övertid' : 'straffar'} ${esc(x.t)}${strengthTag(x) ? ' · ' + strengthTag(x) : ''}`)).join('')}</div>`, { cls: 'wide' }) : '',
  ]);
}
function matchPlayers(d) {
  const gkRows = ['home', 'away'].flatMap((s) => (d.gk[s] || []).filter((r) => r.soga > 0).map((r) => ({ ...r, team: d[s] })));
  const gkHtml = `<div class="tscroll"><table class="t"><thead><tr><th class="l">Målvakt</th><th>Skott</th><th>Räddn.</th><th>Insl.</th><th>Rädd%</th></tr></thead><tbody>${gkRows.map((r) =>
    `<tr><td class="l"><div class="pcell">${tb(r.team)}${avatar(r.id, r.name, r.team)}${pLink(r.id, r.name)}</div></td><td>${r.soga}</td><td>${r.svs}</td><td>${r.ga}</td><td class="hl">${dec(r.svs / r.soga * 100, 1)}</td></tr>`).join('')}</tbody></table></div>`;
  return board([
    panel('Målvakter', gkHtml, { cls: 'wide' }),
    ...(isNarrow()
      ? [panel('Spelare', `<div class="tt">${teamToggle(d.home, d.away)}<div data-pane="home"><div class="tscroll"><table class="t stick" id="box-home"></table></div></div><div data-pane="away" hidden><div class="tscroll"><table class="t stick" id="box-away"></table></div></div></div>`, { cls: 'wide' })]
      : [panel(esc(tName(d.home)), `<div class="tscroll"><table class="t stick" id="box-home"></table></div>`, { cls: 'wide' }),
        panel(esc(tName(d.away)), `<div class="tscroll"><table class="t stick" id="box-away"></table></div>`, { cls: 'wide' })]),
  ]);
}
function boxTable(d, side) {
  const team = d[side];
  const rows = (d.box[side] || []).map((r) => ({ ...r, pts: r.g + r.a, fo: r.fow + r.fol ? r.fow / (r.fow + r.fol) : null }));
  sortable($(`box-${side}`), [
    { k: 'name', label: 'Spelare', l: true, asc: true, h: (r) => playerCell(r, team, `#${r.num ?? '–'} · ${POS_SHORT[r.pos] || ''}`) },
    { k: 'line', label: 'Kedja', asc: true },
    { k: 'g', label: 'M', title: 'Mål' }, { k: 'a', label: 'A', title: 'Assist' }, { k: 'pts', label: 'P', title: 'Poäng' },
    { k: 'pm', label: '+/-', f: signed }, { k: 'sog', label: 'Skott' }, { k: 'pim', label: 'Utv', title: 'Utvisningsminuter' },
    { k: 'toi', label: 'Istid', f: mmss }, { k: 'hits', label: 'Tackl.' }, { k: 'blk', label: 'Block' },
    { k: 'fo', label: 'Tekn%', f: (v) => dec(v * 100, 0) },
  ], rows, { key: 'toi' });
}
function matchEvents(d) {
  const pens = d.pens.length ? `<div class="timeline">${d.pens.map((x) => {
    const team = d[x.team];
    return `<div class="ev"><span class="t">P${x.p} ${esc(x.t)}</span>${tb(team)}<div class="who">${x.player ? pLink(x.player.id, x.player.name) : 'Lagstraff'}<small>${esc(OFFENCE[x.off] || x.off)}</small></div><span class="muted">${esc(x.desc.replace('Team Penalty', 'Lagstraff'))}</span></div>`;
  }).join('')}</div>` : '<p class="empty-state">Inga utvisningar.</p>';
  return board([
    panel('Skottkarta', `<div class="chart">${rinkMap(d)}</div>`, { sub: `${esc(tName(d.home))} anfaller åt höger, ${esc(tName(d.away))} åt vänster. Ungefärliga positioner.`, cls: 'wide' }),
    panel('Utvisningar', pens),
    panel('Skott per period', d.periods.length ? `<div class="tscroll"><table class="t"><thead><tr><th class="l">Lag</th>${d.periods.map((p) => `<th>${p.p <= 3 ? p.p : 'ÖT'}</th>`).join('')}<th>Totalt</th></tr></thead><tbody>
      ${['home', 'away'].map((s) => `<tr><td class="l">${teamLink(d[s], { name: true })}</td>${d.periods.map((p) => `<td>${s === 'home' ? p.hs : p.as}</td>`).join('')}<td class="hl">${d.team[s].SOG ?? '–'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-state">Ingen periodstatistik.</p>'),
  ]);
}
function rinkMap(d) {
  // 60 × 30 m rink in 0.1 m units; x in the data is distance from the attacked goal line
  const W = 600, H = 300, GL = 40;
  const [hc, ac] = pairColors(d.home, d.away), col = (s) => s === 'home' ? hc : ac;
  const pt = (s, e) => s === 'home' ? [W - GL - e.x, H / 2 - e.y] : [GL + e.x, H / 2 + e.y];
  let svg = `<svg viewBox="-4 -4 ${W + 8} ${H + 26}" role="img" aria-label="Skottkarta">
    <rect x="0" y="0" width="${W}" height="${H}" rx="84" style="fill:var(--panel-2);stroke:var(--line)" stroke-width="2"/>
    <line x1="${W / 2}" x2="${W / 2}" y1="0" y2="${H}" style="stroke:color-mix(in srgb, var(--bad) 55%, transparent)" stroke-width="4"/>
    <line x1="${W / 2 - 71}" x2="${W / 2 - 71}" y1="0" y2="${H}" style="stroke:color-mix(in srgb, var(--accent) 60%, transparent)" stroke-width="4"/>
    <line x1="${W / 2 + 71}" x2="${W / 2 + 71}" y1="0" y2="${H}" style="stroke:color-mix(in srgb, var(--accent) 60%, transparent)" stroke-width="4"/>
    <circle cx="${W / 2}" cy="${H / 2}" r="45" style="fill:none;stroke:var(--line)" stroke-width="2"/>
    <line x1="${GL}" x2="${GL}" y1="12" y2="${H - 12}" style="stroke:color-mix(in srgb, var(--bad) 45%, transparent)" stroke-width="2"/>
    <line x1="${W - GL}" x2="${W - GL}" y1="12" y2="${H - 12}" style="stroke:color-mix(in srgb, var(--bad) 45%, transparent)" stroke-width="2"/>
    ${[[GL + 60, 80], [GL + 60, 220], [W - GL - 60, 80], [W - GL - 60, 220]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="45" style="fill:none;stroke:var(--line)" stroke-width="2"/>`).join('')}
    <path d="M${GL} 132 a18 18 0 0 1 0 36" style="fill:color-mix(in srgb, var(--accent) 25%, transparent)"/>
    <path d="M${W - GL} 132 a18 18 0 0 0 0 36" style="fill:color-mix(in srgb, var(--accent) 25%, transparent)"/>`;
  for (const s of d.shots) { const [x, y] = pt(s.team, s); svg += `<circle cx="${x}" cy="${y}" r="5" style="fill:${col(s.team)};opacity:.6;stroke:var(--panel)" stroke-width="1"/>`; }
  for (const g of d.goals) {
    if (g.x == null) continue;
    const [x, y] = pt(g.team, g);
    svg += `<g transform="translate(${x} ${y})"><circle r="9" style="fill:${col(g.team)};stroke:var(--text)" stroke-width="2"/><title>Mål: ${esc(g.scorer?.name || '')} (${esc(g.t)})</title></g>`;
  }
  svg += `<text x="10" y="${H + 18}" font-size="12" style="fill:var(--muted)">◀ ${esc(d.away)} anfaller</text><text x="${W - 10}" y="${H + 18}" text-anchor="end" font-size="12" style="fill:var(--muted)">${esc(d.home)} anfaller ▶</text>`;
  return svg + `</svg><div class="legend" style="margin-top:8px"><span><i style="background:${hc};border-radius:50%"></i>${esc(tName(d.home))}</span><span><i style="background:${ac};border-radius:50%"></i>${esc(tName(d.away))}</span><span>Stor ring = mål</span></div>`;
}

function matchPreview(g) {
  const ph = g.ph ?? 0.5;
  const lh = MODEL.L * MODEL.rating[g.home].att * MODEL.rating[g.away].def * MODEL.HOME;
  const la = MODEL.L * MODEL.rating[g.away].att * MODEL.rating[g.home].def * MODEL.AWAY;
  const pmf = (l) => { const o = []; let p = Math.exp(-l); for (let k = 0; k < 10; k++) { o.push(p); p *= l / (k + 1); } return o; };
  const a = pmf(lh), b = pmf(la), scores = [];
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) scores.push({ s: `${i}–${j}`, p: a[i] * b[j] });
  scores.sort((x, y) => y.p - x.p);
  const tie = sum(a.map((x, i) => x * b[i]));
  const row = (c) => TABLE.find((t) => t.code === c) || { gp: 0, pts: 0, gf: 0, ga: 0 };
  const T = (c) => D.teamStats[c] || {};
  const per = (x, gp) => gp ? x / gp : null;
  const cmpRow = (label, h, av, fmt = (v) => dec(v, 2), lowerBetter = false) => {
    const hv = h ?? 0, avv = av ?? 0, tot = hv + avv, hp = tot ? (lowerBetter ? avv : hv) / tot * 100 : 50;
    return `<div class="cmp-row"><span class="v">${h == null ? '–' : fmt(h)}</span><div class="mid"><span class="lbl">${label}</span><div class="cmp-bar"><i style="width:${hp}%"></i><i style="width:${100 - hp}%"></i></div></div><span class="v">${av == null ? '–' : fmt(av)}</span></div>`;
  };
  const H = row(g.home), A = row(g.away), TH = T(g.home), TA = T(g.away);
  const cmp = `<div class="cmp" style="--h-color:${pairColors(g.home, g.away)[0]};--a-color:${pairColors(g.home, g.away)[1]}">
    <div class="cmp-row cmp-head"><span class="v">${tb(g.home, 'md')}</span><span></span><span class="v">${tb(g.away, 'md')}</span></div>
    ${cmpRow('Poäng per match', per(H.pts, H.gp), per(A.pts, A.gp))}
    ${cmpRow('Gjorda mål per match', per(H.gf, H.gp), per(A.gf, A.gp))}
    ${cmpRow('Insläppta mål per match', per(H.ga, H.gp), per(A.ga, A.gp), undefined, true)}
    ${cmpRow('Skott per match', per(TH.sog, TH.gp), per(TA.sog, TA.gp), (v) => dec(v, 1))}
    ${cmpRow('Powerplay', TH.ppo ? TH.ppg / TH.ppo : null, TA.ppo ? TA.ppg / TA.ppo : null, (v) => pctTxt(v))}
    ${cmpRow('Boxplay', TH.pko ? 1 - TH.ppga / TH.pko : null, TA.pko ? 1 - TA.ppga / TA.pko : null, (v) => pctTxt(v))}
    ${cmpRow('Projicerade poäng', SIM[g.home].proj, SIM[g.away].proj, (v) => dec(v, 0))}
    ${cmpRow('Slutspelschans', SIM[g.home].top10, SIM[g.away].top10, (v) => oddsTxt(v))}
  </div>`;
  const topScorers = (c) => skaters().filter((p) => p.team === c).sort((x, y) => y.pts - x.pts || y.g - x.g).slice(0, 4);
  const hot = (c) => `<div style="display:grid;gap:8px"><div class="row" style="display:flex;justify-content:space-between;align-items:center;gap:8px">${teamLink(c, { name: true })}${formChips(c)}</div>
    <ol class="lb">${topScorers(c).map((p, i) => `<li><span class="r">${i + 1}.</span>${tb(c)}${avatar(p.id, p.name, c)}<span class="n">${pLink(p.id, p.name)}</span><span class="v">${p.g}+${p.a}</span></li>`).join('') || '<li class="faint">Ingen statistik ännu.</li>'}</ol></div>`;
  return board([
    panel('Vinstchans', `<div style="display:grid;gap:12px">${oddsBar(ph)}
      <div class="tiles">
        <div class="tile"><span class="k">${esc(g.home)} vinner</span><span class="v">${pctTxt(ph)}</span></div>
        <div class="tile"><span class="k">Övertid</span><span class="v">${pctTxt(tie)}</span><span class="s">lika efter 60 min</span></div>
        <div class="tile"><span class="k">${esc(g.away)} vinner</span><span class="v">${pctTxt(1 - ph)}</span></div>
        <div class="tile"><span class="k">Förväntade mål</span><span class="v">${dec(lh, 1)}–${dec(la, 1)}</span></div>
      </div></div>`),
    panel('Troligaste resultat', `<div class="chart">${hBars(scores.slice(0, 6).map((s) => ({ label: s.s, v: s.p })), { labelW: 56, fmt: (v) => pctTxt(v, 1), W: 440, rowH: 26 })}</div>`, { sub: 'Efter ordinarie tid (60 minuter).' }),
    panel('Säsongsjämförelse', cmp),
    panel('Form och poängbästa', `<div style="display:grid;gap:18px">${hot(g.home)}${hot(g.away)}</div>`),
  ]);
}
function matchH2H(g) {
  const meet = [
    ...GAMES.filter((x) => isFinal(x) && [x.home, x.away].includes(g.home) && [x.home, x.away].includes(g.away)).map((x) => ({ s: CUR, d: x.start.slice(0, 10), home: x.home, away: x.away, hs: x.hs, as: x.as, ex: x.ot || x.so, id: x.id })),
    ...D.pastGames.filter((x) => [x[2], x[3]].includes(g.home) && [x[2], x[3]].includes(g.away)).map((x) => ({ s: x[0], d: x[1], home: x[2], away: x[3], hs: x[4], as: x[5], ex: x[6] })),
  ].sort((x, y) => y.d.localeCompare(x.d));
  if (!meet.length) return panel('Inbördes möten', '<p class="empty-state">Lagen har inte mötts i SHL de senaste säsongerna.</p>');
  const winsOf = (c) => meet.filter((m) => (m.home === c ? m.hs > m.as : m.as > m.hs)).length;
  const goalsOf = (c) => sum(meet.map((m) => m.home === c ? m.hs : m.as));
  return board([
    panel('Sammanställning', `<div class="tiles">
      <div class="tile"><span class="k">${esc(g.home)} vinster</span><span class="v">${winsOf(g.home)}</span><span class="s">${goalsOf(g.home)} gjorda mål</span></div>
      <div class="tile"><span class="k">${esc(g.away)} vinster</span><span class="v">${winsOf(g.away)}</span><span class="s">${goalsOf(g.away)} gjorda mål</span></div>
      <div class="tile"><span class="k">Möten</span><span class="v">${meet.length}</span><span class="s">sedan ${meet[meet.length - 1].s}</span></div></div>`),
    panel('Alla möten', `<div class="tscroll"><table class="t"><thead><tr><th class="l">Säsong</th><th class="l">Datum</th><th class="l">Hemma</th><th>Resultat</th><th class="l">Borta</th></tr></thead><tbody>${meet.map((m) =>
      `<tr><td class="l">${m.s}</td><td class="l">${fmtDate(m.d)}</td><td class="l">${teamLink(m.home, { name: true })}</td><td class="hl">${m.id ? `<a href="#/match/${m.id}">${m.hs}–${m.as}</a>` : `${m.hs}–${m.as}`}${m.ex ? ' <span class="faint">ÖT</span>' : ''}</td><td class="l">${teamLink(m.away, { name: true })}</td></tr>`).join('')}</tbody></table></div>`, { cls: 'wide' }),
  ]);
}

function lineupHtml(code) {
  const L = D.lineups[code];
  if (!L) return '<p class="empty-state">Ingen uppställning ännu. Den visas efter lagets första match.</p>';
  const lp = (r) => {
    if (!r) return '<span></span>';
    const inner = `${avatar(r.id, r.name, code)}<span>${esc(r.name)}<small>#${r.num ?? '–'} · ${POS_SHORT[r.pos] || ''}</small></span>`;
    return r.id ? `<a class="lp" href="#/spelare/${encodeURIComponent(r.id)}">${inner}</a>` : `<div class="lp">${inner}</div>`;
  };
  const fl = Object.keys(L.F).sort((a, b) => a - b).map((k) => `<div class="line"><span class="lab">Kedja ${k}</span>${[0, 1, 2].map((i) => lp(L.F[k][i])).join('')}</div>`).join('');
  const dl = Object.keys(L.D).sort((a, b) => a - b).map((k) => `<div class="line d"><span class="lab">Backpar ${k}</span>${[0, 1].map((i) => lp(L.D[k][i])).join('')}</div>`).join('');
  const gl = L.G.length ? `<div class="line d"><span class="lab">Målvakt</span>${lp(L.G[0])}${lp(L.G[1])}</div>` : '';
  return `<div class="lines">${gl}${fl}${dl}</div><p class="note">Baserad på uppställningen i senaste matchen (${fmtDate(L.date)} mot ${esc(tName(L.opp))}, <a href="#/match/${L.gid}">matchfakta</a>). Laget meddelar sin riktiga uppställning först på matchdagen.</p>`;
}

/* ---------- Tabell ---------- */
// Tabell: one page with three tabs, the table, team stats and odds
function pageTable(tab = '') {
  if (tab === 'lagstatistik') tab = ''; // old address for the table tab
  if (!['', 'odds'].includes(tab)) tab = '';
  setTitle('Tabell');
  const head = `<div class="page-head"><div><h1>Tabell</h1><p>SHL ${CUR.replace('-', '/')}. Tryck på ett lag för trupp, schema och odds.</p></div></div>
    <section class="panel tabs-only">${tabs('/tabell', [['', 'Tabell', '', 'table'], ['odds', 'Odds', '', 'trophy']], tab)}</section>`;
  const foot = `<span class="stamp">Uppdaterad ${esc(stampTxt)}</span>`;
  if (tab === '') return teamStatsTab(head);
  const heat =`<div class="tscroll"><table class="t stick" style="min-width:760px"><thead><tr><th class="l">Lag</th>${CODES.map((_, i) => `<th>${i + 1}</th>`).join('')}</tr></thead><tbody>${TABLE.map((r) => {
    const s = SIM[r.code];
    return `<tr class="${r.code === FAV ? 'fav' : ''}"><td class="l">${teamLink(r.code, { name: true })}</td>${s.rank.map((p, i) => {
      const c = i < 6 ? 'var(--accent)' : i < 10 ? 'color-mix(in srgb, var(--accent) 55%, var(--faint))' : i >= 12 ? 'var(--bad)' : 'var(--faint)';
      return `<td style="background:color-mix(in srgb, ${c} ${Math.round(Math.min(1, p * 2.2) * 75)}%, transparent);font-size:12.5px" title="${esc(r.code)} slutar ${i + 1}:a: ${pctTxt(p, 1)}">${p >= 0.005 ? Math.round(p * 100) : ''}</td>`;
    }).join('')}</tr>`;
  }).join('')}</tbody></table></div>`;
  const W = cw(640), rowH = isNarrow() ? 30 : 26, left = isNarrow() ? 84 : 150, right = 20, top = 22;
  const rows = [...TABLE].sort((a, b) => SIM[b.code].proj - SIM[a.code].proj);
  const lo = Math.min(...rows.map((r) => SIM[r.code].lo)), hi = Math.max(...rows.map((r) => SIM[r.code].hi));
  const minX = Math.floor(lo / 10) * 10, maxX = Math.ceil(hi / 10) * 10;
  const x = (v) => left + (v - minX) / (maxX - minX || 1) * (W - left - right);
  let range = `<svg viewBox="0 0 ${W} ${top + rows.length * rowH + 6}" role="img" aria-label="Poängprognos">`;
  for (let t = minX; t <= maxX; t += 10) range += `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 4}" y2="${top + rows.length * rowH}" style="stroke:var(--line)"/><text x="${x(t)}" y="${top - 8}" text-anchor="middle" font-size="11" style="fill:var(--faint)">${t}</text>`;
  rows.forEach((r, i) => {
    const s = SIM[r.code], y = top + i * rowH + rowH / 2;
    range += `<text x="${left - 32}" y="${y + 4}" text-anchor="end" font-size="13.5" style="fill:var(--text);font-weight:${r.code === FAV ? 700 : 400}">${esc(isNarrow() ? r.code : tName(r.code))}</text>
      ${LOGOS[r.code] ? `<image href="${esc(LOGOS[r.code])}" x="${left - 26}" y="${y - 10}" width="20" height="20"/>` : ''}
      <line x1="${x(s.lo)}" x2="${x(s.hi)}" y1="${y}" y2="${y}" style="stroke:color-mix(in srgb, ${tColor(r.code)} 70%, var(--accent))" stroke-width="8" stroke-linecap="round" opacity=".55"/>
      <circle cx="${x(s.proj)}" cy="${y}" r="6" style="fill:var(--text)"><title>${esc(tName(r.code))}: ${dec(s.proj, 0)} poäng (${s.lo}–${s.hi})</title></circle>
      <circle cx="${x(r.pts)}" cy="${y}" r="3" style="fill:var(--accent)"/>`;
  });
  range += '</svg>';
  const explain = `<details class="explain"><summary>Hur räknas oddsen?</summary><div class="method">
    <div><h3>Lagstyrka</h3><p>Varje lag får ett anfalls- och ett försvarsvärde från gjorda och insläppta mål per match. Förra säsongen räknas som 15 matchers underlag, dragen mot ligasnittet, och årets matcher läggs ovanpå.</p></div>
    <div><h3>Simulering</h3><p>Resten av grundserien spelas 10 000 gånger med slumpade mål, hemmafördel och övertid. Poäng enligt SHL: 3 för vinst, 2 för vinst efter övertid eller straffar och 1 för förlust efter övertid eller straffar.</p></div>
    <div><h3>Slutspel</h3><p>Plats 1–6 går direkt till kvartsfinal, 7–10 spelar play in i bäst av tre och 13–14 spelar SHL-kval. Slutspelet simuleras också, med omseedning efter varje runda och bäst av sju från kvartsfinal.</p></div>
  </div></details>`;
  render(`${head}
    ${board([
      panel('Odds', standingsTable({ mode: 'proj' }) + legendHtml + explain, { cls: 'wide', sub: '10 000 simuleringar av resten av grundserien och slutspelet.', foot }),
      panel('Poängprognos', `<div class="chart">${range}</div>`, { sub: 'Stapeln visar 80 % av utfallen, den stora pricken är snittet och den lilla pricken är dagens poäng.' }),
      panel('Slutplacering', heat, { sub: 'Chans i procent att sluta på varje placering efter 52 omgångar.' }),
    ])}`);
}

/* ---------- Statistik ---------- */
let statsState = { kind: 'skaters', season: null, team: 'ALL', pos: 'ALL', rk: false, minGp: 0, q: '' };
// A leader section: tabs for each stat, the leader with a full headshot, and the top 10 beside them
const LEADER_SECTIONS = () => {
  const sk = skaters(), gmin = goalieMinGp(CUR);
  const skStats = [
    { k: 'pts', label: 'Poäng', v: (p) => p.pts, tie: (p) => p.g },
    { k: 'g', label: 'Mål', v: (p) => p.g, tie: (p) => p.pts },
    { k: 'a', label: 'Assist', v: (p) => p.a, tie: (p) => p.pts },
    { k: 'pm', label: '+/-', v: (p) => p.pm, tie: (p) => p.pts, f: signed },
  ];
  return [
    { id: 'sk', title: 'Spelare', rows: sk, stats: skStats, all: { kind: 'skaters', pos: 'ALL' } },
    { id: 'gk', title: 'Målvakter', note: `Minst ${gmin} ${gmin === 1 ? 'match' : 'matcher'}`, rows: goalies().filter((g) => g.gpi >= gmin), all: { kind: 'goalies', pos: 'ALL' },
      stats: [
        { k: 'svp', label: 'Rädd%', v: (g) => g.svp, f: (x) => dec(x, 2) },
        { k: 'gaa', label: 'GAA', v: (g) => g.gaa, asc: true, f: (x) => dec(x, 2) },
        { k: 'so', label: 'Nollor', v: (g) => g.so, tie: (g) => g.svp },
        { k: 'gsaa', label: 'GSAA', v: (g) => gsaa(g, CUR), f: (x) => (x > 0 ? '+' : '') + dec(x) },
      ] },
    { id: 'df', title: 'Backar', rows: sk.filter((p) => posGroup(p.pos) === 'D'), stats: skStats.slice(0, 3), all: { kind: 'skaters', pos: 'D' } },
    { id: 'rk', title: 'Rookies', note: 'Första SHL-säsongen', rows: sk.filter((p) => p.rk), stats: skStats.slice(0, 3), all: { kind: 'skaters', pos: 'ALL', rk: true } },
  ];
};
// The big card on the left of a leader section, for any player in its top 10
function featHtml(p, label, value) {
  const [first, ...rest] = String(p.name).split(' ');
  return `<div class="lfeat" style="--tc:${tColor(p.team)}">
      ${portrait(p.id, p.name, p.team, 'feat')}
      <div class="lfeat-info">
        <a class="lfeat-name" href="#/spelare/${encodeURIComponent(p.id)}">${esc(first)}<br>${esc(rest.join(' '))}</a>
        <div class="lfeat-meta">${tb(p.team)}<span>${esc(p.team)} · #${esc(p.num ?? '–')} · ${POS_SHORT[p.pos] || 'F'}</span></div>
        <div class="lfeat-lbl">${label}</div>
        <div class="lfeat-val num">${value}</div>
      </div>
    </div>`;
}
const LEADER_STATE = {}; // per section: the current top 10, so hovering can swap the big card
function leaderBody(sec, stat) {
  const fmt = stat.f || ((x) => x);
  const sorted = [...sec.rows].sort((a, b) => (stat.asc ? stat.v(a) - stat.v(b) : stat.v(b) - stat.v(a)) || ((stat.tie ? stat.tie(b) - stat.tie(a) : 0)));
  const top = sorted.slice(0, 10);
  if (!top.length) return '<p class="empty-state">Ingen statistik ännu.</p>';
  // Players with the same value share a rank, shown as T7.
  const shown = top.map((p) => fmt(stat.v(p)));
  const rankOf = (i) => shown.indexOf(shown[i]) + 1;
  const tied = (i) => shown.filter((x) => x === shown[i]).length > 1;
  LEADER_STATE[sec.id] = { top, shown, label: stat.label, on: 0 };
  // Load the other headshots in advance so switching player is instant
  for (const p of top.slice(1)) if (HS[p.id]) new Image().src = HS[p.id][1];
  return `<div class="lsec-grid">
    <div class="lfeat-slot">${featHtml(top[0], stat.label, shown[0])}</div>
    <ol class="ltop10">${top.map((p, i) => `<li class="${i === 0 ? 'on' : ''}" data-i="${i}"><span class="r num">${tied(i) ? 'T' : ''}${rankOf(i)}.</span>${tb(p.team)}${pLink(p.id, p.name)}<b class="num">${shown[i]}</b></li>`).join('')}</ol>
  </div>`;
}
// Hovering (or tapping) a row in the top 10 moves the highlight there and shows that player in the big card
function bindLeaderHover(body, secId) {
  const select = (li) => {
    const st = LEADER_STATE[secId], i = +li.dataset.i;
    if (!st || st.on === i) return;
    st.on = i;
    body.querySelectorAll('.ltop10 li').forEach((x) => x.classList.toggle('on', x === li));
    const slot = body.querySelector('.lfeat-slot');
    slot.innerHTML = featHtml(st.top[i], st.label, st.shown[i]);
    countUpEl(slot.querySelector('.lfeat-val'), 450);
  };
  body.addEventListener('mouseover', (e) => { const li = e.target.closest('.ltop10 li'); if (li) select(li); });
  body.addEventListener('focusin', (e) => { const li = e.target.closest('.ltop10 li'); if (li) select(li); });
  // Touch: tapping the row (not the name link) selects it
  body.addEventListener('click', (e) => { const li = e.target.closest('.ltop10 li'); if (li && !e.target.closest('a')) select(li); });
}
function pageStats() {
  setTitle('Statistik');
  statsState.season ??= CUR;
  const sections = LEADER_SECTIONS();
  render(`
    <div class="page-head"><div><h1>Statistik</h1><p>Topplistor och fullständig statistik för alla SHL-spelare. Tryck på en spelare för hela profilen.</p></div></div>
    <div class="search m-only stat-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="stat-search" type="search" placeholder="Sök spelare eller lag" autocomplete="off" aria-label="Sök spelare eller lag" enterkeyhint="search"><div class="results" id="stat-results" hidden></div></div>
    <div class="lsec-row">${sections.map((s) => `<section class="panel lsec">
      <div class="p-head"><h2>${s.title}</h2>${s.note ? `<span class="stamp">${esc(s.note)}</span>` : ''}</div>
      <div class="utabs" id="lt-${s.id}" role="tablist">${s.stats.map((st, i) => `<button role="tab" data-k="${st.k}" aria-selected="${i === 0}">${st.label}</button>`).join('')}</div>
      <div class="p-body" id="lb-${s.id}">${leaderBody(s, s.stats[0])}</div>
      <div class="p-foot"><button class="more" data-all="${s.id}">Alla ${s.title.toLowerCase()} ›</button></div>
    </section>`).join('')}</div>
    <section class="panel" id="alla"><div class="p-head"><h2>Alla spelare</h2></div><div class="p-body">
      <div class="controls">
        <div class="seg" id="sk">${[['skaters', 'Spelare'], ['goalies', 'Målvakter']].map(([v, l]) => `<button data-v="${v}" aria-pressed="${statsState.kind === v}">${l}</button>`).join('')}</div>
        <label class="field">Säsong <select id="ss">${[CUR, PREV].map((s) => `<option ${s === statsState.season ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="field">Lag <select id="st"></select></label>
        <label class="field" id="sp-wrap">Position <select id="sp"><option value="ALL">Alla</option><option value="F">Forwards</option><option value="D">Backar</option></select></label>
        <label class="field">Visa <select id="sr"><option value="">Alla spelare</option><option value="1" ${statsState.rk ? 'selected' : ''}>Endast rookies</option></select></label>
        <label class="field">Minst matcher <input id="sm" type="number" min="0" value="${statsState.minGp}"></label>
        <label class="field">Sök <input id="sq" type="search" placeholder="Namn" value="${esc(statsState.q)}"></label>
      </div>
      <div class="tscroll"><table class="t stick" id="stable"></table></div>
    </div></section>
    ${board([panel('Målvakter: räddade mål över snittet', `<div class="seg" id="gs">${[PREV, CUR].map((s) => `<button data-v="${s}" aria-pressed="${s === CUR}">${s}</button>`).join('')}</div><div class="chart" id="gchart">${gsaaChart(CUR)}</div>`,
      { sub: 'Räddningar minus de skott en genomsnittlig SHL-målvakt skulle ha räddat. Tar inte hänsyn till skottens kvalitet.', cls: 'gsaa-card' })])}`);
  const teamOpts = () => {
    const ts = [...new Set(D.seasons[statsState.season][statsState.kind].map((p) => p.team))].sort((a, b) => tName(a).localeCompare(tName(b), 'sv'));
    if (!ts.includes(statsState.team)) statsState.team = 'ALL';
    $('st').innerHTML = ['ALL', ...ts].map((t) => `<option value="${t}" ${t === statsState.team ? 'selected' : ''}>${t === 'ALL' ? 'Alla lag' : esc(tName(t))}</option>`).join('');
  };
  const draw = () => {
    const S = statsState, isSk = S.kind === 'skaters', q = normName(S.q);
    $('sp-wrap').hidden = !isSk;
    const rows = D.seasons[S.season][S.kind].filter((p) => (isSk ? p.gp : p.gpi) >= S.minGp && (S.team === 'ALL' || p.team === S.team)
      && (!isSk || S.pos === 'ALL' || (posGroup(p.pos) === 'D') === (S.pos === 'D')) && (!S.rk || p.rk) && (!q || normName(p.name).includes(q)))
      .map((p) => isSk ? { ...p, ppgp: p.gp ? p.pts / p.gp : 0, shp: p.sog ? p.g / p.sog : null } : { ...p, gsaa: gsaa(p, S.season) });
    const nameCol = { k: 'name', label: 'Spelare', l: true, asc: true, h: (r, i) => `<div class="pcell"><span class="faint num" style="width:22px;text-align:right">${i + 1}</span>${tb(r.team)}${avatar(r.id, r.name, r.team)}<div>${pLink(r.id, r.name)}<br><small>${POS[r.pos] || 'Forward'}</small></div></div>` };
    if (isSk) sortable($('stable'), [nameCol,
      { k: 'gp', label: 'SM', title: 'Spelade matcher' }, { k: 'g', label: 'M', title: 'Mål' }, { k: 'a', label: 'A', title: 'Assist' }, { k: 'pts', label: 'P', title: 'Poäng' },
      { k: 'ppgp', label: 'P/M', title: 'Poäng per match', f: (v) => dec(v, 2) }, { k: 'pm', label: '+/-', f: signed }, { k: 'pim', label: 'Utv', title: 'Utvisningsminuter' },
      { k: 'ppg', label: 'PPM', title: 'Powerplaymål' }, { k: 'gwg', label: 'GWG', title: 'Matchvinnande mål' }, { k: 'sog', label: 'Skott' },
      { k: 'shp', label: 'Sk%', title: 'Skotteffektivitet', f: (v) => dec(v * 100, 1) }, { k: 'toi', label: 'Istid', title: 'Istid per match', f: mmss },
      { k: 'hits', label: 'Tackl.' }, { k: 'blk', label: 'Block' },
    ], rows, { key: S.sortKey || 'pts', limit: 25 });
    else sortable($('stable'), [nameCol,
      { k: 'gpi', label: 'SM', title: 'Spelade matcher' }, { k: 'w_', label: 'V', title: 'Vinster' }, { k: 'l', label: 'F', title: 'Förluster' },
      { k: 'sv', label: 'Räddn.' }, { k: 'ga', label: 'Insl.', asc: true }, { k: 'svp', label: 'Rädd%', f: (v) => dec(v, 2) },
      { k: 'gaa', label: 'GAA', title: 'Insläppta mål per 60 minuter', asc: true, f: (v) => dec(v, 2) }, { k: 'so', label: 'Nollor' },
      { k: 'gsaa', label: 'GSAA', title: 'Räddade mål över snittet', f: (v) => (v > 0 ? '+' : '') + dec(v) }, { k: 'mins', label: 'Minuter', f: (v) => Math.round(v) },
    ], rows, { key: S.sortKey || 'svp', limit: 25, desc: !['gaa', 'ga'].includes(S.sortKey) });
    S.sortKey = null; // only the first draw after "Alla" uses the chosen stat
  };
  const bindSeg = (id, key, after) => $(id).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; statsState[key] = b.dataset.v; [...$(id).children].forEach((c) => c.setAttribute('aria-pressed', c === b)); after?.(); draw(); };
  bindSeg('sk', 'kind', teamOpts);
  $('ss').onchange = (e) => { statsState.season = e.target.value; teamOpts(); draw(); };
  $('st').onchange = (e) => { statsState.team = e.target.value; draw(); };
  $('sp').value = statsState.pos; $('sp').onchange = (e) => { statsState.pos = e.target.value; draw(); };
  $('sm').oninput = (e) => { statsState.minGp = +e.target.value || 0; draw(); };
  $('sq').oninput = (e) => { statsState.q = e.target.value; draw(); };
  $('sr').onchange = (e) => { statsState.rk = !!e.target.value; draw(); };
  $('gs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; [...$('gs').children].forEach((c) => c.setAttribute('aria-pressed', c === b)); $('gchart').innerHTML = gsaaChart(b.dataset.v); };
  teamOpts(); draw();
  bindSearch($('stat-search'), $('stat-results'), (it) => { location.hash = it.type === 't' ? `#/lag/${it.id}` : `#/spelare/${it.id}`; });

  // Leader sections: switch stat, or jump to the full table sorted by that stat
  const active = {};
  for (const s of sections) {
    active[s.id] = s.stats[0];
    bindLeaderHover($(`lb-${s.id}`), s.id);
    $(`lt-${s.id}`).onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      [...$(`lt-${s.id}`).children].forEach((c) => c.setAttribute('aria-selected', c === b));
      active[s.id] = s.stats.find((st) => st.k === b.dataset.k);
      $(`lb-${s.id}`).innerHTML = leaderBody(s, active[s.id]);
      countUpEl($(`lb-${s.id}`).querySelector('.lfeat-val'));
    };
  }
  app.querySelectorAll('[data-all]').forEach((b) => b.onclick = () => {
    const s = sections.find((x) => x.id === b.dataset.all);
    Object.assign(statsState, { rk: false }, s.all, { season: CUR, team: 'ALL', q: '', sortKey: active[s.id].k });
    [...$('sk').children].forEach((c) => c.setAttribute('aria-pressed', c.dataset.v === statsState.kind));
    $('ss').value = CUR; $('sp').value = statsState.pos; $('sr').value = statsState.rk ? '1' : ''; $('sq').value = '';
    teamOpts(); draw();
    $('alla').scrollIntoView({ behavior: 'smooth' });
  });
}

/* ---------- Nexus: shot quality and expected goals (desktop menu) ---------- */
let EDGE = null;
const loadEdge = async () => EDGE ??= await (await fetch(dataUrl('edge.json'))).json();

// Half rink seen from above with the net at the top, drawn to scale (1 unit = 1 dm; x = distance out from
// the goal line, y = sideways). Saves are small dots, goals glow and can be clicked. mode 'heat' shows
// where the shots come from as a soft density map instead of dots.
const RINK = { S: 1.9, pad: 12, xMin: -40, xMax: 230 };
function shotRink(shots, { color = 'var(--accent)', mode = 'dots', sel = -1, title = 'Skottkarta' } = {}) {
  const { S, pad, xMin, xMax } = RINK;
  const W = pad * 2 + 300 * S, H = pad * 2 + (xMax - xMin) * S, cx = W / 2;
  const X = (y) => cx - y * S, Y = (x) => pad + (x - xMin) * S;
  const L = X(150), R = X(-150), top = Y(xMin), bot = Y(xMax), cr = 85 * S;
  const boards = `M${L} ${bot} L${L} ${top + cr} A${cr} ${cr} 0 0 1 ${L + cr} ${top} L${R - cr} ${top} A${cr} ${cr} 0 0 1 ${R} ${top + cr} L${R} ${bot}`;
  const inside = shots.filter((s) => s.x >= xMin && s.x <= xMax);
  let svg = `<svg class="rink" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
    <defs><clipPath id="rink-clip"><path d="${boards} Z"/></clipPath>
      <filter id="heat-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${7 * S}"/></filter>
      <radialGradient id="goal-glow"><stop offset="0" style="stop-color:${color};stop-opacity:.55"/><stop offset="1" style="stop-color:${color};stop-opacity:0"/></radialGradient></defs>
    <path d="${boards} Z" class="rk-ice"/>
    <g clip-path="url(#rink-clip)">
      <path d="M${X(9)} ${Y(0)} L${X(70)} ${Y(60)} L${X(70)} ${Y(105)} L${X(-70)} ${Y(105)} L${X(-70)} ${Y(60)} L${X(-9)} ${Y(0)} Z" class="rk-slot"/>
      <line x1="${L}" x2="${R}" y1="${Y(0)}" y2="${Y(0)}" class="rk-red"/>
      <rect x="${L}" y="${Y(172)}" width="${R - L}" height="${3 * S}" class="rk-blue"/>
      ${[70, -70].map((y) => `<circle cx="${X(y)}" cy="${Y(60)}" r="${45 * S}" class="rk-circle"/><circle cx="${X(y)}" cy="${Y(60)}" r="${3 * S}" class="rk-dot"/>
        <path d="M${X(y) - 45 * S} ${Y(60) - 4 * S} h${-6 * S} M${X(y) - 45 * S} ${Y(60) + 4 * S} h${-6 * S} M${X(y) + 45 * S} ${Y(60) - 4 * S} h${6 * S} M${X(y) + 45 * S} ${Y(60) + 4 * S} h${6 * S}" class="rk-hash"/>`).join('')}
      ${[70, -70].map((y) => `<circle cx="${X(y)}" cy="${Y(200)}" r="${3 * S}" class="rk-dot"/>`).join('')}
    </g>
    <path d="M${X(18)} ${Y(0)} A${18 * S} ${18 * S} 0 0 0 ${X(-18)} ${Y(0)} Z" class="rk-crease"/>
    <rect x="${X(9.15)}" y="${Y(-11)}" width="${18.3 * S}" height="${11 * S}" rx="${3 * S}" class="rk-net"/>
    <path d="${boards}" class="rk-boards"/>
    <text x="${R - 8}" y="${Y(172) - 8}" text-anchor="end" class="rk-lbl">Blå linje</text>`;
  if (mode === 'heat') {
    // Density: shots counted in 12 dm cells, drawn as blurred blobs
    const cell = 12, grid = new Map();
    for (const s of inside) { const k = `${Math.round(s.x / cell)}|${Math.round(s.y / cell)}`; grid.set(k, (grid.get(k) || 0) + 1 + s.xg * 4); }
    const mx = Math.max(1, ...grid.values());
    svg += `<g filter="url(#heat-blur)" clip-path="url(#rink-clip)" class="rk-heat">${[...grid].map(([k, v]) => {
      const [gx, gy] = k.split('|').map(Number);
      return `<circle cx="${X(gy * cell)}" cy="${Y(gx * cell)}" r="${cell * S * 1.15}" style="fill:${color};fill-opacity:${Math.min(0.95, 0.12 + (v / mx) * 0.85)}"/>`;
    }).join('')}</g>`;
  }
  // Saves first, goals on top; each marker fades in with a small stagger
  inside.forEach((s, i) => {
    if (s.g) return;
    if (mode === 'heat') return;
    svg += `<circle cx="${X(s.y)}" cy="${Y(s.x)}" r="${2.6 + s.xg * 14}" class="sm-dot" style="--d:${Math.min(i, 400) * 2}ms"><title>Räddat · xG ${dec(s.xg, 2)} · ${dec(Math.hypot(s.x, s.y) / 10, 1)} m</title></circle>`;
  });
  inside.forEach((s, i) => {
    if (!s.g) return;
    const r = 5 + s.xg * 16, x = X(s.y), y = Y(s.x);
    svg += `<g class="sm-goal ${s.k === sel ? 'sel' : ''}" data-k="${s.k}" tabindex="0" role="button" aria-label="Mål, xG ${dec(s.xg, 2)}" style="--d:${300 + Math.min(i, 400) * 2}ms;--c:${color}">
      <circle cx="${x}" cy="${y}" r="${r * 2.6}" fill="url(#goal-glow)" class="sm-glow"/>
      <circle cx="${x}" cy="${y}" r="${r}" class="sm-pulse"/>
      <circle cx="${x}" cy="${y}" r="${r}" class="sm-core"/>
      <title>Mål · xG ${dec(s.xg, 2)} · ${dec(Math.hypot(s.x, s.y) / 10, 1)} m${s.clip >= 0 ? ' · tryck för video' : ''}</title></g>`;
  });
  const far = shots.length - inside.length;
  return svg + `${far ? `<text x="${cx}" y="${bot - 8}" text-anchor="middle" class="rk-lbl">${far} ${far === 1 ? 'skott' : 'skott'} från längre bort än blå linjen visas inte</text>` : ''}</svg>`;
}

// Scoring rate by area of the attacking zone, league-wide
function goalRateMap(shots) {
  const W = 560, H = 330, GX = 36, Y0 = H / 2, cell = 30;
  const px = (x) => GX + x * 1.8, py = (y) => Y0 - y * 1.05;
  const grid = new Map();
  for (const s of shots) {
    if (s.en || s.x < 0 || s.x >= 240 || Math.abs(s.y) >= 150) continue;
    const k = `${Math.floor(s.x / cell)}|${Math.floor((s.y + 150) / cell)}`;
    const c = grid.get(k) || [0, 0]; c[0]++; c[1] += s.g; grid.set(k, c);
  }
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Målprocent per område">
    <rect x="4" y="6" width="${W - 8}" height="${H - 12}" rx="70" style="fill:var(--panel-2);stroke:var(--line)" stroke-width="2"/>
    <rect x="${W / 2}" y="4" width="${W / 2}" height="${H - 8}" style="fill:var(--panel-2)"/>`;
  for (const [k, [n, g]] of grid) {
    if (n < 8) continue; // too few shots to say anything
    const [cx, cy] = k.split('|').map(Number);
    const rate = g / n, x = px(cx * cell), y = py(cy * cell - 150 + cell), w = cell * 1.8, h = cell * 1.05;
    svg += `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="4" style="fill:var(--accent);fill-opacity:${Math.min(0.95, 0.08 + rate * 3.2)}"><title>${Math.round(rate * 100)} % av ${n} skott</title></rect>`;
    if (n >= 15) svg += `<text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="12" font-weight="600" style="fill:var(--text)">${Math.round(rate * 100)}%</text>`;
  }
  svg += `<line x1="${px(0)}" x2="${px(0)}" y1="22" y2="${H - 22}" style="stroke:color-mix(in srgb, var(--bad) 55%, transparent)" stroke-width="2"/>
    <rect x="${px(0) - 12}" y="${py(9)}" width="12" height="${18 * 1.05}" rx="2" style="fill:none;stroke:var(--muted)" stroke-width="2"/>
    <line x1="${px(172)}" x2="${px(172)}" y1="6" y2="${H - 6}" style="stroke:color-mix(in srgb, var(--accent) 55%, transparent)" stroke-width="5"/>`;
  return svg + '</svg>';
}

async function pageEdge() {
  setTitle('Nexus');
  if (!EDGE) app.innerHTML = skeleton();
  const E = await loadEdge();
  const skBy = new Map(skaters().map((p) => [p.id, p])), gkBy = new Map(goalies().map((p) => [p.id, p]));
  const lg = E.league, lgSv = lg.sa ? 1 - lg.ga / lg.sa : 0;
  const skRows = Object.entries(E.skaters).filter(([id]) => skBy.has(id)).map(([id, a]) => ({ ...skBy.get(id), e: { sog: a[0], g: a[1], xg: a[2], hd: a[3], hdg: a[4], dist: a[5], long: a[6] } }));
  const gkAll = Object.entries(E.goalies).filter(([id]) => gkBy.has(id)).map(([id, a]) => ({ ...gkBy.get(id), e: { sa: a[0], ga: a[1], xga: a[2], hd: [a[3], a[4]], md: [a[5], a[6]], ld: [a[7], a[8]] } }));
  const maxSa = Math.max(1, ...gkAll.map((g) => g.e.sa)), maxHd = Math.max(1, ...gkAll.map((g) => g.e.hd[0]));
  const gkRows = gkAll.filter((g) => g.e.sa >= maxSa * 0.3);
  const hdQual = gkAll.filter((g) => g.e.hd[0] >= Math.max(5, maxHd * 0.3));
  const pp = (x) => (x > 0 ? '+' : '') + dec(x, 1);
  const sections = [
    { id: 'ex', title: 'Spelare', note: 'Skott på mål', rows: skRows, stats: [
      { k: 'xg', label: 'xG', v: (p) => p.e.xg, f: (x) => dec(x, 1), tie: (p) => p.e.g },
      { k: 'gax', label: 'Mål över xG', v: (p) => p.e.g - p.e.xg, f: pp, tie: (p) => p.e.g },
      { k: 'hd', label: 'Farliga skott', v: (p) => p.e.hd, tie: (p) => p.e.hdg },
      { k: 'long', label: 'Längsta mål (m)', v: (p) => p.e.long, f: (x) => dec(x, 1) },
    ] },
    { id: 'eg', title: 'Målvakter', note: `Minst ${Math.ceil(maxSa * 0.3)} skott mot`, rows: gkRows, stats: [
      { k: 'gsax', label: 'GSAx', v: (g) => g.e.xga - g.e.ga, f: pp },
      { k: 'hdsv', label: 'Rädd% farliga', v: (g) => (hdQual.includes(g) ? (1 - g.e.hd[1] / g.e.hd[0]) * 100 : -1), f: (x) => (x < 0 ? '–' : dec(x, 1)) },
      { k: 'dsv', label: 'Rädd% över förv.', v: (g) => (g.e.xga - g.e.ga) / g.e.sa * 100, f: (x) => (x > 0 ? '+' : '') + dec(x, 2) },
      { k: 'sa', label: 'Skott mot', v: (g) => g.e.sa },
    ] },
  ];

  // Team xG
  const teamRows = TABLE.map((r) => {
    const t = E.teams[r.code]; if (!t) return null;
    const [gp, sf, gf, xgf, sa, ga, xga, hdf, hda] = t;
    return { code: r.code, team: r.code, name: tName(r.code), gp, xgfpg: xgf / gp, xgapg: xga / gp, xgp: xgf / Math.max(0.001, xgf + xga), fin: gf - xgf, save: xga - ga, hdf: hdf / gp, hda: hda / gp, sf: sf / gp, sa: sa / gp };
  }).filter(Boolean);

  const zoneRow = (label, [n, g]) => `<tr><td class="l">${label}</td><td>${n}</td><td>${g}</td><td class="hl">${n ? dec((1 - g / n) * 100, 1) : '–'}</td></tr>`;
  const coef = E.model.coef.map((c) => `<tr><td class="l">${esc(c.name)}</td><td class="${c.weight > 0 ? '' : 'faint'}">${c.weight > 0 ? 'Ökar' : 'Minskar'}</td></tr>`).join('');

  render(`
    <div class="page-head"><div><h1>Nexus</h1><p>Skottkvalitet och förväntade mål (xG) för SHL ${E.season.replace('-', '/')}. Varje skott på mål värderas efter var det kom ifrån och i vilket läge.</p></div></div>
    <div class="lsec-row">${sections.map((s) => `<section class="panel lsec">
      <div class="p-head"><h2>${s.title}</h2><span class="stamp">${esc(s.note)}</span></div>
      <div class="utabs" id="lt-${s.id}" role="tablist">${s.stats.map((st, i) => `<button role="tab" data-k="${st.k}" aria-selected="${i === 0}">${st.label}</button>`).join('')}</div>
      <div class="p-body" id="lb-${s.id}">${leaderBody(s, s.stats[0])}</div>
    </section>`).join('')}</div>

    <section class="panel smap-panel" id="shotmap"><div class="p-head"><h2>Skottkarta</h2><p class="p-sub">Varje skott på mål ${E.season.replace('-', '/')}. Större prick = farligare chans. Tryck på ett mål för att se det.</p></div>
      <div class="p-body"><div class="smap">
        <div class="smap-side">
          <div class="seg" id="sm-kind"><button data-v="sk" aria-pressed="true">Spelare</button><button data-v="gk" aria-pressed="false">Målvakt</button><button data-v="t" aria-pressed="false">Lag</button></div>
          <div class="search" id="sm-search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input id="sm-search" type="search" placeholder="Sök spelare" autocomplete="off" aria-label="Sök till skottkartan"><div class="results" id="sm-results" hidden></div></div>
          <div class="chips" id="sm-picks"></div>
          <div id="sm-info"></div>
          <div id="sm-zones"></div>
        </div>
        <div class="smap-main">
          <div class="smap-bar">
            <div class="seg" id="sm-side" hidden><button data-v="for" aria-pressed="true">Skott för</button><button data-v="mot" aria-pressed="false">Skott mot</button></div>
            <div class="seg" id="sm-show"><button data-v="all" aria-pressed="true">Alla</button><button data-v="g" aria-pressed="false">Mål</button><button data-v="hd" aria-pressed="false">Farliga</button></div>
            <div class="seg" id="sm-str"><button data-v="all" aria-pressed="true">Alla lägen</button><button data-v="0" aria-pressed="false">Jämnt</button><button data-v="1" aria-pressed="false">PP</button><button data-v="2" aria-pressed="false">BP</button></div>
            <div class="seg" id="sm-view"><button data-v="dots" aria-pressed="true">Prickar</button><button data-v="heat" aria-pressed="false">Värme</button></div>
          </div>
          <div class="smap-stage" id="sm-rink"></div>
          <div class="legend" id="sm-legend"></div>
          <div id="sm-detail"></div>
        </div>
      </div></div>
    </section>

    <div class="ov-row r-two">
      <section class="panel"><div class="p-head"><h2>Spelarkort</h2><p class="p-sub">Percentiler från ett viktat urval av två säsonger.</p></div>
        <div class="p-body"><div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="card-search" type="search" placeholder="Sök spelare" autocomplete="off" aria-label="Sök spelare"><div class="results" id="card-results" hidden></div></div>
          <div class="chips" id="card-picks"></div><div id="card-slot"></div></div></section>
      ${panel('Lag: xG för och mot', `<div class="chart">${teamScatter(teamRows, { xk: 'xgfpg', yk: 'xgapg', xLabel: 'xG för per match', what: ['xG för', 'xG mot'] })}</div>`, { sub: 'Förväntade mål per match. Bäst är uppe till höger: många chanser framåt, få bakåt.' })}
    </div>
    <div class="ov-row r-one">
      ${panel('Lag: xG-tabell', '<div class="tscroll"><table class="t stick" id="xg-teams" style="min-width:640px"></table></div>', { sub: 'Avslut = gjorda mål minus xG (skärpa framåt). Målvakt = xG mot minus insläppta (målvaktsspel).' })}
    </div>
    <div class="ov-row r-two">
      ${panel('Var målen görs', `<div class="chart">${goalRateMap(E.shots.map((s) => ({ x: s[2], y: s[3], g: s[4], en: s[7] })))}</div>`, { sub: 'Andel skott på mål som blir mål, per område. Ljusare = oftare mål. Rutor med färre än 8 skott visas inte.' })}
      ${panel('Så räknas xG', `<div class="method" style="grid-template-columns:1fr">
        <div><p>Modellen är tränad på ${E.model.shots.toLocaleString('sv-SE')} skott på mål från ${E.model.trainedOn.join(' och ')}. Den räknar ut sannolikheten att ett skott blir mål utifrån avstånd, vinkel, om det är en retur, spelläge och om kassen är tom. Summerat över alla skott förväntar den sig ${E.model.xg.toLocaleString('sv-SE')} mål, och det blev ${E.model.goals.toLocaleString('sv-SE')}.</p></div>
        <div><p>Farliga skott är skott med minst ${Math.round(E.model.zones.hd * 100)} % chans att bli mål. Ligans räddningsprocent är ${dec(lgSv * 100, 1)} totalt.</p></div>
        <div><p>SHL publicerar ingen spårningsdata, så skottfart, skridskofart och missade eller blockerade skott finns inte med. Modellen ser bara skott som går på mål.</p></div>
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px;margin-top:6px">
        <table class="t"><thead><tr><th class="l">Faktor</th><th>Chans</th></tr></thead><tbody>${coef}</tbody></table>
        <table class="t"><thead><tr><th class="l">Läge</th><th>Skott</th><th>Mål</th><th>Rädd%</th></tr></thead><tbody>${zoneRow('Farliga', lg.hd)}${zoneRow('Medel', lg.md)}${zoneRow('Enkla', lg.ld)}</tbody></table>
      </div>`)}
    </div>`);

  // Leader sections: hover to change player, tabs to change stat
  for (const s of sections) {
    bindLeaderHover($(`lb-${s.id}`), s.id);
    $(`lt-${s.id}`).onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      [...$(`lt-${s.id}`).children].forEach((c) => c.setAttribute('aria-selected', c === b));
      const st = s.stats.find((x) => x.k === b.dataset.k);
      const rows = st.k === 'hdsv' ? s.rows.filter((g) => hdQual.includes(g)) : st.k === 'long' ? s.rows.filter((p) => p.e.long > 0) : s.rows;
      $(`lb-${s.id}`).innerHTML = leaderBody({ ...s, rows }, st);
      countUpEl($(`lb-${s.id}`).querySelector('.lfeat-val'));
    };
  }

  // Team xG table
  sortable($('xg-teams'), [
    { k: 'name', label: 'Lag', l: true, asc: true, h: (r) => `<a class="teamcell" href="#/lag/${r.code}">${tb(r.code, 'md')}<div class="nm"><b>${esc(r.code)}</b></div></a>` },
    { k: 'xgfpg', label: 'xG för/M', f: (v) => dec(v, 2) }, { k: 'xgapg', label: 'xG mot/M', asc: true, f: (v) => dec(v, 2) },
    { k: 'xgp', label: 'xG%', f: (v) => dec(v * 100, 1) }, { k: 'hdf', label: 'Farliga/M', f: (v) => dec(v, 1) }, { k: 'hda', label: 'Farl. mot/M', asc: true, f: (v) => dec(v, 1) },
    { k: 'fin', label: 'Avslut', f: pp }, { k: 'save', label: 'Målvakt', f: pp },
  ], teamRows, { key: 'xgp' });

  // Shot map explorer: pick a player, goalie or team, filter by outcome and game state, click a goal for its video
  const HD = E.model.zones.hd;
  const shotsAll = E.shots.map((s, k) => {
    const game = E.games?.[s[9]] || null, team = s[6];
    return { k, sh: s[0] >= 0 ? E.ids[s[0]] : null, gk: s[1] >= 0 ? E.ids[s[1]] : null, x: s[2], y: s[3], g: s[4], xg: s[5] / 1000, team, en: s[7],
      str: s[8] ?? 0, game, opp: game ? (game[1] === team ? game[2] : game[1]) : null, clip: s[10] ?? -1 };
  });
  const SM = { kind: 'sk', id: null, side: 'for', show: 'all', str: 'all', view: 'dots', sel: -1 };
  const defensive = () => SM.kind === 'gk' || (SM.kind === 't' && SM.side === 'mot');
  const picksFor = () => SM.kind === 'sk' ? [...skRows].sort((a, b) => b.e.g - a.e.g || b.e.xg - a.e.xg).slice(0, 8)
    : SM.kind === 'gk' ? [...gkRows].sort((a, b) => b.e.sa - a.e.sa).slice(0, 8) : TABLE.map((r) => ({ id: r.code, name: tName(r.code), team: r.code }));
  const pool = () => shotsAll.filter((s) => SM.kind === 'sk' ? s.sh === SM.id : SM.kind === 'gk' ? s.gk === SM.id : SM.side === 'for' ? s.team === SM.id : s.opp === SM.id);
  const byState = () => pool().filter((s) => SM.str === 'all' || s.str === +SM.str);
  const shown = () => byState().filter((s) => SM.show === 'all' || (SM.show === 'g' ? s.g : s.xg >= HD));
  const STR_NAME = ['Jämnt', 'Powerplay', 'Boxplay'];
  const nameOf = (id) => skBy.get(id)?.name || gkBy.get(id)?.name || 'Okänd';
  const tile = (k, v, s) => `<div class="tile"><span class="k">${k}</span><span class="v">${v}</span>${s ? `<span class="s">${s}</span>` : ''}</div>`;

  const drawInfo = () => {
    const list = byState(), n = list.length, g = sum(list.map((s) => s.g)), xg = sum(list.map((s) => s.xg));
    const hd = list.filter((s) => s.xg >= HD), dist = n ? sum(list.map((s) => Math.hypot(s.x, s.y) / 10)) / n : 0;
    let who;
    if (SM.kind === 't') who = `<div class="smap-who">${tb(SM.id, 'xl')}<div><a class="lfeat-name" href="#/lag/${esc(SM.id)}">${esc(tName(SM.id))}</a><div class="lfeat-meta"><span>${SM.side === 'for' ? 'Lagets skott' : 'Skott mot laget'}</span></div></div></div>`;
    else {
      const p = (SM.kind === 'sk' ? skRows : gkAll).find((r) => r.id === SM.id);
      who = p ? `<div class="smap-who">${portrait(p.id, p.name, p.team, 'sm')}<div><a class="lfeat-name" href="#/spelare/${encodeURIComponent(p.id)}">${esc(p.name)}</a>
        <div class="lfeat-meta">${tb(p.team)}<span>${esc(p.team)} · #${esc(p.num ?? '–')} · ${POS_SHORT[p.pos] || 'F'}</span></div></div></div>` : '';
    }
    const ne = list.filter((s) => !s.en), neG = sum(ne.map((s) => s.g)), neXg = sum(ne.map((s) => s.xg));
    const tiles = defensive()
      ? tile('Skott mot', n) + tile('Insläppta', g) + tile('Rädd%', ne.length ? dec((1 - neG / ne.length) * 100, 1) : '–', `liga ${dec(lgSv * 100, 1)}`)
        + tile('xG mot', dec(xg, 1)) + tile('GSAx', ne.length ? pp(neXg - neG) : '–', 'räddat över förväntan') + tile('Farliga', hd.length, hd.length ? `${dec((1 - sum(hd.map((s) => s.g)) / hd.length) * 100, 0)} % räddade` : '')
      : tile('Skott', n) + tile('Mål', g) + tile('xG', dec(xg, 1)) + tile('Mål över xG', pp(g - xg))
        + tile('Farliga', hd.length, `${sum(hd.map((s) => s.g))} mål`) + tile('Snittavstånd', n ? dec(dist, 1) : '–', 'meter');
    $('sm-info').innerHTML = `${who}<div class="tiles">${tiles}</div>`;
    // Where the shots come from: close, middle, far
    const bands = [['Nära mål', 0, 6], ['Mellandistans', 6, 12], ['Långt ifrån', 12, 999]].map(([label, a, b]) => {
      const inBand = list.filter((s) => { const d = Math.hypot(s.x, s.y) / 10; return d >= a && d < b; });
      return { label, n: inBand.length, g: sum(inBand.map((s) => s.g)) };
    });
    const mx = Math.max(1, ...bands.map((b) => b.n));
    $('sm-zones').innerHTML = n ? `<div class="sm-zones"><h3>Avstånd</h3>${bands.map((b) => `<div class="smz">
      <span class="smz-l">${b.label}</span><div class="smz-bar"><i style="width:${b.n / mx * 100}%"></i><i class="g" style="width:${b.g / mx * 100}%"></i></div>
      <span class="smz-v num">${b.n} <small>${b.g} mål${b.n ? ` · ${Math.round(b.g / b.n * 100)} %` : ''}</small></span></div>`).join('')}</div>` : '';
    countUp($('sm-info'));
  };
  const drawDetail = () => {
    const s = shotsAll[SM.sel];
    if (!s || SM.sel < 0) { $('sm-detail').innerHTML = `<div class="sm-hint">${icon('play')}<span>Tryck på ett mål på kartan för att se vem som gjorde det, hur farlig chansen var och spela upp videon.</span></div>`; return; }
    const clip = s.clip >= 0 ? E.clips[s.clip] : null, [gid, , , date] = s.game || [];
    const title = `${nameOf(s.sh)} mot ${tName(s.opp)}`;
    $('sm-detail').innerHTML = `<div class="smd">
      ${clip && safeEmbed(clip[0]) ? `<button class="smd-video" data-embed="${esc(clip[0])}" data-title="${esc(title)}">${clip[1] ? `<img src="${esc(clip[1])}" alt="">` : ''}<span class="play-ic"></span></button>` : ''}
      <div class="smd-info"><span class="smd-k">Mål${date ? ` · ${fmtDay(date)}` : ''}${s.opp ? ` · mot ${esc(tName(s.opp))}` : ''}</span>
        <b>${s.sh ? `<a href="#/spelare/${encodeURIComponent(s.sh)}">${esc(nameOf(s.sh))}</a>` : 'Okänd målskytt'} <span class="faint">${esc(s.team)}</span></b>
        <div class="smd-facts"><span><b>${dec(s.xg * 100, s.xg < 0.1 ? 1 : 0)} %</b> chans (xG)</span><span><b>${dec(Math.hypot(s.x, s.y) / 10, 1)} m</b> från mål</span><span>${s.en ? 'Tom kasse' : STR_NAME[s.str]}</span>${s.gk && !s.en ? `<span>Målvakt: ${esc(nameOf(s.gk))}</span>` : ''}</div>
        ${gid ? `<a class="more-link" href="#/match/${esc(gid)}">Matchfakta ›</a>` : ''}</div></div>`;
  };
  const drawRink = () => {
    const color = defensive() ? 'var(--bad)' : 'var(--accent)';
    $('sm-rink').innerHTML = shotRink(shown(), { color, mode: SM.view, sel: SM.sel, title: 'Skottkarta' });
    $('sm-legend').innerHTML = SM.view === 'heat'
      ? `<span><i style="background:${color}"></i>Mörkare = fler och farligare skott</span><span><i style="background:${color};border-radius:50%"></i>${defensive() ? 'Insläppt mål' : 'Mål'}</span>`
      : `<span><i style="background:${color};border-radius:50%;box-shadow:0 0 0 3px color-mix(in srgb, ${color} 35%, transparent)"></i>${defensive() ? 'Insläppt mål' : 'Mål'}</span><span><i style="background:var(--muted);opacity:.55;border-radius:50%"></i>Räddat</span><span>Större = högre xG</span><span>Streckat område = farligaste ytan</span>`;
  };
  const drawAll = () => {
    $('sm-picks').innerHTML = picksFor().map((r) => `<button class="chip ${SM.kind === 't' ? 'chip-team' : ''}" data-id="${esc(r.id)}" aria-pressed="${r.id === SM.id}">${SM.kind === 't' ? tb(r.id) + esc(r.id) : esc(r.name)}</button>`).join('');
    $('sm-search-wrap').hidden = SM.kind === 't';
    $('sm-side').hidden = SM.kind !== 't';
    drawInfo(); drawRink(); drawDetail();
  };
  const pick = (id) => { if (!id) return; SM.id = id; SM.sel = -1; drawAll(); };
  const segBind = (id, key, after) => $(id).onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    SM[key] = b.dataset.v; [...$(id).children].forEach((c) => c.setAttribute('aria-pressed', c === b));
    after();
  };
  segBind('sm-kind', 'kind', () => { $('sm-search').placeholder = SM.kind === 'gk' ? 'Sök målvakt' : 'Sök spelare'; $('sm-search').value = ''; pick(SM.kind === 't' && FAV ? FAV : picksFor()[0]?.id); });
  segBind('sm-side', 'side', () => { SM.sel = -1; drawAll(); });
  segBind('sm-show', 'show', () => { drawRink(); });
  segBind('sm-str', 'str', () => { SM.sel = -1; drawInfo(); drawRink(); drawDetail(); });
  segBind('sm-view', 'view', () => { drawRink(); });
  $('sm-picks').onclick = (e) => { const b = e.target.closest('button'); if (b) pick(b.dataset.id); };
  const selectGoal = (el) => {
    if (!el) return;
    SM.sel = +el.dataset.k;
    $('sm-rink').querySelectorAll('.sm-goal').forEach((g) => g.classList.toggle('sel', g === el));
    drawDetail();
    if (isNarrow()) $('sm-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  $('sm-rink').onclick = (e) => selectGoal(e.target.closest('.sm-goal'));
  $('sm-rink').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectGoal(e.target.closest('.sm-goal')); } };
  bindSearch($('sm-search'), $('sm-results'), (it) => pick(it.id), (it) => it.type === 'p' && (SM.kind === 'sk' ? !!E.skaters[it.id] : !!E.goalies[it.id]));
  pick(picksFor()[0]?.id);

  // Player card with quick picks and search
  const eligible = [...CARD.values()].filter((x) => x.gp >= MIN_GP);
  const topCards = (grp, n) => eligible.filter((x) => x.grp === grp).sort((a, b) => b.composite - a.composite).slice(0, n);
  const cardPicks = [...topCards('F', 4), ...topCards('D', 2)];
  const showCard = (x) => {
    if (!x) return;
    $('card-slot').innerHTML = cardHtml(x);
    $('card-picks').innerHTML = cardPicks.map((p) => `<button class="chip" data-id="${esc(p.id)}" aria-pressed="${p.id === x.id}">${esc(p.name)}</button>`).join('');
  };
  $('card-picks').onclick = (e) => { const b = e.target.closest('button'); if (b) showCard(CARD.get(b.dataset.id)); };
  bindSearch($('card-search'), $('card-results'), (it) => showCard(CARD.get(it.id)), (it) => it.type === 'p' && CARD.has(it.id));
  showCard(cardPicks[0]);
}

/* ---------- Spelare ---------- */
async function pagePlayer(id, tab = '') {
  if (!PLAYERS) app.innerHTML = skeleton();
  const P = await loadPlayers();
  const bio = P.bios[id];
  if (!bio) return notFound('Spelaren hittades inte.');
  setTitle(bio.name); mTitle(bio.name);
  const gk = bio.pos === 'GK';
  const cur = (gk ? goalies() : skaters()).find((p) => p.id === id);
  const team = cur?.team || bio.team;
  const clips = P.goalClips?.[id] || [];
  const log = (gk ? P.goalieLogs[id] : P.gamelogs[id]) || [];
  const careerRows = gk ? (P.goalieCareer[id] || []) : (P.career[id] || []);
  const tabList = [['', 'Översikt'], ['karriar', 'Karriär'], ['matchlogg', 'Matchlogg', log.length || ''], ...(clips.length ? [['mal', 'Målvideor', clips.length]] : [])];
  if (!tabList.some(([k]) => k === tab)) tab = '';
  const hw = [bio.h ? `${bio.h} cm` : '', bio.w ? `${bio.w} kg` : ''].filter(Boolean).join(', ');
  const tiles = gk
    ? [['Matcher', cur?.gpi ?? 0], ['Rädd%', cur ? dec(cur.svp, 2) : '–'], ['GAA', cur ? dec(cur.gaa, 2) : '–'], ['Nollor', cur?.so ?? 0], ['GSAA', cur ? dec(gsaa(cur, CUR)) : '–']]
    : [['Matcher', cur?.gp ?? 0], ['Mål', cur?.g ?? 0], ['Assist', cur?.a ?? 0], ['Poäng', cur?.pts ?? 0], ['+/-', cur ? signed(cur.pm) : '–'], ['Istid', cur ? mmss(cur.toi) : '–']];
  const hero = `<section class="panel" style="--tc:${tColor(team)}"><div class="hero">
    ${portrait(id, bio.name, team, 'lg')}
    <div class="info">
      <div class="crumbs"><a href="#/statistik">Spelare</a> / ${esc(bio.name)}</div>
      <h1>${esc(bio.name)}</h1>
      <div class="meta"><span>${teamLink(team, { name: true })}</span><span>#<b>${esc(bio.num ?? '–')}</b></span><span><b>${POS[bio.pos] || 'Forward'}</b></span>
        <span>Ålder <b>${ageOf(bio.born)}</b>${bio.born ? ` (${fmtDate(bio.born)})` : ''}</span><span>Nation <b>${esc(NAT[bio.nat] || bio.nat || '–')}</b></span>${hw ? `<span><b>${hw}</b></span>` : ''}</div>
      <div class="tiles" style="margin-top:6px">${tiles.map(([k, v]) => `<div class="tile"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${CUR}</span></div>`).join('')}</div>
    </div></div>${tabs(`/spelare/${encodeURIComponent(id)}`, tabList, tab)}</section>`;

  const res = (gid, code) => { const g = GAMES_BY_ID[gid]; if (!g) return ''; const r = resultFor(g, code); const mine = g.home === code ? g.hs : g.as, th = g.home === code ? g.as : g.hs;
    return `<a href="#/match/${gid}">${r === 'v' || r === 'ov' ? 'V' : 'F'} ${mine}–${th}${g.ot || g.so ? ' ÖT' : ''}</a>`; };
  const gdate = (gid) => GAMES_BY_ID[gid] ? fmtDay(GAMES_BY_ID[gid].start) : '';
  let body;
  if (tab === 'karriar') {
    if (!careerRows.length) body = panel('SHL-karriär', '<p class="empty-state">Ingen SHL-statistik hittades för spelaren.</p>');
    else {
    const col = (i) => careerRows.map((r) => +r[i] || 0);
    const tot = (i) => sum(col(i));
    const seasons = new Set(careerRows.map((r) => r[0])).size;
    const span = `${careerRows.at(-1)[0].replace('-', '/')} – ${careerRows[0][0].replace('-', '/')}`;
    // Each stat's best season gets highlighted (only when there is more than one season to compare)
    const bestOf = (i, low = false) => { if (careerRows.length < 2) return null; const v = col(i).filter((x, k) => !low || careerRows[k][2] >= 10); return v.length ? (low ? Math.min(...v) : Math.max(...v)) : null; };
    const cell = (v, shown, best, cls = '') => `<td class="${[cls, best !== null && v === best && v !== 0 ? 'best' : ''].filter(Boolean).join(' ')}">${shown}</td>`;
    let sumTiles, t;
    if (gk) {
      const sv = tot(3), ga = tot(4), mins = tot(10);
      sumTiles = [['Säsonger', seasons, span], ['Matcher', tot(2), 'grundserien'], ['Rädd%', sv + ga ? dec(sv / (sv + ga) * 100, 2) : '–', 'karriären'], ['GAA', mins ? dec(ga * 60 / mins, 2) : '–', 'karriären'], ['Nollor', tot(7), 'totalt'], ['Vinster', tot(8), 'totalt']];
      const b = { gp: bestOf(2), sv: bestOf(3), svp: bestOf(5), gaa: bestOf(6, true), so: bestOf(7), w: bestOf(8) };
      t = `<table class="t"><thead><tr><th class="l">Säsong</th><th class="l">Lag</th><th>SM</th><th>Räddn.</th><th>Insl.</th><th>Rädd%</th><th>GAA</th><th>Nollor</th><th>V</th><th>F</th></tr></thead><tbody>${careerRows.map((r) =>
        `<tr><td class="l">${r[0]}</td><td class="l">${teamLink(r[1], { name: true })}</td>${cell(r[2], r[2], b.gp)}${cell(r[3], r[3], b.sv)}<td>${r[4]}</td>${r[2] >= 10 ? cell(r[5], dec(r[5], 2), b.svp, 'hl') : `<td class="hl">${dec(r[5], 2)}</td>`}${r[2] >= 10 ? cell(r[6], dec(r[6], 2), b.gaa) : `<td>${dec(r[6], 2)}</td>`}${cell(r[7], r[7], b.so)}${cell(r[8], r[8] ?? '–', b.w)}<td>${r[9] ?? '–'}</td></tr>`).join('')}
        ${careerRows.length > 1 ? `<tr class="total"><td class="l"><b>Totalt</b></td><td></td><td><b>${tot(2)}</b></td><td><b>${sv}</b></td><td><b>${ga}</b></td><td class="hl">${sv + ga ? dec(sv / (sv + ga) * 100, 2) : '–'}</td><td><b>${mins ? dec(ga * 60 / mins, 2) : '–'}</b></td><td><b>${tot(7)}</b></td><td><b>${tot(8)}</b></td><td><b>${tot(9)}</b></td></tr>` : ''}</tbody></table>`;
    } else {
      const gp = tot(2);
      sumTiles = [['Säsonger', seasons, span], ['Matcher', gp, 'grundserien'], ['Mål', tot(3), 'totalt'], ['Assist', tot(4), 'totalt'], ['Poäng', tot(5), 'totalt'], ['Poäng/match', gp ? dec(tot(5) / gp, 2) : '–', 'karriären']];
      const b = { gp: bestOf(2), g: bestOf(3), a: bestOf(4), p: bestOf(5), pm: bestOf(6), sog: bestOf(8), ppg: bestOf(10) };
      t = `<table class="t"><thead><tr><th class="l">Säsong</th><th class="l">Lag</th><th>SM</th><th>M</th><th>A</th><th>P</th><th>P/M</th><th>+/-</th><th>Utv</th><th>PPM</th><th>Skott</th><th>Istid</th></tr></thead><tbody>${careerRows.map((r) =>
        `<tr><td class="l">${r[0]}</td><td class="l">${teamLink(r[1], { name: true })}</td>${cell(r[2], r[2], b.gp)}${cell(r[3], r[3], b.g)}${cell(r[4], r[4], b.a)}${cell(r[5], r[5], b.p, 'hl')}<td>${dec(r[2] ? r[5] / r[2] : 0, 2)}</td>${cell(r[6], signed(r[6]), b.pm)}<td>${r[7]}</td>${cell(r[10] ?? 0, r[10] ?? '–', b.ppg)}${cell(r[8], r[8], b.sog)}<td>${mmss(r[9])}</td></tr>`).join('')}
        ${careerRows.length > 1 ? `<tr class="total"><td class="l"><b>Totalt</b></td><td></td><td><b>${gp}</b></td><td><b>${tot(3)}</b></td><td><b>${tot(4)}</b></td><td class="hl">${tot(5)}</td><td><b>${gp ? dec(tot(5) / gp, 2) : '–'}</b></td><td><b>${signed(tot(6))}</b></td><td><b>${tot(7)}</b></td><td><b>${tot(10)}</b></td><td><b>${tot(8)}</b></td><td></td></tr>` : ''}</tbody></table>`;
    }
    const summary = `<section class="panel"><div class="p-body"><div class="tiles">${sumTiles.map(([k, v, s]) => `<div class="tile"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join('')}</div></div></section>`;

    // Teams played for, most recent first, with their season spans
    const clubs = new Map();
    for (const r of [...careerRows].reverse()) {
      const c = clubs.get(r[1]) || { code: r[1], from: r[0], to: r[0], n: 0, gp: 0, v: 0 };
      c.to = r[0]; c.n++; c.gp += +r[2] || 0; c.v += gk ? +r[7] || 0 : +r[5] || 0; clubs.set(r[1], c);
    }
    const clubList = panel('Klubbar i SHL', `<ul class="clubs">${[...clubs.values()].reverse().map((c) =>
      `<li><a href="#/lag/${esc(c.code)}">${tb(c.code, 'md')}</a><div><a href="#/lag/${esc(c.code)}"><b>${esc(tName(c.code))}</b></a><span>${c.from === c.to ? c.from.replace('-', '/') : `${c.from.replace('-', '/')} – ${c.to.replace('-', '/')}`} · ${c.n} ${c.n === 1 ? 'säsong' : 'säsonger'}</span></div>
        <span class="clubs-v"><b>${c.gp}</b> SM · <b>${c.v}</b> ${gk ? 'nollor' : 'p'}</span></li>`).join('')}</ul>`);

    const chrono = [...careerRows].reverse();
    const chart = careerRows.length > 1
      ? panel(gk ? 'Räddningsprocent per säsong' : 'Poäng per säsong', `<div class="chart">${gk
        ? lineChart([{ pts: chrono.map((r) => Math.max(80, +r[5] || 0)), color: 'var(--accent)' }], { xLabels: chrono.map((r) => r[0]), yFmt: (v) => dec(v, 1), yMin: Math.max(80, Math.floor(Math.min(...chrono.map((r) => +r[5] || 100)) - 1)), yMax: Math.min(100, Math.ceil(Math.max(...chrono.map((r) => +r[5] || 0)) + 1)) })
        : hBars(chrono.map((r) => ({ label: `${r[0]} ${r[1]}`, v: r[5] })), { fmt: (v) => v, labelW: 110 })}</div>`, { sub: gk ? 'Säsonger med färre än 10 matcher säger mindre.' : 'Grundserien, äldst överst.' })
      : '';
    body = summary + board([panel('SHL-karriär', `<div class="tscroll">${t}</div>`, { sub: 'Grundserien i SHL säsong för säsong. Färgad siffra = bästa säsongen i den kategorin.', cls: 'wide' }), clubList, chart]);
    }
  } else if (tab === 'matchlogg') {
    const t = !log.length ? '<p class="empty-state">Inga matcher den här säsongen.</p>' : gk
      ? `<table class="t"><thead><tr><th class="l">Datum</th><th class="l">Motstånd</th><th class="l">Resultat</th><th>Skott</th><th>Räddn.</th><th>Insl.</th><th>Rädd%</th></tr></thead><tbody>${[...log].reverse().map((r) =>
          `<tr><td class="l">${gdate(r[0])}</td><td class="l">${r[3] ? 'mot' : 'på'} ${teamLink(r[2], { name: true })}</td><td class="l">${res(r[0], r[1])}</td><td>${r[5]}</td><td>${r[6]}</td><td>${r[4]}</td><td class="hl">${dec(r[5] ? r[6] / r[5] * 100 : 0, 1)}</td></tr>`).join('')}</tbody></table>`
      : `<table class="t"><thead><tr><th class="l">Datum</th><th class="l">Motstånd</th><th class="l">Resultat</th><th>M</th><th>A</th><th>P</th><th>+/-</th><th>Skott</th><th>Utv</th><th>Istid</th><th>Tackl.</th><th>Block</th></tr></thead><tbody>${[...log].reverse().map((r) =>
          `<tr><td class="l">${gdate(r[0])}</td><td class="l">${r[3] ? 'mot' : 'på'} ${teamLink(r[2], { name: true })}</td><td class="l">${res(r[0], r[1])}</td><td>${r[4]}</td><td>${r[5]}</td><td class="hl">${r[4] + r[5]}</td><td>${signed(r[6])}</td><td>${r[8]}</td><td>${r[9]}</td><td>${mmss(r[7])}</td><td>${r[10]}</td><td>${r[11]}</td></tr>`).join('')}</tbody></table>`;
    body = panel(`Matchlogg ${CUR}`, `<div class="tscroll">${t}</div>`);
  } else if (tab === 'mal') {
    body = panel(`Målvideor ${CUR}`, `<div class="clips">${[...clips].reverse().map(([gid, cid, thumb, embed, date, opp]) =>
      clipCard({ id: cid, thumb, embed }, `Mot ${esc(tName(opp))}`, fmtDay(date))).join('')}</div>`);
  } else {
    let trend = '';
    if (!gk && log.length >= 2) {
      let c = 0; const pts = log.map((r) => (c += r[4] + r[5]));
      trend = panel('Poängutveckling', `<div class="chart">${lineChart([{ pts, color: 'var(--accent)', area: true }], { xLabels: log.map((r) => GAMES_BY_ID[r[0]] ? `${dateParts(GAMES_BY_ID[r[0]].start).d}/${dateParts(GAMES_BY_ID[r[0]].start).m}` : ''), yFmt: (v) => Math.round(v) })}</div>`, { sub: `Ackumulerade poäng ${CUR}.` });
    }
    const card = !gk && CARD.get(id) ? panel('Spelarkort', cardHtml(CARD.get(id), { link: false }), { sub: 'Percentiler jämfört med andra SHL-spelare på samma position.' }) : '';
    const recent = clips.slice(-3).reverse();
    const latestClips = recent.length ? panel('Senaste målen', `<div class="clips">${recent.map(([gid, cid, thumb, embed, date, opp]) => clipCard({ id: cid, thumb, embed }, `Mot ${esc(tName(opp))}`, fmtDay(date))).join('')}</div>`,
      { more: clips.length > 3 ? moreLink(`#/spelare/${encodeURIComponent(id)}/mal`, 'Alla mål') : '' }) : '';
    const last5 = [...log].slice(-5).reverse();
    const recentGames = last5.length ? panel('Senaste matcherna', `<div class="tscroll"><table class="t"><thead><tr><th class="l">Datum</th><th class="l">Motstånd</th>${gk ? '<th>Rädd%</th>' : '<th>M</th><th>A</th><th>+/-</th>'}</tr></thead><tbody>${last5.map((r) =>
      `<tr><td class="l">${gdate(r[0])}</td><td class="l">${teamLink(r[2], { name: true })}</td>${gk ? `<td class="hl">${dec(r[5] ? r[6] / r[5] * 100 : 0, 1)}</td>` : `<td>${r[4]}</td><td>${r[5]}</td><td>${signed(r[6])}</td>`}</tr>`).join('')}</tbody></table></div>`,
      { more: moreLink(`#/spelare/${encodeURIComponent(id)}/matchlogg`, 'Hela loggen') }) : '';
    body = board([card, trend, latestClips, recentGames]) || '';
    if (!card && !trend && !latestClips && !recentGames) body = panel('', '<p class="empty-state">Ingen statistik den här säsongen ännu.</p>');
  }
  render(hero + body);
}

/* ---------- Tabell: Lagstatistik tab ---------- */
function teamStatsTab(head) {
  const narrow = isNarrow(); // phones: the compact table first, the wide stats table below it
  const rows = TABLE.map((r) => {
    const T = D.teamStats[r.code] || {}, gp = r.gp || 0, tg = T.gp || 0;
    return {
      rank: TABLE.indexOf(r) + 1,
      code: r.code, team: r.code, name: tName(r.code), gp, w: r.w, otw: r.otw, otl: r.otl, l: r.l, gf: r.gf, ga: r.ga, diff: r.gf - r.ga, pts: r.pts,
      ppm: gp ? r.pts / gp : null, gfpg: gp ? r.gf / gp : null, gapg: gp ? r.ga / gp : null,
      sog: tg ? T.sog / tg : null, sa: tg ? T.sa / tg : null, pp: T.ppo ? T.ppg / T.ppo : null, pk: T.pko ? 1 - T.ppga / T.pko : null,
      fo: T.fow + T.fol ? T.fow / (T.fow + T.fol) : null, hits: tg ? T.hits / tg : null, pim: tg ? T.pim / tg : null, proj: SIM[r.code].proj,
    };
  });
  render(`${head}
    ${board([
      ...(narrow ? [panel('Tabell', standingsTable({ mode: 'stats' }) + legendHtml, { cls: 'wide' }),
        panel('Lagstatistik', '<div class="tscroll"><table class="t stick" id="ttable" style="min-width:860px"></table></div>', { cls: 'wide', sub: 'Tryck på en kolumnrubrik för att sortera.' })]
      : [panel('Tabell', `<div class="tscroll"><table class="t stick" id="ttable" style="min-width:1040px"></table></div>${legendHtml}`,
        { sub: 'Tryck på en kolumnrubrik för att sortera. Skott, powerplay, boxplay, tekningar och tacklingar räknas från matchdata.', cls: 'wide', foot: `<span class="stamp">Uppdaterad ${esc(stampTxt)}</span>` })]),
      panel('Anfall mot försvar', `<div class="chart">${teamScatter(rows)}</div>`, { sub: 'Gjorda och insläppta mål per match. Bäst är uppe till höger.' }),
      panel('Specialteam', `<div class="chart">${specialTeams(rows)}</div>`, { sub: 'Powerplay och boxplay i procent.' }),
    ])}`);
  const tcols = [
    { k: 'rank', label: '#', asc: true, h: (r) => {
      const z = r.rank <= 6 ? 'var(--accent)' : r.rank <= 10 ? 'color-mix(in srgb, var(--accent) 60%, var(--muted))' : r.rank >= 13 ? 'var(--bad)' : 'var(--faint)';
      return `<span class="rank" style="--zone:${z}">${r.rank}</span>`; } },
    { k: 'name', label: 'Lag', l: true, asc: true, h: (r) => `<a class="teamcell" href="#/lag/${r.code}">${tb(r.code, 'md')}<div class="nm"><b>${esc(r.name)}</b><span>${esc(r.code)}</span></div></a>` },
    { k: 'gp', label: 'SM' }, { k: 'w', label: 'V' }, { k: 'otw', label: 'ÖV' }, { k: 'otl', label: 'ÖF' }, { k: 'l', label: 'F', asc: true },
    { k: 'gf', label: 'GM', title: 'Gjorda mål' }, { k: 'ga', label: 'IM', title: 'Insläppta mål', asc: true }, { k: 'diff', label: '+/-', f: signed },
    { k: 'pts', label: 'P' }, { k: 'ppm', label: 'P/M', f: (v) => dec(v, 2) }, { k: 'gfpg', label: 'GM/M', f: (v) => dec(v, 2) },
    { k: 'gapg', label: 'IM/M', asc: true, f: (v) => dec(v, 2) }, { k: 'sog', label: 'Skott/M', f: (v) => dec(v, 1) }, { k: 'sa', label: 'Skott mot/M', asc: true, f: (v) => dec(v, 1) },
    { k: 'pp', label: 'PP%', f: (v) => dec(v * 100, 1) }, { k: 'pk', label: 'BP%', f: (v) => dec(v * 100, 1) }, { k: 'fo', label: 'Tekn%', f: (v) => dec(v * 100, 1) },
    { k: 'hits', label: 'Tackl/M', f: (v) => dec(v, 1) }, { k: 'pim', label: 'Utv/M', asc: true, f: (v) => dec(v, 1) }, { k: 'proj', label: 'Proj. P', f: (v) => dec(v, 0) },
  ];
  if (narrow) tcols.splice(0, 2, { k: 'name', label: 'Lag', l: true, asc: true, h: (r) => `<a class="teamcell" href="#/lag/${r.code}">${tb(r.code)}<div class="nm"><b>${esc(r.code)}</b></div></a>` });
  sortable($('ttable'), tcols, rows, narrow ? { key: 'pts' } : { key: 'rank', desc: false });
  layoutBoards();
}
// Attack (x) against defence (y) per team. Defaults to goals per game; the Nexus page passes xG.
function teamScatter(rows, { xk = 'gfpg', yk = 'gapg', xLabel = 'Gjorda mål per match', what = ['gjorda', 'insläppta'] } = {}) {
  rows = rows.map((r) => ({ ...r, gfpg: r[xk], gapg: r[yk] }));
  const pts = rows.filter((r) => r.gfpg != null);
  if (!pts.length) return '<p class="empty-state">Inga spelade matcher ännu.</p>';
  const W = cw(560), H = Math.round(W * 0.78), p = 44;
  const xs = pts.map((r) => r.gfpg), ys = pts.map((r) => r.gapg);
  const [x0, x1] = [Math.min(...xs) - 0.2, Math.max(...xs) + 0.2], [y0, y1] = [Math.min(...ys) - 0.2, Math.max(...ys) + 0.2];
  // Fewer goals conceded plots higher, so a good defence sits at the top
  const X = (v) => p + (v - x0) / (x1 - x0) * (W - 2 * p), Y = (v) => p / 2 + (v - y0) / (y1 - y0) * (H - 1.5 * p);
  const mx = sum(xs) / xs.length, my = sum(ys) / ys.length;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gjorda mot insläppta mål per match">
    <line x1="${X(mx)}" x2="${X(mx)}" y1="${p / 2}" y2="${H - p}" style="stroke:var(--line)" stroke-dasharray="4 4"/>
    <line x1="${p}" x2="${W - p}" y1="${Y(my)}" y2="${Y(my)}" style="stroke:var(--line)" stroke-dasharray="4 4"/>
    <text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-size="12" style="fill:var(--muted)">${esc(xLabel)} →</text>
    <text x="14" y="${H / 2}" text-anchor="middle" font-size="12" style="fill:var(--muted)" transform="rotate(-90 14 ${H / 2})">← Fler insläppta · Färre insläppta →</text>`;
  for (const t of [x0, (x0 + x1) / 2, x1]) svg += `<text x="${X(t)}" y="${H - p + 16}" text-anchor="middle" font-size="11" style="fill:var(--faint)">${dec(t, 1)}</text>`;
  for (const r of pts) {
    const cx = X(r.gfpg), cy = Y(r.gapg);
    svg += `<a href="#/lag/${r.code}"><circle cx="${cx}" cy="${cy}" r="18" style="fill:var(--panel-2);stroke:${r.code === FAV ? 'var(--accent)' : 'var(--line)'}" stroke-width="${r.code === FAV ? 2.5 : 1}"/>` +
      (LOGOS[r.code] ? `<image href="${esc(LOGOS[r.code])}" x="${cx - 13}" y="${cy - 13}" width="26" height="26"><title>${esc(r.name)}: ${dec(r.gfpg, 2)} ${what[0]}, ${dec(r.gapg, 2)} ${what[1]}</title></image>`
        : `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="700" style="fill:var(--text)">${esc(r.code)}</text>`) + '</a>';
  }
  return svg + '</svg>';
}
function specialTeams(rows) {
  const list = rows.filter((r) => r.pp != null || r.pk != null).sort((a, b) => ((b.pp || 0) + (b.pk || 0)) - ((a.pp || 0) + (a.pk || 0)));
  if (!list.length) return '<p class="empty-state">Inga spelade matcher ännu.</p>';
  const W = cw(560), rowH = isNarrow() ? 30 : 26, left = isNarrow() ? 84 : 150, mid = left + (W - left) / 2, half = (W - left) / 2 - 30, H = list.length * rowH + 28;
  // Box play bars start at 50 %, since every team kills most penalties
  const pkW = (pk) => Math.max(0, (pk - 0.5) / 0.5) * half;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Powerplay och boxplay">
    <text x="${mid - 8}" y="14" text-anchor="end" font-size="12" style="fill:var(--muted)">Powerplay %</text><text x="${mid + 8}" y="14" font-size="12" style="fill:var(--muted)">Boxplay %</text>`;
  list.forEach((r, i) => {
    const y = 24 + i * rowH, pp = r.pp || 0, pk = r.pk || 0;
    svg += `<text x="${left - 32}" y="${y + 16}" text-anchor="end" font-size="13.5" style="fill:var(--text)">${esc(isNarrow() ? r.code : r.name)}</text>
      ${LOGOS[r.code] ? `<image href="${esc(LOGOS[r.code])}" x="${left - 26}" y="${y + 3}" width="20" height="20"/>` : ''}
      <rect x="${mid - 4 - pp * half}" y="${y + 5}" width="${pp * half}" height="${rowH - 10}" rx="3" style="fill:var(--accent)"><title>${esc(r.name)} powerplay ${pctTxt(pp, 1)}</title></rect>
      <text x="${mid - 8 - pp * half}" y="${y + 17}" text-anchor="end" font-size="11" style="fill:var(--muted)">${Math.round(pp * 100)}</text>
      <rect x="${mid + 4}" y="${y + 5}" width="${pkW(pk)}" height="${rowH - 10}" rx="3" style="fill:var(--good)"><title>${esc(r.name)} boxplay ${pctTxt(pk, 1)}</title></rect>
      <text x="${mid + 8 + pkW(pk)}" y="${y + 17}" font-size="11" style="fill:var(--muted)">${Math.round(pk * 100)}</text>`;
  });
  return svg + `</svg><p class="note">Boxplaystapeln börjar på 50 % för att skillnaderna ska synas.</p>`;
}

/* ---------- Lag (enskilt) ---------- */
async function pageTeam(code, tab = '') {
  if (!TEAMS[code]) return notFound('Laget hittades inte.');
  setTitle(tName(code)); mTitle(tName(code));
  const s = SIM[code], r = TABLE.find((t) => t.code === code), rank = TABLE.indexOf(r) + 1, T = D.teamStats[code] || {};
  if (!s || !r) return notFound(`${tName(code)} spelar inte i SHL den här säsongen.`);
  const teamGames = GAMES.filter((g) => g.home === code || g.away === code);
  const roster = D.rosters[code] || [];
  const tabList = [['', 'Översikt'], ['form', 'Form & statistik'], ['trupp', 'Trupp', roster.length || ''], ['schema', 'Schema'], ['historik', 'Historik']];
  let TD = { logs: {}, news: {} };
  try { if (!TEAMDATA) app.innerHTML = skeleton(); TD = await loadTeams(); } catch { /* the page works without it */ }
  if (!tabList.some(([k]) => k === tab)) tab = '';
  const isFav = FAV === code;
  // Charts and highlights on this page use the club colour, picked to stay readable on the current theme
  const ta = teamAccent(code);
  if (ta) { app.style.setProperty('--accent', ta.accent); app.style.setProperty('--accent-ink', ta.ink); }
  const [tbg, tfg] = TC[code] || ['#5b6b7e', '#fff'];
  const hero = `<section class="panel" style="--tc:${tbg};--tt:${tfg}"><div class="hero team band">${tb(code, 'xl')}
    <div class="info"><div class="crumbs"><a href="#/tabell">Tabell</a> / ${esc(tName(code))}</div><h1>${esc(tName(code))}</h1>
      <div class="meta"><span>Plats <b>${rank}</b></span><span><b>${r.pts}</b> poäng på <b>${r.gp}</b> matcher</span><span>V–ÖV–ÖF–F <b>${r.w}–${r.otw}–${r.otl}–${r.l}</b></span><span>Mål <b>${r.gf}–${r.ga}</b></span></div>
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">${formChips(code)}<button class="favbtn" data-fav="${code}" aria-pressed="${isFav}"><span>${isFav ? '★ Mitt lag' : '☆ Följ laget'}</span></button></div></div></div>
    <div class="p-body" style="padding-top:16px"><div class="tiles">
      <div class="tile"><span class="k">Proj. poäng</span><span class="v">${dec(s.proj, 0)}</span><span class="s">80 %: ${s.lo}–${s.hi}</span></div>
      <div class="tile"><span class="k">Topp 6</span><span class="v">${oddsTxt(s.top6)}</span><span class="s">direkt till kvartsfinal</span></div>
      <div class="tile"><span class="k">Slutspel</span><span class="v">${oddsTxt(s.top10)}</span><span class="s">topp 10</span></div>
      <div class="tile"><span class="k">Semifinal</span><span class="v">${oddsTxt(s.semi)}</span></div>
      <div class="tile"><span class="k">SM-final</span><span class="v">${oddsTxt(s.final)}</span></div>
      <div class="tile"><span class="k">SM-guld</span><span class="v">${oddsTxt(s.gold)}</span></div>
      <div class="tile"><span class="k">SHL-kval</span><span class="v">${oddsTxt(s.rel)}</span><span class="s">plats 13–14</span></div>
    </div></div>${tabs(`/lag/${code}`, tabList, tab)}</section>`;

  let body;
  if (tab === 'trupp') body = teamRoster(code, roster);
  else if (tab === 'schema') {
    const up = teamGames.filter((g) => !isFinal(g)), done = teamGames.filter(isFinal).reverse();
    body = board([
      panel(`Kommande matcher (${up.length})`, up.length ? gameList(up, { dated: true }) : '<p class="empty-state">Inga fler matcher i grundserien.</p>'),
      panel(`Spelade matcher (${done.length})`, done.length ? gameList(done, { dated: true }) : '<p class="empty-state">Inga spelade matcher ännu.</p>'),
    ]);
  } else if (tab === 'historik') body = teamHistory(code);
  else if (tab === 'form') body = teamForm(code, TD.logs[code] || []);
  else body = teamOverview(code, teamGames, TD.news[code] || []);
  render(hero + body);
}
function teamOverview(code, teamGames, news = []) {
  const s = SIM[code], T = D.teamStats[code] || {};
  const days = Object.keys(D.history).sort().filter((d) => D.history[d].t[code]);
  const hist = days.length >= 2
    ? `<div class="chart">${lineChart([
        { pts: days.map((d) => D.history[d].t[code][1] * 100), color: 'var(--accent)', area: true },
        { pts: days.map((d) => D.history[d].t[code][0] * 100), color: 'color-mix(in srgb, var(--accent) 50%, var(--text))' },
        { pts: days.map((d) => D.history[d].t[code][2] * 100), color: 'var(--gold)' },
      ], { yMax: 100, yFmt: (v) => Math.round(v) + '%', xLabels: days.map((d) => `${+d.slice(8)}/${+d.slice(5, 7)}`) })}</div>
      <div class="legend"><span><i style="background:var(--accent)"></i>Slutspel</span><span><i style="background:color-mix(in srgb, var(--accent) 50%, var(--text))"></i>Topp 6</span><span><i style="background:var(--gold)"></i>SM-guld</span></div>`
    : `<p class="empty-state">Historiken byggs upp efter hand. Varje ny matchdag lägger till en punkt${days.length ? `, första punkten sparades ${fmtDate(days[0])}` : ''}.</p>`;
  const rankDist = `<div class="chart">${(() => {
    const W = cw(560), H = 170, n = s.rank.length, bw = (W - 30) / n, mx = Math.max(...s.rank, 0.01);
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Slutplacering">${s.rank.map((p, i) => {
      const h = p / mx * (H - 44), x = 20 + i * bw, c = i < 6 ? 'var(--accent)' : i < 10 ? 'color-mix(in srgb, var(--accent) 50%, var(--faint))' : i >= n - 2 ? 'var(--bad)' : 'var(--faint)';
      return `<rect x="${x + 3}" y="${H - 22 - h}" width="${bw - 6}" height="${h}" rx="3" style="fill:${c}"><title>Plats ${i + 1}: ${pctTxt(p, 1)}</title></rect>
        <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="11" style="fill:var(--faint)">${i + 1}</text>
        ${p >= 0.02 ? `<text x="${x + bw / 2}" y="${H - 26 - h}" text-anchor="middle" font-size="10.5" style="fill:var(--muted)">${Math.round(p * 100)}</text>` : ''}`;
    }).join('')}</svg>`;
  })()}</div>`;
  const qf = Object.entries(s.qf || {});
  const qfHtml = qf.length ? hBars(qf.map(([c, p]) => ({ label: tName(c), code: c, v: p / Math.max(0.001, s.top10) })), { max: 1, labelW: 130, logos: true, fmt: (v) => pctTxt(v) })
    : '<p class="empty-state">Laget når slutspel i för få simuleringar för att visa en trolig motståndare.</p>';
  const ts = (c) => D.teamStats[c] || {};
  const leagueRank = (f, asc = false) => { const vals = CODES.map((c) => f(c)).filter((v) => v != null).sort((a, b) => asc ? a - b : b - a); const v = f(code); return v == null ? '' : `${vals.indexOf(v) + 1}:a i ligan`; };
  const ppP = (c) => ts(c).ppo ? ts(c).ppg / ts(c).ppo : null, pkP = (c) => ts(c).pko ? 1 - ts(c).ppga / ts(c).pko : null;
  const gfpg = (c) => { const x = TABLE.find((t) => t.code === c); return x?.gp ? x.gf / x.gp : null; }, gapg = (c) => { const x = TABLE.find((t) => t.code === c); return x?.gp ? x.ga / x.gp : null; };
  const stat = (k, v, rk) => `<div class="tile"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${rk}</span></div>`;
  const statTiles = `<div class="tiles">
    ${stat('Mål/match', dec(gfpg(code), 2), leagueRank(gfpg))}
    ${stat('Insläppta/match', dec(gapg(code), 2), leagueRank(gapg, true))}
    ${stat('Skott/match', T.gp ? dec(T.sog / T.gp, 1) : '–', leagueRank((c) => ts(c).gp ? ts(c).sog / ts(c).gp : null))}
    ${stat('Skott mot/match', T.gp ? dec(T.sa / T.gp, 1) : '–', leagueRank((c) => ts(c).gp ? ts(c).sa / ts(c).gp : null, true))}
    ${stat('Powerplay', pctTxt(ppP(code), 1), leagueRank(ppP))}
    ${stat('Boxplay', pctTxt(pkP(code), 1), leagueRank(pkP))}
    ${stat('Tekningar', T.fow + T.fol ? pctTxt(T.fow / (T.fow + T.fol), 1) : '–', leagueRank((c) => ts(c).fow + ts(c).fol ? ts(c).fow / (ts(c).fow + ts(c).fol) : null))}
    ${stat('Utv.min/match', T.gp ? dec(T.pim / T.gp, 1) : '–', leagueRank((c) => ts(c).gp ? ts(c).pim / ts(c).gp : null, true))}
  </div>`;
  const next = teamGames.filter((g) => !isFinal(g)).slice(0, 3), last = teamGames.filter(isFinal).slice(-3).reverse();
  const sk = skaters().filter((p) => p.team === code).sort((a, b) => b.pts - a.pts || b.g - a.g);
  const clips = (D.recentClips || []).filter((c) => c.team === code).slice(0, 4);
  // Top row: the points list on the left, upcoming games above the latest results on the right
  return board([
    `<div class="ov-row r-two wide">
      ${panel('Poängliga', leaderList(sk, { val: (p) => p.pts, n: 8 }), { more: moreLink(`#/lag/${code}/trupp`, 'Hela truppen') })}
      <div class="stack">
        ${panel('Kommande matcher', next.length ? gameList(next, { dated: true }) : '<p class="empty-state">Inga fler matcher.</p>', { more: moreLink(`#/lag/${code}/schema`, 'Hela schemat') })}
        ${panel('Senaste resultat', last.length ? gameList(last, { dated: true }) : '<p class="empty-state">Inga spelade matcher ännu.</p>')}
      </div>
    </div>`,
    teamNewsPanel(code, news),
    clips.length ? panel('Senaste målen', `<div class="clips">${clips.map((c) => clipCard(c, clipTitle(c), clipSub(c))).join('')}</div>`) : '',
    panel('Slutspelsodds över tid', hist),
    panel('Slutplacering', rankDist, { sub: 'Chans att sluta på varje placering efter grundserien.' }),
    panel('Säsongsstatistik', statTiles),
    panel('Trolig kvartsfinalmotståndare', `<div class="chart">${qfHtml}</div>`, { sub: 'Om laget når kvartsfinal: andel av simuleringarna mot varje lag.' }),
  ]);
}
// News about the team: the club's own site plus SHL articles that name the team; each opens at the source
function teamNewsCards(code, news) {
  return news.map((n) => {
    const u = safeUrl(n.url); if (!u) return '';
    return `<a class="tnews" href="${esc(u)}" target="_blank" rel="noopener">
      <span class="tn-img">${n.img ? `<img src="${esc(n.img)}" alt="" loading="lazy" onerror="this.remove()">` : tb(code, 'xl')}</span>
      <span class="tn-body"><span class="tn-meta">${esc(n.src)} · ${fmtDay(n.date)}</span><b>${esc(n.title)}</b><span class="tn-intro">${esc(n.intro)}</span></span></a>`;
  }).join('');
}
function teamNewsPanel(code, news) {
  const cards = teamNewsCards(code, news);
  if (!cards) return '';
  return panel(`Nyheter om ${esc(tName(code))}`, `<div class="tnews-row">${cards}</div>`, { cls: 'wide', sub: 'Från klubbens egen sajt och shl.se. Artiklarna öppnas hos källan.' });
}

// One column per game: a bar up (for) and a bar down (against), optional dots for the actual outcome
const RES_COLOR = { V: 'var(--accent)', 'ÖV': 'color-mix(in srgb, var(--accent) 55%, var(--faint))', 'ÖF': 'color-mix(in srgb, var(--bad) 45%, var(--faint))', F: 'var(--bad)' };
function mirrorChart(rows, { up, down, upDot, downDot, chip = false, fmt = (v) => v, tip }) {
  const n = rows.length, left = 34, right = 8, top = chip ? 30 : 12, bottom = 34, H = 220;
  const W = Math.max(cw(640), left + right + n * 24), step = (W - left - right) / n, bw = Math.max(6, Math.min(18, step - 6));
  const half = (H - top - bottom) / 2 - 4, mid = top + (H - top - bottom) / 2;
  const mx = Math.max(1, ...rows.flatMap((r) => [up(r), down(r), upDot ? upDot(r) : 0, downDot ? downDot(r) : 0]));
  const s = (v) => Math.max(0, v) / mx * half;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" style="min-width:${Math.min(W, left + right + n * 24)}px">
    <line x1="${left}" x2="${W - right}" y1="${mid}" y2="${mid}" style="stroke:var(--line)" stroke-width="1.5"/>
    <line x1="${left}" x2="${W - right}" y1="${mid - half}" y2="${mid - half}" style="stroke:var(--line)" stroke-dasharray="3 4"/>
    <line x1="${left}" x2="${W - right}" y1="${mid + half}" y2="${mid + half}" style="stroke:var(--line)" stroke-dasharray="3 4"/>
    <text x="${left - 6}" y="${mid - half + 4}" text-anchor="end" font-size="11" style="fill:var(--faint)">${fmt(mx)}</text>
    <text x="${left - 6}" y="${mid + half + 4}" text-anchor="end" font-size="11" style="fill:var(--faint)">${fmt(mx)}</text>`;
  rows.forEach((r, i) => {
    const x = left + i * step + step / 2, u = up(r), dn = down(r);
    svg += `<a href="#/match/${esc(r.id)}"><g class="mc-col"><rect x="${x - step / 2}" y="${top - (chip ? 26 : 0)}" width="${step}" height="${H - top - bottom + (chip ? 26 : 0) + 30}" style="fill:transparent"/>
      <rect x="${x - bw / 2}" y="${mid - s(u)}" width="${bw}" height="${s(u)}" rx="2" style="fill:${chip ? RES_COLOR[r.res] : 'var(--accent)'}"/>
      <rect x="${x - bw / 2}" y="${mid}" width="${bw}" height="${s(dn)}" rx="2" style="fill:${chip ? 'color-mix(in srgb, var(--text) 22%, transparent)' : 'color-mix(in srgb, var(--bad) 80%, transparent)'}"/>
      ${upDot ? `<circle cx="${x}" cy="${mid - s(upDot(r))}" r="3.4" style="fill:var(--text);stroke:var(--panel)" stroke-width="1.5"/>` : ''}
      ${downDot ? `<circle cx="${x}" cy="${mid + s(downDot(r))}" r="3.4" style="fill:var(--text);stroke:var(--panel)" stroke-width="1.5"/>` : ''}
      ${chip ? `<rect x="${x - Math.max(bw, 18) / 2 - 2}" y="${top - 26}" width="${Math.max(bw, 18) + 4}" height="17" rx="4" style="fill:${RES_COLOR[r.res]}"/><text x="${x}" y="${top - 13.5}" text-anchor="middle" font-size="9.5" font-weight="700" style="fill:var(--accent-ink)">${r.res}</text>` : ''}
      <text x="${x}" y="${H - 18}" text-anchor="middle" font-size="10" style="fill:var(--muted)">${esc(r.opp)}</text>
      <text x="${x}" y="${H - 5}" text-anchor="middle" font-size="9.5" style="fill:var(--faint)">${r.home ? 'H' : 'B'}</text>
      <title>${esc(tip(r))}</title></g></a>`;
  });
  return `<div class="mchart">${svg}</svg></div>`;
}

function teamForm(code, logs) {
  const rows = logs.map((r) => {
    const g = GAMES_BY_ID[r[0]]; if (!g) return null;
    const win = r[2] > r[3], ex = g.ot || g.so;
    return { g, id: r[0], home: !!r[1], opp: r[1] ? g.away : g.home, gf: r[2], ga: r[3], xgf: r[4], xga: r[5], ppg: r[6], ppo: r[7], ppga: r[8], pko: r[9],
      res: win ? (ex ? 'ÖV' : 'V') : (ex ? 'ÖF' : 'F'), pts: win ? (ex ? 2 : 3) : (ex ? 1 : 0) };
  }).filter(Boolean).sort((a, b) => a.g.start.localeCompare(b.g.start));
  if (!rows.length) return panel('Form & statistik', '<p class="empty-state">Statistiken visas efter lagets första match.</p>');

  const pct = (a, b) => b ? a / b : null;
  const agg = (list) => {
    const n = (k) => list.filter((r) => r.res === k).length, t = (k) => sum(list.map((r) => r[k] || 0));
    const xgf = sum(list.map((r) => r.xgf ?? 0)), xga = sum(list.map((r) => r.xga ?? 0));
    return { gp: list.length, V: n('V'), 'ÖV': n('ÖV'), 'ÖF': n('ÖF'), F: n('F'), gf: t('gf'), ga: t('ga'), pts: t('pts'),
      pp: pct(t('ppg'), t('ppo')), pk: t('pko') ? 1 - t('ppga') / t('pko') : null, xgp: xgf + xga ? xgf / (xgf + xga) : null, xgf, xga };
  };
  const all = agg(rows), home = agg(rows.filter((r) => r.home)), away = agg(rows.filter((r) => !r.home)), last5 = agg(rows.slice(-5));
  // Current streak
  const lastWin = rows[rows.length - 1].pts >= 2;
  let streak = 0; for (let i = rows.length - 1; i >= 0 && (rows[i].pts >= 2) === lastWin; i--) streak++;
  const t = (k, v, sub) => `<div class="tile"><span class="k">${k}</span><span class="v">${v}</span>${sub ? `<span class="s">${sub}</span>` : ''}</div>`;
  const tiles = `<div class="tiles">
    ${t('Senaste 5', `${last5.pts} p`, rows.slice(-5).map((r) => r.res).join(' '))}
    ${t('Svit', `${streak} ${lastWin ? (streak === 1 ? 'vinst' : 'vinster') : (streak === 1 ? 'förlust' : 'förluster')}`, 'i rad')}
    ${t('Poäng/match hemma', home.gp ? dec(home.pts / home.gp, 2) : '–', `${home.gp} matcher`)}
    ${t('Poäng/match borta', away.gp ? dec(away.pts / away.gp, 2) : '–', `${away.gp} matcher`)}
    ${t('xG-andel', all.xgp != null ? pctTxt(all.xgp, 1) : '–', 'av matchernas chanser')}
    ${t('Mål över xG', all.xgp != null ? (all.gf - all.xgf > 0 ? '+' : '') + dec(all.gf - all.xgf, 1) : '–', 'avslutsskärpa')}
  </div>`;

  const resChart = mirrorChart(rows, { up: (r) => r.gf, down: (r) => r.ga, chip: true,
    tip: (r) => `${r.res} ${r.gf}–${r.ga} ${r.home ? 'hemma mot' : 'borta mot'} ${tName(r.opp)}, ${fmtDay(r.g.start)}` });
  const hasXg = rows.some((r) => r.xgf != null);
  const xgChart = hasXg ? mirrorChart(rows, { up: (r) => r.xgf ?? 0, down: (r) => r.xga ?? 0, upDot: (r) => r.gf, downDot: (r) => r.ga, fmt: (v) => dec(v, 1),
    tip: (r) => `xG ${dec(r.xgf ?? 0, 2)}–${dec(r.xga ?? 0, 2)}, mål ${r.gf}–${r.ga} mot ${tName(r.opp)}` }) : '';

  const splitRow = (label, a) => `<tr><td class="l"><b>${label}</b></td><td>${a.gp}</td><td>${a.V}</td><td>${a['ÖV']}</td><td>${a['ÖF']}</td><td>${a.F}</td><td>${a.gf}–${a.ga}</td><td class="hl">${a.pts}</td><td>${a.gp ? dec(a.pts / a.gp, 2) : '–'}</td><td>${a.pp != null ? pctTxt(a.pp, 1) : '–'}</td><td>${a.pk != null ? pctTxt(a.pk, 1) : '–'}</td><td>${a.xgp != null ? pctTxt(a.xgp, 1) : '–'}</td></tr>`;
  const splits = `<div class="tscroll"><table class="t"><thead><tr><th class="l"></th><th>SM</th><th>V</th><th>ÖV</th><th>ÖF</th><th>F</th><th>Mål</th><th>P</th><th>P/M</th><th title="Powerplay">PP%</th><th title="Boxplay">BP%</th><th title="Andel av matchernas xG">xG%</th></tr></thead>
    <tbody>${splitRow('Hemma', home)}${splitRow('Borta', away)}${splitRow('Totalt', all)}</tbody></table></div>`;

  let a = 0, b = 0, c = 0, e = 0;
  const pp = rows.map((r) => { a += r.ppg; b += r.ppo; return b ? a / b * 100 : 0; });
  const pk = rows.map((r) => { c += r.ppga; e += r.pko; return e ? (1 - c / e) * 100 : 100; });
  const special = rows.length >= 2 ? `<div class="chart">${lineChart([{ pts: pk, color: 'var(--gold)' }, { pts: pp, color: 'var(--accent)' }], { yMax: 100, yFmt: (v) => Math.round(v) + '%', xLabels: rows.map((r) => r.opp) })}</div>
    <div class="legend"><span><i style="background:var(--accent)"></i>Powerplay</span><span><i style="background:var(--gold)"></i>Boxplay</span><span>Hittills under säsongen, efter varje match</span></div>`
    : '<p class="empty-state">Kurvan visas efter två matcher.</p>';

  return board([
    panel('Formen just nu', tiles, { cls: 'wide' }),
    panel('Resultat match för match', resChart + `<div class="legend"><span><i style="background:${RES_COLOR.V}"></i>Vinst</span><span><i style="background:${RES_COLOR['ÖV']}"></i>Vinst ÖT/str</span><span><i style="background:${RES_COLOR['ÖF']}"></i>Förlust ÖT/str</span><span><i style="background:${RES_COLOR.F}"></i>Förlust</span><span>Upp = gjorda mål, ner = insläppta</span></div>`, { cls: 'wide', sub: 'Tryck på en match för matchfakta. H = hemma, B = borta.' }),
    xgChart ? panel('xG match för match', xgChart + '<div class="legend"><span><i style="background:var(--accent)"></i>xG för</span><span><i style="background:var(--bad)"></i>xG mot</span><span><i style="background:var(--text);border-radius:50%"></i>Faktiska mål</span></div>', { cls: 'wide', sub: 'Förväntade mål utifrån chansernas kvalitet, jämfört med hur många mål det faktiskt blev.' }) : '',
    panel('Hemma och borta', splits),
    panel('Powerplay och boxplay', special),
  ]);
}

function teamRoster(code, roster) {
  const skStats = new Map(skaters().map((p) => [p.id, p])), gkStats = new Map(goalies().map((p) => [p.id, p]));
  const rows = roster.map((p) => ({ ...p, st: p.pos === 'GK' ? gkStats.get(p.id) : skStats.get(p.id) }));
  const grp = (pos, title) => {
    const list = rows.filter((p) => pos === 'GK' ? p.pos === 'GK' : pos === 'D' ? p.pos === 'D' : !['GK', 'D'].includes(p.pos));
    if (!list.length) return '';
    return panel(`${title} (${list.length})`, `<div class="tscroll"><table class="t stick"><thead><tr><th class="l">Spelare</th>${pos === 'GK'
      ? '<th>SM</th><th>Rädd%</th><th>GAA</th><th>Nollor</th>' : '<th>SM</th><th>M</th><th>A</th><th>P</th><th>+/-</th><th>Istid</th>'}</tr></thead><tbody>${list.sort((a, b) => (b.st?.pts ?? b.st?.gpi ?? -1) - (a.st?.pts ?? a.st?.gpi ?? -1)).map((p) =>
      `<tr><td class="l">${playerCell(p, code, `#${p.num ?? '–'} · ${esc(NAT[p.nat] || p.nat || '')}`)}</td>${pos === 'GK'
        ? `<td>${p.st?.gpi ?? 0}</td><td class="hl">${p.st ? dec(p.st.svp, 2) : '–'}</td><td>${p.st ? dec(p.st.gaa, 2) : '–'}</td><td>${p.st?.so ?? 0}</td>`
        : `<td>${p.st?.gp ?? 0}</td><td>${p.st?.g ?? 0}</td><td>${p.st?.a ?? 0}</td><td class="hl">${p.st?.pts ?? 0}</td><td>${p.st ? signed(p.st.pm) : '–'}</td><td>${p.st ? mmss(p.st.toi) : '–'}</td>`}</tr>`).join('')}</tbody></table></div>`);
  };
  if (!roster.length) return panel('Trupp', '<p class="empty-state">Truppen kunde inte hämtas.</p>');
  return board([panel('Projicerad uppställning', lineupHtml(code), { cls: 'wide' }), grp('F', 'Forwards'), grp('D', 'Backar'), grp('GK', 'Målvakter')]);
}
function teamHistory(code) {
  const seasons = [...D.seasonOrder].reverse();
  const past = seasons.map((lab) => ({ lab, row: (D.pastStandings[lab] || []).find((x) => x.code === code) }));
  const W = cw(560), H = 210, n = past.length, bw = (W - 40) / n, mx = Math.max(1, ...past.map((p) => p.row?.pts || 0));
  const chart = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Poäng per säsong">${past.map((p, i) => {
    const v = p.row?.pts || 0, h = v / mx * (H - 64), x = 20 + i * bw, curS = p.lab === CUR;
    return `<rect x="${x + 8}" y="${H - 38 - h}" width="${bw - 16}" height="${h}" rx="4" style="fill:${curS ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 45%, var(--faint))'}"><title>${p.lab}: ${v} poäng${p.row ? `, plats ${p.row.rank}` : ''}</title></rect>
      <text x="${x + bw / 2}" y="${H - 42 - h}" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--text)">${p.row ? v : '–'}</text>
      <text x="${x + bw / 2}" y="${H - 20}" text-anchor="middle" font-size="12" style="fill:var(--muted)">${p.lab}${curS && !isNarrow() ? ' (hittills)' : ''}</text>
      <text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle" font-size="11" style="fill:var(--faint)">${p.row ? `plats ${p.row.rank}` : 'ej i SHL'}</text>`;
  }).join('')}</svg>`;
  const table = `<div class="tscroll"><table class="t"><thead><tr><th class="l">Säsong</th><th>Plats</th><th>SM</th><th>V</th><th>ÖV</th><th>ÖF</th><th>F</th><th>GM–IM</th><th>P</th></tr></thead><tbody>${past.slice().reverse().map((p) => p.row
    ? `<tr><td class="l">${p.lab}${p.lab === CUR ? ' <span class="faint">(pågår)</span>' : ''}</td><td class="hl">${p.row.rank}</td><td>${p.row.gp}</td><td>${p.row.w}</td><td>${p.row.otw}</td><td>${p.row.otl}</td><td>${p.row.l}</td><td>${p.row.gf}–${p.row.ga}</td><td class="hl">${p.row.pts}</td></tr>`
    : `<tr><td class="l">${p.lab}</td><td colspan="8" class="l faint">Spelade inte i SHL</td></tr>`).join('')}</tbody></table></div>`;
  // Record against each opponent this season and last
  const vs = {};
  const add = (opp, won) => { const v = (vs[opp] ??= { w: 0, l: 0 }); won ? v.w++ : v.l++; };
  for (const g of GAMES.filter(isFinal)) if (g.home === code || g.away === code) add(g.home === code ? g.away : g.home, (g.home === code ? g.hs : g.as) > (g.home === code ? g.as : g.hs));
  for (const x of D.pastGames.filter((x) => x[0] === PREV && (x[2] === code || x[3] === code))) add(x[2] === code ? x[3] : x[2], (x[2] === code ? x[4] : x[5]) > (x[2] === code ? x[5] : x[4]));
  const vsRows = Object.entries(vs).sort((a, b) => (b[1].w - b[1].l) - (a[1].w - a[1].l));
  const vsHtml = vsRows.length ? `<div class="tscroll"><table class="t"><thead><tr><th class="l">Motstånd</th><th>V</th><th>F</th></tr></thead><tbody>${vsRows.map(([c, v]) =>
    `<tr><td class="l">${teamLink(c, { name: true })}</td><td class="${v.w > v.l ? 'hl' : ''}">${v.w}</td><td>${v.l}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-state">Inga matcher.</p>';
  return board([
    panel('Poäng per säsong', `<div class="chart">${chart}</div>`),
    panel('Tidigare säsonger', table),
    panel(`Mot varje lag, ${PREV} och ${CUR}`, vsHtml),
  ]);
}

function notFound(msg) {
  setTitle('Hittades inte');
  render(panel('Hittades inte', `<p>${esc(msg)}</p><p><a href="#/">Till startsidan</a></p>`));
}

/* =====================================================================
   Phone layout: Hem, Matcher one day at a time, Media and the settings sheet.
   Below the phone breakpoint these replace the desktop overview and games pages.
   ===================================================================== */
const DAYS_LONG = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
const shortName = (n) => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : String(n || ''); };
const gameDays = () => [...new Set(GAMES.map((g) => g.start.slice(0, 10)))].sort();
const dayLabel = (d) => { const diff = Math.round((Date.parse(d) - Date.parse(todayStr())) / 864e5); return diff === 0 ? 'Idag' : diff === -1 ? 'Igår' : diff === 1 ? 'I morgon' : null; };
// The day Matcher opens on: today if there are games, otherwise the next game day (or the last one after the season)
const defaultDay = () => { const days = gameDays(), t = todayStr(); return days.includes(t) ? t : days.find((d) => d > t) || days[days.length - 1]; };
const isFavGame = (g) => !!FAV && (g.home === FAV || g.away === FAV);
const PLAY_SVG = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
// "See more" links at the bottom of a card, the same everywhere
const cardFoot = (href, label) => `<a class="card-foot" href="${href}">${label} ›</a>`;
let DAY_SHOWN = null;

// Goals and live state for the finished and live games in a list
async function detailsFor(games) {
  const out = {};
  await Promise.all(games.filter(Boolean).map(async (g) => {
    if (!isFinal(g) && !isLive(g)) return;
    let d = await loadGame(g.id);
    if (isLive(g) && LIVE_API) {
      const L = await loadLive(g.id);
      if (L) { d = liveDetails(g, L, d); g.hs = L.hs; g.as = L.as; }
    }
    out[g.id] = d;
  }));
  return out;
}

// One game as a card: a status chip, a row per team (score, or win chance before the game), then the goals
// as a sideways row (tap one to watch it) or each team's top scorers. Tapping the card opens the match page.
function gameCard(g, d) {
  const done = isFinal(g), live = isLive(g), fav = isFavGame(g), ph = g.ph ?? 0.5;
  const chip = done ? `<span class="gc-chip">${esc(statusTxt(g))}</span>`
    : live ? `<span class="gc-chip live"><i class="live-dot"></i>${esc(liveClock(d?.live))}</span>`
    : `<span class="gc-chip">${fmtTime(g.start)}</span>`;
  const row = (c, s) => {
    const r = TABLE.find((t) => t.code === c), score = s === 'home' ? g.hs : g.as, other = s === 'home' ? g.as : g.hs;
    const right = done || live ? `<span class="gc-num num">${score ?? 0}</span>` : `<span class="gc-pct num" title="Vinstchans">${pctTxt(s === 'home' ? ph : 1 - ph)}</span>`;
    return `<div class="gc-row ${done && score < other ? 'lose' : ''}">${tb(c, 'md')}
      <div class="gc-nm"><b>${esc(tName(c))}</b>${r ? `<span class="gc-meta"><span class="gc-rank">${TABLE.indexOf(r) + 1}</span>${r.pts} p<i>·</i>${r.gp} SM</span>` : ''}</div>${right}</div>`;
  };
  let mid = '';
  if (done || live) {
    const goals = d?.goals || [];
    const chipOf = (x) => {
      const c = x.clip && safeEmbed(x.clip.embed) ? x.clip : null, tag = strengthTag(x);
      const when = x.p >= 5 ? 'Straff' : x.p === 4 ? `ÖT ${x.t}` : `P${x.p} ${x.t}`;
      const inner = `${avatar(x.scorer?.id, x.scorer?.name || '?', g[x.team]).replace(' loading="lazy"', '')}<span class="gch-who"><b>${esc(shortName(x.scorer?.name) || 'Mål')}</b><small>${esc(g[x.team])} ${x.score[0]}–${x.score[1]} · ${esc(when)}${tag ? ` · ${esc(tag)}` : ''}</small></span>${c ? `<span class="gch-play">${PLAY_SVG}</span>` : ''}`;
      return c ? `<button class="gchip" data-embed="${esc(c.embed)}" data-title="${esc(`${x.scorer?.name || 'Mål'} ${x.score[0]}–${x.score[1]}`)}">${inner}</button>` : `<div class="gchip">${inner}</div>`;
    };
    mid = goals.length ? `<div class="gc-goals">${goals.map(chipOf).join('')}</div>`
      : (g.hs || g.as) ? '<p class="gc-note">Målskyttarna visas efter nästa uppdatering.</p>' : live ? '<p class="gc-note">Inga mål ännu.</p>' : '';
  } else {
    const top = (c) => skaters().filter((p) => p.team === c).sort((a, b) => b.pts - a.pts || b.g - a.g).slice(0, 2);
    mid = `<div class="gc-tops"><span class="gc-lbl">Poängbäst</span>${[g.home, g.away].map((c) => `<div>${tb(c)}<span>${top(c).map((p) => `${esc(shortName(p.name))} <b class="num">${p.pts}</b>`).join('<i>·</i>') || 'Inga poäng än'}</span></div>`).join('')}</div>`;
  }
  const hl = done && d?.hl && safeEmbed(d.hl.embed) ? d.hl : null;
  const left = hl ? `<button class="gc-btn" data-embed="${esc(hl.embed)}" data-title="${esc(`${g.home}–${g.away} sammandrag`)}">${PLAY_SVG}Sammandrag</button>`
    : !done && !live && g.arena ? `<span class="gc-arena">${esc(g.arena)}</span>` : '<span></span>';
  return `<article class="gcard ${fav ? 'fav' : ''} ${live ? 'is-live' : ''}" data-href="#/match/${esc(g.id)}" tabindex="0" role="link" aria-label="${esc(`${tName(g.home)} mot ${tName(g.away)}`)}">
    <div class="gc-head">${chip}${fav ? '<span class="gc-mine">★ Mitt lag</span>' : ''}</div>
    ${row(g.home, 'home')}${row(g.away, 'away')}${mid}
    <div class="gc-foot">${left}<span class="card-foot">Matchfakta ›</span></div></article>`;
}
// Cards open their page when tapped anywhere except on a button or link inside them
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-href]');
  if (c && !e.target.closest('button, a')) location.hash = c.dataset.href;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches?.('[data-href]')) location.hash = e.target.dataset.href;
});

// Matcher on phones: one game day per page with the dates as tabs along the top, the followed team's game first
async function pageDay(want) {
  setTitle('Matcher');
  const days = gameDays();
  if (!days.length) return render(panel('Matcher', '<p class="empty-state">Inget spelschema ännu.</p>'));
  let day = /^\d{4}-\d{2}-\d{2}$/.test(want) ? want : defaultDay();
  if (!days.includes(day)) day = days.find((d) => d >= day) || days[days.length - 1];
  DAY_SHOWN = day;
  const i = days.indexOf(day), prev = days[i - 1], next = days[i + 1], home = defaultDay();
  const games = GAMES.filter((g) => g.start.startsWith(day)).sort((a, b) => isFavGame(b) - isFavGame(a) || a.start.localeCompare(b.start));
  if (games.some((g) => (isFinal(g) || isLive(g)) && !(g.id in gameCache))) app.innerHTML = skeleton();
  const det = await detailsFor(games);
  if (DAY_SHOWN !== day) return; // moved on to another day while loading
  const tabsHtml = days.map((dd) => {
    const p = dateParts(dd), l = dayLabel(dd);
    return `<a href="#/matcher/${dd}" class="${dd === day ? 'on' : ''}" ${dd === day ? 'aria-current="page"' : ''}><b>${l || DAYS[p.wd]}</b><span>${p.d} ${MONTHS[p.m - 1]}</span></a>`;
  }).join('');
  render(`<nav class="datetabs" id="datetabs" aria-label="Matchdagar">${tabsHtml}</nav>
    <div class="daylist" id="daylist">${games.map((g) => gameCard(g, det[g.id])).join('')}</div>
    ${day !== home ? `<a class="today-pill" href="#/matcher/${home}">${dayLabel(home) === 'Idag' ? 'Idag' : 'Nästa matchdag'}</a>` : ''}`);
  // Centre the chosen day in the date row
  const tabs = $('datetabs'), on = tabs.querySelector('.on');
  if (on) tabs.scrollLeft = on.offsetLeft - (tabs.clientWidth - on.offsetWidth) / 2;
  // Swipe sideways on the games to change day
  let x0 = null, y0 = null;
  const list = $('daylist');
  list.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  list.addEventListener('touchend', (e) => {
    if (x0 == null || e.target.closest('.gc-goals')) { x0 = null; return; }
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) { const to = dx < 0 ? next : prev; if (to) location.hash = `#/matcher/${to}`; }
  });
}

// Hem on phones: the news, then your team, or the league in general when no team is followed
async function pageHome() {
  setTitle('');
  const fav = FAV && SIM[FAV] ? FAV : null;
  const sec = (title, sub = '') => `<div class="m-sec"><h2>${title}${sub ? ` <small>${sub}</small>` : ''}</h2></div>`;
  const card = (inner, foot = '') => `<section class="panel m-card"><div class="p-body">${inner}</div>${foot}</section>`;
  let body = '';
  if (fav) {
    const r = TABLE.find((t) => t.code === fav), s = SIM[fav];
    const next = GAMES.find((x) => !isFinal(x) && isFavGame(x)), last = [...GAMES].reverse().find((x) => isFinal(x) && isFavGame(x));
    const det = await detailsFor([next, last]);
    let TD = null; try { TD = await loadTeams(); } catch { /* the page works without team news */ }
    const sk = skaters().filter((p) => p.team === fav).sort((a, b) => b.pts - a.pts || b.g - a.g);
    body = `<section class="panel m-card myteam-m" style="--tc:${tColor(fav)}"><div class="p-body">
        <a class="mt-head" href="#/lag/${fav}">${tb(fav, 'xl')}<span class="mt-name"><b>${esc(tName(fav))}</b><span class="gc-meta"><span class="gc-rank">${TABLE.indexOf(r) + 1}</span>${r.pts} p<i>·</i>${r.gp} SM<i>·</i>${r.gf}–${r.ga}</span></span></a>
        <div class="mt-form">${formChips(fav)}</div>
        <div class="mt-stats"><div><b>${oddsTxt(s.top10)}</b><span>Slutspel</span></div><div><b>${oddsTxt(s.top6)}</b><span>Topp 6</span></div><div><b>${oddsTxt(s.gold)}</b><span>SM-guld</span></div><div><b>${dec(s.proj, 0)}</b><span>Proj. poäng</span></div></div>
      </div>${cardFoot(`#/lag/${fav}`, 'Lagsidan')}</section>
      ${next ? sec(isLive(next) ? 'Pågår nu' : 'Nästa match', fmtDay(next.start)) + gameCard(next, det[next.id]) : ''}
      ${last ? sec('Senaste match', fmtDay(last.start)) + gameCard(last, det[last.id]) : ''}
      ${sec('Poängliga')}
      ${card(leaderList(sk, { val: (p) => p.pts, n: 5, avatars: false, sub: (p) => `${p.g} mål, ${p.a} assist` }), cardFoot(`#/lag/${fav}/trupp`, 'Hela truppen'))}
      ${(TD?.news?.[fav] || []).length ? sec(`Nyheter om ${esc(tName(fav))}`) + `<div class="tnews-row">${teamNewsCards(fav, TD.news[fav])}</div>` : ''}`;
  } else {
    const gday = defaultDay(), games = GAMES.filter((g) => g.start.startsWith(gday)).sort((a, b) => a.start.localeCompare(b.start));
    const det = await detailsFor(games);
    const lead = [...skaters()].sort((a, b) => b.pts - a.pts || b.g - a.g);
    body = `${games.length ? sec(dayLabel(gday) === 'Idag' ? 'Matcher idag' : 'Nästa matchdag', fmtDay(gday)) + games.slice(0, 3).map((g) => gameCard(g, det[g.id])).join('')
        + (games.length > 3 ? `<a class="list-foot" href="#/matcher/${gday}">Alla ${games.length} matcher ›</a>` : '') : ''}
      ${sec('Tabell')}
      ${card(standingsTable({ mode: 'stats' }), cardFoot('#/tabell', 'Hela tabellen'))}
      ${sec('Poängliga')}
      ${card(leaderList(lead, { val: (p) => p.pts, n: 5, avatars: false, sub: (p) => `${esc(p.team)} · ${p.g} mål, ${p.a} assist` }), cardFoot('#/statistik', 'All statistik'))}`;
  }
  render(`<section class="panel mnews">${newsBox()}</section>${body}`);
  setupNewsCarousel();
}

// Media on phones: only video. The best goals, the goals from the hardest chances, highlights packages and every goal
let MEDIA = null;
const loadMedia = async () => MEDIA ??= await (await fetch(dataUrl('media.json'))).json();
async function pageMedia(range = '') {
  setTitle('Media');
  if (!MEDIA) app.innerHTML = skeleton();
  let M;
  try { M = await loadMedia(); } catch { return render(panel('Media', '<p class="empty-state">Videorna kunde inte laddas. Försök igen om en stund.</p>')); }
  range = range === 'dag' ? 'dag' : range === 'lag' && FAV ? 'lag' : 'vecka';
  const latest = [...(M.clips || []).map((c) => c.date), ...(M.highlights || []).map((h) => h.date)].sort().pop() || todayStr();
  const lastDay = latest.slice(0, 10), since = new Date(Date.parse(lastDay) - 6 * 864e5).toISOString().slice(0, 10);
  const keep = range === 'dag' ? (date) => date.startsWith(lastDay) : range === 'vecka' ? (date) => date.slice(0, 10) >= since : () => true;
  const mine = (a, b) => range !== 'lag' || a === FAV || b === FAV;
  const clips = (M.clips || []).filter((c) => keep(c.date) && mine(c.team, c.opp));
  const hls = (M.highlights || []).filter((h) => keep(h.date) && mine(h.home, h.away)).slice(0, 12);
  // Dream goals: the lowest chance of scoring (xG). Best goals: big moments first (winners, overtime, shorthanded), then difficulty.
  const real = clips.filter((c) => c.xg != null && !c.en);
  const dream = [...real].sort((a, b) => a.xg - b.xg).slice(0, 5), dreamIds = new Set(dream.map((c) => c.id));
  const weight = (c) => (c.gwg ? 2 : 0) + (c.p === 4 ? 2 : 0) + (/^(SH|BP)/.test(c.str || '') ? 1 : 0) + (1 - c.xg) * 1.5;
  const best = real.filter((c) => !dreamIds.has(c.id)).sort((a, b) => weight(b) - weight(a)).slice(0, 10);
  const who = (c) => esc(c.scorer?.name || 'Mål');
  const tag = (c) => [c.p === 4 ? 'Avgjorde i ÖT' : c.gwg ? 'Matchvinnare' : '', /^(SH|BP)/.test(c.str || '') ? 'Boxplay' : ''].filter(Boolean).join(' · ');
  const bestTitle = range === 'dag' ? 'Dagens bästa mål' : range === 'lag' ? `${esc(tName(FAV))}s bästa mål` : 'Veckans bästa mål';
  const tabs = [['dag', 'Matchdagen'], ['vecka', 'Veckan'], ...(FAV ? [['lag', `${tb(FAV)}${esc(FAV)}`]] : [])];
  render(`<div class="seg media-tabs" id="media-range">${tabs.map(([k, l]) => `<button data-r="${k}" aria-pressed="${range === k}">${l}</button>`).join('')}</div>
    ${best.length ? `<div class="m-sec"><h2>${bestTitle}</h2><p>Matchvinnare, övertidsmål och svåra lägen först.</p></div>
      <div class="clips mclips hrow ranked">${best.map((c, i) => clipCard(c, `<span class="rank-n">${i + 1}</span>${who(c)}`, [`${esc(c.team)} mot ${esc(c.opp)}`, tag(c)].filter(Boolean).join(' · '))).join('')}</div>` : ''}
    ${dream.length ? `<div class="m-sec"><h2>Drömmål</h2><p>Målen från de svåraste lägena, enligt xG.</p></div>
      <div class="clips mclips hrow">${dream.map((c) => clipCard(c, who(c), `${esc(c.team)} mot ${esc(c.opp)} · ${dec(c.xg * 100, c.xg < 0.1 ? 1 : 0)} % chans`)).join('')}</div>` : ''}
    ${hls.length ? `<div class="m-sec"><h2>Matchsammandrag</h2></div><div class="clips mclips hrow">${hls.map((h) => clipCard(h, `${esc(h.home)} ${h.hs}–${h.as} ${esc(h.away)}`, fmtDay(h.date))).join('')}</div>` : ''}
    <div class="m-sec"><h2>Alla mål <small>${clips.length}</small></h2></div>
    ${clips.length ? `<div class="clips mclips grid2">${clips.map((c) => clipCard(c, who(c), `${esc(c.team)} mot ${esc(c.opp)} · ${c.score[0]}–${c.score[1]}`)).join('')}</div>` : '<p class="empty-state">Inga målvideor här ännu. De brukar komma någon timme efter slutsignalen.</p>'}`);
  $('media-range').onclick = (e) => { const b = e.target.closest('button'); if (b) location.hash = b.dataset.r === 'vecka' ? '#/media' : `#/media/${b.dataset.r}`; };
}

// Settings (phones, from the gear on Hem): theme, your team, and about the site
function applyTheme(v) {
  const root = document.documentElement;
  if (v === 'auto') { delete root.dataset.theme; store.set('shlstats-theme', 'auto'); }
  else { root.dataset.theme = v; store.set('shlstats-theme', v); }
  const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  for (const t of ['dark', 'light']) $('theme-' + t)?.setAttribute('aria-pressed', t === cur);
  route();
}
function openSettings() {
  const dlg = $('settings');
  const draw = () => {
    const theme = document.documentElement.dataset.theme || 'auto';
    dlg.innerHTML = `<div class="sheet-in"><div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><h2>Inställningar</h2><button class="sheet-close" data-close>Klar</button></div>
      <h3>Tema</h3>
      <div class="seg sheet-seg" id="set-theme">${[['dark', 'Mörkt'], ['light', 'Ljust'], ['auto', 'Automatiskt']].map(([v, l]) => `<button data-v="${v}" aria-pressed="${theme === v}">${l}</button>`).join('')}</div>
      <h3>Mitt lag</h3>
      <div class="set-teams">${[...CODES].sort((a, b) => tName(a).localeCompare(tName(b), 'sv')).map((c) => `<button data-team="${c}" aria-pressed="${FAV === c}">${tb(c, 'md')}<span>${esc(tName(c))}</span></button>`).join('')}
        <button data-team="" aria-pressed="${!FAV}"><span class="set-none">–</span><span>Inget lag</span></button></div>
      <h3>Om SHLstats</h3>
      <div class="set-about"><p>Uppdaterad ${esc(stampTxt)}.</p><button class="sheet-btn" id="set-reload">Hämta senaste</button>
        <p>SHLstats är ett fristående fanprojekt utan koppling till SHL. Resultat, statistik, bilder och videor från shl.se. Prognoserna bygger på en egen modell och är inga garantier.</p></div></div>`;
  };
  draw();
  dlg.onclick = (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) { dlg.close(); return; }
    if (e.target.closest('#set-reload')) { location.reload(); return; }
    const t = e.target.closest('#set-theme button');
    if (t) { applyTheme(t.dataset.v); draw(); return; }
    const b = e.target.closest('[data-team]');
    if (b) { setFav(b.dataset.team || null); draw(); }
  };
  dlg.showModal();
}

// Two-team toggle (line-ups and player stats on phones): shows one team's pane at a time
const teamToggle = (home, away) => `<div class="seg tt-seg">${[['home', home], ['away', away]].map(([s, c], i) => `<button data-tt="${s}" aria-pressed="${i === 0}">${tb(c)}${esc(tName(c))}</button>`).join('')}</div>`;
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tt]'); if (!b) return;
  const box = b.closest('.tt');
  box.querySelectorAll('[data-tt]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  box.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.tt; });
});

// Two team colours that can be told apart: if they are too alike, the away side switches to its second colour or a neutral steel
const colorDist = (a, b) => { const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b), rm = (r1 + r2) / 2; return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2); };
function pairColors(h, a) {
  const hc = tColor(h); let ac = tColor(a);
  if (colorDist(hc, ac) < 170) {
    const alt = (TC[a] || [])[1];
    ac = alt && colorDist(hc, alt) >= 170 && lum(alt) > 0.03 && lum(alt) < 0.85 ? alt : colorDist(hc, '#8fa3b8') >= 170 ? '#8fa3b8' : '#e3b75a';
  }
  return [hc, ac];
}

/* =====================================================================
   Router and boot
   ===================================================================== */
const ROUTES = [
  [/^\/?$/, pageOverview], [/^\/matcher(?:\/([^/]+))?$/, pageGames], [/^\/match\/([^/]+)(?:\/([^/]+))?$/, pageMatch], [/^\/tabell(?:\/([^/]+))?$/, pageTable],
  [/^\/statistik$/, pageStats], [/^\/spelare\/([^/]+)(?:\/([^/]+))?$/, pagePlayer], [/^\/nexus$/, pageEdge], [/^\/avancerat$/, pageEdge], // old address still works
  [/^\/nyheter\/([^/]+)$/, pageNews], [/^\/media(?:\/([^/]+))?$/, pageMedia],
  [/^\/lag$/, () => pageTable('')], // old link to the teams page, now the Tabell page
  [/^\/lag\/([^/]+)(?:\/([^/]+))?$/, pageTeam],
];
const NAV_OF = { match: 'matcher', spelare: 'statistik', lag: 'tabell', avancerat: 'nexus' };
let lastPath = '';
async function route() {
  const path = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  const seg = path.split('/')[1] || '';
  document.querySelectorAll('nav.main a, .bottom-nav a').forEach((a) => {
    const on = a.dataset.nav === (NAV_OF[seg] ?? seg);
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.body.classList.remove('search-open');
  document.body.classList.toggle('is-home', path === '/'); // the settings button shows on Hem (phones)
  const TITLES = { matcher: 'Matcher', statistik: 'Statistik', tabell: 'Tabell', media: 'Media', match: 'Match', spelare: 'Spelare', lag: 'Lag', nyheter: 'Nyheter', nexus: 'Nexus', avancerat: 'Nexus' };
  mTitle(TITLES[seg] || '');
  document.body.classList.toggle('is-sub', ['match', 'spelare', 'lag', 'nyheter'].includes(seg));
  clearInterval(newsTimer); // the news carousel only runs on the overview
  // Switching tabs within the same page keeps the scroll position near the tabs
  const samePage = lastPath && path.split('/').slice(0, 3).join('/') === lastPath.split('/').slice(0, 3).join('/');
  const keepY = samePage ? window.scrollY : 0;
  lastPath = path;
  // Team pages set their own accent colour; every other page uses the site's
  app.style.removeProperty('--accent'); app.style.removeProperty('--accent-ink');
  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (m) {
      try { await fn(...m.slice(1).map((x) => x ?? '')); } catch (e) { console.error(e); render(panel('Något gick fel', `<p>Sidan kunde inte visas. Ladda om sidan och försök igen.</p><p class="faint">${esc(e.message)}</p>`)); }
      window.scrollTo(0, keepY);
      return;
    }
  }
  notFound('Sidan finns inte.');
}

async function boot() {
  try {
    D = await (await fetch(dataUrl('core.json'))).json();
  } catch (e) {
    app.innerHTML = panel('Kunde inte ladda data', '<p>SHL-datan kunde inte hämtas. Ladda om sidan om en stund.</p>');
    return;
  }
  CUR = D.cur; PREV = D.prev; TEAMS = D.teams; HS = D.headshots || {}; CODES = D.currentTeams;
  LOGOS = Object.fromEntries(Object.entries(TEAMS).filter(([, t]) => t.logo).map(([c, t]) => [c, t.logo]));
  GAMES = D.games; GAMES_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));
  TABLE = D.standings; SIM = D.sim; MODEL = D.model;
  if (FAV && !CODES.includes(FAV)) FAV = null;
  stampTxt = new Date(D.updated).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Stockholm' });
  $('foot').innerHTML = `<p style="margin:0 0 8px">Uppdaterad ${esc(stampTxt)}. <button class="linkbtn" id="reload-data">Hämta senaste</button></p>
    SHLstats är ett fristående fanprojekt utan koppling till SHL. Resultat, statistik, bilder och videor från shl.se. Prognoserna bygger på en egen modell och är inga garantier.`;
  $('reload-data').onclick = () => location.reload();
  buildCards();
  // Menu icons (top menu on desktop, bottom bar on phones)
  const NAV_ICON = { '': 'home', statistik: 'chart', tabell: 'table', matcher: 'calendar', nexus: 'target', media: 'play' };
  document.querySelectorAll('nav.main a, .bottom-nav a').forEach((a) => a.insertAdjacentHTML('afterbegin', icon(NAV_ICON[a.dataset.nav])));
  app.removeAttribute('aria-busy');
  setupTheme();
  setupSearch();
  setupMobileSearch();
  setupVideo();
  setupStripScrolling();
  renderStrip();
  renderFavLink();
  $('settings-open').onclick = openSettings;
  $('m-back').onclick = () => { if (history.length > 1) history.back(); else location.hash = '#/'; };
  window.addEventListener('hashchange', route);
  startLive(); // before the first page so a game being played opens in live mode
  route();
  // Charts are drawn for the screen width, so redraw when crossing between phone and desktop layouts
  let wasNarrow = isNarrow(), resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (isNarrow() !== wasNarrow) { wasNarrow = isNarrow(); route(); } }, 200);
  });
  setupAppMode();
}

// Phones: the search button opens a full-screen search sheet
function setupMobileSearch() {
  const open = () => { document.body.classList.add('search-open'); $('gsearch').focus(); };
  const close = () => { document.body.classList.remove('search-open'); $('gsearch').value = ''; $('gsearch-results').hidden = true; };
  $('search-open').onclick = open;
  $('search-close').onclick = close;
  $('gsearch').addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// Web app: works offline with the latest data, and refreshes when reopened after a while
function setupAppMode() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  let loadedAt = Date.now();
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || Date.now() - loadedAt < 5 * 60 * 1000) return;
    loadedAt = Date.now();
    try {
      const fresh = await (await fetch(`data/core.json?check=${Date.now()}`, { cache: 'no-store' })).json();
      if (fresh.updated !== D.updated) location.reload();
    } catch { /* offline: keep showing what we have */ }
  });
}
boot();
})();
