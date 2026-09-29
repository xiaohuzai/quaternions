// demo-backbone.js — 「骨架折叠机」：φ/ψ/ω/χ 实时重建两个残基的原子
// 几何内核在 backbone-geom.js；本模块只管网格、高亮与解说
import * as THREE from 'three';
import { createScene, quatReadout, textSprite, animate } from './scene-kit.js';
import {
  computeChain, residueFrame, makeAtom, makeBond, setBond, makeBondPair, setBondPair,
  COL, RAD, BCOL,
} from './backbone-geom.js';

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
  const explainEl = root.querySelector('#bb-explain');
  const readout = quatReadout(root.querySelector('#bb-q'));
  const countBtns = [...root.querySelectorAll('[data-chi]')];

  const { scene, invalidate } = createScene(canvas, { cam: [4.6, 3.8, 8.2], target: [0, 2.0, 0] });

  // —— 网格对象：骨架 6 原子 + 侧链 5 原子 + 羰基 O×2（球径/球色取共享表）——
  const atoms = ['N', 'CA', 'C', 'N', 'CA', 'C'].map((k) => makeAtom(RAD[k], COL[k]));
  const scAtoms = [0, 1, 2, 3, 4].map(() => makeAtom(RAD.SC, COL.S));
  const oAtoms = [makeAtom(RAD.O, COL.O), makeAtom(RAD.O, COL.O)];
  const bbPairs = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];
  const bbBonds = bbPairs.map(() => makeBond(BCOL.bb));
  // -1 代表骨架上的 CA2（pos[4]）
  const scBondPairs = [[-1, 0], [0, 1], [1, 2], [2, 3], [3, 4]];
  const scBonds = scBondPairs.map(() => makeBond(BCOL.sc));
  // 羰基 C=O：全站统一红色双线
  const oPairs = [makeBondPair(BCOL.co), makeBondPair(BCOL.co)];

  [...atoms, ...scAtoms, ...oAtoms, ...bbBonds, ...scBonds, ...oPairs.flat()].forEach((m) => scene.add(m));

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
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return g;
  };
  frame.add(
    fAxis(new THREE.Vector3(1, 0, 0), COL.C),
    fAxis(new THREE.Vector3(0, 1, 0), COL.S),
    fAxis(new THREE.Vector3(0, 0, 1), COL.N)
  );
  scene.add(frame);

  function computeAtoms() {
    const psi = Number(sliders.psi.value);
    const omega = Number(sliders.omega.value);
    const phi = Number(sliders.phi.value);
    vals.psi.textContent = `${psi}°`;
    vals.omega.textContent = `${omega}°`;
    vals.phi.textContent = `${phi}°`;
    const chis = chiRows.map((r) => Number(r.slider.value));
    chiRows.forEach((r, i) => (r.val.textContent = `${chis[i]}°`));

    const { bb: pos, sc: scPos, o: oPos } = computeChain({ psi, omega, phi, chi1: chis[0], chi2: chis[1], chi3: chis[2], chi4: chis[3] });

    atoms.forEach((m, i) => m.position.copy(pos[i]));
    bbBonds.forEach((m, i) => setBond(m, pos[bbPairs[i][0]], pos[bbPairs[i][1]]));

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

    oAtoms.forEach((m, i) => m.position.copy(oPos[i]));
    setBondPair(oPairs[0], pos[2], oPos[0]);
    setBondPair(oPairs[1], pos[5], oPos[1]);

    const q = residueFrame(pos[3], pos[4], pos[5]);
    frame.position.copy(pos[4]);
    frame.quaternion.copy(q);

    // 身份证读数：t = CA2 的位置（3 个数），q = 朝向（4 个数）
    tEl.innerHTML = `t = (<span class="fa">${pos[4].x.toFixed(2)}</span>, <span class="fa">${pos[4].y.toFixed(2)}</span>, <span class="fa">${pos[4].z.toFixed(2)}</span>) Å`;
    readout.set(q);

    // 原子标签跟随原子移动
    for (const [sp, idx] of tags) sp.position.copy(pos[idx]).add(new THREE.Vector3(0, 0.45, 0));
    invalidate();
  }

  // —— 扭转角高亮：四个原子 + 旋转轴亮起、其余压暗，配联动解说 ——
  const allMeshes = [...atoms, ...scAtoms, ...bbBonds, ...scBonds, ...oAtoms, ...oPairs.flat()];
  for (const m of allMeshes) m.userData.baseColor = m.material.color.clone();

  const axisRing = new THREE.Group();
  {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd99a4e, emissive: 0xd99a4e, emissiveIntensity: 0.7, roughness: 0.4 });
    const R = 0.55, arc = Math.PI * 1.45;
    const holder = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.024, 8, 40, arc), mat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 10), mat);
    tip.position.set(R * Math.cos(arc), R * Math.sin(arc), 0);
    tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(arc), Math.cos(arc), 0));
    holder.add(ring, tip);
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
    axisRing.add(holder);
    axisRing.visible = false;
    scene.add(axisRing);
  }

  const atomAt = (ref) => (typeof ref === 'number' ? atoms[ref] : scAtoms[Number(ref.slice(1))]);
  const bondAt = (ref) => (ref[0] === 'b' ? bbBonds[Number(ref.slice(1))] : scBonds[Number(ref.slice(1))]);
  const TORSIONS = {
    psi:   { atoms: [0, 1, 2, 3], bond: 'b1', name: 'ψ₁', seq: 'N₁–Cα₁–C₁–N₂', axis: 'Cα₁–C₁' },
    omega: { atoms: [1, 2, 3, 4], bond: 'b2', name: 'ω₁', seq: 'Cα₁–C₁–N₂–Cα₂', axis: 'C₁–N₂（肽键）' },
    phi:   { atoms: [2, 3, 4, 5], bond: 'b3', name: 'φ₂', seq: 'C₁–N₂–Cα₂–C₂', axis: 'N₂–Cα₂' },
    chi1:  { atoms: [3, 4, 's0', 's1'], bond: 's0', name: 'χ₁', seq: 'N₂–Cα₂–Cβ–Cγ', axis: 'Cα₂–Cβ' },
    chi2:  { atoms: [4, 's0', 's1', 's2'], bond: 's1', name: 'χ₂', seq: 'Cα₂–Cβ–Cγ–Cδ', axis: 'Cβ–Cγ' },
    chi3:  { atoms: ['s0', 's1', 's2', 's3'], bond: 's2', name: 'χ₃', seq: 'Cβ–Cγ–Cδ–Cε', axis: 'Cγ–Cδ' },
    chi4:  { atoms: ['s1', 's2', 's3', 's4'], bond: 's3', name: 'χ₄', seq: 'Cγ–Cδ–Cε–Cζ', axis: 'Cδ–Cε' },
  };

  function highlight(key) {
    const t = TORSIONS[key];
    if (!t) return;
    const focus = new Set(t.atoms.map(atomAt));
    const axisBond = bondAt(t.bond);
    focus.add(axisBond);
    for (const m of allMeshes) {
      const base = m.userData.baseColor;
      if (focus.has(m)) {
        m.material.color.copy(base);
        m.material.emissive.copy(base).multiplyScalar(0.35);
      } else {
        m.material.color.copy(base).multiplyScalar(0.16);
        m.material.emissive.set(0x000000);
      }
    }
    axisBond.material.emissive.set(0xd99a4e);
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(axisBond.quaternion);
    axisRing.position.copy(axisBond.position);
    axisRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    axisRing.visible = true;
    explainEl.innerHTML = `<b>${t.name}</b>：二面角 <span class="mono">${t.seq}</span>——绕 <b>${t.axis}</b> 这根键转动。`;
    invalidate();
  }

  function clearHighlight() {
    for (const m of allMeshes) {
      m.material.color.copy(m.userData.baseColor);
      m.material.emissive.set(0x000000);
    }
    axisRing.visible = false;
    explainEl.textContent = '拖动任意一个角的滑块——高亮的就是它对应的四个原子和旋转轴。';
    invalidate();
  }

  const sliderKeys = [
    [sliders.psi, 'psi'], [sliders.omega, 'omega'], [sliders.phi, 'phi'],
    ...chiRows.map((r, i) => [r.slider, `chi${i + 1}`]),
  ];
  for (const [el, key] of sliderKeys) {
    for (const ev of ['pointerenter', 'focus', 'input']) el.addEventListener(ev, () => highlight(key));
  }
  root.addEventListener('pointerleave', clearHighlight);

  for (const s of Object.values(sliders)) s.addEventListener('input', computeAtoms);
  // ω 被肽键锁死：滑块只允许撬开 ~15° 观察，松手弹回 180°（与肽键演示同一要求）
  sliders.omega.addEventListener('change', () => {
    const from = Number(sliders.omega.value);
    if (from === 180) return;
    animate({
      dur: 450,
      tick: (e) => {
        sliders.omega.value = String(Math.round(from + (180 - from) * e));
        computeAtoms();
      },
    });
  });
  for (const r of chiRows) r.slider.addEventListener('input', computeAtoms);
  countBtns.forEach((b) =>
    b.addEventListener('click', () => {
      countBtns.forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      computeAtoms();
    })
  );

  // 预设：拉马钱德兰图上的两个著名区域（走 input 事件，拉马钱德兰图才会同步）
  const setAngles = (psi, phi) => {
    sliders.psi.value = psi;
    sliders.phi.value = phi;
    sliders.psi.dispatchEvent(new Event('input'));
    sliders.phi.dispatchEvent(new Event('input'));
  };
  root.querySelector('#bb-alpha').addEventListener('click', () => setAngles(-47, -57));
  root.querySelector('#bb-beta').addEventListener('click', () => setAngles(135, -135));

  // 原子标签（残基 2 的三个骨架原子）
  const tags = [
    ['N₂', '#5c7cf0', 3], ['Cα₂', '#d8d2c4', 4], ['C₂', '#d99a4e', 5],
  ].map(([text, color, idx]) => {
    const sp = textSprite(text, color, { scale: 0.34, italic: false, size: 64, font: '600 56px Georgia, serif' });
    scene.add(sp);
    return [sp, idx];
  });

  computeAtoms();
}
