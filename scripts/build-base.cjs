// Additive V0.3 build: keeps TrainingRoom and editor-only global objects intact.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const workspace = path.resolve(root, '..');
const variable = (name, value) => ({
  name,
  type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
  value,
});
const js = code => ({
  type: 'BuiltinCommonInstructions::JsCode',
  inlineCode: code.split('\n'),
  parameterObjects: '',
  useStrict: true,
  eventsSheetExpanded: false,
});
const group = (name, code) => ({
  type: 'BuiltinCommonInstructions::Group',
  name,
  source: '',
  events: [js(code)],
});
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const airFighterSourceDir = path.join(
  root,
  'art-source',
  'V2-air-enemies-v02',
  'Mecha_Buddies_Air_Enemy_SVG_V02',
);
const airFighterSourceFiles = {
  idle: 'ENM_AIR_FIGHTER_IDLE_R_V02.svg',
  warn: 'ENM_AIR_FIGHTER_WARN_R_V02.svg',
  attack: 'ENM_AIR_FIGHTER_ATTACK_R_V02.svg',
  hit: 'ENM_AIR_FIGHTER_HIT_R_V02.svg',
};
const airFighterAssetNames = {
  idle: 'air-fighter-idle.svg',
  warn: 'air-fighter-warn.svg',
  attack: 'air-fighter-attack.svg',
  hit: 'air-fighter-hit.svg',
};

