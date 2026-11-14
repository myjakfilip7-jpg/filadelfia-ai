// Zdjęcie → punkty. Gęstość punktów rośnie z jasnością (postać jest jasna na ciemnym tle).
const fs = require('fs');
const b = fs.readFileSync('src.bmp');
const off = b.readUInt32LE(10), W = b.readInt32LE(18), Hraw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
const H = Math.abs(Hraw), flip = Hraw > 0, row = Math.floor((bpp * W + 31) / 32) * 4, px = bpp / 8;
const lum = (x, y) => { const yy = flip ? H - 1 - y : y, i = off + yy * row + x * px; return (0.114 * b[i] + 0.587 * b[i + 1] + 0.299 * b[i + 2]) / 255; };
// kadr: głowa i ramiona
const [X0, Y0, X1, Y1] = (process.argv[2] || '225,92,535,467').split(',').map(Number);
const CW = X1 - X0, CH = Y1 - Y0;
const G = +(process.argv[3] || 0.55), FLOOR = +(process.argv[4] || 0.17), CAP = +(process.argv[5] || 0.62);
const dens = new Float32Array(CW * CH); let max = 0;
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
  // lekkie rozmycie 3×3, żeby słoje drewna z tła nie robiły szumu
  let s = 0, n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = X0 + x + dx, yy = Y0 + y + dy; if (xx >= 0 && xx < W && yy >= 0 && yy < H) { s += lum(xx, yy); n++; } }
  let v = Math.max(0, s / n - FLOOR) / (1 - FLOOR);
  v = Math.min(CAP, Math.pow(v, G)); // koszulka nie może zabrać wszystkich punktów
  dens[y * CW + x] = v; if (v > max) max = v;
}
let seed = 20261115; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const N = 9000, out = new Uint8Array(N * 2); let k = 0, guard = 0;
while (k < N && guard++ < 5e7) {
  const x = rnd() * CW, y = rnd() * CH;
  if (x / CW > 0.78 && y / CH < 0.14) continue; // plama światła z tła
  if (rnd() * max < dens[(y | 0) * CW + (x | 0)]) { out[k * 2] = Math.round(x / CW * 255); out[k * 2 + 1] = Math.round(y / CH * 255); k++; }
}
fs.writeFileSync('portret.bin', out);
// podgląd: czarne punkty na jasnym tle, jak na stronie
const S = 2, PW = CW * S, PH = CH * S, img = Buffer.alloc(PW * PH, 232);
for (let i = 0; i < N; i++) { const x = Math.round(out[i * 2] / 255 * (PW - 2)), y = Math.round(out[i * 2 + 1] / 255 * (PH - 2)); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) img[(y + dy) * PW + x + dx] = 12; }
fs.writeFileSync('preview.pgm', Buffer.concat([Buffer.from(`P5\n${PW} ${PH}\n255\n`), img]));
console.log('punkty:', k, 'kadr:', CW + 'x' + CH, 'proporcje:', (CW / CH).toFixed(3));
