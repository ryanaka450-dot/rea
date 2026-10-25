export const STAT_FIELDS = [
  ['offensiveAwareness','Offensive Awareness'],['ballControl','Ball Control'],['dribbling','Dribbling'],
  ['tightPossession','Tight Possession'],['lowPass','Low Pass'],['loftedPass','Lofted Pass'],
  ['finishing','Finishing'],['heading','Heading'],['placeKicking','Place Kicking'],['curl','Curl'],
  ['defensiveAwareness','Defensive Awareness'],['tackling','Tackling'],['aggression','Aggression'],
  ['defensiveEngagement','Defensive Engagement'],['speed','Speed'],['acceleration','Acceleration'],
  ['kickingPower','Kicking Power'],['jumping','Jumping'],['physicalContact','Physical Contact'],
  ['balance','Balance'],['stamina','Stamina']
];

const slug = value => String(value || 'unknown').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'unknown';

export function parseCsv(text) {
  const lines = String(text).replace(/^\uFEFF/,'').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one card row.');
  const parseLine = line => {
    const cells = []; let value = ''; let quoted = false;
    for (let index=0; index<line.length; index++) {
      const char = line[index];
      if (char === '"' && line[index+1] === '"' && quoted) { value += '"'; index++; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; }
      else value += char;
    }
    if (quoted) throw new Error('CSV has a quote that was not closed.');
    cells.push(value.trim()); return cells;
  };
  const headers = parseLine(lines.shift()).map(header => header.trim());
  if (new Set(headers).size !== headers.length) throw new Error('CSV has duplicate column names.');
  return lines.map(line => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header,index) => [header,values[index] ?? '']));
  });
}

export function parseDatasetPayload(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.cards)) return value.cards;
  if (value && Array.isArray(value.players)) return value.players;
  throw new Error('JSON must be a card array or contain a cards (or legacy players) array.');
}

