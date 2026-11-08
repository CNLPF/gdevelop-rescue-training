// Deterministic conversion of the user-supplied V2 SVG masters. No generated imagery.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Resvg}=require('../../.local/art-pipeline/node_modules/@resvg/resvg-js');
const {PNG}=require('../../.local/art-pipeline/node_modules/pngjs');
const root=path.resolve(__dirname,'..'),source=path.join(root,'art-source/v2/svg');
const category=n=>({CHR:'characters',WPN:'weapons',ENM:'enemies',ITM:'items',ENV:'environment',FX:'fx',UI:'ui'})[n.split('_')[0]];
const manifest={version:2,source:'User-supplied D:/Download/SVG文件.zip and 美术规范 V2.0',rights:'User-supplied assets; no independent license assertion',frameType:'Static key poses, not complete animation sheets',assets:[]};
const bounds=p=>{let x0=p.width,y0=p.height,x1=-1,y1=-1;for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(p.data[(y*p.width+x)*4+3]>4){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return {x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};};
function raster(svg){return new Resvg(svg).render().asPng();}
function output(name,svg,dir){const p=path.join(root,'assets',dir,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,raster(svg));return 'assets/'+dir+'/'+name;}
function wrap(svg,w,h,box,flip=false,stretch=false){const body=svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');const scale=stretch?null:Math.min(w/box.w,h/box.h);const sx=scale||w/box.w,sy=scale||h/box.h;const tx=(w-box.w*sx)/2-box.x*sx,ty=(h-box.h*sy)/2-box.y*sy;return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g transform="${flip?`translate(${w} 0) scale(-1 1) `:''}translate(${tx} ${ty}) scale(${sx} ${sy})">${body}</g></svg>`;}
const sources={};
for(const file of fs.readdirSync(source).filter(n=>n.endsWith('.svg'))){
 const svg=fs.readFileSync(path.join(source,file),'utf8');if(/<script|<image|foreignObject|(?:href|src)\s*=/i.test(svg))throw Error('Unexpected executable/external/image content '+file);
 const png=PNG.sync.read(raster(svg));const cat=category(file);sources[file]={svg,bounds:bounds(png),width:png.width,height:png.height};
 const folder=path.join(root,'assets',cat);fs.mkdirSync(folder,{recursive:true});fs.copyFileSync(path.join(source,file),path.join(folder,file));fs.writeFileSync(path.join(folder,file.replace('.svg','.png')),PNG.sync.write(png));
 manifest.assets.push({file:'assets/'+cat+'/'+file,png:'assets/'+cat+'/'+file.replace('.svg','.png'),width:png.width,height:png.height,alpha:true,contentBounds:bounds(png),sha256:crypto.createHash('sha256').update(svg).digest('hex')});
}
const mappings={
 Partner:['CHR_BUDDY_IDLE_R_V02.svg',48,56],Patrol:['ENM_SCOUT_IDLE_R_V02.svg',48,48],Turret:['ENM_TURRET_IDLE_R_V02.svg',56,56],
 Dummy:['ENV_TRAINING_TARGET_V02.svg',56,80],Coin:['ITM_COIN_GOLD_V02.svg',24,24],Shop:['ENV_SUPPLY_STATION_V02.svg',96,96],
 Checkpoint:['ITM_CHECKPOINT_BEACON_V02.svg',40,80],JumpBeacon:['ITM_CHECKPOINT_BEACON_V02.svg',40,64],Exit:['ENV_RESCUE_EXIT_V02.svg',96,112],
 ReturnPortal:['ENV_RETURN_PORTAL_V02.svg',76,100],CannonCrate:['WPN_BREAKER_CANNON_R_V02.svg',72,68],
 ChargeGlow:['FX_BREAKER_CHARGE_RING_V02.svg',48,48],AimLine:['FX_TURRET_WARNING_LINE_V02.svg',100,3],
 TurretWarning:['UI_INTERACT_E_V02.svg',44,44],
};
const runtime={};
for(const [name,[file,w,h]]of Object.entries(mappings)){const s=sources[file];runtime[name]=output(name+'.png',wrap(s.svg,w,h,s.bounds,false,name==='AimLine'),'v2-runtime');}
const heroBox={x:7,y:0,w:130,h:144}; // common source canvas for every pose; no per-pose cropping/baseline drift
for(const pose of ['IDLE','RUN','JUMP','DBLJUMP','SHOOT','CHARGE','FIRE','HURT'])runtime['Hero'+pose]=output('HERO_'+pose+'.png',wrap(sources['CHR_PLAYER_'+pose+'_R_V02.svg'].svg,104,104,heroBox),'v2-runtime');
for(const [name,file,w,h,flip]of [
 ['GunEnergy','WPN_PULSE_GUN_R_V02.svg',46,25,false],['GunCannon','WPN_BREAKER_CANNON_R_V02.svg',52,32,false],
 ['GuardIdle','ENM_SHIELD_GUARD_IDLE_R_V02.svg',76,88,true],['GuardBlock','ENM_SHIELD_GUARD_BLOCK_R_V02.svg',76,88,true],
 ['TurretWarn','ENM_TURRET_WARN_R_V02.svg',56,56,false],['ScoutRun','ENM_SCOUT_RUN_R_V02.svg',48,48,false],
 ['BulletEnergy','FX_PULSE_PROJECTILE_R_V02.svg',24,10,false],['BulletCannon','FX_BREAKER_PROJECTILE_R_V02.svg',34,18,false],
 ['ShieldImpact','FX_SHIELD_BLOCK_V02.svg',52,52,false],['HudHeart','UI_HUD_HEART_V02.svg',18,18,false],['HudCoin','UI_HUD_COIN_V02.svg',16,16,false],
 ['HudEnergy','UI_WEAPON_PULSE_V02.svg',26,22,false],['HudCannon','WPN_BREAKER_CANNON_R_V02.svg',26,22,false],['Interact','UI_INTERACT_E_V02.svg',24,24,false],
 ])runtime[name]=output(name+'.png',wrap(sources[file].svg,w,h,sources[file].bounds,flip),'v2-runtime');
// No required image was provided for these structural elements: derive panels using V2 palette.
const svg=(w,h,b)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${b}</svg>`;
// The supplied UI_INTERACT_E master contains an arrow. Preserve the master and correct the runtime affordance.
runtime.Interact=output('Interact.png',svg(24,24,'<rect x="1" y="1" width="22" height="22" rx="6" fill="#F4F7FA" stroke="#20C9BD" stroke-width="2"/><path d="M16 6H8v12h8M8 12h7" fill="none" stroke="#263C58" stroke-width="2.4" stroke-linejoin="round"/>'),'v2-runtime');
runtime.Warning=output('WARNING.png',svg(44,44,'<path d="M22 3 42 40H2Z" fill="#FF685E" stroke="#263C58" stroke-width="3"/><path d="M22 13v13m0 4v4" stroke="#fff" stroke-width="4"/>'),'v2-runtime');
runtime.Gate=output('GATE.png',svg(28,560,'<rect x="2" width="24" height="560" rx="8" fill="#263C58"/><rect x="8" width="12" height="560" fill="#8A6CF3" opacity=".65"/>'+Array.from({length:14},(_,i)=>`<path d="m5 ${i*40+10} 18 18m-18-8 18 18" stroke="#C4B6FF" stroke-width="3"/>`).join('')),'v2-runtime');
runtime.Modal=output('MODAL.png',svg(960,640,'<rect width="960" height="640" fill="#11233A" fill-opacity=".65"/><rect x="140" y="110" width="680" height="428" rx="24" fill="#F4F7FA" stroke="#263C58" stroke-width="4"/><path d="M165 113h630" stroke="#20C9BD" stroke-width="5"/><path d="M162 193h636M162 450h636" stroke="#AEBBC8" stroke-width="1.5"/>'),'v2-runtime');
runtime.Hud=output('HUD.png',svg(260,64,'<path d="M12 1h236l11 11v40l-11 11H12L1 52V12Z" fill="#263C58" fill-opacity=".96" stroke="#AEBBC8" stroke-width="1.5"/><path d="M12 2h78m144 60h14l10-10" stroke="#41B7FF" stroke-width="3"/><path d="M12 35h236" stroke="#AEBBC8" stroke-opacity=".2"/>'),'v2-runtime');
// Full-width backgrounds contain only distant architecture; collisions stay in their own objects.
const far=sources['ENV_BACKGROUND_FAR_960X270_V02.svg'].svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
for(const width of [3200,6400])runtime['Backdrop'+width]=output('BACKDROP_'+width+'.png',svg(width,640,'<rect width="'+width+'" height="640" fill="#DBEDF4"/>'+Array.from({length:Math.ceil(width/960)},(_,i)=>`<g transform="translate(${i*960} 70) scale(1 1.65)">${far}</g>`).join('')+'<path d="M0 555h'+width+'" stroke="#B6CCD9" stroke-width="2"/>'),'v2-runtime');
const game=JSON.parse(fs.readFileSync(path.join(root,'game.json'),'utf8'));
for(const layout of game.layouts)for(const i of layout.instances.filter(i=>['Terrain','Wall'].includes(i.name))){const w=i.customSize?i.width:(i.name==='Terrain'?96:40),h=i.customSize?i.height:(i.name==='Terrain'?80:96),key=`Platform${w}x${h}`;if(runtime[key])continue;
 const tile=sources['ENV_PLATFORM_TILE_64_V02.svg'].svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 runtime[key]=output(key+'.png',svg(w,h,`<defs><pattern id="tile" width="64" height="64" patternUnits="userSpaceOnUse">${tile}</pattern></defs><rect width="${w}" height="${h}" fill="#A4B6C8"/><rect width="${w}" height="${h}" fill="url(#tile)"/><rect x="1" y="1" width="${w-2}" height="${h-2}" rx="3" fill="none" stroke="#263C58" stroke-width="2"/><path d="M2 3h${w-4}" stroke="#20C9BD" stroke-width="4"/>`),'v2-runtime');
}
const sheet=PNG.sync.read(raster(svg(1000,Math.ceil(manifest.assets.length/5)*150,manifest.assets.map((a,i)=>{const s=sources[path.basename(a.file)];return `<rect x="${i%5*200}" y="${Math.floor(i/5)*150}" width="200" height="150" fill="${i%2?'#dbe7ec':'#c9dbe4'}"/><svg x="${i%5*200+40}" y="${Math.floor(i/5)*150+5}" width="120" height="110" viewBox="0 0 ${s.width} ${s.height}">${s.svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'')}</svg><text x="${i%5*200+5}" y="${Math.floor(i/5)*150+130}" font-family="sans-serif" font-size="8" fill="#263C58">${path.basename(a.file).replace('_V02.svg','')}</text>`;}).join(''))));
fs.mkdirSync(path.join(root,'previews'),{recursive:true});fs.writeFileSync(path.join(root,'previews/v2-contact-sheet.png'),PNG.sync.write(sheet));
fs.writeFileSync(path.join(root,'assets/ASSET_MANIFEST_V2.json'),JSON.stringify({...manifest,runtime},null,2));
console.log(JSON.stringify({sourceAssets:manifest.assets.length,runtimeAssets:Object.keys(runtime).length,contactSheet:'previews/v2-contact-sheet.png'}));
