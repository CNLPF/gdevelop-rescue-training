// TrainingRoom keeps its original five-stage lesson. This adapter adds the
// V0.3 aerial enemies and missile as an optional combat layer without changing
// the old progression or reward ledgers.
export function attachTrainingAerial(r){
  if(r.trainingAerial)return;
  r.trainingAerial=true;
  r.charge=0;r.charging=false;r.fireLocked=false;r.missileTargetId='';r.aimTargetId='';
  r.aerialLabels=new Map();
  // Runtime reinforcements need a seed even though TrainingRoom does not run
  // the RescueBase-only initialization module.
  if(!r.number('ReinforcementSeed')){
    r.set('ReinforcementSeed',Math.floor(Math.random()*2147483647));
  }

  const ledgers=['CollectedCoins','DefeatedEnemies','TrialPaid'];
  for(const name of ledgers)if(!r.vars.get(name))r.set(name,false);
  r.ledger=(name,id)=>{
    const ledger=r.vars.get(name);
    if(!ledger)return null;
    const child=ledger.getChild(id);
    return child||null;
  };
  attachAiming(r);
  r.registerTrainingAerialPresentation=(enemy,type)=>{
    if(!enemy||r.aerialLabels.has(enemy))return;
    const label=r.create('EnemyLabel',enemy.getX(),enemy.getY()-30);
    if(label){
      label.setLayer('HUD');label.setZOrder(20);
      r.aerialLabels.set(enemy,label);
    }
  };
  r.spawnTrainingReinforcement=(site,sequence)=>{
    if(!site)return false;
    const enemy=r.create(site.type,site.x,site.y);
    if(!enemy)return false;
    const values={
      Id:'training-reinforce-'+sequence,Health:BASE.enemyStats[site.type].health,
      Active:true,Dynamic:true,Reinforcement:true,SiteKey:site.key,
      SpawnX:site.x,SpawnY:site.y,MinX:site.min??site.x,MaxX:site.max??site.x,
      Direction:sequence%2===0?1:-1,Facing:1,DesiredFacing:1,TurnCooldown:0,
      Cooldown:BASE.trainingReinforcements.firstAttackDelay,
      Tempo:1,Warning:false,AttackX:site.x,HoverY:site.hoverY??site.y,
      Phase:(sequence%5)*0.8,DropY:site.dropY??site.y+48,Zone:'Combat',Flash:0,
    };
    for(const [key,value]of Object.entries(values)){
      if(typeof value==='number')r.ov(enemy,key).setNumber(value);
      else if(typeof value==='boolean')r.ov(enemy,key).setBoolean(value);
      else r.ov(enemy,key).setString(value);
    }
    enemy.flipX(values.Direction<0);
    r.registerTrainingAerialPresentation(enemy,site.type);
    r.add('ReinforcementsSpawned');
    r.toast('训练房随机增援：'+({
      Patrol:'巡逻机器人',Shield:'护盾守卫',Turret:'移动炮台',
      ScoutDrone:'侦察无人机',ArmoredDrone:'装甲无人机',
    }[site.type]||site.type));
    return true;
  };
  r.updateTrainingReinforcements=()=>{
    if(r.mode()!=='Playing'||r.stage()!=='Combat'||!r.boolean('ReinforcementsEnabled'))return;
    const profile=BASE.trainingReinforcements;
    const dynamic=[];
    for(const type of ['Patrol','Shield','Turret','ScoutDrone','ArmoredDrone'])for(const enemy of r.objects(type)){
      if(r.ov(enemy,'Dynamic').getAsBoolean()&&r.ov(enemy,'Health').getAsNumber()>0)dynamic.push(enemy);
    }
    if(dynamic.length>=profile.maxActive)return;
    const timer=r.number('ReinforcementTimer');
    if(timer>0){r.set('ReinforcementTimer',Math.max(0,timer-r.dt));return;}
    const sequence=r.number('ReinforcementSequence');
    const seed=(r.number('ReinforcementSeed')+sequence*7919)>>>0;
    const site=reinforcementSite({
      zone:'Combat',seed,profile,
      occupied:dynamic.map(enemy=>r.ov(enemy,'SiteKey').getAsString()),
      playerX:r.player.getX(),
    });
    if(site&&r.spawnTrainingReinforcement(site,sequence)){
      r.set('ReinforcementSequence',sequence+1);
      r.set('ReinforcementTimer',reinforcementDelay(seed+1,profile));
    }
  };
  r.updateReinforcements=r.updateTrainingReinforcements;
  r.resetTrial=()=>{
    for(const target of r.objects('TrialDrone')){
      r.ov(target,'Health').setNumber(2);
      r.ov(target,'Active').setBoolean(true);
      r.ov(target,'Flash').setNumber(0);
      target.hide(false);
      r.ledger('TrialPaid',r.ov(target,'Id').getAsString())?.setBoolean(false);
    }
    r.add('TrialRound');
    r.toast('导弹试炼重置 · 三个浮标每个奖励 4 金币');
  };

  r.fire=linkedCharge=>{
    const weapon=r.string('CurrentWeapon')||'Energy';
    const upgraded=weapon==='Missile'?r.boolean('MissileUpgraded'):r.string('WeaponForm')==='Upgrade';
    const shot=baseShot(weapon,upgraded,Number(linkedCharge)||0);
    const muzzle={x:r.player.getX()+(r.facing>0?64:-24),y:r.player.getY()-2};
    const origin={x:r.player.getX()+(r.facing>0?42:-2),y:r.player.getY()+29};
    const {target,dx,dy}=resolveShotAim(r,weapon,shot,origin);
    const targetId=target?r.ov(target,'Id').getAsString():'';
    const bullet=r.create('Bullet',origin.x-5,origin.y-5);
    for(const [key,value]of Object.entries({
      Vx:dx*shot.speed,Vy:dy*shot.speed,Damage:shot.damage,Range:shot.range,Distance:0,
      Locked:!!shot.locked,TargetId:targetId,
    })){
      if(typeof value==='number')r.ov(bullet,key).setNumber(value);
      else if(typeof value==='boolean')r.ov(bullet,key).setBoolean(value);
      else r.ov(bullet,key).setString(value);
    }
    r.ov(bullet,'Weapon').setString(weapon);
    r.ov(bullet,'PierceShield').setBoolean(shot.pierceShield);
    const color=weapon==='Cannon'?'164;116;255':weapon==='Missile'?'255;154;77':'45;200;220';
    bullet.setColor(color);
    if(shot.pierceShield){bullet.setWidth(20);bullet.setHeight(20);}
    if(weapon==='Missile'){
      bullet.setWidth(24);bullet.setHeight(12);
      if(shot.locked)r.add('MissileLockedShots');
    }
    r.add('ShotsFired');r.add(weapon+'Shots');
    if(shot.pierceShield)r.add('ChargedShots');
    r.set('AimTarget',targetId);
    r.flash(muzzle.x,muzzle.y,color);
  };

  r.damageTarget=(target,bullet,impactX)=>{
    const health=r.ov(target,'Health').getAsNumber();
    if(health<=0)return false;
    const kind=target.getName(),point=r.center(target);
    const weapon=r.ov(bullet,'Weapon').getAsString()||'Energy';
    const damage=r.ov(bullet,'Damage').getAsNumber()||1;
    const blocked=shieldBlocks({
      shield:kind==='Shield',
      facing:r.ov(target,'Facing').getAsNumber(),
      impactX,
      centerX:point.x,
      pierceShield:r.ov(bullet,'PierceShield').getAsBoolean(),
    });
    if(blocked){
      r.add('ShieldBlocks');
      r.flash(point.x-25,point.y,'120;170;255');
      r.toast('盾牌挡住了！蓄满穿盾炮，或绕到背后');
      return false;
    }
    r.ov(target,'Health').setNumber(Math.max(0,health-damage));
    r.add('Hits');r.add(weapon+'Hits');
    r.ov(target,'Flash').setNumber(0.12);
    r.flash(point.x,point.y,weapon==='Missile'?'255;154;77':'255;184;65');

    if(kind==='Dummy'){
      const next=Math.max(0,health-damage);
      r.add('DummyHits');
      if(r.string('WeaponForm')==='Upgrade')r.set('UpgradedDummyHit',true);
      r.set('DummyHealth',next);
      if(next<=0){r.set('DummyDestroyed',true);target.hide();r.toast('训练靶已击毁 · E 重置，Q 比较两种形态');}
      return true;
    }
    if(kind==='TrialDrone'){
      if(r.ov(target,'Health').getAsNumber()<=0){
        const id=r.ov(target,'Id').getAsString(),paid=r.ledger('TrialPaid',id);
        if(paid&&!paid.getAsBoolean()){
          paid.setBoolean(true);
          const reward=trialReward(1);
          r.add('Coins',reward.coins);r.add('CoinsCollected',reward.coins);
          r.add('TrialCoinsEarned',reward.coins);r.add('TrialTargetsDefeated');
        }
        r.ov(target,'Active').setBoolean(false);target.hide();
        r.toast('浮标击破 · +4 金币');
      }
      return true;
    }
    if(r.ov(target,'Health').getAsNumber()>0)return true;

    const id=r.ov(target,'Id').getAsString();
    const defeated=r.ledger('DefeatedEnemies',id);
    if(defeated&&!defeated.getAsBoolean()){
      defeated.setBoolean(true);
      const dynamic=target.getVariables().has('Dynamic')&&r.ov(target,'Dynamic').getAsBoolean();
      if(dynamic)r.add('ReinforcementsDefeated');
      else{
        if(kind==='Patrol'||kind==='Turret')r.add('EnemiesDefeated');
        r.add(kind+'Defeated');
        const x=r.ov(target,'SpawnX').getAsNumber(),dropY=r.ov(target,'DropY').getAsNumber()||516;
        for(let i=0;i<3;i++){
          const coin=r.create('Coin',x-12+i*28,dropY);
          r.ov(coin,'Id').setString(id+'-reward-'+i);
          r.ov(coin,'Reward').setBoolean(true);
        }
      }
    }
    target.deleteFromScene();
    return true;
  };

  r.projectiles=()=>{
    if(r.mode()!=='Playing')return;
    const walls=r.walls();
    for(const name of ['Bullet','EnemyBullet'])for(const bullet of [...r.objects(name)]){
      if(r.mode()!=='Playing')break;
      const weapon=r.ov(bullet,'Weapon').getAsString()||'Energy';
      if(name==='Bullet'&&weapon==='Missile'&&r.ov(bullet,'Locked').getAsBoolean()){
        const target=r.targets().find(o=>r.ov(o,'Id').getAsString()===r.ov(bullet,'TargetId').getAsString());
        if(target){
          const start=r.center(bullet),point=targetAimPoint(target);
          const turned=missileTurn(
            r.ov(bullet,'Vx').getAsNumber(),r.ov(bullet,'Vy').getAsNumber(),
            {x:point.x-start.x,y:point.y-start.y},r.dt,BASE.weapons.Missile.turnRate,
          );
          r.ov(bullet,'Vx').setNumber(turned.vx);r.ov(bullet,'Vy').setNumber(turned.vy);
        }else r.ov(bullet,'Locked').setBoolean(false);
      }
      const start=r.center(bullet),vx=r.ov(bullet,'Vx').getAsNumber(),vy=r.ov(bullet,'Vy').getAsNumber();
      const distance=r.ov(bullet,'Distance').getAsNumber(),range=r.ov(bullet,'Range').getAsNumber()||600;
      const speed=Math.hypot(vx,vy),travel=Math.min(speed*r.dt,Math.max(0,range-distance));
      const ratio=speed?travel/speed:0,end={x:start.x+vx*ratio,y:start.y+vy*ratio};
      let hit=null,first=2;
      for(const wall of walls){
        const t=r.Rules.segmentRect(start.x,start.y,end.x,end.y,wall,3);
        if(t!==null&&t<first){first=t;hit={wall:true};}
      }
      for(const target of name==='Bullet'?r.targets():[r.player]){
        const t=r.Rules.segmentRect(start.x,start.y,end.x,end.y,r.box(target),3);
        if(t!==null&&t<first){first=t;hit={target};}
      }
      if(hit){
        if(hit.target){
          if(name==='Bullet')r.damageTarget(hit.target,bullet,start.x+(end.x-start.x)*first);
          else r.hurtPlayer();
        }
        bullet.deleteFromScene();continue;
      }
      bullet.setPosition(end.x-bullet.getWidth()/2,end.y-bullet.getHeight()/2);
      r.ov(bullet,'Distance').setNumber(distance+travel);
      if(distance+travel>=range||end.x<0||end.x>3200||end.y>720||end.y<0)bullet.deleteFromScene();
    }
  };

  // Replace createRescue's legacy TrainingRoom AI with the shared movement and
  // attack implementation. The stage guard keeps the jump lesson peaceful.
  attachEnemyAI(r);
  const sharedEnemyAI=r.enemyAI;
  r.enemyAI=()=>{
    if(r.mode()!=='Playing'||r.stage()==='Jump')return;
    sharedEnemyAI();
  };

  const oldWorld=r.world;
  const oldRespawn=r.respawn;
  r.respawn=()=>{
    if(r.mode()!=='Playing')return;
    oldRespawn();
    // A fall returns the same run to spawn. Keep the player's projectiles;
    // only hostile attacks are cleared so the return cannot cause a surprise hit.
    for(const bullet of [...r.objects('EnemyBullet')])bullet.deleteFromScene();
    r.setAttackRecovery(0.8);
    r.cancelCharge();
  };
  r.world=()=>{
    oldWorld();
    if(r.mode()!=='Playing')return;
    const box=r.box(r.player);
    for(const type of ['Shield','ScoutDrone','ArmoredDrone'])for(const enemy of r.objects(type)){
      if(r.Rules.overlaps(box,r.box(enemy)))r.hurtPlayer();
    }
  };

  r.input=()=>{
    if(r.pressed.restart&&!['Respawning','RestartConfirm'].includes(r.mode())){r.requestRestart();return;}
    if(r.mode()==='RestartConfirm'){
      if(r.pressed.cancel)r.setMode(r.previousMode);
      else if(r.pressed.confirm)r.startNewRun();
      return;
    }
    if(r.mode()==='Shop'){
      if(r.pressed.cancel){r.setMode('Playing');return;}
      if(r.pressed.confirm){
        const result=r.Rules.purchase(r.number('Coins'),r.boolean('UpgradePurchased'));
        if(result.ok){
          r.set('Coins',result.coins);r.set('UpgradePurchased',true);r.set('WeaponForm','Upgrade');
          r.set('CurrentWeapon','Energy');r.add('Purchases');
          r.shopFeedback='升级成功！Esc 返回训练，Q 切换武器';
          r.toast('升级成功！每发伤害变为 2 · Q 切换武器');
        }else{
          r.shopFeedback=result.reason==='owned'?'已经拥有升级，无需再次购买':'还差 '+(10-r.number('Coins'))+' 枚金币';
          r.toast(r.shopFeedback);
        }
      }
      return;
    }
    if(r.mode()!=='Playing')return;
    if(r.number('Health')<=0){r.startNewRun();return;}

    const shop=r.object('Shop');
    if(r.pressed.interact&&Math.abs(r.center(r.player).x-r.center(shop).x)<100&&['Purchase','Compare','Finish'].includes(r.stage())){
      r.shopFeedback='';r.setMode('Shop');return;
    }
    if(r.pressed.interact&&Math.abs(r.player.getX()-2460)<150&&['Compare','Finish'].includes(r.stage()))r.resetDummy();
    const crate=r.object('CannonCrate');
    if(r.pressed.interact&&crate&&Math.abs(r.center(r.player).x-r.center(crate).x)<95){
      if(!r.boolean('HasMissile')){
        r.set('HasMissile',true);r.set('CurrentWeapon','Missile');r.cancelCharge();
        r.add('MissileBought');r.toast('获得制导导弹！按住 W 锁定，松开后发射');
      }else r.toast('制导导弹已装备 · Q 切换能量枪');
      return;
    }
    const trial=r.objects('TrialDrone')[0];
    if(r.pressed.interact&&trial&&Math.abs(r.center(r.player).x-r.center(trial).x)<160){
      r.resetTrial();return;
    }
    if(r.pressed.switch){
      r.cancelCharge();
      if(!r.boolean('HasMissile')){
        r.set('CurrentWeapon','Energy');
        if(!r.boolean('UpgradePurchased')){
          r.toast('先收集 10 枚金币，到商店升级能量枪');
        }else{
          r.set('WeaponForm',r.string('WeaponForm')==='Base'?'Upgrade':'Base');
          r.toast(r.string('WeaponForm')==='Base'?'基础形态 · 每发伤害 1':'升级形态 · 每发伤害 2');
        }
      }else{
        const next=weaponCycle({current:r.string('CurrentWeapon'),hasCannon:false,hasMissile:true});
        r.set('CurrentWeapon',next);
        r.toast('已切换 '+(next==='Missile'?'制导导弹':'能量枪'));
      }
    }

    r.move();
    const currentWeapon=r.string('CurrentWeapon')||'Energy',currentConfig=BASE.weapons[currentWeapon];
    updateWeaponInput(r,currentWeapon,currentConfig);
  };

  for(const type of ['Patrol','Shield','Turret','ScoutDrone','ArmoredDrone','TrialDrone'])for(const object of r.objects(type))r.registerTrainingAerialPresentation(object,type);
  attachSharedAimReticle(r);

  const oldPresentation=r.presentation;
  r.presentation=()=>{
    oldPresentation();
    const weapon=r.string('CurrentWeapon')||'Energy',upgraded=weapon==='Missile'?r.boolean('MissileUpgraded'):r.string('WeaponForm')==='Upgrade';
    const w=BASE.weapons[weapon];
    const meter=weapon==='Missile'?(r.charging?r.charge/w.lock:1-r.fireCooldown/w.interval):1;
    const teaching=r.stage()==='Jump';
    r.renderHud({
      weapon:w.name,upgraded,status:'',missile:weapon==='Missile',meter,
      charging:weapon==='Missile'&&r.charging,
      chargeX:r.player.getX()+4,chargeY:r.player.getY()+60,
      teaching,lesson:'教学目标 · 到达蓝色信标',
    });
    r.object('ChargeFill')?.setColor(weapon==='Missile'?'255;174;76':'138;108;243');
    r.object('CannonCrate')?.setOpacity(r.boolean('HasMissile')?135:255);

    let prompt='';
    if(r.mode()==='Playing'){
      if(Math.abs(r.player.getX()-1960)<120&&['Purchase','Compare','Finish'].includes(r.stage()))prompt='[ E ] 打开升级商店';
      else if(Math.abs(r.player.getX()-2240)<100)prompt=r.boolean('HasMissile')?'[ Q ] 换枪    [ E ] 查看导弹箱':'[ E ] 领取制导导弹';
      else if(Math.abs(r.player.getX()-2660)<170)prompt='[ E ] 重置导弹试炼';
      else if(Math.abs(r.player.getX()-2460)<150&&['Compare','Finish'].includes(r.stage()))prompt='[ E ] 重置训练靶    [ Q ] 切换武器';
    }
    r.text('PromptText',prompt);
    const promptObject=r.object('PromptText');
    if(promptObject)promptObject.hide(!prompt);

    const names={
      Patrol:'巡逻机器人',Shield:'护盾守卫',Turret:'固定炮台',
      ScoutDrone:'侦察无人机',ArmoredDrone:'装甲无人机',TrialDrone:'导弹浮标',
    };
    for(const [object,label]of [...r.aerialLabels]){
      const exists=r.objects(object.getName()).includes(object);
      const variables=object.getVariables();
      const active=!variables.has('Active')||variables.get('Active').getAsBoolean();
      label.hide(!exists||!active||r.ov(object,'Health').getAsNumber()<=0);
      if(!exists){
        label.deleteFromScene();r.aerialLabels.delete(object);continue;
      }
      label.setPosition(object.getX()-12,object.getY()+(object.getName()==='TrialDrone'?-26:-38));
      const suffix=object.getName()==='TrialDrone'?' · +4':'';
      label.setString(names[object.getName()]+' '+r.ov(object,'Health').getAsNumber()+suffix);
      const flash=r.ov(object,'Flash').getAsNumber();
      if(r.mode()==='Playing')r.ov(object,'Flash').setNumber(Math.max(0,flash-r.dt));
      object.setOpacity(flash>0?140:255);
    }

    presentSharedAimReticle(r);
  };
}
