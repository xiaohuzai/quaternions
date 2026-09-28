// demo-gimbal.js — 05 节：三只嵌套陀螺环，pitch=±90° 时外环内环共线
import * as THREE from 'three';
import { createScene, buildGizmo, quatReadout, DEG } from './scene-kit.js';

const RING = { yaw: 0x5c7cf0, pitch: 0xe5626a, roll: 0x54b06a };

function ring(radius, colorHex, plane /* 'xy' | 'yz' | 'xz' */) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.035, 12, 96),
    new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.35 })
  );
  if (plane === 'xz') m.rotation.x = Math.PI / 2;      // 水平环（法向 = Y，yaw）
  if (plane === 'yz') m.rotation.y = Math.PI / 2;      // 法向 = X（pitch）
  if (plane === 'xy') { /* 默认即法向 = Z（roll） */ }
  return m;
}

export function initGimbal() {
  const root = document.querySelector('[data-demo="gimbal"]');
  const canvas = root.querySelector('canvas');
  const sliders = {
    yaw: root.querySelector('#g-yaw'),
    pitch: root.querySelector('#g-pitch'),
    roll: root.querySelector('#g-roll'),
  };
  const vals = {
    yaw: root.querySelector('#g-yaw-val'),
    pitch: root.querySelector('#g-pitch-val'),
    roll: root.querySelector('#g-roll-val'),
  };
  const warn = root.querySelector('#gimbal-warn');
  const readout = quatReadout(root.querySelector('#gimbal-readout'));

  const { scene, invalidate } = createScene(canvas, { cam: [3.8, 2.6, 5.4] });

  // 层级：yawG(外环,水平) → pitchG(中环) → rollG(内环) → 小飞机
  const yawG = new THREE.Group();
  const pitchG = new THREE.Group();
  const rollG = new THREE.Group();
  yawG.add(ring(1.62, RING.yaw, 'xz'));
  pitchG.add(ring(1.3, RING.pitch, 'yz'));
  rollG.add(ring(1.0, RING.roll, 'xy'));
  const dart = buildGizmo(0.62);
  rollG.add(dart);
  yawG.add(pitchG);
  pitchG.add(rollG);
  scene.add(yawG);

  // 环的“挂点”小珠：让共线与否一眼可辨
  const knob = (colorHex, r) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(r, 14, 10),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, emissive: colorHex, emissiveIntensity: 0.25 })
    );
    return m;
  };
  const knobYaw = knob(RING.yaw, 0.07); knobYaw.position.set(1.62, 0, 0); yawG.add(knobYaw);
  const knobRoll = knob(RING.roll, 0.07); knobRoll.position.set(1.0, 0, 0); rollG.add(knobRoll);

  const mats = {
    yaw: yawG.children[0].material,
    roll: rollG.children[0].material,
  };

  let q = new THREE.Quaternion();

  function sync() {
    const yaw = Number(sliders.yaw.value);
    const pitch = Number(sliders.pitch.value);
    const roll = Number(sliders.roll.value);
    vals.yaw.textContent = `${yaw}°`;
    vals.pitch.textContent = `${pitch}°`;
    vals.roll.textContent = `${roll}°`;

    yawG.rotation.y = yaw * DEG;
    pitchG.rotation.x = pitch * DEG;
    rollG.rotation.z = roll * DEG;

    // 与欧拉角完全等价的四元数（同一姿态）
    q.setFromEuler(new THREE.Euler(pitch * DEG, yaw * DEG, roll * DEG, 'YXZ'));
    readout.set(q);

    const locked = Math.abs(pitch) >= 88;
    warn.classList.toggle('on', locked);
    for (const m of [mats.yaw, mats.roll]) {
      m.emissive.set(locked ? 0xe5626a : 0x000000);
      m.emissiveIntensity = locked ? 0.55 : 0;
    }
    invalidate();
  }

  for (const s of Object.values(sliders)) s.addEventListener('input', sync);
  sliders.pitch.value = 0;
  sync();
}
