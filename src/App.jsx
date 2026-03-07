import { useState, useRef, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════
   CONFIG — Replace these two values
   ═══════════════════════════════════════════ */
const TM_API_KEY = "gtO5Ac8XLwKGYCfqjGOVSYROsh32OFro";
const SG_CLIENT_ID = "YOUR_SEATGEEK_CLIENT_ID";

const CITIES = [
  { name: "Los Angeles", dmaId: 324, sgCity: "Los+Angeles", tz: "America/Los_Angeles", state: "CA" },
  { name: "New York", dmaId: 345, sgCity: "New+York", tz: "America/New_York", state: "NY" },
  { name: "Chicago", dmaId: 602, sgCity: "Chicago", tz: "America/Chicago", state: "IL" },
  { name: "Dallas", dmaId: 623, sgCity: "Dallas", tz: "America/Chicago", state: "TX" },
  { name: "San Francisco", dmaId: 807, sgCity: "San+Francisco", tz: "America/Los_Angeles", state: "CA" },
  { name: "Boston", dmaId: 506, sgCity: "Boston", tz: "America/New_York", state: "MA" },
  { name: "Miami", dmaId: 528, sgCity: "Miami", tz: "America/New_York", state: "FL" },
  { name: "Houston", dmaId: 618, sgCity: "Houston", tz: "America/Chicago", state: "TX" },
  { name: "Philadelphia", dmaId: 504, sgCity: "Philadelphia", tz: "America/New_York", state: "PA" },
  { name: "Atlanta", dmaId: 220, sgCity: "Atlanta", tz: "America/New_York", state: "GA" },
];

/*
  Map city names to ESPN team location keywords.
  Used to inject ESPN-only games (live, completed, upcoming)
  for teams that play in that city, even if TM didn't list them.
*/
const CITY_TEAMS = {
  "Los Angeles": ["los angeles", "los angeles lakers", "la clippers", "la rams", "la chargers", "la kings", "anaheim ducks", "la angels", "los angeles dodgers", "la galaxy", "lafc", "la sparks", "angel city", "south bay lakers", "ontario clippers", "ucla", "usc", "loyola marymount", "pepperdine", "cal state northridge", "cal state fullerton", "cal state bakersfield", "long beach state", "csun", "lmu"],
  "New York": ["new york", "brooklyn", "brooklyn nets", "new york knicks", "new york rangers", "new york islanders", "new york yankees", "new york mets", "ny giants", "ny jets", "nycfc", "new york red bulls", "new york liberty", "gotham fc", "westchester knicks", "long island nets", "st. john", "seton hall", "fordham", "iona", "manhattan", "wagner", "marist"],
  "Chicago": ["chicago", "chicago bulls", "chicago blackhawks", "chicago bears", "chicago cubs", "chicago white sox", "chicago fire", "chicago sky", "chicago stars", "windy city bulls", "northwestern", "depaul", "loyola chicago", "uic", "illinois chicago"],
  "Dallas": ["dallas", "dallas mavericks", "dallas stars", "dallas cowboys", "fc dallas", "dallas wings", "texas legends", "north texas sc", "smu", "tcu", "unt", "north texas", "ut arlington", "dallas baptist"],
  "San Francisco": ["san francisco", "golden state", "golden state warriors", "san francisco 49ers", "sf giants", "oakland", "san jose", "san jose earthquakes", "bay fc", "santa cruz warriors", "stanford", "cal bears", "california golden bears", "santa clara", "bay area", "san jose state", "usf dons"],
  "Boston": ["boston", "boston celtics", "boston bruins", "boston red sox", "new england patriots", "new england revolution", "new england", "maine celtics", "boston college", "northeastern", "harvard", "boston university", "holy cross", "merrimack"],
  "Miami": ["miami", "miami heat", "miami dolphins", "florida panthers", "miami marlins", "inter miami", "sioux falls", "fiu", "miami hurricanes", "florida atlantic", "lynn"],
  "Houston": ["houston", "houston rockets", "houston texans", "houston astros", "houston dynamo", "houston dash", "rio grande valley vipers", "rgv vipers", "rice", "houston cougars", "houston baptist", "sam houston"],
  "Philadelphia": ["philadelphia", "philadelphia 76ers", "philadelphia sixers", "philadelphia flyers", "philadelphia eagles", "philadelphia phillies", "philadelphia union", "delaware blue coats", "villanova", "temple", "drexel", "la salle", "saint joseph", "penn quakers"],
  "Atlanta": ["atlanta", "atlanta hawks", "atlanta falcons", "atlanta braves", "atlanta united", "atlanta dream", "college park skyhawks", "georgia swarm", "georgia tech", "georgia state", "kennesaw", "mercer"],
};

/* ESPN leagues to scan — groups param needed for college leagues to get all D1 games */
const ESPN_LEAGUES = [
  // Major US pro leagues
  { sport: "basketball", league: "nba" },
  { sport: "hockey", league: "nhl" },
  { sport: "football", league: "nfl" },
  { sport: "baseball", league: "mlb" },
  { sport: "soccer", league: "usa.1" },
  { sport: "basketball", league: "wnba" },
  // College
  { sport: "basketball", league: "mens-college-basketball", groups: 50 },
  { sport: "basketball", league: "womens-college-basketball", groups: 50 },
  { sport: "football", league: "college-football", groups: 80 },
  { sport: "baseball", league: "college-baseball" },
  { sport: "hockey", league: "mens-college-hockey" },
  // Minor / development
  { sport: "basketball", league: "nba-development" },
  // Soccer
  { sport: "soccer", league: "usa.nwsl" },
  { sport: "soccer", league: "usa.usl.l1" },
  { sport: "soccer", league: "mex.1" },
  // Other sports
  { sport: "lacrosse", league: "pll" },
  { sport: "lacrosse", league: "nll" },
  { sport: "mma", league: "ufc" },
  { sport: "golf", league: "pga" },
  { sport: "tennis", league: "atp" },
  { sport: "tennis", league: "wta" },
  { sport: "racing", league: "f1" },
  { sport: "racing", league: "irl" },
];

/* ═══════════════════════════════════════════
   CACHE
   ═══════════════════════════════════════════ */
const cache = { events: {}, espn: {} };

/* ═══════════════════════════════════════════
   DATE HELPERS
   ═══════════════════════════════════════════ */
function pad2(n) { return String(n).padStart(2, "0"); }
function localDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getDateOptions() {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i);
    dates.push({
      key: localDateStr(d),
      weekday: i === 0 ? "TODAY" : d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      dayNum: d.getDate(),
      dateLabel: i === 0
        ? "Today"
        : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    });
  }
  return dates;
}

