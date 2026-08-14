(() => {
  'use strict';
  if (window.__RRN_PORTAL_PRIORITY_V2__) return;
  window.__RRN_PORTAL_PRIORITY_V2__ = true;

  function normalizeWizard() {
    const feed = document.getElementById('supportWizardFeed');
    if (!feed) return;

    const choices = [...feed.querySelectorAll('[data-wizard-priority]')];
    if (choices.length) {
      const medium = choices.find(btn => btn.dataset.wizardPriority === 'medium') || choices[0];
      const bubble = medium.closest('.support-wizard-bubble, .support-wizard-message, div');
      if (bubble && !bubble.dataset.rrnPriorityHandled) {
        bubble.dataset.rrnPriorityHandled = '1';
        medium.click();
      }
    }

    feed.querySelectorAll('*').forEach(el => {
      if (el.childElementCount) return;
      const text = el.textContent || '';
      if (text.includes('Qual é o impacto do problema?')) {
        el.textContent = text.replace('Qual é o impacto do problema?', 'A prioridade será classificada pela equipe de suporte.');
      }
      if (text.includes('Impacto: Média')) {
        el.textContent = text.replace('Impacto: Média', 'Prioridade: será definida pelo suporte');
      }
    });
  }

  function boot() {
    const feed = document.getElementById('supportWizardFeed');
    if (!feed) return;
    new MutationObserver(normalizeWizard).observe(feed, { childList: true, subtree: true, characterData: true });
    normalizeWizard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();