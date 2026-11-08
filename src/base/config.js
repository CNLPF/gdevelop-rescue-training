// Authored, deterministic level data. Distances are in pixels, durations in seconds.
export const BASE = {
  width:8400,
  weapons:{
    Energy:{id:'Energy',name:'能量枪',damage:1,upgradedDamage:2,interval:0.30,speed:720,range:600,upgradeCost:12,verticalBias:0.75,switchMargin:0.2},
    Cannon:{id:'Cannon',name:'穿盾炮',damage:4,upgradedDamage:8,weakDamage:1,upgradedWeakDamage:2,charge:0.8,interval:0.65,speed:520,range:480,upgradeCost:16,verticalBias:0.75,switchMargin:0.2},
    Missile:{id:'Missile',name:'制导导弹',damage:3,upgradedDamage:5,weakDamage:1,upgradedWeakDamage:2,lock:0.55,lockRange:560,interval:0.90,speed:360,range:720,turnRate:240,upgradeCost:18,purchaseCost:20,verticalBias:0.75,switchMargin:0.2},
  },
  aimTargetTypes:['Patrol','Turret','Shield','Dummy','ScoutDrone','ArmoredDrone','JammerCore','TrialDrone'],
  zones:[
    {id:'Entry',name:'01 基地入口',start:0,end:1000,goal:'空格跳跃 · 空中再按一次，到达蓝色信标',tempo:1.15,intensity:0.10},
    {id:'Corridor',name:'02 巡逻走廊',start:1000,end:2300,goal:'按住 W 射击 · 利用掩体清除 5 名敌人',tempo:1.05,intensity:0.45},
    {id:'Supply',name:'03 补给站',start:2300,end:3000,goal:'靠近武器箱按 E · 免费领取穿盾炮',tempo:1.15,intensity:0.15},
    {id:'Shield',name:'04 护盾通道',start:3000,end:4100,goal:'绕后或蓄满穿盾炮 · 清除 4 名守卫',tempo:0.95,intensity:0.58},
    {id:'Energy',name:'05 能源平台',start:4100,end:5600,goal:'利用上下路线 · 清除 7 名混合敌人',tempo:0.82,intensity:0.76},
    {id:'Aerial',name:'06 天空救援线',start:5600,end:7600,goal:'取得导弹 · 清除飞行敌人后击破中继核心',tempo:0.75,intensity:0.94},
    {id:'Rescue',name:'07 救援出口',start:7600,end:8400,goal:'护盾中继已解除 · 到达绿色救援出口',tempo:1.10,intensity:0.15},
  ],
  // Authored sawtooth: every combat spike is followed by a readable release.
  combatBeats:[
    {id:'entry-teach',zone:'Entry',type:'teach',intensity:0.10},
    {id:'corridor-build',zone:'Corridor',type:'combat',intensity:0.45},
    {id:'supply-rest',zone:'Supply',type:'rest',intensity:0.15},
    {id:'shield-build',zone:'Shield',type:'combat',intensity:0.58},
    {id:'energy-peak',zone:'Energy',type:'combat',intensity:0.76},
    {id:'upper-route-rest',zone:'Energy',type:'rest',intensity:0.32},
    {id:'aerial-climax',zone:'Aerial',type:'climax',intensity:0.94},
    {id:'rescue-release',zone:'Rescue',type:'release',intensity:0.15},
  ],
  // Ground gaps occur only in learning, traversal, or aerial-route spaces.
  terrain:[
    [0,560,780,80],[900,560,3400,80],[4420,560,1390,80],[5930,560,270,80],
    [240,470,160,24],[470,360,210,28],
    [1180,430,120,24],[1300,460,160,24],[1510,360,180,24],[1660,420,160,24],
    [1960,380,150,24],
    [2550,470,160,24],[2760,360,180,24],
    [3080,430,150,24],[3190,460,160,24],[3310,320,160,24],[3390,360,180,24],[3630,430,120,24],
    [4200,460,120,24],[4310,360,160,24],[4410,460,160,24],[4650,320,180,24],
    [4780,470,160,24],[4980,360,180,24],[5130,430,150,24],[5480,350,160,24],
    [5700,470,150,24],
    // Aerial route: 120 px teaching gaps, shallow single-jump steps and safe islands.
    [6260,400,120,24],[6320,500,180,24],[6500,440,160,24],[6620,360,160,24],[6680,500,160,24],
    [6870,310,150,24],
    [6910,560,390,80],
    [7320,500,280,24],[7600,440,200,24],[7700,360,180,24],[7800,500,100,24],
    [7910,560,490,80],
  ],
  walls:[
    [1560,470,40,90],[1860,470,40,90],[3470,470,40,90],
    [4670,470,40,90],[4890,470,40,90],[5420,470,40,90],[7280,500,40,60],
  ],
  gates:[
    {id:'entry',x:980},{id:'corridor',x:2280},{id:'supply',x:2980},
    {id:'shield',x:4080},{id:'energy',x:5580},{id:'relay',x:7860},
  ],
  enemies:[
    {id:'p1',type:'Patrol',x:1200,y:512,min:1120,max:1260,zone:'Corridor',dropY:520},
    {id:'p5',type:'Patrol',x:1390,y:512,min:1340,max:1460,zone:'Corridor',dropY:520},
    {id:'p2',type:'Patrol',x:1760,y:512,min:1700,max:1810,zone:'Corridor',dropY:520},
    {id:'t1',type:'Turret',x:2090,y:504,zone:'Corridor',dropY:520},
    {id:'t4',type:'Turret',x:1990,y:324,zone:'Corridor',dropY:400},
    {id:'s1',type:'Shield',x:3710,y:504,min:3650,max:3820,zone:'Shield',dropY:520},
    {id:'p6',type:'Patrol',x:3210,y:412,min:3205,max:3290,zone:'Shield',dropY:488},
    {id:'s3',type:'Shield',x:3520,y:504,min:3480,max:3560,zone:'Shield',dropY:520},
    {id:'t5',type:'Turret',x:3950,y:504,zone:'Shield',dropY:520},
    {id:'p3',type:'Patrol',x:4520,y:512,min:4490,max:4610,zone:'Energy',dropY:520},
    {id:'t2',type:'Turret',x:4830,y:504,zone:'Energy',dropY:520},
    {id:'p4',type:'Patrol',x:5090,y:512,min:5020,max:5140,zone:'Energy',dropY:520},
    {id:'s2',type:'Shield',x:5340,y:504,min:5290,max:5400,zone:'Energy',dropY:520},
    {id:'t3',type:'Turret',x:5535,y:504,zone:'Energy',dropY:520},
    {id:'s4',type:'Shield',x:5160,y:504,min:5160,max:5160,zone:'Energy',dropY:520},
    {id:'sd4',type:'ScoutDrone',x:5250,y:292,min:5200,max:5350,hoverY:292,zone:'Energy',dropY:408,cooldown:1.1},
    {id:'sd1',type:'ScoutDrone',x:6240,y:352,min:6210,max:6340,hoverY:352,zone:'Aerial',dropY:438,cooldown:1.2},
    {id:'sd2',type:'ScoutDrone',x:6500,y:312,min:6450,max:6600,hoverY:312,zone:'Aerial',dropY:408,cooldown:0.8},
    // Stagger the dense group so warnings read as a sequence rather than three
    // simultaneous bomb lanes. Their periods remain the same for this encounter.
    {id:'ad1',type:'ArmoredDrone',x:6970,y:250,min:6920,max:7130,hoverY:250,zone:'Aerial',dropY:448,cooldown:2.35},
    {id:'sd3',type:'ScoutDrone',x:7160,y:224,min:7080,max:7250,hoverY:224,zone:'Aerial',dropY:408,cooldown:0.7},
    {id:'ad2',type:'ArmoredDrone',x:7180,y:308,min:7040,max:7270,hoverY:308,zone:'Aerial',dropY:448,cooldown:1.25},
    {id:'ad3',type:'ArmoredDrone',x:7420,y:260,min:7360,max:7520,hoverY:260,zone:'Aerial',dropY:448,cooldown:1.85},
  ],
  enemyStats:{
    Patrol:{
      health:2,speed:78,period:2.8,warning:0.62,range:380,verticalRange:160,
      speedBullet:270,chaseRange:540,chaseLeash:420,preferredDistance:180,
      standoffDistance:96,
    },
    Turret:{
      health:4,speed:30,period:2.2,warning:0.7,range:520,verticalRange:260,
      speedBullet:270,chaseRange:520,chaseLeash:420,preferredDistance:280,
      standoffDistance:148,
    },
    Shield:{
      health:8,speed:52,period:3.2,warning:0.7,range:350,verticalRange:170,
      speedBullet:245,chaseRange:540,chaseLeash:440,preferredDistance:200,
      standoffDistance:112,facingDelay:1.35,
    },
    ScoutDrone:{
      health:3,speed:68,hoverAmp:18,hoverRate:2.4,period:2.0,warning:0.62,
      range:480,verticalRange:300,speedBullet:290,chaseRange:620,chaseLeash:520,
      preferredDistance:230,standoffDistance:140,verticalChase:0.55,
    },
    ArmoredDrone:{
      health:10,speed:42,hoverAmp:10,hoverRate:1.5,period:3.2,warning:0.84,
      range:490,verticalRange:320,bombSpeed:340,recover:0.3,chaseRange:660,
      chaseLeash:560,preferredDistance:260,standoffDistance:170,verticalChase:0.35,
    },
    JammerCore:{health:12},
    TrialDrone:{health:2},
  },
  // Reinforcement sites are authored on safe terrain. The runtime chooses one
  // deterministically inside the player's current combat zone, never in rest
  // zones, and keeps at most three active at once.
  reinforcements:{
    maxActive:3,
    initialDelay:6,
    minDelay:5,
    maxDelay:7,
    firstAttackDelay:1.1,
    safeSpawnDistance:220,
    allowedZones:['Corridor','Shield','Energy','Aerial'],
    sites:[
      {key:'corridor-patrol-a',zone:'Corridor',type:'Patrol',x:1450,y:512,min:1400,max:1520,dropY:520},
      {key:'corridor-shield-a',zone:'Corridor',type:'Shield',x:1700,y:512,min:1650,max:1790,dropY:520},
      {key:'corridor-turret-a',zone:'Corridor',type:'Turret',x:1870,y:504,dropY:520},
      {key:'corridor-scout-a',zone:'Corridor',type:'ScoutDrone',x:2130,y:292,min:2070,max:2220,hoverY:292,dropY:408},
      {key:'corridor-patrol-b',zone:'Corridor',type:'Patrol',x:2160,y:512,min:2110,max:2240,dropY:520},
      {key:'shield-patrol-a',zone:'Shield',type:'Patrol',x:3870,y:512,min:3830,max:3990,dropY:520},
      {key:'shield-shield-a',zone:'Shield',type:'Shield',x:3260,y:412,min:3210,max:3370,dropY:488},
      {key:'shield-turret-a',zone:'Shield',type:'Turret',x:3770,y:504,dropY:520},
      {key:'shield-armored-a',zone:'Shield',type:'ArmoredDrone',x:3520,y:258,min:3470,max:3650,hoverY:258,dropY:448},
      {key:'shield-scout-a',zone:'Shield',type:'ScoutDrone',x:3360,y:286,min:3300,max:3460,hoverY:286,dropY:408},
      {key:'shield-patrol-b',zone:'Shield',type:'Patrol',x:3810,y:512,min:3760,max:3900,dropY:520},
      {key:'energy-patrol-a',zone:'Energy',type:'Patrol',x:4920,y:512,min:4860,max:4980,dropY:520},
      {key:'energy-shield-a',zone:'Energy',type:'Shield',x:5210,y:512,min:5150,max:5290,dropY:520},
      {key:'energy-turret-a',zone:'Energy',type:'Turret',x:5380,y:504,dropY:520},
      {key:'energy-scout-a',zone:'Energy',type:'ScoutDrone',x:4710,y:276,min:4660,max:4820,hoverY:276,dropY:408},
      {key:'energy-armored-a',zone:'Energy',type:'ArmoredDrone',x:5420,y:242,min:5370,max:5520,hoverY:242,dropY:448},
      {key:'aerial-patrol-a',zone:'Aerial',type:'Patrol',x:6920,y:512,min:6890,max:7300,dropY:520},
      {key:'aerial-shield-a',zone:'Aerial',type:'Shield',x:7130,y:512,min:7090,max:7270,dropY:520},
      {key:'aerial-turret-a',zone:'Aerial',type:'Turret',x:7040,y:504,dropY:520},
      {key:'aerial-scout-a',zone:'Aerial',type:'ScoutDrone',x:6410,y:300,min:6360,max:6520,hoverY:300,dropY:408},
      {key:'aerial-armored-a',zone:'Aerial',type:'ArmoredDrone',x:6810,y:238,min:6760,max:6900,hoverY:238,dropY:448},
      {key:'aerial-scout-b',zone:'Aerial',type:'ScoutDrone',x:7240,y:270,min:7190,max:7350,hoverY:270,dropY:408},
    ],
  },
  // The training room uses the same controlled generator during its combat
  // lesson. Its sites stay inside the authored combat lane and away from the
  // shop, comparison targets and finish zone.
  trainingReinforcements:{
    maxActive:3,
    initialDelay:5,
    minDelay:4,
    maxDelay:6,
    firstAttackDelay:1.2,
    safeSpawnDistance:220,
    allowedZones:['Combat'],
    sites:[
      {key:'training-patrol-a',zone:'Combat',type:'Patrol',x:1500,y:512,min:1460,max:1600,dropY:520},
      {key:'training-shield-a',zone:'Combat',type:'Shield',x:1760,y:512,min:1710,max:1840,dropY:520},
      {key:'training-turret-a',zone:'Combat',type:'Turret',x:1920,y:504,dropY:520},
      {key:'training-scout-a',zone:'Combat',type:'ScoutDrone',x:1690,y:300,min:1640,max:1810,hoverY:300,dropY:408},
      {key:'training-patrol-b',zone:'Combat',type:'Patrol',x:2050,y:512,min:2000,max:2170,dropY:520},
      {key:'training-armored-a',zone:'Combat',type:'ArmoredDrone',x:1900,y:250,min:1840,max:2020,hoverY:250,dropY:448},
    ],
  },
  shops:[
    {id:'shop-supply',type:'standard',x:2350,y:464},
    {id:'shop-energy',type:'standard',x:4110,y:464},
    {id:'shop-missile',type:'missile',x:5740,y:464},
    {id:'shop-rescue',type:'standard',x:8000,y:464},
  ],
  trialDrones:[
    {id:'trial-1',x:5960,y:480},
    {id:'trial-2',x:6060,y:480},
    {id:'trial-3',x:6160,y:480},
  ],
  jammer:{id:'relay-core',x:7520,y:360,health:12},
  portals:[
    {id:'supply',name:'补给站',unlockX:2310,x:2490,y:504},
    {id:'energy',name:'能源平台入口',unlockX:4110,x:4150,y:504},
    {id:'rescue',name:'救援出口',unlockX:7600,x:8080,y:504},
  ],
  coins:[
    [180,520],[310,430],[530,320],[640,320],[730,520],[940,520],
    [1060,520],[1490,520],[1940,520],[2210,520],
    [2470,520],[2940,520],[3120,520],[3950,520],
    [4250,420],[4450,420],[5730,430],[5990,430],
    // Three two-coin optional detours, always reconnecting to the main route.
    [1540,320],[1630,320],[2790,320],[2880,320],[5010,320],[5100,320],
    // Eight aerial-route coins. Enemy and trial rewards are tracked separately.
    [5840,430],[6040,430],[6170,430],[6360,438],[6540,378],[6720,438],[7010,500],[7240,438],
  ],
};

