// demo-backbone.js — 07 节：AlphaFold 输出的「残基身份证」
// 骨架变换 t(3)+q(4) 与 7 个扭转角 ω/φ/ψ/χ1-4 —— 用内部坐标实时重建原子
import * as THREE from 'three';
import { createScene, quatReadout, textSprite, DEG } from './scene-kit.js';

// Engh–Huber 近似几何
const B = { nCa: 1.458, caC: 1.525, cN: 1.329, sc: 1.52 };
const A = { nCaC: 111.2, caCN: 116.2, cNCa: 121.7, sc: 109.5, caCb: 110.5 };

// 经典 NeRF：给 A,B,C 与 键长|CD|、键角∠BCD、二面角ABCD，放 D
// （sin 的 n 分量取正号 —— 二面角符号与 IUPAC 约定一致，数值验证过）
function placeAtom(av, bv, cv, bond, angleDeg, dihedralDeg) {
  const bc = new THREE.Vector3().subVectors(cv, bv).normalize();
  const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(av, bv), bc).normalize();
  const nbc = new THREE.Vector3().crossVectors(n, bc).normalize();
  const a = angleDeg * DEG, t = dihedralDeg * DEG;
  return new THREE.Vector3()
    .addScaledVector(bc, -bond * Math.cos(a))
    .addScaledVector(nbc, -bond * Math.sin(a) * Math.cos(t))
    .addScaledVector(n, bond * Math.sin(a) * Math.sin(t))
    .add(cv);
}

const Y = new THREE.Vector3(0, 1, 0);
const COL = { N: 0x5c7cf0, CA: 0xd8d2c4, C: 0xd99a4e, S: 0x54b06a };

function makeAtom(radius, color) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 14),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.08 })
  );
  return m;
}
function makeBond(color) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05 })
  );
  return m;
}
function setBond(mesh, p, q) {
  const dir = new THREE.Vector3().subVectors(q, p);
  const len = dir.length();
  mesh.scale.set(1, len, 1);
  mesh.position.copy(p).add(q).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y, dir.normalize());
}

