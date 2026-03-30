const STORAGE_KEY = 'foodie_recipe_repository_local_v74';
const cfg = window.RECIPE_APP_CONFIG || {};
const hasSupabaseConfig = cfg.supabaseUrl && cfg.supabaseAnonKey && !String(cfg.supabaseUrl).includes('YOUR-') && window.supabase;
const supabase = hasSupabaseConfig ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

const RECIPE_TYPES = [
  'Appetizer', 'Breakfast', 'Bread', 'Dessert', 'Drink', 'Main Dish',
  'Side Dish', 'Sauce', 'Soup/Stew', 'Salad', 'Snack', 'Camp Food'
];
const DIETARY_OPTIONS = ['Gluten Free', 'Vegan', 'Vegetarian', 'Dairy Free', 'Low Carb'];
const PRESET_CUISINES = ['American', 'Italian', 'Mexican', 'Swedish', 'Korean', 'Chinese', 'Japanese', 'Thai', 'Indian', 'French', 'Greek', 'Middle Eastern', 'German', 'Polish', 'Vietnamese', 'Spanish'];
const STAPLES = new Set(['salt', 'pepper', 'water', 'olive oil', 'oil', 'butter']);
const INGREDIENT_CANONICALS = {
  'green onion': ['green onion', 'green onions', 'scallion', 'scallions', 'spring onion', 'spring onions'],
  'bell pepper': ['bell pepper', 'bell peppers', 'sweet pepper', 'sweet peppers', 'capsicum', 'capsicums'],
  'cilantro': ['cilantro', 'coriander leaves', 'fresh coriander'],
  'zucchini': ['zucchini', 'courgette', 'courgettes'],
  'eggplant': ['eggplant', 'aubergine', 'aubergines'],
  'garbanzo bean': ['garbanzo bean', 'garbanzo beans', 'chickpea', 'chickpeas'],
  'cornstarch': ['cornstarch', 'corn starch'],
  'powdered sugar': ['powdered sugar', 'icing sugar', 'confectioners sugar', 'confectioner sugar'],
  'heavy cream': ['heavy cream', 'double cream', 'thickened cream'],
  'half and half': ['half and half', 'half-and-half'],
  'arugula': ['arugula', 'rocket'],
  'shrimp': ['shrimp', 'prawn', 'prawns'],
  'ground beef': ['ground beef', 'hamburger', 'minced beef'],
  'ground turkey': ['ground turkey', 'minced turkey'],
  'canola oil': ['canola oil', 'rapeseed oil'],
  'all purpose flour': ['all purpose flour', 'all-purpose flour', 'plain flour'],
  'baking soda': ['baking soda', 'bicarbonate of soda'],
  'parmesan': ['parmesan', 'parmigiano reggiano', 'parmigiano-reggiano'],
  'ricotta': ['ricotta', 'ricotta cheese'],
  'mozzarella': ['mozzarella', 'mozzarella cheese'],
  'soy sauce': ['soy sauce', 'shoyu'],
  'tamari': ['tamari', 'gluten free soy sauce', 'gluten-free soy sauce'],
  'bok choy': ['bok choy', 'pak choi', 'pak choy'],
  'caster sugar': ['caster sugar', 'superfine sugar'],
  'chili powder': ['chili powder', 'chilli powder'],
  'chile pepper': ['chile pepper', 'chili pepper', 'chilli pepper']
};
const INGREDIENT_ALIAS_MAP = buildIngredientAliasMap();

const els = {
  title: document.getElementById('title'),
  recipeType: document.getElementById('recipeType'),
  cuisine: document.getElementById('cuisine'),
  collection: document.getElementById('collection'),
  sourceType: document.getElementById('sourceType'),
  sourceLabel: document.getElementById('sourceLabel'),
  recipeUrl: document.getElementById('recipeUrl'),
  tags: document.getElementById('tags'),
  rating: document.getElementById('rating'),
  isFavorite: document.getElementById('isFavorite'),
  prepTime: document.getElementById('prepTime'),
  cookTime: document.getElementById('cookTime'),
  recipeYield: document.getElementById('recipeYield'),
  featuredImageFile: document.getElementById('featuredImageFile'),
  sourceImageFiles: document.getElementById('sourceImageFiles'),
  featuredImagePreview: document.getElementById('featuredImagePreview'),
  featuredImageEmpty: document.getElementById('featuredImageEmpty'),
  sourceImageGallery: document.getElementById('sourceImageGallery'),
  ocrText: document.getElementById('ocrText'),
  ingredients: document.getElementById('ingredients'),
  instructions: document.getElementById('instructions'),
  notes: document.getElementById('notes'),
  statusText: document.getElementById('statusText'),
  newRecipeBtn: document.getElementById('newRecipeBtn'),
  runOcrBtn: document.getElementById('runOcrBtn'),
  importFromUrlBtn: document.getElementById('importFromUrlBtn'),
  saveRecipeBtn: document.getElementById('saveRecipeBtn'),
  homeSearchInput: document.getElementById('homeSearchInput'),
  homeSearchBtn: document.getElementById('homeSearchBtn'),
  homeStats: document.getElementById('homeStats'),
  homeTypeButtons: document.getElementById('homeTypeButtons'),
  homeCuisineButtons: document.getElementById('homeCuisineButtons'),
  homeDietaryButtons: document.getElementById('homeDietaryButtons'),
  quickOpenBrowseBtn: document.getElementById('quickOpenBrowseBtn'),
  quickOpenEditBtn: document.getElementById('quickOpenEditBtn'),
  homeFavoritesBtn: document.getElementById('homeFavoritesBtn'),
  homeRecentBtn: document.getElementById('homeRecentBtn'),
  searchInput: document.getElementById('searchInput'),
  typeFilter: document.getElementById('typeFilter'),
  cuisineFilter: document.getElementById('cuisineFilter'),
  collectionFilter: document.getElementById('collectionFilter'),
  tagFilter: document.getElementById('tagFilter'),
  includeIngredients: document.getElementById('includeIngredients'),
  excludeIngredients: document.getElementById('excludeIngredients'),
  includeIngredientSuggestions: document.getElementById('includeIngredientSuggestions'),
  excludeIngredientSuggestions: document.getElementById('excludeIngredientSuggestions'),
  ingredientMode: document.getElementById('ingredientMode'),
  ratingFilter: document.getElementById('ratingFilter'),
  ignoreStaples: document.getElementById('ignoreStaples'),
  dietaryOptions: document.getElementById('dietaryOptions'),
  dietaryFilterOptions: document.getElementById('dietaryFilterOptions'),
  favoritesOnlyBtn: document.getElementById('favoritesOnlyBtn'),
  duplicatesBtn: document.getElementById('duplicatesBtn'),
  recentBtn: document.getElementById('recentBtn'),
  clearFiltersBtn: document.getElementById('clearFiltersBtn'),
  recipeCount: document.getElementById('recipeCount'),
  recipeList: document.getElementById('recipeList'),
  recipeDetail: document.getElementById('recipeDetail'),
  recipeCardTemplate: document.getElementById('recipeCardTemplate'),
  exportBtn: document.getElementById('exportBtn'),
  importFile: document.getElementById('importFile'),
  printBtn: document.getElementById('printBtn'),
  printIndexCardBtn: document.getElementById('printIndexCardBtn'),
  deleteBtn: document.getElementById('deleteBtn'),
  goToEditBtn: document.getElementById('goToEditBtn'),
  pageTabs: Array.from(document.querySelectorAll('.page-tab')),
  appPages: Array.from(document.querySelectorAll('.app-page')),
  mobileTabs: Array.from(document.querySelectorAll('.mobile-tab')),
  mobilePanels: Array.from(document.querySelectorAll('.mobile-panel'))
};

