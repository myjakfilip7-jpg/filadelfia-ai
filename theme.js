/* Motyw przed pierwszym rysowaniem — osobny plik, bo panel nie dopuszcza skryptów w treści strony. */
try { if (localStorage.getItem('fila-theme') === 'noc') document.documentElement.setAttribute('data-theme', 'noc'); } catch (e) {}