function formatTime(dateTimeStr, tz) {
  try {
    return new Date(dateTimeStr).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: tz,
    });
  } catch { return "TBD"; }
}

function espnDateStr(dateKey) { return dateKey.replace(/-/g, ""); }

/* Wide UTC window for the full local day across all US timezones */
function utcRange(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString().replace(".000Z", "Z"),
    end: new Date(Date.UTC(y, m - 1, d + 1, 13, 0, 0)).toISOString().replace(".000Z", "Z"),
  };
}

/* ═══════════════════════════════════════════
   NON-GAME EVENT FILTER
   ═══════════════════════════════════════════ */
const NON_GAME_RE = /\b(party|parties|festival|craft beer|fun zone|gala|brunch|concert|fireworks|tailgate|fan ?fest|meet.?greet|open house|job fair|watch party|viewing party|pre.?game|post.?game|happy hour|food truck|chandelier|ketel one|fiesta)\b/i;

function isActualSportingEvent(event) {
  return !NON_GAME_RE.test(event.name);
}

/* ═══════════════════════════════════════════
   VENUE / DEDUP HELPERS
   ═══════════════════════════════════════════ */
function normVenue(name) {
  return (name || "").toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/\b(the|at|arena|stadium|field|center|centre|park|dome|coliseum|amphitheatre|amphitheater)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function timeClose(dt1, dt2, thresholdMin = 120) {
  if (!dt1 || !dt2) return false;
  return Math.abs(new Date(dt1) - new Date(dt2)) < thresholdMin * 60 * 1000;
}

function dedup(tmEvents, sgEvents) {
  const merged = [...tmEvents];
  for (const sg of sgEvents) {
    const isDupe = tmEvents.some(tm =>
      tm.venueNorm === sg.venueNorm && timeClose(tm.dateTime, sg.dateTime)
    );
    if (!isDupe) merged.push(sg);
  }
  return merged;
}

/* ═══════════════════════════════════════════
   TICKETMASTER
   ═══════════════════════════════════════════ */
async function fetchTM(city, dateStr) {
  const { start, end } = utcRange(dateStr);
  const params = new URLSearchParams({
    apikey: TM_API_KEY,
    dmaId: String(city.dmaId),
    classificationName: "Sports",
    startDateTime: start,
    endDateTime: end,
    sort: "relevance,desc",
    size: "200",
  });
  const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
  if (!res.ok) throw new Error(`TM ${res.status}`);
  const data = await res.json();
  if (!data._embedded?.events) return [];

  return data._embedded.events
    .filter(e => e.dates?.start?.localDate === dateStr)
    .map((e, idx) => {
      const cls = e.classifications?.[0] || {};
      const rawSport = cls.subGenre?.name || cls.genre?.name || cls.segment?.name || "Sports";
      const sport = inferSport(e.name, rawSport);
      const venueObj = e._embedded?.venues?.[0];
      const venue = venueObj?.name || "";
      const venueCity = venueObj?.city?.name || "";
      const venueState = venueObj?.state?.stateCode || "";
      const lt = e.dates?.start?.localTime;
      const dt = e.dates?.start?.dateTime || (lt ? `${dateStr}T${lt}` : null);
      return {
        id: `tm-${e.id}`,
        name: e.name,
        sport,
        venue,
        venueCity,
        venueState,
        venueNorm: normVenue(venue),
        time: dt ? formatTime(dt, city.tz) : "TBD",
        dateTime: dt,
        ticketUrl: e.url || "#",
        source: "tm",
        isLive: false,
        isComplete: false,
        score: null,
        home: null,
        away: null,
        broadcast: null,
        popularity: 200 - idx,
      };
    });
}

/* ═══════════════════════════════════════════
   SEATGEEK
   ═══════════════════════════════════════════ */
async function fetchSG(city, dateStr) {
  const gte = `${dateStr}T00:00:00`;
  const lte = `${dateStr}T23:59:59`;
  const url = `https://api.seatgeek.com/2/events?client_id=${SG_CLIENT_ID}`
    + `&venue.city=${city.sgCity}&taxonomies.name=sports`
    + `&datetime_utc.gte=${gte}&datetime_utc.lte=${lte}&per_page=50&sort=score.desc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SG ${res.status}`);
  const data = await res.json();
  if (!data.events) return [];

  return data.events.map(e => {
    const venue = e.venue?.name_v2 || e.venue?.name || "";
    const dt = e.datetime_utc ? e.datetime_utc + "Z" : null;
    const sport = e.taxonomies?.[0]?.name || "Sports";
    return {
      id: `sg-${e.id}`,
      name: e.short_title || e.title,
      sport: prettySport(sport),
      venue,
      venueNorm: normVenue(venue),
      time: dt ? formatTime(dt, city.tz) : "TBD",
      dateTime: dt,
      ticketUrl: e.url || "#",
      source: "sg",
      isLive: false,
      isComplete: false,
      score: null,
      home: null,
      away: null,
      broadcast: null,
      popularity: Math.round((e.score || 0) * 100),
    };
  });
}

