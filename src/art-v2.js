// Presentation only. Gameplay proxies, native physics, damage and economy are unchanged.
export function attachArtV2(r){
  if(r.artV2)return;r.artV2=true;
  const hudArtLayout=r.hudArtLayout||{
    ArtHeart:{x:30,y:22,width:20,height:18,z:4},
    ArtCoin:{x:102,y:22,width:18,height:18,z:4},
    ArtWeaponIcon:{x:166,y:21,width:28,height:22,z:4},
  };
  const spawn=(name,layer='Effects',z=14)=>{const o=r.create(name,0,0);if(!o)return null;o.setLayer(layer);o.setZOrder(z);return o;};
  const hero=spawn('ArtHero'),gun=spawn('ArtGun','Effects',15),heart=spawn('ArtHeart','HUD',4),coin=spawn('ArtCoin','HUD',4),weaponIcon=spawn('ArtWeaponIcon','HUD',4),interact=spawn('ArtInteract','Effects',30);
  for(const [name,o]of Object.entries({ArtHeart:heart,ArtCoin:coin,ArtWeaponIcon:weaponIcon})){
    const layout=hudArtLayout[name];o.setPosition(layout.x,layout.y);o.setWidth(layout.width);o.setHeight(layout.height);o.setZOrder(layout.z);
  }
  const enemies=new Map(),bullets=new Map(),platforms=new Map();
  const aerialAttackTimers=new Map(),lastAerialWarnings=new Map();
  const lastAerialAttackCounts={ScoutDrone:-1,ArmoredDrone:-1};
  // Platform art uses native-size tiles and never participates in collision queries.
  for(const type of ['Terrain','Wall'])for(const o of r.objects(type)){
    const visual=spawn('ArtPlatform'+Math.round(o.getWidth())+'x'+Math.round(o.getHeight()),'Gameplay',o.getZOrder()+0.1);
    // A missing cosmetic frame must never halt gameplay. Keep the native
    // platform visible and continue drawing every other visual proxy.
    if(!visual)continue;
    visual.setPosition(o.getX(),o.getY());platforms.set(o,visual);o.setOpacity(0);
  }
  const old=r.presentation;
  let firePose=0,lastShots=r.number('ShotsFired'),lastX=r.player.getX(),pose='';
  r.presentation=()=>{
    old();
    const playing=r.mode()==='Playing',delta=playing?r.dt:0,player=r.player;
    const aerialAttackCounts={
      ScoutDrone:r.number('ScoutDroneAttacks'),
      ArmoredDrone:r.number('ArmoredDroneAttacks'),
    };
    const currentWeapon=r.string('CurrentWeapon'),cannon=currentWeapon==='Cannon',missile=currentWeapon==='Missile',flipped=r.facing<0;
    if(r.number('ShotsFired')!==lastShots){firePose=0.14;lastShots=r.number('ShotsFired');}else firePose=Math.max(0,firePose-delta);
    const moving=Math.abs(player.getX()-lastX)>0.1;lastX=player.getX();
    const next=r.invulnerable>1.05?'HURT':firePose>0?(cannon||missile?'FIRE':'SHOOT'):r.charging?'CHARGE':!r.body.isOnFloor()?(r.number('JumpCount')>=2?'DBLJUMP':'JUMP'):moving?'RUN':'IDLE';
    if(next!==pose){hero.setAnimationName(next);pose=next;}
    const bob=playing&&r.body.isOnFloor()?(moving?Math.sin(r.time*20)*1.1:Math.sin(r.time*3)*0.35):0;
    // HD canvases share an authored foot anchor at (88,116), not a per-pose crop edge.
    hero.setPosition(player.getX()+20-88,player.getY()+56-116+bob);hero.flipX(flipped);hero.setOpacity(player.getOpacity());player.setOpacity(0);
    const recoil=firePose>0?Math.min(3,firePose*18):0;
    const gunName=missile?'Missile':cannon?'Cannon':'Energy';
    gun.setAnimationName(gunName);gun.flipX(flipped);
    const width=missile?50:cannon?46:36,height=missile?32:cannon?38:27;
    gun.setPosition(player.getX()+(flipped?6:34)-(flipped?width:0)+(flipped?recoil:-recoil),player.getY()-7+bob);
    // These three supplied key poses already contain the exact painted weapon/effect.
    gun.hide(['SHOOT','CHARGE','FIRE'].includes(next));
    gun.setOpacity(hero.getOpacity());
    weaponIcon.setAnimationName(gunName);
    for(const [o,visual]of platforms){o.setOpacity(0);visual.setPosition(o.getX(),o.getY());}
    for(const type of ['Patrol','Turret','Shield','ScoutDrone','ArmoredDrone','JammerCore','TrialDrone']){
      const live=r.objects(type);
      for(const [o,v]of enemies)if(o.getName()===type&&!live.includes(o)){
        v.deleteFromScene();enemies.delete(o);aerialAttackTimers.delete(o);lastAerialWarnings.delete(o);
      }
      for(const o of live){
        let v=enemies.get(o);if(!v){v=spawn('Art'+type);enemies.set(o,v);}
        const health=r.ov(o,'Health').getAsNumber();
        const variables=o.getVariables();
        const active=!variables.has('Active')||variables.get('Active').getAsBoolean();
        v.hide(health<=0||!active);
        const warning=['Patrol','Turret','Shield','ScoutDrone','ArmoredDrone'].includes(type)&&r.ov(o,'Warning').getAsBoolean();
        const flying=type==='ScoutDrone'||type==='ArmoredDrone';
        const flash=r.ov(o,'Flash').getAsNumber();
        let animationName=type==='Patrol'?(warning?'Warn':'Run'):warning?'Warn':type==='Shield'&&r.artBlockTime>0?'Block':'Idle';
        if(flying){
          const previousWarning=lastAerialWarnings.get(o)===true;
          const actualAttack=aerialAttackCounts[type]>lastAerialAttackCounts[type];
          let attackTime=aerialAttackTimers.get(o)||0;
          if(actualAttack&&previousWarning&&!warning&&active&&health>0)attackTime=0.16;
          attackTime=Math.max(0,attackTime-delta);
          aerialAttackTimers.set(o,attackTime);
          lastAerialWarnings.set(o,warning);
          animationName=flash>0?'Hit':warning?'Warn':attackTime>0?'Attack':'Idle';
        }
        v.setAnimationName(animationName);
        if(type==='Shield')v.flipX(r.ov(o,'Facing').getAsNumber()>0);
        else if(['Patrol','ScoutDrone','ArmoredDrone'].includes(type))v.flipX(r.ov(o,'Direction').getAsNumber()<0);
        else if(type==='Turret')v.flipX(player.getX()<o.getX());
        if(flying){
          const visualSize=type==='ScoutDrone'?96:108;
          v.setWidth(visualSize);v.setHeight(visualSize);
          v.setPosition(o.getX()+o.getWidth()/2-v.getWidth()/2,o.getY()+o.getHeight()/2-v.getHeight()/2);
        }else{
          v.setPosition(o.getX()+o.getWidth()/2-v.getWidth()/2,o.getY()+o.getHeight()-v.getHeight());
        }
        v.setOpacity(flash>0?150:255);o.setOpacity(0);
        const labelOffset=type==='Shield'?-57:type==='ScoutDrone'||type==='ArmoredDrone'?-80:-26;
        if(r.labelMap?.has(o))r.labelMap.get(o).label.setPosition(o.getX()-12,o.getY()+labelOffset);
      }
    }
    lastAerialAttackCounts.ScoutDrone=aerialAttackCounts.ScoutDrone;
    lastAerialAttackCounts.ArmoredDrone=aerialAttackCounts.ArmoredDrone;
    // Bullet visuals follow the existing swept-collision objects; one gameplay hit remains one hit.
    for(const [b,v]of bullets)if(!r.objects('Bullet').includes(b)){v.deleteFromScene();bullets.delete(b);}
    for(const b of r.objects('Bullet')){
      let v=bullets.get(b);if(!v){v=spawn('ArtProjectile','Effects',18);bullets.set(b,v);}
      const weaponName=r.ov(b,'Weapon').getAsString();v.setAnimationName(weaponName==='Missile'?'Missile':weaponName==='Cannon'?'Cannon':'Energy');
      v.setPosition(b.getX()+b.getWidth()/2-v.getWidth()/2,b.getY()+b.getHeight()/2-v.getHeight()/2);
      v.setAngle(Math.atan2(r.ov(b,'Vy').getAsNumber(),r.ov(b,'Vx').getAsNumber())*180/Math.PI);b.setOpacity(0);
    }
    const glow=r.object('ChargeGlow');if(glow){glow.hide(true);} // painted CHARGE key pose owns its energy ring
    const meter=r.object('ChargeFill');if(meter){meter.setColor(r.charge>=0.8?'244;247;250':'138;108;243');meter.setHeight(r.charge>=0.8?5:4);}
    // A contextual E badge is an interaction affordance, not a persistent movement tutorial.
    const nearby=['Shop','CannonCrate','ReturnPortal','Dummy','TrialDrone'].flatMap(n=>r.objects(n)).find(o=>Math.abs(o.getX()-player.getX())<85&&Math.abs(o.getY()-player.getY())<100);
    interact.hide(!playing||!nearby);if(nearby)interact.setPosition(nearby.getX()+nearby.getWidth()/2-12,nearby.getY()-32);
    if(r.artBlockTime>0)r.artBlockTime=Math.max(0,r.artBlockTime-delta);
  };
  const damage=r.damageTarget;
  r.damageTarget=(...args)=>{
    const blocks=r.number('ShieldBlocks');damage(...args);
    if(r.number('ShieldBlocks')>blocks){
      r.artBlockTime=0.18;const target=args[0],fx=spawn('ArtShieldImpact','Effects',20);fx.setPosition(target.getX()-20,target.getY()-20);r.effects.push({o:fx,life:0.22});
    }
  };
}
