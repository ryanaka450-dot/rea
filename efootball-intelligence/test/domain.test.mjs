import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,parseDatasetPayload,normalizeCard,stageImport,applyStagedImport,joinCards,searchCards,recommendationsFor} from '../domain.js';
import research from '../data/research.json' with {type:'json'};

const example = (overrides={}) => ({
  name:'Alex Example',position:'CMF',cardType:'Epic',cardVersion:'2026 Pack A',gameVersion:'eFootball 2027',
  stats:{speed:90,acceleration:88,ballControl:86},source:{name:'My CSV',capturedAt:'2026-10-25',confidence:'user checked',verification:'user-entered'},...overrides
});

test('CSV parser handles quoted commas and keeps headers',()=>{
  const rows=parseCsv('name,position,cardVersion,speed\n"Alex, Jr.",CMF,"Pack, A",90');
  assert.deepEqual(rows,[{name:'Alex, Jr.',position:'CMF',cardVersion:'Pack, A',speed:'90'}]);
});

test('dataset parser accepts current cards and the prior players format',()=>{
  assert.equal(parseDatasetPayload({cards:[example()]}).length,1);
  assert.equal(parseDatasetPayload({players:[example()]}).length,1);
  assert.throws(()=>parseDatasetPayload({}),/cards.*players/);
});

test('separate card versions for one player remain separate records',()=>{
  const first=normalizeCard(example(),1,new Date('2026-10-25T00:00:00Z'));
  const second=normalizeCard(example({cardVersion:'2026 Pack B'}),2,new Date('2026-10-25T00:00:00Z'));
  assert.equal(first.player.playerId,second.player.playerId);
  assert.notEqual(first.card.cardId,second.card.cardId);
  const staged=stageImport([example(),example({cardVersion:'2026 Pack B'})]);
  const merged=applyStagedImport({players:[],cards:[],builds:[]},staged.accepted);
  assert.equal(merged.dataset.players.length,1);
  assert.equal(merged.dataset.cards.length,2);
});

test('import preview rejects invalid stats and duplicate IDs without losing valid rows',()=>{
  const result=stageImport([example(),example({stats:{speed:999}}),example()]);
  assert.equal(result.accepted.length,1);
  assert.equal(result.rejected.length,2);
  assert.match(result.rejected[0].error,/speed/);
  assert.match(result.rejected[1].error,/duplicate card ID/);
});

test('updating a card retains the earlier stats and provenance in revision history',()=>{
  const oldRecord=normalizeCard(example(),1,new Date('2026-10-25T00:00:00Z'));
  const original=applyStagedImport({players:[],cards:[],builds:[]},[oldRecord]).dataset;
  const updated=stageImport([example({stats:{speed:91,acceleration:88,ballControl:86},source:{name:'Updated file',capturedAt:'2026-10-26'}})],original.cards);
  assert.equal(updated.accepted[0].action,'update');
  const result=applyStagedImport(original,updated.accepted,new Date('2026-10-26T00:00:00Z'));
  assert.equal(result.updated,1);
  assert.equal(result.dataset.cards.length,1);
  assert.equal(result.dataset.cards[0].stats.speed,91);
  assert.equal(result.dataset.cards[0].history.length,1);
  assert.equal(result.dataset.cards[0].history[0].stats.speed,90);
  assert.equal(result.dataset.cards[0].history[0].source.name,'My CSV');
});

test('search matches the player, version, source, and position',()=>{
  const dataset=applyStagedImport({players:[],cards:[],builds:[]},stageImport([example()]).accepted).dataset;
  const cards=joinCards(dataset);
  assert.equal(searchCards(cards,'alex').length,1);
  assert.equal(searchCards(cards,'pack a').length,1);
  assert.equal(searchCards(cards,'my csv').length,1);
  assert.equal(searchCards(cards,'RWF').length,0);
});

test('build guidance reports targets and gaps without claiming progression points',()=>{
  const record=normalizeCard(example(),1).card;
  const plan=recommendationsFor(record,research.targets,research.roles.allrounder);
  assert.equal(plan.find(item=>item.key==='speed').met,true);
  assert.equal(plan.find(item=>item.key==='acceleration').gap,2);
  assert.equal(plan.some(item=>Object.hasOwn(item,'progressionPoints')),false);
});