function prettySport(raw) {
  const map = {
    "sports": "Sports", "nba": "NBA", "nhl": "NHL", "nfl": "NFL",
    "mlb": "MLB", "mls": "MLS", "nwsl": "NWSL", "wnba": "WNBA",
    "ncaa football": "NCAAF", "ncaa basketball": "NCAAM",
    "ncaa womens basketball": "NCAAW", "ncaa hockey": "College Hockey",
    "boxing": "Boxing", "mma": "MMA", "ufc": "UFC",
    "pga": "Golf", "golf": "Golf", "tennis": "Tennis",
    "wrestling": "Wrestling", "soccer": "Soccer",
    "minor league baseball": "MiLB", "nba g league": "G-League",
    "lacrosse": "Lacrosse", "auto racing": "Racing",
    "formula 1": "F1", "indycar": "IndyCar", "nascar": "NASCAR",
  };
  return map[raw.toLowerCase()] || raw;
}

/* Infer sport from event name when TM classification is generic */
function inferSport(name, tmSport) {
  const lower = (tmSport || "").toLowerCase();
  if (lower !== "miscellaneous" && lower !== "sports" && lower !== "undefined") return tmSport;
  const n = name.toLowerCase();
  if (/\bbaseball\b/.test(n)) return "College Baseball";
  if (/\bbasketball\b/.test(n)) return "College Basketball";
  if (/\bsoftball\b/.test(n)) return "Softball";
  if (/\bsoccer\b/.test(n) || /\bfútbol\b/.test(n)) return "Soccer";
  if (/\bfootball\b/.test(n)) return "Football";
  if (/\bhockey\b/.test(n)) return "Hockey";
  if (/\blacrosse\b/.test(n)) return "Lacrosse";
  if (/\btennis\b/.test(n)) return "Tennis";
  if (/\bgolf\b/.test(n)) return "Golf";
  if (/\bvolleyball\b/.test(n)) return "Volleyball";
  if (/\bwrestling\b/.test(n)) return "Wrestling";
  if (/\bswim/.test(n) || /\bdiving\b/.test(n)) return "Swimming";
  if (/\btrack\b/.test(n) || /\bcross country\b/.test(n)) return "Track & Field";
  if (/\bgymnastics\b/.test(n)) return "Gymnastics";
  if (/\browing\b/.test(n)) return "Rowing";
  if (/\bwater polo\b/.test(n)) return "Water Polo";
  return tmSport;
}

/* ═══════════════════════════════════════════
   ESPN
   ═══════════════════════════════════════════ */
async function fetchAllESPN(dateStr) {
  const cacheKey = `espn-${dateStr}`;
  if (cache.espn[cacheKey]) return cache.espn[cacheKey];

  const dateParam = espnDateStr(dateStr);
  const allGames = [];

  const fetches = ESPN_LEAGUES.map(async ({ sport, league, groups }) => {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?dates=${dateParam}&limit=500${groups ? `&groups=${groups}` : ``}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      for (const ev of (data.events || [])) {
        const comp = ev.competitions?.[0];
        if (!comp) continue;
        const competitors = comp.competitors || [];
        const home = competitors.find(c => c.homeAway === "home");
        const away = competitors.find(c => c.homeAway === "away");
        const status = ev.status || {};
        const broadcasts = comp.broadcasts?.flatMap(b => b.names || []) || [];
        const venue = comp.venue?.fullName || "";

        const LEAGUE_LABELS = {
          "nba": "NBA", "nhl": "NHL", "nfl": "NFL", "mlb": "MLB", "wnba": "WNBA",
          "usa.1": "MLS", "usa.nwsl": "NWSL", "usa.usl.l1": "USL", "mex.1": "Liga MX",
          "mens-college-basketball": "NCAAM", "womens-college-basketball": "NCAAW",
          "college-football": "NCAAF", "college-baseball": "College Baseball",
          "mens-college-hockey": "College Hockey", "nba-development": "G-League",
          "pll": "PLL", "nll": "NLL", "ufc": "UFC",
          "pga": "PGA", "atp": "ATP", "wta": "WTA",
          "f1": "F1", "irl": "IndyCar",
        };
        const leagueLabel = LEAGUE_LABELS[league] || league.toUpperCase();

        allGames.push({
          espnId: ev.id,
          name: ev.name || ev.shortName || "",
          shortName: ev.shortName || "",
          league: leagueLabel,
          venue,
          venueNorm: normVenue(venue),
          dateTime: ev.date,
          home: home ? {
            city: home.team?.abbreviation || "",
            name: home.team?.displayName || home.team?.shortDisplayName || "",
            shortName: home.team?.shortDisplayName || "",
            location: home.team?.location || "",
            record: home.records?.[0]?.summary || "",
            logo: home.team?.logo || "",
            score: parseInt(home.score, 10) || 0,
          } : null,
          away: away ? {
            city: away.team?.abbreviation || "",
            name: away.team?.displayName || away.team?.shortDisplayName || "",
            shortName: away.team?.shortDisplayName || "",
            location: away.team?.location || "",
            record: away.records?.[0]?.summary || "",
            logo: away.team?.logo || "",
            score: parseInt(away.score, 10) || 0,
          } : null,
          broadcasts,
          isLive: status.type?.state === "in",
          isComplete: status.type?.state === "post",
          statusText: status.type?.shortDetail || "",
        });
      }
    } catch { /* ESPN is best-effort */ }
  });

  await Promise.allSettled(fetches);
  cache.espn[cacheKey] = allGames;
  return allGames;
}