function loadAirFighterAssets() {
  const assets = {};
  for (const [state, sourceFile] of Object.entries(airFighterSourceFiles)) {
    const sourcePath = path.join(airFighterSourceDir, sourceFile);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing supplied V2 air fighter ${state} asset: ${sourcePath}`);
    }
    const content = fs.readFileSync(sourcePath, 'utf8');
    const rootTag = /<svg\b[^>]*>/i.exec(content)?.[0];
    if (!rootTag) throw new Error(`Invalid SVG root in ${sourceFile}`);
    const width = Number(/\bwidth="([\d.]+)"/i.exec(rootTag)?.[1]);
    const height = Number(/\bheight="([\d.]+)"/i.exec(rootTag)?.[1]);
    if (width !== 144 || height !== 144) {
      throw new Error(`Unexpected V2 air fighter canvas in ${sourceFile}: ${width}x${height}`);
    }
    if (/<script\b|<foreignObject\b|\bon[a-z]+\s*=/i.test(content)) {
      throw new Error(`Unsafe executable content in ${sourceFile}`);
    }
    if (/\b(?:href|src)\s*=\s*["'](?!#)/i.test(content) ||
        /\burl\(\s*(?!["']?#)/i.test(content)) {
      throw new Error(`External resource reference in ${sourceFile}`);
    }
    assets[airFighterAssetNames[state]] = content;
  }
  return assets;
}
const instance = (name, x, y, { width, height, layer = 'Gameplay', z = 2, vars = {} } = {}) => ({
  name,
  x,
  y,
  angle: 0,
  zOrder: z,
  layer,
  customSize: width !== undefined,
  width: width || 0,
  height: height || 0,
  keepRatio: false,
  persistentUuid: crypto.randomUUID(),
  numberProperties: [],
  stringProperties: [],
  initialVariables: Object.entries(vars).map(([key, value]) => variable(key, value)),
});

function ensureVariable(target, name, value) {
  const existing = target.find(item => item.name === name);
  if (existing) return existing;
  const created = variable(name, value);
  target.push(created);
  return created;
}

function forceVariable(target, name, value) {
  const entry = ensureVariable(target, name, value);
  entry.type = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
  entry.value = value;
  return entry;
}

function ensureStructure(target, name) {
  const existing = target.find(item => item.name === name);
  if (existing) {
    existing.type = 'structure';
    existing.children = [];
    delete existing.value;
    return existing;
  }
  const created = { name, type: 'structure', children: [] };
  target.push(created);
  return created;
}

function makeBackdrop(BASE) {
  const colors = ['#def6ff', '#e7effc', '#e6faf0', '#e9eafa', '#e2f3ed', '#ddeefc', '#fff3db'];
  const zones = BASE.zones.map((zone, index) => {
    const width = zone.end - zone.start;
    return [
      `<rect x="${zone.start}" width="${width}" height="640" fill="${colors[index % colors.length]}"/>`,
      `<path d="M${zone.start} 258h${width}" stroke="#c8e0e4" stroke-width="12"/>`,
      `<text x="${zone.start + 38}" y="238" font-family="sans-serif" font-size="32" font-weight="bold" fill="#7796a7">${zone.name}</text>`,
    ].join('');
  }).join('');
  const clouds = Array.from({ length: 72 }, (_, index) => {
    const x = index * 122;
    const y = 345 + (index % 4) * 28;
    return `<rect x="${x}" y="${y}" width="88" height="205" rx="14" fill="#c3dde0" opacity=".45"/><path d="M${x + 14} ${y + 55}h60m-60 26h60" stroke="#effafa" stroke-width="5"/>`;
  }).join('');
  const aerial = `<path d="M5600 160h2000" stroke="#8ecae6" stroke-width="8" stroke-dasharray="18 16" opacity=".75"/><g fill="#fff" opacity=".72"><ellipse cx="6080" cy="155" rx="92" ry="28"/><ellipse cx="6160" cy="145" rx="72" ry="35"/><ellipse cx="7020" cy="132" rx="110" ry="30"/></g>`;
  return svg(BASE.width, 640, zones + clouds + aerial + `<path d="M0 548h${BASE.width}" stroke="#afcfd4" stroke-width="8"/>`);
}

function makeAssets(BASE, HUD_SVG, airFighterAssets) {
  const assets = {
    'base-shield.svg': svg(56, 56, '<path d="M22 46v9m23-9v9" stroke="#804c67" stroke-width="7"/><rect x="13" y="5" width="39" height="41" rx="12" fill="#ef967a"/><rect x="22" y="14" width="24" height="12" rx="5" fill="#593b60"/><circle cx="29" cy="20" r="3" fill="#fff"/><path d="M2 10 17 4l9 10-3 30-10 10L1 40z" fill="#7f93d5" stroke="#e7eaff" stroke-width="3"/><path d="m14 19-7 9 7 9" fill="none" stroke="#fff" stroke-width="3"/>'),
    'base-crate.svg': svg(72, 68, '<rect x="2" y="8" width="68" height="58" rx="14" fill="#9a7de0" stroke="#e7dcff" stroke-width="3"/><path d="M15 31h36v17H15zm36 4h15v9H51z" fill="#fff"/><path d="m26 15 8 11 8-11" fill="none" stroke="#ffe58d" stroke-width="4"/>'),
    'base-portal.svg': svg(76, 100, '<path d="M8 98V35a30 30 0 0 1 60 0v63" fill="#c1f5f3" stroke="#4a98b6" stroke-width="8"/><path d="M19 96V36a19 19 0 0 1 38 0v60" fill="#a9e7ed" stroke="#e9ffff" stroke-width="3"/><path d="m26 55 12-12 12 12m-12-10v32" fill="none" stroke="#fff" stroke-width="6"/>'),
    'base-line.svg': svg(100, 3, '<path d="M0 1.5h100" stroke="#e89b27" stroke-width="3" stroke-dasharray="6 5"/>'),
    'base-charge.svg': svg(48, 48, '<circle cx="24" cy="24" r="21" fill="#b695ff" fill-opacity=".4" stroke="#e8dcff" stroke-width="3"/><path d="m27 8-12 18h10l-3 14 13-20H25z" fill="#fff"/>'),
    'base-bar.svg': svg(210, 6, '<rect width="210" height="6" rx="3" fill="#a287e9"/>'),
    'base-hud.svg': HUD_SVG,
    'base-scout-drone.svg': svg(72, 40, '<rect width="72" height="40" fill="none"/>'),
    'base-armored-drone.svg': svg(90, 50, '<rect width="90" height="50" fill="none"/>'),
    'base-jammer-core.svg': svg(82, 92, '<path d="M41 4 74 23v40L41 88 8 63V23z" fill="#5d668f" stroke="#dbe7ff" stroke-width="4"/><circle cx="41" cy="45" r="23" fill="#283851" stroke="#68efff" stroke-width="5"/><path d="m41 24 12 21-12 21-12-21z" fill="#ffb04b"/><path d="M17 17 8 7m57 10 9-10M17 70 7 81m58-11 10 11" stroke="#e5f8ff" stroke-width="4"/>'),
    'base-trial-drone.svg': svg(58, 38, '<path d="M6 19h10m26 0h10M16 8 9 2m33 6 7-6M16 30l-7 6m33-6 7 6" stroke="#e3fbff" stroke-width="3"/><path d="M14 9h30l8 10-8 10H14L6 19z" fill="#63d8c2" stroke="#246a74" stroke-width="3"/><circle cx="29" cy="19" r="7" fill="#ffdc70"/><path d="M29 13v12m-6-6h12" stroke="#74485c" stroke-width="2"/>'),
    'base-missile.svg': svg(44, 18, '<path d="M2 9h8l7-7 23 7-23 7-7-7z" fill="#ffcf63" stroke="#9b5264" stroke-width="2"/><path d="m22 2 8-2v6m-8 12 8 2v-6" fill="#ff8d69"/><circle cx="15" cy="9" r="2" fill="#fff"/>'),
    'base-missile-gun.svg': svg(72, 36, '<path d="M5 17h40l9-8h13v18H54l-9-8H5z" fill="#7b88bd" stroke="#eaf1ff" stroke-width="3"/><rect x="13" y="21" width="17" height="12" rx="4" fill="#42516f"/><circle cx="58" cy="18" r="8" fill="#ffba57" stroke="#fff1c8" stroke-width="2"/><path d="M24 9h20" stroke="#ffba57" stroke-width="3"/>'),
    'base-missile-icon.svg': svg(48, 32, '<rect x="2" y="3" width="44" height="26" rx="8" fill="#344b62" stroke="#82d9e7" stroke-width="2"/><path d="M8 18h17l6-6h7v12h-7l-6-6H8z" fill="#ffcf63" stroke="#fff1c8" stroke-width="2"/>'),
    'base-bomb-marker.svg': svg(46, 46, '<circle cx="23" cy="23" r="18" fill="#f26468" fill-opacity=".26" stroke="#f26468" stroke-width="3" stroke-dasharray="6 4"/><path d="M23 8v30M8 23h30" stroke="#fff" stroke-width="2"/><circle cx="23" cy="23" r="5" fill="#ffd062"/>'),
    'base-missile-reticle.svg': svg(48, 48, '<circle cx="24" cy="24" r="18" fill="none" stroke="#ffd35f" stroke-width="3" stroke-dasharray="7 5"/><path d="M24 2v12m0 20v12M2 24h12m20 0h12" stroke="#fff4c5" stroke-width="3"/><circle cx="24" cy="24" r="3" fill="#ff8e67"/>'),
    'base-backdrop.svg': makeBackdrop(BASE),
    ...airFighterAssets,
  };
  const dimensions = new Set([
    ...BASE.terrain.map(([, , width, height]) => `${width}x${height}`),
    ...BASE.walls.map(([, , width, height]) => `${width}x${height}`),
  ]);
  for (const dimension of dimensions) {
    const [width, height] = dimension.split('x').map(Number);
    const tall = height > 40;
    const body = tall
      ? `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="8" fill="#6d7f9e" stroke="#dceaff" stroke-width="2"/><path d="M8 10h${Math.max(8, width - 16)}M8 24h${Math.max(8, width - 16)}" stroke="#8fa4b9" stroke-width="3"/>`
      : `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${Math.min(10, height / 2)}" fill="#5f7892" stroke="#dff3ff" stroke-width="2"/><path d="M8 ${height / 2}h${Math.max(8, width - 16)}" stroke="#75d5cf" stroke-width="3"/><circle cx="${Math.min(width - 12, 18)}" cy="${height / 2}" r="3" fill="#ffe36f"/>`;
    assets[`base-platform-${dimension}.svg`] = svg(width, height, body);
  }
  return assets;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const outputArgument = process.argv.find(argument => argument.startsWith('--output='));
  const requestedOutput = outputArgument?.slice('--output='.length);
  const { BASE } = await import(pathToFileURL(path.join(root, 'src/base/config.js')));
  const { HUD_LAYOUT, HUD_STYLE, HUD_SVG } = await import(pathToFileURL(path.join(root, 'src/hud.js')));
  const airFighterAssets = loadAirFighterAssets();
  const gamePath = path.join(root, 'game.json');
  const writePath = requestedOutput ? path.resolve(root, requestedOutput) : gamePath;
  const data = JSON.parse(fs.readFileSync(gamePath, 'utf8'));
  const training = data.layouts.find(scene => scene.name === 'TrainingRoom');
  if (!training) throw new Error('TrainingRoom missing; refusing to replace project');

  const backups = path.join(workspace, '.local/gdevelop/rescue-build-backups');
  if (!checkOnly) {
    fs.mkdirSync(backups, { recursive: true });
    fs.copyFileSync(gamePath, path.join(backups, `before-base-${Date.now()}.json`));
  }

  const read = name => fs.readFileSync(path.join(root, 'src', `${name}.js`), 'utf8').replace(/^export /gm, '');
  const shared = [
    'shared/aiming', 'shared/weapon-input', 'shared/enemy-ai', 'rules', 'input', 'combat',
    'world', 'hud', 'presentation', 'art-v2', 'core',
  ].map(read).join('\n');
  const trainingAerialModules = ['base/config', 'training-aerial'].map(read).join('\n');
  // `shared` already contains art-v2. Including it again here creates duplicate
  // top-level declarations in the generated RescueBase initialization script,
  // preventing the entire scene module from parsing.
  const baseModules = ['base/config', 'base/combat', 'base/input', 'base/world', 'base/presentation', 'base/runtime'].map(read).join('\n');
  const rules = 'const Rules={CONFIG,segmentRect,chooseTarget,purchase,overlaps,resolveJump};';
  training.events[0].events[0] = js(`if(!runtimeScene.__rescue){\n${shared}\n${trainingAerialModules}\n${rules}\nruntimeScene.__rescue=createRescue(runtimeScene,Rules);\nattachTrainingAerial(runtimeScene.__rescue);\n}`);

  const scene = structuredClone(training);
  scene.name = 'RescueBase';
  scene.title = '机甲伙伴：救援基地';
  scene.uiSettings = { ...scene.uiSettings, zoomFactor: 0.45 };
  scene.variables = scene.variables || [];
  scene.objects = scene.objects || [];
  scene.instances = [];
  scene.events = [];

  const assets = makeAssets(BASE, HUD_SVG, airFighterAssets);
  const platformArt = Object.fromEntries(
    Object.keys(assets)
      .map(file => /^base-platform-(\d+x\d+)\.svg$/.exec(file))
      .filter(Boolean)
      .map(match => [`Platform${match[1]}`, `assets/${match[0]}`]),
  );
  if (!checkOnly) {
    const manifestPath = path.join(root, 'assets/ASSET_MANIFEST_V2.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.runtime = {
      ...manifest.runtime,
      ...platformArt,
      AirFighterIdle: 'assets/air-fighter-idle.svg',
      AirFighterWarn: 'assets/air-fighter-warn.svg',
      AirFighterAttack: 'assets/air-fighter-attack.svg',
      AirFighterHit: 'assets/air-fighter-hit.svg',
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
  for (const [name, content] of Object.entries(assets)) {
    if (!checkOnly) fs.writeFileSync(path.join(root, 'assets', name), content);
    const resource = {
      name,
      kind: 'image',
      file: `assets/${name}`,
      metadata: '',
      smoothed: true,
      userAdded: true,
      alwaysLoaded: false,
    };
    const index = data.resources.resources.findIndex(item => item.name === name);
    if (index < 0) data.resources.resources.push(resource);
    else data.resources.resources[index] = resource;
  }

  const template = name =>
    training.objects.find(object => object.name === name) ||
    data.objects?.find(object => object.name === name) ||
    scene.objects.find(object => object.name === name);
  const replaceObject = object => {
    scene.objects = scene.objects.filter(existing => existing.name !== object.name);
    scene.objects.push(object);
  };
  const cloneSprite = (name, from, image, { vars = [], behaviors } = {}) => {
    const source = template(from);
    if (!source) throw new Error(`Missing sprite template ${from}`);
    const object = structuredClone(source);
    object.name = name;
    object.variables = vars;
    if (behaviors !== undefined) object.behaviors = behaviors;
    if (object.animations?.[0]?.directions?.[0]?.sprites?.[0]) {
      object.animations[0].directions[0].sprites[0].image = image;
    }
    replaceObject(object);
    return object;
  };
  const cloneText = (name, from, size) => {
    const source = template(from);
    if (!source) throw new Error(`Missing text template ${from}`);
    const object = structuredClone(source);
    object.name = name;
    object.characterSize = size;
    if (object.content) object.content.characterSize = size;
    replaceObject(object);
    return object;
  };

  cloneSprite('Shield', 'Patrol', 'base-shield.svg');
  cloneSprite('CannonCrate', 'Shop', 'base-crate.svg');
  cloneSprite('ReturnPortal', 'Exit', 'base-portal.svg');
  cloneSprite('AimLine', 'Bullet', 'base-line.svg');
  cloneSprite('ChargeGlow', 'Spark', 'base-charge.svg');
  cloneSprite('ChargeFill', 'Bullet', 'base-bar.svg');
  cloneSprite('ScoutDrone', 'Patrol', 'base-scout-drone.svg');
  cloneSprite('ArmoredDrone', 'Patrol', 'base-armored-drone.svg');
  cloneSprite('JammerCore', 'Turret', 'base-jammer-core.svg');
  cloneSprite('TrialDrone', 'Patrol', 'base-trial-drone.svg');
  cloneSprite('MissileReticle', 'TurretWarning', 'base-missile-reticle.svg');
  cloneSprite('BombMarker', 'TurretWarning', 'base-bomb-marker.svg');
  cloneText('EnemyLabel', 'PatrolLabel', 16);
  cloneText('ChargeText', 'StageStatus', 17);

  const aimFrame = scene.objects.find(object => object.name === 'AimLine').animations[0].directions[0].sprites[0];
  aimFrame.originPoint = { name: 'origin', x: 0, y: 1.5 };
  aimFrame.centerPoint = { automatic: false, name: 'center', x: 0, y: 1.5 };
  scene.objects.find(object => object.name === 'Backdrop').animations[0].directions[0].sprites[0].image = 'base-backdrop.svg';

  const enemyValues = {
    Id: '', Health: 2, SpawnX: 0, SpawnY: 0, MinX: 0, MaxX: 0, Direction: 1, Facing: -1,
    DesiredFacing: -1, TurnCooldown: 0,
    Cooldown: 2.6, Tempo: 1, Warning: false, AttackX: 0, HoverY: 0, Phase: 0, DropY: 520, Zone: '',
    Flash: 0, Active: true, Dynamic: false, Reinforcement: false, SiteKey: '',
  };
  for (const object of scene.objects) {
    if (['Patrol', 'Turret', 'Shield', 'ScoutDrone', 'ArmoredDrone'].includes(object.name)) {
      object.variables = Object.entries(enemyValues).map(([key, value]) => variable(key, value));
    }
    if (object.name === 'Shop') object.variables = [variable('Id', '')];
    if (object.name === 'Dummy') object.variables = [
      variable('Id', ''), variable('Health', 4), variable('RoundHits', 0), variable('Flash', 0),
    ];
    if (object.name === 'TrialDrone') object.variables = [
      variable('Id', ''), variable('Health', 2), variable('Active', true), variable('Flash', 0),
      variable('SpawnX', 0), variable('SpawnY', 0), variable('DropY', 500),
    ];
    if (object.name === 'JammerCore') object.variables = [
      variable('Id', ''), variable('Health', 12), variable('Active', true), variable('Flash', 0),
      variable('SpawnX', 0), variable('SpawnY', 0), variable('DropY', 440),
    ];
    if (object.name === 'Bullet') {
      const setObjectVariable = (name, value) => forceVariable(object.variables, name, value);
      setObjectVariable('Vx', 0); setObjectVariable('Vy', 0); setObjectVariable('Distance', 0);
      setObjectVariable('Damage', 1); setObjectVariable('Range', 600);
      setObjectVariable('Weapon', 'Energy'); setObjectVariable('PierceShield', false);
      setObjectVariable('Locked', false); setObjectVariable('TargetId', '');
    }
    if (object.name === 'EnemyBullet') {
      forceVariable(object.variables, 'Range', 700);
      forceVariable(object.variables, 'Weapon', 'Turret');
    }
    if (object.name === 'ModalBody') object.characterSize = 20;
    if (object.name === 'ModalFoot') object.characterSize = 17;
    if (object.name === 'GoalText') object.characterSize = 19;
    if (object.name === 'KeyHelp') {
      object.characterSize = 17;
      object.string = '← → 移动   空格 二段跳   W 攻击 / 蓄力   Q 换枪   E 交互   R 新开一局';
      if (object.content) object.content.characterSize = 17;
    }
  }

  // TrainingRoom keeps its original lesson and receives the V0.3 combat layer
  // through local object definitions and instances. This avoids changing the
  // shared training progression while making every new system testable there.
  const trainingAerialObjectNames = [
    'Shield', 'CannonCrate', 'ScoutDrone', 'ArmoredDrone', 'TrialDrone',
    'MissileReticle', 'BombMarker', 'EnemyLabel', 'AimLine',
  ];
  for (const name of trainingAerialObjectNames) {
    const object = scene.objects.find(item => item.name === name);
    if (!object) throw new Error(`Missing TrainingRoom V0.3 object template ${name}`);
    training.objects = training.objects.filter(item => item.name !== name);
    training.objects.push(structuredClone(object));
  }
  for (const name of ['Patrol', 'Shield', 'Turret']) {
    const source = scene.objects.find(item => item.name === name);
    const target = training.objects.find(item => item.name === name);
    if (!source || !target) throw new Error(`Missing ${name} while upgrading TrainingRoom`);
    target.variables = structuredClone(source.variables);
  }
  for (const name of ['Bullet', 'EnemyBullet']) {
    const source = scene.objects.find(item => item.name === name);
    const target = training.objects.find(item => item.name === name);
    if (!source || !target) throw new Error(`Missing ${name} object while upgrading TrainingRoom`);
    target.variables = structuredClone(source.variables);
  }
  const trainingAerialDefaults = {
    CurrentWeapon: 'Energy', HasMissile: false, MissileUpgraded: false,
    Charge: 0, MissileLockProgress: 0, MissileTargetId: '',
    EnergyShots: 0, MissileShots: 0, MissileLockedShots: 0,
    EnergyHits: 0, MissileHits: 0, ScoutDroneDefeated: 0,
    ArmoredDroneDefeated: 0, TrialTargetsDefeated: 0,
    TrialCoinsEarned: 0, TrialRound: 0, ScoutDroneAttacks: 0,
    ArmoredDroneAttacks: 0, PatrolAttacks: 0, ShieldAttacks: 0, TurretAttacks: 0,
    EnemyShots: 0, ShieldBlocks: 0, MissileBought: 0,
    ReinforcementsEnabled: true, ReinforcementTimer: BASE.trainingReinforcements.initialDelay, ReinforcementSequence: 0,
    ReinforcementSeed: 0,
    ReinforcementsSpawned: 0, ReinforcementsDefeated: 0,
  };
  for (const [name, value] of Object.entries(trainingAerialDefaults)) {
    forceVariable(training.variables, name, value);
  }
  forceVariable(training.variables, 'AimTarget', '');
  ensureStructure(training.variables, 'TrialPaid');

  const enemyVars = enemy => {
    const stats = BASE.enemyStats[enemy.type];
    const zone = BASE.zones.find(item => item.id === enemy.zone);
    return {
      Id: enemy.id,
      Health: stats.health,
      Active: true,
      SpawnX: enemy.x,
      SpawnY: enemy.y,
      MinX: enemy.min ?? enemy.x,
      MaxX: enemy.max ?? enemy.x,
      Direction: 1,
      Facing: -1,
      DesiredFacing: -1,
      TurnCooldown: 0,
      Cooldown: enemy.cooldown ?? 0.8,
      Tempo: enemy.tempo ?? zone?.tempo ?? 1,
      Warning: false,
      AttackX: enemy.x,
      HoverY: enemy.hoverY ?? enemy.y,
      Phase: (enemy.x % 97) / 15,
      DropY: enemy.dropY ?? enemy.y + 56,
      Zone: enemy.zone,
      Flash: 0,
      Dynamic: false,
      Reinforcement: false,
      SiteKey: '',
    };
  };

  // TrainingRoom predates the shared enemy IDs, attack state, and reward ledger.
  // Give its authored instances the same explicit per-instance contract used by
  // RescueBase so assisted aiming and damage settlement never depend on fallback
  // values from a different scene.
  const trainingInstanceVars = {
    Patrol: enemyVars({
      id: 'patrol',
      type: 'Patrol',
      x: 1170,
      y: 512,
      min: 1120,
      max: 1260,
      zone: 'Combat',
      dropY: 520,
    }),
    Turret: enemyVars({
      id: 'turret',
      type: 'Turret',
      x: 1860,
      y: 488,
      min: 1860,
      max: 1860,
      zone: 'Combat',
      dropY: 520,
    }),
    Dummy: {
      Id: 'dummy',
      Health: 4,
      Active: true,
      RoundHits: 0,
      Flash: 0,
    },
    Shop: {
      Id: 'training-shop',
    },
  };
  for (const item of training.instances) {
    const overrides = trainingInstanceVars[item.name];
    if (!overrides) continue;
    const merged = new Map(
      (item.initialVariables || []).map(entry => [entry.name, entry]),
    );
    for (const [name, value] of Object.entries(overrides)) {
      merged.set(name, variable(name, value));
    }
    item.initialVariables = [...merged.values()];
  }

  const hudInstances = Object.entries(HUD_LAYOUT).map(([name, position]) =>
    instance(name, position.x, position.y, {
      layer: name === 'ChargeFill' ? 'Gameplay' : 'HUD',
      z: position.z,
      ...(name === 'HudPanel' ? { width: 304, height: 44 } : {}),
      ...(name === 'ChargeFill' ? { width: 32, height: 4 } : {}),
    }));
  const trainingAerialEnemies = [
    {id:'training-sd1',type:'ScoutDrone',x:1030,y:352,min:1010,max:1160,hoverY:352,zone:'Combat',dropY:516},
    {id:'training-ad1',type:'ArmoredDrone',x:1620,y:300,min:1570,max:1770,hoverY:300,zone:'Combat',dropY:516},
  ];
  const trainingAerialInstanceNames = new Set(['CannonCrate','ScoutDrone','ArmoredDrone','TrialDrone']);
  training.instances = training.instances.filter(item => !trainingAerialInstanceNames.has(item.name));
  training.instances.push(
    ...trainingAerialEnemies.map(enemy => instance(enemy.type, enemy.x, enemy.y, { vars: enemyVars(enemy) })),
    instance('CannonCrate', 2240, 492),
    ...[
      {id:'training-trial-1',x:2560,y:480},
      {id:'training-trial-2',x:2660,y:480},
      {id:'training-trial-3',x:2760,y:480},
    ].map(target => instance('TrialDrone', target.x, target.y, {
      vars: {
        Id: target.id, Health: 2, Active: true, SpawnX: target.x,
        SpawnY: target.y, DropY: 500, Flash: 0,
      },
    })),
  );
  scene.instances = [
    instance('Backdrop', 0, 0, { z: -100 }),
    instance('Player', 80, 504, { z: 10 }),
    instance('ReturnPortal', 35, 460),
    instance('CannonCrate', 2510, 492),
    instance('ChargeGlow', 0, 0, { layer: 'Effects' }),
    ...BASE.terrain.map(([x, y, width, height]) => instance('Terrain', x, y, { width, height })),
    ...BASE.walls.map(([x, y, width, height]) => instance('Wall', x, y, { width, height })),
    ...BASE.gates.map(gate => instance('Gate', gate.x, 0, { z: 6, vars: { Id: gate.id } })),
    instance('JumpBeacon', 575, 296),
    ...BASE.enemies.map(enemy => instance(enemy.type, enemy.x, enemy.y, { vars: enemyVars(enemy) })),
    ...BASE.coins.map(([x, y], index) =>
      instance('Coin', x, y, { vars: { Id: `base-map-${index}`, Reward: false } })),
    ...BASE.shops.map(shop => instance('Shop', shop.x, shop.y, { vars: { Id: shop.id } })),
    instance('Dummy', 2860, 480, { vars: { Id: 'practice-supply' } }),
    instance('Dummy', 3130, 480, { vars: { Id: 'practice-shield' } }),
    ...BASE.trialDrones.map(target =>
      instance('TrialDrone', target.x, target.y, {
        vars: { Id: target.id, Health: 2, Active: true, SpawnX: target.x, SpawnY: target.y, DropY: 500, Flash: 0 },
      })),
    instance('JammerCore', BASE.jammer.x, BASE.jammer.y, {
      vars: {
        Id: BASE.jammer.id, Health: BASE.jammer.health, Active: false, SpawnX: BASE.jammer.x,
        SpawnY: BASE.jammer.y, DropY: 440, Flash: 0,
      },
    }),
    instance('Exit', 8240, 448),
    instance('Partner', 8264, 476, { z: 12 }),
    ...hudInstances,
    instance('Toast', 28, 118, { layer: 'HUD' }),
    instance('PromptText', 28, 574, { layer: 'HUD' }),
    instance('KeyHelp', 28, 610, { layer: 'HUD' }),
    instance('ModalPanel', 0, 0, { layer: 'Modal', z: 0 }),
    instance('ModalTitle', 182, 151, { layer: 'Modal' }),
    instance('ModalBody', 184, 218, { layer: 'Modal' }),
    instance('ModalFoot', 194, 466, { layer: 'Modal' }),
  ];

  for (const [name, properties] of Object.entries(HUD_STYLE)) {
    const object = scene.objects.find(item => item.name === name);
    if (!object) continue;
    const [r, g, b] = properties.color.split(';').map(Number);
    Object.assign(object, { ...properties, color: { r, g, b } });
    object.content = { ...object.content, ...properties };
  }

  const sceneDefaults = {
    GameMode: 'Playing', Stage: 'Entry', Health: 3, Coins: 0, JumpCount: 0,
    DoubleJumpDone: false, Jumps: 0, DoubleJumps: 0, CoinsCollected: 0,
    MapCoinsCollected: 0, RewardCoinsCollected: 0, EnemiesDefeated: 0,
    ShotsFired: 0, Hits: 0, Retries: 0, DamageTaken: 0, Purchases: 0,
    CurrentWeapon: 'Energy', HasCannon: false, EnergyUpgraded: false,
    CannonUpgraded: false, HasMissile: false, MissileUpgraded: false,
    Charge: 0, MissileLockProgress: 0, MissileTargetId: '',
    WalletAtStart: 0, CoinsSpent: 0, EnergyShots: 0, CannonShots: 0,
    MissileShots: 0, MissileLockedShots: 0, ChargedShots: 0,
    EnergyHits: 0, CannonHits: 0, MissileHits: 0, ShieldBlocks: 0,
    JammerBlocks: 0, PatrolDefeated: 0, TurretDefeated: 0, ShieldDefeated: 0,
    ScoutDroneDefeated: 0, ArmoredDroneDefeated: 0, JammerCoresDefeated: 0,
    TrialTargetsDefeated: 0, ScoutDroneAttacks: 0, ArmoredDroneAttacks: 0,
    HealsBought: 0, UpgradesBought: 0, MissileBought: 0, Teleports: 0,
    ElapsedSeconds: 0, EnemyShots: 0, TrialRound: 0, TrialCoinsEarned: 0,
    PatrolAttacks: 0, ShieldAttacks: 0, TurretAttacks: 0, ReinforcementsEnabled: true,
    ReinforcementTimer: BASE.reinforcements.initialDelay, ReinforcementSequence: 0,
    ReinforcementSeed: 0,
    ReinforcementsSpawned: 0, ReinforcementsDefeated: 0,
    JammerCoreDefeated: false, Completed: false, AimTarget: '',
    CheckpointX: 80, CheckpointY: 504, CoyoteRemaining: 0, JumpBufferRemaining: 0,
  };
  for (const [name, value] of Object.entries(sceneDefaults)) {
    const entry = ensureVariable(scene.variables, name, value);
    entry.type = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
    entry.value = value;
  }
  for (const name of ['CollectedCoins', 'DefeatedEnemies', 'UnlockedPortals', 'ShopStock', 'TrialPaid']) {
    ensureStructure(scene.variables, name);
  }
  scene.variables = scene.variables.filter(item =>
    ['UpgradePurchased', 'WeaponForm', 'StageAdvanceCount', 'DummyHealth', 'DummyHits',
      'UpgradedDummyHit', 'DummyDestroyed', 'UpgradedHits'].includes(item.name) === false);
  scene.objectsFolderStructure = { folderName: '__ROOT', children: scene.objects.map(object => ({ objectName: object.name })) };
  scene.events = [
    group('00 · 离线初始化与关卡配置', `if(!runtimeScene.__rescue){\n${shared}\n${baseModules}\n${rules}\nruntimeScene.__rescue=createBase(runtimeScene,Rules);\n}`),
    group('01 · 输入、原生二段跳与武器充能', 'runtimeScene.__rescue.beginFrame();\nruntimeScene.__rescue.input();'),
    group('02 · 地面、飞行敌人与预警', 'runtimeScene.__rescue.enemyAI();'),
    group('03 · 弹丸、导弹追踪与统一伤害', 'runtimeScene.__rescue.projectiles();'),
    group('04 · 金币、掉坑与返回捷径', 'runtimeScene.__rescue.world();'),
    group('05 · 分区门、核心与救援出口', 'runtimeScene.__rescue.progress();'),
    group('06 · HUD、商店与真实记录', 'runtimeScene.__rescue.presentation();'),
  ];

  data.layouts = data.layouts.filter(item => item.name !== 'RescueBase');
  data.layouts.push(scene);
  data.firstLayout = 'RescueBase';
  data.properties.version = '0.3.0';
  data.properties.description = 'V0.3 离线空战扩充 / 正式空中敌机 / 其余系统使用作者美术或本地占位资源';
  data.variables = data.variables || [];
  ensureVariable(data.variables, 'RescueWallet', 0);
  ensureVariable(data.variables, 'RescueCarryWallet', false);

  const hudNames = Object.keys(HUD_LAYOUT);
  data.objects = data.objects || [];
  for (const name of hudNames) {
    let object = data.objects.find(item => item.name === name) || scene.objects.find(item => item.name === name);
    if (!object) throw new Error(`Missing shared HUD template ${name}`);
    object = structuredClone(object);
    if (name === 'HudPanel') object.animations[0].directions[0].sprites[0].image = 'base-hud.svg';
    if (HUD_STYLE[name]) {
      const style = HUD_STYLE[name];
      const [r, g, b] = style.color.split(';').map(Number);
      Object.assign(object, { ...style, color: { r, g, b } });
      object.content = { ...object.content, ...style };
    }
    data.objects = data.objects.filter(existing => existing.name !== name);
    data.objects.push(object);
  }
  for (const layout of data.layouts) {
    layout.objects = layout.objects.filter(object => !hudNames.includes(object.name));
    layout.instances = layout.instances.filter(item => !hudNames.includes(item.name));
    layout.instances.push(...Object.entries(HUD_LAYOUT).map(([name, position]) =>
      instance(name, position.x, position.y, {
        layer: name === 'ChargeFill' ? 'Gameplay' : 'HUD',
        z: position.z,
        ...(name === 'HudPanel' ? { width: 304, height: 44 } : {}),
        ...(name === 'ChargeFill' ? { width: 32, height: 4 } : {}),
      })));
    layout.objectsFolderStructure = { folderName: '__ROOT', children: layout.objects.map(object => ({ objectName: object.name })) };
  }
  data.objectsFolderStructure = { folderName: '__ROOT', children: data.objects.map(object => ({ objectName: object.name })) };

  data.tests = fs.readdirSync(path.join(root, 'tests'))
    .filter(name => name.endsWith('.gameplay.js'))
    .sort()
    .map(filename => {
      const testName = filename.replace('.gameplay.js', '');
      return {
      name: testName,
      type: 'gameplay',
      description: 'Offline native GDevelop gameplay verification',
      source: fs.readFileSync(path.join(root, 'tests', filename), 'utf8').split('\n'),
      };
    });

  if (fs.existsSync(path.join(root, 'assets/ASSET_MANIFEST_V2.json'))) {
    require('./apply-art-v2.cjs').applyArtV2(data, { BASE, HUD_LAYOUT, platformArt });
  }
  if (fs.existsSync(path.join(root, 'assets/HD_ACTORS_MANIFEST.json'))) {
    require('./apply-hd-actors.cjs').applyHdActors(data);
  }

  const initialize = require(path.join(workspace, '.local/gdevelop/core-check/libGD.js'));
  const gd = await initialize();
  gd.ProjectHelper.initializePlatforms();
  const project = gd.ProjectHelper.createNewGDJSProject();
  const input = gd.Serializer.fromJSON(JSON.stringify(data));
  project.unserializeFrom(input);
  const output = new gd.SerializerElement();
  project.serializeTo(output);
  const normalized = JSON.parse(gd.Serializer.toJSON(output));

  const rescue = normalized.layouts.find(item => item.name === 'RescueBase');
  const normalizedTraining = normalized.layouts.find(item => item.name === 'TrainingRoom');
  const countInstances = name => rescue.instances.filter(item => item.name === name).length;
  const countTrainingInstances = name => normalizedTraining.instances.filter(item => item.name === name).length;
  const validation = {
    trainingScene: normalized.layouts.some(item => item.name === 'TrainingRoom'),
    trainingAerial: countTrainingInstances('ScoutDrone') === 1 &&
      countTrainingInstances('ArmoredDrone') === 1 &&
      countTrainingInstances('TrialDrone') === 3 &&
      countTrainingInstances('CannonCrate') === 1,
    rescueScene: !!rescue,
    enemies: ['Patrol', 'Turret', 'Shield', 'ScoutDrone', 'ArmoredDrone']
      .reduce((sum, name) => sum + countInstances(name), 0),
    mapCoins: countInstances('Coin'),
    gates: countInstances('Gate'),
    shops: countInstances('Shop'),
    trialDrones: countInstances('TrialDrone'),
    jammerCores: countInstances('JammerCore'),
    backdropWidth: rescue.instances.find(item => item.name === 'Backdrop')?.width,
  };
  if (validation.enemies !== BASE.enemies.length ||
      !validation.trainingAerial ||
      validation.mapCoins !== BASE.coins.length ||
      validation.gates !== BASE.gates.length ||
      validation.shops !== BASE.shops.length ||
      validation.trialDrones !== BASE.trialDrones.length ||
      validation.jammerCores !== 1) {
    throw new Error(`Native instance validation failed: ${JSON.stringify(validation)}`);
  }

  if (!checkOnly) {
    fs.mkdirSync(path.dirname(writePath), { recursive: true });
    fs.writeFileSync(writePath, JSON.stringify(normalized, null, 2));
    const manifestPath = path.join(root, 'assets/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.assets = manifest.assets.filter(item => !Object.keys(assets).includes(item.file));
    manifest.assets.push(...Object.keys(assets).map(file => ({
      file,
      source: Object.values(airFighterAssetNames).includes(file)
        ? 'user-supplied V2 air fighter SVG'
        : file.includes('platform') || [
        'base-jammer-core.svg',
        'base-trial-drone.svg', 'base-missile.svg', 'base-missile-gun.svg',
        'base-missile-icon.svg', 'base-bomb-marker.svg', 'base-missile-reticle.svg',
      ].includes(file) ? 'project-authored local placeholder' : 'project-authored',
      license: 'Original local vector artwork',
    })));
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  if (normalized.objects.filter(object => hudNames.includes(object.name)).length !== hudNames.length ||
      normalized.layouts.some(layout => layout.objects.some(object => hudNames.includes(object.name)))) {
    throw new Error('HUD must resolve only global definitions');
  }
  console.log(JSON.stringify({
    checkOnly,
    version: normalized.properties.version,
    scenes: normalized.layouts.map(item => item.name),
    validation,
    globalHudObjects: hudNames.length,
    tests: data.tests.length,
    nativeRoundTrip: true,
    outputFile: path.relative(root, writePath),
  }));
  input.delete();
  output.delete();
  project.delete();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
