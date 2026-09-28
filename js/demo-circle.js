// demo-circle.js — 07 节：扭转角为什么输出二维向量再归一化，而不是直接回归角度
// 单位圆交互：拖动原始输出向量 → 归一化 → (cos, sin) → 角度；展示 ±180° 悬崖与「不确定度藏在长度里」
export function initCircle() {
  const root = document.querySelector('[data-demo="circle"]');
  const cv = root.querySelector('canvas');
  const readEl = root.querySelector('#circle-read');

  const ctx = cv.getContext('2d');
  const dpr = Math.min(devicePixelRatio, 2);

  // 目标角（训练目标 t*），画在圆上
  const targetDeg = 205;

  let raw = { x: 0.62, y: 0.5 }; // 网络的原始二维输出（未归一化）

  function size() {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function arrow(x0, y0, x1, y1, color, width = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0);
    const hl = 9;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - hl * Math.cos(a - 0.42), y1 - hl * Math.sin(a - 0.42));
    ctx.lineTo(x1 - hl * Math.cos(a + 0.42), y1 - hl * Math.sin(a + 0.42));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function draw() {
    const { w, h } = size();
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.42, cy = h * 0.5, R = Math.min(w * 0.3, h * 0.42);

    // 圆 + 刻度
    ctx.strokeStyle = '#26303d';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#61707f';
    ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    ctx.fillText('0°', cx + R + 16, cy + 4);
    ctx.fillText('90°', cx, cy - R - 10);
    ctx.fillText('±180°', cx - R - 22, cy + 4);
    ctx.fillText('-90°', cx, cy + R + 18);

    const len = Math.hypot(raw.x, raw.y) || 1e-6;
    const nx = raw.x / len, ny = raw.y / len;

    // ±180° 悬崖高亮：负 x 轴那段虚线
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(229,98,106,0.55)';
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx - R - 26, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // 目标点
    const tr = targetDeg * Math.PI / 180;
    const tx = cx + Math.cos(tr) * R, ty = cy - Math.sin(tr) * R;
    ctx.fillStyle = '#54b06a';
    ctx.beginPath(); ctx.arc(tx, ty, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#94a0ae';
    ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'left';
    ctx.fillText('目标角 t*', tx + 10, ty + 4);

    // 原始输出（灰）与归一化（琥珀）
    const scale = R * 0.9;
    arrow(cx, cy, cx + raw.x * scale, cy - raw.y * scale, '#61707f', 2);
    arrow(cx, cy, cx + nx * R, cy - ny * R, '#d99a4e', 3);
    ctx.fillStyle = '#61707f';
    ctx.beginPath(); ctx.arc(cx + raw.x * scale, cy - raw.y * scale, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d99a4e';
    ctx.beginPath(); ctx.arc(cx + nx * R, cy - ny * R, 5.5, 0, Math.PI * 2); ctx.fill();

    // 损失：预测单位向量与目标单位向量的弦
    ctx.strokeStyle = 'rgba(84,176,106,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(cx + nx * R, cy - ny * R);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);

    const deg = Math.atan2(ny, nx) * 180 / Math.PI;
    const degText = deg.toFixed(1).replace('-', '−');
    readEl.innerHTML =
      `原始输出 <span class="mono">(${raw.x.toFixed(2)}, ${raw.y.toFixed(2)})</span> → ` +
      `归一化 <span class="fa">(${nx.toFixed(2)}, ${ny.toFixed(2)})</span> → ` +
      `角度 <span class="fa">${degText}°</span><br>` +
      `<span style="color:var(--faint)">损失 = 两支单位向量的距离（绿虚线），处处光滑；` +
      `原始输出长度 ${(Math.hypot(raw.x, raw.y)).toFixed(2)} &lt; 1 也没关系——不确定度藏在长度里，归一化后投影回圆上。</span>`;

    // 拖拽提示
    ctx.fillStyle = '#61707f';
    ctx.textAlign = 'center';
    ctx.fillText('拖动灰点 = 网络的原始输出', cx, h - 12);
  }

  // 指针交互
  let dragging = false;
  function toLocal(e) {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  cv.addEventListener('pointerdown', (e) => { dragging = true; cv.setPointerCapture(e.pointerId); move(e); });
  cv.addEventListener('pointermove', (e) => { if (dragging) move(e); });
  cv.addEventListener('pointerup', () => { dragging = false; });

  function move(e) {
    const { w, h } = size();
    const cx = w * 0.42, cy = h * 0.5, R = Math.min(w * 0.3, h * 0.42);
    const p = toLocal(e);
    const scale = R * 0.9;
    raw.x = (p.x - cx) / scale;
    raw.y = -(p.y - cy) / scale;
    const len = Math.hypot(raw.x, raw.y);
    if (len > 1.05) { raw.x /= len / 1.05; raw.y /= len / 1.05; } // 拖不飞出圆外太远
    draw();
  }

  new ResizeObserver(draw).observe(cv);
  draw();
}
