'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('src/Main.gs','utf8');
const html=fs.readFileSync('src/Player.html','utf8');
const manifest=JSON.parse(fs.readFileSync('src/appsscript.json','utf8'));
new vm.Script(code,{filename:'Main.gs'});
assert.equal(manifest.runtimeVersion,'V8');
assert.match(code,/function doGet\(\)\s*\{\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*setupOnce\(\);/);
assert.ok(html.includes('youtube.com/iframe_api'));
for(const n of ['onMessage','onAddToSpace','doGet','setupOnce','playerClaimNext','playerFinish','playerGetState'])
  assert.match(code,new RegExp('function\\s+'+n+'\\s*\\('));
const ctx=vm.createContext({console});vm.runInContext(code,ctx);
const command=s=>JSON.parse(JSON.stringify(ctx.parseCommand_(s)));
assert.deepEqual(command('play Dewa 19 Kangen'),{cmd:'play',args:'Dewa 19 Kangen'});
assert.deepEqual(command('/queue'),{cmd:'queue',args:''});
assert.equal(ctx.extractVideoId_('https://youtu.be/dQw4w9WgXcQ?t=2'),'dQw4w9WgXcQ');
assert.equal(ctx.extractVideoId_('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ'),null);
assert.equal(ctx.durationSeconds_('PT4M21S'),261);
console.log('OK: syntax, video IDs, manifest, commands');
