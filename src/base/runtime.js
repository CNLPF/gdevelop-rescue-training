export function createBase(scene,Rules){
  const r=createRescue(scene,Rules);
  r.config={...Rules.CONFIG,width:BASE.width};
  // Keep authored spawn points and attack rules deterministic while varying
  // which safe reinforcement site is selected on each preview run.
  if(!r.number('ReinforcementSeed')){
    r.set('ReinforcementSeed',Math.floor(Math.random()*2147483647));
  }
  r.set('Stage','Entry');r.charge=0;r.charging=false;r.fireLocked=false;r.menuIndex=0;r.elapsed=0;r.missileTargetId='';r.aimTargetId='';
  r.labelMap=new Map();r.warningMap=new Map();r.hints=new Set();
  attachAiming(r);
  r.near=o=>o&&Math.hypot(r.center(o).x-r.center(r.player).x,r.center(o).y-r.center(r.player).y)<120;
  r.ledger=(name,id)=>r.vars.get(name).getChild(id);
  r.teleport=(x,y)=>{
    r.player.setPosition(x,y);r.body.setCurrentSpeed(0);r.body.abortJump();r.body.setCurrentFallSpeed(0);
    r.set('JumpCount',0);r.coyote=0;r.buffer=0;r.jumpPending=false;r.invulnerable=1.2;r.cancelCharge();
  };
  r.startNewRun=()=>{
    if(r.mode()==='Restarting')return;
    const globals=scene.getGame().getVariables();globals.get('RescueWallet').setNumber(r.number('Coins'));globals.get('RescueCarryWallet').setBoolean(true);
    r.setMode('Restarting');gdjs.evtTools.runtimeScene.replaceScene(scene,'RescueBase',false);
  };
  r.set('WalletAtStart',r.number('Coins'));
  attachBaseCombat(r);attachBaseInput(r);attachBaseWorld(r);attachBasePresentation(r);
  return r;
}
