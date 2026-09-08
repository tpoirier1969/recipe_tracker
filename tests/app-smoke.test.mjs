import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const parserSource = fs.readFileSync(new URL('../js/recipe-parser.js', import.meta.url), 'utf8');
const modelSource = fs.readFileSync(new URL('../js/recipe-model.js', import.meta.url), 'utf8');
const ocrSource = fs.readFileSync(new URL('../js/ocr-client.js', import.meta.url), 'utf8');
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
vm.runInNewContext(modelSource, context, { filename: 'js/recipe-model.js' });
vm.runInNewContext(parserSource, context, { filename: 'js/recipe-parser.js' });
vm.runInNewContext(ocrSource, context, { filename: 'js/ocr-client.js' });
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
assert.equal(
  context.window.RecipeTrackerOcr.buildFunctionUrl({
    supabaseUrl: 'https://project-ref.supabase.co/',
    ocrFunction: 'recipe-tracker-ocr'
  }),
  'https://project-ref.supabase.co/functions/v1/recipe-tracker-ocr'
);

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html, /https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.116\.0/);
assert.doesNotMatch(html, /@supabase\/supabase-js@(?:2|latest)(?:["'\/])/);
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
assert.match(functionSource, /callOcrSpace\(blob, contentType, apiKey, 3, deadline, isTable\)/);
assert.match(functionSource, /callOcrSpace\(blob, contentType, apiKey, 2, deadline, isTable\)/);
assert.match(functionSource, /readBoundedBlob\(response, contentType, MAX_IMAGE_BYTES/);
assert.match(functionSource, /MAX_FUNCTION_DURATION_MS = 120_000/);
assert.match(functionSource, /const isTable = body\.isTable !== false/);
assert.match(functionSource, /form\.append\('isTable', String\(isTable\)\)/);
assert.match(functionSource, /OCR_ALLOWED_BUCKETS/);
assert.match(functionSource, /OCR_ALLOWED_ORIGINS/);
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

const magazineRecipe = hooks.roughParseText(`LET'S WOK
Whip up a quick and easy midweek meal.
SPEEDY VEGETABLE STIR-FRY
Serves 2
Takes 10 mins
Heat 1 tbsp sunflower oil in a wok.
Add the vegetables and cook for 2-3 mins.
Each serving contains
Fat 16g`);
assert.equal(magazineRecipe.title, 'SPEEDY VEGETABLE STIR-FRY');
assert.match(magazineRecipe.instructions, /Heat 1 tbsp sunflower oil/);
assert.doesNotMatch(magazineRecipe.instructions, /Each serving contains/);

const countHeadingNoise = hooks.roughParseText(`3 STEPS TO A GREAT STIR-FRY
USE THE RIGHT OIL
SPEEDY VEGETABLE STIR-FRY
Heat oil in a wok.`);
assert.equal(countHeadingNoise.title, 'SPEEDY VEGETABLE STIR-FRY');

const wrappedTitle = hooks.roughParseText(`8:03
My favorite way to make Brussels
sprouts...marinated overnight!
In a gallon size zip bag combine
juice of 1 lemon, 1 tbs olive oil,
pepper and garlic salt.`);
assert.equal(wrappedTitle.title, 'My favorite way to make Brussels sprouts...marinated overnight!');
assert.match(wrappedTitle.instructions, /In a gallon size zip bag combine/);

const markdownRecipe = hooks.roughParseText(`# APPLESAUCE MUFFINS
YIELDS: 12 MUFFINS
## INGREDIENTS
* 1/2 cup butter, softened
* 2 large eggs
## DIRECTIONS
1. Preheat oven to 350 degrees.
2. Bake 18-20 minutes.
NOTES
Store in an airtight container.`);
assert.equal(markdownRecipe.title, 'APPLESAUCE MUFFINS');
assert.match(markdownRecipe.ingredients, /1\/2 cup butter/);
assert.doesNotMatch(markdownRecipe.instructions, /Store in an airtight container/);

console.log('Recipe Tracker smoke tests passed.');