export function weaponCycle({current='Energy',hasCannon=false,hasMissile=false}){
  const owned=['Energy',...(hasCannon?['Cannon']:[]),...(hasMissile?['Missile']:[])];
  const index=Math.max(0,owned.indexOf(current));
  return owned[(index+1)%owned.length];
}

export function basePurchase({coins,item,owned=false,hasCannon=false,hasMissile=false,health=3,stock=false}){
  const weapon=BASE.weapons[item];
  const cost=item==='MissilePurchase'?BASE.weapons.Missile.purchaseCost:item==='heal'?5:weapon?.upgradeCost;
  if(cost===undefined)return {ok:false,reason:'invalid',coins};
  if(owned||stock)return {ok:false,reason:'owned',coins};
  if(item==='Cannon'&&!hasCannon)return {ok:false,reason:'locked',coins};
  if(item==='Missile'&&!hasMissile)return {ok:false,reason:'missile-locked',coins};
  if(item==='heal'&&health>=3)return {ok:false,reason:'full',coins};
  if(coins<cost)return {ok:false,reason:'funds',coins};
  return {ok:true,coins:coins-cost,cost};
}

export function baseShot(weapon,upgraded,charge=0){
  const w=BASE.weapons[weapon];
  if(!w)throw new Error('Unknown weapon '+weapon);
  if(weapon==='Cannon'){
    const charged=charge+1e-9>=w.charge;
    return {damage:charged?(upgraded?w.upgradedDamage:w.damage):(upgraded?w.upgradedWeakDamage:w.weakDamage),pierceShield:charged,speed:w.speed,range:w.range};
  }
  if(weapon==='Missile'){
    const locked=charge+1e-9>=w.lock;
    return {damage:locked?(upgraded?w.upgradedDamage:w.damage):(upgraded?w.upgradedWeakDamage:w.weakDamage),pierceShield:false,locked,speed:w.speed,range:w.range};
  }
  return {damage:upgraded?w.upgradedDamage:w.damage,pierceShield:false,speed:w.speed,range:w.range};
}

