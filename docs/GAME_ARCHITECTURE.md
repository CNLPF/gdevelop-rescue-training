# 《机甲伙伴》底层架构与变量字典

本文说明当前 `RescueBase` 与 `TrainingRoom` 的实际实现。目标是让后续手工修改地图、扩展敌人或武器时，能判断哪些数据由 GDevelop 编辑器直接决定，哪些逻辑仍依赖项目配置。

## 1. 数据权威关系

### 1.1 `game.json` 是当前项目和运行行为的权威

`game.json` 同时保存：

- 布局，即场景名称、层、相机和事件组；
- 平台、墙、门、金币、敌人、商店、传送门的位置与尺寸；
- 对象定义、动画、碰撞遮罩和初始实例变量；
- 每个实例的 `initialVariables`；
- 场景变量；
- 嵌入事件中的 JavaScript。

因此，用户在编辑器中移动平台、增删敌人或修改实例变量并保存后，下一次逻辑修改必须以新的 `game.json` 为起点。

### 1.2 `src/` 是可读源码和测试入口，不自动同步到编辑器

`src/base/`、`src/shared/` 等目录保存构建前的可读代码。它们与预览运行之间没有文件监听关系：

```text
编辑 src/*.js
    ↓ 不会自动发生
已有 game.json 中的内嵌事件更新
```

当前项目需要构建脚本把源码写入 `game.json`。但旧生成器也会按 `src/base/config.js` 中的历史坐标重建场景实例。用户开始直接在编辑器中维护地图后，不能为了更新一段事件代码而直接运行该生成器，否则可能覆盖新版地图。

### 1.3 当前安全边界

手工地图阶段可以使用：

```powershell
node .\scripts\inspect-game-json.cjs --scene=RescueBase --ids
node .\scripts\inspect-game-json.cjs --scene=RescueBase --details
```

检查器只读取文件，不写回项目。它检查场景结构、关键实例、稳定 `Id`、重复 `Id` 和关键场景变量。

不要对已手工编辑的地图直接运行：

```powershell
node .\scripts\build-base.cjs
node .\scripts\build-base.cjs --check
node .\scripts\build-base.cjs --output=game-preview.json
```

后两条虽然不覆盖正式文件，也会在内存中从旧 `BASE` 配置重建地图，因此不能用来证明编辑器里的新版地图有效。

## 2. 场景和事件结构

两个布局均使用五层，从后到前为：

```text
默认层 → Gameplay → Effects → HUD → Modal
```

- `Gameplay`：玩家、平台、墙、敌人、金币、门、商店和主要交互对象。
- `Effects`：子弹、闪光、效果和需要跟随游戏世界的内容。
- `HUD`：固定屏幕坐标的生命、金币、武器、进度和阶段提示。
- `Modal`：商店、返回菜单、重开确认和完成卡。
- `默认层`：保留给 GDevelop 默认对象或后续背景，不应存放需要相机跟随的玩法对象。

每个布局有 8 个事件组，按职责组织：

1. `00`：初始化、时间和共享模块。
2. `01`：输入、移动、跳跃和武器输入。
3. `02`：敌人 AI、攻击和随机增援。
4. `03`：弹丸、导弹追踪、遮挡和统一伤害。
5. `04`：金币、掉坑、返回传送点和世界运动。
6. `05`：阶段推进、门、中继核心和出口。
7. `06`：HUD、商店、菜单和完成记录。
8. `07`：美术代理；此组不应改变玩法状态。

`RescueBase` 的每帧主流程是：

```js
beginFrame();
input();
enemyAI();
projectiles();
world();
progress();
presentation();
```

顺序很重要：

- `beginFrame()` 先更新时间和模式。
- `input()` 处理输入和武器。
- `enemyAI()` 在弹丸前更新敌人位置和攻击。
- `projectiles()` 用本帧位置结算命中。
- `world()` 收金币、检测接触、掉坑和传送门解锁。
- `progress()` 根据当前状态推进区域和开门。
- `presentation()` 最后同步 HUD、文字、相机和视觉反馈。

`RescueBase` 初始化时创建运行时对象：

```js
runtimeScene.__rescue = createBase(runtimeScene, Rules);
```

`TrainingRoom` 在此基础上再调用：

```js
attachTrainingAerial(runtimeScene.__rescue);
```

## 3. 帧、模式与暂停

### 3.1 时间

每帧真实时间先被限制为最多 `0.05` 秒：

