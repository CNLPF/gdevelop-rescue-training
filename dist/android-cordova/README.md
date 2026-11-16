# Android / Cordova 源

这是基于同一 GDevelop HTML5 运行时的 Cordova 兼容源，强制横屏、全屏且只加载本地 `www` 文件。

当前仓库生成的是可编译源，不是 APK：本机未检测到 Java、Gradle、Android SDK 或 ADB，也未执行真机安装。

在具备 Android 工具链的机器上：

```powershell
npm install
npx cordova platform add android
npx cordova build android
```

首次编译前请安装并配置 JDK 17、Android SDK 与对应的 Build Tools。
