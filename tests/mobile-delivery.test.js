import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.join(root,'dist','mobile-web');
const cordova=path.join(root,'dist','android-cordova');
const cordovaWww=path.join(cordova,'www');
const textExtensions=new Set(['.html','.js','.json','.css','.svg','.xml','.webmanifest','.md','.txt']);

function walk(directory){
  if(!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const absolute=path.join(directory,entry.name);
    return entry.isDirectory()?walk(absolute):[absolute];
  });
}

const webFiles=walk(web);
const cordovaFiles=walk(cordova);
const textFiles=[...new Set([...webFiles,...cordovaFiles])]
  .filter(file=>textExtensions.has(path.extname(file).toLowerCase()));
const read=file=>fs.readFileSync(file,'utf8');

test('release-ready mobile web and Cordova payloads are present',()=>{
  for(const file of ['index.html','data.js','code0.js','code1.js','gd.js','runtimegame.js','build-info.json']){
    assert.ok(fs.existsSync(path.join(web,file)),`mobile web ${file}`);
    assert.ok(fs.existsSync(path.join(cordovaWww,file)),`Cordova www ${file}`);
  }
  assert.ok(fs.existsSync(path.join(cordova,'config.xml')));
  assert.ok(fs.existsSync(path.join(cordova,'package.json')));
  assert.ok(fs.existsSync(path.join(cordova,'README.md')));
});

test('build metadata identifies the project, offline landscape target and unverified APK boundary',()=>{
  const info=JSON.parse(read(path.join(web,'build-info.json')));
  assert.equal(info.project,'机甲伙伴：救援基地');
  assert.equal(info.gdevelopVersion,'5.6.286');
  assert.equal(info.orientation,'landscape');
  assert.deepEqual(info.referenceResolution,{width:960,height:640});
  assert.equal(info.offline,true);
  assert.equal(info.debugScriptsIncluded,false);
  assert.equal(info.androidApkCompiled,false);
  assert.equal(info.physicalDeviceVerified,false);
  assert.ok(info.gdevelopScriptFileCount>0);
});

test('preview debugger, gameplay harness and source maps are not shipped',()=>{
  const forbiddenDirectories=new Set(['debugger-client','gameplay-tests']);
  for(const file of webFiles){
    const parts=path.relative(web,file).split(path.sep);
    assert.equal(parts.some(part=>forbiddenDirectories.has(part)),false,`forbidden directory in ${file}`);
    assert.notEqual(path.extname(file).toLowerCase(),'.map',`source map leaked: ${file}`);
  }
  const index=read(path.join(web,'index.html'));
  const data=read(path.join(web,'data.js'));
  for(const text of [index,data]){
    assert.doesNotMatch(text,/(?:debugger-client|gameplay-tests)\//);
  }
  assert.match(data,/"isPreview":false/);
  assert.match(data,/"nativeMobileApp":true/);
  assert.match(data,/"websocketDebuggerServerAddress":""/);
});

test('release output contains no local compiler path, temporary preview path or analytics UUID',()=>{
  for(const file of textFiles){
    const source=read(file);
    assert.doesNotMatch(source,/GDTMP--1/i,`temporary path leaked in ${file}`);
    assert.doesNotMatch(source,/[A-Z]:[\\/](?:Users|AI Project|AI_Project)[\\/]/i,`local machine path leaked in ${file}`);
  }
  const data=read(path.join(web,'data.js'));
  assert.match(data,/"latestCompilationDirectory":""/);
  assert.match(data,/"projectUuid":""/);
});

test('Cordova source locks landscape and permits only packaged local content',()=>{
  const config=read(path.join(cordova,'config.xml'));
  assert.match(config,/<preference name="Orientation" value="landscape" \/>/);
  assert.match(config,/<access origin="none" \/>/);
  assert.match(config,/<allow-navigation href="none" \/>/);
  const packageJson=JSON.parse(read(path.join(cordova,'package.json')));
  assert.equal(packageJson.private,true);
  assert.match(packageJson.description,/APK 尚未编译验证/);
});
