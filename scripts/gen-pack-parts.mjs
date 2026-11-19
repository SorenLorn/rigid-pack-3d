#!/usr/bin/env node
/**
 * SEAM-382 · 平板零件切图生成器（零依赖）
 *
 *   node scripts/gen-pack-parts.mjs
 *   node scripts/gen-pack-parts.mjs --od 34.6
 *
 * 输出：
 *   out/cut-honeycomb.dxf / .svg   蜂窝导板（Ø32.4，9 孔 Ø8.1 + 3 定位孔）×4 片
 *   out/cut-faceplate.dxf / .svg   单孔面盘（中心 Ø8.5 + 唇环座刻线）
 *   out/cut-sleeve.dxf   / .svg    端盖罩腔纸样（π×10 × 25，含 3mm 搭接）
 *   out/parts-spec.txt             料单 / 层数 / 装配说明
 *
 * DXF 为 R12 ASCII，单位 mm，图层：CUT（切） / MARK（刻，不切透）。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { P } from './pack-params.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'out');
mkdirSync(OUT, { recursive: true });

const f = (n, d = 3) => Number(n.toFixed(d));

/* ---------------- 零件几何 ---------------- */
const R = P.plateOD / 2;          // 16.2
const locatorR = R - 1.7;         // 14.5
const locatorAngles = [22.5, 142.5, 262.5];

function honeycomb() {
  const holes = [{ x: 0, y: 0, r: P.cell / 2 }];
  for (let i = 0; i < P.ringCount; i++) {
    const a = (i * 360) / P.ringCount * Math.PI / 180;
    holes.push({ x: P.ringR * Math.cos(a), y: P.ringR * Math.sin(a), r: P.cell / 2 });
  }
  const locators = locatorAngles.map((a) => ({
    x: locatorR * Math.cos((a * Math.PI) / 180),
    y: locatorR * Math.sin((a * Math.PI) / 180),
    r: 0.9,
  }));
  return {
    key: 'honeycomb',
    title: '蜂窝导板',
    qty: 4,
    note: `Ø${f(P.plateOD, 1)} / ${P.holes} 腔孔 Ø${f(P.cell, 1)} / 环半径 ${f(P.ringR, 1)}`,
    cut: [{ kind: 'circle', x: 0, y: 0, r: R }, ...holes.map((h) => ({ kind: 'circle', ...h })), ...locators.map((h) => ({ kind: 'circle', ...h }))],
    mark: [],
  };
}

function faceplate() {
  const locators = locatorAngles.map((a) => ({
    x: locatorR * Math.cos((a * Math.PI) / 180),
    y: locatorR * Math.sin((a * Math.PI) / 180),
    r: 0.9,
  }));
  return {
    key: 'faceplate',
    title: '单孔面盘',
    qty: 1,
    note: `Ø${f(P.plateOD, 1)} / 首发孔 Ø${f(P.bore, 1)} / 唇环 Ø${f(P.lipOD, 1)}×Ø${f(P.lipID, 1)}（外贴 0.3 硅胶垫圈）`,
    cut: [{ kind: 'circle', x: 0, y: 0, r: R }, { kind: 'circle', x: 0, y: 0, r: P.bore / 2 }, ...locators.map((h) => ({ kind: 'circle', ...h }))],
    mark: [
      { kind: 'circle', x: 0, y: 0, r: P.lipOD / 2 },    // 唇环外缘对位（刻线，不切透）
      { kind: 'circle', x: 0, y: 0, r: P.lipID / 2 },    // 唇环内孔对位（刻线）
    ],
  };
}

