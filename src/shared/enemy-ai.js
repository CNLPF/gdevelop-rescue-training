// Scene-neutral enemy movement and attacks. Both scenes use this pipeline so
// authored and reinforcement enemies cannot silently drift into different AI.
export function attachEnemyAI(r){
  const types=['Patrol','Shield','Turret','ScoutDrone','ArmoredDrone'];
  const flying=new Set(['ScoutDrone','ArmoredDrone']);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  const attackState=(enemy,stats)=>{
    const camera=r.scene.getLayer('Gameplay').getCameraX();
    const point=r.center(enemy),player=r.center(r.player);
    const blocked=r.walls().some(wall=>
      r.Rules.segmentRect(point.x,point.y,player.x,player.y,wall)!==null);
    return enemyAttackEligible({
      paused:r.mode()!=='Playing',
      cameraX:camera,
      enemy:point,
      player,
      range:stats.range,
      verticalRange:stats.verticalRange??Infinity,
      blocked,
    });
  };

  const homeBounds=(enemy,stats)=>{
    // Ground pursuit stays inside the authored walkable segment. Expanding
    // targets beyond narrow ledges made guards walk off the map during a chase.
    // These bounds still let them close distance toward a player outside the
    // segment until they reach its edge.
    const authoredMin=r.ov(enemy,'MinX').getAsNumber();
    const authoredMax=r.ov(enemy,'MaxX').getAsNumber();
    const spawnX=r.ov(enemy,'SpawnX').getAsNumber();
    const leash=stats.chaseLeash??360;
    let minX=Math.min(authoredMin,authoredMax);
    let maxX=Math.max(authoredMin,authoredMax);
    // Fixed-position authored turrets have a zero-width patrol range. Convert
    // that to a slow moving unit with a bounded chase leash so every enemy can
    // close distance without crossing the authored zone.
    if(maxX-minX<stats.preferredDistance){
      minX=Math.min(minX,spawnX-leash);
      maxX=Math.max(maxX,spawnX+leash);
    }
    const zone=BASE.zones.find(item=>item.id===r.ov(enemy,'Zone').getAsString());
    if(zone){
      minX=Math.max(minX,zone.start+16);
      maxX=Math.min(maxX,zone.end-16);
    }
    return {
      minX:Math.max(16,minX),
      maxX:Math.min(BASE.width-80,maxX),
    };
  };

  const moveGroundEnemy=(enemy,nextX)=>{
    const point=r.center(enemy),next={x:nextX,y:point.y};
    // Ground enemies chase across flat lanes but must not walk straight through
    // tall cover. Stop at the cover edge and keep firing; the player can flank,
    // jump, or use a shield-piercing shot while the enemy remains visible.
    // Keep the centre-line test unpadded. The shared wall list also contains
    // the ground platforms; expanding their rectangles by half an enemy height
    // made every ground unit detect the floor as a wall and freeze in place.
    // Tall authored cover still intersects the centre line and blocks pursuit.
    const blocked=r.walls().some(wall=>wall.h>=70&&
      r.Rules.segmentRect(point.x,point.y,next.x,next.y,wall)!==null);
    if(!blocked)enemy.setX(nextX);
    return !blocked;
  };

  const updateFacing=(enemy,type,direction,desired)=>{
    if(type!=='Shield'){
      r.ov(enemy,'Facing').setNumber(desired);
      enemy.flipX(direction<0);
      return;
    }

    const stats=BASE.enemyStats.Shield;
    let facing=r.ov(enemy,'Facing').getAsNumber();
    let target=r.ov(enemy,'DesiredFacing').getAsNumber();
    let timer=r.ov(enemy,'TurnCooldown').getAsNumber();
    if(desired===facing){
      target=desired;
      timer=0;
    }else if(target!==desired){
      // Arm a fresh reaction window when the player crosses to the other side.
      // The shield still advances and fires while its visible plate is turning,
      // so this delay creates a fair flanking window without disabling the AI.
      target=desired;
      timer=stats.facingDelay??1.35;
    }else{
      timer=Math.max(0,timer-r.dt);
      if(timer<=0){
        facing=desired;
        enemy.flipX(facing>0);
      }
    }
    r.ov(enemy,'DesiredFacing').setNumber(target);
    r.ov(enemy,'TurnCooldown').setNumber(timer);
    r.ov(enemy,'Facing').setNumber(facing);
  };

  const approach=(enemy,type,stats)=>{
    const point=r.center(enemy),player=r.center(r.player);
    const dx=player.x-point.x,dy=player.y-point.y;
    const bounds=homeBounds(enemy,stats);
    let direction=r.ov(enemy,'Direction').getAsNumber()||1;
    const chase=Math.hypot(dx,dy)<=stats.chaseRange;

    if(chase&&Math.abs(dx)>stats.preferredDistance){
      direction=dx>=0?1:-1;
      const step=Math.min(Math.abs(dx)-stats.preferredDistance,stats.speed*r.dt);
      const nextX=clamp(enemy.getX()+direction*step,bounds.minX,bounds.maxX);
      if(flying.has(type))enemy.setX(nextX);
      else moveGroundEnemy(enemy,nextX);
    }else if(chase&&Math.abs(dx)<(stats.standoffDistance??96)){
      // Keep the readable firing lane open. Enemies still track and shoot, but
      // back away when the player walks into their collision box instead of
      // silently converting a chase into unavoidable contact damage.
      direction=dx>=0?-1:1;
      const step=Math.min((stats.standoffDistance??96)-Math.abs(dx),stats.speed*r.dt);
      const nextX=clamp(enemy.getX()+direction*step,bounds.minX,bounds.maxX);
      if(flying.has(type))enemy.setX(nextX);
      else moveGroundEnemy(enemy,nextX);
    }else if(!chase){
      const homeX=r.ov(enemy,'SpawnX').getAsNumber();
      if(Math.abs(enemy.getX()-homeX)>4)direction=enemy.getX()<homeX?1:-1;
      else if(enemy.getX()>=r.ov(enemy,'MaxX').getAsNumber())direction=-1;
      else if(enemy.getX()<=r.ov(enemy,'MinX').getAsNumber())direction=1;
      const step=Math.min(Math.abs(enemy.getX()-homeX),stats.speed*r.dt);
      if(step>0){
        const nextX=clamp(enemy.getX()+direction*step,bounds.minX,bounds.maxX);
        if(flying.has(type))enemy.setX(nextX);
        else moveGroundEnemy(enemy,nextX);
      }
    }

    if(flying.has(type)){
      const hoverY=r.ov(enemy,'HoverY').getAsNumber();
      const verticalTarget=clamp(
        hoverY+clamp(dy*(stats.verticalChase??0.45),-170,170),
        Math.max(70,hoverY-190),
        Math.min(500,hoverY+190),
      );
      const phase=r.ov(enemy,'Phase').getAsNumber();
      const bob=Math.sin(r.time*(stats.hoverRate||1)+phase)*(stats.hoverAmp||0);
      enemy.setY(verticalTarget+bob);
    }

    r.ov(enemy,'Direction').setNumber(direction);
    const facing=player.x>=point.x?1:-1;
    updateFacing(enemy,type,direction,facing);
  };

  const fire=(enemy,type,stats)=>{
    const point=r.center(enemy),player=r.center(r.player);
    if(type==='ArmoredDrone'){
      const attackX=r.ov(enemy,'AttackX').getAsNumber()||player.x;
      const bomb=r.create('EnemyBullet',attackX-7,point.y+enemy.getHeight()*0.25);
      if(!bomb)return false;
      r.ov(bomb,'Vx').setNumber(0);
      r.ov(bomb,'Vy').setNumber(stats.bombSpeed);
      r.ov(bomb,'Range').setNumber(700);
      r.ov(bomb,'Distance').setNumber(0);
      r.ov(bomb,'Weapon').setString('DroneBomb');
    }else{
      const length=Math.hypot(player.x-point.x,player.y-point.y)||1;
      const shot=r.create('EnemyBullet',point.x-6,point.y-6);
      if(!shot)return false;
      r.ov(shot,'Vx').setNumber((player.x-point.x)/length*stats.speedBullet);
      r.ov(shot,'Vy').setNumber((player.y-point.y)/length*stats.speedBullet);
      r.ov(shot,'Range').setNumber(700);
      r.ov(shot,'Distance').setNumber(0);
      r.ov(shot,'Weapon').setString(type);
    }
    r.add('EnemyShots');
    r.add(type+'Attacks');
    return true;
  };

  const updateAttack=(enemy,type,stats)=>{
    const timing=enemyAttackTiming(type,r.ov(enemy,'Tempo').getAsNumber());
    if(!timing)return;
    const active=attackState(enemy,stats);
    let cooldown=r.ov(enemy,'Cooldown').getAsNumber();
    if(!active){
      cooldown=timing.period;
      r.ov(enemy,'Warning').setBoolean(false);
      r.ov(enemy,'Cooldown').setNumber(cooldown);
      return;
    }

    cooldown=Math.max(0,cooldown-r.dt);
    const warning=cooldown<=timing.warning;
    const wasWarning=r.ov(enemy,'Warning').getAsBoolean();
    r.ov(enemy,'Warning').setBoolean(warning);
    if(warning&&!wasWarning)r.ov(enemy,'AttackX').setNumber(r.center(r.player).x);

    if(cooldown<=0){
      // Re-read the final position after movement. If the enemy left the
      // viewport or lost line of sight during its timing, defer the attack.
      if(attackState(enemy,stats))fire(enemy,type,stats);
      cooldown=timing.period;
      r.ov(enemy,'Warning').setBoolean(false);
    }
    r.ov(enemy,'Cooldown').setNumber(cooldown);
  };

  r.setAttackRecovery=seconds=>{
    for(const type of types)for(const enemy of r.objects(type)){
      if(r.ov(enemy,'Health').getAsNumber()<=0)continue;
      r.ov(enemy,'Cooldown').setNumber(seconds);
      r.ov(enemy,'Warning').setBoolean(false);
    }
  };

  r.enemyAI=()=>{
    if(r.mode()!=='Playing')return;
    r.updateReinforcements?.();
    for(const type of types){
      const stats=BASE.enemyStats[type];
      if(!stats)continue;
      for(const enemy of r.objects(type)){
        if(r.ov(enemy,'Health').getAsNumber()<=0)continue;
        approach(enemy,type,stats);
        updateAttack(enemy,type,stats);
      }
    }
  };
}
