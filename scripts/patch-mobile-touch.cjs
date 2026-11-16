const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const gamePath = path.join(root, 'game.json');
const backupDir = path.join(root, 'backups');
const now = new Date();
const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const backupPath = path.join(backupDir, `game.before-mobile-touch-${stamp}.json`);

const TOUCH_BEGIN = '// BEGIN SHARED TOUCH INPUT';
const TOUCH_END = '// END SHARED TOUCH INPUT';
const CORE_BEGIN = '// BEGIN SHARED CREATE RESCUE';
const CORE_END = '// END SHARED CREATE RESCUE';
const BASE_BEGIN = '// BEGIN BASE CONFIG MODULE';
const BASE_END = '// END BASE CONFIG MODULE';
const BASE_IMPL_BEGIN = '// BEGIN BASE IMPLEMENTATION MODULES';
const BASE_IMPL_END = '// END BASE IMPLEMENTATION MODULES';
const ACTION_ORDER = ['left','right','jump','fire','switch','interact','restart'];
const TOUCH_ASSETS = [
  ['touch-left.svg','Left'],
  ['touch-right.svg','Right'],
  ['touch-jump.svg','Jump'],
  ['touch-attack.svg','Attack'],
  ['touch-weapon.svg','Weapon'],
  ['touch-interact.svg','Interact'],
  ['touch-confirm.svg','Confirm'],
  ['touch-back.svg','Back'],
  ['touch-restart.svg','Restart'],
];
const ROTATE_ASSET = 'touch-rotate-overlay.svg';
const expectedResources = [...TOUCH_ASSETS.map(([file]) => `assets/touch/${file}`), `assets/touch/${ROTATE_ASSET}`];

