'use strict';
const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
let E;
before(async()=>{E=await import('data:text/javascript;base64,'+fs.readFileSync(path.join(__dirname,'engine.js')).toString('base64'));});
const alert=(overrides={})=>({id:'a',provider:'Deriv',symbol:'stpRNG',category:'general',mode:'cross',target:100,armed:true,...overrides});
const base=()=>({...E.initialState(),alerts:[alert()]});
const fired=(overrides={})=>alert({armed:false,firedAt:1700000000000,firedPrice:101,...overrides});
function frozen(value){Object.freeze(value);for(const entry of Object.values(value))if(entry&&typeof entry==='object'&&!Object.isFrozen(entry))frozen(entry);return value;}

test('initial state is independent and category/queue/history constants are correct',()=>{
 const first=E.initialState(),second=E.initialState();first.alerts.push(alert());
 assert.equal(second.alerts.length,0);assert.equal(first.schema,1);
 assert.equal(Object.keys(E.CATEGORIES).length,5);assert.equal(E.QUEUE_LIMIT,20);assert.equal(E.HISTORY_LIMIT,500);
});
test('market identifiers reject provider/URL injection and honor Deriv case',()=>{
 assert.equal(E.validateMarket('Deriv','stpRNG'),true);assert.equal(E.validateMarket('Binance','BTCUSDT'),true);
 for(const [p,s]of [['Other','BTCUSDT'],['Binance','btcusdt'],['Deriv','x?token=secret'],['Deriv','../foo'],['Deriv',true],['Deriv','']])assert.equal(E.validateMarket(p,s),false);
});
test('crossing supports jumps both ways and exact touch but requires a baseline otherwise',()=>{
 assert.equal(E.hit(alert(),101,99),true);assert.equal(E.hit(alert(),99,101),true);
 assert.equal(E.hit(alert(),100,undefined),true);assert.equal(E.hit(alert(),101,undefined),false);
 assert.equal(E.hit(alert(),101,100),false);assert.equal(E.hit(alert(),99,98),false);
});
test('thresholds can fire on the first fresh tick and reject invalid values/modes',()=>{
 assert.equal(E.hit(alert({mode:'above'}),100),true);assert.equal(E.hit(alert({mode:'below'}),100),true);
 assert.equal(E.hit(alert({mode:'above'}),99),false);assert.equal(E.hit(alert({mode:'below'}),101),false);
 assert.equal(E.hit(alert({mode:'unknown'}),100,99),false);
 for(const value of [null,true,'100',NaN,Infinity]){assert.equal(E.hit(alert({target:value}),100),false);assert.equal(E.hit(alert(),value,99),false);}
});
test('Deriv and Binance decode matching finite fresh provider timestamps',()=>{
 const now=1700000000000;
 assert.deepEqual(E.decodeTick('Deriv','stpRNG',JSON.stringify({tick:{symbol:'stpRNG',quote:100.25,epoch:now/1000}}),now),{price:100.25,at:now});
 assert.deepEqual(E.decodeTick('Binance','BTCUSDT',{s:'BTCUSDT',p:'100.25',T:now},now),{price:100.25,at:now});
});
test('wrong symbols, stale/future/out-of-order packets and controls do not become quotes',()=>{
 const now=1700000000000;
 const raw=(overrides={})=>({s:'BTCUSDT',p:'100',T:now,...overrides});
 for(const packet of [raw({s:'ETHUSDT'}),raw({T:now-30001}),raw({T:now+10001}),raw({T:0}),raw({T:'1700000000000'}),raw({T:true}),raw({T:Infinity}),{result:null,id:1},null,[],true,'{broken'])assert.equal(E.decodeTick('Binance','BTCUSDT',packet,now),null);
 assert.equal(E.decodeTick('Binance','BTCUSDT',raw(),now,now+1),null);
 assert.deepEqual(E.decodeTick('Binance','BTCUSDT',raw(),now,now),{price:100,at:now});
});
test('price parsing rejects null, booleans, empty text, objects, hex and nonfinite data',()=>{
 const now=1700000000000;
 for(const value of [null,true,false,'','  ',[],{},'0x10','Infinity','NaN',Infinity]){
   assert.equal(E.decodeTick('Binance','BTCUSDT',{s:'BTCUSDT',p:value,T:now},now),null);
   assert.equal(E.decodeTick('Deriv','stpRNG',{tick:{symbol:'stpRNG',quote:value,epoch:now/1000}},now),null);
 }
});
test('provider rejection produces a useful error without exposing provider response text',()=>{
 assert.throws(()=>E.decodeTick('Deriv','stpRNG',{error:{message:'private-response-text'}},1700000000000),/Provider rejected/);
});
test('triggered targets leave the queue and enter source-timed durable history without mutation',()=>{
 const state=frozen(base()),q={price:101,at:1700000000000};
 const result=E.archiveTick(state,'Deriv:stpRNG',q,99);
 assert.equal(result.state.alerts.length,0);assert.equal(result.fired.length,1);assert.equal(result.state.history.length,1);
 assert.equal(result.state.history[0].firedAt,q.at);assert.equal(result.state.history[0].firedPrice,q.price);assert.equal(result.state.history[0].armed,false);
 assert.equal(state.alerts.length,1);assert.equal(state.alerts[0].armed,true);assert.equal(state.history.length,0);
 const reopened=E.migrateState(JSON.parse(JSON.stringify(result.state)));
 assert.equal(E.archiveTick(reopened,'Deriv:stpRNG',{price:102,at:q.at+1000},101).fired.length,0);
});
test('same-tick category events remain separate while paused and different markets stay queued',()=>{
 const state={...E.initialState(),alerts:[alert({id:'sl',category:'sl'}),alert({id:'tp',category:'tp'}),alert({id:'paused',armed:false}),alert({id:'other',symbol:'R_10'})]};
 const result=E.archiveTick(state,'Deriv:stpRNG',{price:101,at:1700000000000},99);
 assert.deepEqual(result.fired.map(a=>a.id),['sl','tp']);assert.deepEqual(result.state.alerts.map(a=>a.id),['paused','other']);
});
test('invalid quote cannot fire and all returned arrays are separate copies',()=>{
 const state=base();for(const q of [null,{price:Infinity,at:1},{price:101,at:NaN},{price:true,at:1},{price:101,at:0}]){
   const result=E.archiveTick(state,'Deriv:stpRNG',q,99);assert.equal(result.fired.length,0);assert.equal(result.state.alerts.length,1);assert.notEqual(result.state.alerts,state.alerts);assert.notEqual(result.state.alerts[0],state.alerts[0]);
 }
});
test('history retains the newest 500 records by provider event time',()=>{
 const history=Array.from({length:500},(_,i)=>fired({id:'h'+i,firedAt:1700000000000+i}));
 const state={...base(),history};
 const result=E.archiveTick(state,'Deriv:stpRNG',{price:101,at:1700000001000},99);
 assert.equal(result.state.history.length,500);assert.equal(result.state.history[0].id,'a');assert.equal(result.state.history.at(-1).id,'h1');
});
test('legacy fired queue items migrate once while paused items and original history survive',()=>{
 const input={provider:'Deriv',symbol:'stpRNG',alerts:[fired(),alert({id:'paused',armed:false})],history:[fired({id:'original'})]};
 const migrated=E.migrateState(frozen(input));
 assert.equal(migrated.alerts.length,1);assert.equal(migrated.alerts[0].id,'paused');assert.equal(migrated.alerts[0].armed,false);
 assert.equal(migrated.history.length,2);assert.equal(E.migrateState(migrated).history.length,2);
 const duplicate=E.migrateState({...input,history:[fired()]});assert.equal(duplicate.history.length,1);
});
test('malformed or future backup data is rejected rather than silently dropping alerts',()=>{
 assert.throws(()=>E.migrateState({schema:2}),/Unsupported/);
 assert.throws(()=>E.migrateState({...E.initialState(),alerts:[alert({target:NaN})]}),/invalid/);
 assert.throws(()=>E.migrateState({...E.initialState(),alerts:[alert(),alert()]}),/duplicate/);
 assert.throws(()=>E.migrateState({...E.initialState(),history:[alert()]}),/history data/);
 assert.throws(()=>E.migrateState({...E.initialState(),alerts:'broken'}),/settings/);
 assert.throws(()=>E.migrateState({...E.initialState(),volume:101}),/settings/);
});
test('queued backup capacity is enforced without silently truncating levels',()=>{
 const state={...E.initialState(),alerts:Array.from({length:21},(_,i)=>alert({id:'a'+i}))};
 assert.throws(()=>E.migrateState(state),/more than 20/);
});
test('rearm keeps immutable history and creates a new target without old fired metadata',()=>{
 const state=frozen({...E.initialState(),history:[fired()]});
 const rearmed=E.rearmHistory(state,'a','fresh');
 assert.equal(rearmed.alerts.length,1);assert.equal(rearmed.alerts[0].id,'fresh');assert.equal(rearmed.alerts[0].armed,true);assert.equal(rearmed.alerts[0].sourceId,'a');
 assert.equal(rearmed.alerts[0].firedAt,undefined);assert.equal(rearmed.alerts[0].firedPrice,undefined);
 assert.deepEqual(rearmed.history,state.history);assert.notEqual(rearmed.history[0],state.history[0]);assert.equal(state.alerts.length,0);
});
test('rearm rejects reused IDs, absent records and a full queue',()=>{
 const state={...E.initialState(),history:[fired()]};
 assert.throws(()=>E.rearmHistory(state,'missing','fresh'),/no longer/);assert.throws(()=>E.rearmHistory(state,'a','a'),/unique/);
 assert.throws(()=>E.rearmHistory({...state,alerts:Array.from({length:20},(_,i)=>alert({id:'queued'+i}))},'a','fresh'),/20 alerts/);
});

