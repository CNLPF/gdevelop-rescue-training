export function attachCombat(r) {
  r.fire = () => {
    const muzzle={x:r.player.getX()+(r.facing>0?64:-24),y:r.player.getY()-2};
    // Keep the established body-height combat line so low platforms do not alter weapon balance.
    const origin={x:r.player.getX()+(r.facing>0?42:-2),y:r.player.getY()+29};
    const targets=r.targets().map(o=>({...r.center(o),health:r.ov(o,'Health').getAsNumber(),id:r.ov(o,'Id').getAsString(),object:o}));
    const target=r.Rules.chooseTarget(origin,r.facing,targets,r.walls());
    let dx=r.facing,dy=0;
    if(target){const length=Math.hypot(target.x-origin.x,target.y-origin.y);dx=(target.x-origin.x)/length;dy=(target.y-origin.y)/length;}
    const bullet=r.create('Bullet',origin.x-5,origin.y-5);
    const upgraded=r.string('WeaponForm')==='Upgrade';
    for(const [key,value] of Object.entries({Vx:dx*720,Vy:dy*720,Distance:0,Damage:upgraded?2:1}))r.ov(bullet,key).setNumber(value);
    r.ov(bullet,'Upgraded').setBoolean(upgraded);bullet.setColor(upgraded?'255;184;65':'55;197;232');
    r.set('AimTarget',target?r.ov(target,'Id').getAsString():'');r.add('ShotsFired');r.flash(muzzle.x,muzzle.y,upgraded?'255;184;65':'55;197;232');
  };
  r.damageTarget = (target,damage,upgraded) => {
    const health=r.ov(target,'Health').getAsNumber();if(health<=0)return;
    r.ov(target,'Health').setNumber(Math.max(0,health-damage));r.add('Hits');if(upgraded)r.add('UpgradedHits');
    const point=r.center(target);r.flash(point.x,point.y,'255;184;65');
    if(target.getName()==='Dummy'){
      r.add('DummyHits');if(upgraded)r.set('UpgradedDummyHit',true);
      r.set('DummyHealth',Math.max(0,health-damage));
      if(health-damage<=0){r.set('DummyDestroyed',true);target.hide();r.toast('训练靶已击毁 · E 重置，Q 比较两种形态');}
    }else if(health-damage<=0){
      const id=r.ov(target,'Id').getAsString();
      const defeated=r.vars.get('DefeatedEnemies');
      if(!defeated.getChild(id).getAsBoolean()){
        defeated.getChild(id).setBoolean(true);r.add('EnemiesDefeated');
        const x=r.ov(target,'SpawnX').getAsNumber();
        for(let i=0;i<3;i++){
          const coin=r.create('Coin',x-12+i*28,516);r.ov(coin,'Id').setString(id+'-reward-'+i);r.ov(coin,'Reward').setBoolean(true);
        }
      }
      target.deleteFromScene();
    }
  };
  r.projectiles = () => {
    if(r.mode()!=='Playing')return;
    const walls=r.walls();
    for(const name of ['Bullet','EnemyBullet'])for(const bullet of [...r.objects(name)]){
      const start=r.center(bullet),vx=r.ov(bullet,'Vx').getAsNumber(),vy=r.ov(bullet,'Vy').getAsNumber();
      const end={x:start.x+vx*r.dt,y:start.y+vy*r.dt};
      let hit=null,first=2;
      for(const wall of walls){const t=r.Rules.segmentRect(start.x,start.y,end.x,end.y,wall,3);if(t!==null&&t<first){first=t;hit={wall:true};}}
      const targets=name==='Bullet'?r.targets():[r.player];
      for(const target of targets){const t=r.Rules.segmentRect(start.x,start.y,end.x,end.y,r.box(target),3);if(t!==null&&t<first){first=t;hit={target};}}
      if(hit){
        if(hit.target){if(name==='Bullet')r.damageTarget(hit.target,r.ov(bullet,'Damage').getAsNumber(),r.ov(bullet,'Upgraded').getAsBoolean());else r.hurtPlayer();}
        bullet.deleteFromScene();continue;
      }
      bullet.setPosition(end.x-bullet.getWidth()/2,end.y-bullet.getHeight()/2);
      const distance=r.ov(bullet,'Distance').getAsNumber()+Math.hypot(vx,vy)*r.dt;r.ov(bullet,'Distance').setNumber(distance);
      if(distance>=600||end.x<0||end.x>3200||end.y>720||end.y<0)bullet.deleteFromScene();
    }
  };
  r.enemyAI = () => {
    if(r.mode()!=='Playing'||r.stage()==='Jump')return;
    for(const enemy of r.objects('Patrol')){
      const min=r.ov(enemy,'MinX').getAsNumber(),max=r.ov(enemy,'MaxX').getAsNumber();
      let direction=r.ov(enemy,'Direction').getAsNumber()||1;
      if(enemy.getX()>=max)direction=-1;if(enemy.getX()<=min)direction=1;
      r.ov(enemy,'Direction').setNumber(direction);enemy.setX(Math.max(min,Math.min(max,enemy.getX()+direction*64*r.dt)));enemy.flipX(direction<0);
    }
    for(const enemy of r.objects('Turret')){
      const point=r.center(enemy),player=r.center(r.player),warning=r.object('TurretWarning');
      let cooldown=r.ov(enemy,'Cooldown').getAsNumber();
      const active=Math.hypot(player.x-point.x,player.y-point.y)<=700;
      if(active)cooldown-=r.dt;else cooldown=2;
      if(warning){warning.setPosition(point.x-22,point.y-100);warning.hide(!active||cooldown>0.6);}
      r.ov(enemy,'Warning').setBoolean(active&&cooldown<=0.6);
      if(cooldown<=0){
        const distance=Math.hypot(player.x-point.x,player.y-point.y)||1;
        const b=r.create('EnemyBullet',point.x-6,point.y-6);
        r.ov(b,'Vx').setNumber((player.x-point.x)/distance*220);r.ov(b,'Vy').setNumber((player.y-point.y)/distance*220);r.ov(b,'Distance').setNumber(0);
        cooldown=2;
      }
      r.ov(enemy,'Cooldown').setNumber(cooldown);
    }
    if(!r.object('Turret'))r.object('TurretWarning')?.hide();
  };
}
