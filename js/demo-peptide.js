// demo-peptide.js — 肽键的刚性：什么能转（φ/ψ 铰链），什么不能（ω 被部分双键锁死）
// 三个按钮分别绕三根键试转：φ/ψ 在两个规范位姿间摆动且肽平面保持共面；
// ω 只允许弹开几度就弹回，此时 Cα′ 会翘出肽平面薄膜——「非平面构型」直接可见
import * as THREE from 'three';
import { createScene, animate, textSprite, DEG } from './scene-kit.js';
import {
  makeAtom, makeBond, setBond, makeBondPair, setBondPair, placeAtom,
  COL, RAD, BOND, ANGLE, BOND_R, BOND_R_H, BCOL,
} from './backbone-geom.js';

const UP = new THREE.Vector3(0, 1, 0);
const KEYS = ['Ci', 'Nn', 'O', 'CAi', 'H', 'CAn', 'Cn'];

// 规范位姿（按钮在两档间切换，不会越点越乱）
const HOME = { phi: -57, psi: -47, omega: 0 };
const ALT = { phi: -7, psi: -7 };

// 平面构型（trans，ω=180°）的基准布局：肽键 C–N 沿 +x 摆平；键长键角全取共享 BOND/ANGLE 表
const polar = (len, deg) => new THREE.Vector3(len * Math.cos(deg * DEG), len * Math.sin(deg * DEG), 0);
const base = {
  Ci: new THREE.Vector3(0, 0, 0),
  Nn: new THREE.Vector3(BOND.cN, 0, 0),
  O: polar(BOND.cO, ANGLE.ncO),                       // ∠N–C–O
  CAi: polar(BOND.caC, -ANGLE.caCN),                  // ∠N–C–Cα
  H: new THREE.Vector3(BOND.cN, 0, 0).add(polar(BOND.nH, 180 + ANGLE.cnH)),      // ∠C–N–H，与 Cα′ 分居轴两侧（trans）
  CAn: new THREE.Vector3(BOND.cN, 0, 0).add(polar(BOND.nCa, 180 - ANGLE.cNCa)),  // ∠C–N–Cα′
};
// C₂：按 φ 二面角（C₁–N₂–Cα₂–C₂）挂在 Cα₂ 上——φ 铰链（N–Cα）因此有可见的下游
base.Cn = placeAtom(base.Ci, base.Nn, base.CAn, BOND.caC, ANGLE.nCaC, HOME.phi);

