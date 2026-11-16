// Build a self-contained mobile web/Cordova payload from the actual GDevelop
// HTML5 preview export. This script never reads or rewrites scene instances.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = process.env.GD_PREVIEW_DIR
  ? path.resolve(process.env.GD_PREVIEW_DIR)
  : path.join(os.tmpdir(), 'GDTMP--1', 'gameplay-test-preview');
const dist = path.join(root, 'dist');
const web = path.join(dist, 'mobile-web');
const cordova = path.join(dist, 'android-cordova');
const cordovaWww = path.join(cordova, 'www');

function fail(message) {
  throw new Error(message);
}

function removeIfExists(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function copyReleaseRuntime(from, to) {
  const excludedDirectories = new Set(['debugger-client', 'gameplay-tests']);
  fs.cpSync(from, to, {
    recursive: true,
    filter(current) {
      const relative = path.relative(from, current);
      if (!relative) return true;
      const first = relative.split(path.sep)[0];
      if (excludedDirectories.has(first)) return false;
      if (current.endsWith('.map')) return false;
      return true;
    },
  });
}

function readAssignment(sourceText, marker) {
  const startMarker = `gdjs.${marker} = `;
  const start = sourceText.indexOf(startMarker);
  if (start < 0) fail(`Missing ${startMarker}`);
  const valueStart = start + startMarker.length;
  const lineEnd = sourceText.indexOf('\n', valueStart);
  if (lineEnd < 0) fail(`Unterminated ${marker} assignment`);
  const statement = sourceText.slice(valueStart, lineEnd).trim().replace(/;$/, '');
  return JSON.parse(statement);
}

function sanitizeRuntimeOptions(sourceText) {
  const options = readAssignment(sourceText, 'runtimeGameOptions');
  const forbiddenScript = item => /(?:debugger-client|gameplay-tests)\//.test(item.path);
  options.scriptFiles = (options.scriptFiles || []).filter(item => !forbiddenScript(item));
  options.isPreview = false;
  options.shouldReloadLibraries = false;
  options.shouldGenerateScenesEventsCode = false;
  options.nativeMobileApp = true;
  options.websocketDebuggerServerAddress = '';
  options.websocketDebuggerServerPort = '';
  options.electronRemoteRequirePath = '';
  options.previewContext = 'cordova';
  delete options.initialRuntimeGameStatus;

  const marker = 'gdjs.runtimeGameOptions = ';
  const start = sourceText.indexOf(marker);
  const valueStart = start + marker.length;
  const lineEnd = sourceText.indexOf('\n', valueStart);
  return sourceText.slice(0, valueStart) + JSON.stringify(options) + sourceText.slice(lineEnd);
}

function sanitizeProjectData(sourceText) {
  // Clearing the UUID disables GDevelop's optional analytics in a release build.
  // Clearing the output path avoids shipping a developer-machine location.
  return sourceText
    .replace(/"latestCompilationDirectory":"(?:[^"\\]|\\.)*"/, '"latestCompilationDirectory":""')
    .replace(/"projectUuid":"[^"]*"/, '"projectUuid":""');
}

function sanitizeIndex(html) {
  let output = html
    .replace(/^\s*<script src="debugger-client\/[^"]+"[^>]*><\/script>\s*$/gm, '')
    .replace(/^\s*<script src="gameplay-tests\/[^"]+"[^>]*><\/script>\s*$/gm, '')
    .replace('<html>', '<html lang="zh-CN">')
    .replace('<meta charset="UTF-8"/>', '<meta charset="UTF-8"/>\n    <title>机甲伙伴：救援基地</title>')
    .replace(
      /<meta name="viewport"[^>]*>/,
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />\n    <meta name="mobile-web-app-capable" content="yes" />\n    <meta name="format-detection" content="telephone=no, email=no, address=no" />'
    );

  const style = `
        html, body {
            width: 100%;
            height: 100%;
            background: #081322;
            overscroll-behavior: none;
            -webkit-user-select: none;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        }
        body {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
            box-sizing: border-box;
        }
        canvas {
            display: block;
            touch-action: none;
        }
`;
  if (!output.includes('</style>')) fail('Generated index has no style block');
  output = output.replace('</style>', `${style}    </style>`);
  return output;
}

function ensureRequiredFiles(directory) {
  for (const relative of ['index.html', 'data.js', 'code0.js', 'code1.js', 'gd.js', 'runtimegame.js']) {
    if (!fs.existsSync(path.join(directory, relative))) fail(`Missing exported runtime file: ${relative}`);
  }
}