const state = {
  recipes: [],
  selectedId: null,
  favoritesOnly: false,
  duplicatesOnly: false,
  recentOnly: false,
  draftFeaturedImageFile: null,
  draftFeaturedRemoteImageUrl: '',
  draftSourceImageFiles: [],
  draftSourceRemoteImageUrls: [],
  currentPage: 'homePage'
};

function setStatus(message, tone = 'neutral') {
  els.statusText.textContent = message;
  els.statusText.dataset.tone = tone;
}

function populateSelects() {
  for (const select of [els.recipeType, els.typeFilter]) {
    RECIPE_TYPES.forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      select.appendChild(option);
    });
  }
  populateCuisineFilter();
}

function makeChip(name, containerId, prefix) {
  const label = document.createElement('label');
  label.className = 'chip-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = name;
  input.id = `${prefix}-${slugify(name)}`;
  const span = document.createElement('span');
  span.textContent = name;
  label.append(input, span);
  document.getElementById(containerId).appendChild(label);
}

function renderDietaryOptions() {
  DIETARY_OPTIONS.forEach((name) => {
    makeChip(name, 'dietaryOptions', 'dietary');
    makeChip(name, 'dietaryFilterOptions', 'dietary-filter');
  });
}

function availableCuisines() {
  const cuisines = new Set(PRESET_CUISINES);
  state.recipes.forEach((recipe) => {
    const value = String(recipe.cuisine || '').trim();
    if (value) cuisines.add(value);
  });
  return Array.from(cuisines).sort((a, b) => a.localeCompare(b));
}

function populateCuisineFilter() {
  if (!els.cuisineFilter) return;
  const current = els.cuisineFilter.value;
  els.cuisineFilter.innerHTML = '<option value="">All cuisines</option>';
  availableCuisines().forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    els.cuisineFilter.appendChild(option);
  });
  if (Array.from(els.cuisineFilter.options).some((option) => option.value === current)) {
    els.cuisineFilter.value = current;
  }
}

function statCard(label, value) {
  return `<div class="stat-card"><div class="stat-value">${escapeHtml(String(value))}</div><div class="stat-label">${escapeHtml(label)}</div></div>`;
}

function jumpButton(label, meta = '', attrs = '') {
  return `<button type="button" class="jump-button" ${attrs}><span>${escapeHtml(label)}</span>${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</button>`;
}

function renderHomePage() {
  if (els.homeStats) {
    const cuisineCount = state.recipes.filter((recipe) => recipe.cuisine).length;
    const favoriteCount = state.recipes.filter((recipe) => recipe.is_favorite).length;
    const photoCount = state.recipes.filter((recipe) => recipe.featured_image_url || recipe.source_image_urls?.length).length;
    els.homeStats.innerHTML = [
      statCard('Recipes', state.recipes.length),
      statCard('Favorites', favoriteCount),
      statCard('With cuisine set', cuisineCount),
      statCard('With photos', photoCount)
    ].join('');
  }

  if (els.homeTypeButtons) {
    els.homeTypeButtons.innerHTML = RECIPE_TYPES.map((type) => {
      const count = state.recipes.filter((recipe) => recipe.recipe_type === type).length;
      return jumpButton(type, `${count}`, `data-home-type="${escapeHtml(type)}"`);
    }).join('');
    els.homeTypeButtons.querySelectorAll('[data-home-type]').forEach((button) => {
      button.addEventListener('click', () => applyHomeBrowsePreset({ type: button.dataset.homeType }));
    });
  }

  if (els.homeCuisineButtons) {
    els.homeCuisineButtons.innerHTML = availableCuisines().slice(0, 18).map((cuisine) => {
      const count = state.recipes.filter((recipe) => recipe.cuisine === cuisine).length;
      return jumpButton(cuisine, `${count}`, `data-home-cuisine="${escapeHtml(cuisine)}"`);
    }).join('');
    els.homeCuisineButtons.querySelectorAll('[data-home-cuisine]').forEach((button) => {
      button.addEventListener('click', () => applyHomeBrowsePreset({ cuisine: button.dataset.homeCuisine }));
    });
  }

  if (els.homeDietaryButtons) {
    els.homeDietaryButtons.innerHTML = DIETARY_OPTIONS.map((dietary) => {
      const count = state.recipes.filter((recipe) => recipe.dietary.includes(dietary)).length;
      return jumpButton(dietary, `${count}`, `data-home-dietary="${escapeHtml(dietary)}"`);
    }).join('');
    els.homeDietaryButtons.querySelectorAll('[data-home-dietary]').forEach((button) => {
      applyHomeDietaryButton(button);
    });
  }
}

function applyHomeDietaryButton(button) {
  button.addEventListener('click', () => applyHomeBrowsePreset({ dietary: [button.dataset.homeDietary] }));
}

function getSafePageId(pageId) {
  const validPageIds = new Set(els.appPages.map((page) => page.id));
  return validPageIds.has(pageId) ? pageId : 'homePage';
}

function activatePage(pageId, options = {}) {
  const safePageId = getSafePageId(pageId);
  if (typeof window.__recipeFallbackShowPage === 'function') window.__recipeFallbackShowPage(safePageId);
  state.currentPage = safePageId;
  els.pageTabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.page === safePageId));
  els.appPages.forEach((page) => page.classList.toggle('is-active', page.id === safePageId));
  if (!options.skipHashUpdate) {
    const targetHash = `#${safePageId}`;
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }
  if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
}

function activatePageFromHash() {
  const requested = window.location.hash.replace('#', '').trim();
  activatePage(requested || 'homePage', { skipHashUpdate: true });
}

function routeTo(pageId) {
  activatePage(pageId || 'homePage');
}

function bindDelegatedRouting() {
  document.addEventListener('click', (event) => {
    const routeEl = event.target.closest('[data-route]');
    if (!routeEl) return;
    const pageId = routeEl.dataset.route;
    if (!pageId) return;
    event.preventDefault();
    routeTo(pageId);
  });
}