function sleeve() {
  const d = 10.0;                  // 罩腔外径
  const w = +(Math.PI * d).toFixed(2);
  const hgt = 25.0;
  const tab = 3.0;
  const lines = [
    { kind: 'line', x1: 0, y1: 0, x2: w, y2: 0 },
    { kind: 'line', x1: w, y1: 0, x2: w, y2: hgt },
    { kind: 'line', x1: w, y1: hgt, x2: 0, y2: hgt },
    { kind: 'line', x1: 0, y1: hgt, x2: 0, y2: 0 },
    { kind: 'line', x1: w, y1: 0.5, x2: w + tab, y2: 0.5 },
    { kind: 'line', x1: w + tab, y1: 0.5, x2: w + tab, y2: hgt - 0.5 },
    { kind: 'line', x1: w + tab, y1: hgt - 0.5, x2: w, y2: hgt - 0.5 },
  ];
  return {
    key: 'sleeve',
    title: '端盖罩腔纸样',
    qty: 1,
    note: `展开 ${f(w)} × ${f(hgt)} / 搭接 ${f(tab)}`,
    cut: lines,
    mark: [{ kind: 'line', x1: 0, y1: hgt / 2, x2: w, y2: hgt / 2 }],
  };
}

const PARTS = [honeycomb(), faceplate(), sleeve()];

/* ---------------- DXF (R12 ASCII) ---------------- */
function dxf(part) {
  const out = [];
  const g = (code, val) => out.push(String(code), String(val));

  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$INSUNITS'); g(70, 4);          // 4 = mm
  g(9, '$EXTMIN'); g(10, -R - 5); g(20, -R - 5); g(30, 0);
  g(9, '$EXTMAX'); g(10, R + 8); g(20, R + 5); g(30, 0);
  g(0, 'ENDSEC');

  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, 2);
  g(0, 'LAYER'); g(2, 'CUT');  g(70, 0); g(62, 1); g(6, 'CONTINUOUS');
  g(0, 'LAYER'); g(2, 'MARK'); g(70, 0); g(62, 5); g(6, 'CONTINUOUS');
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  g(0, 'SECTION'); g(2, 'ENTITIES');
  const emit = (e, layer) => {
    if (e.kind === 'circle') {
      g(0, 'CIRCLE'); g(8, layer);
      g(10, f(e.x)); g(20, f(e.y)); g(30, 0); g(40, f(e.r));
    } else {
      g(0, 'LINE'); g(8, layer);
      g(10, f(e.x1)); g(20, f(e.y1)); g(30, 0);
      g(11, f(e.x2)); g(21, f(e.y2)); g(31, 0);
    }
  };
  part.cut.forEach((e) => emit(e, 'CUT'));
  part.mark.forEach((e) => emit(e, 'MARK'));
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return out.join('\r\n') + '\r\n';
}

/* ---------------- SVG（预览用，6:1） ---------------- */
function svg(part) {
  const pad = 4;
  const head = 20;
  const foot = 8;

  const pts = [];
  for (const e of [...part.cut, ...part.mark]) {
    if (e.kind === 'circle') {
      pts.push([e.x - e.r, e.y - e.r], [e.x + e.r, e.y + e.r]);
    } else {
      pts.push([e.x1, e.y1], [e.x2, e.y2]);
    }
  }
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));

  const S = Math.min(6, 195 / Math.max(1, maxX - minX));   // 预览比例，保证 A4 宽内
  const w = (maxX - minX) * S + pad * 2;
  const h = (maxY - minY) * S + head + foot;
  const X = (x) => (x - minX) * S + pad;
  const Y = (y) => head + (maxY - y) * S;     // y 轴翻转

  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w, 1)}mm" height="${f(h, 1)}mm" viewBox="0 0 ${f(w, 1)} ${f(h, 1)}">`;
  s += `<rect width="100%" height="100%" fill="#fff"/>`;
  s += `<text x="6" y="10" font-size="5" font-family="Helvetica,Arial,sans-serif" fill="#111" font-weight="700">${part.title}　×${part.qty}</text>`;
  s += `<text x="6" y="17" font-size="4" font-family="Helvetica,Arial,sans-serif" fill="#666">${part.note}　｜　预览 ${S.toFixed(1)}:1，加工请用同名 .dxf（1:1, mm）</text>`;

  for (const e of part.cut) {
    if (e.kind === 'circle') {
      s += `<circle cx="${f(X(e.x), 2)}" cy="${f(Y(e.y), 2)}" r="${f(e.r * S, 2)}" fill="none" stroke="#d02020" stroke-width="1"/>`;
    } else {
      s += `<line x1="${f(X(e.x1), 2)}" y1="${f(Y(e.y1), 2)}" x2="${f(X(e.x2), 2)}" y2="${f(Y(e.y2), 2)}" stroke="#d02020" stroke-width="1"/>`;
    }
  }
  for (const e of part.mark) {
    if (e.kind === 'circle') {
      s += `<circle cx="${f(X(e.x), 2)}" cy="${f(Y(e.y), 2)}" r="${f(e.r * S, 2)}" fill="none" stroke="#1f6feb" stroke-width="0.6" stroke-dasharray="4 3"/>`;
    } else {
      s += `<line x1="${f(X(e.x1), 2)}" y1="${f(Y(e.y1), 2)}" x2="${f(X(e.x2), 2)}" y2="${f(Y(e.y2), 2)}" stroke="#1f6feb" stroke-width="0.6" stroke-dasharray="4 3"/>`;
    }
  }
  s += `<text x="6" y="${f(h - 4, 1)}" font-size="3.6" font-family="Helvetica,Arial,sans-serif" fill="#999">红=切透 CUT　蓝虚线=刻线 MARK（不切透）</text>`;
  s += `</svg>`;
  return s;
}

