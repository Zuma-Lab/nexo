(function (root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else {
    const configUrl = document.currentScript && document.currentScript.src;
    if (configUrl) for (const key of ['logoLight','logoDark','symbol','heroImage','editorialImage']) {
      config.brand[key] = new URL(config.brand[key], configUrl).href;
    }
    root.EventSystem = { config };
    const colors = config.theme.colors;
    const style = document.documentElement.style;
    for (const [key, hex] of Object.entries(colors)) {
      style.setProperty('--theme-' + key, hex);
      const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16));
      style.setProperty('--theme-' + key + '-rgb', rgb.join(' '));
      style.setProperty('--theme-' + key + '-channels', rgb.join(', '));
    }
    for(const [name,key] of Object.entries({colorPrimary:'primary',surface:'field',surfacePage:'paper',textPrimary:'primary',colorAccent:'accent'}))style.setProperty('--'+name,'var(--theme-'+key+')');
    for(const [key,value] of Object.entries(config.theme.tokens||{}))style.setProperty('--theme-'+key,value);
    style.setProperty('--font-body', config.theme.fonts.body);
    style.setProperty('--font-heading', config.theme.fonts.heading);
    const apply = () => {
      if (!document.querySelector('title[data-page-title]')) document.title = config.brand.name + ' · ' + config.brand.category;
      document.querySelectorAll('[data-brand-text]').forEach(el => { el.textContent = config.brand[el.dataset.brandText] || ''; });
      document.querySelectorAll('[data-brand-image]').forEach(el => { el.src = config.brand[el.dataset.brandImage]; el.alt = config.brand.name; });
    };
    document.addEventListener('DOMContentLoaded', apply);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    brand: {
      name: 'NEXO',
      category: 'Grupos & Eventos',
      tagline: 'Cada detalhe, conectado.',
      provisional: true,
      logoLight: './assets/project-logo-light.svg',
      logoDark: './assets/project-logo-dark.svg',
      symbol: './assets/project-symbol.svg',
      heroImage: './assets/grupo-corporativo.png',
      editorialImage: './assets/paytrack-arquitetura.jpg'
    },
    operation: {
      contactEmail: '',
      contactLabel: 'Atendimento pelo portal',
      quoteDeadline: 'até 4 dias úteis',
      deadlineCondition: 'após recebimento do briefing completo pela equipe'
    },
    theme: {
      name: 'NEXO · proposta visual',
      tokens: {"border":"#8491A6","muted":"#526079","disabled":"#DCE3EE","disabledText":"#526079","radius-xs":"4px","radius-sm":"8px","radius-md":"12px","radius-lg":"16px","radius-panel":"14px","radius-field":"10px","shadow-card":"0 8px 28px rgba(18,37,79,.06)","legacy-color-1":"#ffffff26","legacy-color-2":"#00041355","legacy-color-3":"#00041380","legacy-color-4":"#667084","legacy-color-5":"#fffdf6","legacy-color-6":"#384967","legacy-color-7":"#fffdf8","legacy-color-8":"#768092","legacy-color-9":"#f7f3e8","legacy-color-10":"#c5d1e8","legacy-color-11":"#b8c8e3","legacy-color-12":"#7488ad","legacy-color-13":"#d5dff0","legacy-color-14":"#f1f4fa","legacy-color-15":"#c8d2e3","legacy-color-16":"#65748c","legacy-color-17":"#e7edf6","legacy-color-18":"#e0e6ef","legacy-color-19":"#edf1f7","legacy-color-20":"#dce4ef","legacy-color-21":"#d2d7df","legacy-color-22":"#ece9df","legacy-color-23":"#667085","legacy-color-24":"#b78d4f66","legacy-color-25":"#65866a","legacy-color-26":"#eff4eb","legacy-color-27":"#74582c","legacy-color-28":"#dde1e6","legacy-color-29":"#56627b","legacy-color-30":"#a22121","legacy-color-31":"#b78d4f0c","legacy-color-32":"#315683","legacy-color-33":"rgba(0, 4, 19, 0.8)","legacy-color-34":"rgba(255, 250, 235, .18)","legacy-color-35":"rgba(255, 250, 235, .12)","legacy-color-36":"rgba(255,255,255,.05)","legacy-color-37":"rgba(255,255,255,.04)","legacy-color-38":"rgba(255,250,235,.16)","legacy-color-39":"rgba(255,255,255,.2)","legacy-color-40":"rgba(0,4,19,.2)","legacy-color-41":"rgba(255,250,235,.14)","legacy-color-42":"rgba(0,4,19,.16)","legacy-color-43":"rgba(255,255,255,.11)","legacy-color-44":"rgba(208,221,245,.4)","legacy-color-45":"rgba(255,255,255,.07)","legacy-color-46":"rgba(1,15,74,.78)","legacy-color-47":"rgba(0,4,19,.45)","legacy-color-48":"rgba(0,4,19,.12)","legacy-color-49":"rgba(255,250,235,.18)","legacy-color-50":"rgba(1,15,74,.68)","legacy-color-51":"rgba(0,4,19,.54)","legacy-color-52":"rgba(0,4,19,.48)","legacy-color-53":"#fffcf3","legacy-color-54":"#c8c2b1","legacy-color-55":"#dfd8c9","legacy-color-56":"#9a322b","legacy-color-57":"#12254f05","legacy-color-58":"#ffffff80","legacy-color-59":"#e6eaf1","legacy-color-60":"#ffffff55","legacy-color-61":"#47638b","legacy-color-62":"#284c7b","legacy-color-63":"#12254f15","legacy-color-64":"#5e85bc","legacy-color-65":"#cbd7e6","legacy-color-66":"#7799c4","legacy-color-67":"#17315806","legacy-color-68":"#e4edfc","legacy-color-69":"#244e86","legacy-color-70":"#e9e3fa","legacy-color-71":"#694695","legacy-color-72":"#fff0be","legacy-color-73":"#75580e","legacy-color-74":"#dff2e9","legacy-color-75":"#246649","legacy-color-76":"#e3e9ef","legacy-color-77":"#42576b","legacy-color-78":"#c9bfae","legacy-color-79":"#81745f","legacy-color-80":"#646156","legacy-color-81":"#fffef7","legacy-color-82":"#304368","legacy-color-83":"#cbbfac","legacy-color-84":"#f0e8d9","legacy-color-85":"#fffdf7","legacy-color-86":"#6e6c63","legacy-color-87":"#eeebe1","legacy-color-88":"#e4f1e7","legacy-color-89":"#fdf2c9","legacy-color-90":"#e9edf5","legacy-color-91":"#e5e5e5","legacy-color-92":"#cfc6b7","legacy-color-93":"#74695e","legacy-color-94":"#746c60","legacy-color-95":"rgba(255,250,235,.35)","legacy-color-96":"rgba(255,250,235,.96)","legacy-color-97":"#ffffff50","legacy-color-98":"#d6deea","legacy-color-99":"#fff","legacy-color-100":"#12254f06","legacy-color-101":"#ffb9ae","legacy-color-102":"#f8fbff","legacy-color-103":"#456c9a","legacy-color-104":"#14274e08","legacy-color-105":"#183c6912","legacy-color-106":"#dae2ee","shadow-legacy-1":"0 0 0 3px rgba(var(--theme-primary-channels),0.0471)","shadow-legacy-2":"0 22px 64px var(--theme-legacy-color-40)","shadow-legacy-3":"0 0 0 3px rgba(var(--theme-primary-channels),.13)","shadow-legacy-4":"inset 0 0 0 1px var(--theme-primary)","shadow-legacy-5":"0 -5px 18px rgba(var(--theme-primary-channels),.06)","shadow-legacy-6":"0 12px 36px var(--theme-legacy-color-42)","shadow-legacy-7":"0 8px 30px var(--theme-legacy-color-57)","shadow-legacy-8":"0 12px 35px var(--theme-legacy-color-63)","shadow-legacy-9":"0 8px 28px var(--theme-legacy-color-67)","shadow-legacy-10":"0 6px 24px var(--theme-legacy-color-100)","shadow-legacy-11":"inset 4px 0 var(--theme-accent)","shadow-legacy-12":"inset 0 -3px var(--theme-accent)","shadow-legacy-13":"0 8px 28px var(--theme-legacy-color-104)","shadow-legacy-14":"0 0 0 3px var(--theme-legacy-color-105)","shadow-legacy-15":"inset 0 -3px var(--theme-accent)"},
      fonts: { body: '"Libre Franklin", sans-serif', heading: '"Libre Franklin", sans-serif' },
      colors: {
        primary: '#214E49', primaryDeep: '#173A36', primaryMedium: '#315E56', primaryBright: '#3B6A60',
        accent: '#C7DDD4', accentMuted: '#466C60', accentHover: '#B7D0C5', accentSoft: '#EDF3F1',
        paper: '#F7F8F6', night: '#192521', surface: '#F6F7F8', field: '#FFFFFF'
      }
    },
    // Identificadores internos preservados para manter os rascunhos existentes.
    storage: { draftPrefix: 'paytrack_demo_draft_', attemptPrefix: 'paytrack_demo_attempt_' }
  };
});