export function initPeptide() {
  const root = document.querySelector('[data-demo="peptide"]');
  const canvas = root.querySelector('canvas');
  const readEl = root.querySelector('#pp-read');
  const warnEl = root.querySelector('#pp-warn');

  const { scene, invalidate } = createScene(canvas, { cam: [1.3, 4.6, 5.4], target: [0.5, 0, 0] });

  // —— 原子（球径/球色取共享表）——
  const spec = {
    Ci: [RAD.C, COL.C], Nn: [RAD.N, COL.N], CAi: [RAD.CA, COL.CA], CAn: [RAD.CA, COL.CA],
    O: [RAD.O, COL.O], H: [RAD.H, COL.H], Cn: [RAD.C, COL.C],
  };
  const pos = {};
  const meshes = {};
  for (const k of KEYS) {
    pos[k] = base[k].clone();
    meshes[k] = makeAtom(spec[k][0], spec[k][1]);
    scene.add(meshes[k]);
  }

  // —— 原子标签（与折叠机同一规格、同一套下标命名，跟帧移动）：H 是 N 上的酰胺氢，不是碳 ——
  const LABEL = {
    Ci: ['C₁', '#d99a4e'], Nn: ['N₂', '#5c7cf0'], O: ['O', '#e5626a'],
    CAi: ['Cα₁', '#d8d2c4'], CAn: ['Cα₂', '#d8d2c4'], H: ['H', '#f2f2f2'], Cn: ['C₂', '#d99a4e'],
  };
  const labels = {};
  for (const k of KEYS) {
    const sp = textSprite(LABEL[k][0], LABEL[k][1], { scale: 0.34, italic: false, size: 64, font: '600 56px Georgia, serif' });
    scene.add(sp);
    labels[k] = sp;
  }

  // —— φ/ψ/ω 铰链小标：常驻，浮在肽平面法线一侧、紧贴各自铰链键中点 ——
  const HINGE_TAG = { phi: ['φ', '#54b06a'], psi: ['ψ', '#5c7cf0'], omega: ['ω', '#e5626a'] };
  const hingeTags = {};
  for (const k of Object.keys(HINGE_TAG)) {
    const sp = textSprite(HINGE_TAG[k][0], HINGE_TAG[k][1], { scale: 0.3 });
    scene.add(sp);
    hingeTags[k] = sp;
  }

  // —— 键（持久网格，每帧按当前原子位置摆放）——
  const bonds = [];
  const addBond = (a, b, color, r = BOND_R) => {
    const m = makeBond(color, r);
    scene.add(m);
    bonds.push({ a, b, mesh: m });
  };
  addBond('CAi', 'Ci', BCOL.bb);         // ψ 的铰链轴（可转）
  addBond('Nn', 'CAn', BCOL.bb);         // φ 的铰链轴（可转）
  addBond('CAn', 'Cn', BCOL.bb);         // φ 的下游
  addBond('Nn', 'H', BCOL.nh, BOND_R_H);
  // 双线键统一走 makeBondPair：C=O 红色双线、肽键琥珀双线（ω 的锁死轴）
  const coPair = makeBondPair(BCOL.co);
  const pepPair = makeBondPair(BCOL.pep);
  [...coPair, ...pepPair].forEach((m) => scene.add(m));
  const peptideMat = pepPair[0].material;

  // —— 肽平面薄膜（由 C、O、N 三点定义，适度放大）——
  const film = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ color: 0x64748a, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
  );
  const filmEdge = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x9db0c2, transparent: true, opacity: 0.7 })
  );
  scene.add(film, filmEdge);

  // 铰链轴线（动画期间显现；ω 用禁止红）——三根轴都是场景里真实画出的化学键
  function placeTube(m, a, b) {
    const dir = new THREE.Vector3().subVectors(b, a);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
  }
  function tubeAxis(a, b, color) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, dir.length() + 0.4, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    placeTube(m, a, b);
    return m;
  }
  const axisPhi = tubeAxis(base.Nn, base.CAn, 0x54b06a);
  const axisPsi = tubeAxis(base.CAi, base.Ci, 0x5c7cf0);
  const axisOmega = tubeAxis(base.Ci, base.Nn, 0xe5626a);
  for (const a of [axisPhi, axisPsi, axisOmega]) { a.visible = false; scene.add(a); }

  const angles = { ...HOME };

  function applyAngles() {
    for (const k of KEYS) pos[k].copy(base[k]);
    const rot = (from, to, deg, keys) => {
      if (!deg) return;
      // 轴与支点取当前 pos：外层铰链骑在已被内层旋转带走的键上，取基准位姿会把分子撕开
      const axis = new THREE.Vector3().subVectors(pos[to], pos[from]).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(axis, deg * DEG);
      for (const k of keys) pos[k].sub(pos[from]).applyQuaternion(q).add(pos[from]);
    };
    // 嵌套顺序：ω 最内（只动 H/Cα₂），再 ψ（带整块肽平面）；φ 不走 rot——
    // C₂ 每帧按 φ₂ 二面角从当前 N–Cα 铰链实时放置（与折叠机同一 NeRF 约定），φ₂ 恒等于滑块值
    rot('Ci', 'Nn', angles.omega, ['H', 'CAn']);
    rot('CAi', 'Ci', angles.psi, ['O', 'Nn', 'H', 'CAn']);
    pos.Cn = placeAtom(pos.Ci, pos.Nn, pos.CAn, BOND.caC, ANGLE.nCaC, angles.phi);

    for (const k of KEYS) meshes[k].position.copy(pos[k]);

    // 铰链轴杆跟当前键位（ψ 会带走 φ/ω 两根轴；ψ 轴自身不动）
    placeTube(axisPhi, pos.Nn, pos.CAn);
    placeTube(axisOmega, pos.Ci, pos.Nn);

    // 标签沿「原子 → 全分子质心」的反方向外推——逐个验过，该方向恰好在每个原子的键向间隙里
    const cen = new THREE.Vector3();
    for (const k of KEYS) cen.add(pos[k]);
    cen.multiplyScalar(1 / KEYS.length);
    for (const k of KEYS) {
      const dir = new THREE.Vector3().subVectors(pos[k], cen).normalize();
      labels[k].position.copy(pos[k]).addScaledVector(dir, spec[k][0] + 0.27);
    }

    // 铰链小标贴键中点，浮在肽平面法线正侧
    const nrm = new THREE.Vector3().subVectors(pos.O, pos.Ci)
      .cross(new THREE.Vector3().subVectors(pos.Nn, pos.Ci)).normalize();
    const tagAt = (a, b) => new THREE.Vector3().addVectors(pos[a], pos[b])
      .multiplyScalar(0.5).addScaledVector(nrm, 0.26);
    hingeTags.phi.position.copy(tagAt('Nn', 'CAn'));
    hingeTags.psi.position.copy(tagAt('CAi', 'Ci'));
    hingeTags.omega.position.copy(tagAt('Ci', 'Nn'));

    for (const bd of bonds) setBond(bd.mesh, pos[bd.a], pos[bd.b]);
    setBondPair(coPair, pos.Ci, pos.O);
    setBondPair(pepPair, pos.Ci, pos.Nn);

    // 肽平面薄膜：C、O、N 三点定平面，适度放大
    const g = new THREE.Vector3().addVectors(pos.Ci, pos.O).add(pos.Nn).multiplyScalar(1 / 3);
    const tri = [pos.Ci, pos.O, pos.Nn].map((p) => g.clone().addScaledVector(new THREE.Vector3().subVectors(p, g), 1.55));
    film.geometry.dispose();
    const fg = new THREE.BufferGeometry().setFromPoints(tri);
    fg.setIndex([0, 1, 2]);
    film.geometry = fg;
    filmEdge.geometry.dispose();
    filmEdge.geometry = new THREE.BufferGeometry().setFromPoints([...tri, tri[0]]);
    invalidate();
  }

  const fmt = (d) => d.toFixed(0).replace('-', '−') + '°';
  function updateRead() {
    readEl.innerHTML =
      `<span class="fx">φ = ${fmt(angles.phi)}</span>（可转）　` +
      `<span class="fy">ψ = ${fmt(angles.psi)}</span>（可转）　` +
      `<span class="fa">ω = ${fmt(angles.omega)}</span>（锁死）`;
  }

  let busy = false;
  function swing(which, delta) {
    if (busy) return;
    busy = true;
    const from = angles[which];
    const to = from + delta;
    const axisMap = { phi: axisPhi, psi: axisPsi, omega: axisOmega };
    axisMap[which].visible = true;
    const isOmega = which === 'omega';
    if (isOmega) warnEl.classList.add('on');
    animate({
      dur: isOmega ? 1100 : 700,
      tick: (e) => {
        angles[which] = isOmega ? from + Math.sin(e * Math.PI) * delta : from + (to - from) * e;
        if (isOmega) peptideMat.emissive.set(0xe5626a).multiplyScalar(Math.sin(e * Math.PI) * 0.8);
        applyAngles();
        updateRead();
      },
      done: () => {
        axisMap[which].visible = false;
        if (isOmega) { peptideMat.emissive.set(0x000000); warnEl.classList.remove('on'); }
        busy = false;
        invalidate();
      },
    });
  }

  // 按钮在「规范位姿」两档间切换：φ −57↔−7、ψ −47↔−7；ω 点了只弹几度就回
  let phiAlt = false, psiAlt = false;
  root.querySelector('#pp-phi').addEventListener('click', () => {
    if (busy) return;
    phiAlt = !phiAlt;
    swing('phi', (phiAlt ? ALT.phi : HOME.phi) - angles.phi);
  });
  root.querySelector('#pp-psi').addEventListener('click', () => {
    if (busy) return;
    psiAlt = !psiAlt;
    swing('psi', (psiAlt ? ALT.psi : HOME.psi) - angles.psi);
  });
  root.querySelector('#pp-omega').addEventListener('click', () => swing('omega', 15));
  root.querySelector('#pp-reset').addEventListener('click', () => {
    if (busy) return;
    phiAlt = psiAlt = false;
    const from = { ...angles };
    animate({
      dur: 500,
      tick: (e) => {
        angles.phi = from.phi + (HOME.phi - from.phi) * e;
        angles.psi = from.psi + (HOME.psi - from.psi) * e;
        applyAngles();
        updateRead();
      },
    });
  });

  applyAngles();
  updateRead();
}
