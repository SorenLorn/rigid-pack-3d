#!/usr/bin/env node
/**
 * SEAM-382 · 参数化 3D 件（OpenSCAD）
 *
 *   node scripts/gen-pack-cad.mjs
 *
 * 输出 out/pack-parts.scad —— 用 OpenSCAD 打开后 F5 预览、F6 渲染、导出 STL。
 * 所有尺寸从 pack-params.mjs 同步，改管径只需 --od。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { P } from './pack-params.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'out');
mkdirSync(OUT, { recursive: true });

const n = (v, d = 2) => Number(v.toFixed(d));

const scad = `// ============================================================
//  SEAM-382 参数化零件（由 scripts/gen-pack-cad.mjs 生成，勿手改）
//  用法：OpenSCAD 打开 → F5 预览 → 选 show → F6 → Export STL
// ============================================================

/* —— 参数（与 pack-params.mjs 同步）—— */
OD        = ${n(P.od)};
WALL      = ${n(P.wall)};
ID        = ${n(P.id)};
PLATE_D   = ${n(P.plateOD)};      // 蜂窝盘 / 面盘外径
CELL      = ${n(P.cell)};         // 腔孔
RING_R    = ${n(P.ringR)};        // 环孔中心半径
RING_N    = ${P.ringCount};       // 环孔数
WEB       = ${n(P.web)};
BORE      = ${n(P.bore)};         // 面盘首发孔
LIP_ID    = ${n(P.lipID)};
LIP_OD    = ${n(P.lipOD)};

CART_OD   = ${n(P.cartOD)};
CART_ID   = ${n(P.cartID)};
CART_WALL = ${n(P.cartWall)};
CART_LEN  = ${n(P.mag)};
LAYER     = ${n(P.ring)};
LAYERS    = ${P.layers};

HOLE_D    = 1.8;                  // 定位孔
LOC_R     = ${n(P.plateOD / 2 - 1.5)};

PLATE_T   = 1.0;                  // 板材厚（PET 0.5 / 亚克力 0.8 也可）
SLEEVE_D  = 10.0;                 // 端盖罩腔外径
SLEEVE_T  = 25.0;

FLAYOUT   = 1;                    // 1 = 全部件摆开预览；0 = 只画 show 指定件
show      = "all";                // "honey" | "face" | "cart" | "sleeve" | "all"

$fn = 96;

module honey(offset = 0) {
  difference() {
    cylinder(d = PLATE_D, h = PLATE_T);
    translate([offset, 0, -1]) cylinder(d = CELL, h = PLATE_T + 2);
    for (i = [0 : RING_N - 1])
      rotate([0, 0, i * 360 / RING_N])
        translate([RING_R + offset, 0, -1]) cylinder(d = CELL, h = PLATE_T + 2);
    for (a = [22.5, 142.5, 262.5])
      rotate([0, 0, a])
        translate([LOC_R + offset, 0, -1]) cylinder(d = HOLE_D, h = PLATE_T + 2);
  }
}

module face(offset = 0) {
  difference() {
    cylinder(d = PLATE_D, h = PLATE_T);
    translate([offset, 0, -1]) cylinder(d = BORE, h = PLATE_T + 2);
    for (a = [22.5, 142.5, 262.5])
      rotate([0, 0, a])
        translate([LOC_R + offset, 0, -1]) cylinder(d = HOLE_D, h = PLATE_T + 2);
  }
  // 唇环座刻线（不切透，压深 0.15）
  difference() {
    translate([offset, 0, PLATE_T - 0.16]) cylinder(d = LIP_OD + 1, h = 0.16);
    translate([offset, 0, PLATE_T - 0.2]) cylinder(d = LIP_OD, h = 0.3);
  }
}

