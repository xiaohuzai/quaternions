// backbone-geom.js — 蛋白质骨架几何：NeRF 原子放置、链构建、原子/键网格工厂
// 折叠机、hero、二面角演示共用（Engh–Huber 近似键长键角；纯函数，可 Node 验证）
import * as THREE from 'three';
import { DEG } from './scene-kit.js';

export const BOND = { nCa: 1.458, caC: 1.525, cN: 1.329, cO: 1.231, sc: 1.52, nH: 1.01 };
export const ANGLE = { nCaC: 111.2, caCN: 116.2, cNCa: 121.7, sc: 109.5, caCb: 110.5, ncO: 122.7, cnH: 119.4 };

// —— 全站统一分子样式：所有 3D 分子演示共用这几张表，禁止各演示私写硬值 ——
// 球径（Å 尺度场景；demo-af 等半尺场景再乘各自.scene 缩放）；约定 Cα 最大
export const RAD = { N: 0.17, CA: 0.2, C: 0.17, O: 0.16, SC: 0.145, H: 0.08 };
// 单键键径、N–H 细键径、双线参数（线径、两线间距）
export const BOND_R = 0.055;
export const BOND_R_H = 0.03;
export const DBL = { r: 0.04, off: 0.07 };
// 键色：主链单键 / 侧链单键 / 羰基 C=O / 肽键 C–N / N–H
export const BCOL = { bb: 0x8d97a3, sc: 0x3f7352, co: 0xe5626a, pep: 0xd99a4e, nh: 0xb9c2cc };

// 经典 NeRF：给 A,B,C 与 键长|CD|、键角∠BCD、二面角ABCD（IUPAC 约定，数值验证过符号），放 D
export function placeAtom(av, bv, cv, bond, angleDeg, dihedralDeg) {
  const bc = new THREE.Vector3().subVectors(cv, bv).normalize();
  const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(av, bv), bc).normalize();
  const nbc = new THREE.Vector3().crossVectors(n, bc).normalize();
  const a = angleDeg * DEG, t = dihedralDeg * DEG;
  return new THREE.Vector3()
    .addScaledVector(bc, -bond * Math.cos(a))
    .addScaledVector(nbc, -bond * Math.sin(a) * Math.cos(t))
    .addScaledVector(n, bond * Math.sin(a) * Math.sin(t))
    .add(cv);
}

// 羰基 O：与 N′ 同在肽平面内，从 C 沿 ∠N′-C-Cα 的角平分线反向放 1.231Å
export function carbonylO(ca, c, nPrime) {
  const bis = nPrime.clone().sub(c).normalize().add(ca.clone().sub(c).normalize()).normalize();
  return c.clone().addScaledVector(bis, -BOND.cO);
}

// 两个残基的完整链：骨架 6 原子 + 侧链 5 原子（χ1..χ4）+ 羰基 O×2
export function computeChain({ psi, omega, phi, chi1 = 60, chi2 = -60, chi3 = 60, chi4 = -60 }) {
  // 链起点：CA1 固定原点，N1/C1 在 xy 平面张开
  const N1 = new THREE.Vector3(BOND.nCa, 0, 0);
  const CA1 = new THREE.Vector3(0, 0, 0);
  const C1 = new THREE.Vector3(Math.cos(ANGLE.nCaC * DEG), Math.sin(ANGLE.nCaC * DEG), 0).multiplyScalar(BOND.caC);
  // ψ₁: N1-CA1-C1-N2；ω₁: CA1-C1-N2-CA2；φ₂: C1-N2-CA2-C2
  const N2 = placeAtom(N1, CA1, C1, BOND.cN, ANGLE.caCN, psi);
  const CA2 = placeAtom(CA1, C1, N2, BOND.nCa, ANGLE.cNCa, omega);
  const C2 = placeAtom(C1, N2, CA2, BOND.caC, ANGLE.nCaC, phi);
  const N3 = placeAtom(N2, CA2, C2, BOND.cN, ANGLE.caCN, psi); // 虚拟 N₃，只为给 C₂ 定肽平面
  // 侧链挂在 CA2 上：CB 取标准四面体构象，χk 逐键外推
  const CB = placeAtom(N2, C2, CA2, BOND.sc, ANGLE.caCb, 122.6);
  const CG = placeAtom(N2, CA2, CB, BOND.sc, ANGLE.sc, chi1);
  const CD = placeAtom(CA2, CB, CG, BOND.sc, ANGLE.sc, chi2);
  const CE = placeAtom(CB, CG, CD, BOND.sc, ANGLE.sc, chi3);
  const CZ = placeAtom(CG, CD, CE, BOND.sc, ANGLE.sc, chi4);
  return {
    bb: [N1, CA1, C1, N2, CA2, C2],
    sc: [CB, CG, CD, CE, CZ],
    o: [carbonylO(CA1, C1, N2), carbonylO(CA2, C2, N3)],
  };
}