function fail(message) { throw new Error(message); }
function uuid() { return crypto.randomUUID(); }
function variable(name, value, persistentUuid = uuid()) {
  return {
    name,
    persistentUuid,
    type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
    value,
  };
}
function findOne(items, name, label) {
  const matches = items.filter(item => item.name === name);
  if (matches.length > 1) fail(`${label} contains duplicate ${name}`);
  return matches[0] || null;
}
function ensureGlobalObject(game, name, animations) {
  let object = findOne(game.objects, name, 'global object list');
  if (!object) {
    object = {
      adaptCollisionMaskAutomatically: false,
      assetStoreId: '',
      name,
      persistentUuid: uuid(),
      type: 'Sprite',
      updateIfNotVisible: false,
      variables: [],
      effects: [],
      behaviors: [],
      animations: [],
    };
    game.objects.push(object);
  }
  if (object.type !== 'Sprite') fail(`${name} must be a Sprite`);
  object.animations = animations.map(([animation, image]) => ({
    name: animation,
    useMultipleDirections: false,
    directions: [{
      looping: true,
      timeBetweenFrames: 0.1,
      sprites: [{
        hasCustomCollisionMask: false,
        image,
        points: [],
        originPoint: {name:'origin',x:0,y:0},
        centerPoint: {automatic:true,name:'center',x:0,y:0},
        customCollisionMask: [],
      }],
    }],
  }));
}
function ensureSceneVariable(scene, name, value) {
  let entry = scene.variables.find(item => item.name === name);
  if (!entry) {
    entry = variable(name, value);
    scene.variables.push(entry);
  }
  entry.type = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
  entry.value = value;
}
function makeInstance(name, x, y, width, height, layer, z, instanceVariables = {}) {
  return {
    name,
    x,
    y,
    angle: 0,
    zOrder: z,
    layer,
    customSize: true,
    width,
    height,
    keepRatio: false,
    persistentUuid: uuid(),
    numberProperties: [],
    stringProperties: [],
    initialVariables: Object.entries(instanceVariables).map(([key,value]) => variable(key,value)),
  };
}
function getTouchLayout() {
  const source = fs.readFileSync(path.join(root, 'src/shared/touch-input.js'), 'utf8');
  const result = {};
  for (const action of ACTION_ORDER) {
    const pattern = new RegExp(`\\b${action}:\\s*Object\\.freeze\\(\\{x:(\\d+),\\s*y:(\\d+),\\s*width:(\\d+),\\s*height:(\\d+),[^}]*animation:'([^']+)'`);
    const match = pattern.exec(source);
    if (!match) fail(`Cannot read ${action} from TOUCH_LAYOUT`);
    result[action] = {x:Number(match[1]),y:Number(match[2]),width:Number(match[3]),height:Number(match[4]),animation:match[5]};
  }
  return result;
}
function ensureTouchInstances(scene, layout) {
  const allTouchButtons = scene.instances.filter(item => item.name === 'TouchButton');
  const byAction = new Map();
  for (const item of allTouchButtons) {
    const action = (item.initialVariables || []).find(v => v.name === 'Action')?.value;
    if (!ACTION_ORDER.includes(action)) fail(`${scene.name} has TouchButton without a valid Action`);
    if (byAction.has(action)) fail(`${scene.name} has more than one TouchButton for ${action}`);
    byAction.set(action, item);
  }
  for (const action of ACTION_ORDER) {
    if (byAction.has(action)) continue;
    const item = layout[action];
    scene.instances.push(makeInstance('TouchButton', item.x, item.y, item.width, item.height, 'HUD', 20, {Action:action}));
  }
  const overlays = scene.instances.filter(item => item.name === 'TouchRotateOverlay');
  if (overlays.length > 1) fail(`${scene.name} has more than one TouchRotateOverlay`);
  if (!overlays.length) {
    scene.instances.push(makeInstance('TouchRotateOverlay',0,0,960,640,'HUD',50));
  }
}
function initCode(scene) {
  const event = scene.events?.[0]?.events?.[0];
  if (!event || event.type !== 'BuiltinCommonInstructions::JsCode') fail(`${scene.name} initialization event is missing`);
  return Array.isArray(event.inlineCode) ? event.inlineCode.join('\n') : String(event.inlineCode || '');
}
function setInitCode(scene, source) {
  const event = scene.events[0].events[0];
  event.inlineCode = source.split('\n');
}
function injectTouchModule(source, moduleSource) {
  const wrapped = `${TOUCH_BEGIN}\n${moduleSource.trim()}\n${TOUCH_END}`;
  const begin = source.indexOf(TOUCH_BEGIN);
  const end = source.indexOf(TOUCH_END);
  if (begin >= 0 && end > begin) return source.slice(0, begin) + wrapped + source.slice(end + TOUCH_END.length);
  if (begin >= 0 || end >= 0) fail('Touch module markers are incomplete');
  const open = 'if(!runtimeScene.__rescue){\n';
  const index = source.indexOf(open);
  if (index < 0) fail('Initialization root block not found');
  const insertAt = index + open.length;
  return source.slice(0, insertAt) + `${wrapped}\n` + source.slice(insertAt);
}
function replaceWrappedFunction(source, beginMarker, endMarker, functionName, nextNames, code) {
  const wrapped = `${beginMarker}\n${code.trim()}\n${endMarker}`;
  const begin = source.indexOf(beginMarker);
  const end = source.indexOf(endMarker);
  if (begin >= 0 && end > begin) return source.slice(0, begin) + wrapped + source.slice(end + endMarker.length);
  if (begin >= 0 || end >= 0) fail(`${functionName} markers are incomplete`);
  const startPatterns = [`function ${functionName}(`, `function ${functionName} (`];
  const start = startPatterns.map(pattern => source.indexOf(pattern)).filter(index => index >= 0).sort((a,b)=>a-b)[0];
  if (start === undefined) fail(`${functionName} was not found in initialization script`);
  const boundaries = nextNames.map(name => {
    const first = source.indexOf(`function ${name}(`, start + 1);
    const second = source.indexOf(`function ${name} (`, start + 1);
    return [first,second].filter(index => index > start).sort((a,b)=>a-b)[0];
  }).filter(index => index !== undefined);
  if (!boundaries.length) fail(`End boundary for ${functionName} was not found`);
  const finish = Math.min(...boundaries);
  return source.slice(0, start) + wrapped + '\n' + source.slice(finish);
}
function injectBaseModule(source, moduleSource) {
  const wrapped = `${BASE_BEGIN}\n${moduleSource.trim()}\n${BASE_END}`;
  const begin = source.indexOf(BASE_BEGIN);
  const end = source.indexOf(BASE_END);
  if (begin >= 0 && end > begin) return source.slice(0, begin) + wrapped + source.slice(end + BASE_END.length);
  if (begin >= 0 || end >= 0) fail('Base config markers are incomplete');
  const anchor = source.indexOf(CORE_BEGIN);
  if (anchor < 0) fail('Shared createRescue marker is missing while restoring BASE config');
  return source.slice(0, anchor) + wrapped + '\n' + source.slice(anchor);
}
function injectBaseImplementationModules(source, moduleSource) {
  const wrapped = `${BASE_IMPL_BEGIN}\n${moduleSource.trim()}\n${BASE_IMPL_END}`;
  const begin = source.indexOf(BASE_IMPL_BEGIN);
  const end = source.indexOf(BASE_IMPL_END);
  if (begin >= 0 && end > begin) return source.slice(0, begin) + wrapped + source.slice(end + BASE_IMPL_END.length);
  if (begin >= 0 || end >= 0) fail('Base implementation markers are incomplete');
  const anchor = source.indexOf(CORE_BEGIN);
  if (anchor < 0) fail('Shared createRescue marker is missing while restoring base implementations');
  return source.slice(0, anchor) + wrapped + '\n' + source.slice(anchor);
}
function readModule(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/^export /gm, '');
}

