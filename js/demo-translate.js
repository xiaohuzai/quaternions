// demo-translate.js — 01 节：同一个朝向，三种写法同步翻译
// 三个滑块改姿态，欧拉角/矩阵/四元数三个面板实时跟着变
import * as THREE from 'three';
import { createScene, buildGizmo, quatReadout, worldAxes, DEG, angleOf } from './scene-kit.js';

const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);

export function initTranslate() {
  const root = document.querySelector('[data-demo="translate"]');
  const canvas = root.querySelector('canvas');
  const sliders = {
    a: root.querySelector('#tr-a'),
    b: root.querySelector('#tr-b'),
    c: root.querySelector('#tr-c'),
  };
  const vals = {
    a: root.querySelector('#tr-a-val'),
    b: root.querySelector('#tr-b-val'),
    c: root.querySelector('#tr-c-val'),
  };
  const eEls = {
    a: root.querySelector('#tr-ea'),
    b: root.querySelector('#tr-eb'),
    c: root.querySelector('#tr-ec'),
  };
  const matrixEl = root.querySelector('#tr-matrix');
  const axisNoteEl = root.querySelector('#tr-axisnote');
  const readout = quatReadout(root.querySelector('#tr-readout'));

  const { scene, invalidate } = createScene(canvas, { cam: [3.4, 2.5, 4.8] });
  scene.add(worldAxes());
  const gizmo = buildGizmo(1.05);
  scene.add(gizmo);

  const fmt = (n) => (n >= 0 ? ' ' : '−') + Math.abs(n).toFixed(3);
  const fmtDeg = (n) => `${Math.round(n)}°`;

  function sync() {
    const a = Number(sliders.a.value);
    const b = Number(sliders.b.value);
    const c = Number(sliders.c.value);
    vals.a.textContent = fmtDeg(a);
    vals.b.textContent = fmtDeg(b);
    vals.c.textContent = fmtDeg(c);
    eEls.a.textContent = fmtDeg(a);
    eEls.b.textContent = fmtDeg(b);
    eEls.c.textContent = fmtDeg(c);

    // 顺序约定：先绕 X，再绕 Y，最后绕 Z（世界轴）⇒ q = qz ⊗ qy ⊗ qx
    const qx = new THREE.Quaternion().setFromAxisAngle(AX, a * DEG);
    const qy = new THREE.Quaternion().setFromAxisAngle(AY, b * DEG);
    const qz = new THREE.Quaternion().setFromAxisAngle(AZ, c * DEG);
    const q = new THREE.Quaternion().multiplyQuaternions(qz, qy).multiply(qx);
    gizmo.quaternion.copy(q);
    readout.set(q);

    // 矩阵（three 的 Matrix4 元素按列主序存放）
    const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
    const e = m.elements;
    const cell = (r, cIdx, cls) => `<span class="${cls}">${fmt(e[cIdx * 4 + r])}</span>`;
    matrixEl.innerHTML = [
      [cell(0, 0, 'fx'), cell(0, 1, 'fy'), cell(0, 2, 'fz')],
      [cell(1, 0, 'fx'), cell(1, 1, 'fy'), cell(1, 2, 'fz')],
      [cell(2, 0, 'fx'), cell(2, 1, 'fy'), cell(2, 2, 'fz')],
    ].map((row) => row.join(' ')).join('<br>');

    // 轴角注释：θ 与 n̂
    const theta = angleOf(q) / DEG;
    const s = Math.sin(angleOf(q) / 2);
    if (Math.abs(s) < 1e-6) {
      axisNoteEl.textContent = 'θ = 0°（没有转）';
    } else {
      const n = new THREE.Vector3(q.x / s, q.y / s, q.z / s);
      axisNoteEl.textContent =
        `θ = ${theta.toFixed(1)}°，n̂ = (${n.x.toFixed(2)}, ${n.y.toFixed(2)}, ${n.z.toFixed(2)})`;
    }
    invalidate();
  }

  for (const s of Object.values(sliders)) s.addEventListener('input', sync);
  root.querySelector('#tr-example').addEventListener('click', () => {
    sliders.a.value = 0;
    sliders.b.value = 0;
    sliders.c.value = 30;
    sync();
  });

  sync();
}