function applyHomeBrowsePreset({ search = '', type = '', cuisine = '', dietary = [], favorites = false, recent = false } = {}) {
  els.searchInput.value = search;
  els.typeFilter.value = type;
  if (els.cuisineFilter) els.cuisineFilter.value = cuisine;
  els.collectionFilter.value = '';
  els.tagFilter.value = '';
  els.includeIngredients.value = '';
  els.excludeIngredients.value = '';
  els.ratingFilter.value = '';
  els.ingredientMode.value = 'all';
  els.ignoreStaples.checked = true;
  setCheckedValues(els.dietaryFilterOptions, dietary);
  state.favoritesOnly = favorites;
  state.recentOnly = recent;
  state.duplicatesOnly = false;
  els.favoritesOnlyBtn.classList.toggle('is-on', favorites);
  els.recentBtn.classList.toggle('is-on', recent);
  els.duplicatesBtn.classList.remove('is-on');
  renderList();
  routeTo('browsePage');
}

function getCheckedValues(container) {
  return Array.from(container.querySelectorAll('input:checked')).map((input) => input.value);
}

function setCheckedValues(container, values = []) {
  const wanted = new Set(values);
  container.querySelectorAll('input').forEach((input) => {
    input.checked = wanted.has(input.value);
  });
}


function buildIngredientAliasMap() {
  const map = new Map();
  Object.entries(INGREDIENT_CANONICALS).forEach(([canonical, aliases]) => {
    const normalizedCanonical = basicNormalizeIngredient(canonical);
    map.set(normalizedCanonical, canonical);
    aliases.forEach((alias) => map.set(basicNormalizeIngredient(alias), canonical));
  });
  return map;
}

function basicNormalizeIngredient(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\b(fresh|dried|large|small|medium|extra|virgin|optional|divided|chopped|diced|minced|sliced|shredded|grated|crushed|ground|to taste)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeIngredientPhrase(value) {
  const normalized = basicNormalizeIngredient(value).replace(/\b(onions|peppers|tomatoes|mushrooms|carrots|beans|cloves)\b/g, (m) => m.slice(0, -1));
  return INGREDIENT_ALIAS_MAP.get(normalized) || normalized;
}

function splitIngredientSearchTerms(value) {
  return String(value || '')
    .split(/[\n,;]/)
    .map((item) => normalizeIngredientPhrase(item))
    .filter(Boolean);
}

function ingredientLines(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.()\s]+/, '').trim())
    .filter(Boolean);
}

function recipeIngredientSet(recipe) {
  const set = new Set();
  ingredientLines(recipe.ingredients).forEach((line) => {
    const canonical = normalizeIngredientPhrase(line);
    if (canonical) set.add(canonical);
    basicNormalizeIngredient(line).split(/\s+/).forEach((token) => {
      const normalized = normalizeIngredientPhrase(token);
      if (normalized && normalized.length > 1) set.add(normalized);
    });
  });
  return set;
}

function ingredientVocabulary() {
  const words = new Set(Object.keys(INGREDIENT_CANONICALS));
  Object.values(INGREDIENT_CANONICALS).forEach((aliases) => aliases.forEach((alias) => words.add(alias)));
  state.recipes.forEach((recipe) => {
    recipeIngredientSet(recipe).forEach((term) => words.add(term));
    ingredientLines(recipe.ingredients).forEach((line) => {
      const canonical = normalizeIngredientPhrase(line);
      if (canonical) words.add(canonical);
    });
  });
  return Array.from(words).map((item) => item.trim()).filter(Boolean).sort();
}

function currentIngredientFragment(value) {
  const parts = String(value || '').split(',');
  return parts[parts.length - 1].trim().toLowerCase();
}

function replaceCurrentIngredientFragment(input, suggestion) {
  const parts = String(input.value || '').split(',');
  parts[parts.length - 1] = ' ' + suggestion;
  input.value = parts.join(',').replace(/^\s+/, '');
  if (!input.value.trim().endsWith(',')) input.value = `${input.value.trim()}, `;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
}

function renderIngredientSuggestions(input, box) {
  if (!input || !box) return;
  const fragment = currentIngredientFragment(input.value);
  if (fragment.length < 2) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const canonicalFragment = normalizeIngredientPhrase(fragment);
  const suggestions = ingredientVocabulary()
    .filter((item) => item.toLowerCase().includes(fragment) || normalizeIngredientPhrase(item).includes(canonicalFragment))
    .slice(0, 8);
  if (!suggestions.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  box.innerHTML = suggestions.map((item) => `<button type="button" class="suggestion-chip">${escapeHtml(item)}</button>`).join('');
  Array.from(box.querySelectorAll('button')).forEach((button) => {
    button.addEventListener('click', () => replaceCurrentIngredientFragment(input, button.textContent));
  });
}

function splitList(value) {
  return String(value || '')
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitTags(value) {
  return splitList(value).map((item) => item.toLowerCase());
}

function normalizeImageList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return splitList(value);
}

function normalizeRecipe(recipe) {
  const featured = recipe.featured_image_url || recipe.image_url || '';
  const sourceImages = normalizeImageList(recipe.source_image_urls || recipe.gallery_image_urls || []);
  return {
    id: recipe.id || crypto.randomUUID(),
    created_at: recipe.created_at || new Date().toISOString(),
    updated_at: recipe.updated_at || new Date().toISOString(),
    title: recipe.title || '',
    recipe_type: recipe.recipe_type || recipe.category || '',
    dietary: Array.isArray(recipe.dietary) ? recipe.dietary : splitList(recipe.dietary),
    cuisine: recipe.cuisine || '',
    collection: recipe.collection || '',
    source_type: recipe.source_type || 'manual',
    source_label: recipe.source_label || '',
    recipe_url: recipe.recipe_url || '',
    tags: Array.isArray(recipe.tags) ? recipe.tags : splitTags(recipe.tags),
    rating: recipe.rating || null,
    is_favorite: Boolean(recipe.is_favorite),
    prep_time: recipe.prep_time || '',
    cook_time: recipe.cook_time || '',
    recipe_yield: recipe.recipe_yield || recipe.servings || '',
    featured_image_url: featured,
    image_url: featured,
    source_image_urls: sourceImages,
    ocr_text: recipe.ocr_text || '',
    ingredients: recipe.ingredients || '',
    instructions: recipe.instructions || '',
    notes: recipe.notes || ''
  };
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.recipes));
}

async function loadRecipes() {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('foodie_recipes')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      state.recipes = (data || []).map(normalizeRecipe);
      setStatus(`Loaded ${state.recipes.length} recipes from Supabase.`, 'good');
    } else {
      const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      state.recipes = local.map(normalizeRecipe);
      setStatus(`Loaded ${state.recipes.length} recipes from local browser storage.`, 'good');
    }
  } catch (error) {
    console.error(error);
    const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    state.recipes = local.map(normalizeRecipe);
    setStatus('Supabase load failed. Fell back to local storage.', 'error');
  }
  populateCuisineFilter();
  renderHomePage();
  renderList();
  renderDetail();
}

