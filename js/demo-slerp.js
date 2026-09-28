// demo-slerp.js — 04 节：欧拉角 / 分量 lerp / SLERP 三条过渡路径
import * as THREE from 'three';
import {
  createScene, buildGizmo, quatReadout, nlerp, angleOf, textSprite,
  REDUCED_MOTION,
} from './scene-kit.js';

const A = new THREE.Quaternion();
// 终点 B：多轴大角度（数值搜索选过——欧拉角路径最大摆到 245°，SLERP 只要 115°）
const B = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-0.109, 0.990, -0.093).normalize(), 115.1 * Math.PI / 180);
const SPEED = 0.24; // 播放时 t 的速度（1/秒），往返

const CN_FONT = '600 60px -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

export function initSlerp() {
  const root = document.querySelector('[data-demo="slerp"]');
  const canvas = root.querySelector('canvas');
  const slider = root.querySelector('#slerp-t');
  const valEl = root.querySelector('#slerp-t-val');
  const playBtn = root.querySelector('#slerp-play');
  const resetBtn = root.querySelector('#slerp-reset');
  const chartCv = root.querySelector('#slerp-chart');
  const readout = quatReadout(root.querySelector('#slerp-readout'));

  const { scene, onFrame } = createScene(canvas, { cam: [4.6, 2.8, 7.6], target: [0, 0, 0] });

  const xs = [-2.3, 0, 2.3];
  const darts = xs.map((x) => {
    const g = buildGizmo(0.92);
    g.position.x = x;
    scene.add(g);
    return g;
  });
  const labels = [
    ['欧拉角', '#e5626a'],
    ['lerp', '#54b06a'],
    ['SLERP', '#5c7cf0'],
  ].map(([text, color], i) => {
    const sp = textSprite(text, color, { scale: 0.4, italic: false, size: 56, font: CN_FONT });
    sp.position.set(xs[i], 1.5, 0);
    scene.add(sp);
    return sp;
  });

  root.querySelector('#slerp-formula').innerHTML =
    'q(t) = [sin((1−t)Ω)·q₀ + sin(tΩ)·q₁] / sin Ω，cos Ω = q₀·q₁';

  // —— 三条姿态轨迹 ——
  const eulerB = new THREE.Euler().setFromQuaternion(B, 'XYZ');
  const qEuler = (t) => new THREE.Quaternion().setFromEuler(new THREE.Euler(
    eulerB.x * t, eulerB.y * t, eulerB.z * t, 'XYZ'
  ));
  const qLerp = (t) => nlerp(A, B, t);
  const qSlerp = (t) => A.clone().slerp(B, t);

  // —— 曲线数据（角度-时间），初始化时算一次 ——
  const N = 120;
  const curves = [
    { color: '#e5626a', pts: [] },
    { color: '#54b06a', pts: [] },
    { color: '#5c7cf0', pts: [] },
  ];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    [qEuler(t), qLerp(t), qSlerp(t)].forEach((q, k) => curves[k].pts.push(angleOf(q) * 180 / Math.PI));
  }
  const yMax = Math.max(...curves[0].pts, ...curves[2].pts) * 1.08;

  function drawChart(t) {
    const dpr = Math.min(devicePixelRatio, 2);
    const w = chartCv.clientWidth, h = chartCv.clientHeight;
    if (chartCv.width !== w * dpr) { chartCv.width = w * dpr; chartCv.height = h * dpr; }
    const ctx = chartCv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // 横向网格
    ctx.strokeStyle = 'rgba(38,48,61,0.9)';
    ctx.lineWidth = 1;
    for (const gy of [0.25, 0.5, 0.75]) {
      ctx.beginPath(); ctx.moveTo(0, gy * h); ctx.lineTo(w, gy * h); ctx.stroke();
    }
    for (const c of curves) {
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      c.pts.forEach((deg, i) => {
        const x = (i / N) * w;
        const y = h - (deg / yMax) * (h - 8) - 4;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    // 当前 t 游标
    const cx = t * w;
    ctx.strokeStyle = 'rgba(217,154,78,0.85)';
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
  }

  let t = 0;
  let playing = false;
  let dir = 1;

  function sync() {
    const qs = [qEuler(t), qLerp(t), qSlerp(t)];
    darts.forEach((g, i) => (g.quaternion.copy(qs[i])));
    readout.set(qSlerp(t));
    slider.value = Math.round(t * 1000);
    valEl.textContent = t.toFixed(2);
    drawChart(t);
  }

  slider.addEventListener('input', () => {
    t = Number(slider.value) / 1000;
    playing = false;
    playBtn.textContent = '播放';
    sync();
  });
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? '暂停' : '播放';
  });
  resetBtn.addEventListener('click', () => {
    t = 0; dir = 1; playing = false;
    playBtn.textContent = '播放';
    sync();
  });

  sync();

  onFrame((dt) => {
    if (!playing) return;
    t += dir * SPEED * dt;
    if (t >= 1) { t = 1; dir = -1; }
    if (t <= 0) { t = 0; dir = 1; if (!REDUCED_MOTION) { /* 继续往返 */ } else { playing = false; playBtn.textContent = '播放'; } }
    sync();
  });
}
