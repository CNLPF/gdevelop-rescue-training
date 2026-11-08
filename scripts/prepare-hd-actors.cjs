// Deterministic extraction from user artwork: no generated or repainted imagery.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PNG}=require('../../.local/art-pipeline/node_modules/pngjs');
const {Resvg}=require('../../.local/art-pipeline/node_modules/@resvg/resvg-js');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'art-source/v2-update/Mecha_Buddies_Rescue_Base_V2_Art_Package');
const out=path.join(root,'assets/hd-actors');fs.mkdirSync(out,{recursive:true});
const cached={},entries=[];
const actor='02_Character/CHR_PLAYER_ACTION_REFERENCE_V02.png',enemy='03_Enemies/ENM_ENEMY_CONCEPT_SHEET_V02.png';
function crop(file,rect){
 const p=cached[file]||(cached[file]=PNG.sync.read(fs.readFileSync(path.join(source,file))));
 const [x,y,w,h]=rect,d=new PNG({width:w,height:h});
 PNG.bitblt(p,d,x,y,w,h,0,0);return d;
}
function save(name,png,meta){const file='assets/hd-actors/'+name+'.png';fs.writeFileSync(path.join(root,file),PNG.sync.write(png));entries.push({name,file,...meta});return file;}
function place(png,w,h,scale,tx,ty,flip=false){
 const data=PNG.sync.write(png).toString('base64');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g transform="${flip?`translate(${w} 0) scale(-1 1) `:''}translate(${tx} ${ty}) scale(${scale})"><image width="${png.width}" height="${png.height}" href="data:image/png;base64,${data}"/></g></svg>`;
 return PNG.sync.read(new Resvg(svg).render().asPng());
}
function fit(png,w,h,flip=false){const s=Math.min(w/png.width,h/png.height);return place(png,w,h,s,(w-png.width*s)/2,h-png.height*s,flip);}
const poses={
 IDLE:{rect:[60,125,250,370],foot:[181,481]},
 RUN:{rect:[390,150,315,345],foot:[550,482]},
 JUMP:{rect:[790,95,255,345],foot:[919,419]},
 DBLJUMP:{rect:[1110,60,330,350],foot:[1300,395]},
 SHOOT:{rect:[20,665,340,340],foot:[150,992]},
 CHARGE:{rect:[375,660,348,345],foot:[521,992]},
 FIRE:{rect:[740,650,392,355],foot:[884,992]},
 HURT:{rect:[1132,640,310,370],foot:[1284,992]},
};
const runtime={};
for(const [pose,{rect,foot}]of Object.entries(poses)){
 const p=crop(actor,rect),s=0.285;
 runtime['Hero'+pose]=save('CHR_PLAYER_'+pose,place(p,176,128,s,88-(foot[0]-rect[0])*s,116-(foot[1]-rect[1])*s),{source:actor,rect,foot,scale:s,canvas:[176,128],anchor:[88,116]});
}
const enemies={
 Patrol:{rect:[88,128,330,310],size:[64,56]},ScoutRun:{rect:[482,136,440,302],size:[64,56]},
 Turret:{rect:[995,50,425,405],size:[72,64]},TurretWarn:{rect:[45,550,445,435],size:[72,64]},
 GuardIdle:{rect:[528,565,390,420],size:[88,96],flip:true},GuardBlock:{rect:[975,570,455,425],size:[88,96],flip:true},
};
for(const [key,{rect,size,flip}]of Object.entries(enemies))runtime[key]=save('ENM_'+key.toUpperCase(),fit(crop(enemy,rect),...size,flip),{source:enemy,rect,size,flip:!!flip});
// Extract visible weapon pixels only. The source includes the hand at the grip;
// this is not represented as an unseen full weapon model.
for(const [key,rect,size]of [['GunEnergy',[209,755,85,63],[36,27]],['GunCannon',[565,758,110,90],[46,38]]]){
 const p=crop(actor,rect);runtime[key]=save('WPN_'+key.toUpperCase(),fit(p,...size),{source:actor,rect,size,limitation:'Visible weapon crop from authored pose; grip is partly occluded by the hand.'});
 runtime[key==='GunEnergy'?'HudEnergy':'HudCannon']=save('UI_'+key.toUpperCase(),fit(p,26,22),{source:actor,rect,size:[26,22]});
}
// Editor proxies preserve their exact former dimensions; only their preview art changes.
for(const [name,key,w,h]of [['Player','HeroIDLE',40,56],['Patrol','Patrol',48,48],['Turret','Turret',56,56],['Shield','GuardIdle',56,56]]){
 let p;if(name==='Player')p=crop(actor,poses.IDLE.rect);else p=PNG.sync.read(fs.readFileSync(path.join(root,runtime[key])));
 runtime['Proxy'+name]=save('EDITOR_'+name.toUpperCase(),fit(p,w,h),{size:[w,h],purpose:'Editor preview and unchanged gameplay proxy'});
}
const sources=[actor,enemy].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(source,file))).digest('hex')}));
fs.writeFileSync(path.join(root,'assets/HD_ACTORS_MANIFEST.json'),JSON.stringify({version:1,sources,runtime,entries,limitations:['Eight authored key poses, not continuous frame animation.','No isolated weapon masters; only visible weapon crops are available.','FIRE crop truncates the farthest beam tail before the neighboring HURT pose.']},null,2));
// Review on light and dark backgrounds at 2x runtime scale.
const tiles=entries.filter(e=>e.name.startsWith('CHR_')||e.name.startsWith('ENM_')||e.name.startsWith('WPN_'));
const cols=4,cw=352,ch=285,sheet=new PNG({width:cols*cw,height:Math.ceil(tiles.length/cols)*ch});
for(let y=0;y<sheet.height;y++)for(let x=0;x<sheet.width;x++){const i=(y*sheet.width+x)*4,dark=Math.floor(x/cw)%2;sheet.data.set(dark?[38,60,88,255]:[219,237,244,255],i);}
for(let i=0;i<tiles.length;i++){const e=tiles[i],p=PNG.sync.read(fs.readFileSync(path.join(root,e.file))),big=fit(p,p.width*2,p.height*2),ox=i%cols*cw+(cw-big.width)/2,oy=Math.floor(i/cols)*ch+ch-big.height;
 for(let y=0;y<big.height;y++)for(let x=0;x<big.width;x++){const si=(y*big.width+x)*4,di=((oy+y)*sheet.width+ox+x)*4,a=big.data[si+3]/255;for(let c=0;c<3;c++)sheet.data[di+c]=Math.round(big.data[si+c]*a+sheet.data[di+c]*(1-a));}
}
fs.writeFileSync(path.join(root,'previews/hd-actors-contact-sheet.png'),PNG.sync.write(sheet));
console.log(JSON.stringify({assets:entries.length,manifest:'assets/HD_ACTORS_MANIFEST.json',review:'previews/hd-actors-contact-sheet.png'}));
module.exports={runtime};