/* ---------------- 输出 ---------------- */
for (const part of PARTS) {
  writeFileSync(resolve(OUT, `cut-${part.key}.dxf`), dxf(part), 'utf8');
  writeFileSync(resolve(OUT, `cut-${part.key}.svg`), svg(part), 'utf8');
}

const spec = [
  'SEAM-382 平板零件料单',
  '================================',
  `管径基准      OD ${f(P.od, 2)} / ID ${f(P.id, 2)} / 壁 ${f(P.wall, 2)}`,
  `盘外径        Ø${f(P.plateOD, 1)}（= 内胆内径 ${f(P.cartID, 1)} − 0.2）`,
  `公差链        管 ID ${f(P.id, 2)}±${f(P.tolTube, 2)} → 内胆 Ø${f(P.cartOD, 2)} → 盘 Ø${f(P.plateOD, 2)}`,
  '',
  '① 蜂窝导板    ×4 片   0.8mm 白卡 / PET / 3mm 亚克力皆可',
  `   9 腔：中心 Ø${f(P.cell, 1)} + 8 环（R ${f(P.ringR, 1)}，45° 均布）`,
  '   3×Ø1.8 定位孔（R 14.5，22.5°/142.5°/262.5°）——与内胆打孔对齐',
  '   装在 0 / 87 / 174 / 261 四个位置，每支烟头尾各有一次导向',
  '',
  '② 单孔面盘    ×1 片   0.8mm 亚克力（刚性）',
  `   首发孔 Ø${f(P.bore, 1)}（30° 导入倒角，可用锥形铣刀或手工刮）`,
  `   蓝线 Ø${f(P.lipOD, 1)} / Ø${f(P.lipID, 1)} 是唇环对位，只刻不切透`,
  '',
  '③ 端盖罩腔    ×1 片   0.3mm 卡纸卷 Ø10×25，内壁贴 0.3mm 硅胶',
  '',
  `④ 硅胶唇环    ×1     0.3mm 硅胶片冲 Ø${f(P.lipOD, 1)} / Ø${f(P.lipID, 1)} 垫圈`,
  `   内孔 ${f(P.lipID, 1)} 对 Ø7.8 烟支过盈 0.2 → 保持力约 1.2N（全案唯一凭手感调的件）`,
  '   粘在面盘外侧（朝烟支那面），对位看蓝线；不可用硬塑料替代',
  '',
  '加工提示：',
  '- DXF 为 R12 ASCII、单位 mm，图层 CUT/MARK 分开，未做刀补（0 偏置），刀补按机器设置。',
  '- 亚克力切 0.8 建议功率 30–40%、速度 12–15mm/s，切完用细砂纸去边。',
  '- 蜂窝盘 0.8 白卡会吸潮变形，建议改 0.5mm PET 或 1mm 亚克力。',
].join('\n');

writeFileSync(resolve(OUT, 'parts-spec.txt'), spec, 'utf8');

console.log(spec);
console.log(`\n生成完成 → ${OUT}`);
