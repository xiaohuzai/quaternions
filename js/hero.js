// hero.js — 首屏：两个残基的原子骨架缓慢环绕展示，读数条显示残基 2 的朝向 q
import * as THREE from 'three';
import { createScene, quatReadout } from './scene-kit.js';
import { computeChain, residueFrame, makeAtom, makeBond, setBond, COL } from './backbone-geom.js';

export function initHero() {
  const canvas = document.querySelector('#hero-canvas');
  if (!canvas) return;
  const readout = quatReadout(document.querySelector('#hero-readout'));

  const { scene, controls } = createScene(canvas, {
    cam: [3.2, 2.6, 6.2],
    target: [0, 1.6, 0],
    grid: false,
    autoRotate: true,
  });

  const chain = computeChain({ psi: -47, omega: 180, phi: -57, chi1: 60, chi2: -60, chi3: 60, chi4: -60 });
  const bbPairs = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];
  const scPairs = [[4, 0], [0, 1], [1, 2], [2, 3], [3, 4]];

  ['N', 'CA', 'C', 'N', 'CA', 'C'].forEach((k, i) => {
    const m = makeAtom(k === 'CA' ? 0.22 : 0.19, COL[k]);
    m.position.copy(chain.bb[i]);
    scene.add(m);
  });
  for (const [a, b] of bbPairs) {
    const m = makeBond(0x8d97a3);
    setBond(m, chain.bb[a], chain.bb[b]);
    scene.add(m);
  }
  chain.sc.forEach((p) => { const m = makeAtom(0.16, COL.S); m.position.copy(p); scene.add(m); });
  for (const [a, b] of scPairs) {
    const m = makeBond(0x3f7352);
    setBond(m, a === 4 ? chain.bb[4] : chain.sc[a], chain.sc[b]);
    scene.add(m);
  }
  chain.o.forEach((p) => {
    const m = makeAtom(0.18, COL.O);
    m.position.copy(p);
    scene.add(m);
  });
  for (const [bond, from, to] of [[0x9a5258, chain.bb[2], chain.o[0]], [0x9a5258, chain.bb[5], chain.o[1]]]) {
    const m = makeBond(bond);
    setBond(m, from, to);
    scene.add(m);
  }

  readout.set(residueFrame(chain.bb[3], chain.bb[4], chain.bb[5]));

  // 减少动态偏好下不自动转相机
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    controls.autoRotate = false;
  }
}
