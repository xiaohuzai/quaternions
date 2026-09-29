// demo-frame.js — 「从三个原子到三角架」：N、Cα、C 的 111° 键角如何构造出正交坐标系
// 关键对照：键角（化学键之间）随滑块变，轴角（x∧y）永远 90°——正交的是坐标系，不是化学键
import * as THREE from 'three';
import { createScene, animate, textSprite, DEG } from './scene-kit.js';
import { makeAtom, makeBond, setBond, COL } from './backbone-geom.js';

// 数学向量用平涂（图解感），原子用真实光照（实体感）——两种材质刻意区分
function vecArrow(dir, len, colorHex, opacity = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: opacity < 1, opacity });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len * 0.8, 10), mat);
  shaft.position.y = len * 0.4;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 12), mat);
  head.position.y = len * 0.8 + 0.09;
  g.add(shaft, head);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return g;
}

function tubeAlong(points, colorHex, opacity = 1, radius = 0.014) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, points.length * 2, radius, 6, false),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: opacity < 1, opacity })
  );
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { o.material.map?.dispose(); o.material.dispose(); }
  });
}

export function initFrame() {
  const root = document.querySelector('[data-demo="frame"]');
  const canvas = root.querySelector('canvas');
  const angleEl = root.querySelector('#fr-angle');
  const spinEl = root.querySelector('#fr-spin');
  const angleVal = root.querySelector('#fr-angle-val');
  const spinVal = root.querySelector('#fr-spin-val');
  const readEl = root.querySelector('#fr-read');
  const explainEl = root.querySelector('#fr-explain');
  const stepBtns = [...root.querySelectorAll('[data-fstep]')];

  const { scene, invalidate } = createScene(canvas, { cam: [3.0, 2.4, 4.4], target: [0.15, 0.15, 0] });

  // —— 原子（真实几何，111° 键角）——
  const ca = makeAtom(0.2, COL.CA);
  const n = makeAtom(0.17, COL.N);
  const c = makeAtom(0.17, COL.C);
  const bondNCa = makeBond(0x8d97a3);
  const bondCaC = makeBond(0x8d97a3);
  scene.add(ca, n, c, bondNCa, bondCaC);
  const cPos = new THREE.Vector3(0.62, 0, 0);

  // —— 步骤分组：g1 x 轴；g2 y 轴（正交化）；g3 z 轴（叉乘）——
  const g1 = new THREE.Group();
  const g2 = new THREE.Group();
  const g3 = new THREE.Group();
  scene.add(g1, g2, g3);

  const xArrow = vecArrow(new THREE.Vector3(1, 0, 0), 0.95, 0xe5626a);
  const xLabel = textSprite('X', '#e5626a', { scale: 0.3 });
  xLabel.position.set(1.12, 0, 0);
  g1.add(xArrow, xLabel);

  const yArrow = vecArrow(new THREE.Vector3(0, 1, 0), 0.95, 0x54b06a);
  const yLabel = textSprite('Y', '#54b06a', { scale: 0.3 });
  const rawArrow = vecArrow(new THREE.Vector3(0, 1, 0), 0.66, 0xcfd6dd, 0.55); // N 原始方向
  const rightMark = new THREE.Group(); // x∧y 直角记号
  rightMark.add(
    tubeAlong([new THREE.Vector3(0.3, 0, 0), new THREE.Vector3(0.3, 0.3, 0)], 0x94a0ae, 0.9, 0.012),
    tubeAlong([new THREE.Vector3(0.3, 0.3, 0), new THREE.Vector3(0, 0.3, 0)], 0x94a0ae, 0.9, 0.012)
  );
  const arcLabel = textSprite('键角', '#d99a4e', { scale: 0.32, italic: false, size: 56, font: '600 56px "PingFang SC", sans-serif' });
  g2.add(yArrow, yLabel, rawArrow, rightMark, arcLabel);
  let projSeg = null, remSeg = null, arcMesh = null; // sync 时按几何重建

  const zArrow = vecArrow(new THREE.Vector3(0, 0, 1), 0.95, 0x5c7cf0);
  const zLabel = textSprite('Z', '#5c7cf0', { scale: 0.3 });
  const planeMesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ color: 0x3a4654, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
  );
  g3.add(zArrow, zLabel, planeMesh);

  const STEP_TEXT = {
    1: '<b>① x 轴</b>：从 Cα 指向 C，归一化——红轴与琥珀 C 球永远同向。',
    2: '<b>② y 轴</b>：N 的原始方向（灰白箭头）减去它在 x 上的分量（红色半透明段），剩下的（绿段）就是 y 的方向——与 x 严格垂直。注意：两根化学键的夹角可没变。',
    3: '<b>③ z 轴</b>：x × y 叉乘，垂直于 N–Cα–C 平面（灰色薄膜）。三根轴两两 90°，右手系。',
    all: '三步合起来：<b>键角是化学键的事（真实蛋白里 ≈111°），正交是坐标系的事</b>。q 编码的就是这三根轴的朝向——不是那两根化学键。',
  };
  let step = 'all';
  function applyStep() {
    g1.visible = true;
    g2.visible = step !== '1';
    g3.visible = step === '3' || step === 'all';
    explainEl.innerHTML = STEP_TEXT[step];
    invalidate();
  }

  function sync() {
    const beta = Number(angleEl.value);           // 键角 ∠N–Cα–C
    const alpha = Number(spinEl.value) * DEG;     // 平面方位
    angleVal.textContent = `${beta}°`;
    spinVal.textContent = `${Number(spinEl.value)}°`;
    const b = beta * DEG;

    const xHat = new THREE.Vector3(1, 0, 0);
    const yHat = new THREE.Vector3(0, Math.cos(alpha), Math.sin(alpha)); // 正交化后的 y
    const zHat = new THREE.Vector3().crossVectors(xHat, yHat);
    const nPos = new THREE.Vector3()
      .addScaledVector(xHat, Math.cos(b))
      .addScaledVector(yHat, Math.sin(b))
      .multiplyScalar(0.58);
    n.position.copy(nPos);
    setBond(bondNCa, new THREE.Vector3(), nPos);
    setBond(bondCaC, new THREE.Vector3(), cPos);

    // 构造向量跟随平面
    yArrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), yHat);
    zArrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), zHat);
    rawArrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nPos.clone().normalize());
    rightMark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), yHat);

    // x 分量（被减掉）与剩余段（平行于 y）——平行四边形分解
    const projLen = 0.58 * Math.cos(b);
    if (projSeg) { g2.remove(projSeg); disposeTree(projSeg); }
    if (remSeg) { g2.remove(remSeg); disposeTree(remSeg); }
    projSeg = tubeAlong([new THREE.Vector3(), xHat.clone().multiplyScalar(projLen)], 0xe5626a, 0.5, 0.022);
    remSeg = tubeAlong([xHat.clone().multiplyScalar(projLen), nPos.clone()], 0x54b06a, 0.5, 0.022);
    g2.add(projSeg, remSeg);

    // 键角弧：x → N 方向，落在 x-y 平面
    if (arcMesh) { g2.remove(arcMesh); disposeTree(arcMesh); }
    const arcPts = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * b;
      arcPts.push(new THREE.Vector3().addScaledVector(xHat, Math.cos(t) * 0.5).addScaledVector(yHat, Math.sin(t) * 0.5));
    }
    arcMesh = tubeAlong(arcPts, 0xd99a4e, 1, 0.016);
    g2.add(arcMesh);

    // N–Cα–C 平面薄膜
    planeMesh.geometry.dispose();
    const pg = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), nPos.clone().multiplyScalar(0.9), cPos.clone().multiplyScalar(0.98),
    ]);
    pg.setIndex([0, 1, 2]);
    planeMesh.geometry = pg;

    // 标签
    yLabel.position.copy(yHat).multiplyScalar(1.12);
    zLabel.position.copy(zHat).multiplyScalar(1.12);
    arcLabel.position.copy(xHat).multiplyScalar(Math.cos(b / 2) * 0.72).addScaledVector(yHat, Math.sin(b / 2) * 0.72);

    readEl.innerHTML =
      `键角 ∠N–Cα–C = <span class="fa">${beta}°</span>（随滑块变）　·　` +
      `<b>轴角 x∧y = 90.0°（永远）</b>`;
    applyStep();
    invalidate();
  }

  for (const s of [angleEl, spinEl]) s.addEventListener('input', sync);
  for (const b of stepBtns) {
    b.addEventListener('click', () => {
      step = b.dataset.fstep;
      stepBtns.forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      applyStep();
    });
  }

  sync();
  // 入场：平面缓缓转 1/4 圈，让三根轴「跟着平面走」看一次
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    animate({
      dur: 1600,
      tick: (e) => { spinEl.value = String(Math.round(e * 90)); sync(); },
    });
  }
}
