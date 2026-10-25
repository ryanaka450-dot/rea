import research from './data/research.json' with { type: 'json' };
import {STAT_FIELDS,stageImport,applyStagedImport,joinCards,searchCards,recommendationsFor} from './domain.js';
import {sourceAdapters,readLocalImport} from './data-adapters.js';

const STORAGE_KEY = 'touchline-lab.dataset.v2';
const LEGACY_KEY = 'touchline-lab.players.v1';
const targets = research.targets;
const targetMap = Object.fromEntries(targets.map(item => [item.key,item]));
let dataset = loadDataset();
let cards = joinCards(dataset);
let stagedPreview = null;
let toastTimer;

function seedDataset() {
  return {schemaVersion:2,players:research.players,cards:research.cards,builds:[]};
}
function loadDataset() {
  const seed = seedDataset();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.players) && Array.isArray(saved.cards)) {
      const players = new Map(seed.players.map(item => [item.playerId,item]));
      saved.players.forEach(item => players.set(item.playerId,item));
      const records = new Map(seed.cards.map(item => [item.cardId,item]));
      saved.cards.forEach(item => records.set(item.cardId,item));
      return {schemaVersion:2,players:[...players.values()],cards:[...records.values()],builds:Array.isArray(saved.builds)?saved.builds:[]};
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (Array.isArray(legacy) && legacy.length) {
      const staged = stageImport(legacy,seed.cards).accepted;
      return applyStagedImport(seed,staged).dataset;
    }
  } catch { /* A broken local cache should not prevent the supplied dataset from loading. */ }
  return seed;
}
function persistDataset() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(dataset)); }
  catch { notify('Browser storage is unavailable. Export your data before closing this tab.'); }
}
function refreshCards() { cards = joinCards(dataset); }
function safe(value) { return String(value ?? '').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); }
function cardById(id) { return cards.find(card=>card.cardId===id) || cards[0] || null; }
function cardLabel(card) { return `${card.name} · ${card.position || '—'} · ${card.cardVersion || 'Version unknown'} · ${card.gameVersion || 'Game version unknown'}`; }
function statValue(card,key) { const value=Number(card?.stats?.[key]); return Number.isFinite(value)?value:null; }
function initials(name='') { return name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0].toUpperCase()).join('')||'??'; }
function selectedCard(id) { return cardById(id); }

function refreshSelect(select,selectedId) {
  select.innerHTML=cards.map(card=>`<option value="${safe(card.cardId)}">${safe(cardLabel(card))}</option>`).join('');
  select.value=cards.some(card=>card.cardId===selectedId)?selectedId:cards[0]?.cardId||'';
}
function selectedFeatured() { return selectedCard(document.querySelector('#featured-player').value); }
function satisfiedTargets(card) {
  return targets.filter(rule=>{
    if(rule.isCombined) return statValue(card,'dribbling')!==null&&statValue(card,'balance')!==null&&statValue(card,'dribbling')+statValue(card,'balance')>=rule.target;
    return statValue(card,rule.key)!==null&&statValue(card,rule.key)>=rule.target;
  }).length;
}
function renderOverview() {
  const card=selectedFeatured();
  document.querySelector('#player-count').textContent=String(cards.length).padStart(2,'0');
  document.querySelector('#targets-met').innerHTML=card?`${satisfiedTargets(card)}<span>/${targets.length}</span>`:`—<span>/${targets.length}</span>`;
  if(!card) return;
  document.querySelector('#featured-name').textContent=card.name;
  document.querySelector('#portrait-initials').textContent=initials(card.name);
  document.querySelector('.portrait-tag').textContent=card.position||'—';
  document.querySelector('.player-nation').innerHTML=`${safe(card.role||'PLAYER')} <span>·</span> ${safe(card.position||'—')}`;
  document.querySelector('.rating').innerHTML=`${card.rating??'—'}<small>SUPPLIED RATING</small>`;
  document.querySelector('#featured-skills').textContent=(card.skills||[]).slice(0,4).join(' · ')||'No skills entered';
  document.querySelector('#featured-version').textContent=`${card.cardType||'Unknown type'} · ${card.cardVersion||'Version unknown'} · ${card.gameVersion||'Game version unknown'}`;
  const keys=['ballControl','dribbling','tightPossession','speed','acceleration','physicalContact','balance','stamina'];
  document.querySelector('#overview-attributes').innerHTML=keys.map(key=>{
    const rule=targetMap[key],value=statValue(card,key),width=value===null?0:Math.max(0,Math.min(100,value));
    return `<div class="attribute-row"><span class="attribute-name">${safe(rule.name)}</span><div class="bar-track" title="Research guide: ${rule.target}"><span class="bar-fill" style="width:${width}%"></span><span class="bar-target" style="left:${Math.min(100,rule.target)}%"></span></div><span class="attribute-value">${value??'—'}</span></div>`;
  }).join('');
  const source=card.source||{};
  document.querySelector('#overview-provenance').innerHTML=`<span>${safe(card.gameVersion||'GAME VERSION UNKNOWN')}</span><span>${safe(source.name||'SOURCE UNKNOWN')} · ${safe(source.capturedAt||'DATE UNKNOWN')}</span><span>${safe(source.confidence||'CONFIDENCE UNKNOWN')}</span>`;
  document.querySelector('#insight-title').textContent='A useful target has a reason';
  document.querySelector('#insight-body').textContent='The supplied research places Acceleration 90 at the last full-value step. Recommendations are based on this card’s entered values and the selected role.';
  document.querySelector('.card-foot').innerHTML=`<span>CARD PROFILE</span><span>${cards.length} CARD${cards.length===1?'':'S'} <b>↗</b></span>`;
}

