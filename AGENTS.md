# AGENTS.md

## 项目是什么

纯静态、无构建的单页交互式 3D 讲解站：「一个残基，21 个数」——蛋白质骨架刚体变换（t + 四元数 q）与扭转角（ω φ ψ χ₁~χ₄）。线上地址 <https://xiaohuzai.github.io/quaternions/>。

- 没有 package.json、没有 npm 依赖、没有 lint、没有测试框架。
- 全部文案写在 `index.html` 里；`style.css` 是深色观测台主题的设计系统。
- 文案、代码注释、commit message 一律中文。commit 风格：`feat:` / `fix:` / `docs:` + 中文描述。

## 发布与验证

- **push 到 main = 发布**：GitHub Pages 直接从 main 分支根目录服务（legacy build，无 CI）。推送后约 1 分钟生效，可用 `curl https://xiaohuzai.github.io/quaternions/<文件>?cb=$(date +%s)` 验证线上内容。
- 本地预览：`python3 -m http.server 8000`（ES modules 不能跑在 `file://` 下）。
- 语法检查：`node --input-type=module --check < js/某文件.js`。
- 改完最好用浏览器打开本地页面，确认 console 无报错、对应演示能交互。

## 架构分层（自下而上，不要反向依赖）

1. `vendor/three.slim.js` + `vendor/OrbitControls.js` — **手工树摇过的 Three.js 单行压缩文件，不要编辑**。页面用 importmap 把裸导入 `'three'` 映射到它，无 CDN。
2. `js/scene-kit.js` — 共用 3D 机制：`createScene`（按需渲染）、`animate`、色板 `C`、`buildGizmo`、`quatReadout`、`vecArrow`、`textSprite`、`REDUCED_MOTION`、`DEG`。
3. `js/backbone-geom.js` — 骨架几何内核：NeRF 原子放置 `placeAtom`、链构建 `computeChain`/`computeBackbone`、残基坐标架 `residueFrame`、网格工厂 `makeAtom`/`makeBond`/`setBond`、原子色表 `COL`、键长键角常量 `BOND`/`ANGLE`（Engh–Huber 近似）。几何部分是无 DOM 的纯函数。
4. `js/demo-*.js`、`hero.js`、`ramachandran.js` — 每个演示一个模块，导出 `initXxx()`；从 `index.html` 的 `[data-demo="名字"]` 容器取 canvas 和控件。
5. `js/main.js` — 装配入口：逐个调用 init，**每个演示用 try/catch 独立容错**，一个挂了不连坐整页。新增演示要在这里登记。

## 关键约定与坑

- **three.slim.js 是树摇过的**：新代码用到某个 Three 符号前，先确认它已被打进 slim 版（`grep -o "符号名" vendor/three.slim.js`），否则运行时是 undefined。缺了就换已有符号实现，或重新树摇 vendor 文件。
- **按需渲染**：`createScene` 返回的 `invalidate()` 必须在任何场景改动后调用，否则画面不更新。
- **Group 局部系**：往挂了四元数的 Group 里放子对象时，世界坐标偏移必须先乘组的四元数之逆（demo-af.js 曾因此把原子转了两次）。
- **四元数乘法顺序有语义**：`q ⊗ Δq`（右乘）= 局部/物体系扰动，`Δq ⊗ q` = 世界系。页面公式与代码必须一致，THREE 里 `a.multiply(b)` 是 a⊗b（a 被改写，注意先 `.clone()`）。
- **肽基平面刚性是全站教学红线**：任何演示里 ω 都不得偏离 180°、肽键不得伸缩。相邻刚体各自独立随机旋转必然把共享肽平面折坏（数学上无解），所以 demo-af 的「预测更新」用 φ/ψ 铰链小旋转 + NeRF 整链重建实现，铰链旋转沿链向 C 端传播，t、q 由重建结果写回。
- **统一配色**：四元数分量白=w、红/绿/蓝=i/j/k（`scene-kit.js` 的 `C`）；原子色 N=蓝、Cα=骨白、C=黄铜、O=红、S=绿（`backbone-geom.js` 的 `COL`）。新演示沿用，不要另起色板。
- **交互约定**（全站一致）：拖拽旋转、Ctrl/⌘+滚轮缩放（普通滚轮留给页面滚动）、右键拖平移、双击复位；触屏竖滑翻页、横滑转视角。这些在 `createScene` 里已实现。
- 尊重 `prefers-reduced-motion`（`REDUCED_MOTION`，自动旋转等入场动效据此关闭）。
- 2D 演示（demo-circle、ramachandran）用原生 canvas 2D，不引入 Three；注意 `devicePixelRatio` 适配（上限 2）。

## 文档以哪里为准

- 每个 js 文件头部的中文注释是该演示的第一手文档（讲清演示意图和几何构造），改代码前先读、改完同步更新。
- `README.md` 的「结构」小节里各文件的章节编号已滞后（如 demo-af.js 实为 02 节），**以文件头注释和 README 内容目录表为准**；改章节归属时顺手修正 README。

## 统一样式与物理要求红线（改/加演示前必读）

用户明确要求：**所有 3D 可视化用一套样式，且各演示满足的物理/教学要求必须一致**。落地为：

- **样式唯一源 = `backbone-geom.js` 的表**：`COL`（球色，含 H）、`RAD`（球径，约定 Cα 最大）、`BOND_R`/`BOND_R_H`（键径）、`DBL`（双线线径与间距）、`BCOL`（键色）；四元数/轴色板在 `scene-kit.js` 的 `C`。分子演示（hero/backbone/peptide/af）一律取表，半尺场景统一乘场景缩放（见 demo-af 的 `SCALE`），禁止私写硬值。
- **双线键统一走 `makeBondPair`/`setBondPair`**：羰基 C=O = 红色双线、肽键 C–N = 琥珀双线；这两根键在任何演示里都不得画成单线（折叠机与 hero 曾漏过肽键，已补）。
- **铰链轴色全站统一**：φ = 绿 `0x54b06a`、ψ = 蓝 `0x5c7cf0`、ω = 红 `0xe5626a`（肽键演示的铰链小标/轴杆、预测更新的铰链套管与度数小标都用这套）。
- **几何常量只从 `BOND`/`ANGLE` 取**（含 `nH`/`ncO`/`cnH`）；基准布局不得手抄近似数。
- **ω 全站锁死 180°**：需要「试转 ω」的地方统一弹性方案——撬开 ±15° 后弹回（肽键演示按钮、折叠机 ω 滑块 min=165），禁止自由转 ω。
- 示意图类演示（frame/dihedral/gizmo/gimbal/halfangle）可以有自有的比例尺度，但球色/键色必须用共享表，且保持 Cα 球径最大的约定。
