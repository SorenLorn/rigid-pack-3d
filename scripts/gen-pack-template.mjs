#!/usr/bin/env node
/**
 * SEAM-382 · 外管展开图 / 纵剖装配图 生成器（零依赖）
 *
 *   node scripts/gen-pack-template.mjs
 *   node scripts/gen-pack-template.mjs --od 34.6 --wall 1.08 --len 382
 *
 * 输出（默认 ./out）：
 *   pack-wrap-p1.svg   外管展开图 1:1（含 96 点刻线、版面分区、拉舌、証紙位）
 *   pack-wrap-p2.svg   …续页（带 15mm 搭接与对位十字）
 *   pack-section.svg   纵剖装配图 1:2（含配合间隙与尺寸链）
 *   pack-spec.txt      本批次参数与校验值（贴在工单上）
 *
 * 打印：A4 纵向、缩放 100%（勿选"适应纸张"），先量页脚 100mm 校准尺。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

import { P, PAGE_H, OVERLAP, MX, MY, PAGES } from './pack-params.mjs';

/* ---------------- 颜色 ---------------- */
const C = {
  ink: '#141414',
  soft: '#8a8a8a',
  cut: '#d02020',
  fold: '#1f6feb',
  gold: '#d8bd74',
  cork: '#e6d3b3',
  warn: '#f2e6e6',
  hatch: '#c9c9c9',
  paper: '#ffffff',
};

const f = (n, d = 2) => Number(n).toFixed(d);

/* ---------------- 工具 ---------------- */
const line = (x1, y1, x2, y2, attrs = '') =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" ${attrs}/>`;

const rect = (x, y, w, h, attrs = '') =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" ${attrs}/>`;

const FONT = "Helvetica,Arial,'PingFang SC','Microsoft YaHei',sans-serif";
const fill = (attrs) => (/\bfill=/.test(attrs) ? '' : `fill="${C.ink}"`);

const text = (x, y, s, size = 3, attrs = '') =>
  `<text x="${f(x)}" y="${f(y)}" font-size="${size}" font-family="${FONT}" ${fill(attrs)} ${attrs}>${s}</text>`;

const vtext = (x, y, s, size = 3, attrs = '') =>
  `<text x="${f(x)}" y="${f(y)}" font-size="${size}" font-family="${FONT}" ${fill(attrs)} transform="rotate(-90 ${f(x)} ${f(y)})" ${attrs}>${s}</text>`;

const cross = (x, y, s = 3) =>
  `<g stroke="${C.cut}" stroke-width="0.15">${line(x - s, y, x + s, y)}${line(x, y - s, x, y + s)}</g>` +
  `<circle cx="${f(x)}" cy="${f(y)}" r="1.1" fill="none" stroke="${C.cut}" stroke-width="0.15"/>`;

/** 100mm 校准尺：打印后必须正好 100mm，否则整张图作废 */
function calibrator(x, y) {
  let g = `<g stroke="${C.ink}" stroke-width="0.18" fill="none">`;
  g += line(x, y, x + 100, y);
  for (let i = 0; i <= 100; i += 5) {
    const h = i % 20 === 0 ? 3 : i % 10 === 0 ? 2 : 1.2;
    g += line(x + i, y, x + i, y - h);
  }
  g += `</g>`;
  g += text(x, y + 4.6, `校准尺 0–100mm（打印缩放必须 100%）`, 2.6);
  g += text(x, y + 8.2, `实测若 ≠100.0mm，请勿使用本图`, 2.4, `fill="${C.cut}"`);
  return g;
}

function sheetFrame(w, h, tag) {
  return (
    rect(0, 0, w, h, `fill="${C.paper}"`) +
    `<rect x="4" y="4" width="${f(w - 8)}" height="${f(h - 8)}" fill="none" stroke="${C.soft}" stroke-width="0.2"/>` +
    text(6, 9.5, tag, 2.8, `fill="${C.soft}"`)
  );
}

