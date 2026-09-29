// demo-af.js — 02 节：一段真实的 α 螺旋主链，每个残基是一个刚体
// （N/Cα/C 原子、残基内键、三色朝向轴都长在同一个组里，组原点 = Cα）
// 「模拟一轮预测更新」：肽平面锁死（ω 恒 180°），更新只能发生在平面两侧的铰链上——
// 每残基的 φ/ψ 各抽一个 ±8° 小旋转，另加一个整体 ±6° 刚体小旋转；
// 整链按扭转角用 NeRF 重建，铰链旋转自然沿链传向 C 端（下游残基被带着走），
// 键长键角恒为理想值 ⇒ 琥珀肽键双线长度始终不变；每残基的 t、q 由重建结果写回
import * as THREE from 'three';
import { createScene, animate, easeInOutCubic, vecArrow, DEG } from './scene-kit.js';
import {
  computeBackbone, residueFrame, makeAtom, makeBond, setBond, makeBondPair, setBondPair,
  COL, RAD, BOND_R, DBL, BCOL,
} from './backbone-geom.js';

const N_RES = 7;
const SCALE = 0.5; // 半尺场景：共享样式表一律乘这个系数
const AXES_LEN = 0.72;
const HOME = { phi: -57, psi: -47 }; // α 螺旋；ω=180° 锁死，不参与更新
const HINGE_JITTER = 8; // 每个 φ/ψ 铰链每轮抽 ±8°
const SPIN_JITTER = 6;  // 整体刚体小旋转每轮 ±6°
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

  // —— 更新状态：φ/ψ 每残基一组，跨轮累计；整体姿态 spin 跨轮累计 ——
  const phis = new Array(N_RES).fill(HOME.phi);
  const psis = new Array(N_RES).fill(HOME.psi);
  const spin = new THREE.Quaternion();

  // —— 固定摆位：初始螺旋轴摆竖直、缩放；每次重建把质心挪回原点（链始终居中）——
  const bb0 = computeBackbone(N_RES, { psi: HOME.psi, omega: 180, phi: HOME.phi });
  const axis = new THREE.Vector3().subVectors(bb0[N_RES - 1][1], bb0[0][1]).normalize();
  const upright = new THREE.Quaternion().setFromUnitVectors(axis, UP);
  function place(bb) {
    const cen = new THREE.Vector3();
    bb.flat().forEach((p) => cen.add(p));
    cen.multiplyScalar(1 / (N_RES * 3));
    bb.forEach((tri) => tri.forEach((p) => {
      p.sub(cen).multiplyScalar(SCALE).applyQuaternion(upright).applyQuaternion(spin);
    }));
  }
  place(bb0);

  // —— 每个残基 = 一个刚体组：N/Cα/C 原子 + 残基内两根键 + 三色朝向轴 ——
  // 键长键角恒理想 ⇒ N/C 在组内的局部偏移是常量，按初始姿态算一次即可
  const resGroups = [];
  const qCur = [];
  const cOff = [], nOff = []; // C(i)、N(i) 在组内的局部偏移
  for (let i = 0; i < N_RES; i++) {
    const [nPt, caPt, cPt] = bb0[i];
    const g = new THREE.Group();
    g.position.copy(caPt);
    // 原子偏移必须乘 q0⁻¹ 写进组的局部系：组挂着旋转 q0，世界偏移会再被转一次
    const q0 = residueFrame(nPt, caPt, cPt);
    const invQ = q0.clone().invert();
    const nL = nPt.clone().sub(caPt).applyQuaternion(invQ);
    const cL = cPt.clone().sub(caPt).applyQuaternion(invQ);
    const mn = makeAtom(RAD.N * SCALE, COL.N); mn.position.copy(nL); g.add(mn);
    g.add(makeAtom(RAD.CA * SCALE, COL.CA)); // Cα = 组原点
    const mc = makeAtom(RAD.C * SCALE, COL.C); mc.position.copy(cL); g.add(mc);
    const b1 = makeBond(BCOL.bb, BOND_R * SCALE); setBond(b1, nL, ZERO); g.add(b1);
    const b2 = makeBond(BCOL.bb, BOND_R * SCALE); setBond(b2, ZERO, cL); g.add(b2);
    g.add(
      vecArrow(new THREE.Vector3(1, 0, 0), AXES_LEN, 0xe5626a),
      vecArrow(new THREE.Vector3(0, 1, 0), AXES_LEN, 0x54b06a),
      vecArrow(new THREE.Vector3(0, 0, 1), AXES_LEN, 0x5c7cf0)
    );
    g.quaternion.copy(q0);
    scene.add(g);
    resGroups.push(g);
    qCur.push(q0.clone());
    nOff.push(nL);
    cOff.push(cL);
  }

  // —— 肽键（琥珀双线）：跨在两残基刚体之间，按当前位置每帧重画 ——
  // 两端的 t、q 出自同一次 NeRF 重建 ⇒ 线长恒 = 理想肽键长，绝不伸缩
  const pep = [];
  for (let i = 0; i < N_RES - 1; i++) {
    const meshes = makeBondPair(BCOL.pep, DBL.r * SCALE);
    meshes.forEach((m) => scene.add(m));
    pep.push({ i, meshes });
  }
  function refreshPeptide() {
    for (const pb of pep) {
      const a = cOff[pb.i].clone().applyQuaternion(qCur[pb.i]).add(resGroups[pb.i].position);
      const b = nOff[pb.i + 1].clone().applyQuaternion(qCur[pb.i + 1]).add(resGroups[pb.i + 1].position);
      setBondPair(pb.meshes, a, b, DBL.off * SCALE);
    }
  }
  refreshPeptide();

  // —— 由扭转角同步刚体：整链重建（ω=180° 锁死），把新的 t、q 写回每个残基 ——
  function syncChain() {
    const bb = computeBackbone(N_RES, { psi: psis, omega: 180, phi: phis });
    place(bb);
    for (let i = 0; i < N_RES; i++) {
      const [nPt, caPt, cPt] = bb[i];
      resGroups[i].position.copy(caPt);           // t 更新
      qCur[i].copy(residueFrame(nPt, caPt, cPt)); // q 更新
      resGroups[i].quaternion.copy(qCur[i]);
    }
    refreshPeptide();
  }

  let running = false;

  function runTo(phiT, psiT, spinT, dur) {
    if (running) return;
    running = true;
    stepBtn.disabled = true;
    const phiS = phis.slice(), psiS = psis.slice();
    const spinS = spin.clone();
    animate({
      dur,
      ease: easeInOutCubic,
      tick: (e) => {
        for (let i = 0; i < N_RES; i++) {
          phis[i] = phiS[i] + (phiT[i] - phiS[i]) * e;
          psis[i] = psiS[i] + (psiT[i] - psiS[i]) * e;
        }
        spin.slerpQuaternions(spinS, spinT, e);
        syncChain();
        invalidate();
      },
      done: () => {
        running = false;
        stepBtn.disabled = false;
      },
    });
  }

  function applyStep() {
    const rng = Math.random;
    // 一轮「预测更新」：每个铰链抽一个小旋转（沿链传播），外加一个整体刚体小旋转
    const spinT = new THREE.Quaternion()
      .setFromAxisAngle(randUnit(rng), (rng() * 2 - 1) * SPIN_JITTER * DEG)
      .multiply(spin); // 世界系左乘：整体姿态在现有基础上再转
    runTo(
      phis.map((v) => v + (rng() * 2 - 1) * HINGE_JITTER),
      psis.map((v) => v + (rng() * 2 - 1) * HINGE_JITTER),
      spinT,
      850
    );
  }

  function reset() {
    runTo(new Array(N_RES).fill(HOME.phi), new Array(N_RES).fill(HOME.psi), new THREE.Quaternion(), 600);
  }

  stepBtn.addEventListener('click', applyStep);
  resetBtn.addEventListener('click', reset);
  invalidate();
}
