// scene-kit.js — 四个演示共用的 Three.js 机制
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

// 全站统一的组件色：白=实部 w，红/绿/蓝=三个虚轴 i/j/k，黄铜=强调
export const C = {
  bg: 0x0b0f14,
  w: 0xf0ead8, x: 0xe5626a, y: 0x54b06a, z: 0x5c7cf0,
  accent: 0xd99a4e,
  bone: 0xd8d2c4,
  grid: 0x1b222c,
};

export const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const DEG = Math.PI / 180;

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// rAF 补间，返回取消函数
export function animate({ dur = 700, ease = easeInOutCubic, tick, done }) {
  let raf; const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    tick(ease(t), t);
    if (t < 1) raf = requestAnimationFrame(step);
    else if (done) done();
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

// 建一个演示场景：相机 + 轨道控制 + 灯光 + 地网格 + 离屏暂停
export function createScene(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  scene.fog = new THREE.Fog(C.bg, 10, 26);
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 38, 1, 0.1, 100);
  camera.position.set(...(opts.cam ?? [3.4, 2.5, 4.8]));
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(...(opts.target ?? [0, 0.1, 0]));
  controls.minDistance = 2.2;
  controls.maxDistance = 16;
  // 滚轮/双指缩放自己实现（指数平滑）；OrbitControls 只管旋转与双指平移
  controls.enableZoom = false;
  canvas.style.touchAction = 'pan-y';

  // —— 平滑缩放：滚轮/双指/按钮只改「目标距离」，渲染循环里指数逼近 ——
  let distTarget = null;
  const clampDist = (d) => THREE.MathUtils.clamp(d, controls.minDistance, controls.maxDistance);
  canvas.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return; // 普通滚轮留给页面滚动
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    distTarget = clampDist((distTarget ?? camera.position.distanceTo(controls.target)) * Math.exp(dy * 0.0016));
    invalidate();
  }, { passive: false });
  // 触屏双指捏合（touch-action:pan-y 下双指事件进 JS）
  const touches = new Map();
  const pinchSpan = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
  };
  let pinchDist = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.size === 2) pinchDist = pinchSpan();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.size === 2) {
      const d = pinchSpan();
      if (pinchDist > 0) {
        distTarget = clampDist((distTarget ?? camera.position.distanceTo(controls.target)) * (pinchDist / d));
        invalidate();
      }
      pinchDist = d;
    }
  });
  const dropTouch = (e) => { touches.delete(e.pointerId); pinchDist = 0; };
  canvas.addEventListener('pointerup', dropTouch);
  canvas.addEventListener('pointercancel', dropTouch);

  // 双击复位：缩丢了/转晕了随时回初始机位（平滑过渡）；⟲ 按钮共用
  const camHome = camera.position.clone();
  const targetHome = controls.target.clone();
  function resetView() {
    const p0 = camera.position.clone();
    const t0 = controls.target.clone();
    distTarget = null;
    animate({
      dur: 420,
      tick: (e) => {
        camera.position.lerpVectors(p0, camHome, e);
        controls.target.lerpVectors(t0, targetHome, e);
        controls.update();
        invalidate();
      },
    });
  }
  canvas.addEventListener('dblclick', resetView);

  // 平移一步（视图相对方向，位移量随缩放级别缩放）
  function panBy(sx, sy) {
    const dir = new THREE.Vector3().subVectors(controls.target, camera.position).normalize();
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const step = camera.position.distanceTo(controls.target) * 0.28;
    const p0 = camera.position.clone(), t0 = controls.target.clone();
    const delta = right.multiplyScalar(sx * step).addScaledVector(up, sy * step);
    const p1 = p0.clone().add(delta), t1 = t0.clone().add(delta);
    distTarget = null;
    animate({
      dur: 230,
      tick: (e) => {
        camera.position.lerpVectors(p0, p1, e);
        controls.target.lerpVectors(t0, t1, e);
        controls.update();
        invalidate();
      },
    });
  }

  // 控件栈：＋/－ 缩放、⟲ 复位、四向平移 pad——桌面点按、触屏免找 Ctrl
  if (opts.uiControls !== false) {
    const stack = document.createElement('div');
    stack.className = 'ctl-stack';
    const mkBtn = (html, title, fn, cls = 'ctl-btn') => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.innerHTML = html;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('click', fn);
      return b;
    };
    stack.append(
      mkBtn('＋', '放大', () => { distTarget = clampDist(camera.position.distanceTo(controls.target) * 0.72); invalidate(); }),
      mkBtn('－', '缩小', () => { distTarget = clampDist(camera.position.distanceTo(controls.target) * 1.38); invalidate(); }),
      mkBtn('⟲', '复位视角', resetView)
    );
    const pad = document.createElement('div');
    pad.className = 'ctl-pad';
    const ph = () => document.createElement('span');
    const dot = () => Object.assign(document.createElement('span'), { className: 'ctl-pad-dot' });
    pad.append(
      ph(),
      mkBtn('↑', '向上平移', () => panBy(0, 1), 'ctl-btn ctl-pad-btn'),
      ph(),
      mkBtn('←', '向左平移', () => panBy(-1, 0), 'ctl-btn ctl-pad-btn'),
      dot(),
      mkBtn('→', '向右平移', () => panBy(1, 0), 'ctl-btn ctl-pad-btn'),
      ph(),
      mkBtn('↓', '向下平移', () => panBy(0, -1), 'ctl-btn ctl-pad-btn'),
      ph()
    );
    stack.append(pad);
    canvas.parentElement?.appendChild(stack);
  }

  // 每个画布的常驻操作提示
  const hint = document.createElement('div');
  hint.className = 'canvas-hint';
  hint.textContent = '拖拽转视角 · Ctrl/⌘+滚轮或双指缩放 · 右键拖拽平移 · 双击复位';
  canvas.parentElement?.appendChild(hint);
  if (opts.autoRotate) {
    controls.autoRotate = !REDUCED_MOTION;
    controls.autoRotateSpeed = 0.5;
  }

  scene.add(new THREE.HemisphereLight(0x9db4d6, 0x191410, 1.15));
  const key = new THREE.DirectionalLight(0xfff2df, 2.6);
  key.position.set(4, 7, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7c9dff, 1.0);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  if (opts.grid !== false) {
    const g = new THREE.GridHelper(16, 32, C.grid, 0x151b23);
    g.position.y = -1.5;
    scene.add(g);
  }

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true, raf = 0, frameCb = null, lastT = performance.now();
  let dirty = true; // 按需渲染：静止场景不烧 GPU 帧
  const loop = (now) => {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    let moved = controls.update(); // 阻尼/autoRotate 期间持续为 true
    // 平滑缩放：向目标距离指数逼近（逼近中才渲染，静止零开销）
    if (distTarget !== null) {
      const d = camera.position.distanceTo(controls.target);
      const nd = d + (distTarget - d) * (1 - Math.exp(-dt * 9));
      if (Math.abs(nd - distTarget) > 0.004) {
        camera.position.sub(controls.target).multiplyScalar(nd / d).add(controls.target);
        moved = true;
      } else {
        distTarget = null;
      }
    }
    if (frameCb) frameCb(dt, invalidate);
    if (dirty || moved) {
      renderer.render(scene, camera);
      dirty = false;
    }
    raf = visible ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => {
    if (visible && !raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); }
  };
  // 场景状态变了（滑块/补间/模型位姿变化）就喊一声，下一帧重画
  function invalidate() { dirty = true; kick(); }
  new IntersectionObserver(
    (es) => { visible = es[0].isIntersecting; if (visible) { dirty = true; kick(); } },
    { rootMargin: '120px' }
  ).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { dirty = true; kick(); } });
  kick();

  return { scene, camera, renderer, controls, invalidate, onFrame(cb) { frameCb = cb; } };
}

