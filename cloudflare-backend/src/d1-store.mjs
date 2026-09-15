import {VERSION, emptyState, seedState, upgradeState, nowIso} from '../../sites-app/src/domain.mjs';

const COLLECTIONS = [
  'companies','contributions','reviews','exportReviews','ballots','flags',
  'advisoryCases','advisoryAdvice','advisoryDailyReports','companyResearch'
];

function sleep(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }
function recordKey(collection,item){
  if(collection==='ballots'){
    if(!item?.companyId||!item?.owner) throw new Error('ballot record missing compound identity');
    return `${item.companyId}:${item.owner}`;
  }
  if(!item?.id) throw new Error(`${collection} record missing id`);
  return item.id;
}
function objectMap(collection,list){ return new Map((list||[]).map(item=>[recordKey(collection,item),item])); }
function jsonStable(value){ return JSON.stringify(value); }

export class D1StateStore {
  constructor(db,{seed=false,lockMs=15000,lockRetries=30}={}){
    if(!db) throw new Error('D1 binding DB is required');
    this.db=db; this.seed=seed; this.lockMs=lockMs; this.lockRetries=lockRetries;
  }

  async init(){
    const now=nowIso();
    await this.db.prepare(`INSERT OR IGNORE INTO ltp_meta(id,revision,schema_version,app_version,created_at,updated_at) VALUES(1,0,?1,?2,?3,?3)`)
      .bind('0.8',VERSION,now).run();
    if(this.seed){
      const count=await this.db.prepare(`SELECT COUNT(*) AS n FROM ltp_records`).first();
      if(Number(count?.n||0)===0){
        await this.transaction(state=>{
          const seeded=seedState();
          for(const key of COLLECTIONS) state[key]=structuredClone(seeded[key]);
          state.schemaVersion='0.8';state.version=VERSION;
          return {seeded:true};
        });
      }
    }
    return this;
  }

  async read(){
    const meta=await this.db.prepare(`SELECT revision,schema_version,app_version,created_at,updated_at FROM ltp_meta WHERE id=1`).first();
    if(!meta) throw new Error('D1 schema not initialized');
    const result=await this.db.prepare(`SELECT collection,id,json FROM ltp_records ORDER BY collection,id`).all();
    const state=emptyState();
    for(const key of COLLECTIONS) state[key]=[];
    for(const row of result.results||[]){
      if(!COLLECTIONS.includes(row.collection)) continue;
      try{ state[row.collection].push(JSON.parse(row.json)); }
      catch{ throw new Error(`D1 record decode failed for ${row.collection}/${row.id}`); }
    }
    state.schemaVersion=String(meta.schema_version||'0.8');
    state.version=VERSION;
    state.revision=Number(meta.revision||0);
    state.createdAt=String(meta.created_at||nowIso());
    return upgradeState(state);
  }

  async acquireLock(){
    const holder=crypto.randomUUID();
    for(let attempt=0;attempt<this.lockRetries;attempt++){
      const now=Date.now();
      const result=await this.db.prepare(`
        INSERT INTO ltp_write_lock(id,holder,expires_at) VALUES('state',?1,?2)
        ON CONFLICT(id) DO UPDATE SET holder=excluded.holder, expires_at=excluded.expires_at
        WHERE ltp_write_lock.expires_at < ?3 OR ltp_write_lock.holder = ?1
      `).bind(holder,now+this.lockMs,now).run();
      if(Number(result?.meta?.changes||0)===1) return holder;
      await sleep(Math.min(250,20+attempt*8+Math.floor(Math.random()*20)));
    }
    const err=new Error('系统正在处理另一条写入，请稍后重试');err.status=503;throw err;
  }

  async releaseLock(holder){
    try{ await this.db.prepare(`DELETE FROM ltp_write_lock WHERE id='state' AND holder=?1`).bind(holder).run(); }
    catch{/* lease expiry is the fail-safe */}
  }

  async transaction(mutator){
    const holder=await this.acquireLock();
    try{
      const before=await this.read();
      const state=structuredClone(before);
      const result=await mutator(state);
      state.revision=before.revision+1;
      state.schemaVersion='0.8';state.version=VERSION;
      const statements=[];
      const now=nowIso();
      for(const collection of COLLECTIONS){
        const oldMap=objectMap(collection,before[collection]);
        const newMap=objectMap(collection,state[collection]);
        for(const id of oldMap.keys()) if(!newMap.has(id)) statements.push(this.db.prepare(`DELETE FROM ltp_records WHERE collection=?1 AND id=?2`).bind(collection,id));
        for(const [id,item] of newMap){
          const next=jsonStable(item);const prev=oldMap.has(id)?jsonStable(oldMap.get(id)):null;
          if(next!==prev) statements.push(this.db.prepare(`INSERT INTO ltp_records(collection,id,json,updated_at) VALUES(?1,?2,?3,?4) ON CONFLICT(collection,id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at`).bind(collection,id,next,now));
        }
      }
      statements.push(this.db.prepare(`UPDATE ltp_meta SET revision=?1,schema_version=?2,app_version=?3,updated_at=?4 WHERE id=1`).bind(state.revision,'0.8',VERSION,now));
      await this.db.batch(statements);
      return result;
    } finally {
      await this.releaseLock(holder);
    }
  }
}