```js
dt = Math.min(realDeltaSeconds, 0.05);
```

这样可以避免浏览器卡顿后角色穿过平台、子弹越墙或冷却一次跳过多个周期。暂停时逻辑时间不增长，商店切换和返回菜单不会偷偷推进敌人。

### 3.2 `GameMode`

`RescueBase.GameMode` 的状态：

| 值 | 含义 | 世界是否运行 |
|---|---|---|
| `Playing` | 正常操作 | 是 |
| `Shop` | 商店菜单 | 否 |
| `Portal` | 返回捷径列表 | 否 |
| `Respawning` | 掉坑后的短暂返回 | 否 |
| `RestartConfirm` | R 打开的确认框 | 否 |
| `Restarting` | 正在切换新局 | 否 |
| `Complete` | 抵达出口后的完成卡 | 否 |

只有 `Playing` 接受移动、跳跃、射击和敌人 AI。`presentation()` 仍会在暂停时更新界面，因此玩家能看见菜单和当前数据。

### 3.3 `Stage`

`RescueBase.Stage` 是关卡推进状态：

```text
Entry → Corridor → Supply → Shield → Energy → Aerial → Rescue
```

推进只前进，不因掉坑回退。需要特别注意：`Stage` 当前不只由玩家位置判断，还读取 `BASE.zones`、`BASE.enemies` 和固定门的旧配置。

## 4. 玩家、输入与二段跳

### 4.1 输入职责

| 按键 | 行为 |
|---|---|
| ← / → | 水平移动和转身 |
| 空格 | 跳跃；松开后再次按下触发二段跳 |
| W | 当前武器的主要操作 |
| Q | 只在已拥有武器之间循环 |
| E | 靠近商店、武器箱、训练靶、传送门或出口时交互 |
| 方向键 / Enter / Esc | 菜单选择、确认和关闭 |
| R / Enter / Esc | 重开确认、确认新局和取消 |

输入模块把“本帧刚按下”与“持续按住”分开。`pressed` 是边沿事件，适合重开、切枪和一次性确认；持续按住只用于移动和部分武器输入。

### 4.2 角色物理

玩家使用 GDevelop 原生 Platformer 行为，主要参数保持：

- 碰撞框约 `40 × 56`；
- 重力 `1800 px/s²`；
- 跳跃初速度 `720 px/s`；
- 最大水平速度 `240 px/s`；
- `JumpCount=0`：地面跳可用；
- `JumpCount=1`：地面跳已使用，空中跳可用；
- `JumpCount=2`：两跳都已使用；
- coyote 离地宽限约 `0.10 s`；
- jump buffer 跳跃缓冲约 `0.12 s`。

运行时还有两个不在场景变量中的布尔状态：

- `jumpPending`：阻止长按空格自动连续跳；
- `inAirJumpAvailable` 的等价判断由 `JumpCount` 完成。

完成一次空中二段跳时记录 `DoubleJumpDone=true` 和 `DoubleJumps`。这既用于入口教学门，也用于完成卡事实记录。

### 4.3 移动和边界

`move()` 统一处理：

- 水平输入；
- 面向方向；
- Platformer 水平速度；
- 跳跃缓冲；
- 离地宽限；
- 二段跳；
- 动画或视觉代理切换。

地图实例位置直接决定脚下是否有平台，但玩家的世界水平边界仍使用历史配置 `BASE.width=8400`。如果地图扩展到更宽，必须同步调整运行边界，否则玩家不能进入新区域。

## 5. 武器系统

### 5.1 三把武器的状态

`CurrentWeapon` 只能取：

```text
Energy | Cannon | Missile
```

拥有和升级状态分别保存：

- `EnergyUpgraded`；
- `HasCannon`、`CannonUpgraded`；
- `HasMissile`、`MissileUpgraded`。

Q 的循环只包含已拥有的武器：

```text
Energy
Energy → Cannon
Energy → Cannon → Missile
```

未拥有穿盾炮或导弹时，Q 只显示取得方式的反馈。

### 5.2 每种武器的操作

| 武器 | W 行为 | 伤害 | 主要限制 |
|---|---|---|---|
| 能量枪 `Energy` | 按住连射 | 基础 1，升级 2 | 0.30 秒间隔，射程 600 |
| 穿盾炮 `Cannon` | 按住蓄力，松开发射 | 未满 1／2；满蓄力 4／8 | 满蓄力才能穿盾，射程 480 |
| 制导导弹 `Missile` | 按住锁定，松开发射 | 锁定 3／5；未锁定 1／2 | 0.55 秒锁定，射程 720 |

