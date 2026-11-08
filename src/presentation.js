export function attachPresentation(r) {
  attachHud(r);
  const goals={Jump:'① 二段跳 · 连按两次空格，到达上方蓝色信标',Combat:'② 战斗收集 · 击败两台机器人，攒够 10 枚金币',Purchase:'③ 升级能量枪 · 靠近商店按 E，购买一次升级',Compare:'④ 比较试射 · Q 切换形态，用升级弹命中并击毁训练靶',Finish:'⑤ 伙伴在前方等你！穿过救援出口'};
  r.presentation = () => {
    const cam=Math.max(480,Math.min(2720,r.player.getX()+80));
    r.scene.getLayer('Gameplay').setCameraX(cam);r.scene.getLayer('Gameplay').setCameraY(320);
    r.scene.getLayer('Effects').setCameraX(cam);r.scene.getLayer('Effects').setCameraY(320);
    r.player.setOpacity(r.invulnerable>0&&Math.floor(r.time*12)%2===0?100:255);
    const upgraded=r.string('WeaponForm')==='Upgrade';
    const stageNames={Jump:'二段跳教学',Combat:'战斗训练',Purchase:'补给工坊',Compare:'试射训练',Finish:'救援出口'};
    r.renderHud({weapon:'能量枪',upgraded,status:stageNames[r.stage()]+'\n敌人 '+r.number('EnemiesDefeated')+'/2',
      meter:1-r.fireCooldown/0.30,teaching:r.stage()==='Jump',lesson:'教学目标 · 到达蓝色信标'});
    let prompt='';
    if(r.mode()==='Playing'){
      if(Math.abs(r.player.getX()-1960)<120 && ['Purchase','Compare','Finish'].includes(r.stage()))prompt='[ E ] 打开升级商店';
      else if(Math.abs(r.player.getX()-2460)<150 && ['Compare','Finish'].includes(r.stage()))prompt='[ E ] 重置训练靶    [ Q ] 切换形态';
      else if(r.stage()==='Combat')prompt='按住 W 发射能量弹 · 跳起来躲开橙色攻击';
    }
    r.text('PromptText',prompt);
    r.text('DummyLabel','装甲训练靶  '+r.number('DummyHealth')+'/4\n本轮命中 '+r.number('DummyHits')+' 次');
    for(const name of ['Patrol','Turret']){
      const enemy=r.object(name),label=r.object(name+'Label');
      if(label){label.hide(!enemy);if(enemy){label.setPosition(enemy.getX()-12,enemy.getY()-32);const value=r.ov(enemy,'Health').getAsNumber();const text=(name==='Patrol'?'巡逻':'炮台')+' '+value;if(label.getString()!==text)label.setString(text);}}
    }
    for(const checkpoint of r.objects('Checkpoint'))checkpoint.setOpacity(checkpoint.getX()<=r.number('CheckpointX')+20?255:115);
    if(r.mode()==='Shop'){
      const owned=r.boolean('UpgradePurchased');
      r.text('ModalTitle',owned?'升级已装入你的能量枪':'能量工坊 · 伤害升级');
      r.text('ModalBody','单发伤害  1 → 2\n射速与射程不变，弹药无限\n\n'+(owned?'已支付 10 金币    余额 ':'需要 10 金币    你有 ')+r.number('Coins')+' 金币\n\n'+(owned?'已购买 · Q 可以切换基础与升级形态':'▶ Enter 确认购买    Esc 返回训练'));
      r.text('ModalFoot',r.shopFeedback||(owned?'Esc 返回 · 不会重复扣费':'金币不足时不会扣款 · 商店中游戏已暂停'));
    }else if(r.mode()==='RestartConfirm'){
      r.text('ModalTitle','重新开始训练？');r.text('ModalBody','金币余额保留；升级、敌人和训练进度重置。\n\n▶ Enter 重新开始\n\nEsc 返回，继续当前训练');r.text('ModalFoot','只影响本次试玩，不修改其他项目');
    }else if(r.mode()==='Complete'){
      r.text('ModalTitle','救援成功！伙伴已归队');
      r.text('ModalBody','你实际完成的训练\n\n收集金币 '+r.number('CoinsCollected')+' 枚  ·  击败敌人 '+r.number('EnemiesDefeated')+' 台\n购买升级 '+r.number('Purchases')+' 次  ·  攻击命中 '+r.number('Hits')+' 次\n使用二段跳 '+r.number('DoubleJumps')+' 次  ·  掉坑返回 '+r.number('Retries')+' 次\n\n剩余金币 '+r.number('Coins')+' 枚  ·  升级形态命中 '+r.number('UpgradedHits')+' 次');
      r.text('ModalFoot','按 R 再试一次 · 记录只反映本次实际操作');
    }
    if(r.mode()==='Playing')for(const fx of [...r.effects]){
      fx.life-=r.dt;fx.o.setOpacity(Math.max(0,fx.life/0.22*230));fx.o.setAngle(fx.o.getAngle()+r.dt*200);
      if(fx.life<=0){fx.o.deleteFromScene();r.effects.splice(r.effects.indexOf(fx),1);}
    }
  };
}
