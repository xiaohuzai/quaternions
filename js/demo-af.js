// demo-af.js — 02 节：一段真实的 α 螺旋主链，每套坐标架骑在 Cα 上
// 「模拟一轮预测更新」= 给每个残基的朝向 q 加一个小旋转（q ← normalize(q ⊗ Δq)）
import * as THREE from 'three';
import { createScene, animate, easeInOutCubic, vecArrow, DEG } from './scene-kit.js';
import { computeBackbone, residueFrame, makeAtom, makeBond, setBond, COL } from './backbone-geom.js';

const N_RES = 7;
const SCALE = 0.5;
const AXES_LEN = 0.72;

function randUnit(rng) {
  const z = rng() * 2 - 1, a = rng() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), z);
}

// 肽键：琥珀色双线（部分双键的化学画法），双线沿垂直于键轴的方向对称展开
function peptideBond(a, b, scene) {
  const vec = new THREE.Vector3().subVectors(b, a);
  const len = vec.length();
  const dir = vec.clone().normalize();
  const perp = Math.abs(dir.y) < 0.9
    ? new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
    : new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();
  for (const off of [-0.05, 0.05]) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, len * 0.92, 10),
      new THREE.MeshStandardMaterial({ color: 0xd99a4e, roughness: 0.35, metalness: 0.25 })
    );
    m.position.copy(a).add(b).multiplyScalar(0.5).addScaledVector(perp, off);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    scene.add(m);
  }
}

export function initAf() {
  const root = document.querySelector('[data-demo="af"]');
  const canvas = root.querySelector('canvas');
  const stepBtn = root.querySelector('#af-step');
  const resetBtn = root.querySelector('#af-reset');

  const { scene, invalidate } = createScene(canvas, { cam: [3.5, 1.0, 9.6], target: [0, 0, 0] });

  // —— 真实主链：α 螺旋（φ=-47, ω=180, ψ=-47），居中、缩放、螺旋轴摆成竖直 ——
  const bb = computeBackbone(N_RES, { psi: -47, omega: 180, phi: -57 });
  const axis = new THREE.Vector3().subVectors(bb[N_RES - 1][1], bb[0][1]).normalize();
  const upright = new THREE.Quaternion().setFromUnitVectors(axis, new THREE.Vector3(0, 1, 0));
  const center = new THREE.Vector3();
  bb.flat().forEach((p) => center.add(p));
  center.multiplyScalar(1 / (N_RES * 3));
  bb.forEach((tri) => tri.forEach((p) => {
    p.sub(center).multiplyScalar(SCALE).applyQuaternion(upright);
  }));

  // —— 主链：键 + 原子球 ——
  // 可转单键（N–Cα、Cα–C）= 灰色单线；肽键 C–N = 琥珀双线（部分双键，刚性 ω≈180°）
  for (let i = 0; i < N_RES; i++) {
    const [nPt, caPt, cPt] = bb[i];
    const b1 = makeBond(0x8d97a3); setBond(b1, nPt, caPt); scene.add(b1);
    const b2 = makeBond(0x8d97a3); setBond(b2, caPt, cPt); scene.add(b2);
    if (i < N_RES - 1) peptideBond(cPt, bb[i + 1][0], scene);
  }
  for (const [nPt, caPt, cPt] of bb) {
    const mn = makeAtom(0.1, COL.N); mn.position.copy(nPt);
    const mca = makeAtom(0.12, COL.CA); mca.position.copy(caPt);
    const mc = makeAtom(0.1, COL.C); mc.position.copy(cPt);
    scene.add(mn, mca, mc);
  }

  // —— 每个残基的朝向轴（frame），骑在 Cα 上 ——
  const axesGroups = [];
  const qHome = [];
  bb.forEach(([nPt, caPt, cPt]) => {
    const g = new THREE.Group();
    g.position.copy(caPt);
    g.add(
      vecArrow(new THREE.Vector3(1, 0, 0), AXES_LEN, 0xe5626a),
      vecArrow(new THREE.Vector3(0, 1, 0), AXES_LEN, 0x54b06a),
      vecArrow(new THREE.Vector3(0, 0, 1), AXES_LEN, 0x5c7cf0)
    );
    const q0 = residueFrame(nPt, caPt, cPt);
    g.quaternion.copy(q0);
    scene.add(g);
    axesGroups.push(g);
    qHome.push(q0.clone());
  });
  const qCur = qHome.map((q) => q.clone());

  let running = false;

  function applyStep() {
    if (running) return;
    running = true;
    stepBtn.disabled = true;
    const rng = Math.random;
    // 每个残基抽一个 ±12° 的小旋转作为本轮「预测更新」
    const targets = qCur.map((q) => {
      const dq = new THREE.Quaternion().setFromAxisAngle(randUnit(rng), (rng() * 2 - 1) * 12 * DEG);
      return dq.multiply(q).normalize();
    });
    const starts = qCur.map((q) => q.clone());
    animate({
      dur: 850,
      ease: easeInOutCubic,
      tick: (e) => {
        qCur.forEach((q, i) => {
          q.slerpQuaternions(starts[i], targets[i], e);
          axesGroups[i].quaternion.copy(q);
        });
        invalidate();
      },
      done: () => {
        running = false;
        stepBtn.disabled = false;
      },
    });
  }

  function reset() {
    if (running) return;
    running = true;
    stepBtn.disabled = true;
    const starts = qCur.map((q) => q.clone());
    animate({
      dur: 600,
      ease: easeInOutCubic,
      tick: (e) => {
        qCur.forEach((q, i) => {
          q.slerpQuaternions(starts[i], qHome[i], e);
          axesGroups[i].quaternion.copy(q);
        });
        invalidate();
      },
      done: () => {
        running = false;
        stepBtn.disabled = false;
      },
    });
  }

  stepBtn.addEventListener('click', applyStep);
  resetBtn.addEventListener('click', reset);
  invalidate();
}
