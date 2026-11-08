import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {HUD_ART_LAYOUT,HUD_LAYOUT,HUD_SVG} from '../src/hud.js';

const require=createRequire(import.meta.url);
const {buildArtPresenterInlineCode}=require('../scripts/apply-art-v2.cjs');

test('HUD icon and number layouts reserve non-overlapping space',()=>{
  for(const [icon,text] of [
    ['ArtHeart','HealthText'],
    ['ArtCoin','CoinsText'],
    ['ArtWeaponIcon','WeaponText'],
  ]){
    const art=HUD_ART_LAYOUT[icon],label=HUD_LAYOUT[text];
    assert.ok(label.x>=art.x+art.width+4,`${text} must have at least four pixels after ${icon}`);
  }
  const panel=HUD_LAYOUT.HudPanel;
  for(const art of Object.values(HUD_ART_LAYOUT)){
    assert.ok(art.x>=panel.x);
    assert.ok(art.y>=panel.y);
    assert.ok(art.x+art.width<=panel.x+304);
    assert.ok(art.y+art.height<=panel.y+44);
    assert.ok(art.z>panel.z);
  }
});

test('HUD background contains no duplicate hand-painted coin or heart symbols',()=>{
  assert.equal((HUD_SVG.match(/<circle\b/g)||[]).length,0);
  assert.ok(!HUD_SVG.includes('cx="30"'));
  assert.ok(!HUD_SVG.includes('cx="102"'));
  assert.ok(HUD_SVG.includes('width="304" height="44"'));
});

test('standalone art presenter does not depend on bootstrap event scope',()=>{
  const source=fs.readFileSync(new URL('../src/art-v2.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/(?<![.\w])HUD_ART_LAYOUT\s*\[/);
  assert.match(source,/r\.hudArtLayout/);
});

test('art presenter injections use isolated function scopes in every scene',()=>{
  const injected=buildArtPresenterInlineCode('function attachArtV2(r){return r;}').join('\n');
  assert.match(injected,/^if\(!runtimeScene\.__rescue\.artV2\)\{\n\(\(\) => \{/);
  assert.match(injected,/\}\)\(\);\n\}$/);
  assert.doesNotThrow(()=>new Function('runtimeScene',`${injected}\n${injected}`),'two scene injections must compile together');
});

test('scene initialization scripts are syntactically valid',()=>{
  const game=JSON.parse(fs.readFileSync(new URL('../game.json',import.meta.url),'utf8'));

  for(const scene of game.layouts){
    const event=scene.events[0].events[0];
    const source=Array.isArray(event.inlineCode)
      ? event.inlineCode.join('\n')
      : event.inlineCode;

    assert.equal(typeof source,'string',`${scene.name} initialization script should exist`);
    assert.doesNotThrow(
      ()=>new Function('runtimeScene',source),
      `${scene.name} initialization script should parse`
    );
  }
});

test('every collision platform has a registered local visual object and image',()=>{
  const game=JSON.parse(fs.readFileSync(new URL('../game.json',import.meta.url),'utf8'));
  const manifest=JSON.parse(
    fs.readFileSync(new URL('../assets/ASSET_MANIFEST_V2.json',import.meta.url),'utf8')
  );
  const globalObjects=new Set((game.objects||[]).map(object=>object.name));

  for(const scene of game.layouts){
    for(const item of scene.instances){
      if(!['Terrain','Wall'].includes(item.name)||!item.customSize)continue;
      const key=`Platform${Math.round(item.width)}x${Math.round(item.height)}`;
      const visualName=`Art${key}`;
      assert.ok(
        Object.hasOwn(manifest.runtime,key),
        `${scene.name} ${item.name} ${key} must be registered in the runtime manifest`
      );
      assert.ok(
        globalObjects.has(visualName),
        `${scene.name} ${item.name} requires global object ${visualName}`
      );
      const imageUrl=new URL(`../${manifest.runtime[key]}`,import.meta.url);
      assert.ok(fs.existsSync(imageUrl),`${visualName} image must exist: ${imageUrl.pathname}`);
    }
  }
});

test('missing platform visuals fall back without stopping the scene',()=>{
  const source=fs.readFileSync(new URL('../src/art-v2.js',import.meta.url),'utf8');
  assert.match(source,/if\(!visual\)continue;/);
});
