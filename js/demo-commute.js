// demo-commute.js — 02 节：两次 90° 旋转，顺序不同，落点不同（ij ≠ ji）
import * as THREE from 'three';
import { createScene, buildGizmo, quatReadout, qAxisAngleDeg, animate } from './scene-kit.js';

const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const qX = qAxisAngleDeg(AX, 90);
const qY = qAxisAngleDeg(AY, 90);

export function initCommute() {
  const root = document.querySelector('[data-demo="commute"]');
  const canvas = root.querySelector('canvas');
  const formulaEl = root.querySelector('#commute-formula');
  const noteEl = document.querySelector('#commute-note');
  const readout = quatReadout(document.querySelector('#commute-readout'));

  const { scene, onFrame } = createScene(canvas);
  const gizmo = buildGizmo(1.05);
  scene.add(gizmo);

  let cur = new THREE.Quaternion();   // 当前姿态
  let cancel = null;

  // 合成顺序约定：先 p 后 q ⇒ q⊗p（对向量做 q( p v p⁻¹ )q⁻¹）
  function applyStep(stepQ, label, onDone) {
    const start = cur.clone();
    const target = new THREE.Quaternion().multiplyQuaternions(stepQ, cur);
    cancel?.();
    cancel = animate({
      dur: 760,
      tick: (e) => {
        cur.slerpQuaternions(start, target, e);
        gizmo.quaternion.copy(cur);
        readout.set(cur);
      },
      done: () => { cur = target; onDone?.(); },
    });
  }

  function formulaFor(seq) {
    // seq = ['X','Y'] 表示先 X 后 Y ⇒ 合成 q_Y ⊗ q_X
    const named = seq.map((s) => `q_${s === 'X' ? 'X' : 'Y'}`).reverse().join(' ⊗ ');
    return `q = ${named}`;
  }

  function axisHint(Q) {
    const v = new THREE.Vector3(0, 1, 0).applyQuaternion(Q);
    if (v.x > 0.9) return '绿色 Y 轴现在指向 <span class="m">+X</span>';
    if (v.z > 0.9) return '绿色 Y 轴现在指向 <span class="m">+Z</span>';
    if (v.x < -0.9) return '绿色 Y 轴现在指向 <span class="m">−X</span>';
    if (v.z < -0.9) return '绿色 Y 轴现在指向 <span class="m">−Z</span>';
    return '';
  }

  function run(seq) {
    const buttons = root.querySelectorAll('.btn');
    buttons.forEach((b) => (b.disabled = true));
    let i = 0;
    const next = () => {
      if (i >= seq.length) {
        formulaEl.innerHTML = formulaFor(seq);
        const hint = axisHint(cur);
        noteEl.innerHTML =
          (seq[0] === 'X' ? '<strong>先 X 后 Y：</strong>' : '<strong>先 Y 后 X：</strong>') +
          (hint || '姿态已更新。') +
          '。换另一条路径跑一遍，对比落点——两个 <span class="m">90°</span> 而已，顺序一换，结局不同。';
        buttons.forEach((b) => (b.disabled = false));
        return;
      }
      const stepQ = seq[i] === 'X' ? qX : qY;
      applyStep(stepQ, seq[i], () => { i += 1; next(); });
    };
    next();
  }

  function reset() {
    const buttons = root.querySelectorAll('.btn');
    buttons.forEach((b) => (b.disabled = true));
    const start = cur.clone();
    const target = new THREE.Quaternion();
    cancel?.();
    cancel = animate({
      dur: 420,
      tick: (e) => {
        cur.slerpQuaternions(start, target, e);
        gizmo.quaternion.copy(cur);
        readout.set(cur);
      },
      done: () => {
        cur = target;
        formulaEl.textContent = 'q = I';
        noteEl.innerHTML =
          '<strong>试一试：</strong>两条路径各跑一遍，盯住<strong>绿色的 Y 轴</strong>最后指向哪里——' +
          '一条路落在 <span class="m">+X</span>，另一条落在 <span class="m">+Z</span>。' +
          '旋转本身就不对易；四元数的乘法 <span class="m">j⊗i = −k</span> 忠实地记住了这一点。' +
          '这不是缺陷，是它「懂」旋转的证据。';
        buttons.forEach((b) => (b.disabled = false));
      },
    });
  }

  root.querySelectorAll('.btn').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.run === 'reset') reset();
      else run(b.dataset.run === 'xy' ? ['X', 'Y'] : ['Y', 'X']);
    });
  });

  readout.set(cur);
  onFrame(() => {}); // 控制器阻尼由 createScene 内部处理
}
