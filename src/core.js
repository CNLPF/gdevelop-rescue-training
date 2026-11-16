export function createRescue(scene, Rules) {
  const r = {scene,Rules,config:Rules.CONFIG, prev:{}, keyboard:{}, keys:{}, pressed:{}, released:{}, time:0,
    touchState:typeof createTouchInputState==='function'?createTouchInputState():{owners:{},blocked:{},down:{},activeIds:[]},
    touchControlsVisible:false,touchControlsEnabled:false,orientationBlocked:false,
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
  r.touchText = value => {
    let text=String(value??'');
    if(!r.touchControlsVisible)return text;
    return text
      .replace(/\[ E \]/g,'[交互]').replace(/\[ Q \]/g,'[武器]')
      .replace(/按住 W/g,'按住攻击').replace(/\bW\b/g,'攻击')
      .replace(/\bQ\b/g,'武器').replace(/\bE\b/g,'交互').replace(/\bR\b/g,'重开')
      .replace(/空格/g,'跳跃').replace(/\bEsc\b/g,'返回').replace(/\bEnter\b/g,'确认')
      .replace(/↑↓/g,'← →');
  };
  r.text = (name,value) => { const localized=r.touchText(value);if(r.hudCache[name]!==localized){ const o=r.object(name);if(o)o.setString(localized);r.hudCache[name]=localized; } };
  r.toast = message => {r.text('Toast',message);r.toastTime=2.5;};
  r.applyLayerTimeScale = () => {
    const active=r.mode()==='Playing'&&!r.orientationBlocked;
    for(const name of ['Gameplay','Effects'])scene.getLayer(name).setTimeScale(active?1:0);
  };
  r.setMode = mode => {
    const previous=r.mode();
    if(r.cancelCharge && mode!=='Playing')r.cancelCharge();
    r.set('GameMode',mode);r.modeTime=0;
    if(previous!==mode&&r.touchState&&typeof blockAllTouches==='function')blockAllTouches(r.touchState);
    r.applyLayerTimeScale();
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
    const bindings={left:37,right:39,up:38,down:40,jump:32,fire:87,switch:81,interact:69,confirm:13,cancel:27,restart:82};
    for(const [name,key] of Object.entries(bindings))r.keyboard[name]=input.isKeyPressed(key);
    r.refreshTouchInput();
    const allowed=!r.orientationBlocked;
    const merged=typeof mergeActionDown==='function'?mergeActionDown(r.keyboard,r.touchState.down,allowed):r.keyboard;
    const edges=typeof deriveActionEdges==='function'?deriveActionEdges(r.prev,merged):{pressed:{},released:{}};
    for(const name of Object.keys(bindings)){
      r.keys[name]=!!merged[name];r.pressed[name]=!!edges.pressed[name];r.released[name]=!!edges.released[name];r.prev[name]=!!merged[name];
    }
    r.refreshTouchUi();
    if(r.toastTime>0){r.toastTime-=r.dt;if(r.toastTime<=0)r.text('Toast','');}
  };
  r.refreshTouchInput = () => {
    const nav=typeof navigator!=='undefined'?navigator:null;
    const gdevelopMobile=typeof gdjs!=='undefined'&&gdjs.evtTools?.common?.isMobile?.();
    const coarse=!!(nav&&Number(nav.maxTouchPoints)>0)||
      gdevelopMobile||
      !!(typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches);
    r.touchControlsEnabled=typeof shouldShowTouchControls==='function'
      ?shouldShowTouchControls(r.string('TouchControlsMode'),coarse):false;
    let viewportWidth=960,viewportHeight=640;
    try{
      if(typeof gdjs!=='undefined'&&gdjs.evtTools?.window){
        viewportWidth=gdjs.evtTools.window.getWindowInnerWidth();
        viewportHeight=gdjs.evtTools.window.getWindowInnerHeight();
      }else if(typeof window!=='undefined'){
        viewportWidth=window.innerWidth;viewportHeight=window.innerHeight;
      }
    }catch(_error){/* Keep the reference landscape dimensions. */}
    const portrait=r.touchControlsEnabled&&viewportWidth<viewportHeight;
    r.orientationBlocked=portrait;
    r.touchControlsVisible=r.touchControlsEnabled&&!portrait;
    r.set('TouchControlsVisible',r.touchControlsVisible);
    if(!r.touchControlsVisible){
      if(typeof blockAllTouches==='function')blockAllTouches(r.touchState);
      r.applyLayerTimeScale();
      return;
    }
    const touches=[];
    try{
      const input=scene.getGame().getInputManager();
      const hud=scene.getLayer('HUD');
      for(const id of input.getAllTouchIdentifiers()){
        const point=hud.convertCoords(input.getTouchX(id),input.getTouchY(id),0,[0,0]);
        touches.push({id,x:point[0],y:point[1],ended:input.hasTouchEnded(id)});
      }
    }catch(_error){/* Keyboard-only renderers and automated tests may omit touch APIs. */}
    updateTouchInputState(r.touchState,touches,r.mode());
    r.applyLayerTimeScale();
  };
  r.refreshTouchUi = () => {
    const hidden=!r.touchControlsVisible;
    if(typeof contextTouchPresentation==='function')for(const object of r.objects('TouchButton')){
      const variables=object.getVariables();
      if(!variables.has('Action'))continue;
      const action=variables.get('Action').getAsString();
      const button=typeof TOUCH_LAYOUT!=='undefined'?TOUCH_LAYOUT[action]:null;
      if(!button)continue;
      object.setLayer('HUD');object.setPosition(button.x,button.y);
      if(typeof object.setWidth==='function'){object.setWidth(button.width);object.setHeight(button.height);}
      object.setZOrder(20);
      const presentation=contextTouchPresentation(action,r.mode());
      if(presentation&&typeof object.setAnimationName==='function')object.setAnimationName(presentation.animation);
      const pressed=!!(presentation&&r.touchState.down[presentation.action]);
      object.setY(button.y+(pressed?2:0));object.setOpacity(pressed?155:238);object.hide(hidden);
    }
    const rotate=r.object('TouchRotateOverlay');
    if(rotate){rotate.setLayer('HUD');rotate.setPosition(0,0);rotate.setZOrder(50);rotate.hide(!(r.touchControlsEnabled&&r.orientationBlocked));}
    const help=r.object('KeyHelp');
    if(help){help.setString('← → 移动    空格 二段跳    W 射击    Q 切换    E 交互    R 重来');if(r.touchControlsEnabled)help.hide(true);}
    r.hudCache.KeyHelp=undefined;r.hudCache.PromptText=undefined;r.hudCache.ModalBody=undefined;r.hudCache.ModalFoot=undefined;
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
