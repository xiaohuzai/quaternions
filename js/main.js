// main.js — 装配所有演示 + 导航高亮 + 入场动画
import { initHero } from './hero.js';
import { initCommute } from './demo-commute.js';
import { initHalfangle } from './demo-halfangle.js';
import { initSlerp } from './demo-slerp.js';
import { initGimbal } from './demo-gimbal.js';
import { initAf } from './demo-af.js';
import { initBackbone } from './demo-backbone.js';
import { initCircle } from './demo-circle.js';

const boot = () => {
  initHero();
  initCommute();
  initHalfangle();
  initSlerp();
  initGimbal();
  initAf();
  initBackbone();
  initCircle();

  // 入场动画（尊重 reduced-motion：CSS 里已直接显示）
  const io = new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
    { threshold: 0.08 }
  );
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // 导航高亮当前章节
  const links = [...document.querySelectorAll('.nav-links a')];
  const byId = Object.fromEntries(links.map((a) => [a.dataset.sec, a]));
  const so = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (e.isIntersecting) {
          links.forEach((a) => a.removeAttribute('aria-current'));
          byId[e.target.id]?.setAttribute('aria-current', 'true');
        }
      }
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );
  document.querySelectorAll('section.sec').forEach((s) => so.observe(s));
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
