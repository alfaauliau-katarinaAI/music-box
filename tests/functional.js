'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('src/Main.gs','utf8');
const props=new Map([['SPREADSHEET_ID','dummy'],['ADMIN_IDS','users/admin'],['ALLOWED_SPACE_NAME','spaces/office']]);
const cells=[['id','video_id','title','requester','user_id','status','created_at','started_at','finished_at','message_id','notes']];
const sheet={
  getLastRow:()=>cells.length,
  getRange(row,col,height,width){return{
    getValues:()=>cells.slice(row-1,row-1+height).map(x=>x.slice(col-1,col-1+width)),
    setValue(v){cells[row-1][col-1]=v},
    setValues(v){for(let i=0;i<v.length;i++)cells[row-1+i]=[...v[i]]},
    setFrozenRows(){}
  }},
  appendRow(r){cells.push(r)}
};
let n=0;
const sandbox={
  console,
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},
  SpreadsheetApp:{openById:()=>({getSheetByName:k=>k==='Queue'?sheet:null})},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
  Utilities:{getUuid:()=>String(++n)}
};
const ctx=vm.createContext(sandbox);vm.runInContext(source,ctx);
const v={videoId:'dQw4w9WgXcQ',title:'Example',seconds:212};
assert.equal(ctx.enqueue_(v,'A','users/a','message/1').position,1);
assert.equal(ctx.enqueue_(v,'A','users/a','message/1').duplicate,true);
assert.equal(ctx.enqueue_(v,'A','users/a','message/2').position,2);
assert.throws(()=>ctx.enqueue_(v,'A','users/a','message/3'),/Batas 2/);
assert.equal(ctx.enqueue_(v,'B','users/b','message/4').position,3);
assert.equal(ctx.playerClaimNext().id,'1');
assert.equal(ctx.playerClaimNext().id,'1');
assert.equal(ctx.playerGetState().pending,2);
assert.equal(ctx.playerFinish('1','PLAYED'),true);
assert.equal(ctx.playerClaimNext().id,'2');
assert.equal(ctx.skipCurrent_(),true);
assert.equal(ctx.playerClaimNext().id,'3');
assert.equal(ctx.isAdmin_({name:'users/a'}),false);
assert.equal(ctx.isAdmin_({name:'users/admin'}),true);
assert.match(ctx.onMessage({space:{name:'spaces/notallowed'},message:{text:'queue'},user:{name:'users/a'}}).text,/diizinkan/);
const addOnEvent={chat:{
  user:{name:'users/a',displayName:'A'},
  space:{name:'spaces/office'},
  messagePayload:{message:{name:'spaces/office/messages/testhelp',text:'help'}}
}};
const addOnReply=ctx.onMessage(addOnEvent).hostAppDataAction.chatDataAction.createMessageAction.message;
assert.match(addOnReply.text,/Office Music Bot/);
assert.match(ctx.onAddedToSpace({chat:{space:{name:'spaces/office'}}}).hostAppDataAction.chatDataAction.createMessageAction.message.text,/Halo!/);
addOnEvent.chat.messagePayload.message.text='whoami';
assert.match(ctx.onMessage(addOnEvent).hostAppDataAction.chatDataAction.createMessageAction.message.text,/spaces\/office/);
console.log('OK: queue, idempotency, limits, claim, skip, admin, space');