切枪、进入商店、返回菜单、掉坑和死亡都会调用 `cancelCharge()`：

- 清空 `Charge`；
- 清空 `MissileLockProgress`；
- 清空 `MissileTargetId`；
- 设置 `fireLocked=true`。

恢复 `Playing` 后，W 必须松开再按一次，避免菜单操作意外发射。

### 5.3 自动瞄准

所有武器共用同一套候选筛选和评分，因此准星和武器目标不会各自跳来跳去。候选必须同时满足：

1. 目标类型属于可瞄准集合；
2. 目标生命大于 0；
3. 若实例有 `Active`，必须为 `true`；
4. 目标位于玩家面向的一侧；
5. 目标在武器射程内；
6. 从玩家到目标上半身的线段没有被墙、平台或门遮挡。

候选评分：

```text
score = distance + 0.75 × verticalDistance
```

横向近距离目标略优先，但明显更容易命中的高空目标仍可能胜出。当前目标有 20% 粘性：另一个候选至少要改善评分 20%，准星才切换。这减少飞行敌人浮动时准星抖动。

无目标时，武器仍沿玩家面向水平射击。

### 5.4 导弹追踪

导弹在发射瞬间保存：

- `Bullet.Locked`：是否取得完整锁定；
- `Bullet.TargetId`：锁定目标的稳定实例 `Id`；
- `Bullet.Weapon='Missile'`；
- `Bullet.Damage`；
- `Bullet.PierceShield=false`。

锁定目标存活时，导弹按 `240°/s` 转向追踪。目标死亡后，`Locked` 被清除，导弹继续沿当前方向飞行到射程结束。导弹仍然不能穿墙，也不会穿透多个敌人。

## 6. 弹丸与统一伤害

### 6.1 连续运动碰撞

玩家子弹和敌方子弹都保存 `Vx`、`Vy`，逐帧计算从旧位置到新位置的线段。对墙、平台、门和可受伤对象做线段与矩形求交，选择最早的命中。

这样可避免高速弹丸在一帧内越过薄墙。命中后会立即删除弹丸，确保一颗子弹只结算一次。

### 6.2 `damageTarget()`

统一伤害入口按以下顺序执行：

1. 检查目标生命；
2. 对 `JammerCore` 检查武器是否必须是 `Missile`；
3. 对 `Shield` 检查命中方向和 `PierceShield`；
4. 扣血；
5. 增加总命中及对应武器命中；
6. 播放受击反馈；
7. 目标死亡时进入专用结算；
8. 只有固定敌人死亡才创建三枚奖励金币；
9. 删除对象。

奖励账本先查 `DefeatedEnemies[Enemy.Id]`，因此重复碰撞不会重复奖励。

### 6.3 护盾

盾牌朝向按 `Facing` 判断：

- `Facing=1`：正面在右侧；
- `Facing=-1`：正面在左侧；
- 命中侧为正面且 `PierceShield=false`：格挡；
- 满蓄力穿盾炮：`PierceShield=true`，正面也可伤害；
- 导弹不会穿盾，但可从背后伤人。

## 7. 敌人 AI

### 7.1 五类敌人的统一状态机

```text
观察玩家 → 靠近或保持距离 → 检查攻击条件
→ Warning 内部计时 → Attack → Recover → 新周期
```

`Warning` 是内部等待状态，不会自动创建屏幕上可见的瞄准线或落点标记。当前玩家侧不显示引导线。

共同流程：

1. 计算水平、垂直和直线距离；
2. 在 `chaseRange` 内接近玩家；
3. 临近 `standoffDistance` 时停止或后退；
4. 超出 `chaseRange` 或超出区域边界时返回出生位置；
5. 检查当前画面、距离、垂直范围、遮挡和暂停；
6. `Cooldown` 递减；
7. 条件满足时进入内部 `Warning`；
8. 发射前再次检查条件；
9. 离屏、遮挡、暂停或距离失效时取消本次攻击；
10. 成功攻击后记录攻击次数并重新开始冷却。

### 7.2 各类敌人的差异

