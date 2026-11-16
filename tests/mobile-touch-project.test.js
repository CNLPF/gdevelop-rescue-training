import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {TOUCH_LAYOUT} from '../src/shared/touch-input.js';

const root=new URL('../',import.meta.url);
const readJson=name=>JSON.parse(fs.readFileSync(new URL(name,root),'utf8'));
const game=readJson('game.json');
const manifest=readJson('assets/manifest.json');
const expectedActions=['left','right','jump','fire','switch','interact','restart'];
const mapHashes={
  TrainingRoom:'774e68540fde11a136a8c46b1386e393bd4ec70b4a043ee4a10e456e4841d15e',
  RescueBase:'71e1aeea916b33e52ca5f9674b7ac3df51ad92c938f6201aafc734655983269c',
};

function instanceMapHash(scene){
  const rows=scene.instances
    .filter(item=>!['TouchButton','TouchRotateOverlay'].includes(item.name))
    .map(item=>({name:item.name,uuid:item.persistentUuid,x:item.x,y:item.y,width:item.width,height:item.height}));
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

test('project remains fixed-resolution landscape and keeps both playable scenes',()=>{
  assert.equal(game.properties.orientation,'landscape');
  assert.equal(game.properties.windowWidth,960);
  assert.equal(game.properties.windowHeight,640);
  assert.deepEqual(game.layouts.map(scene=>scene.name),['TrainingRoom','RescueBase']);
});

test('both scenes contain one complete, unique touch layout at exact shared coordinates',()=>{
  for(const scene of game.layouts){
    assert.equal(scene.variables.find(item=>item.name==='TouchControlsMode')?.value,'auto');
    assert.equal(scene.variables.find(item=>item.name==='TouchControlsVisible')?.value,false);
    const buttons=scene.instances.filter(item=>item.name==='TouchButton');
    assert.equal(buttons.length,7,`${scene.name} button count`);
    const actions=buttons.map(item=>item.initialVariables.find(variable=>variable.name==='Action')?.value).sort();
    assert.deepEqual(actions,[...expectedActions].sort());
    for(const button of buttons){
      const action=button.initialVariables.find(variable=>variable.name==='Action').value;
      const expected=TOUCH_LAYOUT[action];
      assert.deepEqual(
        {layer:button.layer,x:button.x,y:button.y,width:button.width,height:button.height},
        {layer:'HUD',x:expected.x,y:expected.y,width:expected.width,height:expected.height},
        `${scene.name} ${action}`
      );
    }
    const overlays=scene.instances.filter(item=>item.name==='TouchRotateOverlay');
    assert.equal(overlays.length,1,`${scene.name} rotation overlay`);
    assert.equal(overlays[0].layer,'HUD');
  }
});

test('the touch patch leaves every pre-existing scene instance unchanged',()=>{
  for(const scene of game.layouts){
    assert.equal(instanceMapHash(scene),mapHashes[scene.name],`${scene.name} map instances changed outside the touch patch`);
  }
});

test('touch sprites, resources, animations and local manifests are complete',()=>{
  const button=game.objects.find(object=>object.name==='TouchButton');
  const overlay=game.objects.find(object=>object.name==='TouchRotateOverlay');
  assert.ok(button&&overlay);
  assert.deepEqual(button.animations.map(animation=>animation.name),[
    'Left','Right','Jump','Attack','Weapon','Interact','Confirm','Back','Restart',
  ]);
  const assets=[
    ...button.animations.flatMap(animation=>animation.directions.flatMap(direction=>direction.sprites.map(sprite=>sprite.image))),
    ...overlay.animations.flatMap(animation=>animation.directions.flatMap(direction=>direction.sprites.map(sprite=>sprite.image))),
  ];
  assert.equal(new Set(assets).size,10);
  for(const asset of assets){
    const resource=game.resources.resources.find(item=>item.file==='assets/touch/'+asset);
    assert.ok(resource,`resource ${asset}`);
    const localPath=new URL('assets/touch/'+asset,root);
    assert.ok(fs.existsSync(localPath),`local asset ${asset}`);
    const source=fs.readFileSync(localPath,'utf8');
    assert.match(source,/^<svg\b/);
    assert.doesNotMatch(source,/(?:href|src)\s*=\s*["']https?:/i);
    const record=manifest.assets.find(item=>item.file===asset);
    assert.ok(record,`manifest ${asset}`);
    assert.match(record.source,/project-authored touch interface/);
  }
});

test('embedded scene runtime uses native multi-touch APIs and syntactically valid code',()=>{
  for(const scene of game.layouts){
    const event=scene.events[0].events[0];
    const source=Array.isArray(event.inlineCode)?event.inlineCode.join('\n'):event.inlineCode;
    assert.equal(typeof source,'string');
    assert.doesNotThrow(()=>new Function('runtimeScene',source),`${scene.name} initialization code`);
    for(const required of ['const BASE','function weaponCycle','function basePurchase','function reinforcementRandom','getAllTouchIdentifiers()','getTouchX(','getTouchY(','hasTouchEnded(','TouchControlsMode','TouchControlsVisible','setAnimationName']){
      assert.ok(source.includes(required),`${scene.name} must include ${required}`);
    }
    assert.doesNotMatch(source,/addEventListener\(\s*['"]touch/,'touch must use GDevelop native APIs rather than DOM listeners');
    assert.doesNotMatch(source,/\bsetAnimation\s*\(/,'legacy GDevelop sprite API must not remain');
  }
});

test('all gameplay tests, including the touch suite, are embedded in the project',()=>{
  const filenames=fs.readdirSync(new URL('tests/',root)).filter(name=>name.endsWith('.gameplay.js')).map(name=>name.replace('.gameplay.js',''));
  assert.deepEqual(game.tests.map(test=>test.name).sort(),filenames.sort());
  assert.ok(game.tests.some(test=>test.name==='21-mobile-touch'));
  assert.deepEqual(game.testsFolderStructure.children.map(item=>item.itemName).sort(),filenames.sort(),'GDevelop folder index must list every embedded gameplay test');
});
