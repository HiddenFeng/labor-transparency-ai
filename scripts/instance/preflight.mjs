import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {upgradeState} from '../../sites-app/src/domain.mjs';
import {validatePeerTrustStore} from '../../sites-app/src/peer-discovery.mjs';
import {verifyBackupDirectory} from './backup-lib.mjs';
import {loadInstanceBundle} from './start.mjs';

async function optionalJson(file){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch(err){if(err?.code==='ENOENT')return null;throw new Error(`${file} 读取失败：${err.message}`)}}
function assertPrivate(stat,label){if(process.platform!=='win32'&&(stat.mode&0o077)!==0)throw new Error(`${label}权限过宽`);}
function validateExportState(value){if(value===null)return null;if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('federation export-state 无效');const allowed=['schemaVersion','lastSnapshotRoot','lastGeneratedAt','recordHashes'];for(const key of Object.keys(value))if(!allowed.includes(key))throw new Error(`federation export-state 包含未定义字段：${key}`);if(value.schemaVersion!==1)throw new Error('federation export-state schemaVersion 不支持');if(value.lastSnapshotRoot&&!/^[a-f0-9]{64}$/.test(String(value.lastSnapshotRoot)))throw new Error('federation export-state root 无效');if(value.lastGeneratedAt&&!Number.isFinite(Date.parse(value.lastGeneratedAt)))throw new Error('federation export-state 时间无效');if(!value.recordHashes||typeof value.recordHashes!=='object'||Array.isArray(value.recordHashes))throw new Error('federation export-state recordHashes 无效');for(const hash of Object.values(value.recordHashes))if(!/^[a-f0-9]{64}$/.test(String(hash)))throw new Error('federation export-state record hash 无效');return value;}

export async function preflightInstance({dir='.ltp-instance',backupDir=''}={}){
  const bundle=await loadInstanceBundle({dir});const secretStat=await fs.stat(path.join(bundle.root,'secrets.json'));assertPrivate(secretStat,'secrets.json');
  const privateKey=crypto.createPrivateKey({key:Buffer.from(bundle.secrets.signingPrivateKey.value,'base64'),type:'pkcs8',format:'der'});const derived=crypto.createPublicKey(privateKey).export({type:'spki',format:'der'}).toString('base64');if(derived!==bundle.instance.publicKey.value)throw new Error('实例 Ed25519 公私钥不匹配');
  let state;try{state=upgradeState(JSON.parse(await fs.readFile(bundle.dataFile,'utf8')))}catch(err){throw new Error(`state.json 读取/升级检查失败：${err.message}`)}const stateStat=await fs.stat(bundle.dataFile);assertPrivate(stateStat,'data/state.json');
  const peersFile=path.join(bundle.root,'peers.json');const peers=await optionalJson(peersFile);if(peers){validatePeerTrustStore(peers);assertPrivate(await fs.stat(peersFile),'peers.json');}
  const exportFile=path.join(bundle.root,'federation','export-state.json');const exportState=validateExportState(await optionalJson(exportFile));if(exportState)assertPrivate(await fs.stat(exportFile),'federation/export-state.json');
  let backup=null;if(backupDir){const verified=await verifyBackupDirectory(backupDir);if(verified.manifest.instanceId!==bundle.instance.id)throw new Error('指定 backup 不属于当前 instance ID');backup={instanceId:verified.manifest.instanceId,fileRoot:verified.manifest.fileRoot,fileCount:verified.manifest.files.length,createdAt:verified.manifest.createdAt};}
  return {status:'INSTANCE_PREFLIGHT_PASS',instanceId:bundle.instance.id,instanceName:bundle.instance.name,mode:bundle.instance.mode,stateRevision:state.revision,companies:state.companies.length,contributions:state.contributions.length,federatedEvidence:(state.federatedEvidence||[]).length,federationSources:(state.federationImports||[]).length,peerCount:peers?.peers?.length||0,hasExportState:Boolean(exportState),backup};
}
function parseArgs(argv){const out={dir:'.ltp-instance',backupDir:''};for(let i=0;i<argv.length;i++){const arg=argv[i];if(!arg.startsWith('--'))throw new Error(`未知参数：${arg}`);const value=argv[++i];if(value===undefined||value.startsWith('--'))throw new Error(`参数 ${arg} 缺少值`);if(arg==='--dir')out.dir=value;else if(arg==='--backup')out.backupDir=value;else throw new Error(`未知参数：${arg}`);}return out;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const result=await preflightInstance(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result));
  }catch(err){
    console.error(`INSTANCE_PREFLIGHT_FAILED: ${err.message}`);
    process.exitCode=1;
  }
}