| 对象 | 生命 | 行为重点 | 攻击 |
|---|---:|---|---|
| `Patrol` | 2 | 地面追击，区域边界内移动 | 面向玩家发射非追踪弹 |
| `Turret` | 4 | 较慢靠近，保持距离 | 发射较快冷却的非追踪弹 |
| `Shield` | 8 | 地面追击；正面盾牌；转向有延迟 | 主动射击 |
| `ScoutDrone` | 3 | 水平、垂直接近，在 `HoverY` 附近浮动 | 画面内发射非追踪弹 |
| `ArmoredDrone` | 10 | 较慢，空中接近，攻击后恢复较久 | 在玩家当时位置投垂直炸弹 |

装甲无人机在预警开始记录 `AttackX`，随后在该世界 X 投弹。攻击前会重新验证画面和距离，因此飞离画面后不会延迟补发子弹。

### 7.3 随机增援

随机增援不是完全随机的坐标，而是“受控生成”：

- 最多同时 3 名动态敌人；
- 只从配置中的安全站点选择；
- 只出现在允许的战斗区；
- 与玩家至少间隔 220 像素；
- 生成计时和敌人攻击在菜单暂停；
- 使用确定性随机序列，课堂演示可以复现；
- 动态敌人正常移动、攻击和受伤，但死亡奖励为 0，避免无限刷金币。

## 8. 金币、菜单、失败和新局

### 8.1 金币账本

地图金币和敌人奖励使用同一个 `Coin` 对象类型，通过 `Reward` 区分来源：

```text
Coin.Id + Reward=false → MapCoinsCollected
Coin.Id + Reward=true  → RewardCoinsCollected
```

`CollectedCoins[Coin.Id]` 防止同一金币重复领取。场景变量 `Coins` 是当前余额，`CoinsCollected` 是本局收入，`CoinsSpent` 是本局支出。

### 8.2 商店

商店打开时：

- `GameMode='Shop'`；
- 移动、敌人、弹丸、冷却和随机增援冻结；
- 方向键移动选择；
- Enter 购买；
- Esc 返回。

购买统一经过 `basePurchase()`，先检查持有状态、武器前置、满血、金币和商店库存，再一次性扣款。长按 Enter 不会跨帧重复购买，因为输入模块只处理按键边沿。

每处补血通过 `ShopStock[Shop.Id]` 记录一次购买，防止同一商店重复补血。

### 8.3 掉坑

玩家掉出地图后：

- 进入 `Respawning`；
- 约 0.45 秒后回到 `(80,504)`；
- 不扣生命；
- 保留金币、敌人生命、已击败状态、门和阶段；
- 清除敌方弹丸；
- 所有存活敌人攻击冷却恢复到 0.8 秒；
- 玩家得到 1.2 秒保护。

### 8.4 生命耗尽和 R 确认的新局

开启新局时：

1. 当前未消费余额写入全局 `RescueWallet`；
2. 设置 `RescueCarryWallet=true`；
3. 重载 `RescueBase`；
4. 保留未消费余额；
5. 敌人、地图金币、武器、升级、门、传送门和商店库存恢复；
6. 已消费金币不会退回。

余额只在本次预览进程内跨局保持，不跨关闭游戏保存。

## 9. 场景变量字典

场景变量是跨模块、跨帧的公开状态。以下列表以 `RescueBase` 为主；`TrainingRoom` 复用其中大部分，并保留教学阶段变量。

### 9.1 生命周期、模式和进度

| 变量 | 类型 | 作用 |
|---|---|---|
| `GameMode` | string | 当前运行模式 |
| `Stage` | string | 当前区域推进阶段 |
| `Completed` | boolean | 是否抵达出口 |
| `ElapsedSeconds` | number | 实际行动时间；菜单暂停 |
| `CheckpointX` / `CheckpointY` | number | 当前环境配置的检查点数值；实际掉坑入口目前仍硬编码 |

### 9.2 生命和失败

| 变量 | 类型 | 作用 |
|---|---|---|
| `Health` | number | 3 格生命 |
| `DamageTaken` | number | 有效受伤次数 |
| `Retries` | number | 掉坑次数，不包含新局次数 |

无敌时间、闪烁和受伤保护保存在运行时 `invulnerable`，不是持久场景变量。

### 9.3 跳跃

