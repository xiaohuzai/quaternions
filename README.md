# 一个残基，21 个数 · 蛋白质骨架变换与扭转角

**在线阅读：<https://xiaohuzai.github.io/quaternions/>**

一个纯静态、无构建的交互式 3D 讲解页，围绕 AlphaFold 的残基输出清单组织：
**骨架变换**（平移 t 3 个数 + 四元数 q 4 个数）与 **7 个扭转角**
（ω φ ψ + χ₁~χ₄，每个输出 (cos, sin) 二维向量 = 14 个数），共 21 个数。

## 内容目录

| 章节 | 内容 | 形式 |
| --- | --- | --- |
| 01 | 残基输出清单：两类共 21 个数 | 对比卡 + 主链 SVG |
| 02 | 第一类：骨架变换 t 与 q | 3D 预测更新演示 + q 的三种写法/q≡−q/万向锁三个演示 |
| 03 | 第二类的统一定义：扭转角 = 二面角 | 3D 演示（可拖）+ SVG |
| 04 | 骨架上的三个角：ω、φ、ψ | 骨架折叠机（定义高亮）+ 拉马钱德兰图联动 |
| 05 | 侧链的四个角：χ₁~χ₄ | 残基对照表 + rotamer |
| 06 | 每个角为什么是 2 个数：(cos,sin) 编码 | 单位圆演示 |
| 07 | 把 21 个数拼回三维结构 | 图文（NeRF） |
| 速查 | 按输出清单组织的公式卡 | — |

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