/* ---------------- 外管展开图 ---------------- */
function wrapPage(page, y0) {
  const totalW = P.wrap + MX * 2;
  const totalH = PAGE_H + MY + 12;
  const y1 = Math.min(y0 + PAGE_H, P.len);
  const isFirst = page === 1;

  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(totalW)}mm" height="${f(totalH)}mm" viewBox="0 0 ${f(totalW)} ${f(totalH)}">`;
  s += sheetFrame(totalW, totalH,
    `SEAM-382 外管展开图 · 第 ${page}/${PAGES} 页 · 1:1 · OD${f(P.od)} / W${f(P.wrap)} / L${f(P.len)}`);

  s += `<clipPath id="pg${page}"><rect x="${MX}" y="${MY}" width="${f(P.wrap)}" height="${f(PAGE_H)}"/></clipPath>`;
  s += `<g clip-path="url(#pg${page})">`;
  s += `<g transform="translate(${MX} ${MY - y0})">`;

  /* 版面底色 */
  s += rect(0, 0, P.wrap, P.len, `fill="${C.paper}"`);
  s += rect(0, 0, P.wrap, P.band, `fill="${C.cork}" fill-opacity="0.55"`);                       // 软木滤嘴
  s += rect(0, P.band, P.wrap, P.bandw, `fill="${C.gold}" fill-opacity="0.75"`);                 // 金圈
  s += rect(0, P.warnStart, P.wrap, P.warnH, `fill="${C.warn}" fill-opacity="0.5"`);             // 警示区（日本 ≥50%）
  s += rect(0, P.warnEnd, P.wrap, P.len - P.warnEnd, `fill="#f6f6f4"`);                          // 尾段
  s += rect(0, P.tarBox.y, P.wrap, P.tarBox.h, `fill="#eef1f5"`);                                // 焦油/尼古丁侧标

  /* 纵向纸纹（只画在尾段，警示区保持纯白底以便黑字可读） */
  for (let x = 2; x < P.wrap; x += 3.4) {
    s += line(x, P.warnEnd + 2, x, P.len - 2, `stroke="#dcdcd2" stroke-width="0.08"`);
  }

  /* 软木纹示意点 */
  for (let gy = 2; gy < P.band - 1; gy += 2.2) {
    for (let gx = 1.5; gx < P.wrap; gx += 3.1) {
      const jx = gx + ((gy * 7 + gx * 3) % 10) / 12;
      s += `<circle cx="${f(jx)}" cy="${f(gy)}" r="0.28" fill="#b79a6c" fill-opacity="0.55"/>`;
    }
  }

  /* 96 点刻线 × 2 圈 */
  for (const ringY of [P.band, P.band + P.bandw]) {
    for (let i = 0; i < P.seg; i++) {
      const x = (i + 0.5) * (P.wrap / P.seg);
      const isBridge = i % 12 === 0;   // 8 处预断点
      s += `<circle cx="${f(x)}" cy="${f(ringY)}" r="${isBridge ? 0.3 : 0.17}" fill="${C.cut}"/>`;
    }
    s += line(0, ringY, P.wrap, ringY, `stroke="${C.cut}" stroke-width="0.1" stroke-dasharray="1.2 1.2" stroke-opacity="0.5"`);
  }

  /* 环带中心线 */
  s += line(0, P.band + P.bandw / 2, P.wrap, P.band + P.bandw / 2,
    `stroke="${C.fold}" stroke-width="0.15" stroke-dasharray="4 1.2 0.8 1.2"`);

  /* 拉舌（正面，跨环带） */
  const tabX = P.wrap / 2;
  s += rect(tabX - 6, P.band + 0.6, 12, 12.8, `rx="1.6" fill="#fffbe8" stroke="${C.ink}" stroke-width="0.28"`);
  s += rect(tabX - 5.4, P.band + 1.2, 10.8, 11.6, `rx="1.2" fill="none" stroke="#b9a26a" stroke-width="0.14" stroke-dasharray="0.7 0.7"`);
  s += text(tabX, P.band + 7.2, 'PULL', 2.6, `text-anchor="middle" font-weight="700" letter-spacing="0.4"`);
  s += text(tabX, P.band + 10.4, '↺  ↻', 2.4, `text-anchor="middle"`);

  /* 証紙（跨下刻线） */
  const stampX = tabX + 22;
  s += rect(stampX, P.band + P.bandw - 14, 12, 25, `fill="#fff" fill-opacity="0.75" stroke="${C.cut}" stroke-width="0.2" stroke-dasharray="1 0.8"`);
  s += vtext(stampX + 8.6, P.band + P.bandw + 9, '収税済証 12×25（跨 113 刻线）', 2.2);

  /* 接缝补贴区 */
  s += rect(0, 0, 3, P.len, `fill="${C.hatch}" fill-opacity="0.35"`);
  s += line(3, 0, 3, P.len, `stroke="${C.fold}" stroke-width="0.2" stroke-dasharray="2 1"`);
  s += vtext(1.2, P.len * 0.42, '接缝补贴 3mm（朝背面）', 2.2, `fill="${C.fold}"`);

  /* 版面文字 */
  s += text(6, 8, 'Marlboro', 9, `font-weight="700" letter-spacing="0.6"`);
  s += text(6, 14, 'FILTER CIGARETTES · KING SIZE', 2.6, `letter-spacing="0.5"`);
  s += text(6, 19, '屋顶红标 46 × 16（丝印 / 烫金）', 2.2, `fill="${C.soft}"`);

  /* 警示区：日本 2020-04 起 ≥50%，仅黑白 */
  s += text(6, P.warnStart + 7,
    `文字警示区 ${f(P.warnH, 1)}mm ＝ 侧面 ${Math.round(P.warnRatio * 100)}%（日本 2020-04 起强制）`, 3.4, `font-weight="700"`);
  s += text(6, P.warnStart + 12.6,
    '文字与框线仅限黑／白；此处为版面占位，实际文案须按现行 8 组轮换警告核对', 2.4, `fill="${C.soft}"`);

  {
    const fy = P.warnStart + 17;
    const fh = (P.warnEnd - fy - 6 - 5) / 2;     // 两块框填满整个 50% 带
    for (let b = 0; b < 2; b++) {
      const by = fy + b * (fh + 5);
      s += rect(6, by, P.wrap - 12, fh, `fill="none" stroke="#1a1a1a" stroke-width="0.5"`);
      for (let ln = 0; ln < 4; ln++) {
        s += rect(9, by + fh * (0.18 + ln * 0.19), (P.wrap - 18) * (0.94 - ln * 0.06), 3.2,
          `fill="#1a1a1a" fill-opacity="0.72"`);
      }
      s += text(P.wrap / 2, by + fh - 3, b ? 'WARNING ②（背面 50%）' : 'WARNING ①（正面 50%）', 2.6,
        `text-anchor="middle" fill="#b06a6a" letter-spacing="0.8"`);
    }
  }

  s += text(6, P.len - 68, '纵向纸纹 3.4mm 间距（0.08mm 细线，压制横向膨胀感）', 2.2, `fill="${C.soft}"`);

  /* 焦油 / 尼古丁：日本要求标注在侧面下方 */
  s += rect(6, P.tarBox.y, P.wrap - 12, P.tarBox.h, `fill="none" stroke="#7a8698" stroke-width="0.3"`);
  s += text(9, P.tarBox.y + 8, 'TAR  10 mg', 4.2, `font-weight="700" letter-spacing="0.6"`);
  s += text(9, P.tarBox.y + 15, 'NICOTINE  0.8 mg', 4.2, `font-weight="700" letter-spacing="0.6"`);
  s += text(P.wrap - 9, P.tarBox.y + 20.5, '側面下段 · 尼古丁/焦油表示', 2.2, `text-anchor="end" fill="${C.soft}"`);

  s += text(6, P.len - 26, '20本入', 7, `font-weight="700" letter-spacing="0.5"`);
  s += text(6, P.len - 20, '20 CLASS A CIGARETTES', 2.4, `letter-spacing="0.8"`);
  s += text(P.wrap - 6, P.len - 26, 'LOT 2026-S01', 2.4, `text-anchor="end" fill="${C.soft}"`);
  s += text(P.wrap - 6, P.len - 21, '喷码区 24×4', 2.2, `text-anchor="end" fill="${C.soft}"`);

  /* 外轮廓 / 切割线 */
  s += rect(0, 0, P.wrap, P.len, `fill="none" stroke="${C.cut}" stroke-width="0.25" stroke-dasharray="6 2"`);
  s += text(P.wrap / 2, -2.4, '↑ 上端切割线（滤嘴端）', 2.4, `text-anchor="middle" fill="${C.cut}"`);
  s += text(P.wrap / 2, P.len + 4.4, '↓ 下端切割线（燃烧端）', 2.4, `text-anchor="middle" fill="${C.cut}"`);

  /* 关键尺寸标注（左侧竖排） */
  const dimX = -5;
  s += line(dimX, 0, dimX, P.band, `stroke="${C.fold}" stroke-width="0.15"`);
  s += vtext(dimX - 1.2, P.band / 2, `滤嘴 ${f(P.band)}`, 2.4, `fill="${C.fold}" text-anchor="middle"`);
  s += line(dimX, P.band, dimX, P.band + P.bandw, `stroke="${C.fold}" stroke-width="0.15"`);
  s += vtext(dimX - 1.2, P.band + P.bandw + 3, `环带 ${f(P.bandw)}`, 2.4, `fill="${C.fold}"`);

  s += `</g></g>`;

  /* 页脚信息（不随图移动） */
  s += text(MX, totalH - 4.2,
    `刻点节距 ${f(P.pitch, 3)}mm · 每圈 ${P.seg} 段 · 预断点 8 处 · 纸管展开长 = π×${f(P.od)} = ${f(P.wrap)}mm`, 2.4, `fill="${C.soft}"`);

  if (isFirst) s += calibrator(MX, totalH - 10);

  /* 搭接带（第 2 页起） */
  if (!isFirst) {
    s += rect(MX, MY, P.wrap, OVERLAP, `fill="#fff8d8" fill-opacity="0.9"`);
    s += line(MX, MY + OVERLAP, MX + P.wrap, MY + OVERLAP, `stroke="${C.fold}" stroke-width="0.2" stroke-dasharray="2 1"`);
    s += text(MX + 2, MY + 4, `↑ 与上页搭接 ${OVERLAP}mm（此带内容重复，勿重复裱贴）`, 2.4, `fill="${C.fold}"`);
  }

  /* 四角对位十字 */
  s += cross(MX, MY);
  s += cross(MX + P.wrap, MY);
  s += cross(MX, MY + Math.min(PAGE_H, P.len - y0));
  s += cross(MX + P.wrap, MY + Math.min(PAGE_H, P.len - y0));

  s += `</svg>`;
  return s;
}