function collectForm() {
  return {
    title: els.title.value.trim(),
    recipe_type: els.recipeType.value,
    dietary: getCheckedValues(els.dietaryOptions),
    cuisine: els.cuisine.value.trim(),
    collection: els.collection.value.trim(),
    source_type: els.sourceType.value,
    source_label: els.sourceLabel.value.trim(),
    recipe_url: els.recipeUrl.value.trim(),
    tags: splitTags(els.tags.value),
    rating: els.rating.value ? Number(els.rating.value) : null,
    is_favorite: els.isFavorite.checked,
    prep_time: els.prepTime.value.trim(),
    cook_time: els.cookTime.value.trim(),
    recipe_yield: els.recipeYield.value.trim(),
    ocr_text: els.ocrText.value.trim(),
    ingredients: els.ingredients.value.trim(),
    instructions: els.instructions.value.trim(),
    notes: els.notes.value.trim()
  };
}

function resetDraftImages() {
  state.draftFeaturedImageFile = null;
  state.draftFeaturedRemoteImageUrl = '';
  state.draftSourceImageFiles = [];
  state.draftSourceRemoteImageUrls = [];
  els.featuredImageFile.value = '';
  els.sourceImageFiles.value = '';
}

function fillForm(recipe = null) {
  const r = normalizeRecipe(recipe || {});
  els.title.value = r.title;
  els.recipeType.value = r.recipe_type;
  setCheckedValues(els.dietaryOptions, r.dietary);
  els.cuisine.value = r.cuisine;
  els.collection.value = r.collection;
  els.sourceType.value = r.source_type;
  els.sourceLabel.value = r.source_label;
  els.recipeUrl.value = r.recipe_url;
  els.tags.value = r.tags.join(', ');
  els.rating.value = r.rating || '';
  els.isFavorite.checked = r.is_favorite;
  els.prepTime.value = r.prep_time;
  els.cookTime.value = r.cook_time;
  els.recipeYield.value = r.recipe_yield;
  els.ocrText.value = r.ocr_text;
  els.ingredients.value = r.ingredients;
  els.instructions.value = r.instructions;
  els.notes.value = r.notes;
  resetDraftImages();
  state.draftFeaturedRemoteImageUrl = r.featured_image_url || '';
  state.draftSourceRemoteImageUrls = [...r.source_image_urls];
  renderImagePreviews();
}

function getSelectedRecipe() {
  return state.recipes.find((r) => r.id === state.selectedId) || null;
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function ingredientTokens(text) {
  return splitList(text)
    .flatMap((item) => item.toLowerCase().split(/[^a-z0-9]+/))
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !/^\d/.test(token));
}

function searchableIngredientText(recipe) {
  return `${recipe.ingredients}\n${recipe.title}\n${recipe.tags.join(' ')}\n${recipe.notes}`.toLowerCase();
}

function analyzeIngredientMatch(recipe, includes, excludes, mode, ignoreStaples) {
  const haystack = searchableIngredientText(recipe);
  const ingredientSet = recipeIngredientSet(recipe);
  const included = includes.map(normalizeIngredientPhrase).filter((item) => item && !(ignoreStaples && STAPLES.has(item)));
  const excluded = excludes.map(normalizeIngredientPhrase).filter((item) => item && !(ignoreStaples && STAPLES.has(item)));
  const matched = included.filter((token) => ingredientSet.has(token) || haystack.includes(token));
  const missing = included.filter((token) => !(ingredientSet.has(token) || haystack.includes(token)));
  const excludedHit = excluded.some((token) => ingredientSet.has(token) || haystack.includes(token));
  let passes = !excludedHit;
  if (included.length) {
    if (mode === 'all') passes = passes && missing.length === 0;
    if (mode === 'any') passes = passes && matched.length > 0;
    if (mode === 'most') passes = passes && matched.length >= Math.max(1, Math.ceil(included.length * 0.6));
  }
  return {
    passes,
    matched,
    missing,
    score: included.length ? `${matched.length}/${included.length}` : ''
  };
}

function computeDuplicates(recipes) {
  const titleMap = new Map();
  const ingredientMap = new Map();
  recipes.forEach((recipe) => {
    const titleKey = slugify(recipe.title).replace(/-(recipe|the|a|an)$/g, '');
    const ingKey = ingredientTokens(recipe.ingredients).slice(0, 8).sort().join('|');
    if (titleKey) titleMap.set(titleKey, (titleMap.get(titleKey) || []).concat(recipe.id));
    if (ingKey) ingredientMap.set(ingKey, (ingredientMap.get(ingKey) || []).concat(recipe.id));
  });
  const dupes = new Set();
  [titleMap, ingredientMap].forEach((map) => {
    map.forEach((ids) => {
      if (ids.length > 1) ids.forEach((id) => dupes.add(id));
    });
  });
  return dupes;
}

function currentFilters() {
  return {
    search: els.searchInput.value.trim().toLowerCase(),
    type: els.typeFilter.value,
    cuisine: els.cuisineFilter ? els.cuisineFilter.value : '',
    collection: els.collectionFilter.value.trim().toLowerCase(),
    tag: els.tagFilter.value.trim().toLowerCase(),
    includes: splitIngredientSearchTerms(els.includeIngredients.value),
    excludes: splitIngredientSearchTerms(els.excludeIngredients.value),
    mode: els.ingredientMode.value,
    minRating: els.ratingFilter.value ? Number(els.ratingFilter.value) : 0,
    dietary: getCheckedValues(els.dietaryFilterOptions),
    ignoreStaples: els.ignoreStaples.checked
  };
}

function filterRecipes() {
  const filters = currentFilters();
  const duplicateIds = computeDuplicates(state.recipes);
  const now = Date.now();
  const recentThreshold = 1000 * 60 * 60 * 24 * 10;

  return state.recipes
    .map((recipe) => ({
      recipe,
      ingredientMatch: analyzeIngredientMatch(recipe, filters.includes, filters.excludes, filters.mode, filters.ignoreStaples)
    }))
    .filter(({ recipe, ingredientMatch }) => {
      const haystack = [
        recipe.title, recipe.source_label, recipe.collection, recipe.recipe_type, recipe.cuisine,
        recipe.ingredients, recipe.instructions, recipe.notes, recipe.ocr_text,
        recipe.tags.join(' '), recipe.dietary.join(' ')
      ].join('\n').toLowerCase();
      if (filters.search && !haystack.includes(filters.search)) return false;
      if (filters.type && recipe.recipe_type !== filters.type) return false;
      if (filters.cuisine && recipe.cuisine !== filters.cuisine) return false;
      if (filters.collection && !recipe.collection.toLowerCase().includes(filters.collection)) return false;
      if (filters.tag && !recipe.tags.join(' ').includes(filters.tag)) return false;
      if (filters.minRating && Number(recipe.rating || 0) < filters.minRating) return false;
      if (filters.dietary.length && !filters.dietary.every((item) => recipe.dietary.includes(item))) return false;
      if (state.favoritesOnly && !recipe.is_favorite) return false;
      if (state.duplicatesOnly && !duplicateIds.has(recipe.id)) return false;
      if (state.recentOnly && now - new Date(recipe.updated_at).getTime() > recentThreshold) return false;
      if (!ingredientMatch.passes) return false;
      return true;
    })
    .sort((a, b) => new Date(b.recipe.updated_at) - new Date(a.recipe.updated_at));
}

