/* Original, deterministic teaching models. No real processes or files are changed. */
const Models = (() => {
 function race(locked=false){return {locked,value:0,owner:null,pc:[0,0],local:[null,null],log:[]};}
 function raceStep(s,i){
  if(s.pc[i]>=3)return;
  const name=['A','B'][i];
  if(s.locked && s.owner!==null && s.owner!==i){s.log.push(`${name}: blocked on mutex held by ${['A','B'][s.owner]}`);return;}
  if(s.pc[i]===0){if(s.locked)s.owner=i;s.local[i]=s.value;s.log.push(`${name}: READ counter=${s.value}${s.locked?' (mutex acquired)':''}`);}
  if(s.pc[i]===1){s.local[i]++;s.log.push(`${name}: ADD 1 → local=${s.local[i]}`);}
  if(s.pc[i]===2){s.value=s.local[i];s.log.push(`${name}: WRITE counter=${s.value}${s.locked?' (mutex released)':''}`);if(s.locked)s.owner=null;}
  s.pc[i]++;
 }
 function deadlock(ordered=false){return {ordered,owners:[null,null],pc:[0,0],log:[]};}
 function deadStep(s,i){
  if(s.pc[i]>=3)return;
  const n=['A','B'][i], orders=s.ordered?[[0,1],[0,1]]:[[0,1],[1,0]],names=['spool','log'];
  if(s.pc[i]===2){s.owners=s.owners.map(o=>o===i?null:o);s.pc[i]++;s.log.push(`${n}: committed work; released both locks`);return;}
  const r=orders[i][s.pc[i]];
  if(s.owners[r]!==null && s.owners[r]!==i){s.log.push(`${n}: WAIT for ${names[r]}, held by ${['A','B'][s.owners[r]]}`);return;}
  s.owners[r]=i;s.pc[i]++;s.log.push(`${n}: acquired ${names[r]}`);
 }
 function isDead(s){return !s.ordered && s.pc[0]===1 && s.pc[1]===1;}
 function pipeline(cores=1,diskTime=6){
  let jobs=Array.from({length:12},(_,i)=>({id:i+1,cpu:2,disk:diskTime,state:'ready',finish:null})), cpu=Array(cores).fill(null), disk=null,q=[],timeline=[],t=0,busy=0,dbusy=0;
  while(jobs.some(j=>j.finish===null)&&t<500){
   for(let c=0;c<cores;c++)if(cpu[c]===null){const j=jobs.find(j=>j.state==='ready');if(j){j.state='cpu';cpu[c]=j;}}
   if(disk===null&&q.length)disk=q.shift();
   timeline.push({start:t,cpu:cpu.map(j=>j?j.id:'–').join(', '),disk:disk?disk.id:'–',queue:q.length});
   const finished=[];for(let c=0;c<cores;c++)if(cpu[c]){busy++;cpu[c].cpu--;if(cpu[c].cpu===0){finished.push(cpu[c]);cpu[c]=null;}}
   if(disk){dbusy++;disk.disk--;if(disk.disk===0){disk.finish=t+1;disk.state='done';disk=null;}}
   for(const j of finished){j.state='io';q.push(j);}t++;
  }
  return {cores,diskTime,elapsed:t,throughput:12/t,cpuUtil:busy/(cores*t)*100,diskUtil:dbusy/t*100,jobs,timeline};
 }
 function permissions(policy='original'){
  const x=policy==='group'||policy==='everyone',r=x,guest=policy==='everyone';
  const log=['Application: open /shared/report.txt for reading','Kernel: resolve / (search allowed)'];
  if(!x)log.push('Kernel: /shared lacks group search (x) → EACCES; no device request');
  else {log.push('Kernel: /shared group search (x) allowed','Kernel: report.txt group read (r) allowed','Cache miss assumed → file-system block lookup','Driver: submit device request; caller waits','Device completion interrupt → caller becomes ready','read returns the requested bytes');}
  return {policy,allowed:x&&r,guestAllowed:guest,log};
 }
 function buffer(capacity=2,policy='drop',cut=false){
  let queue=0,pending=0,generated=0,accepted=0,persisted=0,dropped=0,lost=0,rows=[];
  for(let t=1;t<=12;t++){
   const arrived=t<=4?3:0;generated+=arrived;pending+=arrived;
   const take=Math.min(pending,capacity-queue);queue+=take;pending-=take;accepted+=take;
   if(policy==='drop'){dropped+=pending;pending=0;}
   let written=queue>0?1:0;queue-=written;persisted+=written;
   if(cut&&t===4){lost=queue;queue=0;}
   rows.push({t,arrived,accepted:take,written,queue,pending,persisted,dropped,lost});
   if(cut&&t===4)break;
  }
  return {capacity,policy,cut,generated,accepted,persisted,dropped,lost,queue,pending,rows};
 }
 function controller(priority='telemetry',samples=2){
  const memory=48+samples*4,rows=[],jobs=[];
  if(memory>64)return {priority,samples,memory,boot:false,misses:0,rows,jobs};
  for(let t=0;t<20;t++){
   if(t%5===0){jobs.push({name:'Control',release:t,deadline:t+2,left:1,finish:null},{name:'Telemetry',release:t,deadline:t+5,left:3,finish:null});}
   const ready=jobs.filter(j=>j.left>0),first=priority==='control'?'Control':'Telemetry';
   ready.sort((a,b)=>(a.name===first?0:1)-(b.name===first?0:1)||a.release-b.release);
   const j=ready[0];if(j){j.left--;if(j.left===0)j.finish=t+1;}
   rows.push({t,task:j?j.name:'Idle'});
  }
  const misses=jobs.filter(j=>j.name==='Control'&&(j.finish===null||j.finish>j.deadline)).length;
  return {priority,samples,memory,boot:true,misses,rows,jobs};
 }
 return {race,raceStep,deadlock,deadStep,isDead,pipeline,permissions,buffer,controller};
})();
if(typeof module!=='undefined')module.exports=Models;
