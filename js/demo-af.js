// demo-af.js — 02 节：一段真实的 α 螺旋主链，每个残基是一个刚体
// （N/Cα/C 原子、残基内键、三色朝向轴都长在同一个组里，绕 Cα 转）
// 「模拟一轮预测更新」= 每个残基 q ← normalize(q ⊗ Δq)：原子跟着坐标架一起转；
// 连接两残基的肽键（琥珀双线）按两侧当前位置每帧重画，随之轻微伸缩
import * as THREE from 'three';
import { createScene, animate, easeInOutCubic, vecArrow, DEG } from './scene-kit.js';
import { computeBackbone, residueFrame, makeAtom, makeBond, setBond, COL } from './backbone-geom.js';

const N_RES = 7;
const SCALE = 0.5;
const AXES_LEN = 0.72;
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3(0, 0, 0);

function randUnit(rng) {
  const z = rng() * 2 - 1, a = rng() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), z);
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

  // —— 每个残基 = 一个刚体组：N/Cα/C 原子 + 残基内两根键 + 三色朝向轴 ——
  const resGroups = [];   // 刚体组（位置 = Cα，四元数 = q）
  const qCur = [], qHome = [];
  const cOff = [], nOff = []; // C(i)、N(i) 在组内的局部偏移
  for (let i = 0; i < N_RES; i++) {
    const [nPt, caPt, cPt] = bb[i];
    const g = new THREE.Group();
    g.position.copy(caPt);
    // 原子偏移必须乘 q0⁻¹ 写进组的局部系：组挂着旋转 q0，世界偏移会再被转一次
    const q0 = residueFrame(nPt, caPt, cPt);
    const invQ = q0.clone().invert();
    const nL = nPt.clone().sub(caPt).applyQuaternion(invQ);
    const cL = cPt.clone().sub(caPt).applyQuaternion(invQ);
    const mn = makeAtom(0.1, COL.N); mn.position.copy(nL); g.add(mn);
    g.add(makeAtom(0.12, COL.CA)); // Cα = 组原点
    const mc = makeAtom(0.1, COL.C); mc.position.copy(cL); g.add(mc);
    const b1 = makeBond(0x8d97a3); setBond(b1, nL, ZERO); g.add(b1);
    const b2 = makeBond(0x8d97a3); setBond(b2, ZERO, cL); g.add(b2);
    g.add(
      vecArrow(new THREE.Vector3(1, 0, 0), AXES_LEN, 0xe5626a),
      vecArrow(new THREE.Vector3(0, 1, 0), AXES_LEN, 0x54b06a),
      vecArrow(new THREE.Vector3(0, 0, 1), AXES_LEN, 0x5c7cf0)
    );
    g.quaternion.copy(q0);
    scene.add(g);
    resGroups.push(g);
    qCur.push(q0.clone());
    qHome.push(q0.clone());
    nOff.push(nL);
    cOff.push(cL);
  }

  // —— 肽键（琥珀双线）：跨在两残基刚体之间，世界系绘制、每帧按当前位置重画 ——
  const pep = [];
  for (let i = 0; i < N_RES - 1; i++) {
    const meshes = [];
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.034, 0.034, 1, 10),
        new THREE.MeshStandardMaterial({ color: 0xd99a4e, roughness: 0.35, metalness: 0.25 })
      );
      scene.add(m);
      meshes.push(m);
    }
    pep.push({ i, meshes });
  }
  function refreshPeptide() {
    for (const pb of pep) {
      const a = cOff[pb.i].clone().applyQuaternion(qCur[pb.i]).add(resGroups[pb.i].position);
      const b = nOff[pb.i + 1].clone().applyQuaternion(qCur[pb.i + 1]).add(resGroups[pb.i + 1].position);
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      dir.normalize();
      const perp = Math.abs(dir.y) < 0.9
        ? new THREE.Vector3().crossVectors(dir, UP).normalize()
        : new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();
      pb.meshes.forEach((m, k) => {
        m.scale.set(1, len * 0.94, 1);
        m.position.copy(mid).addScaledVector(perp, (k === 0 ? -1 : 1) * 0.07);
        m.quaternion.setFromUnitVectors(UP, dir);
      });
    }
  }
  refreshPeptide();

  let running = false;

  function applyStep() {
    if (running) return;
    running = true;
    stepBtn.disabled = true;
    const rng = Math.random;
    // 每个残基抽一个 ±12° 的小旋转作为本轮「预测更新」
    const targets = qCur.map((q) => {
      const dq = new THREE.Quaternion().setFromAxisAngle(randUnit(rng), (rng() * 2 - 1) * 12 * DEG);
      return q.clone().multiply(dq).normalize(); // 与屏上公式一致：q ⊗ Δq
    });
    const starts = qCur.map((q) => q.clone());
    animate({
      dur: 850,
      ease: easeInOutCubic,
      tick: (e) => {
        qCur.forEach((q, i) => {
          q.slerpQuaternions(starts[i], targets[i], e);
          resGroups[i].quaternion.copy(q);
        });
        refreshPeptide();
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
          resGroups[i].quaternion.copy(q);
        });
        refreshPeptide();
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
