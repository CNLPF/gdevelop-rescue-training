#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const CORE_OBJECTS = [
  "Player",
  "Terrain",
  "Wall",
  "Gate",
  "Coin",
  "Bullet",
  "EnemyBullet",
  "HudPanel",
  "ModalPanel",
  "Exit",
];

const ID_OBJECTS = [
  "Patrol",
  "Turret",
  "Shield",
  "ScoutDrone",
  "ArmoredDrone",
  "JammerCore",
  "Coin",
  "Gate",
  "Shop",
  "Dummy",
  "TrialDrone",
];

const CORE_SCENE_VARIABLES = [
  "GameMode",
  "Stage",
  "Coins",
  "Health",
  "CheckpointX",
  "CheckpointY",
  "JumpCount",
  "CurrentWeapon",
  "CollectedCoins",
  "DefeatedEnemies",
];

function usage() {
  console.log(`只读检查 GDevelop 的 game.json。

用法：
  node scripts/inspect-game-json.cjs [选项]

选项：
  --project=<path>  项目文件，默认 game.json
  --scene=<name>    只检查一个布局，可重复使用
  --ids             列出带稳定 Id 的实例
  --details         列出场景变量与核心对象变量
  --json            输出机器可读 JSON
  --help            显示帮助

此脚本只读取文件，不会保存、修复或重写 GDevelop 项目。`);
}

function parseArgs(argv) {
  const result = {
    project: "game.json",
    scenes: [],
    ids: false,
    details: false,
    json: false,
  };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") result.help = true;
    else if (arg === "--ids") result.ids = true;
    else if (arg === "--details") result.details = true;
    else if (arg === "--json") result.json = true;
    else if (arg.startsWith("--project=")) result.project = arg.slice("--project=".length);
    else if (arg.startsWith("--scene=")) result.scenes.push(arg.slice("--scene=".length));
    else throw new Error(`未知参数：${arg}`);
  }
  return result;
}

function scalarValue(variable) {
  if (!variable) return undefined;
  if (Object.prototype.hasOwnProperty.call(variable, "value")) return variable.value;
  if (Array.isArray(variable.children)) return "<structure>";
  return undefined;
}

function variablesOf(subject, property) {
  const values = subject && Array.isArray(subject[property]) ? subject[property] : [];
  return new Map(values.map((variable) => [variable.name, variable]));
}

function layoutsOf(project) {
  if (Array.isArray(project.layouts)) return project.layouts;
  if (project.layouts && typeof project.layouts === "object") {
    return Object.entries(project.layouts).map(([name, layout]) => ({ ...layout, name }));
  }
  return [];
}

function sceneObjectNames(layout, project) {
  const names = new Set();
  for (const object of [
    ...(Array.isArray(layout.objects) ? layout.objects : []),
    ...(Array.isArray(project.objects) ? project.objects : []),
  ]) {
    if (object && typeof object.name === "string") names.add(object.name);
  }
  return names;
}

function instanceSummaries(layout, specs) {
  const counts = new Map();
  const ids = [];
  const duplicateIds = [];
  const missingIds = [];
  const seen = new Set();

  for (const instance of Array.isArray(layout.instances) ? layout.instances : []) {
    const name = instance && instance.name;
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
    if (!ID_OBJECTS.includes(name)) continue;

    const variables = variablesOf(instance, "initialVariables");
    const idVariable = variables.get("Id");
    const id = idVariable ? String(scalarValue(idVariable) ?? "").trim() : "";
    // Deliberately conservative: one readable Id namespace per layout makes
    // debugging in GDevelop clearer, even where separate ledgers could coexist.
    const key = id;
    if (!id) {
      missingIds.push({ object: name, uuid: instance.persistentUuid || "" });
    } else if (seen.has(key)) {
      duplicateIds.push({ object: name, id, uuid: instance.persistentUuid || "" });
    } else {
      seen.add(key);
    }
    if (specs.ids) {
      ids.push({
        object: name,
        id,
        x: instance.x,
        y: instance.y,
        width: instance.width,
        height: instance.height,
        layer: instance.layer,
        variables: Object.fromEntries(
          [...variables].map(([variableName, variable]) => [
            variableName,
            scalarValue(variable),
          ]),
        ),
      });
    }
  }

  return { counts, ids, duplicateIds, missingIds };
}

