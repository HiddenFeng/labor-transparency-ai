import fs from 'node:fs/promises';
import path from 'node:path';
import {emptyState, seedState, upgradeState} from './domain.mjs';

export class FileStore {
  constructor(file,{seed=false}={}){
    this.file = path.resolve(file);
    this.seed = seed;
    this.state = null;
    this.queue = Promise.resolve();
  }
  async init(){
    await fs.mkdir(path.dirname(this.file),{recursive:true});
    try {
      const raw = await fs.readFile(this.file,'utf8');
      this.state = upgradeState(JSON.parse(raw));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.state = upgradeState(this.seed ? seedState() : emptyState());
      await this.#write(this.state);
    }
    return this;
  }
  read(){ return structuredClone(this.state); }
  async transaction(fn){
    let result;
    this.queue = this.queue.then(async()=>{
      const draft = structuredClone(this.state);
      result = await fn(draft);
      draft.revision = Number(draft.revision || 0) + 1;
      await this.#write(draft);
      this.state = draft;
    });
    await this.queue;
    return result;
  }
  async #write(state){
    const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp,JSON.stringify(state,null,2)+'\n',{mode:0o600});
    await fs.rename(tmp,this.file);
    try { await fs.chmod(this.file,0o600); } catch {}
  }
}

// Sites porting seam: replace FileStore with a ChatGPT Sites supported database/storage adapter.
// Keep the public method contract: init(), read(), transaction(mutator).