function imageSourcesForPreview() {
  return state.draftSourceImageFiles.map((file, index) => ({
    kind: 'file',
    index,
    src: URL.createObjectURL(file),
    label: file.name || `Source ${index + 1}`
  })).concat(
    state.draftSourceRemoteImageUrls.map((url, index) => ({
      kind: 'remote',
      index,
      src: url,
      label: `Saved source ${index + 1}`
    }))
  );
}

function featuredSourceForPreview() {
  if (state.draftFeaturedImageFile) return URL.createObjectURL(state.draftFeaturedImageFile);
  return state.draftFeaturedRemoteImageUrl || '';
}

function renderImagePreviews() {
  const featured = featuredSourceForPreview();
  if (featured) {
    els.featuredImagePreview.src = featured;
    els.featuredImagePreview.hidden = false;
    els.featuredImageEmpty.hidden = true;
  } else {
    els.featuredImagePreview.hidden = true;
    els.featuredImagePreview.removeAttribute('src');
    els.featuredImageEmpty.hidden = false;
  }

  els.sourceImageGallery.innerHTML = '';
  const previews = imageSourcesForPreview();
  if (!previews.length) {
    els.sourceImageGallery.innerHTML = '<div class="image-empty gallery-empty">No source pages or extra photos saved yet.</div>';
    return;
  }

  previews.forEach((item, displayIndex) => {
    const card = document.createElement('div');
    card.className = 'source-thumb-card';
    card.innerHTML = `
      <img class="source-thumb" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.label)}" />
      <div class="source-thumb-label">${escapeHtml(item.label)}</div>
      <div class="source-thumb-actions">
        <button type="button" class="set-featured-btn">Set as featured</button>
        <button type="button" class="remove-source-btn danger-lite">Remove</button>
      </div>
    `;
    card.querySelector('.set-featured-btn').addEventListener('click', () => setSourceAsFeatured(item));
    card.querySelector('.remove-source-btn').addEventListener('click', () => removeSourcePreview(item, displayIndex));
    els.sourceImageGallery.appendChild(card);
  });
}

function setSourceAsFeatured(item) {
  if (item.kind === 'file') {
    state.draftFeaturedImageFile = state.draftSourceImageFiles[item.index];
    state.draftFeaturedRemoteImageUrl = '';
    state.draftSourceImageFiles = state.draftSourceImageFiles.filter((_, idx) => idx !== item.index);
  } else {
    state.draftFeaturedImageFile = null;
    state.draftFeaturedRemoteImageUrl = state.draftSourceRemoteImageUrls[item.index];
    state.draftSourceRemoteImageUrls = state.draftSourceRemoteImageUrls.filter((_, idx) => idx !== item.index);
  }
  renderImagePreviews();
  setStatus('Set that image as the featured food photo.', 'good');
}

function removeSourcePreview(item) {
  if (item.kind === 'file') {
    state.draftSourceImageFiles = state.draftSourceImageFiles.filter((_, idx) => idx !== item.index);
  } else {
    state.draftSourceRemoteImageUrls = state.draftSourceRemoteImageUrls.filter((_, idx) => idx !== item.index);
  }
  renderImagePreviews();
}

function renderList() {
  const filtered = filterRecipes();
  els.recipeList.innerHTML = '';
  els.recipeCount.textContent = `${filtered.length} recipe${filtered.length === 1 ? '' : 's'}`;

  if (!filtered.length) {
    els.recipeList.innerHTML = '<div class="muted">No recipes match those filters. The pantry gods are silent.</div>';
    return;
  }

  filtered.forEach(({ recipe, ingredientMatch }) => {
    const node = els.recipeCardTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.recipe-card-title').textContent = recipe.title || '(Untitled recipe)';
    node.querySelector('.recipe-card-subline').textContent = [recipe.recipe_type, recipe.cuisine, recipe.collection].filter(Boolean).join(' • ');
    node.querySelector('.recipe-card-rating').textContent = recipe.rating ? `★ ${recipe.rating}` : '';
    const img = node.querySelector('.recipe-card-image');
    const imageUrl = recipe.featured_image_url || recipe.image_url || '';
    if (imageUrl) {
      img.src = imageUrl;
      img.hidden = false;
      img.alt = recipe.title || 'Recipe image';
    }
    const matchEl = node.querySelector('.recipe-card-match');
    if (ingredientMatch.score) {
      matchEl.innerHTML = `<strong>${ingredientMatch.score}</strong> matched${ingredientMatch.missing.length ? ` • missing ${escapeHtml(ingredientMatch.missing.join(', '))}` : ''}`;
    } else {
      matchEl.textContent = recipe.dietary.join(' • ');
    }
    node.querySelector('.recipe-card-tags').textContent = [...recipe.dietary, ...recipe.tags.slice(0, 4)].join(' • ');
    if (recipe.id === state.selectedId) node.classList.add('active');
    node.addEventListener('click', () => {
      state.selectedId = recipe.id;
      renderList();
      renderDetail();
      fillForm(recipe);
      routeTo('browsePage');
      if (window.innerWidth <= 760) activateMobilePanel('detailPanel');
    });
    els.recipeList.appendChild(node);
  });
}