if (!fs.existsSync(gamePath)) fail('game.json is missing');
const originalText = fs.readFileSync(gamePath, 'utf8');
const original = JSON.parse(originalText);
const game = structuredClone(original);
if (game.properties?.orientation !== 'landscape') fail('Project orientation must remain landscape');

for (const sceneName of ['TrainingRoom','RescueBase']) {
  if (!game.layouts.some(scene => scene.name === sceneName)) fail(`Missing scene ${sceneName}`);
}
for (const file of expectedResources) {
  if (!fs.existsSync(path.join(root, file))) fail(`Missing touch asset ${file}`);
}

for (const [file] of TOUCH_ASSETS) {
  if (!game.resources.resources.some(item => item.file === `assets/touch/${file}`)) {
    game.resources.resources.push({
      file:`assets/touch/${file}`,
      kind:'image',
      metadata:'',
      name:file,
      smoothed:true,
      userAdded:true,
    });
  }
}
if (!game.resources.resources.some(item => item.file === `assets/touch/${ROTATE_ASSET}`)) {
  game.resources.resources.push({
    file:`assets/touch/${ROTATE_ASSET}`,
    kind:'image',
    metadata:'',
    name:ROTATE_ASSET,
    smoothed:true,
    userAdded:true,
  });
}

ensureGlobalObject(game, 'TouchButton', TOUCH_ASSETS.map(([file, animation]) => [animation, file]));
ensureGlobalObject(game, 'TouchRotateOverlay', [['Idle',ROTATE_ASSET]]);
const layout = getTouchLayout();
const touchModule = readModule('src/shared/touch-input.js');
const baseModule = readModule('src/base/config.js');
const baseImplementationModule = ['input','combat','world','presentation']
  .map(name => readModule('src/base/' + name + '.js'))
  .join('\n\n');
const coreModule = readModule('src/core.js');
const hudModule = readModule('src/hud.js');
const hudFunction = (() => {
  const start = hudModule.indexOf('function attachHud(');
  const nextFileFunction = hudModule.indexOf('function attachPresentation(', start);
  const finish = nextFileFunction >= 0 ? nextFileFunction : hudModule.length;
  if (start < 0) fail('attachHud was not found in src/hud.js');
  return hudModule.slice(start, finish).trim();
})();

