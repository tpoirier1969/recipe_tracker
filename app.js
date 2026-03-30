(() => {
  'use strict';

  const APP_VERSION = 'v0.9.1';
  const TABLE = 'foodie_recipes';
  const BUCKET = 'foodie_recipe_assets';
  const STORAGE_KEY = 'recipeRepositoryData_v091';
  const LEGACY_STORAGE_KEYS = ['recipeRepositoryData_v091', 'recipeRepositoryData_v090', 'recipeRepositoryData_v080'];
  const LOCAL_ONLY_KEY = 'recipeRepositoryLocalOnly_v091';

  const RECIPE_TYPES = ['Appetizer', 'Breakfast', 'Bread', 'Dessert', 'Drink', 'Main Dish', 'Side Dish', 'Sauce', 'Soup/Stew', 'Salad', 'Snack', 'Camp Food'];
  const DIETARY_OPTIONS = ['Gluten Free', 'Vegan', 'Vegetarian', 'Dairy Free', 'Low Carb'];
  const PRESET_CUISINES = ['American', 'Cajun/Creole', 'Chinese', 'French', 'German', 'Greek', 'Indian', 'Italian', 'Japanese', 'Korean', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Nordic', 'Spanish', 'Swedish', 'Tex-Mex', 'Thai', 'Vietnamese'];
  const INGREDIENT_CANONICALS = {
    'green onion': ['scallion', 'scallions', 'green onions', 'spring onion', 'spring onions'],
    'bell pepper': ['sweet pepper', 'sweet peppers', 'bell peppers', 'capsicum'],
    cilantro: ['coriander leaves', 'fresh coriander'],
    zucchini: ['courgette', 'courgettes'],
    eggplant: ['aubergine', 'aubergines'],
    'garbanzo bean': ['chickpea', 'chickpeas', 'garbanzo beans'],
    'confectioners sugar': ['powdered sugar', 'icing sugar'],
    'heavy cream': ['double cream', 'whipping cream'],
    cornstarch: ['corn flour'],
    'ground beef': ['hamburger', 'minced beef'],
    shrimp: ['prawn', 'prawns'],
    arugula: ['rocket'],
    'green bean': ['haricots verts', 'green beans'],
    parmesan: ['parmigiano reggiano'],
    'red pepper flake': ['crushed red pepper', 'crushed red pepper flakes', 'red pepper flakes']
  };
  const PANTRY_STAPLES = new Set(['salt', 'pepper', 'black pepper', 'water', 'olive oil', 'vegetable oil', 'butter', 'garlic powder', 'onion powder', 'flour', 'sugar']);

  const els = {};
  const state = {
    recipes: [],
    selectedId: null,
    currentPage: 'homePage',
    loadedFrom: 'local browser storage',
    supabase: null,
    ingredientTerms: [],
    tagTerms: [],
    pendingLocalRecipes: [],
    draft: { featuredFile: null, sourceFiles: [], featuredExisting: '', sourceExisting: [] },
    formTags: [],
    filters: {
      search: '',
      type: '',
      cuisine: '',
      collection: '',
      tag: '',
      minRating: '',
      dietary: [],
      includeIngredients: '',
      excludeIngredients: '',
      ingredientMode: 'all',
      ignoreStaples: true,
      favoritesOnly: false,
      duplicatesOnly: false,
      recentOnly: false
    }
  };

  let aliasMap = null;

  document.addEventListener('DOMContentLoaded', init);

  function $(id) {
    return document.getElementById(id);
  }

  function init() {
    cacheEls();
    initStaticUi();
    bindEvents();
    routeFromHash();
    window.addEventListener('hashchange', routeFromHash);
    connectSupabase();
    startup().catch((error) => {
      console.error(error);
      loadLocalRecipesSync();
      refreshAll();
      setSyncBadge('Local only', 'bad');
      setStatus('Startup hit a problem. Loaded local data only.', 'error');
    });
  }

  function cacheEls() {
    [
      'syncBadge', 'statusText', 'migrateLocalBtn',
      'homeSearchInput', 'homeSearchBtn', 'newRecipeBtn', 'homeFavoritesBtn', 'homeRecentBtn', 'quickOpenBrowseBtn', 'chooseSourcePhotosBtn',
      'urlImportDialog', 'urlImportInput', 'confirmUrlImportBtn', 'cancelUrlImportBtn',
      'homeStats', 'homeTypeButtons', 'homeCuisineButtons', 'homeDietaryButtons',
      'searchInput', 'typeFilter', 'cuisineFilter', 'collectionFilter', 'tagFilter', 'ratingFilter',
      'includeIngredients', 'excludeIngredients', 'ingredientMode', 'ignoreStaples',
      'includeIngredientSuggestions', 'excludeIngredientSuggestions',
      'dietaryOptions', 'dietaryFilterOptions', 'favoritesOnlyBtn', 'duplicatesBtn', 'recentBtn', 'clearFiltersBtn',
      'recipeCount', 'recipeList', 'recipeDetail', 'recipeCardTemplate', 'exportBtn', 'importFile',
      'printBtn', 'printIndexCardBtn', 'deleteBtn', 'goToEditBtn',
      'runOcrBtn', 'importFromUrlBtn', 'saveRecipeBtn',
      'title', 'recipeType', 'cuisine', 'collection', 'sourceType', 'sourceLabel', 'recipeUrl',
      'tags', 'tagPicker', 'tagChipList', 'tagEntry', 'tagSuggestions',
      'rating', 'isFavorite', 'prepTime', 'cookTime', 'recipeYield',
      'featuredImageFile', 'sourceImageFiles', 'featuredImagePreview', 'featuredImageEmpty', 'sourceImageGallery',
      'ocrText', 'ingredients', 'instructions', 'notes'
    ].forEach((id) => {
      els[id] = $(id);
    });
    els.pageTabs = [...document.querySelectorAll('.page-tab')];
    els.appPages = [...document.querySelectorAll('.app-page')];
  }

  async function startup() {
    await loadRecipes();
    refreshAll();
    refreshPendingLocalRecipes();
    updateSyncUi();
    setStatus(`Ready. Loaded ${state.recipes.length} recipes from ${state.loadedFrom}.`, 'success');
  }

  function initStaticUi() {
    document.body.dataset.appVersion = APP_VERSION;
    const versionFlag = document.querySelector('.version-flag');
    if (versionFlag) versionFlag.textContent = APP_VERSION;
    fillSelect(els.recipeType, RECIPE_TYPES, 'Choose type');
    fillSelect(els.typeFilter, RECIPE_TYPES, 'All types');
    renderCheckGroup(els.dietaryOptions, 'dietEdit', DIETARY_OPTIONS);
    renderCheckGroup(els.dietaryFilterOptions, 'dietFilter', DIETARY_OPTIONS);
    refreshCuisineFilter();
    renderTagChips();
  }

  function bindEvents() {
    els.pageTabs.forEach((tab) => bind(tab, 'click', () => routeTo(tab.dataset.page || 'homePage')));
    bind(els.homeSearchBtn, 'click', handleHomeSearch);
    bind(els.newRecipeBtn, 'click', () => {
      clearForm();
      routeTo('editPage');
      setStatus('New recipe form ready.', 'neutral');
    });
    bind(els.homeRecentBtn, 'click', () => applyHomePreset({ recentOnly: true }));
    bind(els.quickOpenBrowseBtn, 'click', () => applyHomePreset({}));
    bind(els.migrateLocalBtn, 'click', migratePendingLocalRecipes);

    [
      ['searchInput', 'search'],
      ['typeFilter', 'type'],
      ['cuisineFilter', 'cuisine'],
      ['collectionFilter', 'collection'],
      ['tagFilter', 'tag'],
      ['ratingFilter', 'minRating'],
      ['ingredientMode', 'ingredientMode']
    ].forEach(([id, key]) => {
      const eventName = ['typeFilter', 'cuisineFilter', 'ratingFilter', 'ingredientMode'].includes(id) ? 'change' : 'input';
      bind(els[id], eventName, () => {
        state.filters[key] = getElValue(els[id]);
        renderList();
      });
    });

    bind(els.ignoreStaples, 'change', () => {
      state.filters.ignoreStaples = !!els.ignoreStaples.checked;
      renderList();
    });
    bind(els.dietaryFilterOptions, 'change', () => {
      state.filters.dietary = getCheckedValues(els.dietaryFilterOptions);
      renderList();
    });
    bind(els.favoritesOnlyBtn, 'click', () => {
      state.filters.favoritesOnly = !state.filters.favoritesOnly;
      renderList();
    });
    bind(els.duplicatesBtn, 'click', () => {
      state.filters.duplicatesOnly = !state.filters.duplicatesOnly;
      renderList();
    });
    bind(els.recentBtn, 'click', () => {
      state.filters.recentOnly = !state.filters.recentOnly;
      renderList();
    });
    bind(els.clearFiltersBtn, 'click', clearFilters);

    bind(els.chooseSourcePhotosBtn, 'click', () => els.sourceImageFiles?.click());

    bind(els.featuredImageFile, 'change', (e) => {
      state.draft.featuredFile = e.target.files?.[0] || null;
      renderFormPreviews();
    });
    bind(els.sourceImageFiles, 'change', (e) => {
      state.draft.sourceFiles = [...(e.target.files || [])];
      renderFormPreviews();
      if (state.draft.sourceFiles.length) setStatus(`Selected ${state.draft.sourceFiles.length} source photo${state.draft.sourceFiles.length === 1 ? '' : 's'}. Tap Run OCR when ready.`, 'neutral');
    });

    bind(els.runOcrBtn, 'click', runOcrOnSourcePages);
    bind(els.importFromUrlBtn, 'click', openUrlImportDialog);
    bind(els.confirmUrlImportBtn, 'click', importFromUrl);
    bind(els.cancelUrlImportBtn, 'click', () => els.urlImportDialog?.close());
    bind(els.saveRecipeBtn, 'click', saveRecipe);
    bind(els.exportBtn, 'click', exportJson);
    bind(els.importFile, 'change', importJson);
    bind(els.goToEditBtn, 'click', editSelectedRecipe);
    bind(els.printBtn, 'click', () => printSelected('full'));
    bind(els.printIndexCardBtn, 'click', () => printSelected('card'));
    bind(els.deleteBtn, 'click', deleteSelectedRecipe);

    bind(els.includeIngredients, 'input', () => {
      state.filters.includeIngredients = els.includeIngredients.value;
      renderIngredientSuggestions('include');
      renderList();
    });
    bind(els.excludeIngredients, 'input', () => {
      state.filters.excludeIngredients = els.excludeIngredients.value;
      renderIngredientSuggestions('exclude');
      renderList();
    });
    bindIngredientSuggestionBox('include');
    bindIngredientSuggestionBox('exclude');

    bind(els.tagEntry, 'input', renderTagSuggestions);
    bind(els.tagEntry, 'keydown', handleTagEntryKeydown);
    bind(els.tagSuggestions, 'click', handleTagSuggestionClick);
    bind(els.tagChipList, 'click', handleTagChipClick);

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.suggestion-box') && event.target !== els.includeIngredients && event.target !== els.excludeIngredients) {
        hideIngredientSuggestions('include');
        hideIngredientSuggestions('exclude');
      }
      if (!event.target.closest('#tagPicker')) {
        hideTagSuggestions();
      }
    });
  }

  function bind(el, eventName, fn) {
    if (el) el.addEventListener(eventName, fn);
  }

  function getElValue(el) {
    if (!el) return '';
    return typeof el.value === 'string' ? el.value.trim() : el.value;
  }

  function fillSelect(select, values, firstLabel) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${firstLabel}</option>`;
    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    if (values.includes(current)) select.value = current;
  }

  function renderCheckGroup(container, prefix, values) {
    if (!container) return;
    container.innerHTML = '';
    values.forEach((value) => {
      const label = document.createElement('label');
      label.className = 'chip-check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `${prefix}-${slugify(value)}`;
      input.value = value;
      const span = document.createElement('span');
      span.textContent = value;
      label.append(input, span);
      container.appendChild(label);
    });
  }

  function connectSupabase() {
    const cfg = window.RECIPE_APP_CONFIG || {};
    if (window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey) {
      try {
        state.supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      } catch (error) {
        console.error('Supabase client init failed', error);
        state.supabase = null;
      }
    }
  }

  async function loadRecipes() {
    if (!state.supabase) {
      loadLocalRecipesSync();
      state.loadedFrom = 'local browser storage';
      return;
    }

    const { data, error } = await state.supabase.from(TABLE).select('*').order('updated_at', { ascending: false });
    if (error) {
      console.error('Supabase load failed', error);
      loadLocalRecipesSync();
      state.loadedFrom = 'local browser storage';
      state.supabase = null;
      return;
    }

    state.recipes = (data || []).map(normalizeRecipe);
    state.loadedFrom = 'Supabase';
    cacheLocalRecipes(state.recipes);
  }

  function loadLocalRecipesSync() {
    const merged = [];
    const seen = new Set();
    LEGACY_STORAGE_KEYS.forEach((key) => {
      const parsed = readRecipeArrayFromStorage(key);
      parsed.forEach((recipe) => {
        if (seen.has(recipe.id)) return;
        seen.add(recipe.id);
        merged.push(recipe);
      });
    });
    state.recipes = merged.map(normalizeRecipe);
  }

  function cacheLocalRecipes(recipes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  }

  function rememberLocalOnlyRecipe(recipe) {
    const existing = readRecipeArrayFromStorage(LOCAL_ONLY_KEY);
    const idx = existing.findIndex((item) => item.id === recipe.id);
    if (idx >= 0) existing[idx] = recipe;
    else existing.unshift(recipe);
    localStorage.setItem(LOCAL_ONLY_KEY, JSON.stringify(existing));
  }

  function readRecipeArrayFromStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeRecipe) : [];
    } catch {
      return [];
    }
  }

  function refreshPendingLocalRecipes() {
    const supabaseIds = new Set(state.recipes.map((recipe) => recipe.id));
    const pending = [];
    const seen = new Set();
    [LOCAL_ONLY_KEY, ...LEGACY_STORAGE_KEYS].forEach((key) => {
      readRecipeArrayFromStorage(key).forEach((recipe) => {
        if (supabaseIds.has(recipe.id)) return;
        if (seen.has(recipe.id)) return;
        seen.add(recipe.id);
        pending.push(recipe);
      });
    });
    state.pendingLocalRecipes = pending;
  }

  function updateSyncUi() {
    const usingSupabase = state.loadedFrom === 'Supabase' && !!state.supabase;
    if (usingSupabase) {
      setSyncBadge('Supabase connected', 'good');
    } else {
      setSyncBadge('Local only', 'warn');
    }
    if (els.migrateLocalBtn) {
      els.migrateLocalBtn.hidden = !(usingSupabase && state.pendingLocalRecipes.length);
      if (state.pendingLocalRecipes.length) {
        els.migrateLocalBtn.textContent = `Import ${state.pendingLocalRecipes.length} local recipe${state.pendingLocalRecipes.length === 1 ? '' : 's'} to Supabase`;
      }
    }
  }

  function setSyncBadge(text, tone) {
    if (!els.syncBadge) return;
    els.syncBadge.textContent = text;
    els.syncBadge.className = `sync-badge sync-${tone || 'neutral'}`;
  }

  async function migratePendingLocalRecipes() {
    if (!state.supabase) {
      setStatus('Supabase is not connected, so there is nowhere to migrate them.', 'error');
      return;
    }
    if (!state.pendingLocalRecipes.length) {
      setStatus('No pending local recipes were found to migrate.', 'neutral');
      updateSyncUi();
      return;
    }

    const total = state.pendingLocalRecipes.length;
    let migrated = 0;
    setStatus(`Migrating ${total} local recipe${total === 1 ? '' : 's'} to Supabase…`, 'neutral');

    for (const recipe of [...state.pendingLocalRecipes]) {
      try {
        const payload = toPayload(recipe);
        const { data, error } = await state.supabase.from(TABLE).upsert(payload).select().single();
        if (error) throw error;
        upsertRecipe(normalizeRecipe(data));
        migrated += 1;
      } catch (error) {
        console.error('Local migration failed for recipe', recipe.title, error);
        setStatus(`Stopped on “${recipe.title}” during migration. Check the console for the exact Supabase complaint.`, 'error');
        refreshPendingLocalRecipes();
        updateSyncUi();
        refreshAll();
        return;
      }
    }

    localStorage.removeItem(LOCAL_ONLY_KEY);
    refreshPendingLocalRecipes();
    updateSyncUi();
    refreshAll();
    setStatus(`Migrated ${migrated} local recipe${migrated === 1 ? '' : 's'} to Supabase.`, 'success');
  }

  function normalizeRecipe(recipe = {}) {
    const normalized = { ...recipe };
    normalized.id = normalized.id || crypto.randomUUID();
    normalized.title = str(normalized.title);
    normalized.recipe_type = str(normalized.recipe_type || normalized.category);
    normalized.cuisine = str(normalized.cuisine);
    normalized.collection = str(normalized.collection);
    normalized.source_type = str(normalized.source_type || 'manual');
    normalized.source_label = str(normalized.source_label);
    normalized.recipe_url = str(normalized.recipe_url);
    normalized.tags = Array.isArray(normalized.tags) ? normalized.tags.map(str).filter(Boolean) : csvToArray(normalized.tags);
    normalized.dietary = Array.isArray(normalized.dietary) ? normalized.dietary.map(str).filter(Boolean) : csvToArray(normalized.dietary);
    normalized.ingredients = str(normalized.ingredients);
    normalized.instructions = str(normalized.instructions);
    normalized.notes = str(normalized.notes);
    normalized.ocr_text = str(normalized.ocr_text);
    normalized.featured_image_url = str(normalized.featured_image_url || normalized.image_url);
    normalized.source_image_urls = Array.isArray(normalized.source_image_urls) ? normalized.source_image_urls.filter(Boolean) : [];
    normalized.rating = normalized.rating ? Number(normalized.rating) : null;
    normalized.is_favorite = !!normalized.is_favorite;
    normalized.prep_time = str(normalized.prep_time);
    normalized.cook_time = str(normalized.cook_time);
    normalized.recipe_yield = str(normalized.recipe_yield);
    normalized.created_at = normalized.created_at || new Date().toISOString();
    normalized.updated_at = normalized.updated_at || normalized.created_at;
    return normalized;
  }

  function refreshAll() {
    refreshCuisineFilter();
    buildIngredientIndex();
    buildTagIndex();
    renderHome();
    renderList();
    renderFormPreviews();
    renderTagChips();
  }

  function refreshCuisineFilter() {
    const cuisines = new Set(PRESET_CUISINES);
    state.recipes.forEach((recipe) => {
      if (recipe.cuisine) cuisines.add(recipe.cuisine);
    });
    fillSelect(els.cuisineFilter, [...cuisines].sort((a, b) => a.localeCompare(b)), 'All cuisines');
  }

  function buildTagIndex() {
    const tags = new Set();
    state.recipes.forEach((recipe) => recipe.tags.forEach((tag) => tags.add(tag)));
    state.tagTerms = [...tags].sort((a, b) => a.localeCompare(b));
  }

  function renderHome() {
    renderHomeStats();
    renderJumpButtons(els.homeTypeButtons, RECIPE_TYPES, (recipe, value) => recipe.recipe_type === value, applyTypeHomeFilter);
    renderJumpButtons(els.homeCuisineButtons, [...new Set([...PRESET_CUISINES, ...state.recipes.map((recipe) => recipe.cuisine).filter(Boolean)])].sort((a, b) => a.localeCompare(b)), (recipe, value) => recipe.cuisine === value, applyCuisineHomeFilter);
    renderJumpButtons(els.homeDietaryButtons, DIETARY_OPTIONS, (recipe, value) => recipe.dietary.includes(value), applyDietaryHomeFilter);
  }

  function renderHomeStats() {
    if (!els.homeStats) return;
    const withCuisine = state.recipes.filter((recipe) => recipe.cuisine).length;
    const withPhotos = state.recipes.filter((recipe) => recipe.featured_image_url || (recipe.source_image_urls || []).length).length;
    const favorites = state.recipes.filter((recipe) => recipe.is_favorite).length;
    const blocks = [
      ['Recipes', state.recipes.length],
      ['Favorites', favorites],
      ['With cuisine', withCuisine],
      ['With photos', withPhotos]
    ];
    els.homeStats.innerHTML = blocks.map(([label, value]) => `<article class="stat-card"><strong>${value}</strong><span>${label}</span></article>`).join('');
  }

  function renderJumpButtons(container, values, matcher, callback) {
    if (!container) return;
    container.innerHTML = '';
    values.forEach((value) => {
      const count = state.recipes.filter((recipe) => matcher(recipe, value)).length;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'jump-button';
      button.innerHTML = `${esc(value)}<small>${count}</small>`;
      button.addEventListener('click', () => callback(value));
      container.appendChild(button);
    });
  }

  function applyTypeHomeFilter(value) {
    clearFilters(false);
    state.filters.type = value;
    if (els.typeFilter) els.typeFilter.value = value;
    renderList();
    routeTo('browsePage');
  }

  function applyCuisineHomeFilter(value) {
    clearFilters(false);
    state.filters.cuisine = value;
    if (els.cuisineFilter) els.cuisineFilter.value = value;
    renderList();
    routeTo('browsePage');
  }

  function applyDietaryHomeFilter(value) {
    clearFilters(false);
    state.filters.dietary = [value];
    setCheckedValues(els.dietaryFilterOptions, [value]);
    renderList();
    routeTo('browsePage');
  }

  function handleHomeSearch() {
    state.filters.search = els.homeSearchInput?.value.trim() || '';
    if (els.searchInput) els.searchInput.value = state.filters.search;
    state.filters.favoritesOnly = false;
    state.filters.recentOnly = false;
    state.filters.duplicatesOnly = false;
    renderList();
    routeTo('browsePage');
  }

  function applyHomePreset(preset) {
    clearFilters(false);
    Object.assign(state.filters, preset);
    renderList();
    routeTo('browsePage');
  }

  function renderList() {
    const list = filterRecipes();
    toggleClass(els.favoritesOnlyBtn, 'is-on', state.filters.favoritesOnly);
    toggleClass(els.duplicatesBtn, 'is-on', state.filters.duplicatesOnly);
    toggleClass(els.recentBtn, 'is-on', state.filters.recentOnly);
    if (els.recipeCount) els.recipeCount.textContent = `${list.length} recipe${list.length === 1 ? '' : 's'}`;
    if (!els.recipeList) return;

    els.recipeList.innerHTML = '';
    if (!list.length) {
      els.recipeList.innerHTML = '<div class="empty-state"><p>No recipes match this filter set.</p></div>';
      renderDetail(null);
      return;
    }

    list.forEach((recipe) => {
      const node = els.recipeCardTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.recipeId = recipe.id;
      node.querySelector('.recipe-card-title').textContent = recipe.title || 'Untitled recipe';
      node.querySelector('.recipe-card-subline').textContent = [recipe.recipe_type, recipe.cuisine, recipe.collection].filter(Boolean).join(' • ');
      node.querySelector('.recipe-card-rating').textContent = recipe.rating ? `${recipe.rating}/5` : '';
      const img = node.querySelector('.recipe-card-image');
      if (recipe.featured_image_url) {
        img.src = recipe.featured_image_url;
        img.hidden = false;
      } else {
        img.hidden = true;
      }
      node.querySelector('.recipe-card-match').textContent = buildMatchText(recipe);
      node.querySelector('.recipe-card-tags').textContent = [...recipe.dietary, ...recipe.tags].slice(0, 6).join(' • ');
      node.addEventListener('click', () => selectRecipe(recipe.id));
      els.recipeList.appendChild(node);
    });

    const filteredSelected = list.find((recipe) => recipe.id === state.selectedId);
    if (!filteredSelected) state.selectedId = list[0].id;
    renderDetail(state.recipes.find((recipe) => recipe.id === state.selectedId) || list[0]);
  }

  function filterRecipes() {
    const duplicates = duplicateTitleSet();
    return state.recipes
      .filter((recipe) => {
        if (state.filters.search) {
          const haystack = [
            recipe.title,
            recipe.collection,
            recipe.cuisine,
            recipe.ingredients,
            recipe.instructions,
            recipe.notes,
            recipe.ocr_text,
            recipe.source_label,
            recipe.recipe_url,
            recipe.tags.join(' '),
            recipe.dietary.join(' ')
          ].join(' ').toLowerCase();
          if (!haystack.includes(state.filters.search.toLowerCase())) return false;
        }
        if (state.filters.type && recipe.recipe_type !== state.filters.type) return false;
        if (state.filters.cuisine && recipe.cuisine !== state.filters.cuisine) return false;
        if (state.filters.collection && !recipe.collection.toLowerCase().includes(state.filters.collection.toLowerCase())) return false;
        if (state.filters.tag && !recipe.tags.join(' ').toLowerCase().includes(state.filters.tag.toLowerCase())) return false;
        if (state.filters.minRating && (!recipe.rating || recipe.rating < Number(state.filters.minRating))) return false;
        if (state.filters.favoritesOnly && !recipe.is_favorite) return false;
        if (state.filters.duplicatesOnly && !duplicates.has(normalizeTitle(recipe.title))) return false;
        if (state.filters.recentOnly) {
          const daysOld = (Date.now() - new Date(recipe.updated_at).getTime()) / 86400000;
          if (daysOld > 14) return false;
        }
        if (state.filters.dietary.length && !state.filters.dietary.every((value) => recipe.dietary.includes(value))) return false;
        if (!passesIngredientFilter(recipe)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }

  function duplicateTitleSet() {
    const counts = new Map();
    state.recipes.forEach((recipe) => {
      const normalized = normalizeTitle(recipe.title);
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }

  function buildMatchText(recipe) {
    const includes = splitIngredientTerms(state.filters.includeIngredients, state.filters.ignoreStaples);
    if (!includes.length) return recipe.source_label || '';
    const recipeTerms = recipeIngredientTerms(recipe);
    const matches = includes.filter((term) => recipeTerms.includes(term));
    const missing = includes.filter((term) => !recipeTerms.includes(term));
    return `${matches.length}/${includes.length} matched${missing.length ? ` • missing: ${missing.slice(0, 3).join(', ')}` : ''}`;
  }

  function passesIngredientFilter(recipe) {
    const includeTerms = splitIngredientTerms(state.filters.includeIngredients, state.filters.ignoreStaples);
    const excludeTerms = splitIngredientTerms(state.filters.excludeIngredients, state.filters.ignoreStaples);
    const recipeTerms = recipeIngredientTerms(recipe);
    if (excludeTerms.some((term) => recipeTerms.includes(term))) return false;
    if (!includeTerms.length) return true;
    const matchCount = includeTerms.filter((term) => recipeTerms.includes(term)).length;
    if (state.filters.ingredientMode === 'all') return matchCount === includeTerms.length;
    if (state.filters.ingredientMode === 'most') return matchCount >= Math.max(1, includeTerms.length - 1);
    return matchCount > 0;
  }

  function recipeIngredientTerms(recipe) {
    const raw = recipe.ingredients || recipe.ocr_text || '';
    return [...new Set(raw.split(/\n|,/).map(normalizeIngredientPhrase).filter(Boolean))];
  }

  function renderDetail(recipe) {
    if (!els.recipeDetail) return;
    if (!recipe) {
      els.recipeDetail.className = 'recipe-detail empty-state';
      els.recipeDetail.innerHTML = '<p>Select a recipe.</p>';
      return;
    }

    els.recipeDetail.className = 'recipe-detail';
    const extras = (recipe.source_image_urls || []).filter(Boolean);
    els.recipeDetail.innerHTML = `
      <div class="detail-hero">
        ${recipe.featured_image_url ? `<img class="detail-image" src="${esc(recipe.featured_image_url)}" alt="${esc(recipe.title)}">` : ''}
        <div class="detail-meta">
          <h3>${esc(recipe.title || 'Untitled recipe')}</h3>
          <p class="muted">${esc([recipe.recipe_type, recipe.cuisine, recipe.collection].filter(Boolean).join(' • '))}</p>
          <p>${recipe.is_favorite ? '★ Favorite ' : ''}${recipe.rating ? `${recipe.rating}/5` : ''}</p>
          <p>${esc(recipe.recipe_yield || '')}</p>
          <p>${esc(recipe.prep_time ? `Prep: ${recipe.prep_time}` : '')}${recipe.cook_time ? `  Cook: ${recipe.cook_time}` : ''}</p>
          <p>${esc(recipe.source_label || '')}</p>
          ${recipe.recipe_url ? `<p><a href="${esc(recipe.recipe_url)}" target="_blank" rel="noopener">Open source link</a></p>` : ''}
        </div>
      </div>
      ${recipe.dietary.length ? `<p><strong>Dietary:</strong> ${esc(recipe.dietary.join(', '))}</p>` : ''}
      ${recipe.tags.length ? `<p><strong>Tags:</strong> ${esc(recipe.tags.join(', '))}</p>` : ''}
      <div class="two-col stackable">
        <section><h4>Ingredients</h4><pre>${esc(recipe.ingredients)}</pre></section>
        <section><h4>Instructions</h4><pre>${esc(recipe.instructions)}</pre></section>
      </div>
      ${recipe.notes ? `<section><h4>Notes</h4><pre>${esc(recipe.notes)}</pre></section>` : ''}
      ${recipe.ocr_text ? `<details><summary>OCR / Imported Text</summary><pre>${esc(recipe.ocr_text)}</pre></details>` : ''}
      ${extras.length ? `<section><h4>Extra Images</h4><div class="source-gallery">${extras.map((url) => `<div class="source-image-card"><img src="${esc(url)}" alt=""></div>`).join('')}</div></section>` : ''}
    `;
  }

  function selectRecipe(id) {
    state.selectedId = id;
    const recipe = state.recipes.find((item) => item.id === id) || null;
    renderDetail(recipe);
  }

  function clearForm() {
    ['title', 'cuisine', 'collection', 'sourceLabel', 'recipeUrl', 'prepTime', 'cookTime', 'recipeYield', 'ocrText', 'ingredients', 'instructions', 'notes'].forEach((id) => {
      if (els[id]) els[id].value = '';
    });
    if (els.recipeType) els.recipeType.value = '';
    if (els.recipeUrl) els.recipeUrl.value = '';
    if (els.urlImportInput) els.urlImportInput.value = '';
    if (els.sourceType) els.sourceType.value = 'manual';
    if (els.rating) els.rating.value = '';
    if (els.isFavorite) els.isFavorite.checked = false;
    setCheckedValues(els.dietaryOptions, []);
    state.selectedId = null;
    state.formTags = [];
    state.draft = { featuredFile: null, sourceFiles: [], featuredExisting: '', sourceExisting: [] };
    if (els.featuredImageFile) els.featuredImageFile.value = '';
    if (els.sourceImageFiles) els.sourceImageFiles.value = '';
    renderTagChips();
    renderFormPreviews();
  }

  function populateForm(recipe) {
    if (!recipe) return;
    if (els.title) els.title.value = recipe.title || '';
    if (els.recipeType) els.recipeType.value = recipe.recipe_type || '';
    if (els.cuisine) els.cuisine.value = recipe.cuisine || '';
    if (els.collection) els.collection.value = recipe.collection || '';
    if (els.sourceType) els.sourceType.value = recipe.source_type || 'manual';
    if (els.sourceLabel) els.sourceLabel.value = recipe.source_label || '';
    if (els.recipeUrl) els.recipeUrl.value = recipe.recipe_url || '';
    if (els.rating) els.rating.value = recipe.rating || '';
    if (els.isFavorite) els.isFavorite.checked = !!recipe.is_favorite;
    if (els.prepTime) els.prepTime.value = recipe.prep_time || '';
    if (els.cookTime) els.cookTime.value = recipe.cook_time || '';
    if (els.recipeYield) els.recipeYield.value = recipe.recipe_yield || '';
    if (els.ocrText) els.ocrText.value = recipe.ocr_text || '';
    if (els.ingredients) els.ingredients.value = recipe.ingredients || '';
    if (els.instructions) els.instructions.value = recipe.instructions || '';
    if (els.notes) els.notes.value = recipe.notes || '';
    setCheckedValues(els.dietaryOptions, recipe.dietary || []);
    state.formTags = [...(recipe.tags || [])];
    state.selectedId = recipe.id;
    state.draft = {
      featuredFile: null,
      sourceFiles: [],
      featuredExisting: recipe.featured_image_url || '',
      sourceExisting: [...(recipe.source_image_urls || [])]
    };
    renderTagChips();
    renderFormPreviews();
  }

  function renderFormPreviews() {
    if (els.featuredImagePreview) {
      const url = state.draft.featuredFile ? URL.createObjectURL(state.draft.featuredFile) : state.draft.featuredExisting;
      if (url) {
        els.featuredImagePreview.src = url;
        els.featuredImagePreview.hidden = false;
        if (els.featuredImageEmpty) els.featuredImageEmpty.hidden = true;
      } else {
        els.featuredImagePreview.hidden = true;
        els.featuredImagePreview.removeAttribute('src');
        if (els.featuredImageEmpty) els.featuredImageEmpty.hidden = false;
      }
    }
    if (els.sourceImageGallery) {
      const existing = state.draft.sourceExisting.map((url, index) => ({ type: 'existing', url, index }));
      const files = state.draft.sourceFiles.map((file, index) => ({ type: 'file', url: URL.createObjectURL(file), index, name: file.name }));
      const items = [...existing, ...files];
      els.sourceImageGallery.innerHTML = items.length
        ? items.map((item) => `<div class="source-image-card"><img src="${esc(item.url)}" alt="${esc(item.name || 'recipe source page')}"></div>`).join('')
        : '<div class="muted">No source pages selected yet.</div>';
    }
  }

  async function ensureTesseract() {
    if (window.Tesseract) return window.Tesseract;
    setStatus('Loading OCR engine…', 'neutral');
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load the OCR engine.'));
      document.head.appendChild(script);
    });
    if (!window.Tesseract) throw new Error('OCR engine loaded badly and is still unavailable.');
    return window.Tesseract;
  }

  async function runOcrOnSourcePages() {
    const files = state.draft.sourceFiles.length ? state.draft.sourceFiles : (state.draft.featuredFile ? [state.draft.featuredFile] : []);
    if (!files.length) {
      setStatus('Choose one or more source photos first. The photo picker is opening now.', 'error');
      els.sourceImageFiles?.click();
      return;
    }

    const originalText = els.runOcrBtn ? els.runOcrBtn.textContent : 'Run OCR';
    setBusy(els.runOcrBtn, true, 'Running OCR…');

    try {
      const Tesseract = await ensureTesseract();
      const chunks = [];
      routeTo('editPage');
      for (let index = 0; index < files.length; index += 1) {
        const pageNumber = index + 1;
        setStatus(`Running OCR on page ${pageNumber} of ${files.length}…`, 'neutral');
        const result = await Tesseract.recognize(files[index], 'eng', {
          logger(message) {
            if (message.status === 'recognizing text' && typeof message.progress === 'number') {
              const pct = Math.round(message.progress * 100);
              setStatus(`Running OCR on page ${pageNumber} of ${files.length}… ${pct}%`, 'neutral');
            }
          }
        });
        chunks.push(`--- Page ${pageNumber} ---\n${(result.data?.text || '').trim()}`);
      }

      if (els.ocrText) {
        els.ocrText.value = chunks.join('\n\n');
        els.ocrText.focus();
      }
      applyParsedRecipe(roughParseText(els.ocrText?.value || ''), 'ocr');
      setStatus('OCR finished. Review the extracted text, then save the recipe.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(`OCR failed: ${error?.message || 'unknown error'}`, 'error');
    } finally {
      setBusy(els.runOcrBtn, false, originalText);
    }
  }

  function openUrlImportDialog() {
    if (!els.urlImportDialog) {
      setStatus('URL import dialog is unavailable in this build.', 'error');
      return;
    }
    if (els.urlImportInput) els.urlImportInput.value = els.recipeUrl?.value || '';
    els.urlImportDialog.showModal();
    window.setTimeout(() => els.urlImportInput?.focus(), 20);
  }

  async function importFromUrl() {
    const url = (els.urlImportInput?.value || els.recipeUrl?.value || '').trim();
    if (!url) {
      setStatus('Paste a recipe URL into the popup first.', 'error');
      els.urlImportInput?.focus();
      return;
    }
    if (els.recipeUrl) els.recipeUrl.value = url;

    const originalText = els.importFromUrlBtn ? els.importFromUrlBtn.textContent : 'Import from URL';
    setBusy(els.importFromUrlBtn, true, 'Importing…');
    setStatus('Trying URL import…', 'neutral');

    try {
      if (els.urlImportDialog?.open) els.urlImportDialog.close();
      const fetched = await fetchRecipeHtml(url);
      const parsed = parseRecipePayload(fetched.text, url, fetched.mode);
      if (!parsed.title && !parsed.ingredients && !parsed.instructions && !parsed.ocrText) {
        throw new Error('The page came back, but it did not expose recipe text I could use.');
      }
      applyParsedRecipe(parsed, 'url');
      if (els.sourceType && !els.sourceType.value) els.sourceType.value = 'link';
      if (els.sourceType) els.sourceType.value = 'link';
      if (els.sourceLabel && !els.sourceLabel.value) {
        try {
          els.sourceLabel.value = new URL(url).hostname.replace(/^www\./, '');
        } catch {}
      }
      setStatus(`URL import finished using ${fetched.mode}. Review the fields, then save the recipe.`, 'success');
    } catch (error) {
      console.error(error);
      setStatus(`URL import failed: ${error?.message || 'blocked by site or browser'}`, 'error');
    } finally {
      setBusy(els.importFromUrlBtn, false, originalText);
    }
  }

  async function fetchRecipeHtml(url) {
    const attempts = [
      {
        mode: 'direct fetch',
        run: async () => {
          const resp = await fetch(url, { mode: 'cors' });
          if (!resp.ok) throw new Error(`direct fetch failed: ${resp.status}`);
          return resp.text();
        }
      },
      {
        mode: 'AllOrigins proxy',
        run: async () => {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const resp = await fetch(proxyUrl);
          if (!resp.ok) throw new Error(`AllOrigins failed: ${resp.status}`);
          return resp.text();
        }
      },
      {
        mode: 'Jina text mirror',
        run: async () => {
          const mirrorUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`;
          const resp = await fetch(mirrorUrl);
          if (!resp.ok) throw new Error(`Jina failed: ${resp.status}`);
          return resp.text();
        }
      }
    ];

    let lastError = null;
    for (const attempt of attempts) {
      try {
        setStatus(`Trying ${attempt.mode}…`, 'neutral');
        const text = await attempt.run();
        if (!text || !String(text).trim()) throw new Error(`${attempt.mode} returned empty text`);
        return { text, mode: attempt.mode };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Every URL import method failed.');
  }

  function parseRecipePayload(text, sourceUrl, mode) {
    const trimmed = String(text || '').trim();
    const looksHtml = /<html|<body|<script|<div/i.test(trimmed);
    if (looksHtml) return parseRecipeHtml(trimmed, sourceUrl, mode);
    const parsed = roughParseText(trimmed);
    parsed.ocrText = trimmed;
    return parsed;
  }

  function parseRecipeHtml(html, sourceUrl, mode) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const output = { title: '', ingredients: '', instructions: '', recipeYield: '', cuisine: '', tags: [], ocrText: '' };
    const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];
    for (const script of scripts) {
      const candidates = parseLdJsonCandidates(script.textContent || '');
      const recipeNode = candidates.find((item) => String(item?.['@type'] || '').toLowerCase().includes('recipe'));
      if (!recipeNode) continue;
      output.title = str(recipeNode.name);
      output.ingredients = Array.isArray(recipeNode.recipeIngredient) ? recipeNode.recipeIngredient.join('\n') : str(recipeNode.recipeIngredient);
      output.instructions = extractInstructions(recipeNode.recipeInstructions);
      output.recipeYield = Array.isArray(recipeNode.recipeYield) ? recipeNode.recipeYield.join(', ') : str(recipeNode.recipeYield);
      output.cuisine = str(recipeNode.recipeCuisine);
      output.ocrText = [output.title, output.ingredients, output.instructions].filter(Boolean).join('\n\n');
      output.tags = inferTagsFromText(output.ocrText);
      return output;
    }

    const title = str(doc.querySelector('h1')?.textContent || doc.title || sourceUrl);
    const bodyText = [...doc.querySelectorAll('h1,h2,h3,p,li')].slice(0, 140).map((node) => node.textContent.trim()).filter(Boolean).join('\n');
    const fallback = roughParseText(bodyText);
    fallback.title = fallback.title || title;
    fallback.ocrText = bodyText;
    if (!fallback.tags.length) fallback.tags = inferTagsFromText(bodyText);
    if (!fallback.title && mode) fallback.title = title;
    return fallback;
  }

  function parseLdJsonCandidates(text) {
    try {
      const raw = JSON.parse(text);
      const list = Array.isArray(raw) ? raw : [raw];
      return list.flatMap((item) => Array.isArray(item?.['@graph']) ? item['@graph'] : [item]);
    } catch {
      return [];
    }
  }

  function extractInstructions(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object') return item.text || item.name || '';
        return '';
      }).filter(Boolean).join('\n');
    }
    if (typeof value === 'object') return value.text || value.name || '';
    return '';
  }

  function applyParsedRecipe(parsed, sourceKind) {
    if (!parsed) return;
    if (parsed.title && !els.title.value) els.title.value = parsed.title;
    if (parsed.ingredients && !els.ingredients.value) els.ingredients.value = parsed.ingredients;
    if (parsed.instructions && !els.instructions.value) els.instructions.value = parsed.instructions;
    if (parsed.recipeYield && !els.recipeYield.value) els.recipeYield.value = parsed.recipeYield;
    if (parsed.cuisine && !els.cuisine.value) els.cuisine.value = parsed.cuisine;
    if (parsed.ocrText) els.ocrText.value = parsed.ocrText;
    if (sourceKind === 'url' && els.sourceType) els.sourceType.value = 'link';
    mergeTags(parsed.tags || []);
  }

  function roughParseText(text) {
    const clean = String(text || '').trim();
    const lines = clean.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const lower = clean.toLowerCase();
    const title = lines[0] || '';
    let ingredients = '';
    let instructions = '';

    const ingredientsIdx = lower.indexOf('ingredients');
    const instructionsIdx = Math.max(lower.indexOf('instructions'), lower.indexOf('directions'), lower.indexOf('method'));

    if (ingredientsIdx >= 0 && instructionsIdx > ingredientsIdx) {
      ingredients = clean.slice(ingredientsIdx, instructionsIdx).replace(/^ingredients[:\s]*/i, '').trim();
      instructions = clean.slice(instructionsIdx).replace(/^(instructions|directions|method)[:\s]*/i, '').trim();
    } else {
      const lineIndex = lines.findIndex((line) => /ingredients/i.test(line));
      const dirIndex = lines.findIndex((line) => /instructions|directions|method/i.test(line));
      if (lineIndex >= 0 && dirIndex > lineIndex) {
        ingredients = lines.slice(lineIndex + 1, dirIndex).join('\n');
        instructions = lines.slice(dirIndex + 1).join('\n');
      } else {
        const midpoint = Math.ceil(lines.length / 2);
        ingredients = lines.slice(1, midpoint).join('\n');
        instructions = lines.slice(midpoint).join('\n');
      }
    }

    return {
      title,
      ingredients,
      instructions,
      recipeYield: '',
      cuisine: '',
      tags: inferTagsFromText(clean),
      ocrText: clean
    };
  }

  function inferTagsFromText(text) {
    const tags = [];
    const lower = String(text || '').toLowerCase();
    if (/gluten\s*free/.test(lower)) tags.push('Gluten Free');
    if (/vegan/.test(lower)) tags.push('Vegan');
    if (/vegetarian/.test(lower)) tags.push('Vegetarian');
    if (/mushroom/.test(lower)) tags.push('mushroom');
    if (/soup/.test(lower)) tags.push('soup');
    if (/sauce/.test(lower)) tags.push('sauce');
    if (/fish|salmon|trout|cod/.test(lower)) tags.push('fish');
    return [...new Set(tags)];
  }

  async function saveRecipe() {
    const recipe = recipeFromForm();
    if (!recipe.title) {
      setStatus('Title is required.', 'error');
      return;
    }

    setStatus('Saving recipe…', 'neutral');
    setBusy(els.saveRecipeBtn, true, 'Saving…');

    try {
      if (state.supabase) {
        const uploads = await uploadImages(recipe.id);
        recipe.featured_image_url = uploads.featured || state.draft.featuredExisting || '';
        recipe.source_image_urls = [...state.draft.sourceExisting, ...uploads.sources];
        const { data, error } = await state.supabase.from(TABLE).upsert(toPayload(recipe)).select().single();
        if (error) throw error;
        upsertRecipe(normalizeRecipe(data));
        state.loadedFrom = 'Supabase';
      } else {
        const embeds = await localEmbedImages();
        recipe.featured_image_url = embeds.featured || state.draft.featuredExisting || '';
        recipe.source_image_urls = [...state.draft.sourceExisting, ...embeds.sources];
        upsertRecipe(recipe);
        rememberLocalOnlyRecipe(recipe);
        state.loadedFrom = 'local browser storage';
      }

      cacheLocalRecipes(state.recipes);
      refreshPendingLocalRecipes();
      refreshAll();
      updateSyncUi();
      state.selectedId = recipe.id;
      renderDetail(state.recipes.find((item) => item.id === recipe.id));
      routeTo('browsePage');
      setStatus(`Recipe saved to ${state.loadedFrom}.`, 'success');
    } catch (error) {
      console.error(error);
      setStatus(`Save failed: ${error?.message || 'check the console for details'}`, 'error');
    } finally {
      setBusy(els.saveRecipeBtn, false, 'Save Recipe');
    }
  }

  function recipeFromForm() {
    const existing = state.recipes.find((recipe) => recipe.id === state.selectedId);
    const id = existing?.id || crypto.randomUUID();
    return normalizeRecipe({
      ...existing,
      id,
      title: els.title?.value.trim(),
      recipe_type: els.recipeType?.value || '',
      cuisine: els.cuisine?.value.trim(),
      collection: els.collection?.value.trim(),
      source_type: els.sourceType?.value || 'manual',
      source_label: els.sourceLabel?.value.trim(),
      recipe_url: els.recipeUrl?.value.trim(),
      tags: [...state.formTags],
      dietary: getCheckedValues(els.dietaryOptions),
      rating: els.rating?.value ? Number(els.rating.value) : null,
      is_favorite: !!els.isFavorite?.checked,
      prep_time: els.prepTime?.value.trim(),
      cook_time: els.cookTime?.value.trim(),
      recipe_yield: els.recipeYield?.value.trim(),
      ocr_text: els.ocrText?.value || '',
      ingredients: els.ingredients?.value || '',
      instructions: els.instructions?.value || '',
      notes: els.notes?.value || '',
      updated_at: new Date().toISOString(),
      created_at: existing?.created_at || new Date().toISOString()
    });
  }

  async function uploadImages(recipeId) {
    const uploaded = { featured: '', sources: [] };
    const bucket = (window.RECIPE_APP_CONFIG || {}).storageBucket || BUCKET;
    if (state.draft.featuredFile) {
      uploaded.featured = await uploadFile(state.draft.featuredFile, recipeId, bucket, 'featured');
    }
    for (const file of state.draft.sourceFiles) {
      uploaded.sources.push(await uploadFile(file, recipeId, bucket, 'source'));
    }
    return uploaded;
  }

  async function uploadFile(file, recipeId, bucket, kind) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${recipeId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await state.supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = state.supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || '';
  }

  async function localEmbedImages() {
    const embedded = { featured: '', sources: [] };
    if (state.draft.featuredFile) embedded.featured = await fileToDataURL(state.draft.featuredFile);
    for (const file of state.draft.sourceFiles) embedded.sources.push(await fileToDataURL(file));
    return embedded;
  }

  function toPayload(recipe) {
    return {
      id: recipe.id,
      title: recipe.title,
      recipe_type: recipe.recipe_type,
      category: recipe.recipe_type,
      cuisine: recipe.cuisine,
      collection: recipe.collection,
      source_type: recipe.source_type,
      source_label: recipe.source_label,
      recipe_url: recipe.recipe_url,
      tags: recipe.tags,
      dietary: recipe.dietary,
      rating: recipe.rating,
      is_favorite: recipe.is_favorite,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      recipe_yield: recipe.recipe_yield,
      ocr_text: recipe.ocr_text,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      notes: recipe.notes,
      featured_image_url: recipe.featured_image_url,
      source_image_urls: recipe.source_image_urls,
      updated_at: recipe.updated_at,
      created_at: recipe.created_at
    };
  }

  function upsertRecipe(recipe) {
    const index = state.recipes.findIndex((item) => item.id === recipe.id);
    if (index >= 0) state.recipes[index] = recipe;
    else state.recipes.unshift(recipe);
  }

  function editSelectedRecipe() {
    const recipe = state.recipes.find((item) => item.id === state.selectedId);
    if (!recipe) {
      setStatus('Pick a recipe first.', 'error');
      return;
    }
    populateForm(recipe);
    routeTo('editPage');
    setStatus(`Editing “${recipe.title}”.`, 'neutral');
  }

  async function deleteSelectedRecipe() {
    const recipe = state.recipes.find((item) => item.id === state.selectedId);
    if (!recipe) return;
    if (!window.confirm(`Delete “${recipe.title}”?`)) return;

    try {
      if (state.supabase) {
        const { error } = await state.supabase.from(TABLE).delete().eq('id', recipe.id);
        if (error) throw error;
      }
      state.recipes = state.recipes.filter((item) => item.id !== recipe.id);
      cacheLocalRecipes(state.recipes);
      refreshPendingLocalRecipes();
      refreshAll();
      updateSyncUi();
      state.selectedId = null;
      renderDetail(null);
      setStatus('Recipe deleted.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(`Delete failed: ${error?.message || 'check the console'}`, 'error');
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state.recipes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `recipe-repository-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('JSON import expects an array of recipes.');
      parsed.map(normalizeRecipe).forEach(upsertRecipe);
      cacheLocalRecipes(state.recipes);
      refreshPendingLocalRecipes();
      refreshAll();
      updateSyncUi();
      setStatus('JSON import complete. Review and migrate to Supabase if needed.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(`JSON import failed: ${error?.message || 'invalid file'}`, 'error');
    } finally {
      if (event.target) event.target.value = '';
    }
  }

  function printSelected(mode) {
    const recipe = state.recipes.find((item) => item.id === state.selectedId);
    if (!recipe) return;
    const popup = window.open('', '_blank');
    if (!popup) return;
    const compact = mode === 'card';
    popup.document.write(`<!doctype html><html><head><title>${esc(recipe.title)}</title><style>body{font-family:Arial,sans-serif;padding:${compact ? '12px' : '24px'};max-width:${compact ? '4in' : '8.5in'};margin:auto}pre{white-space:pre-wrap;font-family:inherit}img{max-width:100%;height:auto;border-radius:8px}.cols{display:grid;grid-template-columns:${compact ? '1fr' : '1fr 1fr'};gap:16px}@media print{@page{size:${compact ? '4in 6in' : 'auto'};margin:.4in}}</style></head><body><h1>${esc(recipe.title)}</h1>${recipe.featured_image_url ? `<img src="${esc(recipe.featured_image_url)}" alt="">` : ''}<p>${esc([recipe.recipe_type, recipe.cuisine, recipe.collection].filter(Boolean).join(' • '))}</p><div class="cols"><section><h2>Ingredients</h2><pre>${esc(recipe.ingredients)}</pre></section><section><h2>Instructions</h2><pre>${esc(recipe.instructions)}</pre></section></div>${recipe.notes ? `<section><h2>Notes</h2><pre>${esc(recipe.notes)}</pre></section>` : ''}</body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  function routeFromHash() {
    routeTo((window.location.hash || '#homePage').slice(1) || 'homePage', true);
  }

  function routeTo(pageId, fromHash = false) {
    const safePage = ['homePage', 'browsePage', 'editPage'].includes(pageId) ? pageId : 'homePage';
    state.currentPage = safePage;
    els.appPages.forEach((page) => page.classList.toggle('is-active', page.id === safePage));
    els.pageTabs.forEach((tab) => tab.classList.toggle('is-active', (tab.dataset.page || '') === safePage));
    if (!fromHash && window.location.hash !== `#${safePage}`) window.location.hash = safePage;
    window.scrollTo(0, 0);
  }

  function clearFilters(renderAfter = true) {
    state.filters = {
      search: '',
      type: '',
      cuisine: '',
      collection: '',
      tag: '',
      minRating: '',
      dietary: [],
      includeIngredients: '',
      excludeIngredients: '',
      ingredientMode: 'all',
      ignoreStaples: true,
      favoritesOnly: false,
      duplicatesOnly: false,
      recentOnly: false
    };
    if (els.searchInput) els.searchInput.value = '';
    if (els.typeFilter) els.typeFilter.value = '';
    if (els.cuisineFilter) els.cuisineFilter.value = '';
    if (els.collectionFilter) els.collectionFilter.value = '';
    if (els.tagFilter) els.tagFilter.value = '';
    if (els.ratingFilter) els.ratingFilter.value = '';
    if (els.includeIngredients) els.includeIngredients.value = '';
    if (els.excludeIngredients) els.excludeIngredients.value = '';
    if (els.ingredientMode) els.ingredientMode.value = 'all';
    if (els.ignoreStaples) els.ignoreStaples.checked = true;
    setCheckedValues(els.dietaryFilterOptions, []);
    hideIngredientSuggestions('include');
    hideIngredientSuggestions('exclude');
    if (renderAfter) renderList();
  }

  function buildIngredientIndex() {
    const terms = new Set();
    state.recipes.forEach((recipe) => recipeIngredientTerms(recipe).forEach((term) => terms.add(term)));
    state.ingredientTerms = [...terms].sort((a, b) => a.localeCompare(b));
  }

  function bindIngredientSuggestionBox(kind) {
    const box = kind === 'include' ? els.includeIngredientSuggestions : els.excludeIngredientSuggestions;
    if (!box) return;
    bind(box, 'click', (event) => {
      const button = event.target.closest('button[data-suggestion]');
      if (!button) return;
      const input = kind === 'include' ? els.includeIngredients : els.excludeIngredients;
      input.value = applySuggestion(input.value, button.dataset.suggestion);
      state.filters[kind === 'include' ? 'includeIngredients' : 'excludeIngredients'] = input.value;
      hideIngredientSuggestions(kind);
      renderList();
      input.focus();
    });
  }

  function renderIngredientSuggestions(kind) {
    const input = kind === 'include' ? els.includeIngredients : els.excludeIngredients;
    const box = kind === 'include' ? els.includeIngredientSuggestions : els.excludeIngredientSuggestions;
    if (!input || !box) return;
    const term = input.value.split(',').pop().trim().toLowerCase();
    if (term.length < 2) {
      hideIngredientSuggestions(kind);
      return;
    }
    const matches = state.ingredientTerms.filter((candidate) => candidate.includes(term)).slice(0, 8);
    if (!matches.length) {
      hideIngredientSuggestions(kind);
      return;
    }
    box.innerHTML = matches.map((candidate) => `<button type="button" data-suggestion="${esc(candidate)}">${esc(candidate)}</button>`).join('');
    box.hidden = false;
  }

  function hideIngredientSuggestions(kind) {
    const box = kind === 'include' ? els.includeIngredientSuggestions : els.excludeIngredientSuggestions;
    if (!box) return;
    box.hidden = true;
    box.innerHTML = '';
  }

  function applySuggestion(current, suggestion) {
    const parts = current.split(',');
    parts[parts.length - 1] = ` ${suggestion}`;
    return parts.join(',').replace(/^\s+/, '').replace(/,\s+/g, ', ').replace(/\s{2,}/g, ' ').trim();
  }

  function renderTagChips() {
    if (els.tags) els.tags.value = state.formTags.join(', ');
    if (!els.tagChipList) return;
    els.tagChipList.innerHTML = state.formTags.length
      ? state.formTags.map((tag) => `<span class="tag-chip">${esc(tag)}<button type="button" data-remove-tag="${esc(tag)}" aria-label="Remove ${esc(tag)}">×</button></span>`).join('')
      : '<span class="muted">No tags yet.</span>';
  }

  function renderTagSuggestions() {
    if (!els.tagEntry || !els.tagSuggestions) return;
    const term = els.tagEntry.value.trim().toLowerCase();
    if (!term) {
      hideTagSuggestions();
      return;
    }
    const existing = state.tagTerms.filter((tag) => tag.toLowerCase().includes(term) && !state.formTags.includes(tag)).slice(0, 8);
    const exact = existing.some((tag) => tag.toLowerCase() === term) || state.formTags.some((tag) => tag.toLowerCase() === term);
    const items = [];
    existing.forEach((tag) => items.push(`<button type="button" data-tag-value="${esc(tag)}">${esc(tag)}</button>`));
    if (!exact) items.push(`<button type="button" class="suggestion-create" data-tag-value="${esc(els.tagEntry.value.trim())}">Add “${esc(els.tagEntry.value.trim())}”</button>`);
    if (!items.length) {
      hideTagSuggestions();
      return;
    }
    els.tagSuggestions.innerHTML = items.join('');
    els.tagSuggestions.hidden = false;
  }

  function hideTagSuggestions() {
    if (!els.tagSuggestions) return;
    els.tagSuggestions.hidden = true;
    els.tagSuggestions.innerHTML = '';
  }

  function handleTagEntryKeydown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const value = els.tagEntry.value.trim();
      if (value) addFormTag(value);
      return;
    }
    if (event.key === 'Backspace' && !els.tagEntry.value && state.formTags.length) {
      state.formTags.pop();
      renderTagChips();
    }
  }

  function handleTagSuggestionClick(event) {
    const button = event.target.closest('button[data-tag-value]');
    if (!button) return;
    addFormTag(button.dataset.tagValue || '');
  }

  function handleTagChipClick(event) {
    const button = event.target.closest('button[data-remove-tag]');
    if (!button) return;
    removeFormTag(button.dataset.removeTag || '');
  }

  function addFormTag(tag) {
    const clean = str(tag);
    if (!clean) return;
    if (!state.formTags.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      state.formTags.push(clean);
      state.formTags.sort((a, b) => a.localeCompare(b));
    }
    if (els.tagEntry) els.tagEntry.value = '';
    hideTagSuggestions();
    renderTagChips();
  }

  function removeFormTag(tag) {
    state.formTags = state.formTags.filter((item) => item !== tag);
    renderTagChips();
  }

  function mergeTags(tags) {
    (tags || []).forEach((tag) => {
      if (DIETARY_OPTIONS.includes(tag)) {
        const existing = new Set(getCheckedValues(els.dietaryOptions));
        existing.add(tag);
        setCheckedValues(els.dietaryOptions, [...existing]);
      } else {
        addFormTag(tag);
      }
    });
  }

  function csvToArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(str).filter(Boolean);
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  }

  function getCheckedValues(container) {
    if (!container) return [];
    return [...container.querySelectorAll('input:checked')].map((input) => input.value);
  }

  function setCheckedValues(container, values) {
    if (!container) return;
    const target = new Set(values || []);
    container.querySelectorAll('input').forEach((input) => {
      input.checked = target.has(input.value);
    });
  }

  function setBusy(button, isBusy, label) {
    if (!button) return;
    button.disabled = !!isBusy;
    if (label) button.textContent = label;
  }

  function setStatus(message, tone = 'neutral') {
    if (!els.statusText) return;
    els.statusText.textContent = message;
    els.statusText.dataset.tone = tone;
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function normalizeTitle(value) {
    return slugify(value).replace(/-/g, ' ');
  }

  function slugify(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function str(value) {
    return String(value || '').trim();
  }

  function toggleClass(el, className, on) {
    if (el) el.classList.toggle(className, !!on);
  }

  function getAliasMap() {
    if (aliasMap) return aliasMap;
    aliasMap = new Map();
    Object.entries(INGREDIENT_CANONICALS).forEach(([canonical, aliases]) => {
      aliasMap.set(basicNormalize(canonical), canonical);
      aliases.forEach((alias) => aliasMap.set(basicNormalize(alias), canonical));
    });
    return aliasMap;
  }

  function basicNormalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\b(fresh|dried|large|small|medium|extra|virgin|optional|divided|chopped|diced|minced|sliced|shredded|grated|crushed|ground|to taste)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeIngredientPhrase(value) {
    const normalized = basicNormalize(value).replace(/\b(onions|peppers|tomatoes|mushrooms|carrots|beans|cloves)\b/g, (match) => match.slice(0, -1));
    return getAliasMap().get(normalized) || normalized;
  }

  function splitIngredientTerms(value, ignoreStaples) {
    return String(value || '')
      .split(',')
      .map(normalizeIngredientPhrase)
      .filter(Boolean)
      .filter((term) => !ignoreStaples || !PANTRY_STAPLES.has(term));
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.__recipeActions = {
    newRecipeBtn: () => {
      clearForm();
      routeTo('editPage');
      setStatus('New recipe form ready.', 'neutral');
    },
    runOcrBtn: () => runOcrOnSourcePages(),
    importFromUrlBtn: () => openUrlImportDialog(),
    saveRecipeBtn: () => saveRecipe()
  };
})();
