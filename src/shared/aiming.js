// Scene-neutral targeting. RescueBase and TrainingRoom both attach this module
// so candidate filtering, weighted scoring and reticle state cannot drift.
export function targetAimPoint(object){
  const height=object.getHeight();
  return {
    x:object.getX()+object.getWidth()/2,
    // Aim at the upper torso. This keeps the sight line above the ledge an
    // enemy is standing on while still ending inside its collision box.
    y:object.getY()+Math.min(10,Math.max(6,height*0.25)),
  };
}

export function attachAiming(r){
  r.aimTargetTypes=[...BASE.aimTargetTypes];
  r.targets=()=>r.aimTargetTypes.flatMap(name=>r.objects(name)).filter(o=>{
    if(r.ov(o,'Health').getAsNumber()<=0)return false;
    const variables=o.getVariables();
    return !variables.has('Active')||variables.get('Active').getAsBoolean();
  });
  r.aimOrigin=()=>({
    x:r.player.getX()+(r.facing>0?42:-2),
    y:r.player.getY()+29,
  });
  r.targetById=id=>id?r.targets().find(o=>r.ov(o,'Id').getAsString()===id)||null:null;
  r.updateAimTarget=(range,options={})=>{
    const origin=r.aimOrigin();
    const targets=r.targets().map(o=>({
      ...targetAimPoint(o),
      id:r.ov(o,'Id').getAsString(),
      health:r.ov(o,'Health').getAsNumber(),
    }));
    const target=r.Rules.chooseTarget(
      origin,r.facing,targets,r.walls(),range,
      {...options,stickyId:r.aimTargetId},
    );
    r.aimTargetId=target?String(target.id):'';
    return target;
  };
  r.clearAimState=({lockFire=true}={})=>{
    r.charge=0;r.charging=false;
    if(lockFire)r.fireLocked=true;
    r.missileTargetId='';r.aimTargetId='';
    r.set('Charge',0);r.set('MissileLockProgress',0);r.set('MissileTargetId','');
  };
  r.cancelCharge=()=>r.clearAimState();
}

export function updateAimForWeapon(r,weapon){
  const config=BASE.weapons[weapon];
  if(!config)return null;
  return r.updateAimTarget(weapon==='Missile'?config.lockRange:config.range,{
    verticalBias:config.verticalBias,
    switchMargin:config.switchMargin,
  });
}

export function resolveShotAim(r,weapon,shot,origin){
  const targetObject=r.targetById(
    weapon==='Missile'?(shot.locked?r.missileTargetId:''):r.aimTargetId,
  );
  const target=targetObject?targetAimPoint(targetObject):null;
  const length=target?Math.hypot(target.x-origin.x,target.y-origin.y):1;
  const dx=weapon==='Missile'&&!shot.locked?r.facing:target?(target.x-origin.x)/length:r.facing;
  const dy=weapon==='Missile'&&!shot.locked?0:target?(target.y-origin.y)/length:0;
  return {target:targetObject,dx,dy};
}

export function attachSharedAimReticle(r){
  const reticle=r.create('MissileReticle',0,0);
  reticle.setLayer('Effects');
  reticle.setZOrder(24);
  reticle.hide(true);
  r.missileReticle=reticle;
  return reticle;
}

export function presentSharedAimReticle(r){
  const target=r.targetById(r.aimTargetId||'');
  r.missileReticle?.hide(!(r.mode()==='Playing'&&target));
  if(target&&r.missileReticle){
    const point=targetAimPoint(target),size=36+Math.sin(r.time*12)*3;
    r.missileReticle.setPosition(point.x-size/2,point.y-size/2);
    r.missileReticle.setWidth(size);
    r.missileReticle.setHeight(size);
  }
  return target;
}