for (const sceneName of ['TrainingRoom','RescueBase']) {
  const scene = game.layouts.find(item => item.name === sceneName);
  ensureSceneVariable(scene, 'TouchControlsMode', 'auto');
  ensureSceneVariable(scene, 'TouchControlsVisible', false);
  ensureTouchInstances(scene, layout);
  let source = initCode(scene);
  source = injectTouchModule(source, touchModule);
  source = injectBaseModule(source, baseModule);
  source = injectBaseImplementationModules(source, baseImplementationModule);
  source = replaceWrappedFunction(source, CORE_BEGIN, CORE_END, 'createRescue', ['createBase','attachTrainingAerial'], coreModule.slice(coreModule.indexOf('function createRescue(')));
  source = replaceWrappedFunction(source, '// BEGIN SHARED HUD', '// END SHARED HUD', 'attachHud', ['attachPresentation'], hudFunction);
  setInitCode(scene, source);
}

for (const sceneName of ['TrainingRoom','RescueBase']) {
  const beforeScene = original.layouts.find(item => item.name === sceneName);
  const afterScene = game.layouts.find(item => item.name === sceneName);
  const stableBefore = beforeScene.instances.filter(item => !['TouchButton','TouchRotateOverlay'].includes(item.name)).map(item => JSON.stringify({name:item.name,uuid:item.persistentUuid,x:item.x,y:item.y,width:item.width,height:item.height}));
  const stableAfter = afterScene.instances.filter(item => !['TouchButton','TouchRotateOverlay'].includes(item.name)).map(item => JSON.stringify({name:item.name,uuid:item.persistentUuid,x:item.x,y:item.y,width:item.width,height:item.height}));
  if (JSON.stringify(stableBefore) !== JSON.stringify(stableAfter)) fail(`${sceneName} map instances changed unexpectedly`);
  const actions = afterScene.instances.filter(item => item.name === 'TouchButton').map(item => item.initialVariables.find(v=>v.name==='Action')?.value).sort();
  if (JSON.stringify(actions) !== JSON.stringify([...ACTION_ORDER].sort())) fail(`${sceneName} touch actions are incomplete`);
  if (afterScene.instances.filter(item => item.name === 'TouchRotateOverlay').length !== 1) fail(`${sceneName} needs exactly one rotate overlay`);
  const code = initCode(afterScene);
  if (!code.includes(TOUCH_BEGIN) || !code.includes(CORE_BEGIN) || !code.includes('setAnimationName')) fail(`${sceneName} touch runtime injection is incomplete`);
  new Function('runtimeScene', code);
}
const injectedCore = initCode(game.layouts.find(scene=>scene.name==='TrainingRoom')).match(/\/\/ BEGIN SHARED CREATE RESCUE[\s\S]*?\/\/ END SHARED CREATE RESCUE/)?.[0] || '';
if (/setAnimation\s*\(/.test(injectedCore)) fail('Legacy sprite setAnimation call remains in touch runtime');

game.tests = fs.readdirSync(path.join(root, 'tests'))
  .filter(name => name.endsWith('.gameplay.js'))
  .sort()
  .map(filename => ({
    name: filename.replace('.gameplay.js', ''),
    type: 'gameplay',
    description: 'Offline native GDevelop gameplay verification',
    source: fs.readFileSync(path.join(root, 'tests', filename), 'utf8').split('\n'),
  }));
game.testsFolderStructure = {
  folderName: '__ROOT',
  children: game.tests.map(test => ({ itemName: test.name })),
};

fs.mkdirSync(backupDir, {recursive:true});
fs.copyFileSync(gamePath, backupPath);
fs.writeFileSync(gamePath, JSON.stringify(game, null, 2) + '\n');

console.log(JSON.stringify({
  game:path.relative(root, gamePath),
  backup:path.relative(root, backupPath),
  scenes:['TrainingRoom','RescueBase'],
  touchAssets:expectedResources.length,
  actions:ACTION_ORDER,
  instancesPerScene:ACTION_ORDER.length+1,
  preservedExistingInstances:true,
}, null, 2));