// 残基 frame（AF 约定近似）：x = CA→C，y ⊥ x 朝 N，z = x×y
export function residueFrame(N, CA, C) {
  const x = new THREE.Vector3().subVectors(C, CA).normalize();
  const y0 = new THREE.Vector3().subVectors(N, CA);
  const y = y0.clone().addScaledVector(x, -y0.dot(x)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// 直链主链：按 φ/ψ/ω 走到底（α 螺旋取 (-47, 180, -57) 即得螺旋形态），n 个残基
// φ/ψ 可传每残基数组（各铰链独立取值），ω 只收标量——肽平面锁死，全链共用
// 返回 [[N, Cα, C] × n]
export function computeBackbone(n, { psi = -47, omega = 180, phi = -57 } = {}) {
  const at = (v, i) => (Array.isArray(v) ? v[i] : v);
  const N0 = new THREE.Vector3(BOND.nCa, 0, 0);
  const CA0 = new THREE.Vector3(0, 0, 0);
  const C0 = new THREE.Vector3(Math.cos(ANGLE.nCaC * DEG), Math.sin(ANGLE.nCaC * DEG), 0).multiplyScalar(BOND.caC);
  const bb = [[N0, CA0, C0]];
  for (let i = 1; i < n; i++) {
    const [pN, pCA, pC] = bb[i - 1];
    // Ni 绕 ψ(i-1) 铰链（Cα–C 轴）放置，Ci 绕 φ(i) 铰链（N–Cα 轴）放置
    const Ni = placeAtom(pN, pCA, pC, BOND.cN, ANGLE.caCN, at(psi, i - 1));
    const CAi = placeAtom(pCA, pC, Ni, BOND.nCa, ANGLE.cNCa, omega);
    const Ci = placeAtom(pC, Ni, CAi, BOND.caC, ANGLE.nCaC, at(phi, i));
    bb.push([Ni, CAi, Ci]);
  }
  return bb;
}

// —— 网格工厂 ——
export const COL = { N: 0x5c7cf0, CA: 0xd8d2c4, C: 0xd99a4e, S: 0x54b06a, O: 0xe5626a, H: 0xe8e8e8 };

export function makeAtom(radius, color) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 14),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.08 })
  );
}
export function makeBond(color, r = BOND_R) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 1, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05 })
  );
}
const UP = new THREE.Vector3(0, 1, 0);
export function setBond(mesh, p, q) {
  const dir = new THREE.Vector3().subVectors(q, p);
  const len = dir.length();
  mesh.scale.set(1, len, 1);
  mesh.position.copy(p).add(q).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
}

// 双线键（羰基 C=O、肽键 C–N 全站统一走这里）：两根平行细柱，共享材质便于整体闪highlight
export function makeBondPair(color, r = DBL.r) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  return [0, 1].map(() => new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat));
}
export function setBondPair(meshes, p, q, off = DBL.off, shrink = 0.94) {
  const mid = new THREE.Vector3().addVectors(p, q).multiplyScalar(0.5);
  const dir = new THREE.Vector3().subVectors(q, p);
  const len = dir.length();
  dir.normalize();
  const perp = Math.abs(dir.y) < 0.9
    ? new THREE.Vector3().crossVectors(dir, UP).normalize()
    : new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();
  meshes.forEach((m, i) => {
    m.scale.set(1, len * shrink, 1);
    m.position.copy(mid).addScaledVector(perp, (i === 0 ? -1 : 1) * off);
    m.quaternion.setFromUnitVectors(UP, dir);
  });
}
