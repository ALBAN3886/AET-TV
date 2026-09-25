import fs from 'node:fs';

const apiKey = process.env.API_FOOTBALL_KEY;

if (!apiKey) {
  throw new Error('Secret API_FOOTBALL_KEY absent');
}

const timezone = 'Africa/Lome';

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).formatToParts(new Date());

const dateParts = Object.fromEntries(
  parts.map(part => [part.type, part.value])
);

const date = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

const endpoint = new URL(
  'https://v3.football.api-sports.io/fixtures'
);

endpoint.searchParams.set('date', date);
endpoint.searchParams.set('timezone', timezone);

const response = await fetch(endpoint, {
  headers: {
    'x-apisports-key': apiKey
  }
});

if (!response.ok) {
  throw new Error(
    `API Football : HTTP ${response.status}`
  );
}

const data = await response.json();

if (
  data.errors &&
  Object.keys(data.errors).length > 0
) {
  throw new Error(
    `API Football : ${JSON.stringify(data.errors)}`
  );
}

const liveStatuses = new Set([
  '1H', 'HT', '2H', 'ET', 'BT',
  'P', 'SUSP', 'INT', 'LIVE'
]);

const finishedStatuses = new Set([
  'FT', 'AET', 'PEN'
]);

const matches = (data.response || []).map(entry => {
  const shortStatus = entry.fixture?.status?.short || 'NS';

  let state = 'scheduled';

  if (liveStatuses.has(shortStatus)) {
    state = 'live';
  } else if (finishedStatuses.has(shortStatus)) {
    state = 'finished';
  }

  return {
    id: String(entry.fixture?.id || ''),
    left: entry.teams?.home?.name || 'Équipe domicile',
    right: entry.teams?.away?.name || 'Équipe extérieure',
    leftLogo: entry.teams?.home?.logo || '',
    rightLogo: entry.teams?.away?.logo || '',
    leftScore: entry.goals?.home ?? null,
    rightScore: entry.goals?.away ?? null,
    cup: entry.league?.name || 'Football',
    leagueLogo: entry.league?.logo || '',
    country: entry.league?.country || '',
    status: entry.fixture?.status?.long || 'À venir',
    state,
    live: state === 'live',
    minute: entry.fixture?.status?.elapsed ?? null,
    startTime: entry.fixture?.date || '',
    venue: entry.fixture?.venue?.name || '',
    round: entry.league?.round || ''
  };
}).sort((a, b) => {
  return new Date(a.startTime) - new Date(b.startTime);
});

const output = {
  generatedAt: new Date().toISOString(),
  date,
  timezone,
  count: matches.length,
  matches
};

fs.mkdirSync('data', { recursive: true });

fs.writeFileSync(
  'data/football-live.json',
  JSON.stringify(output, null, 2) + '\n',
  'utf8'
);

console.log(`${matches.length} matchs enregistrés pour ${date}.`);