function renderDetail() {
  const recipe = getSelectedRecipe();
  if (!recipe) {
    els.recipeDetail.className = 'recipe-detail empty-state';
    els.recipeDetail.innerHTML = '<p>Select a recipe. Your future self will be grateful and slightly suspicious.</p>';
    return;
  }

  const featured = recipe.featured_image_url || recipe.image_url || '';
  const sourceGallery = recipe.source_image_urls.length
    ? `<div class="detail-gallery">${recipe.source_image_urls.map((url, idx) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><img class="detail-gallery-thumb" src="${escapeHtml(url)}" alt="Source image ${idx + 1}" /></a>`).join('')}</div>`
    : '<div class="muted">No saved source pages or extra photos.</div>';

  els.recipeDetail.className = 'recipe-detail';
  els.recipeDetail.innerHTML = `
    <h3>${escapeHtml(recipe.title || '(Untitled recipe)')}</h3>
    <div class="detail-meta-grid">
      <div><span class="label">Type:</span> ${escapeHtml(recipe.recipe_type || '—')}</div>
      <div><span class="label">Dietary:</span> ${escapeHtml(recipe.dietary.join(', ') || '—')}</div>
      <div><span class="label">Cuisine:</span> ${escapeHtml(recipe.cuisine || '—')}</div>
      <div><span class="label">Collection:</span> ${escapeHtml(recipe.collection || '—')}</div>
      <div><span class="label">Prep:</span> ${escapeHtml(recipe.prep_time || '—')}</div>
      <div><span class="label">Cook:</span> ${escapeHtml(recipe.cook_time || '—')}</div>
      <div><span class="label">Yield:</span> ${escapeHtml(recipe.recipe_yield || '—')}</div>
      <div><span class="label">Rating:</span> ${recipe.rating ? `★ ${escapeHtml(recipe.rating)}` : '—'}${recipe.is_favorite ? ' • Favorite' : ''}</div>
    </div>
    ${featured ? `<img class="recipe-image" src="${escapeHtml(featured)}" alt="${escapeHtml(recipe.title)}" />` : ''}
    <div class="section"><span class="label">Source:</span> ${escapeHtml(recipe.source_type || '—')} ${recipe.source_label ? `• ${escapeHtml(recipe.source_label)}` : ''}</div>
    ${recipe.recipe_url ? `<div class="section"><span class="label">URL:</span> <a href="${escapeHtml(recipe.recipe_url)}" target="_blank" rel="noopener noreferrer">Open recipe source</a></div>` : ''}
    ${recipe.tags.length ? `<div class="section"><span class="label">Tags:</span><div>${recipe.tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('')}</div></div>` : ''}
    <div class="section"><div class="label">Ingredients</div><pre>${escapeHtml(recipe.ingredients || '—')}</pre></div>
    <div class="section"><div class="label">Instructions</div><pre>${escapeHtml(recipe.instructions || '—')}</pre></div>
    ${recipe.notes ? `<div class="section"><div class="label">Notes</div><pre>${escapeHtml(recipe.notes)}</pre></div>` : ''}
    <div class="section source-gallery-section"><div class="label">Source Pages / Extra Photos</div>${sourceGallery}</div>
    ${recipe.ocr_text ? `<div class="section source-text"><div class="label">OCR / Imported text</div><pre>${escapeHtml(recipe.ocr_text)}</pre></div>` : ''}
  `;
}

async function uploadSingleImage(file, path) {
  if (!supabase) return await fileToDataUrl(file);
  const bucket = cfg.storageBucket || 'foodie_recipe_assets';
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg'
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadRecipeImages(recipeId) {
  let featuredUrl = state.draftFeaturedRemoteImageUrl || '';
  if (state.draftFeaturedImageFile) {
    const ext = state.draftFeaturedImageFile.name.split('.').pop() || 'jpg';
    featuredUrl = await uploadSingleImage(state.draftFeaturedImageFile, `${recipeId}/featured-${Date.now()}.${ext}`);
  }

  const sourceUrls = [...state.draftSourceRemoteImageUrls];
  for (const [index, file] of state.draftSourceImageFiles.entries()) {
    const ext = file.name.split('.').pop() || 'jpg';
    const uploaded = await uploadSingleImage(file, `${recipeId}/source-${Date.now()}-${index}.${ext}`);
    sourceUrls.push(uploaded);
  }

  return { featuredUrl, sourceUrls };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function guessTagsFromText(text) {
  const haystack = String(text || '').toLowerCase();
  const dictionary = {
    soup: ['soup', 'bisque', 'chowder'],
    sauce: ['sauce', 'gravy', 'aioli'],
    fish: ['fish', 'salmon', 'trout', 'cod', 'walleye'],
    mushrooms: ['mushroom', 'porcini', 'cremini'],
    dessert: ['dessert', 'cake', 'cookie', 'brownie', 'pie'],
    breakfast: ['breakfast', 'pancake', 'waffle', 'omelet'],
    vegetarian: ['vegetarian'],
    vegan: ['vegan'],
    'gluten-free': ['gluten free', 'gluten-free'],
    'camp-food': ['camp', 'campfire', 'dutch oven']
  };
  return Object.entries(dictionary).filter(([, words]) => words.some((word) => haystack.includes(word))).map(([tag]) => tag);
}

function parseImportedText(text) {
  const cleaned = String(text || '').replace(/\r/g, '').trim();
  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);
  const title = lines[0] || '';
  const lower = cleaned.toLowerCase();
  const ingredientsMarker = lower.search(/ingredients?\s*:?/);
  const directionsMarker = lower.search(/(directions|instructions|method)\s*:?/);
  let ingredients = '';
  let instructions = '';

  if (ingredientsMarker >= 0 && directionsMarker > ingredientsMarker) {
    ingredients = cleaned.slice(ingredientsMarker, directionsMarker).replace(/ingredients?\s*:?/i, '').trim();
    instructions = cleaned.slice(directionsMarker).replace(/(directions|instructions|method)\s*:?/i, '').trim();
  } else if (directionsMarker >= 0) {
    ingredients = lines.slice(1, Math.max(2, Math.ceil(lines.length / 2))).join('\n');
    instructions = cleaned.slice(directionsMarker).replace(/(directions|instructions|method)\s*:?/i, '').trim();
  } else {
    const midpoint = Math.ceil(lines.length / 2);
    ingredients = lines.slice(1, midpoint).join('\n');
    instructions = lines.slice(midpoint).join('\n');
  }

  return {
    title,
    ingredients,
    instructions,
    tags: guessTagsFromText(cleaned)
  };
}

function getOcrTargets() {
  const targets = [];
  state.draftSourceImageFiles.forEach((file, index) => {
    targets.push({ target: file, label: file.name || `Source page ${index + 1}` });
  });
  state.draftSourceRemoteImageUrls.forEach((url, index) => {
    targets.push({ target: url, label: `Saved source page ${index + 1}` });
  });
  if (!targets.length) {
    if (state.draftFeaturedImageFile) targets.push({ target: state.draftFeaturedImageFile, label: state.draftFeaturedImageFile.name || 'Featured image' });
    else if (state.draftFeaturedRemoteImageUrl) targets.push({ target: state.draftFeaturedRemoteImageUrl, label: 'Featured image' });
  }
  return targets;
}

function mergeParsedTags(parsedBlocks) {
  const tags = new Set(splitTags(els.tags.value));
  parsedBlocks.forEach((parsed) => parsed.tags.forEach((tag) => tags.add(tag)));
  els.tags.value = Array.from(tags).join(', ');
}

async function runOcr() {
  const targets = getOcrTargets();
  if (!targets.length) {
    setStatus('Choose one or more source images first.', 'error');
    return;
  }
  try {
    const combinedChunks = [];
    const parsedBlocks = [];
    for (const [index, item] of targets.entries()) {
      setStatus(`Running OCR on page ${index + 1} of ${targets.length}: ${item.label}`);
      const result = await Tesseract.recognize(item.target, 'eng');
      const text = String(result?.data?.text || '').trim();
      if (!text) continue;
      combinedChunks.push(`===== PAGE ${index + 1}: ${item.label} =====\n${text}`);
      parsedBlocks.push(parseImportedText(text));
    }
    const combinedText = combinedChunks.join('\n\n');
    if (!combinedText) {
      setStatus('OCR ran, but no readable text came back.', 'error');
      return;
    }
    els.ocrText.value = combinedText;
    const parsedCombined = parseImportedText(combinedText);
    if (!els.title.value) {
      const firstTitledBlock = parsedBlocks.find((block) => block.title);
      if (firstTitledBlock?.title) els.title.value = firstTitledBlock.title;
      else if (parsedCombined.title) els.title.value = parsedCombined.title;
    }
    if (!els.ingredients.value && parsedCombined.ingredients) els.ingredients.value = parsedCombined.ingredients;
    if (!els.instructions.value && parsedCombined.instructions) els.instructions.value = parsedCombined.instructions;
    mergeParsedTags(parsedBlocks.length ? parsedBlocks : [parsedCombined]);
    setStatus(`OCR complete across ${targets.length} page${targets.length === 1 ? '' : 's'}. Verify it before betting dinner on it.`, 'good');
  } catch (error) {
    console.error(error);
    setStatus('OCR failed on one of the selected pages. Likely a bad image or a cranky browser.', 'error');
  }
}

function tryParseJsonLd(htmlText) {
  const matches = [...htmlText.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of matches) {
    try {
      const candidate = JSON.parse(match[1].trim());
      const items = Array.isArray(candidate) ? candidate : [candidate];
      for (const item of items.flatMap(flattenJsonLd)) {
        if (item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) {
          return item;
        }
      }
    } catch (_) {}
  }
  return null;
}

function flattenJsonLd(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(flattenJsonLd);
  const results = [node];
  if (node['@graph']) results.push(...flattenJsonLd(node['@graph']));
  return results;
}

function textFromHowToStep(step) {
  if (!step) return '';
  if (typeof step === 'string') return step.trim();
  if (Array.isArray(step)) return step.map(textFromHowToStep).filter(Boolean).join('\n');
  return String(step.text || step.name || '').trim();
}

function coerceRecipeImage(recipeJson) {
  const image = recipeJson?.image;
  if (!image) return '';
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === 'string') return first;
    return first?.url || '';
  }
  return image.url || '';
}

async function importFromUrl() {
  const url = els.recipeUrl.value.trim();
  if (!url) {
    setStatus('Paste a recipe URL first.', 'error');
    return;
  }
  try {
    setStatus('Importing from URL…');
    const proxyUrls = [
      `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    ];
    let text = '';
    for (const candidate of proxyUrls) {
      try {
        const response = await fetch(candidate);
        if (!response.ok) continue;
        text = await response.text();
        if (text) break;
      } catch (_) {}
    }
    if (!text) throw new Error('No import text returned');

    const recipeJson = tryParseJsonLd(text);
    if (recipeJson) {
      els.title.value = els.title.value || recipeJson.name || '';
      els.recipeYield.value = recipeJson.recipeYield || els.recipeYield.value;
      els.ingredients.value = Array.isArray(recipeJson.recipeIngredient) ? recipeJson.recipeIngredient.join('\n') : els.ingredients.value;
      const steps = recipeJson.recipeInstructions ? textFromHowToStep(recipeJson.recipeInstructions) : '';
      els.instructions.value = steps || els.instructions.value;
      const detected = guessTagsFromText(JSON.stringify(recipeJson));
      const merged = new Set([...splitTags(els.tags.value), ...detected]);
      els.tags.value = Array.from(merged).join(', ');
      const importedImage = coerceRecipeImage(recipeJson);
      if (importedImage && !state.draftFeaturedRemoteImageUrl && !state.draftFeaturedImageFile) {
        state.draftFeaturedRemoteImageUrl = importedImage;
        renderImagePreviews();
      }
      els.ocrText.value = JSON.stringify(recipeJson, null, 2);
      setStatus('Structured recipe import worked. Miracles happen.', 'good');
      return;
    }

    const parsed = parseImportedText(text);
    if (!els.title.value && parsed.title) els.title.value = parsed.title;
    if (!els.ingredients.value && parsed.ingredients) els.ingredients.value = parsed.ingredients;
    if (!els.instructions.value && parsed.instructions) els.instructions.value = parsed.instructions;
    els.ocrText.value = text.slice(0, 12000).trim();
    const merged = new Set([...splitTags(els.tags.value), ...parsed.tags]);
    els.tags.value = Array.from(merged).join(', ');
    setStatus('Imported page text. It looks usable, but check it before trusting it.', 'good');
  } catch (error) {
    console.error(error);
    setStatus('URL import failed. Some sites hate being helpful.', 'error');
  }
}