| 变量 | 类型 | 作用 |
|---|---|---|
| `JumpCount` | number | 0 地面跳可用、1 空中跳可用、2 全部用完 |
| `DoubleJumpDone` | boolean | 本局是否实际完成一次空中二段跳 |
| `Jumps` | number | 跳跃动作累计次数 |
| `DoubleJumps` | number | 二段跳累计次数 |
| `CoyoteRemaining` | number | 离地宽限的可观察值 |
| `JumpBufferRemaining` | number | 跳跃缓冲的可观察值 |

`jumpPending`、`facing` 和部分身体速度由运行时对象持有，不会在场景变量面板中显示。

### 9.4 金币和购买

| 变量 | 类型 | 作用 |
|---|---|---|
| `Coins` | number | 当前余额 |
| `WalletAtStart` | number | 本局带入余额 |
| `CoinsCollected` | number | 本局总收入 |
| `CoinsSpent` | number | 本局总支出 |
| `MapCoinsCollected` | number | 本局地图金币收入 |
| `RewardCoinsCollected` | number | 本局敌人奖励金币收入 |
| `TrialCoinsEarned` | number | 导弹补给试炼收入 |
| `Purchases` | number | 成功购买总次数 |
| `UpgradesBought` | number | 武器升级购买次数 |
| `HealsBought` | number | 补血购买次数 |
| `MissileBought` | number | 本局购买导弹是否发生 |
| `TrialRound` | number | 试炼重置轮数 |
| `Teleports` | number | 返回捷径使用次数 |
| `CollectedCoins` | structure | 金币稳定 Id 领取账本 |
| `ShopStock` | structure | 各商店一次性商品库存 |

### 9.5 武器、瞄准和射击

| 变量 | 类型 | 作用 |
|---|---|---|
| `CurrentWeapon` | string | 当前装备武器 |
| `HasCannon` | boolean | 是否已领穿盾炮 |
| `HasMissile` | boolean | 是否已购买导弹 |
| `EnergyUpgraded` | boolean | 能量枪升级 |
| `CannonUpgraded` | boolean | 穿盾炮升级 |
| `MissileUpgraded` | boolean | 导弹升级 |
| `Charge` | number | 当前蓄力或锁定秒数 |
| `MissileLockProgress` | number | 导弹锁定可观察进度 |
| `MissileTargetId` | string | 当前导弹锁定目标 |
| `AimTarget` | string | 当前自动瞄准目标可观察值 |
| `ShotsFired` | number | 全部玩家射击次数 |
| `Hits` | number | 全部玩家命中次数 |
| `EnergyShots` / `EnergyHits` | number | 能量枪发射／命中 |
| `CannonShots` / `CannonHits` | number | 穿盾炮发射／命中 |
| `MissileShots` / `MissileHits` | number | 导弹发射／命中 |
| `MissileLockedShots` | number | 取得锁定的导弹发射数 |
| `ChargedShots` | number | 满蓄力穿盾炮发射数 |
| `ShieldBlocks` | number | 护盾格挡次数 |
| `JammerBlocks` | number | 普通武器攻击中继核心被拒绝次数 |

运行时状态还包括 `charging`、`charge`、`fireCooldown`、`facing`、`aimTargetId`、`missileTargetId` 和 `fireLocked`。它们用于每帧计算，场景变量保留的是可展示、可测试或需要跨事件读取的值。

### 9.6 敌人和随机增援

| 变量 | 类型 | 作用 |
|---|---|---|
| `EnemiesDefeated` | number | 固定敌人击败总数 |
| `PatrolDefeated` | number | 巡逻机器人击败数 |
| `TurretDefeated` | number | 炮台击败数 |
| `ShieldDefeated` | number | 护盾守卫击败数 |
| `ScoutDroneDefeated` | number | 侦察无人机击败数 |
| `ArmoredDroneDefeated` | number | 装甲无人机击败数 |
| `JammerCoresDefeated` | number | 中继核心击败数 |
| `JammerCoreDefeated` | boolean | 最终闸门解锁条件 |
| `EnemyShots` | number | 敌方攻击总数 |
| `PatrolAttacks` / `TurretAttacks` | number | 两类地面敌人攻击次数 |
| `ShieldAttacks` | number | 护盾守卫攻击次数 |
| `ScoutDroneAttacks` | number | 侦察无人机攻击次数 |
| `ArmoredDroneAttacks` | number | 装甲无人机攻击次数 |
| `TrialTargetsDefeated` | number | 补给浮标击破数 |
| `DefeatedEnemies` | structure | 固定敌人稳定 Id 奖励账本 |
| `ReinforcementsEnabled` | boolean | 是否允许随机增援 |
| `ReinforcementTimer` | number | 距离下一次增援的秒数 |
| `ReinforcementSequence` | number | 已执行的增援选择序号 |
| `ReinforcementSeed` | number | 本次预览的确定性随机种子 |
| `ReinforcementsSpawned` | number | 已生成动态敌人数 |
| `ReinforcementsDefeated` | number | 已击败动态敌人数 |
| `TrialPaid` | structure | 浮标奖励防重账本 |
| `UnlockedPortals` | structure | 返回捷径解锁账本 |