/* ---------------- 纵剖装配图 1:2.5（A4 可打印） ---------------- */
function section() {
  const K = 0.4;                       // 1:2.5
  const ox = 34;
  const cy = 62;
  const X = (v) => ox + v * K;
  const T = (r) => cy - r * K;         // 上侧
  const B = (r) => cy + r * K;         // 下侧

  const Ro = P.od / 2;                 // 17.50
  const Ri = P.id / 2;                 // 16.40
  const Rc = P.cartOD / 2;             // 内胆外半径 16.10
  const st = 3.9;                      // 烟支半径
  const ringY = P.ringR;               // 环腔中心半径 8.60

  const w = X(P.len) + 14;
  const h = 132;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}mm" height="${h}mm" viewBox="0 0 ${f(w)} ${h}">`;
  s += sheetFrame(w, h, `SEAM-382 纵剖装配图 · 1:2.5 · Ø${f(P.od)} × ${f(P.len)} · 剖面通过中心腔`);

  const defs = `
  <defs>
    <pattern id="hatch" width="1.6" height="1.6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="1.6" stroke="#9a9a9a" stroke-width="0.22"/>
    </pattern>
    <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="${C.fold}"/>
    </marker>
  </defs>`;
  s += defs;

  /* 管壁（上下两片） */
  s += rect(X(0), T(Ro), P.len * K, (Ro - Ri) * K, `fill="${C.paper}" stroke="${C.ink}" stroke-width="0.3"`);
  s += rect(X(0), B(Ri), P.len * K, (Ro - Ri) * K, `fill="${C.paper}" stroke="${C.ink}" stroke-width="0.3"`);

  /* 环撕带 */
  s += rect(X(P.band), T(Ro), P.bandw * K, (Ro - Ri) * K, `fill="url(#hatch)" stroke="${C.cut}" stroke-width="0.25"`);
  s += rect(X(P.band), B(Ri), P.bandw * K, (Ro - Ri) * K, `fill="url(#hatch)" stroke="${C.cut}" stroke-width="0.25"`);

  /* 内胆 */
  s += rect(X(P.band + P.bandw), T(Rc), P.mag * K, 1.2 * K, `fill="#e8eef7" stroke="${C.ink}" stroke-width="0.2"`);
  s += rect(X(P.band + P.bandw), B(Rc - 1.2), P.mag * K, 1.2 * K, `fill="#e8eef7" stroke="${C.ink}" stroke-width="0.2"`);

  /* 烟支：中心腔 + 上下环腔，各 3 层 */
  const x0 = P.band + P.bandw;
  for (let k = 0; k < P.layers; k++) {
    const xs = x0 + k * P.ring + 1;
    for (const r of [0, ringY, -ringY]) {
      if (k === 0 && r === 0) continue;              // 中心腔首支已由"预置露出"单独绘制
      s += rect(X(xs), T(r + st), P.stick * K, 2 * st * K,
        `fill="${r === 0 ? '#fdfaf2' : '#fbf7ee'}" stroke="${C.ink}" stroke-width="0.18" ${r === 0 ? '' : 'stroke-opacity="0.75"'}`);
    }
    if (k < P.layers - 1) {
      s += line(X(xs + P.stick + 1), T(Ri - 0.4), X(xs + P.stick + 1), B(Ri - 0.4),
        `stroke="#cfc6b3" stroke-width="0.18" stroke-dasharray="1 1"`);
    }
  }

  /* 蜂窝导板（层间） */
  for (let k = 1; k < P.layers; k++) {
    const xg = X(x0 + k * P.ring - 0.4);
    s += line(xg, T(Ri - 0.3), xg, B(Ri - 0.3), `stroke="${C.ink}" stroke-width="0.45"`);
  }

  /* 面盘 + 止退爪 + 封堵销 */
  /* 面盘 + 硅胶唇环（密封 + 止退 1.2N 一体） */
  s += line(X(P.band + P.bandw), T(Ri - 0.2), X(P.band + P.bandw), B(Ri - 0.2), `stroke="${C.ink}" stroke-width="0.9"`);
  for (const r of [1, -1]) {
    s += rect(X(P.band + P.bandw) - 0.5, cy + r * 4.05, 2.0, r * 0.75, `fill="#e8d5e8" stroke="${C.cut}" stroke-width="0.2"`);
  }
  s += text(X(P.band + P.bandw) + 4, T(4.6) - 1.6, '硅胶唇环 0.3（Ø7.6 过盈 0.2）', 2.2, `fill="${C.cut}"`);

  /* 出厂预置：中心腔首支已前移 20，止退爪咬住 */
  const pre = 20;
  s += rect(X(P.band + P.bandw - pre), T(st), (P.stick) * K, 2 * st * K,
    `fill="#fdfaf2" stroke="${C.cut}" stroke-width="0.3"`);

  /* 拔盖 / 露出方向 */
  s += `<g stroke="${C.fold}" stroke-width="0.3" fill="none" marker-end="url(#ar)">
         <path d="M${f(X(24))} 26 L${f(X(6))} 26"/>
         <path d="M${f(X(P.band + P.bandw + 6))} ${f(cy)} L${f(X(P.band + P.bandw - 22))} ${f(cy)}"/>
       </g>`;
  s += text(X(8), 23.5, '拔盖', 2.6, `fill="${C.fold}"`);
  s += text(X(P.band + P.bandw - 20), cy - 1.8, `预置露出 ${pre}`, 2.6, `fill="${C.fold}"`);

  /* 轴线 */
  s += line(X(-2), cy, X(P.len) + 6, cy, `stroke="${C.soft}" stroke-width="0.15" stroke-dasharray="8 2 1 2"`);

  /* 尺寸链 */
  const dim = (x1, x2, y, label, off = 0) => {
    const gx1 = X(x1), gx2 = X(x2);
    let g = `<g stroke="${C.fold}" stroke-width="0.18" fill="none">
      <path d="M${f(gx1)} ${f(y - 1.6)} L${f(gx1)} ${f(y + 1.6)} M${f(gx2)} ${f(y - 1.6)} L${f(gx2)} ${f(y + 1.6)}"/>
      <path d="M${f(gx1)} ${f(y)} L${f(gx2)} ${f(y)}" marker-start="url(#ar)" marker-end="url(#ar)"/>
    </g>`;
    g += text((gx1 + gx2) / 2, y + off - 1.2, label, 2.6, `text-anchor="middle" fill="${C.fold}"`);
    return g;
  };

  const yDim1 = 106;
  s += dim(0, P.band, yDim1, `滤嘴区 ${f(P.band)}`);
  s += dim(P.band, P.band + P.bandw, yDim1, `${f(P.bandw)}`, -0.4);
  s += dim(P.band + P.bandw, P.len, yDim1, `本体 ${f(P.len - P.band - P.bandw)}`);
  s += dim(0, P.len, yDim1 + 8, `总长 ${f(P.len)}  （比例 ${f(P.len / P.od)} ≈ 日版 85/7.8 = 10.90）`);

  const yDim2 = 24;
  s += dim(P.band + P.bandw, P.band + P.bandw + P.mag, yDim2, `内舱 ${f(P.mag)} = ${P.layers} 层 × ${f(P.ring)}`);

  /* 直径标注（置于左侧，避免撑出 A4 幅面） */
  s += `<g stroke="${C.fold}" stroke-width="0.18" fill="none" marker-start="url(#ar)" marker-end="url(#ar)">
        <path d="M22 ${f(T(Ro))} L22 ${f(B(Ro))}"/>
        <path d="M29 ${f(T(Ri))} L29 ${f(B(Ri))}"/>
      </g>`;
  s += `<text x="14" y="${f(cy)}" font-size="2.8" fill="${C.fold}" font-family="Helvetica,Arial,sans-serif" text-anchor="middle" transform="rotate(-90 14 ${f(cy)})">Ø${f(P.od)} / Ø${f(P.id)}</text>`;

  /* 局部放大引线：0.2 配合间隙 */
  s += `<g stroke="${C.ink}" stroke-width="0.15" fill="none">
        <path d="M${f(X(210))} ${f(T(Rc))} L${f(X(236))} ${f(T(Rc) - 16)} L${f(X(250))} ${f(T(Rc) - 16)}"/>
        <circle cx="${f(X(210))}" cy="${f(T(Rc))}" r="1.6"/>
      </g>`;
  s += text(X(238), T(Rc) - 17.6, '内胆/管壁 0.2 间隙（滑配）', 2.4);
  s += text(X(238), T(Rc) - 13.8, `蜂窝盘 OD ${f(2 * Rc)} / 孔 Ø${f(P.cell)} × ${P.holes}`, 2.4);
  s += text(X(238), T(Rc) - 10, `环腔中心半径 ${f(P.ringR)}（外缘贴内壁）`, 2.4);

  /* 图注 */
  s += text(8, 116, `齿桥：每圈 8 处 × 6.0mm，剩余壁厚 0.10mm（管壁 ${f(P.wall)}，刻深 ${f(P.wall - 0.10)}）`, 2.6);
  s += text(8, 120.5, `刻点 ${P.seg} 段 / 圈，节距 ${f(P.pitch, 3)}mm；环带周长 ${f(P.wrap)}mm`, 2.6);
  s += text(8, 125, `容量 ${P.slots} 腔（${P.holes} 孔 × ${P.layers} 层），装 20 支 + 7 缓冲/保湿/卡位`, 2.6, `fill="${C.soft}"`);

  s += `</svg>`;
  return s;
}

