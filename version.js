(() => {
  'use strict';

  const VERSION = '0.11.0';
  const DISPLAY_VERSION = `v${VERSION}`;

  window.RECIPE_APP_VERSION = DISPLAY_VERSION;

  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = `manifest.json?v=${VERSION}`;
  document.head.appendChild(manifest);

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `styles.css?v=${VERSION}`;
  document.head.appendChild(stylesheet);

  const appScript = document.createElement('script');
  appScript.src = `app.js?v=${VERSION}`;
  appScript.async = false;
  document.head.appendChild(appScript);

  const applyVersion = () => {
    document.title = `Recipe Repository ${DISPLAY_VERSION}`;
    document.body.dataset.appVersion = DISPLAY_VERSION;
    const versionFlag = document.querySelector('.version-flag');
    if (versionFlag) versionFlag.textContent = DISPLAY_VERSION;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyVersion, { once: true });
  } else {
    applyVersion();
  }
})();
