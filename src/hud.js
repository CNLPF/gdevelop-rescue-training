// One shared HUD layout and presenter. Definitions are GDevelop global objects;
// each scene owns its own instances and state (health and wallet are not globalized).
export const HUD_LAYOUT={
  HudPanel:{x:16,y:14,z:1},
  HealthText:{x:56,y:24,z:3},CoinsText:{x:126,y:24,z:3},
  WeaponText:{x:200,y:24,z:3},StageStatus:{x:326,y:30,z:3},
  ChargeText:{x:0,y:0,z:3},ChargeFill:{x:0,y:0,z:3},
  GoalText:{x:16,y:72,z:3},
};
// HD HUD art has a 96x96 source canvas. These scene-space sizes keep its
// painted details readable without letting the source canvas cover the text.
export const HUD_ART_LAYOUT={
  ArtHeart:{x:30,y:22,width:20,height:18,z:4},
  ArtCoin:{x:102,y:22,width:18,height:18,z:4},
  ArtWeaponIcon:{x:166,y:21,width:28,height:22,z:4},
};
export const HUD_STYLE={
  HealthText:{characterSize:16,color:'255;224;227',bold:true},
  CoinsText:{characterSize:17,color:'255;233;177',bold:true},
  WeaponText:{characterSize:15,color:'194;248;235',bold:true},
  StageStatus:{characterSize:12,color:'222;237;244',bold:true},
  GoalText:{characterSize:15,color:'230;241;246',bold:true},
  ChargeText:{characterSize:10,color:'195;213;226',bold:true},
};
export const HUD_SVG='<svg xmlns="http://www.w3.org/2000/svg" width="304" height="44" viewBox="0 0 304 44"><rect x="1" y="1" width="302" height="42" rx="13" fill="#153448" fill-opacity=".94" stroke="#497b87" stroke-width="1.5"/><path d="M14 2h59" stroke="#45d6be" stroke-width="3" stroke-linecap="round"/><path d="M93 2h53" stroke="#ffc85b" stroke-width="3" stroke-linecap="round"/><path d="M177 2h112" stroke="#a78df2" stroke-width="3" stroke-linecap="round"/><path d="M165 12v20" stroke="#688696" stroke-opacity=".6"/></svg>';
export function attachHud(r){
  // The art presenter is injected into a separate GDevelop event function, so
  // values needed there must travel on the runtime object rather than by lexical scope.
  r.hudArtLayout=HUD_ART_LAYOUT;
  for(const [name,layout]of Object.entries(HUD_LAYOUT)){
    const o=r.object(name)||r.create(name,layout.x,layout.y);
    o.setLayer(name==='ChargeFill'?'Gameplay':'HUD');o.setZOrder(layout.z);
    // Existing instance geometry belongs to the editor; only the charge meter follows the player.
    if(name==='ChargeFill'){o.setHeight(4);o.setWidth(32);o.hide();}
  }
  const chargeText=r.object('ChargeText');if(chargeText)chargeText.hide();
  const toast=r.object('Toast');if(toast)toast.setPosition(28,118);
  r.renderHud=({weapon,upgraded,status,cannon=false,missile=false,meter=1,charging=false,chargeX=0,chargeY=0,teaching=false,lesson=''})=>{
    r.text('HealthText',Math.max(0,r.number('Health'))+'/3');
    r.text('CoinsText',String(r.number('Coins')));
    r.text('WeaponText',weapon+'  Lv.'+(upgraded?2:1));
    r.text('StageStatus','');r.object('StageStatus')?.hide();
    const bar=r.object('ChargeFill');if(bar){bar.hide(!((cannon||missile)&&charging));bar.setColor(missile?'255;174;76':'181;150;255');bar.setWidth(Math.max(2,32*Math.max(0,Math.min(1,meter))));bar.setPosition(chargeX,chargeY);}
    r.text('GoalText',teaching?lesson:'');const goal=r.object('GoalText');if(goal)goal.hide(!teaching);
    const help=r.object('KeyHelp');if(help)help.hide(!teaching);
    const prompt=r.object('PromptText');if(prompt)prompt.hide(true);
  };
}
