// Corre antes da primeira pintura: a intro animada só aparece na primeira visita da sessão
// (e nunca a quem pediu movimento reduzido ao sistema).
(() => {
  let seen = false;
  try { seen = sessionStorage.getItem('arnaut_intro_seen') === '1'; } catch { /* Sem storage: mostra a intro. */ }
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (seen || reducedMotion) document.documentElement.classList.add('skip-intro');
})();