function writeCordovaSource() {
  const widgetId = 'com.aichildlearning.rescuetraining';
  const config = `<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" xmlns:android="http://schemas.android.com/apk/res/android"
    id="${widgetId}" version="0.3.0" android-versionCode="300">
  <name>机甲伙伴：救援基地</name>
  <description>离线横屏机甲救援平台游戏</description>
  <author email="local@example.invalid" href="https://github.com/CNLPF/gdevelop-rescue-training">AI数字创造实验室</author>
  <content src="index.html" />

  <preference name="Orientation" value="landscape" />
  <preference name="Fullscreen" value="true" />
  <preference name="StatusBarOverlaysWebView" value="true" />
  <preference name="StatusBarBackgroundColor" value="#081322" />
  <preference name="StatusBarStyle" value="black-translucent" />
  <preference name="AndroidXEnabled" value="true" />
  <preference name="SplashMaintainAspectRatio" value="true" />

  <!-- The game only loads files bundled in www; no remote origin is allowed. -->
  <access origin="none" />
  <allow-navigation href="none" />
</widget>
`;
  fs.writeFileSync(path.join(cordova, 'config.xml'), config);
  fs.writeFileSync(path.join(cordova, 'package.json'), JSON.stringify({
    name: 'jiahuoban-rescue-base',
    displayName: '机甲伙伴：救援基地',
    version: '0.3.0',
    description: '离线横屏 Cordova 源；APK 尚未编译验证。',
    private: true,
    scripts: {
      prepare: 'echo Cordova source is ready. Add the Android platform with your installed Cordova CLI.',
    },
    cordova: {
      platforms: [],
    },
    devDependencies: {
      cordova: '^12.0.0',
      'cordova-android': '^13.0.0',
    },
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(cordova, 'README.md'), `# Android / Cordova 源

这是基于同一 GDevelop HTML5 运行时的 Cordova 兼容源，强制横屏、全屏且只加载本地 \`www\` 文件。

当前仓库生成的是可编译源，不是 APK：本机未检测到 Java、Gradle、Android SDK 或 ADB，也未执行真机安装。

在具备 Android 工具链的机器上：

\`\`\`powershell
npm install
npx cordova platform add android
npx cordova build android
\`\`\`

首次编译前请安装并配置 JDK 17、Android SDK 与对应的 Build Tools。
`);
}

function writeBuildInfo(options) {
  const info = {
    project: '机甲伙伴：救援基地',
    version: '0.3.0',
    gdevelopVersion: '5.6.286',
    source: 'GDevelop HTML5 preview export',
    releaseTransform: 'Removed preview debugger, gameplay-test runner, source maps, local paths and analytics UUID',
    orientation: 'landscape',
    referenceResolution: { width: 960, height: 640 },
    offline: true,
    debugScriptsIncluded: false,
    gdevelopScriptFileCount: options.scriptFiles.length,
    androidApkCompiled: false,
    physicalDeviceVerified: false,
  };
  fs.writeFileSync(path.join(web, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
}

function main() {
  if (!fs.existsSync(source)) {
    fail(`GDevelop preview export not found: ${source}\nRun the project preview/export in GDevelop first or set GD_PREVIEW_DIR.`);
  }
  ensureRequiredFiles(source);
  removeIfExists(dist);
  fs.mkdirSync(web, { recursive: true });
  fs.mkdirSync(cordova, { recursive: true });
  copyReleaseRuntime(source, web);

  const indexPath = path.join(web, 'index.html');
  const dataPath = path.join(web, 'data.js');
  fs.writeFileSync(indexPath, sanitizeIndex(fs.readFileSync(indexPath, 'utf8')));
  let data = fs.readFileSync(dataPath, 'utf8');
  data = sanitizeProjectData(sanitizeRuntimeOptions(data));
  fs.writeFileSync(dataPath, data);
  const options = readAssignment(data, 'runtimeGameOptions');
  writeBuildInfo(options);

  copyReleaseRuntime(web, cordovaWww);
  writeCordovaSource();
  console.log(JSON.stringify({
    web,
    cordova,
    source,
    debugScriptsIncluded: fs.existsSync(path.join(web, 'gameplay-tests')),
    runtimeScripts: options.scriptFiles.length,
    orientation: 'landscape',
  }, null, 2));
}

main();