function renderRecommendations() {
  const card=cardById(document.querySelector('#builder-player').value);
  const roleKey=document.querySelector('#build-role').value;
  const role=research.roles[roleKey]||research.roles.allrounder;
  if(!card){document.querySelector('#recommendations').innerHTML='<p class="empty-note">Import or add a card to get started.</p>';return;}
  const plan=recommendationsFor(card,targets,{...role,includeCombined:roleKey==='dribbler'},document.querySelector('#uses-fakes').checked);
  document.querySelector('#build-title').textContent=role.label;
  document.querySelector('#build-count').textContent=`${plan.length} TARGETS`;
  document.querySelector('#recommendations').innerHTML=plan.map((item,index)=>{
    const state=item.value===null?'missing data':item.met?'target met':`current ${item.value}`;
    const action=item.value===null?'Add value':item.met?'Target met':`+${item.gap} to target`;
    return `<article class="recommendation"><span class="priority-index">${String(index+1).padStart(2,'0')}</span><div><h3>${safe(item.name)} <span class="rec-state">· ${safe(state)}</span></h3><p>${safe(item.reason)}</p><small class="rec-source">SOURCE: ${safe(item.source||'User-supplied research')}</small></div><span><span class="target-pill ${item.met?'met':''}">${safe(action)}</span><small class="target-gap">GUIDE ${item.target}</small></span></article>`;
  }).join('');
  renderSavedBuilds();
}

function renderCompare() {
  const first=cardById(document.querySelector('#compare-a').value),second=cardById(document.querySelector('#compare-b').value);
  if(!first||!second){document.querySelector('#compare-summary').innerHTML='<p class="empty-note">Add card data to compare players.</p>';document.querySelector('#compare-attributes').innerHTML='';return;}
  const same=first.cardId===second.cardId;
  document.querySelector('#compare-summary').innerHTML=[first,second].map(card=>`<div class="compare-person"><strong>${safe(card.name)}</strong><span>${safe(card.cardType)} · ${safe(card.cardVersion)} · ${safe(card.position||'—')}</span></div>`).join('')+(same?'<p class="compare-empty-hint">Choose a different card version or import another card to see differences.</p>':'');
  const compareKeys=['ballControl','dribbling','tightPossession','lowPass','loftedPass','finishing','speed','acceleration','physicalContact','balance','stamina','defensiveAwareness','tackling'];
  document.querySelector('#compare-attributes').innerHTML=compareKeys.map(key=>{
    const label=targetMap[key]?.name||STAT_FIELDS.find(entry=>entry[0]===key)?.[1]||key;
    const left=statValue(first,key),right=statValue(second,key);
    const delta=left===null||right===null?'—':left===right?'—':left>right?`+${left-right}`:`−${right-left}`;
    const leftWidth=left===null?0:Math.min(100,Math.max(0,left)),rightWidth=right===null?0:Math.min(100,Math.max(0,right));
    return `<div class="compare-row"><span class="name">${safe(label)}</span><div><div class="compare-val">${left??'—'}</div><div class="compare-track"><span style="width:${leftWidth}%"></span></div></div><span class="compare-delta ${left!==null&&right!==null&&left>right?'winner':''}">${safe(delta)}</span><div><div class="compare-val right">${right??'—'}</div><div class="compare-track right"><span style="width:${rightWidth}%"></span></div></div></div>`;
  }).join('');
}

