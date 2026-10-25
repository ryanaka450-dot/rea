import research from './data/research.json' with { type: 'json' };

const STORAGE_KEY = 'touchline-lab.players.v1';
const stats = [
  ['ballControl', 'Ball Control'], ['dribbling', 'Dribbling'], ['tightPossession', 'Tight Possession'],
  ['speed', 'Speed'], ['acceleration', 'Acceleration'], ['physicalContact', 'Physical Contact'],
  ['balance', 'Balance'], ['stamina', 'Stamina'], ['lowPass', 'Low Pass'], ['loftedPass', 'Lofted Pass'],
  ['finishing', 'Finishing'], ['defensiveAwareness', 'Defensive Awareness'], ['tackling', 'Tackling'],
  ['aggression', 'Aggression'], ['defensiveEngagement', 'Defensive Engagement'], ['jumping', 'Jumping'],
  ['heading', 'Heading'], ['kickingPower', 'Kicking Power']
];
const targets = Object.fromEntries(research.targets.map(item => [item.key, item]));
let players = loadPlayers();
let toastTimer;

function loadPlayers() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return [...research.players, ...(Array.isArray(saved) ? saved : [])];
  } catch { return [...research.players]; }
}
function persistPlayers() {
  const sampleIds = new Set(research.players.map(player => player.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players.filter(player => !sampleIds.has(player.id))));
}
function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}
function playerById(id) { return players.find(player => player.id === id) || players[0]; }
function playerLabel(player) { return `${player.name} · ${player.position || '—'}${player.rating ? ` · ${player.rating} OVR*` : ''}`; }
function statValue(player, key) {
  const value = Number(player?.stats?.[key]);
  return Number.isFinite(value) ? value : null;
}
function targetFor(key, fakeMoves = false) {
  return key === 'dribbling' && fakeMoves ? 91 : targets[key]?.target;
}
function metCount(player) {
  return research.targets.filter(item => {
    if (item.isCombined) {
      const dribble = statValue(player, 'dribbling');
      const balance = statValue(player, 'balance');
      return dribble !== null && balance !== null && dribble + balance >= item.target;
    }
    const value = statValue(player, item.key);
    return value !== null && value >= item.target;
  }).length;
}
function refreshSelect(select, selectedId) {
  select.innerHTML = players.map(player => `<option value="${safe(player.id)}">${safe(playerLabel(player))}</option>`).join('');
  select.value = players.some(player => player.id === selectedId) ? selectedId : players[0]?.id || '';
}
function initials(name = '') { return name.split(/\s+/).filter(Boolean).slice(0,2).map(word => word[0].toUpperCase()).join('') || '??'; }
function selectedFeatured() { return playerById(document.querySelector('#featured-player').value); }

function renderOverview() {
  const player = selectedFeatured();
  const count = research.targets.length;
  document.querySelector('#player-count').textContent = String(players.length).padStart(2, '0');
  document.querySelector('#targets-met').innerHTML = `${metCount(player)}<span>/${count}</span>`;
  document.querySelector('#featured-name').textContent = player.name;
  document.querySelector('#portrait-initials').textContent = initials(player.name);
  document.querySelector('.portrait-tag').textContent = player.position || '—';
  document.querySelector('.player-nation').innerHTML = `${safe(player.role || 'PLAYER')} <span>·</span> ${safe(player.position || '—')}`;
  document.querySelector('.rating').innerHTML = `${player.rating ? safe(player.rating) : '—'}<small>OVR*</small>`;
  document.querySelector('#featured-skills').textContent = (player.skills || []).slice(0,3).join(' · ') || 'No skills entered';
  const keys = ['ballControl','dribbling','tightPossession','speed','acceleration','physicalContact','balance','stamina'];
  document.querySelector('#overview-attributes').innerHTML = keys.map(key => {
    const definition = targets[key];
    const value = statValue(player, key);
    const target = definition.target;
    const width = value === null ? 0 : Math.max(0, Math.min(100, value));
    const marker = Math.max(0, Math.min(100, target));
    return `<div class="attribute-row"><span class="attribute-name">${safe(definition.name)}</span><div class="bar-track" title="Research guide: ${target}"><span class="bar-fill" style="width:${width}%"></span><span class="bar-target" style="left:${marker}%"></span></div><span class="attribute-value">${value ?? '—'}</span></div>`;
  }).join('');
  document.querySelector('#insight-title').textContent = 'A useful target has a reason';
  document.querySelector('#insight-body').textContent = 'The supplied research places Acceleration 90 at the last full-value step. On this card, that target is already met; you can focus points elsewhere according to your role.';
}

