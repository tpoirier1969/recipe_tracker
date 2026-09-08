(() => {
  'use strict';

  const VERSION = '0.17.0';
  const DISPLAY_VERSION = `v${VERSION}`;
  const scriptUrl = new URL(
    document.currentScript?.src || window.location.href,
    window.location.href
  );

  if (scriptUrl.searchParams.get('probe') === '1') {
    window.dispatchEvent(new CustomEvent('recipe-version-probe', {
      detail: DISPLAY_VERSION
    }));
    return;
  }

  window.RECIPE_APP_VERSION = DISPLAY_VERSION;

  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = `manifest.json?v=${VERSION}`;
  document.head.appendChild(manifest);

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = `styles.css?v=${VERSION}`;
  document.head.appendChild(stylesheet);

  const loadApp = () => {
    const appScript = document.createElement('script');
    appScript.src = `app.js?v=${VERSION}`;
    appScript.async = false;
    document.head.appendChild(appScript);
  };

  const loadParser = () => {
    const parserScript = document.createElement('script');
    parserScript.src = `js/recipe-parser.js?v=${VERSION}`;
    parserScript.async = false;
    parserScript.addEventListener('load', loadApp, { once: true });
    parserScript.addEventListener('error', () => {
      console.error('Recipe parser module failed to load.');
      loadApp();
    }, { once: true });
    document.head.appendChild(parserScript);
  };

  const loadModel = () => {
    const modelScript = document.createElement('script');
    modelScript.src = `js/recipe-model.js?v=${VERSION}`;
    modelScript.async = false;
    modelScript.addEventListener('load', loadParser, { once: true });
    modelScript.addEventListener('error', () => {
      console.error('Recipe model module failed to load.');
      loadParser();
    }, { once: true });
    document.head.appendChild(modelScript);
  };

  const configScript = document.createElement('script');
  configScript.src = `config.js?v=${VERSION}`;
  configScript.async = false;
  configScript.addEventListener('load', loadModel, { once: true });
  configScript.addEventListener('error', () => {
    window.RECIPE_APP_CONFIG = window.RECIPE_APP_CONFIG || {};
    loadModel();
  }, { once: true });
  document.head.appendChild(configScript);

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

  let versionCheckInFlight = false;
  let detectedVersion = '';

  const showUpdateNotice = (latestVersion) => {
    detectedVersion = latestVersion;
    const reveal = () => {
      const button = document.getElementById('appUpdateBtn');
      if (!button) return;
      button.textContent = `${latestVersion} is available — reload`;
      button.hidden = false;
      button.addEventListener('click', () => {
        const refreshUrl = new URL(window.location.href);
        refreshUrl.searchParams.set('refresh', String(Date.now()));
        window.location.replace(refreshUrl.toString());
      }, { once: true });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', reveal, { once: true });
    } else {
      reveal();
    }
  };

  const checkForNewVersion = () => {
    if (versionCheckInFlight || detectedVersion) return;
    versionCheckInFlight = true;

    const probe = document.createElement('script');
    let completed = false;
    let timeoutId;

    const finish = () => {
      if (completed) return;
      completed = true;
      versionCheckInFlight = false;
      window.removeEventListener('recipe-version-probe', handleProbe);
      if (timeoutId) window.clearTimeout(timeoutId);
      probe.remove();
    };

    const handleProbe = (event) => {
      const latestVersion = String(event.detail || '');
      finish();
      if (latestVersion && latestVersion !== DISPLAY_VERSION) {
        showUpdateNotice(latestVersion);
      }
    };

    window.addEventListener('recipe-version-probe', handleProbe, { once: true });
    probe.addEventListener('error', finish, { once: true });
    probe.src = `version.js?probe=1&cache=${Date.now()}`;
    probe.async = true;
    timeoutId = window.setTimeout(finish, 10000);
    document.head.appendChild(probe);
  };

  window.RECIPE_APP_CHECK_VERSION = checkForNewVersion;
  window.addEventListener('focus', checkForNewVersion);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForNewVersion();
  });
  window.setInterval(checkForNewVersion, 5 * 60 * 1000);
})();
