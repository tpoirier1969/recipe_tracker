import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const versionSource = fs.readFileSync(new URL('../version.js', import.meta.url), 'utf8');
const currentVersion = versionSource.match(/const VERSION = '(\d+\.\d+\.\d+)'/)?.[1];
assert.ok(currentVersion, 'the canonical version should be readable from version.js');

function makeEventTarget(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, callback, options = {}) {
      const entries = listeners.get(type) || [];
      entries.push({ callback, once: options.once === true });
      listeners.set(type, entries);
    },
    removeEventListener(type, callback) {
      listeners.set(type, (listeners.get(type) || []).filter((entry) => entry.callback !== callback));
    },
    dispatchEvent(event) {
      const entries = [...(listeners.get(event.type) || [])];
      for (const entry of entries) {
        entry.callback(event);
        if (entry.once) this.removeEventListener(event.type, entry.callback);
      }
      return true;
    }
  };
}

const appended = [];
const updateButton = makeEventTarget({ hidden: true, textContent: '' });
const versionFlag = { textContent: '' };
const documentStub = makeEventTarget({
  readyState: 'complete',
  visibilityState: 'visible',
  title: '',
  body: { dataset: {} },
  currentScript: { src: 'https://example.test/recipe_tracker/version.js?bootstrap=123' },
  head: {
    appendChild(element) {
      appended.push(element);
      return element;
    }
  },
  createElement(tagName) {
    return makeEventTarget({
      tagName: tagName.toUpperCase(),
      remove() { this.removed = true; }
    });
  },
  getElementById(id) {
    return id === 'appUpdateBtn' ? updateButton : null;
  },
  querySelector(selector) {
    return selector === '.version-flag' ? versionFlag : null;
  }
});

let replacedUrl = '';
const windowStub = makeEventTarget({
  location: {
    href: 'https://example.test/recipe_tracker/#browsePage',
    replace(value) { replacedUrl = value; }
  },
  setInterval() { return 1; },
  setTimeout() { return 2; },
  clearTimeout() {}
});

class TestCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

const context = {
  CustomEvent: TestCustomEvent,
  Date,
  document: documentStub,
  URL,
  window: windowStub
};
vm.runInNewContext(versionSource, context, { filename: 'version.js' });

assert.equal(windowStub.RECIPE_APP_VERSION, `v${currentVersion}`);
assert.equal(versionFlag.textContent, `v${currentVersion}`);
assert.equal(documentStub.body.dataset.appVersion, `v${currentVersion}`);

const configScript = appended.find((element) => element.src?.startsWith('config.js'));
assert.ok(configScript, 'the version loader should load configuration');
assert.equal(configScript.src, `config.js?v=${currentVersion}`);
assert.equal(appended.some((element) => element.src?.startsWith('app.js')), false, 'the app should wait for configuration');

configScript.dispatchEvent({ type: 'load' });
const appScript = appended.find((element) => element.src?.startsWith('app.js'));
assert.equal(appScript?.src, `app.js?v=${currentVersion}`);

windowStub.RECIPE_APP_CHECK_VERSION();
const probeScript = appended.find((element) => element.src?.includes('probe=1'));
assert.ok(probeScript, 'the running app should request an uncached version probe');

documentStub.currentScript = probeScript;
const newerSource = versionSource.replace(
  /const VERSION = '[^']+'/,
  "const VERSION = '99.99.99'"
);
vm.runInNewContext(newerSource, context, { filename: 'version-probe.js' });

assert.equal(updateButton.hidden, false, 'a newer deployment should reveal the reload control');
assert.match(updateButton.textContent, /v99\.99\.99/);
updateButton.dispatchEvent({ type: 'click' });
assert.match(replacedUrl, /[?&]refresh=\d+/);
assert.match(replacedUrl, /#browsePage$/);

console.log('Recipe Tracker version loader tests passed.');
