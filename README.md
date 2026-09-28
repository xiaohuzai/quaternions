# 蛋白质的骨架与角 · 交互式 3D 图解

**在线阅读：<https://xiaohuzai.github.io/quaternions/>**

一个纯静态、无构建的交互式 3D 讲解页：把蛋白质主链与残基的各个角「转」明白——
二面角、φ/ψ/ω、χ 侧链角、拉马钱德兰图，以及 AlphaFold 的输出表示
（t、q 与 (cos,sin) 扭转角编码）。

## 内容目录

| 章节 | 内容 | 形式 |
| --- | --- | --- |
| 01 | 主链是什么：N–Cα–C 重复、肽键、羰基 O | 图文 + 主链 SVG |
| 02 | 二面角：四个原子绕中间键转 | 3D 演示（可拖）+ SVG |
| 03 | φ、ψ、ω：主链的三个角 | 骨架折叠机（φ/ψ/ω/χ 实时重建、定义高亮）+ 拉马钱德兰图联动 |
| 04 | χ：侧链角与 rotamer | 图文 + 残基对照表 |
| 05 | 残基身份证：t、q 与 7×2 个数 | 3D + (cos,sin) 单位圆演示 |
| 06 | 从角到三维结构（NeRF 重建、预测迭代） | 3D 演示 |
| 07 | 速查表 | 公式卡 |
| 附录 | 四元数速成：三种表示 / q≡−q / 万向节锁 | 3 个 3D 演示 |

每个演示都可以拖拽旋转视角，Ctrl/⌘ + 滚轮（或触屏双指）缩放，右键拖拽平移，双击复位视角
（普通滚轮保留给页面滚动；触屏上竖向滑动翻页、横向滑动转视角）。

## 本地预览

ES modules 不能跑在 `file://` 下，任意静态服务器即可：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 结构

```
index.html            页面结构与全部文案
style.css             设计系统（深色观测台主题）
js/backbone-geom.js   骨架几何内核：NeRF 原子放置、链构建、网格工厂（共享）
js/scene-kit.js       共用机制：场景工厂、小飞机 gizmo、四分量读数条、世界轴
js/hero.js            首屏：残基骨架链
js/demo-dihedral.js   02 节二面角演示
js/demo-backbone.js   03 节骨架折叠机（含扭转角高亮）
js/ramachandran.js    03 节拉马钱德兰图（与 φ/ψ 滑块双向联动）
js/demo-af.js         06 节预测更新演示
js/demo-circle.js     05 节 (cos,sin) 单位圆
js/demo-translate.js  附录·三种表示同步翻译
js/demo-halfangle.js  附录·q ≡ −q 双覆盖
js/demo-gimbal.js     附录·万向节锁
vendor/               three.slim.js（按实际用到的符号树摇过的 Three.js）+ OrbitControls，无 CDN 依赖
fonts/                Fraunces 可变字体（Latin 子集）
```

除 Three.js 与 Fraunces 字体外无任何运行时依赖；GitHub Pages 直接托管，无构建步骤。

## License

MIT