module cart() {
  difference() {
    union() {
      cylinder(d = CART_OD, h = CART_LEN);
      // 尾部拉手凸缘
      translate([0, 0, -1.2]) cylinder(d = CART_OD + 1.2, h = 1.2);
    }
    translate([0, 0, -0.5]) cylinder(d = CART_ID, h = CART_LEN + 1.5);

    // 4 道蜂窝盘定位槽（0 / 87 / 174 / 261）
    for (k = [0 : LAYERS]) {
      if (k * LAYER <= CART_LEN)
        translate([0, 0, k * LAYER + PLATE_T])
          cylinder(d = PLATE_D + 0.4, h = 0.5);
    }
    // 3 个定位孔贯通
    for (a = [22.5, 142.5, 262.5])
      rotate([0, 0, a])
        translate([LOC_R, 0, -2]) cylinder(d = HOLE_D, h = CART_LEN + 4);
    // 尾部 6×3 指扣
    hull() {
      translate([CART_OD / 2 - 6, -3, -1]) cylinder(d = 6, h = 4);
      translate([CART_OD / 2, -3, -1]) cylinder(d = 6, h = 4);
    }
  }
}

module sleeve() {
  difference() {
    cylinder(d = SLEEVE_D, h = SLEEVE_T);
    translate([0, 0, -1]) cylinder(d = SLEEVE_D - 1.4, h = SLEEVE_T + 2);
  }
}

// —— 装配治具：把内胆顶到台面 20mm，方便压首支 ——
module jig() {
  difference() {
    cylinder(d = CART_OD + 6, h = 26);
    translate([0, 0, 20]) cylinder(d = CART_OD + 0.3, h = 8);
    translate([0, 0, -1]) cylinder(d = CART_ID - 0.2, h = 21.2);
  }
}

// —— 排布 ——
if (FLAYOUT) {
  translate([-70, 0, 0]) honey();
  translate([-30, 0, 0]) face();
  translate([0, 0, 0]) cart();
  translate([70, 0, 0]) sleeve();
  translate([100, 0, 0]) jig();
} else {
  if (show == "honey" || show == "all") honey();
  if (show == "face"  || show == "all") face();
  if (show == "cart"  || show == "all") cart();
  if (show == "sleeve"|| show == "all") sleeve();
}
`;

writeFileSync(resolve(OUT, 'pack-parts.scad'), scad, 'utf8');

const readme = [
  'SEAM-382 3D 件 · 使用说明',
  '================================',
  `蜂窝盘 Ø${n(P.plateOD, 1)} × ${P.holes} 孔，筋 ${n(P.web)}，环半径 ${n(P.ringR)}`,
  `内胆 Ø${n(P.cartOD, 1)} / 内径 Ø${n(P.cartID, 1)} / 长 ${n(P.mag, 1)} / ${P.layers} 层`,
  `面盘 Ø${n(P.plateOD, 1)}，首发孔 Ø${n(P.bore, 1)}`,
  '',
  '1. 用 OpenSCAD 打开 out/pack-parts.scad',
  '2. F5 预览确认；把 $fn 调到 144 可再平滑一档',
  '3. 逐个导出 STL：把底部 show 改成 "honey"/"face"/"cart"/"sleeve"（或直接 F6 全部渲染后逐个 Export）',
  '4. 切片建议：',
  '   蜂窝盘 0.5–1.0 厚，PET / 亚克力切割或 FDM 0.5 层高；',
  '   内胆 0.6 壁，FDM 立起来打，4 道槽会自然形成；',
  '   面盘 1.0 厚，孔口最好用锥形铣刀过一下 30° 导入；',
  '   治具 20% 填充即可。',
  '',
  '注意：内胆壁 0.6 在 FDM 上是 1–2 圈线，建议开 "spiral vase" 或把 WALL 临时改 0.8 打样，',
  '      正式件用纸管卷制更接近真件手感。',
].join('\n');

writeFileSync(resolve(OUT, 'cad-notes.txt'), readme, 'utf8');

console.log(readme);
console.log(`\n生成完成 → ${resolve(OUT, 'pack-parts.scad')}`);