// 文字精灵（轴标签 / q 与 −q 铭牌）
export function textSprite(text, color, { size = 96, scale = 0.5, italic = true, font = null } = {}) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.font = font ?? `${italic ? 'italic ' : ''}600 ${size}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(11,15,20,0.9)';
  ctx.strokeText(text, 128, 68);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sp.scale.set(scale * 2, scale, 1);
  return sp;
}

// 彩色坐标轴（圆柱 + 圆锥，比 ArrowHelper 漂亮）
function axisArrow(dir, colorHex, len = 1.45) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4, metalness: 0.1 });
  const shaftLen = len * 0.78;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, shaftLen, 12), mat);
  shaft.position.y = shaftLen / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.26, 16), mat);
  head.position.y = shaftLen + 0.12;
  g.add(shaft, head);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return g;
}

// 残基坐标架（骨架变换的具象）：Cα 原点 + 三色轴 + N/C 原子球
// 轴约定与 backbone-geom.residueFrame 一致：x 轴指向 C，y 轴朝 N 一侧
function buildFrameGlyph(s = 1, labels = true) {
  const g = new THREE.Group();
  const mat = (color, rough = 0.42) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.1 });
  // 原子色与 backbone-geom.COL 保持一致（此处不 import 那边以避免环依赖）
  const N_COLOR = 0x5c7cf0, CA_COLOR = 0xd8d2c4, C_COLOR = 0xd99a4e;

  // Cα（原点）与 N、C 原子——∠N-Cα-C = 111°，C 摆在 +x 上
  const ca = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 18, 12), mat(CA_COLOR, 0.45));
  const n = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 18, 12), mat(N_COLOR));
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 18, 12), mat(C_COLOR));
  const nPos = new THREE.Vector3(Math.cos(111 * DEG), Math.sin(111 * DEG), 0).multiplyScalar(0.58 * s);
  const cPos = new THREE.Vector3(0.62 * s, 0, 0);
  n.position.copy(nPos);
  c.position.copy(cPos);
  g.add(ca, n, c);
  // 键：Cα–N、Cα–C
  for (const p of [nPos, cPos]) {
    const bond = new THREE.Mesh(new THREE.CylinderGeometry(0.028 * s, 0.028 * s, 1, 8), mat(0x8d97a3, 0.5));
    bond.scale.set(1, p.length(), 1);
    bond.position.copy(p).multiplyScalar(0.5);
    bond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
    g.add(bond);
  }

  // 三色轴
  const axes = [
    [new THREE.Vector3(1, 0, 0), C.x, 'X'],
    [new THREE.Vector3(0, 1, 0), C.y, 'Y'],
    [new THREE.Vector3(0, 0, 1), C.z, 'Z'],
  ];
  for (const [dir, color, label] of axes) {
    g.add(axisArrow(dir, color, 0.78 * s));
    if (labels) {
      const sp = textSprite(label, `#${color.toString(16).padStart(6, '0')}`, { scale: 0.3 * s });
      sp.position.copy(dir).multiplyScalar(1.02 * s);
      g.add(sp);
    }
  }
  return g;
}