function inspectScene(project, layout, specs) {
  const availableObjects = sceneObjectNames(layout, project);
  const missingCoreObjects = CORE_OBJECTS.filter((name) => !availableObjects.has(name));
  const sceneVariables = variablesOf(layout, "variables");
  const missingCoreVariables = CORE_SCENE_VARIABLES.filter((name) => !sceneVariables.has(name));
  const instances = instanceSummaries(layout, specs);
  const objectVariables = {};

  if (specs.details) {
    for (const object of Array.isArray(layout.objects) ? layout.objects : []) {
      if (!object || !object.name) continue;
      const variables = variablesOf(object, "variables");
      if (!variables.size) continue;
      objectVariables[object.name] = Object.fromEntries(
        [...variables].map(([name, variable]) => [
          name,
          {
            type: variable.type,
            value: scalarValue(variable),
          },
        ]),
      );
    }
  }

  return {
    name: layout.name || "(unnamed layout)",
    instanceCount: Array.isArray(layout.instances) ? layout.instances.length : 0,
    objectDefinitionCount: Array.isArray(layout.objects) ? layout.objects.length : 0,
    layerCount: Array.isArray(layout.layers) ? layout.layers.length : 0,
    eventGroupCount: Array.isArray(layout.events) ? layout.events.length : 0,
    objectNames: [...availableObjects].sort(),
    missingCoreObjects,
    missingCoreVariables,
    sceneVariables: Object.fromEntries(
      [...sceneVariables].map(([name, variable]) => [
        name,
        {
          type: variable.type,
          value: scalarValue(variable),
        },
      ]),
    ),
    instanceCounts: Object.fromEntries([...instances.counts].sort()),
    duplicateIds: instances.duplicateIds,
    missingIds: instances.missingIds,
    ids: specs.ids ? instances.ids : undefined,
    objectVariables: specs.details ? objectVariables : undefined,
  };
}

function printScene(scene, specs) {
  console.log(`\n[${scene.name}]`);
  console.log(
    `实例 ${scene.instanceCount} · 对象定义 ${scene.objectDefinitionCount} · ` +
      `层 ${scene.layerCount} · 事件组 ${scene.eventGroupCount}`,
  );
  const coreTypes = ["Player", "Terrain", "Wall", "Gate", "Coin", "Patrol", "Turret", "Shield", "ScoutDrone", "ArmoredDrone"];
  const counts = coreTypes
    .filter((name) => scene.instanceCounts[name] !== undefined)
    .map((name) => `${name}=${scene.instanceCounts[name]}`)
    .join("  ");
  console.log(`核心实例：${counts || "无"}`);

  if (scene.missingCoreObjects.length) {
    console.log(`警告：缺少核心对象定义：${scene.missingCoreObjects.join(", ")}`);
  }
  if (scene.missingCoreVariables.length) {
    console.log(`警告：缺少核心场景变量：${scene.missingCoreVariables.join(", ")}`);
  }
  if (scene.duplicateIds.length) {
    for (const item of scene.duplicateIds) {
      console.log(`错误：重复 Id ${item.object}:${item.id}`);
    }
  }
  if (scene.missingIds.length) {
    for (const item of scene.missingIds) {
      console.log(`错误：${item.object} 实例缺少 Id`);
    }
  }
  if (!scene.duplicateIds.length && !scene.missingIds.length) {
    console.log("Id 检查：带逻辑 Id 的核心实例均存在，且本布局内 Id 不重复。");
  }

  if (specs.details) {
    console.log("场景变量：");
    for (const [name, value] of Object.entries(scene.sceneVariables)) {
      console.log(`  ${name} [${value.type}] = ${value.value ?? ""}`);
    }
    console.log("对象变量：");
    for (const [name, variables] of Object.entries(scene.objectVariables)) {
      const summary = Object.entries(variables)
        .map(([variableName, value]) => `${variableName}:${value.type}`)
        .join(", ");
      console.log(`  ${name}: ${summary}`);
    }
  }

  if (specs.ids) {
    console.log("稳定 Id：");
    for (const item of scene.ids) {
      console.log(
        `  ${item.object}:${item.id || "<missing>"} @ ${item.x},${item.y} (${item.layer})`,
      );
    }
  }
}

function main() {
  const specs = parseArgs(process.argv.slice(2));
  if (specs.help) {
    usage();
    return;
  }

  const projectPath = path.resolve(specs.project);
  const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
  const allLayouts = layoutsOf(project);
  const selected = specs.scenes.length
    ? allLayouts.filter((layout) => specs.scenes.includes(layout.name))
    : allLayouts;
  const missingScenes = specs.scenes.filter(
    (name) => !allLayouts.some((layout) => layout.name === name),
  );
  if (missingScenes.length) {
    throw new Error(`找不到布局：${missingScenes.join(", ")}`);
  }

  const scenes = selected.map((layout) => inspectScene(project, layout, specs));
  const payload = {
    project: projectPath,
    gdVersion:
      project.gdVersion && typeof project.gdVersion === "object"
        ? `${project.gdVersion.major}.${project.gdVersion.minor}.${project.gdVersion.build}`
        : String(project.gdVersion || project.initialGDVersion || "unknown"),
    readOnly: true,
    scenes,
  };

  if (specs.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`项目：${projectPath}`);
    console.log(`GDevelop 版本：${payload.gdVersion}`);
    console.log("模式：只读（未写入 game.json）");
    for (const scene of scenes) printScene(scene, specs);
  }

  const hasHardError = scenes.some(
    (scene) => scene.missingCoreObjects.length || scene.duplicateIds.length || scene.missingIds.length,
  );
  process.exitCode = hasHardError ? 1 : 0;
}

try {
  main();
} catch (error) {
  console.error(`检查失败：${error.message}`);
  process.exitCode = 1;
}
