// Zdjęcie osoby → punkty do sekcji „O nas” (jedna osoba = jeden plik).
// Użycie: node tools/stipple.js zdjecie.bmp wynik.bin [--preview p.pgm] [--crop x0,y0,x1,y1] [--floor 0.25] [--gamma 0.42] [--cap 0.36] [--skip x,y]
// Przygotowanie BMP:  sips -Z 700 -s format bmp zdjecie.jpg --out zdjecie.bmp   (PNG z przezroczystym tłem też działa)
// Punkty padają tam, gdzie zdjęcie jest JASNE: oświetlona twarz i ubranie zostają, cień i tło znikają.
// Dlatego postać wychodzi niedopowiedziana — widać sylwetkę, nie rysy.
const fs = require('fs');
const args = process.argv.slice(2), opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const [inFile, outFile] = args;
const b = fs.readFileSync(inFile), off = b.readUInt32LE(10), W = b.readInt32LE(18), hRaw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
const H = Math.abs(hRaw), flip = hRaw > 0, px = bpp / 8, row = Math.floor((bpp * W + 31) / 32) * 4;
// przezroczyste tło liczy się jak czarne
const lum = (x, y) => { const i = off + (flip ? H - 1 - y : y) * row + x * px, a = px === 4 ? b[i + 3] / 255 : 1; return a * (0.114 * b[i] + 0.587 * b[i + 1] + 0.299 * b[i + 2]) / 255; };
const [X0, Y0, X1, Y1] = opt('crop', `0,0,${W},${H}`).split(',').map(Number), CW = X1 - X0, CH = Y1 - Y0;
const FLOOR = +opt('floor', 0.25), G = +opt('gamma', 0.42), CAP = +opt('cap', 0.36), skip = opt('skip', '').split(',').map(Number);
const dens = new Float32Array(CW * CH); let max = 0;
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
  let s = 0, n = 0; // lekkie rozmycie 3×3 wygładza szum tła
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = X0 + x + dx, yy = Y0 + y + dy; if (xx >= 0 && xx < W && yy >= 0 && yy < H) { s += lum(xx, yy); n++; } }
  const v = Math.min(CAP, Math.pow(Math.max(0, s / n - FLOOR) / (1 - FLOOR), G));
  dens[y * CW + x] = v; if (v > max) max = v;
}
let seed = 20261115; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const N = 9000, out = new Uint8Array(N * 2); let k = 0, guard = 0;
while (k < N && guard++ < 5e7) {
  const x = rnd() * CW, y = rnd() * CH;
  if (skip.length === 2 && x / CW > skip[0] && y / CH < skip[1]) continue; // np. plama światła w rogu tła
  if (rnd() * max < dens[(y | 0) * CW + (x | 0)]) { out[k * 2] = Math.round(x / CW * 255); out[k * 2 + 1] = Math.round(y / CH * 255); k++; }
}
fs.writeFileSync(outFile, out);
const prev = opt('preview', '');
if (prev) {
  const S = 2, PW = CW * S, PH = CH * S, img = Buffer.alloc(PW * PH, 232);
  for (let i = 0; i < N; i++) { const x = Math.round(out[i * 2] / 255 * (PW - 2)), y = Math.round(out[i * 2 + 1] / 255 * (PH - 2)); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) img[(y + dy) * PW + x + dx] = 12; }
  fs.writeFileSync(prev, Buffer.concat([Buffer.from(`P5\n${PW} ${PH}\n255\n`), img]));
}
console.log(`punkty: ${k}, proporcje (szer./wys.): ${(CW / CH).toFixed(3)}`);