async function saveRecipe() {
  const form = collectForm();
  if (!form.title) {
    setStatus('Title is required. Even a rough one.', 'error');
    return;
  }

  const existing = getSelectedRecipe();
  const recipe = normalizeRecipe({ ...existing, ...form });
  recipe.updated_at = new Date().toISOString();

  try {
    const images = await uploadRecipeImages(recipe.id);
    recipe.featured_image_url = images.featuredUrl;
    recipe.image_url = images.featuredUrl;
    recipe.source_image_urls = images.sourceUrls;

    if (supabase) {
      const payload = {
        ...recipe,
        category: recipe.recipe_type,
        servings: recipe.recipe_yield
      };
      const { error } = await supabase.from('foodie_recipes').upsert(payload);
      if (error) throw error;
    }
    const index = state.recipes.findIndex((item) => item.id === recipe.id);
    if (index >= 0) state.recipes[index] = recipe;
    else state.recipes.unshift(recipe);
    saveLocal();
    state.selectedId = recipe.id;
    fillForm(recipe);
    populateCuisineFilter();
    renderHomePage();
    renderList();
    renderDetail();
    setStatus('Recipe saved with featured and source images intact.', 'good');
    routeTo('browsePage');
    if (window.innerWidth <= 760) activateMobilePanel('detailPanel');
  } catch (error) {
    console.error(error);
    setStatus('Save failed. Check Supabase config or browser storage.', 'error');
  }
}

async function deleteRecipe() {
  const recipe = getSelectedRecipe();
  if (!recipe) return;
  if (!confirm(`Delete "${recipe.title}"?`)) return;
  try {
    if (supabase) {
      const { error } = await supabase.from('foodie_recipes').delete().eq('id', recipe.id);
      if (error) throw error;
    }
    state.recipes = state.recipes.filter((item) => item.id !== recipe.id);
    saveLocal();
    state.selectedId = null;
    fillForm(null);
    populateCuisineFilter();
    renderHomePage();
    renderList();
    renderDetail();
    setStatus('Recipe deleted.', 'good');
  } catch (error) {
    console.error(error);
    setStatus('Delete failed.', 'error');
  }
}

function newRecipe() {
  state.selectedId = null;
  fillForm(null);
  renderList();
  renderDetail();
  setStatus('Blank recipe ready.');
  routeTo('editPage');
  if (window.innerWidth <= 760) activateMobilePanel('addPanel');
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.recipes, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recipe-repository-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(String(reader.result || '[]')).map(normalizeRecipe);
      state.recipes = imported;
      saveLocal();
      if (supabase) {
        const { error } = await supabase.from('foodie_recipes').upsert(imported.map((recipe) => ({ ...recipe, category: recipe.recipe_type, servings: recipe.recipe_yield })));
        if (error) throw error;
      }
      state.selectedId = imported[0]?.id || null;
      populateCuisineFilter();
      renderHomePage();
      renderList();
      renderDetail();
      if (state.selectedId) fillForm(getSelectedRecipe());
      setStatus(`Imported ${imported.length} recipes.`, 'good');
    } catch (error) {
      console.error(error);
      setStatus('Import failed. JSON may be malformed.', 'error');
    }
  };
  reader.readAsText(file);
}