function renderLibrary() {
  const query=document.querySelector('#library-search').value;
  const results=searchCards(cards,query);
  document.querySelector('#library-count').textContent=`${results.length} CARD${results.length===1?'':'S'}`;
  document.querySelector('#library-empty').hidden=results.length!==0;
  document.querySelector('#library-rows').innerHTML=results.map(card=>{
    const statCount=Object.keys(card.stats||{}).length;
    const source=card.source||{};
    return `<tr><td><strong>${safe(card.name)}</strong><small>${safe(card.cardType||'Unknown type')} · ${safe(card.cardVersion||'Version unknown')}</small></td><td>${safe(card.position||'—')}</td><td>${safe(card.gameVersion||'Unknown')}</td><td><span>${safe(source.name||'Unknown source')}</span><small>${safe(source.capturedAt||'Date unknown')}</small></td><td><span class="data-tag">${statCount} STATS · ${safe(source.verification||'unverified')}</span></td><td><button class="text-button use-card" data-card-id="${safe(card.cardId)}">Select →</button></td></tr>`;
  }).join('');
}

function renderResearch() {
  const targetsHtml=targets.filter(item=>!item.isCombined).map(item=>`<article class="research-card"><span class="research-number">TARGET ${item.target}</span><h3>${safe(item.name)}</h3><p>${safe(item.summary)}</p><span class="source-type">COMMUNITY RESEARCH · ${safe(research.researchDefaults.applicableGameVersion)}</span></article>`);
  const skillHtml=research.skills.slice(0,3).map(item=>`<article class="research-card"><span class="research-number">SKILL EFFECT</span><h3>${safe(item.name)}</h3><p>${safe(item.effect)}</p><span class="source-type">${safe(item.category.toUpperCase())} · USER-SUPPLIED</span></article>`);
  document.querySelector('#research-grid').innerHTML=targetsHtml.concat(skillHtml).join('');
  document.querySelector('#source-adapters').innerHTML=sourceAdapters.map(adapter=>`<div class="adapter-row"><span class="adapter-state ${adapter.status}">${adapter.status==='available'?'READY':'DISABLED'}</span><div><strong>${safe(adapter.name)}</strong><small>${safe(adapter.reason||'Local files are parsed and validated before import.')}</small></div></div>`).join('');
}

function renderSavedBuilds() {
  const container=document.querySelector('#saved-builds');
  if(!container)return;
  if(!dataset.builds.length){container.innerHTML='<p class="empty-note">No saved plans yet. Save a target plan to keep it on this device.</p>';return;}
  container.innerHTML=dataset.builds.map(build=>`<div class="saved-build-row"><div><strong>${safe(build.playerName)} · ${safe(build.roleLabel)}</strong><small>${safe(build.cardVersion)} · ${safe(build.savedAt)} · ${build.recommendations.length} research targets</small></div><span class="heuristic-tag">TARGET PLAN</span><button class="text-button remove-build" data-build-id="${safe(build.buildId)}">Remove</button></div>`).join('');
}

