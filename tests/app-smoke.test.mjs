import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const instrumented = appSource.replace(
  /\}\)\(\);\s*$/,
  `globalThis.__recipeTestHooks = {
    state,
    emptyImageDraft,
    imageDraftFromRecipe,
    makeSourceImageFeatured,
    storageReferenceFromUrl,
    roughParseText
  };\n})();`
);

const documentStub = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; },
  querySelectorAll() { return []; }
};
const context = {
  console,
  crypto: webcrypto,
  document: documentStub,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  URL,
  window: {
    RECIPE_APP_CONFIG: {
      supabaseUrl: 'https://project-ref.supabase.co',
      storageBucket: 'recipe_tracker_assets'
    },
    addEventListener() {}
  }
};
context.globalThis = context;
vm.runInNewContext(instrumented, context, { filename: 'app.js' });

const hooks = context.__recipeTestHooks;
assert.ok(hooks, 'test hooks should load from the application source');

const draft = hooks.imageDraftFromRecipe({
  featured_image_url: 'https://example.com/featured.jpg',
  source_image_urls: ['https://example.com/page-1.jpg', 'https://example.com/page-2.jpg']
});
assert.equal(draft.featuredExisting, 'https://example.com/featured.jpg');
assert.deepEqual(draft.sourceItems.map((item) => item.url), [
  'https://example.com/page-1.jpg',
  'https://example.com/page-2.jpg'
]);

hooks.state.draft = draft;
hooks.makeSourceImageFeatured(1);
assert.equal(hooks.state.draft.featuredExisting, 'https://example.com/page-2.jpg');
assert.deepEqual(hooks.state.draft.sourceItems.map((item) => item.url), [
  'https://example.com/page-1.jpg',
  'https://example.com/featured.jpg'
]);

assert.equal(hooks.storageReferenceFromUrl('https://images.example.com/dinner.jpg'), null);
const storageReference = hooks.storageReferenceFromUrl('https://project-ref.supabase.co/storage/v1/object/public/recipe_tracker_assets/abc/source%20page.jpg');
assert.equal(storageReference.bucket, 'recipe_tracker_assets');
assert.equal(storageReference.path, 'abc/source page.jpg');

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
for (const id of ['featuredImageActions', 'removeFeaturedImageBtn', 'sourceImageGallery']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `${id} should exist in index.html`);
}

const versionSource = fs.readFileSync(new URL('../version.js', import.meta.url), 'utf8');
const versionMatch = versionSource.match(/const VERSION = '(\d+\.\d+\.\d+)'/);
assert.ok(versionMatch, 'version.js should contain the single application version');
const currentVersion = versionMatch[1];
assert.doesNotMatch(html, /<script\s+src=["']version\.js/i, 'version.js should be loaded by the cache-busting bootstrap');
assert.match(html, /version\.js\?bootstrap=['"]?\s*\+\s*Date\.now\(\)/, 'the bootstrap should bypass a stale version.js');
assert.doesNotMatch(html, /config\.js\?v=\d+/, 'config.js should not have its own hard-coded version');
assert.match(versionSource, /config\.js\?v=\$\{VERSION\}/);
assert.match(versionSource, /styles\.css\?v=\$\{VERSION\}/);
assert.match(versionSource, /app\.js\?v=\$\{VERSION\}/);
assert.match(versionSource, /manifest\.json\?v=\$\{VERSION\}/);
assert.match(versionSource, /version\.js\?probe=1&cache=\$\{Date\.now\(\)\}/);
assert.match(versionSource, /latestVersion !== DISPLAY_VERSION/);

for (const [name, source] of Object.entries({
  'index.html': html,
  'app.js': appSource,
  'config.js': fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8'),
  'styles.css': fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8'),
  'README.md': fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8')
})) {
  assert.equal(source.includes(currentVersion), false, `${name} should not duplicate the application version`);
}

const configSource = fs.readFileSync(new URL('../config.js', import.meta.url), 'utf8');
assert.match(configSource, /ocrFunction: 'recipe-tracker-ocr'/);
assert.doesNotMatch(appSource, /ocr-space-extract/);

const functionSource = fs.readFileSync(new URL('../supabase/functions/recipe-tracker-ocr/index.ts', import.meta.url), 'utf8');
assert.match(functionSource, /callOcrSpace\(blob, contentType, apiKey, 3\)/);
assert.match(functionSource, /callOcrSpace\(blob, contentType, apiKey, 2\)/);
const supabaseConfig = fs.readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
assert.match(supabaseConfig, /\[functions\.recipe-tracker-ocr\][\s\S]*verify_jwt = true/);

const parsedOcr = hooks.roughParseText(`--- Page 1 ---
Carrot Cake
Ingredients
1 cup flour
2 eggs
1 cup sugar
Directions
Mix ingredients.
Bake until done.`);
assert.equal(parsedOcr.title, 'Carrot Cake');
assert.match(parsedOcr.ingredients, /1 cup flour/);
assert.match(parsedOcr.instructions, /Mix ingredients/);

console.log('Recipe Tracker smoke tests passed.');
