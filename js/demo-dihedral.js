// demo-dihedral.js — 02 节：四个原子的二面角，拖滑块绕 B–C 转，看 A 端与 D 端的夹角
import * as THREE from 'three';
import { createScene, animate } from './scene-kit.js';
import { placeAtom, makeAtom, makeBond, setBond } from './backbone-geom.js';

const A = new THREE.Vector3(-2.1, 0.5, 0);
const B = new THREE.Vector3(-0.7, -0.35, 0);
const C = new THREE.Vector3(0.7, 0.35, 0);

export function initDihedral() {
  const root = document.querySelector('[data-demo="dihedral"]');
  const canvas = root.querySelector('canvas');
  const slider = root.querySelector('#dh-angle');
  const valEl = root.querySelector('#dh-angle-val');
  const readEl = root.querySelector('#dh-read');

  const { scene, invalidate } = createScene(canvas, { cam: [3.6, 2.8, 5.6], target: [-0.2, 0, 0] });

  const atoms = [
    makeAtom(0.19, 0x61707f), // A
    makeAtom(0.19, 0x8d97a3), // B
    makeAtom(0.19, 0x8d97a3), // C
    makeAtom(0.19, 0x61707f), // D
  ];
  const bonds = [makeBond(0x8d97a3), makeBond(0xd99a4e), makeBond(0x8d97a3)];
  atoms.forEach((m) => scene.add(m));
  bonds.forEach((m) => scene.add(m));

  // 旋转轴指示：绕 B–C 的琥珀环
  const axisRing = new THREE.Group();
  {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd99a4e, emissive: 0xd99a4e, emissiveIntensity: 0.55, roughness: 0.4 });
    const R = 0.72, arc = Math.PI * 1.5;
    const holder = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.022, 8, 40, arc), mat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 10), mat);
    tip.position.set(R * Math.cos(arc), R * Math.sin(arc), 0);
    tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(arc), Math.cos(arc), 0));
    holder.add(ring, tip);
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0));
    axisRing.add(holder);
    scene.add(axisRing);
  }

  function sync() {
    const deg = Number(slider.value);
    valEl.textContent = `${deg}°`;
    const D = placeAtom(A, B, C, 1.45, 110, deg);
    atoms[0].position.copy(A);
    atoms[1].position.copy(B);
    atoms[2].position.copy(C);
    atoms[3].position.copy(D);
    setBond(bonds[0], A, B);
    setBond(bonds[1], B, C);
    setBond(bonds[2], C, D);
    const dir = new THREE.Vector3().subVectors(C, B).normalize();
    axisRing.position.copy(B).add(C).multiplyScalar(0.5);
    axisRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const shown = deg.toFixed(0).replace('-', '−');
    readEl.innerHTML =
      `二面角 A–B–C–D = <span class="fa">${shown}°</span>　（绕 <b>B–C</b> 转，A 端与 D 端的夹角）`;
    invalidate();
  }

  slider.addEventListener('input', sync);

  // 入场时给一个有存在感的初值（顺-顺式 60°，画面立体）
  slider.value = 60;
  sync();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const t0 = 60;
    animate({
      dur: 1100,
      tick: (e) => { slider.value = Math.round(t0 + e * 100); sync(); },
    });
  }
}