/* Map league labels to ESPN URL sport paths */
const ESPN_SPORT_PATH = {
  "NBA": "nba", "NHL": "nhl", "NFL": "nfl", "MLB": "mlb", "WNBA": "wnba",
  "MLS": "soccer", "NWSL": "soccer", "USL": "soccer", "Liga MX": "soccer",
  "NCAAM": "mens-college-basketball", "NCAAW": "womens-college-basketball",
  "NCAAF": "college-football", "College Baseball": "college-baseball",
  "College Hockey": "mens-college-hockey", "G-League": "nba-development",
  "PLL": "lacrosse", "NLL": "lacrosse", "UFC": "mma",
  "PGA": "golf", "ATP": "tennis", "WTA": "tennis",
  "F1": "f1", "IndyCar": "indycar",
};

/* Check if an ESPN game belongs to a city (home or away) */
function espnGameInCity(game, cityName) {
  const keywords = CITY_TEAMS[cityName] || [];
  if (keywords.length === 0) return null;

  const homeHaystack = [
    game.home?.name, game.home?.shortName, game.home?.location, game.venue,
  ].filter(Boolean).join(" ").toLowerCase();

  const awayHaystack = [
    game.away?.name, game.away?.shortName, game.away?.location,
  ].filter(Boolean).join(" ").toLowerCase();

  for (const kw of keywords) {
    if (homeHaystack.includes(kw)) {
      return { matches: true, isHome: true };
    }
  }

  for (const kw of keywords) {
    if (awayHaystack.includes(kw)) {
      return { matches: true, isHome: false };
    }
  }

  return null;
}

/* Check if any of a team's name variants can be found in the event name */
function teamInEvent(names, evName, evWords) {
  // Direct substring match (handles multi-word names like "USC Trojans")
  if (names.some(n => n.length > 2 && evName.includes(n))) return true;
  // Word-boundary match for shorter names / abbreviations (e.g. "USC", "UCLA")
  for (const n of names) {
    if (n.length < 2) continue;
    if (evWords.has(n)) return true;
  }
  return false;
}

/* Match a TM/SG event to an ESPN game */
function findESPNMatch(event, espnGames) {
  const evName = event.name.toLowerCase();
  const evWords = new Set(evName.split(/[\s\-,.()]+/).filter(w => w.length > 1));

  // Strip leading ranking numbers like "5 " from ESPN team names
  const clean = s => (s || "").toLowerCase().replace(/^\d+\s+/, "").trim();

  for (const game of espnGames) {
    if (!game.home || !game.away) continue;

    const homeNames = [...new Set([
      clean(game.home.name), clean(game.home.shortName),
      clean(game.home.city), clean(game.home.location),
    ])].filter(n => n.length > 1);

    const awayNames = [...new Set([
      clean(game.away.name), clean(game.away.shortName),
      clean(game.away.city), clean(game.away.location),
    ])].filter(n => n.length > 1);

    if (teamInEvent(homeNames, evName, evWords) &&
        teamInEvent(awayNames, evName, evWords)) {
      return game;
    }
  }

  // Venue + time proximity fallback
  for (const game of espnGames) {
    if (game.venueNorm && event.venueNorm &&
        game.venueNorm === event.venueNorm &&
        timeClose(game.dateTime, event.dateTime, 180)) {
      return game;
    }
  }
  return null;
}

/* Enrich TM/SG events with ESPN data */
function enrichWithESPN(events, espnGames) {
  const matchedESPNIds = new Set();

  const enriched = events.map(event => {
    const match = findESPNMatch(event, espnGames);
    if (!match) return event;
    matchedESPNIds.add(match.espnId);

    const e = { ...event };
    if (match.home) { e.home = { ...match.home }; e.away = { ...match.away }; }
    if (match.broadcasts.length > 0) e.broadcast = match.broadcasts;
    if (match.league) e.sport = match.league;

    if (match.isLive) {
      e.isLive = true;
      e.score = { home: match.home.score, away: match.away.score, status: match.statusText };
    }
    if (match.isComplete && match.home && match.away) {
      e.isComplete = true;
      e.score = { home: match.home.score, away: match.away.score, status: "Final" };
    }
    e.espnMatched = true;
    e.espnId = match.espnId;
    return e;
  });

  return { enriched, matchedESPNIds };
}