### 9.7 `TrainingRoom` 的教学变量

除共享变量外，训练房还使用：

| 变量 | 作用 |
|---|---|
| `StageAdvanceCount` | 教学阶段实际推进次数 |
| `DummyHits` | 训练靶命中次数 |
| `DummyHealth` / `DummyDestroyed` | 训练靶展示状态 |
| `UpgradedDummyHit` | 是否用升级形态完成独立判断 |
| `UpgradePurchased` / `WeaponForm` | 旧训练流程兼容字段 |
| `UpgradedHits` | 升级射击命中数 |

训练房 `Stage` 值不是救援基地的七个区域，而是自己的教学阶段，例如 `Jump`、`Combat`、`Purchase`、`Compare`、`Finish`。不要把两个布局的 `Stage` 字符串混用。

## 10. 对象与实例变量

### 10.1 每个实例变量都由哪一层提供

GDevelop 变量的优先级应这样理解：

```text
对象定义默认值
    ↓ 被覆盖
场景实例 initialVariables
    ↓ 运行时修改
当前实例变量值
```

场景里的 `Patrol` 实例通常覆盖 `Id`、位置、生命、巡逻边界和区域。运行时再修改 `Health`、`Facing`、`Cooldown`、`Warning`、`Flash`。

### 10.2 五种敌人共用字段

| 变量 | 类型 | 含义 |
|---|---|---|
| `Id` | string | 稳定逻辑 Id；不得重复 |
| `Health` | number | 当前生命 |
| `Active` | boolean | 是否可被瞄准；中继核心未解锁时为 false |
| `SpawnX` / `SpawnY` | number | 出生位置、返回位置和奖励掉落参考 |
| `MinX` / `MaxX` | number | 水平巡逻或区域边界 |
| `Direction` | number | 当前移动方向 |
| `Facing` | number | 当前视觉和盾牌朝向 |
| `DesiredFacing` | number | 希望转向的方向 |
| `TurnCooldown` | number | 转向前的延迟 |
| `Cooldown` | number | 距离下一次攻击的秒数 |
| `Tempo` | number | 攻击周期倍率；数值越小压力越高 |
| `Warning` | boolean | 内部攻击准备状态 |
| `AttackX` | number | 装甲无人机保存的投弹目标 X |
| `HoverY` | number | 飞行敌人的基准高度 |
| `Phase` | number | 浮动相位，防止敌人同步摆动 |
| `DropY` | number | 奖励金币生成高度 |
| `Zone` | string | 所属逻辑区域 |
| `Flash` | number | 受击闪烁剩余时间 |
| `Dynamic` | boolean | 是否由随机增援创建 |
| `Reinforcement` | boolean | 动态增援兼容标记 |
| `SiteKey` | string | 动态增援占用站点，防止同站点重叠 |

编辑器中新建敌人时，最容易遗漏的是 `Id`、`SpawnX/Y`、`MinX/MaxX`、`Zone` 和 `Cooldown`。只复制图片而不复制这些变量，会出现可显示但不可正确结算的实例。

### 10.3 `Bullet`

| 变量 | 类型 | 含义 |
|---|---|---|
| `Vx` / `Vy` | number | 当前速度分量 |
| `Distance` | number | 已飞行距离 |
| `Range` | number | 最大飞行距离 |
| `Damage` | number | 本次命中伤害 |
| `Upgraded` | boolean | 旧训练兼容字段 |
| `Weapon` | string | `Energy`、`Cannon` 或 `Missile` |
| `PierceShield` | boolean | 本次命中是否可穿正面盾 |
| `Locked` | boolean | 导弹是否具有有效制导 |
| `TargetId` | string | 导弹锁定的敌人稳定 Id |

### 10.4 `EnemyBullet`

