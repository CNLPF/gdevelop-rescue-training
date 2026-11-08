// Browser QA of the actual GDevelop-exported preview; never a second game implementation.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const preview=path.join(process.env.TEMP,'GDTMP--1','gameplay-test-preview');
const evidence=path.resolve(__dirname,'../../output/playwright/rescue');fs.mkdirSync(evidence,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(preview,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(preview+path.sep)){res.writeHead(403);res.end();return;}
  try{let data=fs.readFileSync(file);if(file.endsWith('index.html'))data=Buffer.from(data.toString().replace('var game = new gdjs.RuntimeGame','var game = window.__rescueGame = new gdjs.RuntimeGame'));
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);
  }catch{res.writeHead(404);res.end();}
});
let browser;
(async()=>{
  try {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:960,height:640}});const errors=[],blockedExternal=[];
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1'||url.protocol==='data:')return route.continue();
    blockedExternal.push(url.origin);return route.abort();
  });
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,500));});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForTimeout(2500);
  const state=await page.evaluate(()=>{const game=window.__rescueGame;const scene=game?.getSceneStack().getCurrentScene();return {loaded:!!scene,mode:scene?.getVariables().get('GameMode').getAsString(),stage:scene?.getVariables().get('Stage').getAsString(),player:scene?.getObjects('Player').map(o=>({x:o.getX(),y:o.getY()}))};});
  assert.equal(state.loaded,true);assert.equal(state.mode,'Playing');
  assert.ok(['Entry','Jump'].includes(state.stage),`unexpected initial stage: ${state.stage}`);
  await page.screenshot({path:path.join(evidence,'browser-start.png')});
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(250);await page.keyboard.up('ArrowRight');await page.waitForTimeout(100);
  const moved=await page.evaluate(()=>window.__rescueGame.getSceneStack().getCurrentScene().getObjects('Player')[0].getX());
  assert.ok(moved>state.player[0].x+20,'real browser keyboard moves the native player');
  await page.keyboard.press('r',{delay:80});await page.waitForTimeout(80);
  const mode=await page.evaluate(()=>window.__rescueGame.getSceneStack().getCurrentScene().getVariables().get('GameMode').getAsString());
  assert.equal(mode,'RestartConfirm');await page.keyboard.press('Escape',{delay:80});await page.waitForTimeout(80);
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(120);
  await page.screenshot({path:path.join(evidence,'browser-1280x720.png')});
  assert.equal(errors.length,0,'browser has no runtime or resource errors');
  const report={status:'passed',browser:'Microsoft Edge',checks:6,viewports:['960x640','1280x720'],externalHttpRequestsBlocked:blockedExternal,errors,state,playerXAfterKeyboard:moved};
  fs.writeFileSync(path.join(evidence,'browser-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  } finally { if(browser)await browser.close();server.close(); }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
