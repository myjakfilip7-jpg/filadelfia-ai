// Zdjęcia osób (BMP 32-bit z przezroczystym tłem) → punkty do sekcji „O nas”.
// Użycie: node tools/stipple.js lewa.bmp prawa.bmp wynik.bin [podglad.pgm]
// Odstęp postaci (SPACING) musi być taki sam jak w script.js (fillPortrait).
// Przygotowanie BMP z PNG:  sips -Z 500 -s format bmp osoba.png --out osoba.bmp
// Punkty są gęstsze tam, gdzie zdjęcie jest ciemniejsze (włosy, koszulka), a rzadsze na jasnej skórze.
const fs = require('fs');
const [left, right, outFile, previewFile] = process.argv.slice(2);
const N = 9000, SPACING = 0.9; // środki postaci oddalone o 0,9 szerokości zdjęcia: ramiona lekko się stykają
let seed = 20261115; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

function load(file) {
  const b = fs.readFileSync(file), off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
  if (bpp !== 32) throw new Error(file + ': potrzebny BMP 32-bit (z kanałem alfa)');
  const h = Math.abs(hRaw), flip = hRaw > 0, dens = new Float32Array(w * h); let max = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = off + (flip ? h - 1 - y : y) * w * 4 + x * 4, a = b[i + 3] / 255;
    const lum = (0.114 * b[i] + 0.587 * b[i + 1] + 0.299 * b[i + 2]) / 255;
    const v = a < 0.5 ? 0 : 0.1 + Math.pow(1 - lum, 1.5);
    dens[y * w + x] = v; if (v > max) max = v;
  }
  return { w, h, dens, max };
}
function sample(img, count) {
  const pts = []; let guard = 0;
  while (pts.length < count && guard++ < 5e7) {
    const x = rnd() * img.w, y = rnd() * img.h;
    if (rnd() * img.max < img.dens[(y | 0) * img.w + (x | 0)]) pts.push([x / img.w, y / img.h]);
  }
  return pts;
}
const A = sample(load(left), N / 2), B = sample(load(right), N / 2);
const total = 1 + SPACING; // szerokość kadru w „szerokościach zdjęcia”
// Format: pary bajtów (x, y) w układzie WŁASNEGO zdjęcia; punkty parzyste to lewa osoba, nieparzyste — prawa.
// Dzięki temu każda postać ma pełną dokładność bajtu, a mniejsza liczba punktów na telefonie nadal pokazuje obie.
const out = new Uint8Array(N * 2);
for (let i = 0; i < N / 2; i++) {
  out[i * 4] = Math.round(A[i][0] * 255); out[i * 4 + 1] = Math.round(A[i][1] * 255);
  out[i * 4 + 2] = Math.round(B[i][0] * 255); out[i * 4 + 3] = Math.round(B[i][1] * 255);
}
fs.writeFileSync(outFile, out);
if (previewFile) {
  const PH = 500, PW = Math.round(PH * total), img = Buffer.alloc(PW * PH, 232);
  for (let i = 0; i < N; i++) { const x = Math.round((out[i * 2] / 255 + (i % 2) * SPACING) / total * (PW - 2)), y = Math.round(out[i * 2 + 1] / 255 * (PH - 2)); img[y * PW + x] = 12; img[y * PW + x + 1] = 12; }
  fs.writeFileSync(previewFile, Buffer.concat([Buffer.from(`P5\n${PW} ${PH}\n255\n`), img]));
}
console.log(`punkty: ${N}, proporcje kadru: ${total.toFixed(2)} : 1`);