| 变量 | 类型 | 含义 |
|---|---|---|
| `Vx` / `Vy` | number | 敌方弹丸速度 |
| `Distance` | number | 已飞行距离 |
| `Range` | number | 最大射程 |
| `Weapon` | string | 攻击来源统计标签 |

### 10.5 金币和固定设施

| 对象 | 变量 | 含义 |
|---|---|---|
| `Coin` | `Id` | 领取防重稳定 Id |
| `Coin` | `Reward` | 是否为敌人奖励金币 |
| `Gate` | `Id` | 门逻辑标识 |
| `Shop` | `Id` | 商店库存和类型关联 |
| `ReturnPortal` | 无实例变量 | 位置由 `BASE.portals` 和历史 ID 组合管理 |

### 10.6 目标对象

| 对象 | 变量 | 含义 |
|---|---|---|
| `Dummy` | `Id` | 训练靶稳定标识 |
| `Dummy` | `Health` | 当前生命 |
| `Dummy` | `RoundHits` | 当前轮命中次数 |
| `Dummy` | `Flash` | 受击闪烁 |
| `TrialDrone` | `Id` | 试炼奖励防重标识 |
| `TrialDrone` | `Health` / `Active` / `Flash` | 浮标状态 |
| `JammerCore` | `Id` | 中继核心稳定标识 |
| `JammerCore` | `Health` / `Active` / `Flash` | 可锁定、受伤和解锁状态 |

### 10.7 不在场景变量面板中的运行时字段

`createRescue()` 返回的 `r` 对象还持有：

- `body`：Platformer 行为；
- `scene`：当前 GDevelop 场景；
- `player`：玩家实例；
- `dt`、`time`：本帧时间和累计行动时间；
- `coyote`、`buffer`、`jumpPending`：跳跃手感；
- `invulnerable`：受伤保护；
- `fireCooldown`、`charging`、`charge`：武器节奏；
- `facing`、`aimTargetId`、`missileTargetId`：瞄准；
- `fireLocked`：菜单恢复后要求先松开 W；
- `elapsed`：行动时间；
- `activeShop`、`menuIndex`：当前菜单；
- `labelMap`、`warningMap`：视觉和攻击状态辅助映射；
- `effects`：运行中动画对象；
- `ledger(name,id)`：结构账本访问器。

这些状态每帧计算，若把全部都做成场景变量会增加噪声；但需要被 HUD、完成卡或测试观察的值会同步到场景变量。

## 11. 地图编辑必须保持的契约

### 11.1 位置和尺寸可以直接编辑

用户在 GDevelop 中移动或缩放以下对象通常会直接影响运行时：

- `Terrain` / `Wall`：平台与阻挡；
- `Gate`：区域门；
- `Coin`：金币；
- 五类敌人：初始位置；
- `Shop`、`CannonCrate`、`Dummy`、`TrialDrone`、`JammerCore`、`Exit`。

但“能移动”不等于“所有逻辑都自动适应”。位置变化后仍需核对实例变量和配置区段。

### 11.2 稳定 Id

以下对象的 `Id` 必须在同一布局内唯一：

- 五类敌人；
- 地图金币；
- 门；
- 商店；
- 训练靶；
- 试炼浮标；
- 中继核心。

原因分别包括奖励防重、瞄准、商店库存、阶段推进和导弹锁定。重复 Id 会记错账本，导致金币不增加、奖励不发或两个对象共享状态。

### 11.3 敌人配置

新增固定敌人必须至少检查：

1. 对象类型是否参与统一 AI 管线；
2. `Id` 是否唯一；
3. `Health` 是否符合设计；
4. `SpawnX/Y` 是否与实例位置合理对应；
5. `MinX/MaxX` 是否包住巡逻区域；
6. `Zone` 是否与 `BASE.zones` 的区域 ID 一致；
7. `Cooldown`、`Tempo`、`HoverY` 是否合适；
8. 它是否应计入固定门清空条件。

### 11.4 金币

地图金币必须有唯一 `Id`，并保持 `Reward=false`。敌人奖励金币运行时创建，使用 `Reward=true`，不应在地图里手工复制。

### 11.5 商店

现有 `Shop.Id` 与 `BASE.shops` 的配置有关。标准商店和导弹商店的菜单内容不同；如果只改变实例 Id 而不更新配置，可能得到默认标准商店菜单或丢失导弹商店行为。

### 11.6 返回传送门

