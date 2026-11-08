// Apply while editor is closed. Does not rebuild layouts, backgrounds, HUD or platform art.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {buildArtPresenterInlineCode}=require('./apply-art-v2.cjs');
function applyHdActors(data){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/HD_ACTORS_MANIFEST.json'),'utf8')),a=manifest.runtime;
 const geometry=JSON.stringify(data.layouts.map(s=>s.instances));
 function resource(file){const name=file.replace(/^assets\//,'');if(!data.resources.resources.some(r=>r.name===name))data.resources.resources.push({name,kind:'image',file,metadata:'',smoothed:true,userAdded:true,alwaysLoaded:false});return name;}
 for(const file of Object.values(a))resource(file);
 function frame(file,w,h){return {hasCustomCollisionMask:!!w,image:resource(file),points:[],originPoint:{name:'origin',x:0,y:0},centerPoint:{automatic:true,name:'center',x:0,y:0},customCollisionMask:w?[[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}]]:[]};}
 function replace(o,anims,box){if(!o)throw Error('Missing object');o.animations=Object.entries(anims).map(([name,file])=>({name,useMultipleDirections:false,directions:[{looping:true,timeBetweenFrames:0.12,sprites:[frame(file,...(box||[]))]}]}));}
 const find=n=>data.objects.find(o=>o.name===n);
 replace(find('ArtHero'),Object.fromEntries(['IDLE','RUN','JUMP','DBLJUMP','SHOOT','CHARGE','FIRE','HURT'].map(p=>[p,a['Hero'+p]])));
 const keepMissile=(name,animations)=>{
  const object=find(name);
  const missile=object?.animations?.find(animation=>animation.name==='Missile');
  const updated={...animations};
  if(missile)updated.Missile=missile.directions[0].sprites[0].image;
  replace(object,updated);
 };
 keepMissile('ArtGun',{Energy:a.GunEnergy,Cannon:a.GunCannon});
 keepMissile('ArtWeaponIcon',{Energy:a.HudEnergy,Cannon:a.HudCannon});
 replace(find('ArtPatrol'),{Idle:a.Patrol,Run:a.ScoutRun});replace(find('ArtTurret'),{Idle:a.Turret,Warn:a.TurretWarn});replace(find('ArtShield'),{Idle:a.GuardIdle,Block:a.GuardBlock});
 for(const scene of data.layouts){
  for(const [name,w,h]of [['Player',40,56],['Patrol',48,48],['Turret',56,56],['Shield',56,56]]){
   const o=scene.objects.find(o=>o.name===name);if(o)replace(o,{Idle:a['Proxy'+name]},[w,h]);
  }
  // Crate dimensions unchanged: a high-resolution preview replaces only its resource.
  const crate=scene.objects.find(o=>o.name==='CannonCrate');if(crate){const f=crate.animations[0].directions[0].sprites[0];f.image=resource(a.GunCannon);for(const i of scene.instances.filter(i=>i.name==='CannonCrate')){if(!i.customSize){i.customSize=true;i.width=72;i.height=68;}}}
  const group=scene.events.find(e=>e.name==='07 · V2 美术表现（不改变游戏规则）');if(!group)throw Error('Missing presenter');
  const code=fs.readFileSync(path.join(root,'src/art-v2.js'),'utf8').replace(/^export /gm,'');
  group.events[0].inlineCode=buildArtPresenterInlineCode(code);
 }
 // CannonCrate is explicitly sized to its former native size, all other instances stay byte-identical.
 const before=JSON.parse(geometry);for(let s=0;s<data.layouts.length;s++)for(let i=0;i<before[s].length;i++){if(before[s][i].name==='CannonCrate'&&!before[s][i].customSize)Object.assign(before[s][i],{customSize:true,width:72,height:68});}
 if(JSON.stringify(before)!==JSON.stringify(data.layouts.map(s=>s.instances)))throw Error('Unexpected instance geometry change');
 for(const f of fs.readdirSync(path.join(root,'tests')).filter(x=>x.endsWith('.gameplay.js'))){const name=f.replace('.gameplay.js',''),t=data.tests.find(x=>x.name===name);if(t)t.source=fs.readFileSync(path.join(root,'tests',f),'utf8').split('\n');}
 return data;
}
module.exports={applyHdActors};
if(require.main===module){const f=path.join(root,'game.json'),data=applyHdActors(JSON.parse(fs.readFileSync(f,'utf8')));fs.writeFileSync(f,JSON.stringify(data,null,2));console.log('Updated HD actor resources, editor proxies and presenter in both scenes.');}
