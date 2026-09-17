import fs from 'node:fs/promises';
import path from 'node:path';
import {emptyPeerTrustStore,fetchPeerDescriptor,trustPeerDescriptor,validatePeerTrustStore,verifyPeerDescriptor} from '../../sites-app/src/peer-discovery.mjs';
import {loadInstanceBundle} from '../instance/start.mjs';

async function atomicWritePrivate(file,text){await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});const tmp=`${file}.${process.pid}.${Date.now()}.tmp`;try{await fs.writeFile(tmp,text,{mode:0o600});await fs.chmod(tmp,0o600);await fs.rename(tmp,file)}catch(err){await fs.rm(tmp,{force:true});throw err}}

export async function loadPeerContext(dir='.ltp-instance'){
  const bundle=await loadInstanceBundle({dir});const file=path.join(bundle.root,'peers.json');let store;
  try{store=validatePeerTrustStore(JSON.parse(await fs.readFile(file,'utf8')))}catch(err){if(err?.code==='ENOENT')store=emptyPeerTrustStore();else throw new Error(`peer trust store 读取/校验失败：${err.message}`)}
  return {bundle,file,store};
}
export async function savePeerStore(file,store){const valid=validatePeerTrustStore(store);await atomicWritePrivate(file,JSON.stringify(valid,null,2)+'\n');return valid;}
export async function loadDescriptorInput(value,{allowNetwork=false}={}){
  const input=String(value||'').trim();if(!input)throw new Error('必须提供 peer descriptor 路径或 URL');
  if(/^https?:\/\//i.test(input)){const out=await fetchPeerDescriptor(input,{allowNetwork});return {descriptor:out.descriptor,source:out.url};}
  const file=path.resolve(input);let descriptor;try{descriptor=JSON.parse(await fs.readFile(file,'utf8'));verifyPeerDescriptor(descriptor)}catch(err){throw new Error(`peer descriptor 文件读取/校验失败：${err.message}`)}return {descriptor,source:file};
}
export async function trustDescriptorIntoInstance({dir='.ltp-instance',descriptorInput,allowNetwork=false,trustedAt=new Date().toISOString()}={}){
  const ctx=await loadPeerContext(dir);const loaded=await loadDescriptorInput(descriptorInput,{allowNetwork});const result=trustPeerDescriptor(ctx.store,loaded.descriptor,{descriptorSource:loaded.source,ownInstanceId:ctx.bundle.instance.id,trustedAt});await savePeerStore(ctx.file,result.store);return {...result,source:loaded.source,file:ctx.file,bundle:ctx.bundle};
}