// 演示主角 = 残基坐标架
export function buildGizmo(scale = 1, opts = {}) {
  return buildFrameGlyph(scale, opts.labels !== false);
}

// 固定世界轴：细长、暗色、永不旋转——与机体轴（亮箭头）区分，锚定「绕哪根轴转」
export function worldAxes(len = 4.4) {
  const g = new THREE.Group();
  const axes = [
    [new THREE.Vector3(1, 0, 0), C.x, 'X'],
    [new THREE.Vector3(0, 1, 0), C.y, 'Y'],
    [new THREE.Vector3(0, 0, 1), C.z, 'Z'],
  ];
  for (const [dir, color, label] of axes) {
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.6, metalness: 0.05, transparent: true, opacity: 0.32,
    });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 8), mat);
    g.add(rod);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const sp = textSprite(label, `#${color.toString(16).padStart(6, '0')}`, { scale: 0.3, italic: true });
    sp.material.opacity = 0.55;
    sp.position.copy(dir).multiplyScalar(len / 2 + 0.25);
    g.add(sp);
  }
  return g;
}

// 四分量读数条 —— 全站签名组件
export function quatReadout(el) {
  el.classList.add('qread');
  el.innerHTML = ['w', 'x', 'y', 'z']
    .map((k) => `<div class="qrow" data-k="${k}"><span class="qk">${k}</span><span class="qbar"><i></i></span><span class="qv">+0.00</span></div>`)
    .join('');
  const bars = [...el.querySelectorAll('.qrow')];
  return {
    set(q) {
      for (const [i, row] of bars.entries()) {
        const v = [q.w, q.x, q.y, q.z][i];
        const bar = row.querySelector('i');
        const pct = Math.min(1, Math.abs(v)) * 50;
        bar.style.left = v >= 0 ? '50%' : `${50 - pct}%`;
        bar.style.width = `${pct}%`;
        row.querySelector('.qv').textContent = `${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(2)}`;
      }
    },
  };
}

// —— 四元数小工具 ——
export function qAxisAngleDeg(axis, deg) {
  return new THREE.Quaternion().setFromAxisAngle(axis, deg * DEG);
}
export function negQ(q) {
  return new THREE.Quaternion(-q.x, -q.y, -q.z, -q.w);
}
export function nlerp(qa, qb, t) {
  return new THREE.Quaternion(
    qa.x + (qb.x - qa.x) * t,
    qa.y + (qb.y - qa.y) * t,
    qa.z + (qb.z - qa.z) * t,
    qa.w + (qb.w - qa.w) * t
  ).normalize();
}
// 单位四元数对应的旋转角（弧度）
export function angleOf(q) {
  return 2 * Math.acos(Math.min(1, Math.max(-1, q.w)));
}
