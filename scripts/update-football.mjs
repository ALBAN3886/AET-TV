import { mkdir, writeFile } from 'node:fs/promises';

const API_KEY = process.env.FOOTBALL_DATA_KEY;
const TIMEZONE = 'Africa/Lome';
const OUTPUT = 'data/football-live.json';

if (!API_KEY) {
  throw new Error('Secret FOOTBALL_DATA_KEY manquant');
}

function dateInTimezone(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function eventState(status) {
  if (['IN_PLAY', 'PAUSED'].includes(status)) return 'live';
  if (['FINISHED', 'AWARDED'].includes(status)) return 'finished';
  return 'scheduled';
}

function statusLabel(status) {
  const labels = {
    SCHEDULED: 'PROGRAMMÉ',
    TIMED: 'À VENIR',
    IN_PLAY: 'EN DIRECT',
    PAUSED: 'MI-TEMPS',
    FINISHED: 'TERMINÉ',
    SUSPENDED: 'SUSPENDU',
    POSTPONED: 'REPORTÉ',
    CANCELLED: 'ANNULÉ',
    AWARDED: 'TERMINÉ'
  };

  return labels[status] || status || 'À VENIR';
}

function scoreValue(match, side) {
  const fullTime = match.score?.fullTime?.[side];

  if (fullTime !== null && fullTime !== undefined) {
    return fullTime;
  }

  const halfTime = match.score?.halfTime?.[side];

  if (halfTime !== null && halfTime !== undefined) {
    return halfTime;
  }

  return null;
}

const date = dateInTimezone(TIMEZONE);

function shiftDate(value, numberOfDays) {
  const result = new Date(`${value}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + numberOfDays);
  return result.toISOString().slice(0, 10);
}

const periods = [
  [shiftDate(date, -1), shiftDate(date, 7)],
  [shiftDate(date, 8), shiftDate(date, 16)],
  [shiftDate(date, 17), shiftDate(date, 25)],
  [shiftDate(date, 26), shiftDate(date, 30)]
];

let dateFrom = periods[0][0];
let dateTo = periods[0][1];
let apiMatches = [];

for (const [from, to] of periods) {
  const endpoint = new URL(
    'https://api.football-data.org/v4/matches'
  );

  endpoint.searchParams.set('dateFrom', from);
  endpoint.searchParams.set('dateTo', to);

  const response = await fetch(endpoint, {
    headers: {
      'X-Auth-Token': API_KEY,
      Accept: 'application/json'
    }
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      body.message ||
      body.error ||
      `Erreur HTTP ${response.status}`;

    throw new Error(`football-data.org : ${message}`);
  }

  dateFrom = from;
  dateTo = to;
  apiMatches = body.matches || [];

  console.log(
    `${from} → ${to} : ${apiMatches.length} match(s)`
  );

  if (apiMatches.length) break;
}

const matches = apiMatches
  .map(match => {
    const state = eventState(match.status);

    return {
      id: `football-data-${match.id}`,
      source: 'football-data.org',

      left: match.homeTeam?.shortName ||
        match.homeTeam?.name ||
        'Équipe domicile',

      right: match.awayTeam?.shortName ||
        match.awayTeam?.name ||
        'Équipe extérieure',

      leftLogo: match.homeTeam?.crest || '',
      rightLogo: match.awayTeam?.crest || '',

      leftScore: scoreValue(match, 'home'),
      rightScore: scoreValue(match, 'away'),

      cup: match.competition?.name || 'Football',
      league: match.competition?.name || '',
      leagueLogo: match.competition?.emblem || '',
      country: match.area?.name || '',

      status: statusLabel(match.status),
      state,
      live: state === 'live',
      minute: null,

      startTime: match.utcDate || null,
      venue: match.venue || '',
      round:
        match.stage ||
        match.group ||
        (match.matchday ? `Journée ${match.matchday}` : '')
    };
  })
  .sort((a, b) => {
    const first = new Date(a.startTime || 0).getTime();
    const second = new Date(b.startTime || 0).getTime();
    return first - second;
  });

const output = {
  generatedAt: new Date().toISOString(),
  provider: 'football-data.org',
  date,
  dateFrom,
  dateTo,
  timezone: TIMEZONE,
  count: matches.length,
  matches
};

await mkdir('data', { recursive: true });
await writeFile(
  OUTPUT,
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8'
);

console.log(`${matches.length} match(s) enregistré(s) dans ${OUTPUT}`);
