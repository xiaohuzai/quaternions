// demo-peptide.js — 肽键的刚性：什么能转（φ/ψ 铰链），什么不能（ω 被部分双键锁死）
// 三个按钮分别绕三根键试转：φ/ψ 在两个规范位姿间摆动且肽平面保持共面；
// ω 只允许弹开几度就弹回，此时 Cα′ 会翘出肽平面薄膜——「非平面构型」直接可见
import * as THREE from 'three';
import { createScene, animate, vecArrow, DEG } from './scene-kit.js';
import { makeAtom, COL } from './backbone-geom.js';

const UP = new THREE.Vector3(0, 1, 0);
const KEYS = ['Ci', 'Nn', 'O', 'CAi', 'H', 'CAn', 'stub1', 'stub2'];

// 平面构型（trans，ω=180°）的基准布局：肽键 C–N 沿 +x 摆平
const base = {
  Ci: new THREE.Vector3(0, 0, 0),
  Nn: new THREE.Vector3(1.33, 0, 0),
  O: new THREE.Vector3(1.23 * Math.cos(123 * DEG), 1.23 * Math.sin(123 * DEG), 0),
  CAi: new THREE.Vector3(1.53 * Math.cos(-117 * DEG), 1.53 * Math.sin(-117 * DEG), 0),
  H: new THREE.Vector3(1.33 + 0.99 * Math.cos(-120 * DEG), 0.99 * Math.sin(-120 * DEG), 0),
  CAn: new THREE.Vector3(1.33 + 1.46 * Math.cos(58.3 * DEG), 1.46 * Math.sin(58.3 * DEG), 0),
  stub1: new THREE.Vector3(-0.69, -1.36, 0).add(new THREE.Vector3(-0.38, -0.34, 0)),
  stub2: new THREE.Vector3(1.33 + 1.46 * Math.cos(58.3 * DEG), 1.46 * Math.sin(58.3 * DEG), 0).add(new THREE.Vector3(0.38, 0.34, 0)),
};

// 规范位姿（按钮在两档间切换，不会越点越乱）
const HOME = { phi: -57, psi: -47, omega: 0 };
const ALT = { phi: -7, psi: -7 };

export function initPeptide() {
  const root = document.querySelector('[data-demo="peptide"]');
  const canvas = root.querySelector('canvas');
  const readEl = root.querySelector('#pp-read');
  const warnEl = root.querySelector('#pp-warn');

  const { scene, invalidate } = createScene(canvas, { cam: [1.2, 1.6, 7.4], target: [0.55, 0.05, 0] });

  // —— 原子（球径统一 ≈ 键径 3 倍）——
  const spec = {
    Ci: [0.17, COL.C], Nn: [0.17, COL.N], CAi: [0.18, COL.CA], CAn: [0.17, COL.CA],
    O: [0.15, COL.O], H: [0.08, 0xe8e8e8], stub1: [0.08, 0x8d97a3], stub2: [0.08, 0x8d97a3],
  };
  const pos = {};
  const meshes = {};
  for (const k of KEYS) {
    pos[k] = base[k].clone();
    meshes[k] = makeAtom(spec[k][0], spec[k][1]);
    scene.add(meshes[k]);
  }

  // —— 键（持久网格，每帧按当前原子位置摆放）——
  const matFor = {};
  const bondMat = (c) => (matFor[c] ??= new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }));
  const bonds = [];
  const addBond = (a, b, color, r = 0.055, lines = 1) => {
    const meshes2 = [];
    for (let i = 0; i < lines; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), bondMat(color));
      scene.add(m);
      meshes2.push(m);
    }
    bonds.push({ a, b, r, lines, meshes: meshes2 });
  };
  addBond('CAi', 'Ci', 0x8d97a3);        // ψ 的铰链轴（可转）
  addBond('Nn', 'CAn', 0x8d97a3);        // φ 的下游
  addBond('Nn', 'H', 0xb9c2cc, 0.03);
  addBond('CAi', 'stub1', 0x8d97a3, 0.04);
  addBond('CAn', 'stub2', 0x8d97a3, 0.04);
  addBond('Ci', 'O', 0xe5626a, 0.034, 2);   // C=O
  addBond('Ci', 'Nn', 0xd99a4e, 0.034, 2);  // 肽键 C–N（ω 的锁死轴）
  const peptideMat = bondMat(0xd99a4e);

  // —— 肽平面薄膜（由 C、O、N 三点定义，适度放大）——
  const film = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ color: 0x54626f, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
  );
  scene.add(film);

  // 铰链轴线（动画期间显现；ω 用禁止红）
  const axisPhi = tubeAxis(base.Nn, base.CAi, 0x54b06a);
  const axisPsi = tubeAxis(base.CAi, base.Ci, 0x5c7cf0);
  const axisOmega = tubeAxis(base.Ci, base.Nn, 0xe5626a);
  for (const a of [axisPhi, axisPsi, axisOmega]) { a.visible = false; scene.add(a); }
  function tubeAxis(a, b, color) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, dir.length() + 0.4, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    return m;
  }

  const angles = { ...HOME };

  function applyAngles() {
    for (const k of KEYS) pos[k].copy(base[k]);
    const rot = (from, to, deg, keys) => {
      if (!deg) return;
      const axis = new THREE.Vector3().subVectors(base[to], base[from]).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(axis, deg * DEG);
      for (const k of keys) pos[k].sub(base[from]).applyQuaternion(q).add(base[from]);
    };
    // 嵌套顺序：ω 最内（只动 H/Cα′/下游），再 ψ，再 φ（最外）
    rot('Ci', 'Nn', angles.omega, ['H', 'CAn', 'stub2']);
    rot('CAi', 'Ci', angles.psi, ['O', 'Nn', 'H', 'CAn', 'stub2']);
    rot('Nn', 'CAi', angles.phi, ['Ci', 'O', 'Nn', 'H', 'CAn', 'stub2']);

    for (const k of KEYS) meshes[k].position.copy(pos[k]);

    for (const bd of bonds) {
      const pa = pos[bd.a], pb = pos[bd.b];
      const mid = new THREE.Vector3().add(pa, pb).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(pb, pa);
      const len = dir.length();
      dir.normalize();
      if (bd.lines === 1) {
        const [m] = bd.meshes;
        m.scale.set(1, len, 1);
        m.position.copy(mid);
        m.quaternion.setFromUnitVectors(UP, dir);
      } else {
        const perp = Math.abs(dir.y) < 0.9
          ? new THREE.Vector3().crossVectors(dir, UP).normalize()
          : new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();
        bd.meshes.forEach((m, i) => {
          const off = (i === 0 ? -1 : 1) * 0.07;
          m.scale.set(1, len * 0.94, 1);
          m.position.copy(mid).addScaledVector(perp, off);
          m.quaternion.setFromUnitVectors(UP, dir);
        });
      }
    }

    // 肽平面薄膜：C、O、N 三点定平面，适度放大
    const g = new THREE.Vector3().add(pos.Ci, pos.O).add(pos.Nn).multiplyScalar(1 / 3);
    const tri = [pos.Ci, pos.O, pos.Nn].map((p) => g.clone().addScaledVector(new THREE.Vector3().subVectors(p, g), 1.55));
    film.geometry.dispose();
    const fg = new THREE.BufferGeometry().setFromPoints(tri);
    fg.setIndex([0, 1, 2]);
    film.geometry = fg;
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
  root.querySelector('#pp-omega').addEventListener('click', () => swing('omega', 6));
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