/* Create standalone events from ESPN games that weren't matched to any TM/SG event */
function createESPNOnlyEvents(espnGames, matchedIds, cityName, tz) {
  const extras = [];
  for (const game of espnGames) {
    if (matchedIds.has(game.espnId)) continue;
    if (!game.home || !game.away) continue;
    const cityMatch = espnGameInCity(game, cityName);
    if (!cityMatch) continue;

    const e = {
      id: `espn-${game.espnId}`,
      name: game.name,
      sport: game.league,
      venue: game.venue,
      venueNorm: normVenue(game.venue),
      time: game.dateTime ? formatTime(game.dateTime, tz) : "TBD",
      dateTime: game.dateTime,
      ticketUrl: null,
      source: "espn",
      isLive: game.isLive,
      isComplete: game.isComplete,
      score: null,
      home: { ...game.home },
      away: { ...game.away },
      broadcast: game.broadcasts.length > 0 ? game.broadcasts : null,
      popularity: game.isLive ? 300 : game.isComplete ? 40 : 80,
      isAway: !cityMatch.isHome,
      espnId: game.espnId,
    };

    if (game.isLive) {
      e.score = { home: game.home.score, away: game.away.score, status: game.statusText };
    }
    if (game.isComplete) {
      e.score = { home: game.home.score, away: game.away.score, status: "Final" };
    }

    extras.push(e);
  }
  return extras;
}

/* Apply popularity bonuses and sort: live → upcoming ESPN → other → completed */
function rankEvents(events) {
  for (const e of events) {
    if (e.isLive) {
      e.popularity += 200;
    } else if (!e.isComplete && e.espnMatched) {
      e.popularity += 50;
    }
  }
  events.sort((a, b) => b.popularity - a.popularity);
  return events;
}

/* ═══════════════════════════════════════════
   MAIN DATA HOOK
   ═══════════════════════════════════════════ */
function useEvents(city, dateStr) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const load = useCallback(async (isPolling = false) => {
    const cacheKey = `${city.name}:${dateStr}`;

    if (!isPolling && cache.events[cacheKey]) {
      // Re-enrich with fresh ESPN on cached TM/SG data
      try {
        if (isPolling) delete cache.espn[`espn-${dateStr}`];
        const espn = await fetchAllESPN(dateStr);
        const { enriched, matchedESPNIds } = enrichWithESPN(cache.events[cacheKey], espn);
        const extras = createESPNOnlyEvents(espn, matchedESPNIds, city.name, city.tz);
        const all = rankEvents([...enriched, ...extras]);
        setEvents(all);
      } catch {
        setEvents(cache.events[cacheKey]);
      }
      setLoading(false);
      return;
    }

    if (!isPolling) setLoading(true);
    setError(null);

    try {
      const [tmEventsRaw, sgEvents] = await Promise.all([
        fetchTM(city, dateStr).catch(err => { throw err; }),
        fetchSG(city, dateStr).catch(() => []),
      ]);

      const tmEvents = tmEventsRaw.filter(e =>
        (!e.venueState || e.venueState === city.state) && isActualSportingEvent(e)
      );

      const merged = dedup(tmEvents, sgEvents);
      cache.events[cacheKey] = merged;

      let final = merged;
      try {
        if (isPolling) delete cache.espn[`espn-${dateStr}`];
        const espn = await fetchAllESPN(dateStr);
        const { enriched, matchedESPNIds } = enrichWithESPN(merged, espn);
        const extras = createESPNOnlyEvents(espn, matchedESPNIds, city.name, city.tz);
        final = [...enriched, ...extras];
      } catch { /* ESPN failed, still show events */ }

      rankEvents(final);
      setEvents(final);
    } catch (err) {
      if (!isPolling) {
        setError(err.message);
        setEvents([]);
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [city, dateStr]);

  useEffect(() => { load(false); }, [load]);

  // Poll every 60s if any events are live
  useEffect(() => {
    const hasLive = events.some(e => e.isLive);
    if (hasLive && !pollRef.current) {
      pollRef.current = setInterval(() => load(true), 60000);
    } else if (!hasLive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [events, load]);

  return { events, loading, error, retry: () => load(false) };
}

/* ═══════════════════════════════════════════
   UI COMPONENTS
   ═══════════════════════════════════════════ */

function LiveDot() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: "#c0392b",
        boxShadow: "0 0 0 3px rgba(192,57,43,0.15)",
        animation: "pulse 2s ease infinite",
      }}/>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
        color: "#c0392b", textTransform: "uppercase",
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}>Live</span>
    </span>
  );
}

function FinalBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
      color: "#8c8578", textTransform: "uppercase",
      fontFamily: "'IBM Plex Sans', sans-serif",
    }}>Final</span>
  );
}


