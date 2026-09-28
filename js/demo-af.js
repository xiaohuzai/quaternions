// demo-af.js — 06 节：一串残基坐标系，模拟结构模块逐轮的平滑小幅旋转更新
import * as THREE from 'three';
import { createScene, buildGizmo, animate, easeInOutCubic, DEG } from './scene-kit.js';

const N = 7;
const GAP = 0.95;

function randUnit(rng) {
  const z = rng() * 2 - 1, a = rng() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), z);
}

export function initAf() {
  const root = document.querySelector('[data-demo="af"]');
  const canvas = root.querySelector('canvas');
  const stepBtn = root.querySelector('#af-step');
  const resetBtn = root.querySelector('#af-reset');

  const { scene, onFrame } = createScene(canvas, { cam: [1.8, 2.6, 7.2], target: [0, 0, 0] });

  const rng = Math.random;
  let base;      // 基准姿态（复位用）
  let cur;       // 当前姿态
  let targets;   // 本轮目标
  const gizmos = [];

  for (let i = 0; i < N; i++) {
    const g = buildGizmo(0.5);
    g.position.set((i - (N - 1) / 2) * GAP, 0, 0);
    scene.add(g);
    gizmos.push(g);
  }

  // 初始姿态：沿链的正弦摆动，好看且各不相同
  function makeBase() {
    const arr = [];
    for (let i = 0; i < N; i++) {
      arr.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(
        Math.sin(i * 0.9) * 0.55,
        Math.cos(i * 1.3) * 0.85,
        Math.sin(i * 0.5 + 1.2) * 0.45
      )));
    }
    return arr;
  }

  function hardSet() {
    gizmos.forEach((g, i) => g.quaternion.copy(cur[i]));
  }

  function reset() {
    base = makeBase();
    cur = base.map((q) => q.clone());
    targets = null;
    hardSet();
  }

  let cancelAll = [];

  stepBtn.addEventListener('click', () => {
    stepBtn.disabled = true;
    resetBtn.disabled = true;
    cancelAll.forEach((c) => c());
    cancelAll = [];
    // 每个残基抽一个 ±14° 的小扰动作为本轮「预测更新」
    targets = cur.map((q) => {
      const dq = new THREE.Quaternion().setFromAxisAngle(randUnit(rng), (rng() * 2 - 1) * 14 * DEG);
      return new THREE.Quaternion().multiplyQuaternions(dq, q).normalize();
    });
    let finished = 0;
    gizmos.forEach((g, i) => {
      const start = cur[i].clone();
      const target = targets[i];
      cancelAll.push(
        animate({
          dur: 820,
          ease: easeInOutCubic,
          tick: (e) => {
            cur[i].slerpQuaternions(start, target, e);
            g.quaternion.copy(cur[i]);
          },
          done: () => {
            cur[i].copy(target);
            if (++finished === N) {
              stepBtn.disabled = false;
              resetBtn.disabled = false;
            }
          },
        })
      );
    });
  });

  resetBtn.addEventListener('click', reset);
  reset();

  onFrame(() => {});
}