function activateMobilePanel(panelId) {
  els.mobileTabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.mobilePanel === panelId));
  els.mobilePanels.forEach((panel) => panel.classList.toggle('is-active', panel.id === panelId));
}

function handleFeaturedChoice(file) {
  if (!file) return;
  state.draftFeaturedImageFile = file;
  state.draftFeaturedRemoteImageUrl = '';
  renderImagePreviews();
}

function handleSourceChoice(files) {
  const incoming = Array.from(files || []).filter(Boolean);
  if (!incoming.length) return;
  state.draftSourceImageFiles = state.draftSourceImageFiles.concat(incoming);
  renderImagePreviews();
}

function handlePastedImage(file) {
  if (!file) return;
  if (!state.draftFeaturedImageFile && !state.draftFeaturedRemoteImageUrl) {
    handleFeaturedChoice(file);
    setStatus('Pasted image set as featured photo.', 'good');
  } else {
    state.draftSourceImageFiles.push(file);
    renderImagePreviews();
    setStatus('Pasted image added to source pages.', 'good');
  }
}

function bindEvents() {
  els.newRecipeBtn.addEventListener('click', () => {
    newRecipe();
    activatePage('editPage');
  });
  els.runOcrBtn.addEventListener('click', runOcr);
  els.importFromUrlBtn.addEventListener('click', importFromUrl);
  els.saveRecipeBtn.addEventListener('click', saveRecipe);
  els.deleteBtn.addEventListener('click', deleteRecipe);
  els.exportBtn.addEventListener('click', exportJson);
  els.importFile.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) importJson(file);
    event.target.value = '';
  });
  els.featuredImageFile.addEventListener('change', (event) => handleFeaturedChoice(event.target.files?.[0]));
  els.sourceImageFiles.addEventListener('change', (event) => handleSourceChoice(event.target.files));
  document.addEventListener('paste', (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (imageItem) handlePastedImage(imageItem.getAsFile());
  });

  [els.searchInput, els.typeFilter, els.cuisineFilter, els.collectionFilter, els.tagFilter, els.includeIngredients, els.excludeIngredients, els.ingredientMode, els.ratingFilter, els.ignoreStaples].filter(Boolean).forEach((el) => {
    el.addEventListener('input', renderList);
    el.addEventListener('change', renderList);
  });
  if (els.homeSearchBtn) els.homeSearchBtn.addEventListener('click', () => applyHomeBrowsePreset({ search: els.homeSearchInput.value.trim() }));
  if (els.homeSearchInput) els.homeSearchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') applyHomeBrowsePreset({ search: els.homeSearchInput.value.trim() }); });
  if (els.quickOpenBrowseBtn) els.quickOpenBrowseBtn.addEventListener('click', () => routeTo('browsePage'));
  if (els.quickOpenEditBtn) els.quickOpenEditBtn.addEventListener('click', () => routeTo('editPage'));
  if (els.homeFavoritesBtn) els.homeFavoritesBtn.addEventListener('click', () => applyHomeBrowsePreset({ favorites: true }));
  if (els.homeRecentBtn) els.homeRecentBtn.addEventListener('click', () => applyHomeBrowsePreset({ recent: true }));
  if (els.goToEditBtn) els.goToEditBtn.addEventListener('click', () => {
    const recipe = getSelectedRecipe();
    if (recipe) fillForm(recipe);
    activatePage('editPage');
  });
  els.pageTabs.forEach((tab) => tab.addEventListener('click', () => routeTo(tab.dataset.page)));
  window.addEventListener('hashchange', activatePageFromHash);
  els.includeIngredients.addEventListener('input', () => renderIngredientSuggestions(els.includeIngredients, els.includeIngredientSuggestions));
  els.excludeIngredients.addEventListener('input', () => renderIngredientSuggestions(els.excludeIngredients, els.excludeIngredientSuggestions));
  els.includeIngredients.addEventListener('blur', () => setTimeout(() => { els.includeIngredientSuggestions.hidden = true; }, 120));
  els.excludeIngredients.addEventListener('blur', () => setTimeout(() => { els.excludeIngredientSuggestions.hidden = true; }, 120));
  els.includeIngredients.addEventListener('focus', () => renderIngredientSuggestions(els.includeIngredients, els.includeIngredientSuggestions));
  els.excludeIngredients.addEventListener('focus', () => renderIngredientSuggestions(els.excludeIngredients, els.excludeIngredientSuggestions));
  els.dietaryFilterOptions.addEventListener('change', renderList);

  els.favoritesOnlyBtn.addEventListener('click', () => {
    state.favoritesOnly = !state.favoritesOnly;
    els.favoritesOnlyBtn.classList.toggle('is-on', state.favoritesOnly);
    renderList();
  });
  els.duplicatesBtn.addEventListener('click', () => {
    state.duplicatesOnly = !state.duplicatesOnly;
    els.duplicatesBtn.classList.toggle('is-on', state.duplicatesOnly);
    renderList();
  });
  els.recentBtn.addEventListener('click', () => {
    state.recentOnly = !state.recentOnly;
    els.recentBtn.classList.toggle('is-on', state.recentOnly);
    renderList();
  });
  els.clearFiltersBtn.addEventListener('click', () => {
    els.searchInput.value = '';
    els.typeFilter.value = '';
    els.collectionFilter.value = '';
    els.tagFilter.value = '';
    els.includeIngredients.value = '';
    els.excludeIngredients.value = '';
    els.ingredientMode.value = 'all';
    els.ratingFilter.value = '';
    els.ignoreStaples.checked = true;
    setCheckedValues(els.dietaryFilterOptions, []);
    state.favoritesOnly = false;
    state.duplicatesOnly = false;
    state.recentOnly = false;
    els.favoritesOnlyBtn.classList.remove('is-on');
    els.duplicatesBtn.classList.remove('is-on');
    els.recentBtn.classList.remove('is-on');
    renderList();
  });
  els.printBtn.addEventListener('click', () => {
    document.body.dataset.printMode = 'page';
    window.print();
  });
  els.printIndexCardBtn.addEventListener('click', () => {
    document.body.dataset.printMode = 'card';
    window.print();
  });
  els.mobileTabs.forEach((tab) => tab.addEventListener('click', () => activateMobilePanel(tab.dataset.mobilePanel)));
}

function bootstrap() {
  bindDelegatedRouting();
  populateSelects();
  renderDietaryOptions();
  bindEvents();
  loadRecipes();
  renderHomePage();
  newRecipe();
  activatePageFromHash();
}

try {
  bootstrap();
} catch (error) {
  console.error('Recipe Repository bootstrap failed:', error);
  try {
    if (typeof window.__recipeFallbackShowPage === 'function') window.__recipeFallbackShowPage((window.location.hash || '').replace('#', '') || 'homePage');
    const statusEl = document.getElementById('statusText');
    if (statusEl) {
      statusEl.textContent = 'App loaded with errors. Basic page navigation should still work; check the browser console for the exact script error.';
      statusEl.dataset.tone = 'error';
    }
  } catch (_) {}
}

