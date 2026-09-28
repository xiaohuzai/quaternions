# quaternions · 四元数可视化指南

**在线阅读：<https://xiaohuzai.github.io/quaternions/>**

一个纯静态、无构建的交互式 3D 讲解页：用 Three.js 把四元数「转」明白——
从 Hamilton 刻在布鲁姆桥上的方程，到 AlphaFold 里蛋白质残基的坐标系。

## 内容目录

| 章节 | 内容 | 形式 |
| --- | --- | --- |
| 01 | 描述朝向的三种语言（欧拉角 / 旋转矩阵 / 四元数） | 对比卡 |
| 02 | 三个虚轴与乘法不可交换（ij = k，ji = −k） | 3D 演示：两条 90° 路径 |
| 03 | 一半的角度：q = [cos(θ/2), sin(θ/2)·n̂] 与 q ≡ −q 双覆盖 | 3D 演示：q 与 −q 双飞机 |
| 04 | 插值：欧拉角 / lerp / SLERP 三条路径与角度-时间曲线 | 3D 演示 + 2D 曲线图 |
| 05 | 万向节锁：三只陀螺环 vs 平静的四元数 | 3D 演示 |
| 06 | AlphaFold 结构模块里的 frame 与四元数 | 3D 演示：残基链预测更新 |
| 07 | AlphaFold 的输出清单：t(3) + q(4) 与 7×2 个扭转角 (cos, sin) 编码 | 3D 骨架折叠机 + 单位圆 |
| 08 | 速查表 | 公式卡 |

每个演示都可以拖拽旋转视角，Ctrl/⌘ + 滚轮缩放（普通滚轮保留给页面滚动）。

## 本地预览

ES modules 不能跑在 `file://` 下，任意静态服务器即可：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 结构

```
index.html          页面结构与全部文案
style.css           设计系统（深色观测台主题）
js/scene-kit.js     共用机制：场景工厂、小飞机 gizmo、四分量读数条
js/hero.js          首屏：沿大圆巡航的姿态演示
js/demo-*.js        各章节演示（commute / halfangle / slerp / gimbal / af / backbone / circle）
vendor/             three.module.js + OrbitControls（本地化，无 CDN 依赖）
fonts/              Fraunces 可变字体（Latin 子集）
```

除 Three.js 与 Fraunces 字体外无任何运行时依赖；GitHub Pages 直接托管，无构建步骤。

## License

MIT