function renderRecommendations() {
  const player = playerById(document.querySelector('#builder-player').value);
  const role = research.roles[document.querySelector('#build-role').value] || research.roles.allrounder;
  const fakeMoves = document.querySelector('#uses-fakes').checked;
  const recommendations = role.targets.map((key, index) => ({definition:targets[key], key, index, target:targetFor(key, fakeMoves)}));
  if (document.querySelector('#build-role').value === 'dribbler') recommendations.push({definition:targets.dribbleBalance,key:'dribbleBalance',index:recommendations.length,target:targets.dribbleBalance.target});
  const rows = recommendations.map(item => {
    const {key,definition,target} = item;
    const value = key === 'dribbleBalance'
      ? [statValue(player,'dribbling'),statValue(player,'balance')].every(part => part !== null) ? statValue(player,'dribbling') + statValue(player,'balance') : null
      : statValue(player,key);
    const ready = value !== null && value >= target;
    const gap = value === null ? null : Math.max(0, target - value);
    const action = value === null ? 'Add value' : ready ? 'Target met' : `+${gap} to target`;
    const note = key === 'dribbleBalance'
      ? `${definition.summary} Current combined value: ${value ?? 'incomplete'} / ${target}.`
      : definition.summary;
    return `<article class="recommendation"><span class="priority-index">${String(item.index + 1).padStart(2,'0')}</span><div><h3>${safe(definition.name)} <span style="color:#798b7e;font-weight:400">· ${ready ? 'on target' : value === null ? 'missing data' : `current ${value}`}</span></h3><p>${safe(note)}</p></div><span><span class="target-pill ${ready?'met':''}">${safe(action)}</span><small class="target-gap">${key === 'dribbleBalance' ? 'COMBINED STAT GUIDE' : `GUIDE ${target}`}</small></span></article>`;
  });
  document.querySelector('#build-title').textContent = role.label;
  document.querySelector('#build-count').textContent = `${recommendations.length} PRIORITIES`;
  document.querySelector('#recommendations').innerHTML = rows.join('');
}

function renderCompare() {
  const first = playerById(document.querySelector('#compare-a').value);
  const second = playerById(document.querySelector('#compare-b').value);
  document.querySelector('#compare-summary').innerHTML = [first,second].map(player => `<div class="compare-person"><strong>${safe(player.name)}</strong><span>${safe(player.role || 'Player')} · ${safe(player.position || '—')}</span></div>`).join('');
  const compareKeys = ['ballControl','dribbling','tightPossession','lowPass','loftedPass','finishing','speed','acceleration','physicalContact','balance','stamina','defensiveAwareness','tackling'];
  document.querySelector('#compare-attributes').innerHTML = compareKeys.map(key => {
    const def = targets[key];
    const label = def?.name || stats.find(entry => entry[0] === key)?.[1] || key;
    const left = statValue(first,key), right = statValue(second,key);
    const delta = left === null || right === null ? '—' : left === right ? '—' : left > right ? `+${left-right}` : `−${right-left}`;
    const leftWidth = left === null ? 0 : Math.min(100,Math.max(0,left));
    const rightWidth = right === null ? 0 : Math.min(100,Math.max(0,right));
    return `<div class="compare-row"><span class="name">${safe(label)}</span><div><div class="compare-val">${left ?? '—'}</div><div class="compare-track"><span style="width:${leftWidth}%"></span></div></div><span class="compare-delta ${left !== null && right !== null && left > right ? 'winner' : ''}">${safe(delta)}</span><div><div class="compare-val right">${right ?? '—'}</div><div class="compare-track right"><span style="width:${rightWidth}%"></span></div></div></div>`;
  }).join('');
}

function renderResearch() {
  const targetCards = research.targets.filter(item => !item.isCombined).map(item => `<article class="research-card"><span class="research-number">TARGET ${item.target}</span><h3>${safe(item.name)}</h3><p>${safe(item.summary)}</p><span class="source-type">COMMUNITY RESEARCH</span></article>`);
  const skillCards = research.skills.slice(0,3).map(item => `<article class="research-card"><span class="research-number">SKILL EFFECT</span><h3>${safe(item.name)}</h3><p>${safe(item.effect)}</p><span class="source-type">${safe(item.category.toUpperCase())} · USER-SUPPLIED</span></article>`);
  document.querySelector('#research-grid').innerHTML = targetCards.concat(skillCards).join('');
}

function refreshAll() {
  const featuredValue = document.querySelector('#featured-player').value;
  const builderValue = document.querySelector('#builder-player').value;
  const compareAValue = document.querySelector('#compare-a').value;
  const compareBValue = document.querySelector('#compare-b').value;
  refreshSelect(document.querySelector('#featured-player'), featuredValue);
  refreshSelect(document.querySelector('#builder-player'), builderValue || featuredValue);
  refreshSelect(document.querySelector('#compare-a'), compareAValue || featuredValue);
  refreshSelect(document.querySelector('#compare-b'), compareBValue || players[1]?.id || players[0]?.id);
  renderOverview();
  renderRecommendations();
  renderCompare();
}