export function trialReward(count=1){
  const safe=Math.max(0,Math.min(3,Math.floor(Number(count)||0)));
  return {count:safe,coins:safe*4};
}

export function missileTurn(vx,vy,target,dt,turnRate=BASE.weapons.Missile.turnRate){
  const speed=Math.hypot(vx,vy);
  if(!speed||!target)return {vx,vy};
  const current=Math.atan2(vy,vx),desired=Math.atan2(target.y,target.x);
  let delta=desired-current;
  while(delta>Math.PI)delta-=Math.PI*2;
  while(delta<-Math.PI)delta+=Math.PI*2;
  const maxTurn=turnRate*Math.PI/180*Math.max(0,dt);
  const next=current+Math.max(-maxTurn,Math.min(maxTurn,delta));
  return {vx:Math.cos(next)*speed,vy:Math.sin(next)*speed};
}

export function shieldBlocks({shield,facing,impactX,centerX,pierceShield}){
  return shield&&!pierceShield&&(impactX-centerX)*facing>=0;
}

export function enemyAttackEligible({
  paused=false,
  cameraX,
  enemy,
  player,
  range,
  verticalRange=Infinity,
  viewportHalfWidth=480,
  blocked=false,
}){
  if(paused||blocked)return false;
  const onscreen=Math.abs(enemy.x-cameraX)<=viewportHalfWidth;
  return onscreen&&Math.abs(player.y-enemy.y)<=verticalRange&&Math.hypot(player.x-enemy.x,player.y-enemy.y)<=range;
}