function refreshAll() {
  refreshCards();
  const ids=['featured-player','builder-player','compare-a','compare-b'];
  const previous=Object.fromEntries(ids.map(id=>[id,document.querySelector(`#${id}`).value]));
  ids.forEach(id=>refreshSelect(document.querySelector(`#${id}`),previous[id]));
  renderOverview();renderRecommendations();renderCompare();renderLibrary();renderSavedBuilds();
}
function switchView(name) {
  document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view.id===`view-${name}`));
  document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.view===name));
  document.querySelector('#crumb-current').textContent=name.replace('-',' ').toUpperCase();
  window.scrollTo({top:0,behavior:'smooth'});
}
function notify(message) {
  const toast=document.querySelector('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3000);
}
function openModal(id) { document.querySelector(id).hidden=false; }
function closeModal(id) { document.querySelector(id).hidden=true; }
function showPlayerModal() {
  document.querySelector('#stat-form').innerHTML=STAT_FIELDS.map(([key,label])=>`<label>${safe(label)}<input type="number" name="${safe(key)}" min="0" max="130" inputmode="numeric" placeholder="Unknown" /></label>`).join('');
  openModal('#player-modal');document.querySelector('#player-form').elements.name.focus();
}
function downloadFile(filename,contents,type='application/json') {
  const blob=new Blob([contents],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportDataset() {
  const payload={schemaVersion:2,exportedAt:new Date().toISOString(),source:'Touchline Lab local workspace',players:dataset.players,cards:dataset.cards,builds:dataset.builds};
  downloadFile(`touchline-lab-data-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2));notify('Workspace export downloaded.');
}
function currentPlan() {
  const card=cardById(document.querySelector('#builder-player').value);const roleKey=document.querySelector('#build-role').value;const role=research.roles[roleKey]||research.roles.allrounder;
  if(!card)return null;
  return {card,roleKey,role,recommendations:recommendationsFor(card,targets,{...role,includeCombined:roleKey==='dribbler'},document.querySelector('#uses-fakes').checked)};
}
function saveCurrentPlan() {
  const plan=currentPlan();if(!plan){notify('Select a card first.');return;}
  dataset.builds.unshift({buildId:globalThis.crypto?.randomUUID?.()||`build-${Date.now()}`,cardId:plan.card.cardId,playerName:plan.card.name,cardVersion:plan.card.cardVersion,gameVersion:plan.card.gameVersion,roleKey:plan.roleKey,roleLabel:plan.role.label,savedAt:new Date().toISOString().slice(0,10),type:'research-target-plan',recommendations:plan.recommendations});
  persistDataset();renderSavedBuilds();notify('Research target plan saved on this device.');
}
function exportCurrentPlan() {
  const plan=currentPlan();if(!plan){notify('Select a card first.');return;}
  const output={schemaVersion:1,type:'research-target-plan',player:plan.card,objective:plan.role.label,recommendations:plan.recommendations,method:'Heuristic target guidance; not a progression-point allocation or exact optimizer.',createdAt:new Date().toISOString()};
  downloadFile(`touchline-plan-${plan.card.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json`,JSON.stringify(output,null,2));
}
function updateFromImport(staged) {
  const result=applyStagedImport(dataset,staged);
  dataset=result.dataset;persistDataset();refreshAll();
  return result;
}
function showImportPreview(staged) {
  stagedPreview=staged;
  const adds=staged.accepted.filter(item=>item.action==='add').length,updates=staged.accepted.length-adds;
  document.querySelector('#import-totals').innerHTML=`<span><b>${staged.accepted.length}</b> valid</span><span><b>${adds}</b> new</span><span><b>${updates}</b> updates</span><span class="${staged.rejected.length?'invalid-count':''}"><b>${staged.rejected.length}</b> invalid</span>`;
  document.querySelector('#import-errors').innerHTML=staged.rejected.length?`<div class="import-errors-title">Rows to fix or skip</div>${staged.rejected.slice(0,12).map(item=>`<p>Row ${item.rowNumber}: ${safe(item.error)}</p>`).join('')}${staged.rejected.length>12?`<p>And ${staged.rejected.length-12} more invalid rows.</p>`:''}`:'';
  document.querySelector('#import-preview-list').innerHTML=staged.accepted.slice(0,12).map(record=>`<div><span class="import-action ${record.action}">${record.action.toUpperCase()}</span><strong>${safe(record.player.name)}</strong><small>${safe(record.card.cardType)} · ${safe(record.card.cardVersion)} · ${safe(record.card.gameVersion)} · ${Object.keys(record.card.stats).length} stats</small></div>`).join('')+(staged.accepted.length>12?`<p class="import-more">${staged.accepted.length-12} more valid cards</p>`:'');
  document.querySelector('#confirm-import').disabled=staged.accepted.length===0;
  openModal('#import-modal');
}
async function handleImport(file) {
  try {
    showImportPreview(await readLocalImport(file,dataset.cards));
  } catch(error) { notify(error.message||'Could not read this data file.'); }
}
function clearLocalData() {
  if(!window.confirm('Clear imported cards and saved plans from this browser? The supplied sample card will remain.'))return;
  dataset=seedDataset();persistDataset();refreshAll();notify('Imported cards and saved plans cleared from this browser.');
}

document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.goto)));
document.querySelector('#featured-player').addEventListener('change',renderOverview);
document.querySelector('#builder-player').addEventListener('change',renderRecommendations);
document.querySelector('#build-role').addEventListener('change',renderRecommendations);
document.querySelector('#uses-fakes').addEventListener('change',renderRecommendations);
document.querySelector('#recalc-button').addEventListener('click',()=>{renderRecommendations();notify('Research target guidance refreshed.');});
document.querySelector('#compare-a').addEventListener('change',renderCompare);
document.querySelector('#compare-b').addEventListener('change',renderCompare);
document.querySelector('#library-search').addEventListener('input',renderLibrary);
document.querySelector('#library-rows').addEventListener('click',event=>{const button=event.target.closest('.use-card');if(!button)return;document.querySelector('#featured-player').value=button.dataset.cardId;renderOverview();switchView('overview');});
document.querySelector('#open-player-modal').addEventListener('click',showPlayerModal);
document.querySelector('#compare-add-player').addEventListener('click',showPlayerModal);
document.querySelector('#library-add').addEventListener('click',showPlayerModal);
document.querySelector('#close-modal').addEventListener('click',()=>closeModal('#player-modal'));
document.querySelector('#cancel-modal').addEventListener('click',()=>closeModal('#player-modal'));
document.querySelector('#player-modal').addEventListener('click',event=>{if(event.target.id==='player-modal')closeModal('#player-modal');});
document.querySelector('#player-form').addEventListener('submit',event=>{
  event.preventDefault();const form=new FormData(event.currentTarget);const raw={name:form.get('name'),position:form.get('position'),playStyle:form.get('role'),cardType:form.get('cardType'),cardVersion:form.get('cardVersion'),gameVersion:form.get('gameVersion'),rating:form.get('rating'),stats:{},source:{name:form.get('sourceName')||'Manual user entry',capturedAt:new Date().toISOString().slice(0,10),confidence:'User-entered; not independently verified',verification:'user-entered'}};
  STAT_FIELDS.forEach(([key])=>raw.stats[key]=form.get(key));
  try {const staged=stageImport([raw],dataset.cards);if(!staged.accepted.length)throw new Error(staged.rejected[0]?.error||'Card data is invalid.');const result=updateFromImport(staged.accepted);closeModal('#player-modal');event.currentTarget.reset();notify(`Card saved: ${result.added} added, ${result.updated} updated.`);}
  catch(error){notify(error.message||'Card could not be saved.');}
});
document.querySelector('#import-button').addEventListener('click',()=>document.querySelector('#import-file').click());
document.querySelector('#library-import').addEventListener('click',()=>document.querySelector('#import-file').click());
document.querySelector('#research-import').addEventListener('click',()=>document.querySelector('#import-file').click());
document.querySelector('#import-file').addEventListener('change',event=>{if(event.target.files[0])handleImport(event.target.files[0]);event.target.value='';});
document.querySelector('#close-import').addEventListener('click',()=>closeModal('#import-modal'));
document.querySelector('#cancel-import').addEventListener('click',()=>closeModal('#import-modal'));
document.querySelector('#import-modal').addEventListener('click',event=>{if(event.target.id==='import-modal')closeModal('#import-modal');});
document.querySelector('#confirm-import').addEventListener('click',()=>{if(!stagedPreview)return;const result=updateFromImport(stagedPreview.accepted);closeModal('#import-modal');notify(`Import complete: ${result.added} added, ${result.updated} updated, ${stagedPreview.rejected.length} invalid skipped.`);stagedPreview=null;});
document.querySelector('#export-button').addEventListener('click',exportDataset);
document.querySelector('#library-export').addEventListener('click',exportDataset);
document.querySelector('#save-build').addEventListener('click',saveCurrentPlan);
document.querySelector('#export-build').addEventListener('click',exportCurrentPlan);
document.querySelector('#saved-builds').addEventListener('click',event=>{const button=event.target.closest('.remove-build');if(!button)return;dataset.builds=dataset.builds.filter(build=>build.buildId!==button.dataset.buildId);persistDataset();renderSavedBuilds();notify('Saved plan removed.');});
document.querySelector('#clear-builds').addEventListener('click',()=>{dataset.builds=[];persistDataset();renderSavedBuilds();notify('Saved plans cleared.');});
document.querySelector('#clear-local-data').addEventListener('click',clearLocalData);
const about=()=>alert('Touchline Lab is a personal, local-first eFootball analysis workspace. It uses the sample card and research you supplied. Imported cards and saved plans stay in this browser. No live eFootBase connection or exact progression-point optimizer is configured.');
document.querySelector('#help-button').addEventListener('click',about);
document.querySelector('#footer-about').addEventListener('click',about);
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeModal('#player-modal');closeModal('#import-modal');}});

renderResearch();
refreshAll();

