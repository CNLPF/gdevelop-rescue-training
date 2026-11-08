export function createRescue(scene, Rules) {
  const r = {scene,Rules,config:Rules.CONFIG, prev:{}, keys:{}, pressed:{}, released:{}, time:0,
    invulnerable:0,fireCooldown:0,coyote:0,buffer:0,jumpPending:false,
    facing:1,toastTime:0,modeTime:0,previousMode:'Playing',hudCache:{},effects:[],
  };
  r.objects = name => scene.getObjects(name);
  r.object = name => r.objects(name)[0];
  r.vars = scene.getVariables();
  r.number = name => r.vars.get(name).getAsNumber();
  r.string = name => r.vars.get(name).getAsString();
  r.boolean = name => r.vars.get(name).getAsBoolean();
  r.set = (name,value) => { const v=r.vars.get(name); if(typeof value==='number')v.setNumber(value);else if(typeof value==='boolean')v.setBoolean(value);else v.setString(value); };
  r.add = (name,delta=1) => r.set(name,r.number(name)+delta);
  r.player = r.object('Player');
  r.body = r.player.getBehavior('Platformer');
  r.box = o => ({x:o.getX(),y:o.getY(),w:o.getWidth(),h:o.getHeight()});
  r.center = o => ({x:o.getX()+o.getWidth()/2,y:o.getY()+o.getHeight()/2});
  r.ov = (o,name) => o.getVariables().get(name);
  r.solidObjects = () => [...r.objects('Terrain'),...r.objects('Wall'),...r.objects('Gate')];
  r.walls = () => r.solidObjects().map(r.box);
  r.targets = () => [...r.objects('Patrol'),...r.objects('Turret'),...r.objects('Dummy')].filter(o=>r.ov(o,'Health').getAsNumber()>0);
  r.mode = () => r.string('GameMode');
  r.stage = () => r.string('Stage');
  r.text = (name,value) => { if(r.hudCache[name]!==value){ const o=r.object(name);if(o)o.setString(value);r.hudCache[name]=value; } };
  r.toast = message => {r.text('Toast',message);r.toastTime=2.5;};
  r.setMode = mode => {
    if(r.cancelCharge && mode!=='Playing')r.cancelCharge();
    r.set('GameMode',mode);r.modeTime=0;
    for(const name of ['Gameplay','Effects'])scene.getLayer(name).setTimeScale(mode==='Playing'?1:0);
    scene.getLayer('Modal').show(['Shop','Portal','Complete','RestartConfirm'].includes(mode));
  };
  r.create = (name,x,y) => {
    const o=scene.createObject(name);
    // Cosmetic proxy objects can be omitted by an art pack. Gameplay objects
    // remain strict callers of create(), while presentation code can skip a
    // missing optional visual without stopping the scene.
    if(!o)return null;
    o.setPosition(x,y);o.setLayer(name==='Spark'?'Effects':'Gameplay');return o;
  };
  r.flash = (x,y,color) => {const o=r.create('Spark',x-12,y-12);o.setColor(color||'59;224;192');r.effects.push({o,life:0.22});};
  r.checkpoint = (x,y=504) => {if(x>r.number('CheckpointX')){r.set('CheckpointX',x);r.set('CheckpointY',y);r.toast('检查点已点亮 · 可以放心尝试');}};
  r.setStage = stage => {r.set('Stage',stage);r.add('StageAdvanceCount');r.toast('新区域已开启！');};
  r.openGate = id => {for(const o of r.objects('Gate'))if(r.ov(o,'Id').getAsString()===id)o.deleteFromScene();};
  r.beginFrame = () => {
    r.dt=Math.min(scene.getElapsedTime()/1000,0.05);r.time+=r.dt;r.modeTime+=r.dt;
    const input=scene.getGame().getInputManager();
    for(const [name,key] of Object.entries({left:37,right:39,up:38,down:40,jump:32,fire:87,switch:81,interact:69,confirm:13,cancel:27,restart:82})){
      const down=input.isKeyPressed(key);r.keys[name]=down;r.pressed[name]=down&&!r.prev[name];r.released[name]=!down&&!!r.prev[name];r.prev[name]=down;
    }
    if(r.toastTime>0){r.toastTime-=r.dt;if(r.toastTime<=0)r.text('Toast','');}
  };
  attachInput(r);attachCombat(r);attachWorld(r);attachPresentation(r);
  const globals=scene.getGame().getVariables();
  if(globals.get('RescueCarryWallet').getAsBoolean()){
    r.set('Coins',globals.get('RescueWallet').getAsNumber());
    globals.get('RescueCarryWallet').setBoolean(false);
    r.toast('新一局训练开始 · 金币余额已保留');
  }
  r.setMode('Playing');r.set('Stage','Jump');
  return r;
}