export function initBackbone() {
  const root = document.querySelector('[data-demo="backbone"]');
  const canvas = root.querySelector('canvas');
  const sliders = {
    psi: root.querySelector('#bb-psi'),
    omega: root.querySelector('#bb-omega'),
    phi: root.querySelector('#bb-phi'),
  };
  const vals = {
    psi: root.querySelector('#bb-psi-val'),
    omega: root.querySelector('#bb-omega-val'),
    phi: root.querySelector('#bb-phi-val'),
  };
  const chiRows = [1, 2, 3, 4].map((i) => ({
    row: root.querySelector(`#bb-chi${i}-row`),
    slider: root.querySelector(`#bb-chi${i}`),
    val: root.querySelector(`#bb-chi${i}-val`),
  }));
  const tEl = root.querySelector('#bb-t');
  const readout = quatReadout(root.querySelector('#bb-q'));
  const countBtns = [...root.querySelectorAll('[data-chi]')];

  const { scene, onFrame } = createScene(canvas, { cam: [4.6, 3.8, 8.2], target: [0, 2.0, 0] });

  // —— 网格对象：骨架 6 原子 + 侧链 5 原子 ——
  const bbNames = ['N1', 'CA1', 'C1', 'N2', 'CA2', 'C2'];
  const bbKind = ['N', 'CA', 'C', 'N', 'CA', 'C'];
  const atoms = bbNames.map((_, i) => makeAtom(bbKind[i] === 'CA' ? 0.2 : 0.17, COL[bbKind[i]]));
  const scAtoms = ['CB', 'CG', 'CD', 'CE', 'CZ'].map(() => makeAtom(0.145, COL.S));
  const bbBonds = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]].map(() => makeBond(0x8d97a3));
  // -1 代表骨架上的 CA2（pos[4]）
  const scBondPairs = [[-1, 0], [0, 1], [1, 2], [2, 3], [3, 4]];
  const scBonds = scBondPairs.map(() => makeBond(0x3f7352));

  atoms.forEach((m) => scene.add(m));
  scAtoms.forEach((m) => scene.add(m));
  bbBonds.forEach((m) => scene.add(m));
  scBonds.forEach((m) => scene.add(m));

  // 残基 2 的局部坐标系三轴（AF 的 frame：x→C，z 指向 N 侧）
  const frame = new THREE.Group();
  const fAxis = (dir, color) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 8), mat);
    shaft.position.y = 0.17;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 10), mat);
    head.position.y = 0.4;
    g.add(shaft, head);
    g.quaternion.setFromUnitVectors(Y, dir);
    return g;
  };
  frame.add(
    fAxis(new THREE.Vector3(1, 0, 0), COL.C),
    fAxis(new THREE.Vector3(0, 1, 0), COL.S),
    fAxis(new THREE.Vector3(0, 0, 1), COL.N)
  );
  scene.add(frame);

  // 链起点：CA1 固定在原点，N1/C1 在 xy 平面张开
  const CA1 = new THREE.Vector3(0, 0, 0);
  const N1 = new THREE.Vector3(1.458, 0, 0);
  const C1 = new THREE.Vector3(Math.cos(111.2 * DEG), Math.sin(111.2 * DEG), 0).multiplyScalar(1.525);

  const pos = new Array(6).fill(null).map(() => new THREE.Vector3());
  const scPos = new Array(5).fill(null).map(() => new THREE.Vector3());

  function computeAtoms() {
    const psi = Number(sliders.psi.value);
    const omega = Number(sliders.omega.value);
    const phi = Number(sliders.phi.value);
    vals.psi.textContent = `${psi}°`;
    vals.omega.textContent = `${omega}°`;
    vals.phi.textContent = `${phi}°`;

    pos[0].copy(N1); pos[1].copy(CA1); pos[2].copy(C1);
    // ψ₁: N1-CA1-C1-N2；ω₁: CA1-C1-N2-CA2；φ₂: C1-N2-CA2-C2
    pos[3].copy(placeAtom(N1, CA1, C1, B.cN, A.caCN, psi));
    pos[4].copy(placeAtom(CA1, C1, pos[3], B.nCa, A.cNCa, omega));
    pos[5].copy(placeAtom(C1, pos[3], pos[4], B.caC, A.nCaC, phi));

    // 侧链挂在 CA2 上：CB 取标准四面体构象，χk 逐键外推
    scPos[0].copy(placeAtom(pos[3], pos[5], pos[4], B.sc, A.caCb, 122.6));
    // χ1: N2-CA2-CB-CG；χ2: CA2-CB-CG-CD；χ3: CB-CG-CD-CE；χ4: CG-CD-CE-CZ
    scPos[1].copy(placeAtom(pos[3], pos[4], scPos[0], B.sc, A.sc, Number(chiRows[0].slider.value)));
    for (let k = 2; k <= 4; k++) {
      const aPrev = k === 2 ? pos[4] : scPos[k - 3];
      scPos[k].copy(placeAtom(aPrev, scPos[k - 2], scPos[k - 1], B.sc, A.sc, Number(chiRows[k - 1].slider.value)));
    }

    atoms.forEach((m, i) => m.position.copy(pos[i]));
    bbBonds.forEach((m, i) => {
      const [a, b] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]][i];
      setBond(m, pos[a], pos[b]);
    });

    // χ 数量选择
    const count = Number(root.querySelector('[data-chi][aria-pressed="true"]').dataset.chi);
    scAtoms.forEach((m, i) => (m.visible = i < count + 1 && count > 0));
    scBonds.forEach((m, i) => (m.visible = i < count + 1 && count > 0));
    chiRows.forEach((r, i) => (r.row.style.display = i < count ? 'flex' : 'none'));
    if (count > 0) {
      scBondPairs.forEach(([a, b], i) => {
        if (i < count + 1) setBond(scBonds[i], a < 0 ? pos[4] : scPos[a], scPos[b]);
      });
    }

    // frame（AF 约定的近似）：x = CA→C，y ⊥ x 朝 N，z = x×y
    const x = new THREE.Vector3().subVectors(pos[5], pos[4]).normalize();
    const y0 = new THREE.Vector3().subVectors(pos[3], pos[4]);
    const y = y0.clone().addScaledVector(x, -y0.dot(x)).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    frame.position.copy(pos[4]);
    frame.quaternion.copy(q);

    // 身份证读数：t = CA2 的位置（3 个数），q = 朝向（4 个数）
    tEl.innerHTML = `t = (<span class="fa">${pos[4].x.toFixed(2)}</span>, <span class="fa">${pos[4].y.toFixed(2)}</span>, <span class="fa">${pos[4].z.toFixed(2)}</span>) Å`;
    readout.set(q);
  }

  for (const s of Object.values(sliders)) s.addEventListener('input', computeAtoms);
  for (const r of chiRows) r.slider.addEventListener('input', computeAtoms);
  countBtns.forEach((b) =>
    b.addEventListener('click', () => {
      countBtns.forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      computeAtoms();
    })
  );

  // 预设：拉马钱德丹图上的两个著名区域
  root.querySelector('#bb-alpha').addEventListener('click', () => {
    sliders.psi.value = -47; sliders.phi.value = -57;
    computeAtoms();
  });
  root.querySelector('#bb-beta').addEventListener('click', () => {
    sliders.psi.value = 135; sliders.phi.value = -135;
    computeAtoms();
  });

  computeAtoms();

  // 原子标签（残基 2 的三个骨架原子），跟随原子移动
  const tags = [
    ['N₂', '#5c7cf0', 3], ['Cα₂', '#d8d2c4', 4], ['C₂', '#d99a4e', 5],
  ].map(([text, color, idx]) => {
    const sp = textSprite(text, color, { scale: 0.34, italic: false, size: 64, font: '600 56px Georgia, serif' });
    scene.add(sp);
    return [sp, idx];
  });
  onFrame(() => {
    for (const [sp, idx] of tags) sp.position.copy(pos[idx]).add(new THREE.Vector3(0, 0.45, 0));
  });
}