function switchView(name) {
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === `view-${name}`));
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  document.querySelector('#crumb-current').textContent = name.replace('-', ' ').toUpperCase();
  window.scrollTo({top:0,behavior:'smooth'});
}
function notify(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
function showPlayerModal() {
  const form = document.querySelector('#stat-form');
  form.innerHTML = stats.map(([key,label]) => `<label>${safe(label)}<input type="number" name="${safe(key)}" min="1" max="130" inputmode="numeric" placeholder="—" /></label>`).join('');
  document.querySelector('#player-modal').hidden = false;
  document.querySelector('#player-form').elements.name.focus();
}
function hidePlayerModal() { document.querySelector('#player-modal').hidden = true; }
function normalizePlayer(raw, index = 0) {
  if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || !raw.name.trim()) throw new Error(`Row ${index + 1}: a non-empty name is required.`);
  const playerStats = {};
  const inputStats = raw.stats && typeof raw.stats === 'object' ? raw.stats : raw;
  for (const [key] of stats) {
    const value = inputStats[key];
    if (value === '' || value === null || value === undefined) continue;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 130) throw new Error(`Row ${index + 1}: ${key} must be a whole number from 1 to 130.`);
    playerStats[key] = number;
  }
  const rating = raw.rating === '' || raw.rating === undefined || raw.rating === null ? null : Number(raw.rating);
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 110)) throw new Error(`Row ${index + 1}: rating must be a whole number from 1 to 110.`);
  const id = String(raw.id || `${raw.name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${String(raw.position || '').toLowerCase()}`);
  return {id,name:raw.name.trim(),position:String(raw.position || '').trim().toUpperCase(),role:String(raw.role || '').trim(),rating,stats:playerStats,skills:Array.isArray(raw.skills) ? raw.skills.map(String) : [],confidence:raw.confidence || 'User-entered card data'};
}
function upsertPlayers(incoming) {
  const normalized = incoming.map((player,index) => normalizePlayer(player,index));
  const byId = new Map(players.map(player => [player.id,player]));
  normalized.forEach(player => {
    const matching = [...byId.values()].find(existing => existing.name.trim().toLowerCase() === player.name.trim().toLowerCase() && (existing.position || '').toLowerCase() === (player.position || '').toLowerCase());
    if (matching) player.id = matching.id;
    byId.set(player.id,player);
  });
  players = [...byId.values()];
  persistPlayers();
  refreshAll();
}
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one player row.');
  const rows = lines.map(line => {
    const cells = []; let value = ''; let quoted = false;
    for (let index=0; index<line.length; index++) {
      const char = line[index];
      if (char === '"' && line[index+1] === '"' && quoted) { value += '"'; index++; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; }
      else value += char;
    }
    cells.push(value.trim()); return cells;
  });
  const headers = rows.shift().map(header => header.trim());
  return rows.map(row => Object.fromEntries(headers.map((header,index) => [header,row[index] ?? ''])));
}
async function handleImport(file) {
  try {
    const text = await file.text();
    const incoming = file.name.toLowerCase().endsWith('.csv') ? parseCsv(text) : (() => {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed.players)) return parsed.players;
      throw new Error('JSON must be a player array or an object with a players array.');
    })();
    upsertPlayers(incoming);
    notify(`Imported ${incoming.length} player${incoming.length === 1 ? '' : 's'}; workspace saved in this browser.`);
  } catch (error) { notify(error.message || 'Could not import that file.'); }
}

document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.goto)));
document.querySelector('#featured-player').addEventListener('change', renderOverview);
document.querySelector('#builder-player').addEventListener('change', renderRecommendations);
document.querySelector('#build-role').addEventListener('change', renderRecommendations);
document.querySelector('#uses-fakes').addEventListener('change', renderRecommendations);
document.querySelector('#recalc-button').addEventListener('click', () => { renderRecommendations(); notify('Recommendations refreshed from the selected research profile.'); });
document.querySelector('#compare-a').addEventListener('change', renderCompare);
document.querySelector('#compare-b').addEventListener('change', renderCompare);
document.querySelector('#open-player-modal').addEventListener('click', showPlayerModal);
document.querySelector('#compare-add-player').addEventListener('click', showPlayerModal);
document.querySelector('#close-modal').addEventListener('click', hidePlayerModal);
document.querySelector('#cancel-modal').addEventListener('click', hidePlayerModal);
document.querySelector('#player-modal').addEventListener('click', event => { if (event.target.id === 'player-modal') hidePlayerModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') hidePlayerModal(); });
document.querySelector('#player-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const player = {name:form.get('name'),position:form.get('position'),role:form.get('role'),rating:form.get('rating'),stats:{},skills:[]};
  for (const [key] of stats) player.stats[key] = form.get(key);
  try { upsertPlayers([player]); hidePlayerModal(); event.currentTarget.reset(); notify(`${player.name} added to your workspace.`); }
  catch (error) { notify(error.message); }
});
document.querySelector('#import-button').addEventListener('click', () => document.querySelector('#import-file').click());
document.querySelector('#research-import').addEventListener('click', () => document.querySelector('#import-file').click());
document.querySelector('#import-file').addEventListener('change', event => { if (event.target.files[0]) handleImport(event.target.files[0]); event.target.value = ''; });
const about = () => alert('Touchline Lab is a small, independent eFootball analysis workspace. The sample and research notes were supplied by the owner. It does not scrape eFootBase, retrieve live card data, calculate OVR, or claim an exact progression-point optimizer.');
document.querySelector('#help-button').addEventListener('click', about);
document.querySelector('#footer-about').addEventListener('click', about);

renderResearch();
refreshAll();

