// Rok w stopce.
document.getElementById('year').textContent = new Date().getFullYear();

// Poglądowy przebieg agenta: wiersze pojawiają się po kolei, potem pętla.
(function () {
  var log = document.getElementById('runLog');
  if (!log || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var rows = Array.prototype.slice.call(log.children);
  var delays = [500, 900, 1100, 1300, 700, 2200]; // ms przed pokazaniem każdego wiersza
  log.classList.add('js');

  function play() {
    rows.forEach(function (r) { r.classList.remove('is-shown'); });
    var t = 0;
    rows.forEach(function (r, i) {
      t += delays[i] || 900;
      setTimeout(function () { r.classList.add('is-shown'); }, t);
    });
    setTimeout(play, t + 4500);
  }
  play();
})();