`ReturnPortal` 实例目前没有自己的实例变量。返回点、名称和解锁 X 来自 `BASE.portals`。手动移动实例时，若希望掉坑后返回位置也改变，要同步修改配置中的 x/y；否则画面位置和实际传送到点会不一致。

## 12. 仍与旧配置耦合的部分

当前地图实例是不完整的唯一权威。以下逻辑仍从 `src/base/config.js` 的历史 `BASE` 配置读取：

| 旧配置 | 当前用途 | 地图编辑后的风险 |
|---|---|---|
| `BASE.width` | 水平边界、相机、弹丸销毁 | 地图超过 8400 后无法进入或子弹提前销毁 |
| `BASE.zones` | 区域名称、目标文案、随机增援判定 | 区域范围与手工地图不一致时，HUD 和生成区错误 |
| `BASE.enemies` | 固定敌人 ID 和区域清空条件 | 新增或删除固定敌人后，门可能永远不开或提前开 |
| `BASE.reinforcements.sites` | 随机增援生成位置 | 新地图区域可能没有可用的安全站点 |
| `BASE.portals` | 解锁、返回坐标和名称 | 移动传送门实例不等于改变返回目的地 |
| `BASE.shops` | 商店 ID、类型与商品 | 新商店 ID 可能失去导弹商品逻辑 |
| `BASE.coins` | 构建旧地图和试炼统计假设 | 手工地图不会再通过该数组生成；完成卡分母也要同步 |
| `(80,504)` | 掉坑返回坐标 | 移动出生点后玩家仍回到旧位置 |
| 完成卡的 `/32` | 地图金币总数 | 地图金币数变化后分母失真 |
| 固定门 `openGate('...')` | 区域推进 | 门 Id 改名后找不到对应实例 |

这些耦合意味着当前地图可以手工美化、扩展和重排，但还没有达到“纯场景数据驱动”的程度。需要增加、删除或重新定义区域清空条件时，应同时改造事件逻辑和配置。

## 13. 复用边界

### 13.1 可以跨场景复用

- 武器配置、伤害、射速、射程和升级价格；
- 自动瞄准筛选、评分和粘性；
- 输入边沿与武器状态机；
- 统一伤害入口；
- 奖励和购买账本；
- 敌人 AI 的共同追击、距离和攻击条件；
- HUD 布局、资源映射、准星、充能条；
- 真实交互记录和完成卡字段。

### 13.2 应保持场景专属

- 平台和墙的坐标；
- 固定敌人及其区域；
- 门、商店、出口、背景与教学提示；
- 阶段推进条件和完成条件；
- 随机增援站点；
- 关卡文案和区域名称。

### 13.3 扩展前要确认的接口

新增系统前先固定以下契约：

1. 稳定 Id；
2. 新对象需要哪些实例变量与默认值；
3. 是否进入 `aimTargetTypes`；
4. 弹丸的 `Weapon` 字符串；
5. 伤害是否走 `damageTarget()`；
6. 奖励账本名称；
7. 暂停、切枪、掉坑和死亡时清理哪些运行状态；
8. HUD 与完成卡新增哪些可观察字段；
9. 地图编辑时哪些配置仍必须同步；
10. 最终需要哪些纯规则测试和真实预览测试。

## 14. 地图编辑后的推荐流程

1. 在 GDevelop 中编辑并保存。
2. 关闭编辑器，确保 `game.json` 完整写盘。
3. 运行 Git 状态，确认变更来自地图而不是自动保存副本。
4. 运行只读检查器：

```powershell
node .\scripts\inspect-game-json.cjs --scene=RescueBase --ids
node .\scripts\inspect-game-json.cjs --scene=RescueBase --details
```

5. 让 Codex 直接读取保存后的 `game.json`，不要先按历史地图重建。
6. 如果新增了固定敌人、区域边界、商店或传送点，先核对本文列出的旧配置耦合点。
7. 在 GDevelop 预览中验证碰撞、镜头、门、敌人生成和失败流程。
8. 最后运行不修改 `game.json` 的纯规则测试。

## 15. 当前验证边界

本文的变量、对象和事件说明基于当前仓库中的 `game.json` 与源码快照。文档本身不证明以下项目已通过本轮测试：

- 手工地图改动后的完整键盘通关；
- 新增敌人数与区域门条件的一致性；
- 掉坑坐标修改后的返回体验；
- 随机增援站点在地图重排后的可达性与公平性；
- GDevelop 预览和纯规则测试。

这些必须在实际地图保存后，按真实运行结果验证。
