// demo-commute.js — 02 节：两次 90° 旋转，顺序不同，落点不同（ij ≠ ji）
// 旋转始终绕**固定的世界轴**进行；机体轴（飞机上的亮箭头）只是被带着走——
// 90° 步进的巧合是：第一步转完，机体蓝 Z 恰好倒在第二步的世界轴上，容易误看成「绕 Z」。
import * as THREE from 'three';
import { createScene, buildGizmo, quatReadout, qAxisAngleDeg, animate, worldAxes, stepAxisMark, C } from './scene-kit.js';

const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const qX = qAxisAngleDeg(AX, 90);
const qY = qAxisAngleDeg(AY, 90);

// 复位后的说明文案（与 index.html 的 #commute-note 初始内容保持一致）
const COMMUTE_NOTE_HTML =
  '<strong>试一试：</strong>两条路径各跑一遍。<strong>两步都绕固定的世界轴</strong>（场景里细长的三根）转，' +
  '飞机上亮的彩色轴只是被带着走——第二步看起来像在绕蓝 Z 转，只是因为第一步转完后飞机的 Z 箭头恰好倒在了世界 Y 上；' +
  '发光的轴线与环形箭头会标出每一步真正绕转的轴。最后对比<strong>飞机自己的绿 Y 箭头</strong>：' +
  '一条路指向 <span class="m">+X</span>，另一条指向 <span class="m">+Z</span>。' +
  '旋转不对易；四元数的乘法 <span class="m">j⊗i = −k</span> 忠实地记住了这一点——这不是缺陷，是它「懂」旋转的证据。';

export function initCommute() {
  const root = document.querySelector('[data-demo="commute"]');
  const canvas = root.querySelector('canvas');
  const formulaEl = root.querySelector('#commute-formula');
  const noteEl = document.querySelector('#commute-note');
  const readout = quatReadout(document.querySelector('#commute-readout'));

  const { scene, invalidate } = createScene(canvas);
  scene.add(worldAxes());
  const gizmo = buildGizmo(1.05);
  scene.add(gizmo);
  const marks = {
    X: stepAxisMark(AX, C.x, '绕 X 90°'),
    Y: stepAxisMark(AY, C.y, '绕 Y 90°'),
  };
  scene.add(marks.X, marks.Y);

  let cur = new THREE.Quaternion();   // 当前姿态
  let cancel = null;

  // 合成顺序约定：先 p 后 q ⇒ q⊗p（对向量做 q( p v p⁻¹ )q⁻¹）
  function applyStep(stepQ, axisKey, onDone) {
    const start = cur.clone();
    const target = new THREE.Quaternion().multiplyQuaternions(stepQ, cur);
    marks[axisKey].visible = true;
    invalidate();
    cancel?.();
    cancel = animate({
      dur: 760,
      tick: (e) => {
        cur.slerpQuaternions(start, target, e);
        gizmo.quaternion.copy(cur);
        readout.set(cur);
        invalidate();
      },
      done: () => { cur = target; marks[axisKey].visible = false; onDone?.(); },
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
          (seq[0] === 'X' ? '<strong>先绕 X、再绕 Y（都是世界轴）：</strong>' : '<strong>先绕 Y、再绕 X（都是世界轴）：</strong>') +
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
        invalidate();
      },
      done: () => {
        cur = target;
        formulaEl.textContent = 'q = I';
        noteEl.innerHTML = COMMUTE_NOTE_HTML;
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
}
