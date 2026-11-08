export function attachBaseCombat(r){
  r.fire=charge=>{
    const weapon=r.string('CurrentWeapon'),upgraded=r.boolean(weapon+'Upgraded');
    const shot=baseShot(weapon,upgraded,Number(charge)||0);
    const origin={x:r.player.getX()+(r.facing>0?42:-2),y:r.player.getY()+29};
    const {target,dx,dy}=resolveShotAim(r,weapon,shot,origin);
    const targetId=target?r.ov(target,'Id').getAsString():'';
    const bullet=r.create('Bullet',origin.x-5,origin.y-5);
    for(const [k,v] of Object.entries({
      Vx:dx*shot.speed,Vy:dy*shot.speed,Damage:shot.damage,Range:shot.range,Distance:0,
      Locked:!!shot.locked,TargetId:targetId,
    })){
      if(typeof v==='number')r.ov(bullet,k).setNumber(v);
      else if(typeof v==='boolean')r.ov(bullet,k).setBoolean(v);
      else r.ov(bullet,k).setString(v);
    }
    r.ov(bullet,'Weapon').setString(weapon);r.ov(bullet,'PierceShield').setBoolean(shot.pierceShield);
    const color=weapon==='Cannon'?'164;116;255':weapon==='Missile'?'255;154;77':'45;200;220';
    bullet.setColor(color);
    if(shot.pierceShield){bullet.setWidth(20);bullet.setHeight(20);}
    if(weapon==='Missile'){bullet.setWidth(24);bullet.setHeight(12);if(shot.locked)r.add('MissileLockedShots');}
    r.add('ShotsFired');r.add(weapon+'Shots');if(shot.pierceShield)r.add('ChargedShots');
    r.set('AimTarget',targetId);r.flash(origin.x,origin.y,color);
  };

  r.spawnReinforcement=(site,sequence)=>{
    if(!site)return false;
    const enemy=r.create(site.type,site.x,site.y);
    if(!enemy)return false;
    const zone=BASE.zones.find(item=>item.id===site.zone);
    const values={
      Id:'reinforce-'+sequence,Health:BASE.enemyStats[site.type].health,Active:true,
      Dynamic:true,Reinforcement:true,SiteKey:site.key,
      SpawnX:site.x,SpawnY:site.y,MinX:site.min??site.x,MaxX:site.max??site.x,
      Direction:sequence%2===0?1:-1,Facing:1,DesiredFacing:1,TurnCooldown:0,
      Cooldown:BASE.reinforcements.firstAttackDelay,
      Tempo:zone?.tempo??1,Warning:false,AttackX:site.x,HoverY:site.hoverY??site.y,
      Phase:(sequence%7)*0.7,DropY:site.dropY??site.y+48,Zone:site.zone,Flash:0,
    };
    for(const [key,value]of Object.entries(values)){
      if(typeof value==='number')r.ov(enemy,key).setNumber(value);
      else if(typeof value==='boolean')r.ov(enemy,key).setBoolean(value);
      else r.ov(enemy,key).setString(value);
    }
    enemy.flipX(values.Direction<0);
    if(r.registerEnemyPresentation)r.registerEnemyPresentation(enemy,site.type);
    r.add('ReinforcementsSpawned');
    r.toast('发现随机增援：'+({
      Patrol:'巡逻机器人',Shield:'护盾守卫',Turret:'移动炮台',
      ScoutDrone:'侦察无人机',ArmoredDrone:'装甲无人机',
    }[site.type]||site.type));
    return true;
  };

  r.updateReinforcements=()=>{
    if(r.mode()!=='Playing'||!r.boolean('ReinforcementsEnabled'))return;
    const dynamic=[];
    for(const type of ['Patrol','Shield','Turret','ScoutDrone','ArmoredDrone'])for(const enemy of r.objects(type)){
      if(r.ov(enemy,'Dynamic').getAsBoolean()&&r.ov(enemy,'Health').getAsNumber()>0)dynamic.push(enemy);
    }
    if(dynamic.length>=BASE.reinforcements.maxActive)return;
    let timer=r.number('ReinforcementTimer');
    if(timer>0){r.set('ReinforcementTimer',Math.max(0,timer-r.dt));return;}
    const zone=reinforcementZone(r.player.getX());
    if(!zone)return;
    const occupied=dynamic.map(enemy=>r.ov(enemy,'SiteKey').getAsString());
    const sequence=r.number('ReinforcementSequence');
    const seed=(r.number('ReinforcementSeed')+sequence*7919)>>>0;
    const site=reinforcementSite({zone:zone.id,seed,occupied,playerX:r.player.getX()});
    if(site&&r.spawnReinforcement(site,sequence)){
      r.set('ReinforcementSequence',sequence+1);
      r.set('ReinforcementTimer',reinforcementDelay(seed+1));
    }
  };

  r.damageTarget=(target,bullet,impactX)=>{
    const health=r.ov(target,'Health').getAsNumber();if(health<=0)return false;
    const kind=target.getName(),point=r.center(target),weapon=r.ov(bullet,'Weapon').getAsString()||'Energy';
    if(kind==='JammerCore'&&weapon!=='Missile'){
      r.add('JammerBlocks');r.flash(point.x-22,point.y,'120;170;255');
      r.toast('普通武器无法破坏中继核心 · 需要制导导弹');
      return false;
    }
    const blocked=shieldBlocks({shield:kind==='Shield',facing:r.ov(target,'Facing').getAsNumber(),impactX,centerX:point.x,pierceShield:r.ov(bullet,'PierceShield').getAsBoolean()});
    if(blocked){
      r.add('ShieldBlocks');r.flash(point.x-25,point.y,'120;170;255');
      r.toast('盾牌挡住了！蓄满穿盾炮，或绕到背后');
      return false;
    }
    r.ov(target,'Health').setNumber(Math.max(0,health-r.ov(bullet,'Damage').getAsNumber()));
    r.add('Hits');r.add(weapon+'Hits');r.ov(target,'Flash').setNumber(0.12);
    r.flash(point.x,point.y,'255;184;65');
    if(kind==='TrialDrone')return r.damageTrialDrone(target);
    if(kind==='Dummy')return r.damageDummy(target);
    if(kind==='JammerCore')return r.damageJammerCore(target,weapon);
    if(r.ov(target,'Health').getAsNumber()>0)return true;
    const id=r.ov(target,'Id').getAsString();
    if(!r.ledger('DefeatedEnemies',id).getAsBoolean()){
      r.ledger('DefeatedEnemies',id).setBoolean(true);
      const dynamic=target.getVariables().has('Dynamic')&&r.ov(target,'Dynamic').getAsBoolean();
      if(dynamic)r.add('ReinforcementsDefeated');
      else{
        r.add('EnemiesDefeated');r.add(kind+'Defeated');
        const x=r.ov(target,'SpawnX').getAsNumber(),dropY=r.ov(target,'DropY').getAsNumber()||520;
        for(let i=0;i<3;i++){const c=r.create('Coin',x-8+i*28,dropY);r.ov(c,'Id').setString(id+'-reward-'+i);r.ov(c,'Reward').setBoolean(true);}
      }
    }
    for(let i=0;i<4;i++)r.flash(point.x+(i-1.5)*12,point.y-(i%2)*15,'255;145;96');
    target.deleteFromScene();
    return true;
  };

  r.damageDummy=target=>{
    r.add('DummyHits');r.ov(target,'RoundHits').setNumber(r.ov(target,'RoundHits').getAsNumber()+1);
    if(r.ov(target,'Health').getAsNumber()<=0){target.hide();r.toast('训练靶击毁 · 靠近按 E 可重置');}
    return true;
  };

  r.damageTrialDrone=target=>{
    if(r.ov(target,'Health').getAsNumber()>0)return true;
    const id=r.ov(target,'Id').getAsString();
    if(!r.ledger('TrialPaid',id).getAsBoolean()){
      r.ledger('TrialPaid',id).setBoolean(true);
      const reward=trialReward(1);
      r.add('Coins',reward.coins);r.add('CoinsCollected',reward.coins);r.add('TrialCoinsEarned',reward.coins);r.add('TrialTargetsDefeated');
      r.flash(r.center(target).x,r.center(target).y,'255;202;79');
    }
    r.ov(target,'Active').setBoolean(false);target.hide();
    const left=r.objects('TrialDrone').filter(o=>r.ov(o,'Active').getAsBoolean()).length;
    r.toast(left?`补给浮标击破 · 本轮还剩 ${left} 个`:'补给试炼完成！本轮获得 12 金币');
    return true;
  };

  r.damageJammerCore=(target,weapon)=>{
    if(r.ov(target,'Health').getAsNumber()>0)return true;
    if(!r.boolean('JammerCoreDefeated')){
      r.set('JammerCoreDefeated',true);r.add('JammerCoresDefeated');
      r.toast('中继核心已摧毁 · 救援出口闸门开启');
    }
    for(let i=0;i<5;i++)r.flash(r.center(target).x+(i-2)*14,r.center(target).y-(i%2)*12,'82;231;255');
    target.deleteFromScene();
    return true;
  };

  r.projectiles=()=>{
    if(r.mode()!=='Playing')return;
    const walls=r.walls();
    for(const name of ['Bullet','EnemyBullet'])for(const b of [...r.objects(name)]){
      if(r.mode()!=='Playing')break;
      const weapon=r.ov(b,'Weapon').getAsString();
      if(name==='Bullet'&&weapon==='Missile'&&r.ov(b,'Locked').getAsBoolean()){
        const target=r.targets().find(o=>r.ov(o,'Id').getAsString()===r.ov(b,'TargetId').getAsString());
        if(target){
          const start=r.center(b),turned=missileTurn(
            r.ov(b,'Vx').getAsNumber(),r.ov(b,'Vy').getAsNumber(),
            {x:targetAimPoint(target).x-start.x,y:targetAimPoint(target).y-start.y},
            r.dt,BASE.weapons.Missile.turnRate,
          );
          r.ov(b,'Vx').setNumber(turned.vx);r.ov(b,'Vy').setNumber(turned.vy);
        }else r.ov(b,'Locked').setBoolean(false);
      }
      const start=r.center(b),vx=r.ov(b,'Vx').getAsNumber(),vy=r.ov(b,'Vy').getAsNumber();
      const distance=r.ov(b,'Distance').getAsNumber(),range=r.ov(b,'Range').getAsNumber()||600;
      const speed=Math.hypot(vx,vy),travel=Math.min(speed*r.dt,Math.max(0,range-distance)),ratio=speed?travel/speed:0;
      const end={x:start.x+vx*ratio,y:start.y+vy*ratio};let hit=null,first=2;
      for(const wall of walls){const t=r.Rules.segmentRect(start.x,start.y,end.x,end.y,wall,3);if(t!==null&&t<first){first=t;hit={wall:true};}}
      for(const target of name==='Bullet'?r.targets():[r.player]){
        const t=r.Rules.segmentRect(start.x,start.y,end.x,end.y,r.box(target),3);
        if(t!==null&&t<first){first=t;hit={target};}
      }
      if(hit){
        if(hit.target){
          if(name==='Bullet')r.damageTarget(hit.target,b,start.x);else r.hurtPlayer();
        }
        b.deleteFromScene();continue;
      }
      b.setPosition(end.x-b.getWidth()/2,end.y-b.getHeight()/2);r.ov(b,'Distance').setNumber(distance+travel);
      if(distance+travel>=range||end.x<0||end.x>BASE.width||end.y>740||end.y<0)b.deleteFromScene();
    }
  };

  attachEnemyAI(r);
}