function EventCard({ event }) {
  const hasTeams = event.home && event.away;
  const dimmed = event.isComplete || event.isStarted;
  const isLive = event.isLive;
  const hasScore = (isLive || event.isComplete) && event.score && hasTeams;

  const espnPath = ESPN_SPORT_PATH[event.sport];
  const espnUrl = event.espnId && espnPath
    ? `https://www.espn.com/${espnPath}/game/_/gameId/${event.espnId}`
    : null;

  /* Build a concise title: use short team names if available, else event.name */
  const title = hasTeams
    ? `${event.away.shortName || event.away.name} at ${event.home.shortName || event.home.name}`
    : event.name;

  return (
    <div style={{
      border: isLive ? "1px solid rgba(192, 57, 43, 0.2)" : "1px solid #e8e4de",
      borderRadius: 10,
      background: isLive ? "rgba(192, 57, 43, 0.02)" : "#fff",
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 10,
      transition: "box-shadow 0.15s",
      minWidth: 0, overflow: "hidden",
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(26,23,20,0.06)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
    >
      {/* Top row: league + time */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10,
            fontWeight: 600, color: "#8c8578", letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>{event.sport}</span>
          {isLive && <LiveDot />}
          {!isLive && event.isComplete && <FinalBadge />}
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          minWidth: 0, justifyContent: "flex-end",
        }}>
          {event.broadcast && event.broadcast.length > 0 && (
            <span style={{
              fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10,
              color: "#b0a898", fontWeight: 500,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: 100,
            }}>{event.broadcast.slice(0, 2).join(", ")}</span>
          )}
          <span style={{
            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10.5,
            color: "#b0a898", fontWeight: 400, flexShrink: 0,
          }}>
            {event.isStarted ? `Started ${event.time}` : event.time}
          </span>
        </div>
      </div>

      {/* Matchup or event name */}
      {hasTeams ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Away team */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {event.away.logo && <img src={event.away.logo} alt="" style={{
                width: 20, height: 20, objectFit: "contain", flexShrink: 0,
                opacity: dimmed ? 0.5 : 1,
              }}/>}
              <span style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                fontSize: 15, fontWeight: 600,
                color: dimmed ? "#8c8578" : "#1a1714",
                lineHeight: 1.2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{event.away.shortName || event.away.name}</span>
              {event.away.record && !hasScore && (
                <span style={{
                  fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11,
                  color: "#b0a898", flexShrink: 0,
                }}>{event.away.record}</span>
              )}
            </div>
            {hasScore && (
              <span style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 18, fontWeight: 700,
                color: dimmed ? "#8c8578" : "#1a1714",
                lineHeight: 1, minWidth: 24, textAlign: "right",
              }}>{event.score.away}</span>
            )}
          </div>
          {/* Home team */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {event.home.logo && <img src={event.home.logo} alt="" style={{
                width: 20, height: 20, objectFit: "contain", flexShrink: 0,
                opacity: dimmed ? 0.5 : 1,
              }}/>}
              <span style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                fontSize: 15, fontWeight: 600,
                color: dimmed ? "#8c8578" : "#1a1714",
                lineHeight: 1.2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{event.home.shortName || event.home.name}</span>
              {event.home.record && !hasScore && (
                <span style={{
                  fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11,
                  color: "#b0a898", flexShrink: 0,
                }}>{event.home.record}</span>
              )}
            </div>
            {hasScore && (
              <span style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 18, fontWeight: 700,
                color: dimmed ? "#8c8578" : "#1a1714",
                lineHeight: 1, minWidth: 24, textAlign: "right",
              }}>{event.score.home}</span>
            )}
          </div>
          {/* Score status */}
          {hasScore && (
            <span style={{
              fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10.5,
              color: isLive ? "#c0392b" : "#b0a898", fontWeight: 500,
            }}>{event.score.status}</span>
          )}
        </div>
      ) : (
        <h3 style={{
          fontFamily: "'Source Serif 4', Georgia, serif",
          fontSize: 15, fontWeight: 600,
          color: dimmed ? "#8c8578" : "#1a1714",
          lineHeight: 1.3, margin: 0,
        }}>{event.name}</h3>
      )}

      {/* Footer: venue + links */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, marginTop: "auto",
        borderTop: "1px solid #f0ece5", paddingTop: 8,
      }}>
        <div style={{
          fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11,
          color: "#b0a898", overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", minWidth: 0,
        }}>
          {event.venue}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {espnUrl && (
            <a href={espnUrl} target="_blank" rel="noopener noreferrer"
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10.5,
                fontWeight: 600, color: "#8c8578", textDecoration: "none",
                borderBottom: "1px solid #b0a898", paddingBottom: 0.5,
                transition: "opacity 0.15s", lineHeight: 1,
              }}
              onMouseEnter={e => e.target.style.opacity = "0.5"}
              onMouseLeave={e => e.target.style.opacity = "1"}
            >ESPN ↗</a>
          )}
          {event.ticketUrl && (
            <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer"
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10.5,
                fontWeight: 600, color: "#1a1714", textDecoration: "none",
                borderBottom: "1px solid #1a1714", paddingBottom: 0.5,
                transition: "opacity 0.15s", lineHeight: 1,
              }}
              onMouseEnter={e => e.target.style.opacity = "0.5"}
              onMouseLeave={e => e.target.style.opacity = "1"}
            >Tickets ↗</a>
          )}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          borderBottom: i < 2 ? "1px solid #e8e4de" : "none",
          padding: "20px 0",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ height: 12, width: 45, background: "#ece8e0", borderRadius: 3 }}/>
            <div style={{ height: 12, width: 55, background: "#ece8e0", borderRadius: 3 }}/>
          </div>
          <div style={{ height: 20, width: "75%", background: "#ece8e0", borderRadius: 3, marginBottom: 8 }}/>
          <div style={{ height: 13, width: "50%", background: "#f0ece5", borderRadius: 3, marginBottom: 10 }}/>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ height: 12, width: "40%", background: "#f0ece5", borderRadius: 3 }}/>
            <div style={{ height: 12, width: 55, background: "#ece8e0", borderRadius: 3 }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */
export default function SportsToday() {
  const [city, setCity] = useState(CITIES[0]);
  const [cityOpen, setCityOpen] = useState(false);
  const dates = getDateOptions();
  const [activeDate, setActiveDate] = useState(dates[0].key);
  const activeDateObj = dates.find(d => d.key === activeDate);
  const dropdownRef = useRef(null);
  const dateStripRef = useRef(null);
  const [showScrollArrow, setShowScrollArrow] = useState(true);
  const [showLeftArrow, setShowLeftArrow] = useState(false);

  const checkScrollEnd = useCallback(() => {
    const el = dateStripRef.current;
    if (!el) return;
    setShowScrollArrow(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    setShowLeftArrow(el.scrollLeft > 2);
  }, []);

  const { events, loading, error, retry } = useEvents(city, activeDate);
  const liveCount = events.filter(e => e.isLive).length;

  const now = Date.now();
  const sortedEvents = [...events]
    .filter(e => !e.isAway)
    .map(e => {
      if (!e.espnMatched && !e.isLive && !e.isComplete && e.dateTime && new Date(e.dateTime).getTime() < now) {
        return { ...e, isStarted: true };
      }
      return e;
    }).sort((a, b) => {
      // Group: live (0), upcoming (1), started (2), completed (3)
      const groupA = a.isLive ? 0 : a.isComplete ? 3 : a.isStarted ? 2 : 1;
      const groupB = b.isLive ? 0 : b.isComplete ? 3 : b.isStarted ? 2 : 1;
      if (groupA !== groupB) return groupA - groupB;
      const tA = a.dateTime ? new Date(a.dateTime).getTime() : Infinity;
      const tB = b.dateTime ? new Date(b.dateTime).getTime() : Infinity;
      return tA - tB;
    });

  return (
    <div style={{
      minHeight: "100vh", background: "#faf8f4",
      fontFamily: "'IBM Plex Sans', sans-serif",
      overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #faf8f4; -webkit-font-smoothing: antialiased; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        ::selection { background: #1a1714; color: #faf8f4; }
        .date-strip::-webkit-scrollbar { display: none; }
        @media (max-width: 560px) {
          .events-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px", width: "100%" }}>

        {/* Header */}
        <header style={{ paddingTop: 52, paddingBottom: 0 }}>
          {/* Combined header */}
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            flexWrap: "wrap", gap: 8, marginBottom: 28,
          }}>
            <h1 style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: 26, fontWeight: 700, color: "#1a1714",
              letterSpacing: "-0.02em", lineHeight: 1.3, margin: 0,
              display: "inline",
            }}>
              Sports{activeDateObj?.key === dates[0].key
                ? " Today "
                : <>{" "}<span style={{ fontWeight: 400, fontStyle: "italic", color: "#8c8578" }}>on</span>{" "}{activeDateObj?.dateLabel}{" "}</>
              }
              <span style={{ fontWeight: 400, fontStyle: "italic", color: "#8c8578" }}>in</span>{" "}
              <span style={{ position: "relative" }} ref={dropdownRef}>
                <button onClick={() => setCityOpen(!cityOpen)} style={{
                  fontFamily: "'Source Serif 4', Georgia, serif",
                  fontSize: 26, fontWeight: 700, color: "#1a1714",
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: "1.5px dashed #b0a898", padding: "0 2px 2px",
                  lineHeight: 1.2, display: "inline-flex", alignItems: "baseline", gap: 5,
                  letterSpacing: "-0.02em",
                }}>
                  {city.name}
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{
                    transform: cityOpen ? "rotate(180deg)" : "rotate(0)",
                    transition: "transform 0.2s ease", position: "relative", top: -1,
                  }}>
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#8c8578" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {cityOpen && (
                  <>
                    <div onClick={() => setCityOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
                    <div style={{
                      position: "absolute", top: "calc(100% + 8px)", left: -8,
                      background: "#fff", border: "1px solid #e8e4de",
                      borderRadius: 8, padding: 4, zIndex: 100,
                      boxShadow: "0 8px 30px rgba(26,23,20,0.1), 0 2px 8px rgba(26,23,20,0.06)",
                      minWidth: 200, animation: "fadeIn 0.12s ease",
                    }}>
                      {CITIES.map(c => (
                        <button key={c.name} onClick={() => { setCity(c); setCityOpen(false); }}
                          style={{
                            display: "block", width: "100%", textAlign: "left",
                            padding: "9px 14px", border: "none", borderRadius: 5,
                            background: c.name === city.name ? "#f4f1eb" : "transparent",
                            color: "#1a1714",
                            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14,
                            fontWeight: c.name === city.name ? 600 : 400,
                            cursor: "pointer", transition: "background 0.1s",
                          }}
                          onMouseEnter={e => { if (c.name !== city.name) e.target.style.background = "#faf8f4"; }}
                          onMouseLeave={e => { if (c.name !== city.name) e.target.style.background = "transparent"; }}
                        >{c.name}</button>
                      ))}
                    </div>
                  </>
                )}
              </span>
            </h1>
            {liveCount > 0 && (
              <span style={{
                fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11,
                color: "#c0392b", fontWeight: 500,
              }}>
                {liveCount} live now
              </span>
            )}
          </div>

          {/* Date strip */}
          <div style={{ position: "relative", marginBottom: 24 }}>
            <div ref={dateStripRef} onScroll={checkScrollEnd} style={{
              display: "flex", gap: 2,
              borderBottom: "1px solid #e8e4de", paddingBottom: 0,
              paddingLeft: 0, paddingRight: 0,
              overflowX: "auto", scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            }} className="date-strip">
              {dates.map(d => {
                const active = d.key === activeDate;
                return (
                  <button key={d.key} onClick={() => setActiveDate(d.key)} style={{
                    flex: "0 0 auto", minWidth: 50, padding: "10px 4px 12px", border: "none",
                    borderBottom: active ? "2px solid #1a1714" : "2px solid transparent",
                    background: "transparent", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    marginBottom: -1, transition: "border-color 0.15s",
                  }}>
                    <span style={{
                      fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 9.5,
                      fontWeight: 600, letterSpacing: "0.08em",
                      color: active ? "#1a1714" : "#b0a898",
                      transition: "color 0.15s",
                    }}>{d.weekday}</span>
                    <span style={{
                      fontFamily: "'Source Serif 4', Georgia, serif",
                      fontSize: 18, fontWeight: 600,
                      color: active ? "#1a1714" : "#b0a898",
                      transition: "color 0.15s", lineHeight: 1.1,
                    }}>{d.dayNum}</span>
                  </button>
                );
              })}
            </div>
            {showLeftArrow && (
              <div style={{
                position: "absolute", top: 0, left: 0, bottom: 1,
                width: 32, pointerEvents: "none",
                background: "linear-gradient(to left, transparent, #faf8f4)",
                zIndex: 1,
              }}/>
            )}
            {showLeftArrow && (
              <button onClick={() => dateStripRef.current?.scrollBy({ left: -300, behavior: "smooth" })}
                style={{
                  position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                  width: 28, height: 28, border: "none", background: "transparent",
                  color: "#b0a898", fontSize: 14, cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 2,
                }}
                aria-label="Scroll dates left"
              >‹</button>
            )}
            {showScrollArrow && (
              <div style={{
                position: "absolute", top: 0, right: 0, bottom: 1,
                width: 32, pointerEvents: "none",
                background: "linear-gradient(to right, transparent, #faf8f4)",
                zIndex: 1,
              }}/>
            )}
            {showScrollArrow && (
              <button onClick={() => dateStripRef.current?.scrollBy({ left: 300, behavior: "smooth" })}
                style={{
                  position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
                  width: 28, height: 28, border: "none", background: "transparent",
                  color: "#b0a898", fontSize: 14, cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 2,
                }}
                aria-label="Scroll dates right"
              >›</button>
            )}
          </div>
        </header>

        {/* Events */}
        <main>
          {loading ? (
            <Skeleton />
          ) : error ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <p style={{
                fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12,
                color: "#c0392b", marginBottom: 8,
              }}>
                Couldn't load events
              </p>
              <p style={{ fontSize: 12, color: "#b0a898", lineHeight: 1.5, marginBottom: 14 }}>
                {error.includes("401") || error.includes("403")
                  ? "Check your Ticketmaster API key"
                  : "Check your connection and try again"}
              </p>
              <button onClick={retry} style={{
                padding: "8px 18px", border: "1px solid #e8e4de",
                borderRadius: 6, background: "transparent", cursor: "pointer",
                fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13,
                fontWeight: 600, color: "#1a1714",
              }}>Retry</button>
            </div>
          ) : sortedEvents.length > 0 ? (
            <div className="events-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              paddingTop: 16,
              animation: "fadeIn 0.3s ease",
            }}>
              {sortedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div style={{ padding: "56px 0", textAlign: "center" }}>
              <p style={{
                fontFamily: "'Source Serif 4', Georgia, serif",
                fontSize: 18, fontStyle: "italic", color: "#b0a898",
                lineHeight: 1.5,
              }}>
                No events scheduled
              </p>
              <p style={{ fontSize: 13, color: "#ccc8c0", marginTop: 6 }}>
                Try another date or city
              </p>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer style={{
          padding: "28px 0 48px",
          borderTop: "1px solid #e8e4de", marginTop: 8,
        }}>
          <p style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 10, color: "#ccc8c0", lineHeight: 1.7,
            letterSpacing: "0.02em",
          }}>
            Ticketmaster · SeatGeek · ESPN<br/>
            Scores refresh every 60s during live games
          </p>
        </footer>
      </div>
    </div>
  );
}
