/**
 * SEAM-382 共用参数（展开图 / 零件图 都从这里取）
 *
 *   node scripts/gen-pack-template.mjs --od 34.6
 *
 * 所有配合尺寸都由 od + wall 推导，实测管径一变，全案自动重算。
 */

const argv = process.argv.slice(2);
const num = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = Number(argv[i + 1]);
  return Number.isFinite(v) ? v : def;
};

export const P = {
  od: num('od', 35.0),        // 外径（实测值优先）
  wall: num('wall', 1.10),    // 壁厚
  len: num('len', 382.0),     // 总长
  stick: num('stick', 85.0),  // 单支长度（日版 85）
  gap: num('gap', 2.0),       // 同腔两支的轴向间隙
  band: num('band', 99.0),    // 环带上边界（撕拉面）
  bandw: num('bandw', 14.0),  // 环带宽度
  seg: num('seg', 96),        // 每圈刻线段数
  holes: num('holes', 7),     // 蜂窝孔数（1 中心 + 6 环；按公差反算，9 孔筋太薄）
  tail: num('tail', 8.0),     // 尾部余量
};

/* —— 派生尺寸 —— */
P.id = +(P.od - 2 * P.wall).toFixed(2);
P.wrap = +(Math.PI * P.od).toFixed(2);          // 印刷展开长度 = π·OD
P.ring = +(P.stick + P.gap).toFixed(1);         // 每层厚度
P.layers = Math.floor((P.len - P.band - P.bandw - P.tail) / P.ring + 1e-6);
P.mag = +(P.ring * P.layers).toFixed(1);        // 内舱有效长度
P.pitch = +(P.wrap / P.seg).toFixed(3);         // 刻点节距

/* —— 公差分配：按纸管 ±0.3 的最坏情况往下传 ——
 * 纸管内径 32.8 ±0.3 → 最小 32.5
 * 内胆外径 = 最小内径 − 0.3（保证任何一支管都能塞进去）
 * 蜂窝盘 = 内胆内径 − 0.2；环孔半径按"相邻孔留 0.5 筋"反算
 */
P.tolTube = 0.30;
P.idMin = +(P.id - P.tolTube).toFixed(2);
P.idMax = +(P.id + P.tolTube).toFixed(2);
P.cartWall = 0.60;
P.cartOD = +(P.idMin - 0.30).toFixed(2);          // 32.20
P.cartID = +(P.cartOD - 2 * P.cartWall).toFixed(2); // 31.00
P.plateOD = +(P.cartID - 0.20).toFixed(2);        // 30.80
P.plateGapMax = +((P.idMax - P.cartOD) / 2).toFixed(2); // 最坏径向间隙

P.cell = 8.10;                                    // 蜂窝孔（烟支 7.8 + 0.3）
P.web = 0.50;                                     // 相邻孔之间的筋宽
P.ringCount = P.holes - 1;
// 6 孔环：相邻孔中心距 = 2R·sin30° = R，故 R = 孔 + 筋
P.ringR = +(P.cell + P.web).toFixed(2);            // 8.60
P.rim = +(P.plateOD / 2 - (P.ringR + P.cell / 2)).toFixed(2); // 盘边剩余
P.slots = P.holes * P.layers;
/* —— 日本市场强制标识（2020-04 起）——
 * 正面健康警告面积 ≥50%（原 30%），文字与框线仅限黑或白；
 * 焦油 / 尼古丁含量须标注在侧面下方。 */
P.warnRatio = 0.50;
P.warnStart = +(P.band + P.bandw).toFixed(1);
P.warnH = +(P.len * P.warnRatio).toFixed(1);
P.warnEnd = +(P.warnStart + P.warnH).toFixed(1);
P.tarBox = { y: +(P.len - 64).toFixed(1), h: 22 };

P.bore = +(P.cell + 0.4).toFixed(2);             // 面盘首发孔 Ø8.5
P.lipID = 7.6;                                   // 硅胶唇环内径（对 Ø7.8 烟支过盈 0.2）
P.lipOD = 10.5;                                  // 唇环外径（垫圈，粘在面盘外侧）

/* —— 展开图排版 —— */
export const PAGE_H = 250;
export const OVERLAP = 15;
export const MX = 12;
export const MY = 18;
export const PAGES = Math.max(1, Math.ceil((P.len - OVERLAP) / (PAGE_H - OVERLAP)));
