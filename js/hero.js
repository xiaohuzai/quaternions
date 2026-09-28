// hero.js — 首屏：小飞机沿球面大圆巡航，实线轨迹 + 线框球，读数条实时显示当前 q
import * as THREE from 'three';
import { createScene, buildGizmo, quatReadout } from './scene-kit.js';

export function initHero() {
  const canvas = document.querySelector('#hero-canvas');
  if (!canvas) return;
  const readout = quatReadout(document.querySelector('#hero-readout'));

  const { scene, camera, controls, onFrame } = createScene(canvas, {
    cam: [2.6, 1.9, 4.4],
    target: [0, 0, 0],
    grid: false,
    autoRotate: true,
  });

  // 线框球：单位四元数球面的隐喻（S³ 的三维投影皮）
  const sphere = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.9, 2),
    new THREE.MeshBasicMaterial({ color: 0x2a3542, wireframe: true, transparent: true, opacity: 0.28 })
  );
  scene.add(sphere);

  // 大圆：取与球相交的一个平面
  const n = new THREE.Vector3(0.32, 0.88, 0.35).normalize();
  const u = new THREE.Vector3(0, 1, 0).cross(n).normalize();
  const v = n.clone().cross(u).normalize();
  const R = 1.9;

  const circleGeo = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3().addScaledVector(u, Math.cos(a) * R).addScaledVector(v, Math.sin(a) * R);
    })
  );
  scene.add(new THREE.Line(circleGeo, new THREE.LineBasicMaterial({ color: 0xd99a4e, transparent: true, opacity: 0.85 })));

  // 另一条淡淡的赤道参考圆
  const eq = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
    })
  );
  scene.add(new THREE.Line(eq, new THREE.LineBasicMaterial({ color: 0x33404f, transparent: true, opacity: 0.6 })));

  const dart = buildGizmo(0.72);
  scene.add(dart);

  let a = 0;
  const _m = new THREE.Matrix4();
  const _x = new THREE.Vector3();

  onFrame((dt) => {
    a += dt * 0.5;
    const pos = new THREE.Vector3().addScaledVector(u, Math.cos(a) * R).addScaledVector(v, Math.sin(a) * R);
    dart.position.copy(pos);
    // 机头沿切线方向，机背朝外法线
    const tangent = new THREE.Vector3().addScaledVector(u, -Math.sin(a)).addScaledVector(v, Math.cos(a));
    _x.crossVectors(tangent, n).normalize(); // 右手系补全
    _m.makeBasis(_x, n, tangent);
    dart.quaternion.setFromRotationMatrix(_m);
    readout.set(dart.quaternion);
  });

  // 减少动态偏好下不自动转相机
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    controls.autoRotate = false;
    camera.position.set(2.6, 1.9, 4.4);
    camera.lookAt(0, 0, 0);
  }
  void camera;
}
