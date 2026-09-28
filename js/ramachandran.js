// ramachandran.js — 拉马钱德兰图（φ–ψ 平面）：与折叠机的 φ/ψ 滑块双向联动
// 图上拖点 → 改滑块；滑块动 → 图上点跟着走。α 螺旋/β 折叠偏好区域常驻标注。
export function initRamachandran() {
  const cv = document.querySelector('#ram-plot');
  const psiEl = document.querySelector('#bb-psi');
  const phiEl = document.querySelector('#bb-phi');
  if (!cv || !psiEl || !phiEl) return;

  const ctx = cv.getContext('2d');
  const dpr = Math.min(devicePixelRatio, 2);
  const PAD = 30;

  // 偏好区域（经典允许区的示意）：α 螺旋、β 折叠、左手 α
  const REGIONS = [
    { x: -57, y: -47, rx: 42, ry: 38, color: 'rgba(84,176,106,0.16)', label: 'α 螺旋', labelY: -47 },
    { x: -135, y: 135, rx: 52, ry: 46, color: 'rgba(92,124,240,0.16)', label: 'β 折叠', labelY: 135 },
    { x: 60, y: 45, rx: 30, ry: 26, color: 'rgba(217,154,78,0.12)', label: '左手 α', labelY: 45 },
  ];

  function size() {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }
  const px = (phi, w) => PAD + ((phi + 180) / 360) * (w - 2 * PAD);
  const py = (psi, h) => (h - PAD) - ((psi + 180) / 360) * (h - 2 * PAD);
  const invX = (x, w) => ((x - PAD) / (w - 2 * PAD)) * 360 - 180;
  const invY = (y, h) => (((h - PAD) - y) / (h - 2 * PAD)) * 360 - 180;

  function draw() {
    const { w, h } = size();
    ctx.clearRect(0, 0, w, h);

    // 允许区
    for (const r of REGIONS) {
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.ellipse(px(r.x, w), py(r.y, h), ((r.rx) / 360) * (w - 2 * PAD), ((r.ry) / 360) * (h - 2 * PAD), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 坐标轴与刻度
    ctx.strokeStyle = '#2a3340';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD, PAD, w - 2 * PAD, h - 2 * PAD);
    ctx.fillStyle = '#61707f';
    ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    for (const v of [-180, -90, 0, 90, 180]) {
      ctx.fillText(String(v), px(v, w), h - PAD + 14);
      ctx.fillText(String(v), PAD - 4, py(v, h) + 4);
    }
    ctx.fillStyle = '#94a0ae';
    ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText('φ', w / 2, h - 6);
    ctx.save();
    ctx.translate(10, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('ψ', 0, 0);
    ctx.restore();

    // 区域标签
    for (const r of REGIONS) {
      ctx.fillStyle = '#94a0ae';
      ctx.font = '11.5px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'center';
      ctx.fillText(r.label, px(r.x, w), py(r.labelY, h) + 4);
    }

    // 当前 (φ, ψ) 点
    const phi = Number(phiEl.value), psi = Number(psiEl.value);
    const x = px(phi, w), y = py(psi, h);
    ctx.strokeStyle = 'rgba(217,154,78,0.5)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD, y); ctx.lineTo(x, y);
    ctx.moveTo(x, h - PAD); ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#d99a4e';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e9e5da';
    ctx.font = '11.5px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`(${phi}°, ${psi}°)`, x + 9, y - 7);
  }

  // 拖点 → 滑块（经 input 事件，折叠机同步）
  let dragging = false;
  const moveTo = (e) => {
    const r = cv.getBoundingClientRect();
    const { w, h } = size();
    const phi = Math.max(-180, Math.min(180, Math.round(invX(e.clientX - r.left, w))));
    const psi = Math.max(-180, Math.min(180, Math.round(invY(e.clientY - r.top, h))));
    phiEl.value = phi;
    psiEl.value = psi;
    phiEl.dispatchEvent(new Event('input'));
    psiEl.dispatchEvent(new Event('input'));
  };
  cv.addEventListener('pointerdown', (e) => { dragging = true; cv.setPointerCapture(e.pointerId); moveTo(e); });
  cv.addEventListener('pointermove', (e) => { if (dragging) moveTo(e); });
  cv.addEventListener('pointerup', () => { dragging = false; });

  // 滑块 → 图
  phiEl.addEventListener('input', draw);
  psiEl.addEventListener('input', draw);
  new ResizeObserver(draw).observe(cv);
  draw();
}
