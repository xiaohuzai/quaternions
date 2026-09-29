// backbone-geom.js — 蛋白质骨架几何：NeRF 原子放置、链构建、原子/键网格工厂
// 折叠机、hero、二面角演示共用（Engh–Huber 近似键长键角；纯函数，可 Node 验证）
import * as THREE from 'three';
import { DEG } from './scene-kit.js';

export const BOND = { nCa: 1.458, caC: 1.525, cN: 1.329, cO: 1.231, sc: 1.52 };
export const ANGLE = { nCaC: 111.2, caCN: 116.2, cNCa: 121.7, sc: 109.5, caCb: 110.5 };

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

// 直链主链：同一组 φ/ψ/ω 走到底（α 螺旋取 (-47, 180, -57) 即得螺旋形态），n 个残基
// 返回 [[N, Cα, C] × n]
export function computeBackbone(n, { psi = -47, omega = 180, phi = -57 } = {}) {
  const N0 = new THREE.Vector3(BOND.nCa, 0, 0);
  const CA0 = new THREE.Vector3(0, 0, 0);
  const C0 = new THREE.Vector3(Math.cos(ANGLE.nCaC * DEG), Math.sin(ANGLE.nCaC * DEG), 0).multiplyScalar(BOND.caC);
  const bb = [[N0, CA0, C0]];
  for (let i = 1; i < n; i++) {
    const [pN, pCA, pC] = bb[i - 1];
    const Ni = placeAtom(pN, pCA, pC, BOND.cN, ANGLE.caCN, psi);
    const CAi = placeAtom(pCA, pC, Ni, BOND.nCa, ANGLE.cNCa, omega);
    const Ci = placeAtom(pC, Ni, CAi, BOND.caC, ANGLE.nCaC, phi);
    bb.push([Ni, CAi, Ci]);
  }
  return bb;
}

// —— 网格工厂 ——
export const COL = { N: 0x5c7cf0, CA: 0xd8d2c4, C: 0xd99a4e, S: 0x54b06a, O: 0xe5626a };

export function makeAtom(radius, color) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 14),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.08 })
  );
}
export function makeBond(color) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 10),
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
