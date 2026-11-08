# 版本管理与回滚

正式项目文件是 `game.json`。GDevelop 项目、源码、测试、构建脚本和美术源文件均纳入 Git；测试运行证据、预览项目、自动保存和临时候选文件不提交。

## 每次修改前的基线

```powershell
git status
git diff --stat
git switch -c feature/<简短功能名>
```

如果 `git status` 显示意外文件，先确认它是否是 GDevelop 自动保存、候选预览或测试产物。不要直接覆盖未提交的编辑器改动。

## 每次修改后的提交

确认 GDevelop 能打开项目、核心预览可运行且相关测试完成后：

```powershell
git add game.json src tests scripts assets art-source README.md docs
git diff --cached --stat
git commit -m "fix: 描述本次实际改动"
git push
```

每个提交只处理一个可验证主题。大型地图、HUD、敌人 AI、武器和美术资源应分别提交，便于定位回归和选择性回滚。

## 回滚

查看历史：

```powershell
git log --oneline --decorate
git show --stat <提交号>
```

恢复单个文件到某个历史提交：

```powershell
git restore --source=<提交号> -- game.json
```

撤销尚未提交的改动之前，先保留现场：

```powershell
git diff > 临时改动.patch
git restore game.json
```

GDevelop 关闭后再执行恢复。重新打开项目并验证场景后，再提交恢复结果。

## 线上仓库

本地基线建立后，可用一个空仓库作为远端：

```powershell
git remote add origin <仓库地址>
git branch -M main
git push -u origin main
```

线上仓库应设为私有，至少用于备份完整提交历史。禁止提交账号令牌、`.env`、GDevelop 登录信息或儿童个人信息。

## 当前保留策略

- `game.json`：始终提交正式版本。
- `src/`、`tests/`、`scripts/`：提交。
- `assets/`、`art-source/`：提交本地游戏所需的正式与源美术文件。
- `game.before-*.json`、`game.v*.json`：保留在本地供快速对照，由 Git 提交历史承担长期版本保存。
- `evidence/`、`previews/`、`gameplay-test-screenshots/`：运行时生成，不提交。
