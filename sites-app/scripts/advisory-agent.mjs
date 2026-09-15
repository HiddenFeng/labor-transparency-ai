import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FileStore} from '../src/storage.mjs';
import {runAdvisoryAgent} from '../src/domain.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const args=new Map();
for(let i=2;i<process.argv.length;i++){
  const key=process.argv[i];
  if(key.startsWith('--')){
    const next=process.argv[i+1];
    if(next && !next.startsWith('--')){args.set(key,next);i++;}else args.set(key,true);
  }
}
const timeZone=String(args.get('--timezone')||process.env.LTP_ADVISORY_TIMEZONE||'Asia/Shanghai');
const dailyHour=Number(args.get('--hour')||process.env.LTP_ADVISORY_DAILY_HOUR||9);
const dailyMinute=Number(args.get('--minute')||process.env.LTP_ADVISORY_DAILY_MINUTE||0);
const once=Boolean(args.get('--once'));
const loop=Boolean(args.get('--loop'));
const base=String(args.get('--base')||process.env.LTP_ADVISORY_BASE_URL||'').replace(/\/$/,'');
const token=String(args.get('--token')||process.env.LTP_SITES_ADVISORY_AGENT_TOKEN||'');
const dataFile=String(args.get('--data')||process.env.LTP_SITES_DATA||'');
const serviceStopped=Boolean(args.get('--service-stopped'));
if(!once && !loop) throw new Error('请指定 --once 或 --loop');
if(!Number.isInteger(dailyHour)||dailyHour<0||dailyHour>23||!Number.isInteger(dailyMinute)||dailyMinute<0||dailyMinute>59) throw new Error('每日运行时间无效');
if(base && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(base) && !base.startsWith('https://')) throw new Error('Agent API 地址必须是HTTPS或本机回环地址');
if(base && !token) throw new Error('HTTP Agent模式需要 --token 或 LTP_SITES_ADVISORY_AGENT_TOKEN');
if(!base && dataFile && !serviceStopped) throw new Error('直接文件模式只用于服务停止后的离线维护，必须显式 --service-stopped；服务运行时请使用 --base + --token');
if(!base && !dataFile) throw new Error('请使用 --base + --token 连接运行中的服务，或在服务停止时使用 --data + --service-stopped');

function localParts(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {day:`${v.year}-${v.month}-${v.day}`,hour:Number(v.hour),minute:Number(v.minute)};
}
let store=null;
if(!base) store=await new FileStore(path.resolve(dataFile),{seed:false}).init();

async function runOnce(day=''){
  const targetDay=day||localParts().day;
  let result;
  if(base){
    const response=await fetch(base+'/api/advisory-agent/run',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({day:targetDay,timeZone})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(`Agent API失败 ${response.status}: ${data.error||'unknown'}`);
    result={processedCount:data.processedCount,report:data.report};
  }else{
    result=await store.transaction(state=>runAdvisoryAgent(state,{day:targetDay,timeZone,agent:'daily-advisory-agent'}));
  }
  console.log(JSON.stringify({ok:true,mode:base?'HTTP_AGENT_API':'OFFLINE_FILE_SERVICE_STOPPED',day:result.report.day,processedCount:result.processedCount,receivedCount:result.report.receivedCount,advisedCount:result.report.advisedCount,pendingCount:result.report.pendingCount},null,2));
  return result;
}

if(once){await runOnce(String(args.get('--day')||''));process.exit(0);}
let lastRunDay='';
console.log(JSON.stringify({ok:true,mode:'LOOP',transport:base?'HTTP_AGENT_API':'OFFLINE_FILE_SERVICE_STOPPED',timeZone,dailyHour,dailyMinute,privacy:'日志只输出聚合数量，不输出个案正文或回执码'}));
while(true){
  const p=localParts();
  if(p.day!==lastRunDay && (p.hour>dailyHour || (p.hour===dailyHour && p.minute>=dailyMinute))){await runOnce(p.day);lastRunDay=p.day;}
  await new Promise(resolve=>setTimeout(resolve,60_000));
}
