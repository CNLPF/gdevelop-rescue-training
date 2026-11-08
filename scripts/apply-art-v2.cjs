// Apply to disk only while the editor is closed. Existing layout/physics data are preserved.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function buildArtPresenterInlineCode(source){
 return [
  'if(!runtimeScene.__rescue.artV2){',
  '(() => {',
  ...source.split('\n'),
  'attachArtV2(runtimeScene.__rescue);',
  '})();',
  '}',
 ];
}
function applyArtV2(data,{HUD_LAYOUT,platformArt={}}={}){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/ASSET_MANIFEST_V2.json'),'utf8')),art={...manifest.runtime,...platformArt};
 const original=structuredClone(data.layouts.map(s=>({name:s.name,instances:s.instances.filter(i=>['Player','Terrain','Wall','Gate','Patrol','Turret','Shield','Coin'].includes(i.name)),player:s.objects.find(o=>o.name==='Player')})));
 const resource=file=>{const normalized=file.startsWith('assets/')?file:'assets/'+file,name=normalized.replace(/^assets\//,'');if(!data.resources.resources.some(r=>r.name===name))data.resources.resources.push({name,kind:'image',file:normalized,metadata:'',smoothed:true,userAdded:true,alwaysLoaded:false});return name;};
 for(const file of Object.values(art))resource(file);
 const localArt={
  GunMissile:'base-missile-gun.svg',HudMissile:'base-missile-icon.svg',BulletMissile:'base-missile.svg',
  JammerCore:'base-jammer-core.svg',
  TrialDrone:'base-trial-drone.svg',MissileReticle:'base-missile-reticle.svg',BombMarker:'base-bomb-marker.svg',
  Backdrop8400:'base-backdrop.svg',
 };
 const airFighter={
  Idle:art.AirFighterIdle||'assets/air-fighter-idle.svg',
  Warn:art.AirFighterWarn||'assets/air-fighter-warn.svg',
  Attack:art.AirFighterAttack||'assets/air-fighter-attack.svg',
  Hit:art.AirFighterHit||'assets/air-fighter-hit.svg',
 };
 for(const file of Object.values(localArt))resource(file);
 const template=data.layouts[0].objects.find(o=>o.name==='Bullet');
 const frame=image=>({hasCustomCollisionMask:false,image:resource(image),points:[],originPoint:{name:'origin',x:0,y:0},centerPoint:{automatic:true,name:'center',x:0,y:0},customCollisionMask:[]});
 function sprite(name,animations){const obj=structuredClone(template);obj.name=name;obj.behaviors=[];obj.variables=[];obj.animations=Object.entries(animations).map(([name,image])=>({name,useMultipleDirections:false,directions:[{looping:true,timeBetweenFrames:0.12,sprites:[frame(image)]}]}));return obj;}
 function global(name,anims){data.objects=data.objects.filter(o=>o.name!==name);data.objects.push(sprite(name,anims));}
 global('ArtHero',Object.fromEntries(['IDLE','RUN','JUMP','DBLJUMP','SHOOT','CHARGE','FIRE','HURT'].map(n=>[n,art['Hero'+n]])));
 global('ArtGun',{Energy:art.GunEnergy,Cannon:art.GunCannon,Missile:localArt.GunMissile});
 global('ArtWeaponIcon',{Energy:art.HudEnergy,Cannon:art.HudCannon,Missile:localArt.HudMissile});
 global('ArtPatrol',{Idle:art.Patrol,Run:art.ScoutRun});global('ArtTurret',{Idle:art.Turret,Warn:art.TurretWarn});global('ArtShield',{Idle:art.GuardIdle,Block:art.GuardBlock});
 global('ArtScoutDrone',airFighter);
 global('ArtArmoredDrone',airFighter);
 global('ArtJammerCore',{Idle:localArt.JammerCore});
 global('ArtTrialDrone',{Idle:localArt.TrialDrone});
 global('ArtProjectile',{Energy:art.BulletEnergy,Cannon:art.BulletCannon,Missile:localArt.BulletMissile});
 global('ArtMissileReticle',{Idle:localArt.MissileReticle});global('ArtBombMarker',{Idle:localArt.BombMarker});
 for(const [name,key]of Object.entries({ArtHeart:'HudHeart',ArtCoin:'HudCoin',ArtInteract:'Interact',ArtShieldImpact:'ShieldImpact'}))global(name,{Idle:art[key]});
 // HUD cannon icon is deliberately 26x22, independent of the held weapon size.
 for(const [key,file]of Object.entries(art))if(key.startsWith('Platform'))global('Art'+key,{Idle:file});
 const setImage=(obj,file)=>{if(obj)obj.animations=[{name:'Idle',useMultipleDirections:false,directions:[{looping:true,timeBetweenFrames:0.1,sprites:[frame(file)]}]}];};
 const source=fs.readFileSync(path.join(root,'src/art-v2.js'),'utf8').replace(/^export /gm,'');
 for(const layout of data.layouts){
  for(const o of layout.objects){
   if(['Partner','Dummy','Coin','Shop','Checkpoint','JumpBeacon','Exit','ReturnPortal','CannonCrate','ChargeGlow','AimLine'].includes(o.name)&&art[o.name])setImage(o,art[o.name]);
   if(o.name==='TurretWarning')setImage(o,art.Warning);if(o.name==='Gate')setImage(o,art.Gate);if(o.name==='ModalPanel')setImage(o,art.Modal);
   if(o.name==='Backdrop')setImage(o,layout.name==='RescueBase'?localArt.Backdrop8400:art.Backdrop3200);
   if(['ModalTitle','ModalBody','ModalFoot','Toast','KeyHelp','EnemyLabel','PatrolLabel','TurretLabel','DummyLabel'].includes(o.name)){
    const color='38;60;88';o.color={r:38,g:60,b:88};o.content={...o.content,color};
   }
  }
  for(const i of layout.instances){
   if(HUD_LAYOUT?.[i.name]){i.x=HUD_LAYOUT[i.name].x;i.y=HUD_LAYOUT[i.name].y;if(i.name==='HudPanel'){i.customSize=true;i.width=304;i.height=44;}}
   if(i.name==='Backdrop'){i.x=0;i.y=0;i.customSize=true;i.width=layout.name==='RescueBase'?8400:3200;i.height=640;}
  }
  layout.events=layout.events.filter(e=>e.name!=='07 · V2 美术表现（不改变游戏规则）');
  layout.events.push({type:'BuiltinCommonInstructions::Group',name:'07 · V2 美术表现（不改变游戏规则）',source:'',events:[{type:'BuiltinCommonInstructions::JsCode',inlineCode:buildArtPresenterInlineCode(source),parameterObjects:'',useStrict:true,eventsSheetExpanded:false}]});
 }
 // Presenter attachment at group 07 happens after frame one; all later frames use the wrapper.
 for(const name of ['HealthText','CoinsText','WeaponText']){const o=data.objects.find(o=>o.name===name);if(o){o.characterSize=15;o.content={...o.content,characterSize:15};}}
 data.objectsFolderStructure={folderName:'__ROOT',children:data.objects.map(o=>({objectName:o.name}))};
 const after=data.layouts.map(s=>({name:s.name,instances:s.instances.filter(i=>['Player','Terrain','Wall','Gate','Patrol','Turret','Shield','Coin'].includes(i.name)),player:s.objects.find(o=>o.name==='Player')}));
 if(JSON.stringify(original)!==JSON.stringify(after))throw Error('Physics/layout changed unexpectedly');
 data.properties.description='V0.3 离线空战扩充 / 作者美术、正式空中敌机与本地占位资源 / 逻辑碰撞独立于视觉';
 for(const name of fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.gameplay.js'))){const t={name:name.replace('.gameplay.js',''),type:'gameplay',description:'Offline native GDevelop gameplay verification',source:fs.readFileSync(path.join(root,'tests',name),'utf8').split('\n')};data.tests=data.tests||[];const i=data.tests.findIndex(x=>x.name===t.name);if(i<0)data.tests.push(t);else data.tests[i]=t;}
 return data;
}
module.exports={applyArtV2,buildArtPresenterInlineCode};
if(require.main===module){const game=path.join(root,'game.json');const data=applyArtV2(JSON.parse(fs.readFileSync(game,'utf8')));fs.copyFileSync(game,path.join(root,'evidence','before-art-v2-'+Date.now()+'.json'));fs.writeFileSync(game,JSON.stringify(data,null,2));console.log(JSON.stringify({applied:true,scenes:data.layouts.map(s=>s.name),globalObjects:data.objects.length}));}