export function normalizeCard(raw, rowNumber = 1, now = new Date()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Row ${rowNumber}: expected an object.`);
  const name = String(raw.name || raw.playerName || '').trim();
  if (!name) throw new Error(`Row ${rowNumber}: player name is required.`);
  const position = String(raw.position || raw.positions?.[0] || '').trim().toUpperCase();
  const cardType = String(raw.cardType || raw.card_type || raw.type || 'Unknown').trim();
  const cardVersion = String(raw.cardVersion || raw.card_version || raw.version || 'Unspecified').trim();
  const gameVersion = String(raw.gameVersion || raw.game_version || 'Unknown').trim();
  const statsInput = raw.stats && typeof raw.stats === 'object' ? raw.stats : raw;
  const stats = {};
  const errors = [];
  for (const [key] of STAT_FIELDS) {
    const candidate = statsInput[key];
    if (candidate === '' || candidate === null || candidate === undefined) continue;
    const number = Number(candidate);
    if (!Number.isInteger(number) || number < 0 || number > 130) errors.push(`${key} must be a whole number from 0 to 130`);
    else stats[key] = number;
  }
  const ratingInput = raw.rating ?? raw.overallRating ?? raw.overall_rating;
  let rating = null;
  if (ratingInput !== '' && ratingInput !== null && ratingInput !== undefined) {
    rating = Number(ratingInput);
    if (!Number.isInteger(rating) || rating < 1 || rating > 120) errors.push('rating must be a whole number from 1 to 120');
  }
  if (!Object.keys(stats).length) errors.push('at least one supported stat is required');
  if (errors.length) throw new Error(`Row ${rowNumber}: ${errors.join('; ')}.`);

  const playerId = String(raw.playerId || raw.player_id || `player-${slug(name)}`);
  const cardId = String(raw.cardId || raw.card_id || raw.id || [playerId,slug(position),slug(cardType),slug(cardVersion),slug(gameVersion)].join(':'));
  const sourceRaw = raw.source && typeof raw.source === 'object' ? raw.source : {};
  const sourceName = String(sourceRaw.name || raw.sourceName || raw.source_name || 'User import').trim();
  const capturedAt = String(sourceRaw.capturedAt || sourceRaw.captured_at || raw.capturedAt || raw.captureDate || raw.capture_date || raw.importedAt || now.toISOString().slice(0,10));
  const sourceUrl = String(sourceRaw.url || raw.sourceUrl || raw.source_url || '').trim();
  const confidence = String(sourceRaw.confidence || raw.confidence || 'User-provided; not independently verified').trim();
  const verification = String(sourceRaw.verification || raw.verificationStatus || 'unverified').trim();
  const card = {
    cardId, playerId, cardType, cardVersion, gameVersion, position,
    positions: Array.isArray(raw.positions) ? raw.positions.map(value => String(value).trim().toUpperCase()).filter(Boolean) : position ? [position] : [],
    playStyle: String(raw.playStyle || raw.playstyle || raw.role || '').trim(),
    team: String(raw.team || '').trim() || null,
    rating,
    stats,
    baseStats: raw.baseStats && typeof raw.baseStats === 'object' ? raw.baseStats : null,
    trainedStats: raw.trainedStats && typeof raw.trainedStats === 'object' ? raw.trainedStats : null,
    skills: Array.isArray(raw.skills) ? raw.skills.map(String) : [],
    boosters: Array.isArray(raw.boosters) ? raw.boosters.map(String) : [],
    source: {name:sourceName,url:sourceUrl || null,capturedAt,confidence,verification},
    history: Array.isArray(raw.history) ? raw.history : []
  };
  const player = {playerId,name};
  return {player,card};
}

export function stageImport(rows, existingCards = [], now = new Date()) {
  const existingIds = new Set(existingCards.map(card => card.cardId));
  const seen = new Set();
  const accepted = [];
  const rejected = [];
  rows.forEach((row,index) => {
    try {
      const record = normalizeCard(row,index+1,now);
      if (seen.has(record.card.cardId)) throw new Error(`Row ${index+1}: duplicate card ID in this file (${record.card.cardId}).`);
      seen.add(record.card.cardId);
      accepted.push({...record, action:existingIds.has(record.card.cardId) ? 'update' : 'add', rowNumber:index+1});
    } catch (error) { rejected.push({rowNumber:index+1,error:error.message.replace(/^Row \d+:\s*/, '')}); }
  });
  return {accepted,rejected};
}

export function applyStagedImport(dataset, staged, now = new Date()) {
  const players = new Map((dataset.players || []).map(player => [player.playerId,player]));
  const cards = new Map((dataset.cards || []).map(card => [card.cardId,card]));
  let added = 0, updated = 0;
  for (const record of staged) {
    const existing = cards.get(record.card.cardId);
    players.set(record.player.playerId,record.player);
    if (existing) {
      const oldRevision = {cardId:existing.cardId,cardVersion:existing.cardVersion,gameVersion:existing.gameVersion,stats:existing.stats,source:existing.source,archivedAt:now.toISOString()};
      cards.set(record.card.cardId,{...record.card,history:[...(existing.history || []),oldRevision]});
      updated++;
    } else {
      cards.set(record.card.cardId,record.card);
      added++;
    }
  }
  return {dataset:{schemaVersion:2,players:[...players.values()],cards:[...cards.values()],builds:dataset.builds || []},added,updated};
}

export function joinCards(dataset) {
  const players = new Map((dataset.players || []).map(player => [player.playerId,player]));
  return (dataset.cards || []).map(card => ({...card,...players.get(card.playerId),id:card.cardId,name:players.get(card.playerId)?.name || 'Unknown player',role:card.playStyle || ''}));
}

export function searchCards(cards, query) {
  const term = String(query || '').trim().toLocaleLowerCase();
  if (!term) return cards;
  return cards.filter(card => [card.name,card.position,card.cardType,card.cardVersion,card.gameVersion,card.playStyle,card.team,card.source?.name].join(' ').toLocaleLowerCase().includes(term));
}

export function recommendationsFor(card, targetData, roleDefinition, fakeMoves = false) {
  const map = Object.fromEntries(targetData.map(item => [item.key,item]));
  const keys = [...roleDefinition.targets];
  if (roleDefinition.targets.includes('dribbling') && fakeMoves) { /* target is raised below */ }
  if (roleDefinition.includeCombined && !keys.includes('dribbleBalance')) keys.push('dribbleBalance');
  return keys.map((key,index) => {
    const rule = map[key];
    const target = key === 'dribbling' && fakeMoves ? 91 : rule.target;
    const value = rule.isCombined
      ? Number.isFinite(card.stats?.dribbling) && Number.isFinite(card.stats?.balance) ? card.stats.dribbling + card.stats.balance : null
      : Number.isFinite(card.stats?.[key]) ? card.stats[key] : null;
    return {key,name:rule.name,target,value,gap:value === null ? null : Math.max(0,target-value),met:value !== null && value >= target,rank:index+1,reason:rule.summary,source:rule.source};
  });
}

