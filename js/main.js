// RRN Manager — arquivo mantido apenas por compatibilidade histórica.
//
// A autenticação antiga em localStorage foi removida. Login, cadastro e sessão
// são responsabilidade de auth-v2.js / tenant-runtime.js.
//
// A importação de equipamentos por query string também é tratada por
// js/script.js, portanto este arquivo não executa mais efeitos colaterais.
(() => {
  'use strict';
  window.RRN_LEGACY_MAIN_RETIRED = true;
})();
