// demo-halfangle.js — 03 节：q = [cos(θ/2), sin(θ/2)n̂]，q 与 −q 双覆盖
import * as THREE from 'three';
import { createScene, buildGizmo, quatReadout, negQ, textSprite, REDUCED_MOTION } from './scene-kit.js';

const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};
const SPIN_SPEED = 55; // 播放时 θ 的角速度（度/秒）

export function initHalfangle() {
  const root = document.querySelector('[data-demo="halfangle"]');
  const canvas = root.querySelector('canvas');
  const slider = root.querySelector('#half-angle');
  const valEl = root.querySelector('#half-angle-val');
  const playBtn = root.querySelector('#half-play');
  const formulaEl = root.querySelector('#half-formula');
  const rulerEl = root.querySelector('#half-ruler');
  const readout = quatReadout(root.querySelector('#half-readout'));

  const { scene, onFrame, invalidate } = createScene(canvas, { cam: [4.4, 2.6, 6.0], target: [0, 0.1, 0] });

  // 左：q 驱动；右：−q 驱动
  const gL = buildGizmo(0.95); gL.position.x = -1.15;
  const gR = buildGizmo(0.95); gR.position.x = 1.15;
  const lblL = textSprite('q', '#f0ead8', { scale: 0.42 });
  lblL.position.set(-1.15, 1.35, 0);
  const lblR = textSprite('−q', '#d99a4e', { scale: 0.42 });
  lblR.position.set(1.15, 1.35, 0);
  scene.add(gL, gR, lblL, lblR);

  let theta = 0; // 度
  let axis = 'y';
  let playing = false;

  // 标尺：0/180/360/540/720 刻度，360 与 720 带铭文
  {
    const marks = [
      [0, '0°', ''],
      [180, '', ''],
      [360, '360° · −q₀', 'mark'],
      [540, '', ''],
      [720, '720° · q₀', 'mark'],
    ];
    let html = '<div class="track"></div>';
    for (const [deg, label, cls] of marks) {
      const p = (deg / 720) * 100;
      html += `<div class="tick" style="left:${p}%"></div>`;
      if (label) html += `<div class="lbl ${cls}" style="left:${p}%">${label}</div>`;
    }
    html += '<div class="cursor" id="half-cursor"></div>';
    rulerEl.innerHTML = html;
  }
  const cursor = rulerEl.querySelector('#half-cursor');

  function q0() {
    return new THREE.Quaternion().setFromAxisAngle(AXES[axis], theta * Math.PI / 180);
  }

  function sync() {
    const q = q0();
    gL.quaternion.copy(q);
    gR.quaternion.copy(negQ(q));
    readout.set(q);
    slider.value = Math.round(theta);
    valEl.textContent = `${Math.round(theta)}°`;
    cursor.style.left = `${(theta / 720) * 100}%`;
    const half = theta / 2;
    formulaEl.innerHTML =
      `θ = ${Math.round(theta)}° → q = [cos(<span class="fa">${half.toFixed(1)}°</span>), sin(<span class="fa">${half.toFixed(1)}°</span>)·n̂]`;
    invalidate();
  }

  slider.addEventListener('input', () => {
    theta = Number(slider.value);
    playing = false;
    playBtn.textContent = '播放';
    sync();
  });

  playBtn.addEventListener('click', () => {
    playing = !playing;
    if (playing && theta >= 720) theta = 0;
    playBtn.textContent = playing ? '暂停' : '播放';
  });

  root.querySelectorAll('[data-axis]').forEach((b) => {
    b.addEventListener('click', () => {
      axis = b.dataset.axis;
      root.querySelectorAll('[data-axis]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      sync();
    });
  });

  if (!REDUCED_MOTION) {
    // 预设一个有故事感的状态：让人一眼看到「过半」
    theta = 210;
  }
  sync();

  onFrame((dt) => {
    if (!playing) return;
    theta += SPIN_SPEED * dt;
    if (theta >= 720) theta -= 720;
    sync();
  });
}
