import {parseCsv,parseDatasetPayload,stageImport} from './domain.js';

export const sourceAdapters = [
  {id:'local-file',name:'User CSV / JSON file',status:'available',kind:'manual-import'},
  {id:'efootbase',name:'eFootBase',status:'disabled',kind:'external',reason:'No documented, permitted API/feed has been confirmed. Automated access is restricted by the terms linked from the site.'}
];

export async function readLocalImport(file,existingCards=[]) {
  const text=await file.text();
  const rows=file.name.toLowerCase().endsWith('.csv')?parseCsv(text):parseDatasetPayload(JSON.parse(text));
  return stageImport(rows,existingCards);
}

export function adapterStatus(id) {
  return sourceAdapters.find(adapter=>adapter.id===id)||null;
}

