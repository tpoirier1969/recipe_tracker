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
    storageReferenceFromUrl
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
assert.match(versionSource, /const VERSION = '0\.13\.0'/);

console.log('Recipe Tracker smoke tests passed.');