/* ---------------- 输出 ---------------- */
const OUT = resolve(HERE, '..', 'out');
mkdirSync(OUT, { recursive: true });

for (let p = 1; p <= PAGES; p++) {
  const y0 = p === 1 ? 0 : (p - 1) * (PAGE_H - OVERLAP);
  writeFileSync(resolve(OUT, `pack-wrap-p${p}.svg`), wrapPage(p, y0), 'utf8');
}
writeFileSync(resolve(OUT, 'pack-section.svg'), section(), 'utf8');

const spec = [
  'SEAM-382 打样参数（生成时快照）',
  '--------------------------------',
  `外径 OD        ${f(P.od)}  mm`,
  `壁厚            ${f(P.wall)}  mm`,
  `内径 ID        ${f(P.id)}  mm`,
  `总长 L         ${f(P.len)}  mm`,
  `长径比          ${f(P.len / P.od)}  （日版基准 10.90）`,
  `纸管展开长      ${f(P.wrap)}  mm = π×OD`,
  `环带            ${f(P.band)} – ${f(P.band + P.bandw)}（宽 ${f(P.bandw)}）`,
  `刻点            ${P.seg} 段/圈，节距 ${f(P.pitch, 3)} mm，预断点 8 处`,
  `齿桥            8 处 × 6.0 mm，剩余壁厚 0.10 mm`,
  `烟支            ${f(P.stick)} × Ø7.8`,
  `层厚 / 层数      ${f(P.ring)} mm × ${P.layers}`,
  `内舱            ${f(P.mag)} mm`,
  `蜂窝            ${P.holes} 孔（1 中心 + ${P.ringCount} 环），孔 Ø${f(P.cell)}，环半径 ${f(P.ringR)}，筋 ${f(P.web)}，盘边余量 ${f(P.rim)}`,
  `腔位            ${P.slots}`,
  '',
  '【公差分配 · 按纸管 ±0.30 最坏情况】',
  `纸管内径         ${f(P.id)} ±${f(P.tolTube)}  →  ${f(P.idMin)} … ${f(P.idMax)}`,
  `内胆外径         Ø${f(P.cartOD)}（= ${f(P.idMin)} − 0.30，任何一支管都塞得进）`,
  `内胆内径         Ø${f(P.cartID)}（壁 ${f(P.cartWall)}）`,
  `蜂窝盘 / 面盘    Ø${f(P.plateOD)}（= ${f(P.cartID)} − 0.20）`,
  `最坏径向间隙     ${f(P.plateGapMax)} / side（靠 2 道 0.3 毛毡环消隙）`,
  `展开图页数       ${PAGES} 页（A4 纵向，搭接 ${OVERLAP} mm）`,
  '',
  '打印要求：100% 缩放；先量校准尺，必须等于 100.0 mm。',
  '改了管径请重跑：node scripts/gen-pack-template.mjs --od 34.6',
].join('\n');

writeFileSync(resolve(OUT, 'pack-spec.txt'), spec, 'utf8');

console.log(spec);
console.log(`\n生成完成 → ${OUT}`);