export function enemyAttackTiming(type,tempo=1){
  const stats=BASE.enemyStats[type];
  if(!stats||stats.period===undefined)return null;
  const safeTempo=Math.max(0.65,Math.min(1.25,Number(tempo)||1));
  return {tempo:safeTempo,period:stats.period*safeTempo,warning:stats.warning};
}

export function reinforcementZone(x){
  const zone=BASE.zones.find(item=>x>=item.start&&x<item.end);
  return zone&&BASE.reinforcements.allowedZones.includes(zone.id)?zone:null;
}

// Deterministic LCG helper: replayable tests and stable classroom demos without
// sharing music, AI accounts or online services.
export function reinforcementRandom(seed=0){
  let value=(Math.floor(Number(seed)||0)*1664525+1013904223)>>>0;
  value^=value>>>16;value=Math.imul(value,0x7feb352d)>>>0;
  value^=value>>>15;value=Math.imul(value,0x846ca68b)>>>0;
  value=(value^value>>>16)>>>0;
  return value/4294967296;
}

export function reinforcementDelay(seed=0, profile=BASE.reinforcements){
  const {minDelay,maxDelay}=profile;
  return minDelay+Math.floor(reinforcementRandom(seed)*(maxDelay-minDelay+1));
}

export function reinforcementSite({
  zone,
  seed=0,
  occupied=[],
  playerX=null,
  profile=BASE.reinforcements,
}={}){
  if(!zone)return null;
  const occupiedKeys=new Set(occupied);
  const candidates=profile.sites.filter(site=>
    site.zone===zone&&
    !occupiedKeys.has(site.key)&&
    (playerX===null||Math.abs(site.x-playerX)>=profile.safeSpawnDistance),
  );
  if(!candidates.length)return null;
  return candidates[Math.floor(reinforcementRandom(seed)*candidates.length)];
}
