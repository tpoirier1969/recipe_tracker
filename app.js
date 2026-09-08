(() => {
  'use strict';

  const APP_VERSION = window.RECIPE_APP_VERSION || 'development';
  const TABLE = 'recipe_tracker_recipes';
  const BUCKET = 'recipe_tracker_assets';
  const STORAGE_KEY = 'recipeRepositoryCache';
  const LEGACY_STORAGE_KEYS = ['recipeRepositoryData_v096', 'recipeRepositoryData_v094', 'recipeRepositoryData_v092', 'recipeRepositoryData_v091', 'recipeRepositoryData_v090', 'recipeRepositoryData_v080'];
  const LOCAL_ONLY_KEY = 'recipeRepositoryLocalOnly_v096';
  const BROWSE_PAGE_SIZE = 24;

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
    loadedFrom: 'not loaded',
    supabase: null,
    ingredientTerms: [],
    tagTerms: [],
    pendingLocalRecipes: [],
    draft: emptyImageDraft(),
    formTags: [],
    sort: 'updated_desc',
    visibleRecipeCount: BROWSE_PAGE_SIZE,
    mobileBrowseView: 'list',
    entryMode: 'choose',
    reviewOrigin: '',
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

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
      loadCachedRecipesSync();
      refreshAll();
      setSyncBadge('Supabase unavailable', 'bad');
      setStatus('Startup hit a problem. Cached recipes are read-only until Supabase reconnects.', 'error');
    });
  }

  function cacheEls() {
    [
      'syncBadge', 'statusText', 'migrateLocalBtn',
      'homeSearchInput', 'homeSearchBtn', 'newRecipeBtn', 'homeFavoritesBtn', 'homeRecentBtn', 'quickOpenBrowseBtn', 'chooseSourcePhotosBtn',
      'recipeEditorHeading', 'recipeEditorIntro', 'restartEntryBtn', 'entryMethodChooser', 'entryWebsiteBtn', 'entryPhotoBtn', 'entryManualBtn', 'recipeEditor',
      'entryReviewBanner', 'entryReviewHeading', 'entryReviewCopy', 'reviewTitleStatus', 'reviewIngredientsStatus', 'reviewInstructionsStatus', 'mediaFormSection', 'ocrAdvancedTools',
      'urlImportDialog', 'urlImportInput', 'confirmUrlImportBtn', 'cancelUrlImportBtn',
      'homeStats', 'homeTypeButtons', 'homeCuisineButtons', 'homeDietaryButtons',
      'browsePage', 'listPanel', 'detailPanel', 'backToBrowseBtn',
      'searchInput', 'sortSelect', 'typeFilter', 'cuisineFilter', 'collectionFilter', 'tagFilter', 'ratingFilter',
      'includeIngredients', 'excludeIngredients', 'ingredientMode', 'ignoreStaples',
      'includeIngredientSuggestions', 'excludeIngredientSuggestions',
      'dietaryOptions', 'dietaryFilterOptions', 'favoritesOnlyBtn', 'duplicatesBtn', 'recentBtn', 'clearFiltersBtn', 'reparseOcrBtn', 'useSelectionAsTitleBtn', 'sendSelectionToIngredientsBtn', 'sendSelectionToInstructionsBtn', 'appendSelectionToNotesBtn', 'discardSelectionBtn',
      'recipeCount', 'activeFilterSummary', 'filterCountBadge', 'recipeList', 'loadMoreBtn', 'recipeDetail', 'recipeCardTemplate', 'exportBtn', 'importFile',
      'printBtn', 'printIndexCardBtn', 'deleteBtn', 'goToEditBtn',
      'runOcrBtn', 'importFromUrlBtn', 'saveRecipeBtn',
      'title', 'recipeType', 'cuisine', 'collection', 'sourceType', 'sourceLabel', 'recipeUrl',
      'tags', 'tagPicker', 'tagChipList', 'tagEntry', 'tagSuggestions',
      'rating', 'isFavorite', 'prepTime', 'cookTime', 'recipeYield',
      'featuredImageFile', 'sourceImageFiles', 'featuredImagePreview', 'featuredImageEmpty', 'featuredImageActions', 'removeFeaturedImageBtn', 'sourceImageGallery',
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
    setMobileBrowseView('list');
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
    els.pageTabs.forEach((tab) => bind(tab, 'click', () => {
      const page = tab.dataset.page || 'homePage';
      if (page === 'browsePage') setMobileBrowseView('list');
      if (page === 'editPage') {
        startNewRecipeFlow();
        return;
      }
      routeTo(page);
    }));
    bind(els.homeSearchBtn, 'click', handleHomeSearch);
    bind(els.newRecipeBtn, 'click', startNewRecipeFlow);
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
        renderList({ resetPagination: true });
      });
    });

    bind(els.sortSelect, 'change', () => {
      state.sort = getElValue(els.sortSelect) || 'updated_desc';
      renderList({ resetPagination: true });
    });

    bind(els.ignoreStaples, 'change', () => {
      state.filters.ignoreStaples = !!els.ignoreStaples.checked;
      renderList({ resetPagination: true });
    });
    bind(els.dietaryFilterOptions, 'change', () => {
      state.filters.dietary = getCheckedValues(els.dietaryFilterOptions);
      renderList({ resetPagination: true });
    });
    bind(els.favoritesOnlyBtn, 'click', () => {
      state.filters.favoritesOnly = !state.filters.favoritesOnly;
      renderList({ resetPagination: true });
    });
    bind(els.duplicatesBtn, 'click', () => {
      state.filters.duplicatesOnly = !state.filters.duplicatesOnly;
      renderList({ resetPagination: true });
    });
    bind(els.recentBtn, 'click', () => {
      state.filters.recentOnly = !state.filters.recentOnly;
      renderList({ resetPagination: true });
    });
    bind(els.clearFiltersBtn, 'click', clearFilters);
    bind(els.loadMoreBtn, 'click', () => {
      state.visibleRecipeCount += BROWSE_PAGE_SIZE;
      renderList();
    });
    bind(els.backToBrowseBtn, 'click', () => setMobileBrowseView('list', { scroll: true }));

    bind(els.entryWebsiteBtn, 'click', () => chooseEntryMethod('website'));
    bind(els.entryPhotoBtn, 'click', () => chooseEntryMethod('photo'));
    bind(els.entryManualBtn, 'click', () => chooseEntryMethod('manual'));
    bind(els.restartEntryBtn, 'click', restartEntryFlow);
    bind(els.chooseSourcePhotosBtn, 'click', () => els.sourceImageFiles?.click());

    bind(els.featuredImageFile, 'change', (e) => {
      const file = e.target.files?.[0] || null;
      if (!file) return;
      queueImageDeletion(state.draft.featuredExisting);
      state.draft.featuredExisting = '';
      state.draft.featuredFile = file;
      renderFormPreviews();
    });
    bind(els.sourceImageFiles, 'change', (e) => {
      const files = [...(e.target.files || [])];
      files.forEach((file) => {
        state.draft.sourceItems.push({ id: crypto.randomUUID(), kind: 'file', file });
      });
      if (els.sourceImageFiles) els.sourceImageFiles.value = '';
      renderFormPreviews();
      if (files.length) setStatus(`Added ${files.length} source photo${files.length === 1 ? '' : 's'}. Put multi-page recipes in reading order, then extract the text.`, 'neutral');
    });
    bind(els.removeFeaturedImageBtn, 'click', removeFeaturedImage);
    bind(els.sourceImageGallery, 'click', handleSourceImageAction);

    ['title', 'ingredients', 'instructions'].forEach((id) => {
      bind(els[id], 'input', updateReviewChecklist);
    });

    bind(els.runOcrBtn, 'click', runOcrOnSourcePages);
    bind(els.reparseOcrBtn, 'click', reparseCurrentOcrText);
    bind(els.useSelectionAsTitleBtn, 'click', () => moveSelectedOcrText('title', { replace: true, trimTitle: true }));
    bind(els.sendSelectionToIngredientsBtn, 'click', () => moveSelectedOcrText('ingredients', { append: !!els.ingredients?.value }));
    bind(els.sendSelectionToInstructionsBtn, 'click', () => moveSelectedOcrText('instructions', { append: !!els.instructions?.value }));
    bind(els.appendSelectionToNotesBtn, 'click', () => moveSelectedOcrText('notes', { append: !!els.notes?.value }));
    bind(els.discardSelectionBtn, 'click', discardSelectedOcrText);
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
      renderList({ resetPagination: true });
    });
    bind(els.excludeIngredients, 'input', () => {
      state.filters.excludeIngredients = els.excludeIngredients.value;
      renderIngredientSuggestions('exclude');
      renderList({ resetPagination: true });
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
      loadCachedRecipesSync();
      state.loadedFrom = 'browser cache (read-only)';
      return;
    }

    const { data, error } = await state.supabase.from(TABLE).select('*').order('updated_at', { ascending: false });
    if (error) {
      console.error('Supabase load failed', error);
      loadCachedRecipesSync();
      state.loadedFrom = 'browser cache (read-only)';
      return;
    }

    state.recipes = (data || []).map(normalizeRecipe);
    state.loadedFrom = 'Supabase';
    cacheLocalRecipes(state.recipes);
  }

  function loadCachedRecipesSync() {
    const merged = [];
    const seen = new Set();
    [STORAGE_KEY, ...LEGACY_STORAGE_KEYS].forEach((key) => {
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
      setSyncBadge('Cached recipes only', 'warn');
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

    [LOCAL_ONLY_KEY, ...LEGACY_STORAGE_KEYS].forEach((key) => localStorage.removeItem(key));
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
    setMobileBrowseView('list');
    renderList({ resetPagination: true });
    routeTo('browsePage');
  }

  function applyCuisineHomeFilter(value) {
    clearFilters(false);
    state.filters.cuisine = value;
    if (els.cuisineFilter) els.cuisineFilter.value = value;
    setMobileBrowseView('list');
    renderList({ resetPagination: true });
    routeTo('browsePage');
  }

  function applyDietaryHomeFilter(value) {
    clearFilters(false);
    state.filters.dietary = [value];
    setCheckedValues(els.dietaryFilterOptions, [value]);
    setMobileBrowseView('list');
    renderList({ resetPagination: true });
    routeTo('browsePage');
  }

  function handleHomeSearch() {
    clearFilters(false);
    state.filters.search = els.homeSearchInput?.value.trim() || '';
    if (els.searchInput) els.searchInput.value = state.filters.search;
    setMobileBrowseView('list');
    renderList({ resetPagination: true });
    routeTo('browsePage');
  }

  function applyHomePreset(preset) {
    clearFilters(false);
    Object.assign(state.filters, preset);
    setMobileBrowseView('list');
    renderList({ resetPagination: true });
    routeTo('browsePage');
  }

  function renderList({ resetPagination = false } = {}) {
    if (resetPagination) state.visibleRecipeCount = BROWSE_PAGE_SIZE;
    const list = filterRecipes();
    const visibleRecipes = list.slice(0, state.visibleRecipeCount);

    updateQuickFilterButton(els.favoritesOnlyBtn, state.filters.favoritesOnly);
    updateQuickFilterButton(els.duplicatesBtn, state.filters.duplicatesOnly);
    updateQuickFilterButton(els.recentBtn, state.filters.recentOnly);
    renderFilterSummary(list.length, visibleRecipes.length);
    if (!els.recipeList) return;

    els.recipeList.innerHTML = '';
    if (!list.length) {
      els.recipeList.innerHTML = '<div class="empty-state"><p>No recipes match these filters.</p></div>';
      state.selectedId = null;
      renderDetail(null);
      if (els.loadMoreBtn) els.loadMoreBtn.hidden = true;
      return;
    }

    visibleRecipes.forEach((recipe) => {
      const node = els.recipeCardTemplate.content.firstElementChild.cloneNode(true);
      const isSelected = recipe.id === state.selectedId;
      node.dataset.recipeId = recipe.id;
      node.classList.toggle('active', isSelected);
      node.setAttribute('aria-current', isSelected ? 'true' : 'false');
      node.querySelector('.recipe-card-title').textContent = recipe.title || 'Untitled recipe';
      node.querySelector('.recipe-card-subline').textContent = [recipe.recipe_type, recipe.cuisine, recipe.collection].filter(Boolean).join(' • ');
      node.querySelector('.recipe-card-rating').textContent = recipe.rating ? `${recipe.rating}/5` : '';
      const favorite = node.querySelector('.recipe-card-favorite');
      if (favorite) favorite.hidden = !recipe.is_favorite;
      const img = node.querySelector('.recipe-card-image');
      if (recipe.featured_image_url) {
        img.src = recipe.featured_image_url;
        img.alt = recipe.title || '';
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
    if (state.selectedId && !filteredSelected) {
      state.selectedId = null;
      renderDetail(null);
      setMobileBrowseView('list');
    }

    if (els.loadMoreBtn) {
      els.loadMoreBtn.hidden = visibleRecipes.length >= list.length;
      els.loadMoreBtn.textContent = `Show more recipes (${list.length - visibleRecipes.length} remaining)`;
    }
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
      .sort(compareRecipes);
  }

  function compareRecipes(a, b) {
    const titleCompare = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
    if (state.sort === 'title_asc') return titleCompare;
    if (state.sort === 'rating_desc') return (Number(b.rating) || 0) - (Number(a.rating) || 0) || titleCompare;
    if (state.sort === 'created_desc') return safeDate(b.created_at) - safeDate(a.created_at) || titleCompare;
    return safeDate(b.updated_at) - safeDate(a.updated_at) || titleCompare;
  }

  function safeDate(value) {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function updateQuickFilterButton(button, active) {
    toggleClass(button, 'is-on', active);
    if (button) button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  function renderFilterSummary(total, visible) {
    if (els.recipeCount) {
      const recipeWord = total === 1 ? 'recipe' : 'recipes';
      els.recipeCount.textContent = visible < total ? `Showing ${visible} of ${total} ${recipeWord}` : `${total} ${recipeWord}`;
    }

    const labels = activeFilterLabels();
    if (els.activeFilterSummary) els.activeFilterSummary.textContent = labels.length ? labels.join(' • ') : 'All recipes';
    if (els.filterCountBadge) {
      const count = moreFilterCount();
      els.filterCountBadge.hidden = !count;
      els.filterCountBadge.textContent = count ? String(count) : '';
    }
  }

  function moreFilterCount() {
    return [
      state.filters.type,
      state.filters.cuisine,
      state.filters.collection,
      state.filters.tag,
      state.filters.minRating,
      ...state.filters.dietary,
      state.filters.includeIngredients,
      state.filters.excludeIngredients
    ].filter(Boolean).length;
  }

  function activeFilterLabels() {
    const labels = [];
    if (state.filters.search) labels.push(`Search: ${state.filters.search}`);
    if (state.filters.type) labels.push(state.filters.type);
    if (state.filters.cuisine) labels.push(state.filters.cuisine);
    if (state.filters.collection) labels.push(`Collection: ${state.filters.collection}`);
    if (state.filters.tag) labels.push(`Tag: ${state.filters.tag}`);
    if (state.filters.minRating) labels.push(`${state.filters.minRating}+ rating`);
    labels.push(...state.filters.dietary);
    if (state.filters.favoritesOnly) labels.push('Favorites');
    if (state.filters.recentOnly) labels.push('Updated in 14 days');
    if (state.filters.duplicatesOnly) labels.push('Possible duplicates');
    if (state.filters.includeIngredients) labels.push('Pantry includes');
    if (state.filters.excludeIngredients) labels.push('Pantry excludes');
    return labels;
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
    renderList();
    setMobileBrowseView('detail', { scroll: true });
  }

  function setMobileBrowseView(view, { scroll = false } = {}) {
    state.mobileBrowseView = view === 'detail' ? 'detail' : 'list';
    if (els.browsePage) els.browsePage.dataset.mobileView = state.mobileBrowseView;
    if (scroll && state.currentPage === 'browsePage') {
      document.querySelector('.page-shell')?.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  function startNewRecipeFlow() {
    clearForm();
    state.entryMode = 'choose';
    state.reviewOrigin = '';
    renderEntryFlow();
    routeTo('editPage');
    setStatus('Choose how you want to add the recipe.', 'neutral');
  }

  function chooseEntryMethod(method) {
    if (!['website', 'photo', 'manual'].includes(method)) return;
    state.entryMode = method;
    state.reviewOrigin = '';
    renderEntryFlow();

    if (method === 'website') {
      if (els.sourceType) els.sourceType.value = 'link';
      setStatus('Paste the recipe website address.', 'neutral');
      openUrlImportDialog();
      return;
    }
    if (method === 'photo') {
      if (els.sourceType) els.sourceType.value = 'photo';
      setStatus('Choose the recipe pages or screenshots, then extract the text.', 'neutral');
      els.sourceImageFiles?.click();
      return;
    }
    if (els.sourceType) els.sourceType.value = 'manual';
    setStatus('Manual recipe form ready.', 'neutral');
    els.title?.focus();
  }

  function restartEntryFlow() {
    if (formHasUserContent() && !window.confirm('Discard this unsaved recipe and choose another starting point?')) return;
    startNewRecipeFlow();
  }

  function formHasUserContent() {
    const fields = ['title', 'cuisine', 'collection', 'sourceLabel', 'recipeUrl', 'prepTime', 'cookTime', 'recipeYield', 'ocrText', 'ingredients', 'instructions', 'notes'];
    return fields.some((id) => String(els[id]?.value || '').trim())
      || !!els.recipeType?.value
      || !!els.rating?.value
      || !!els.isFavorite?.checked
      || getCheckedValues(els.dietaryOptions).length > 0
      || state.formTags.length > 0
      || !!state.draft.featuredFile
      || !!state.draft.featuredExisting
      || state.draft.sourceItems.length > 0;
  }

  function renderEntryFlow() {
    const choosing = state.entryMode === 'choose';
    const editing = state.entryMode === 'edit';
    if (els.entryMethodChooser) els.entryMethodChooser.hidden = !choosing;
    if (els.recipeEditor) els.recipeEditor.hidden = choosing;
    if (els.restartEntryBtn) els.restartEntryBtn.hidden = choosing || editing;
    if (els.recipeEditorHeading) els.recipeEditorHeading.textContent = editing ? 'Edit Recipe' : 'Add Recipe';
    if (els.recipeEditorIntro) {
      const intros = {
        choose: 'Choose how you want to begin.',
        website: 'Import the page, then review the recipe before saving.',
        photo: 'Extract the text, then review the recipe before saving.',
        manual: 'Enter the recipe and save it when the important fields are ready.',
        edit: 'Update the recipe and save your changes.'
      };
      els.recipeEditorIntro.textContent = intros[state.entryMode] || intros.choose;
    }
    if (els.mediaFormSection && !editing) els.mediaFormSection.open = state.entryMode === 'photo';
    if (els.ocrAdvancedTools && choosing) els.ocrAdvancedTools.open = false;
    if (els.entryReviewBanner && (!state.reviewOrigin || choosing || editing || state.entryMode === 'manual')) {
      els.entryReviewBanner.hidden = true;
    }
  }

  function showImportReview(origin) {
    state.reviewOrigin = origin || 'Import';
    if (els.entryReviewBanner) els.entryReviewBanner.hidden = false;
    if (els.entryReviewHeading) els.entryReviewHeading.textContent = 'Review the imported recipe';
    if (els.entryReviewCopy) els.entryReviewCopy.textContent = `${state.reviewOrigin} finished. Check the three important fields before saving.`;
    updateReviewChecklist();
  }

  function updateReviewChecklist() {
    if (!state.reviewOrigin || !els.entryReviewBanner || els.entryReviewBanner.hidden) return;
    setReviewItem(els.reviewTitleStatus, 'Title', !!String(els.title?.value || '').trim());
    setReviewItem(els.reviewIngredientsStatus, 'Ingredients', !!String(els.ingredients?.value || '').trim());
    setReviewItem(els.reviewInstructionsStatus, 'Instructions', !!String(els.instructions?.value || '').trim());
  }

  function setReviewItem(element, label, complete) {
    if (!element) return;
    element.classList.toggle('is-complete', complete);
    element.classList.toggle('is-missing', !complete);
    element.textContent = `${complete ? '✓' : '!'} ${label}`;
  }

  function focusFirstMissingRecipeField() {
    const target = [els.title, els.ingredients, els.instructions].find((field) => !String(field?.value || '').trim()) || els.title;
    target?.focus();
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function emptyImageDraft() {
    return {
      featuredFile: null,
      featuredExisting: '',
      sourceItems: [],
      pendingDeleteUrls: [],
      previewObjectUrls: []
    };
  }

  function imageDraftFromRecipe(recipe) {
    return {
      featuredFile: null,
      featuredExisting: recipe?.featured_image_url || '',
      sourceItems: (recipe?.source_image_urls || []).map((url) => ({ id: crypto.randomUUID(), kind: 'existing', url })),
      pendingDeleteUrls: [],
      previewObjectUrls: []
    };
  }

  function revokeDraftPreviewUrls() {
    (state.draft.previewObjectUrls || []).forEach((url) => URL.revokeObjectURL(url));
    state.draft.previewObjectUrls = [];
  }

  function previewFile(file) {
    const url = URL.createObjectURL(file);
    state.draft.previewObjectUrls.push(url);
    return url;
  }

  function queueImageDeletion(url) {
    const clean = String(url || '').trim();
    if (clean && !state.draft.pendingDeleteUrls.includes(clean)) {
      state.draft.pendingDeleteUrls.push(clean);
    }
  }

  function clearForm() {
    revokeDraftPreviewUrls();
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
    state.reviewOrigin = '';
    state.draft = emptyImageDraft();
    if (els.featuredImageFile) els.featuredImageFile.value = '';
    if (els.sourceImageFiles) els.sourceImageFiles.value = '';
    renderTagChips();
    renderFormPreviews();
    if (els.entryReviewBanner) els.entryReviewBanner.hidden = true;
    if (els.ocrAdvancedTools) els.ocrAdvancedTools.open = false;
  }

  function populateForm(recipe) {
    if (!recipe) return;
    revokeDraftPreviewUrls();
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
    state.entryMode = 'edit';
    state.reviewOrigin = '';
    state.draft = imageDraftFromRecipe(recipe);
    renderTagChips();
    renderFormPreviews();
    renderEntryFlow();
  }

  function renderFormPreviews() {
    revokeDraftPreviewUrls();
    if (els.featuredImagePreview) {
      const url = state.draft.featuredFile ? previewFile(state.draft.featuredFile) : state.draft.featuredExisting;
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
    if (els.featuredImageActions) {
      els.featuredImageActions.hidden = !(state.draft.featuredFile || state.draft.featuredExisting);
    }
    if (els.sourceImageGallery) {
      const items = state.draft.sourceItems.map((item) => ({
        ...item,
        previewUrl: item.kind === 'file' ? previewFile(item.file) : item.url,
        name: item.kind === 'file' ? item.file.name : 'Saved image'
      }));
      els.sourceImageGallery.innerHTML = items.length
        ? items.map((item, index) => `
          <article class="source-thumb-card" data-image-id="${esc(item.id)}">
            <img class="source-thumb" src="${esc(item.previewUrl)}" alt="${esc(item.name || `Recipe image ${index + 1}`)}">
            <div class="source-thumb-label">Image ${index + 1}${item.kind === 'file' ? ' · new' : ''}</div>
            <div class="source-thumb-actions">
              <button type="button" data-image-action="feature" data-image-id="${esc(item.id)}">Make featured</button>
              <div class="source-order-actions">
                <button type="button" data-image-action="earlier" data-image-id="${esc(item.id)}" ${index === 0 ? 'disabled' : ''}>Earlier</button>
                <button type="button" data-image-action="later" data-image-id="${esc(item.id)}" ${index === items.length - 1 ? 'disabled' : ''}>Later</button>
              </div>
              <button type="button" class="danger-lite" data-image-action="remove" data-image-id="${esc(item.id)}">Remove</button>
            </div>
          </article>`).join('')
        : '<div class="muted">No source pages selected yet.</div>';
    }
  }

  function removeFeaturedImage() {
    queueImageDeletion(state.draft.featuredExisting);
    state.draft.featuredExisting = '';
    state.draft.featuredFile = null;
    if (els.featuredImageFile) els.featuredImageFile.value = '';
    renderFormPreviews();
    setStatus('Featured image removed from this recipe. Save the recipe to make the change permanent.', 'neutral');
  }

  function handleSourceImageAction(event) {
    const button = event.target.closest('button[data-image-action]');
    if (!button) return;
    const index = state.draft.sourceItems.findIndex((item) => item.id === button.dataset.imageId);
    if (index < 0) return;
    const action = button.dataset.imageAction;
    if (action === 'earlier' && index > 0) {
      [state.draft.sourceItems[index - 1], state.draft.sourceItems[index]] = [state.draft.sourceItems[index], state.draft.sourceItems[index - 1]];
    } else if (action === 'later' && index < state.draft.sourceItems.length - 1) {
      [state.draft.sourceItems[index + 1], state.draft.sourceItems[index]] = [state.draft.sourceItems[index], state.draft.sourceItems[index + 1]];
    } else if (action === 'remove') {
      const [removed] = state.draft.sourceItems.splice(index, 1);
      if (removed?.kind === 'existing') queueImageDeletion(removed.url);
      setStatus('Image removed from this recipe. Save the recipe to make the change permanent.', 'neutral');
    } else if (action === 'feature') {
      makeSourceImageFeatured(index);
    }
    renderFormPreviews();
  }

  function makeSourceImageFeatured(index) {
    const [nextFeatured] = state.draft.sourceItems.splice(index, 1);
    if (!nextFeatured) return;

    const previousFeatured = state.draft.featuredFile
      ? { id: crypto.randomUUID(), kind: 'file', file: state.draft.featuredFile }
      : (state.draft.featuredExisting ? { id: crypto.randomUUID(), kind: 'existing', url: state.draft.featuredExisting } : null);
    if (previousFeatured) state.draft.sourceItems.splice(index, 0, previousFeatured);

    state.draft.featuredFile = nextFeatured.kind === 'file' ? nextFeatured.file : null;
    state.draft.featuredExisting = nextFeatured.kind === 'existing' ? nextFeatured.url : '';
    if (els.featuredImageFile) els.featuredImageFile.value = '';
    setStatus('Featured image changed. Save the recipe to make the change permanent.', 'neutral');
  }

  async function runOcrOnSourcePages() {
    const ocrItems = state.draft.sourceItems.length
      ? [...state.draft.sourceItems]
      : (state.draft.featuredFile
        ? [{ kind: 'file', file: state.draft.featuredFile }]
        : (state.draft.featuredExisting ? [{ kind: 'existing', url: state.draft.featuredExisting }] : []));

    if (!ocrItems.length) {
      setStatus('Choose one or more source photos first. The photo picker is opening now.', 'error');
      els.sourceImageFiles?.click();
      return;
    }
    if (!state.supabase) {
      setStatus('Supabase must be connected before OCR can use OCR.space.', 'error');
      return;
    }

    const originalText = els.runOcrBtn ? els.runOcrBtn.textContent : 'Run OCR';
    setBusy(els.runOcrBtn, true, 'Extracting…');

    let tempPaths = [];
    try {
      routeTo('editPage');
      setStatus('Preparing images for OCR.space…', 'neutral');
      const bucket = (window.RECIPE_APP_CONFIG || {}).storageBucket || BUCKET;
      const imageUrls = [];
      for (let index = 0; index < ocrItems.length; index += 1) {
        const item = ocrItems[index];
        if (item.kind === 'existing') {
          imageUrls.push(item.url);
          continue;
        }
        setStatus(`Preparing OCR image ${index + 1} of ${ocrItems.length}…`, 'neutral');
        const uploaded = await prepareOcrImageUrls([item.file], bucket);
        tempPaths.push(...uploaded.paths);
        imageUrls.push(...uploaded.urls);
      }
      if (!imageUrls.length) throw new Error('No usable image URLs were available for OCR.');

      setStatus(`Sending ${imageUrls.length} page${imageUrls.length === 1 ? '' : 's'} to OCR.space…`, 'neutral');
      const appConfig = window.RECIPE_APP_CONFIG || {};
      const functionUrl = `${String(appConfig.supabaseUrl || '').replace(/\/$/, '')}/functions/v1/ocr-space-extract`;
      if (!appConfig.supabaseUrl) throw new Error('Supabase URL is missing from config.js.');
      const headers = { 'Content-Type': 'application/json' };
      if (appConfig.supabaseAnonKey) headers.apikey = appConfig.supabaseAnonKey;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageUrls })
      });
      let data = null;
      try {
        data = await response.json();
      } catch {}
      if (!response.ok) {
        throw new Error(data?.error || data?.message || `OCR function request failed (${response.status}).`);
      }
      if (!data?.ok) throw new Error(data?.error || 'OCR function returned an unexpected response.');

      const pageSummaries = Array.isArray(data.pages) ? data.pages : [];
      const failedPages = pageSummaries.filter((page) => page?.error);
      const combinedText = String(data.combinedText || '').trim();
      if (!combinedText.replace(/--- Page \d+ ---/g, '').trim()) {
        throw new Error(failedPages[0]?.error || 'OCR returned no readable text.');
      }

      if (els.ocrText) {
        els.ocrText.value = combinedText;
      }
      applyParsedRecipe(roughParseText(combinedText), 'ocr');
      showImportReview('Photo text extraction');
      if (failedPages.length) {
        setStatus(`OCR finished, but ${failedPages.length} page${failedPages.length === 1 ? '' : 's'} had trouble. Review the extracted text carefully.`, 'warn');
      } else {
        setStatus('OCR finished. Review the extracted text, then save the recipe.', 'success');
      }
      focusFirstMissingRecipeField();
    } catch (error) {
      console.error(error);
      setStatus(`OCR failed: ${error?.message || 'unknown error'}`, 'error');
    } finally {
      if (tempPaths.length && state.supabase) {
        const bucket = (window.RECIPE_APP_CONFIG || {}).storageBucket || BUCKET;
        state.supabase.storage.from(bucket).remove(tempPaths).catch((cleanupError) => console.warn('Temporary OCR cleanup failed', cleanupError));
      }
      setBusy(els.runOcrBtn, false, originalText);
    }
  }

  async function prepareOcrImageUrls(files, bucket) {
    const urls = [];
    const paths = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const pageNumber = index + 1;
      setStatus(`Preparing OCR image ${pageNumber} of ${files.length}…`, 'neutral');
      const processed = await resizeImageForOcr(file);
      const ext = processed.type === 'image/png' ? 'png' : 'jpg';
      const path = `ocr-temp/${Date.now()}-${Math.random().toString(36).slice(2)}-${pageNumber}.${ext}`;
      const { error } = await state.supabase.storage.from(bucket).upload(path, processed, {
        upsert: true,
        contentType: processed.type
      });
      if (error) throw error;
      const { data } = state.supabase.storage.from(bucket).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('Could not build a public URL for an OCR image.');
      urls.push(data.publicUrl);
      paths.push(path);
    }
    return { urls, paths };
  }

  async function resizeImageForOcr(file) {
    if (!file.type.startsWith('image/')) return file;
    const dataUrl = await fileToDataURL(file);
    const img = await loadImage(dataUrl);
    const safeName = file.name.replace(/\.[^.]+$/, '') || 'recipe-photo';
    const maxBytes = 900 * 1024;
    const maxEdges = [1400, 1200, 1050, 900, 800, 700];
    const qualities = [0.68, 0.58, 0.5, 0.42, 0.35];

    for (let edgeIndex = 0; edgeIndex < maxEdges.length; edgeIndex += 1) {
      const maxEdge = maxEdges[edgeIndex];
      let { width, height } = img;
      const largest = Math.max(width, height);
      if (largest > maxEdge) {
        const scale = maxEdge / largest;
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }

      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = width;
      baseCanvas.height = height;
      const baseCtx = baseCanvas.getContext('2d', { alpha: false, willReadFrequently: true });
      baseCtx.fillStyle = '#ffffff';
      baseCtx.fillRect(0, 0, width, height);
      baseCtx.drawImage(img, 0, 0, width, height);

      const imageData = baseCtx.getImageData(0, 0, width, height);
      const prepared = enhanceImageForOcr(imageData);
      baseCtx.putImageData(prepared, 0, 0);

      for (let qualityIndex = 0; qualityIndex < qualities.length; qualityIndex += 1) {
        const quality = qualities[qualityIndex];
        const blob = await canvasToBlob(baseCanvas, 'image/jpeg', quality);
        if (!blob) continue;
        if (blob.size <= maxBytes) {
          return new File([blob], `${safeName}.jpg`, { type: 'image/jpeg' });
        }
      }
    }

    throw new Error('Image is still too large for OCR.space after compression. Try a tighter crop or a screenshot.');
  }

  function enhanceImageForOcr(imageData) {
    const { data, width, height } = imageData;
    const pixelCount = width * height;
    const gray = new Uint8ClampedArray(pixelCount);
    let min = 255;
    let max = 0;

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const value = Math.round((0.299 * r) + (0.587 * g) + (0.114 * b));
      gray[p] = value;
      if (value < min) min = value;
      if (value > max) max = value;
    }

    const range = Math.max(1, max - min);
    const contrastBoost = range < 110 ? 1.35 : 1.15;

    for (let p = 0; p < pixelCount; p += 1) {
      let v = gray[p];
      v = Math.round(((v - min) * 255) / range);
      v = Math.max(0, Math.min(255, Math.round(((v - 128) * contrastBoost) + 128)));
      gray[p] = v;
    }

    const out = new Uint8ClampedArray(pixelCount);
    const radius = Math.max(8, Math.round(Math.min(width, height) / 120));

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let sum = 0;
        let count = 0;
        for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy += Math.max(1, Math.floor(radius / 2))) {
          for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += Math.max(1, Math.floor(radius / 2))) {
            sum += gray[(yy * width) + xx];
            count += 1;
          }
        }
        const idx = (y * width) + x;
        const local = sum / Math.max(1, count);
        const threshold = local - 12;
        let v = gray[idx] > threshold ? 255 : 0;
        if (gray[idx] > 200) v = 255;
        out[idx] = v;
      }
    }

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const v = out[p];
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    return imageData;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read one of the selected images.'));
      img.src = src;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }



  function getOcrSelection() {
    const field = els.ocrText;
    if (!field) return null;
    const start = typeof field.selectionStart === 'number' ? field.selectionStart : 0;
    const end = typeof field.selectionEnd === 'number' ? field.selectionEnd : 0;
    const text = field.value.slice(start, end).trim();
    if (!text) return null;
    return { field, start, end, text };
  }

  function moveSelectedOcrText(targetId, options = {}) {
    const selection = getOcrSelection();
    const target = els[targetId];
    if (!selection) {
      setStatus('Select some text in Raw OCR first.', 'warn');
      els.ocrText?.focus();
      return;
    }
    if (!target) return;
    const incoming = options.trimTitle ? oneLine(selection.text) : selection.text.trim();
    if (!incoming) {
      setStatus('That selection did not contain anything usable.', 'warn');
      return;
    }
    if (options.replace || !target.value.trim()) {
      target.value = incoming;
    } else if (options.append) {
      target.value = `${target.value.trim()}
${incoming}`.trim();
    } else {
      target.value = incoming;
    }
    removeSelectionFromOcr(selection);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.focus();
    setStatus(`Moved selected OCR text into ${friendlyFieldName(targetId)}.`, 'success');
  }

  function discardSelectedOcrText() {
    const selection = getOcrSelection();
    if (!selection) {
      setStatus('Select the junk text in Raw OCR first.', 'warn');
      els.ocrText?.focus();
      return;
    }
    removeSelectionFromOcr(selection);
    els.ocrText?.focus();
    setStatus('Selected OCR junk removed from Raw OCR text.', 'success');
  }

  function removeSelectionFromOcr(selection) {
    const field = selection.field;
    field.value = `${field.value.slice(0, selection.start)}${field.value.slice(selection.end)}`.replace(/\n{3,}/g, '\n\n').trim();
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function friendlyFieldName(id) {
    return ({ title: 'Title', ingredients: 'Ingredients', instructions: 'Instructions', notes: 'Notes' }[id]) || 'that field';
  }

  function oneLine(value) {
    return String(value || '').replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  function reparseCurrentOcrText() {

    const text = String(els.ocrText?.value || '').trim();
    if (!text) {
      setStatus('Paste or extract some OCR text first.', 'warn');
      els.ocrText?.focus();
      return;
    }
    const parsed = roughParseText(text);
    applyParsedRecipe(parsed, 'ocr');
    showImportReview('Raw text parsing');
    const moved = [];
    if (parsed._applied?.title) moved.push('title');
    if (parsed._applied?.ingredients) moved.push('ingredients');
    if (parsed._applied?.instructions) moved.push('instructions');
    setStatus(moved.length ? `Pulled ${moved.join(', ')} from OCR. Review before saving.` : 'No high-confidence ingredient or instruction blocks found. Use the selection tools to move the useful text yourself.', moved.length ? 'success' : 'warn');
  }

  function openUrlImportDialog() {
    if (!els.urlImportDialog) {
      setStatus('URL import dialog is unavailable in this build.', 'error');
      return;
    }
    if (state.entryMode !== 'edit') {
      state.entryMode = 'website';
      renderEntryFlow();
      if (els.sourceType) els.sourceType.value = 'link';
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

    const originalText = els.importFromUrlBtn ? els.importFromUrlBtn.textContent : 'Import a website';
    const originalConfirmText = els.confirmUrlImportBtn ? els.confirmUrlImportBtn.textContent : 'Import';
    setBusy(els.importFromUrlBtn, true, 'Importing…');
    setBusy(els.confirmUrlImportBtn, true, 'Importing…');
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
      showImportReview('Website import');
      setStatus(`URL import finished using ${fetched.mode}. Review the fields, then save the recipe.`, 'success');
      focusFirstMissingRecipeField();
    } catch (error) {
      console.error(error);
      setStatus(`URL import failed: ${error?.message || 'blocked by site or browser'}`, 'error');
    } finally {
      setBusy(els.importFromUrlBtn, false, originalText);
      setBusy(els.confirmUrlImportBtn, false, originalConfirmText);
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
    const output = { title: '', ingredients: '', instructions: '', recipeYield: '', cuisine: '', tags: [], ocrText: '', confidence: { title: false, ingredients: false, instructions: false } };
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
      output.confidence = { title: !!output.title, ingredients: !!output.ingredients, instructions: !!output.instructions };
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
    const confidence = parsed.confidence || {};
    const applied = { title: false, ingredients: false, instructions: false };
    const shouldTrustStructured = sourceKind === 'url';

    if (parsed.title && !els.title.value && (shouldTrustStructured || confidence.title)) {
      els.title.value = parsed.title;
      applied.title = true;
    }
    if (parsed.ingredients && !els.ingredients.value && (shouldTrustStructured || confidence.ingredients)) {
      els.ingredients.value = parsed.ingredients;
      applied.ingredients = true;
    }
    if (parsed.instructions && !els.instructions.value && (shouldTrustStructured || confidence.instructions)) {
      els.instructions.value = parsed.instructions;
      applied.instructions = true;
    }
    if (parsed.recipeYield && !els.recipeYield.value) els.recipeYield.value = parsed.recipeYield;
    if (parsed.cuisine && !els.cuisine.value) els.cuisine.value = parsed.cuisine;
    if (parsed.ocrText) els.ocrText.value = parsed.ocrText;
    if (sourceKind === 'url' && els.sourceType) els.sourceType.value = 'link';
    mergeTags(parsed.tags || []);
    parsed._applied = applied;
  }

  function roughParseText(text) {
    const clean = String(text || '').trim();
    const lines = clean.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const normalizedLines = lines.map((line) => line.replace(/[•·]/g, '').trim());
    const title = pickLikelyTitle(normalizedLines);
    const ingredientHeadingIndex = normalizedLines.findIndex((line) => /^ingredients?\b/i.test(line));
    const instructionHeadingIndex = normalizedLines.findIndex((line) => /^(instructions?|directions?|method|preparation|prep)\b/i.test(line));

    let ingredientLines = [];
    let instructionLines = [];
    let ingredientConfidence = false;
    let instructionConfidence = false;

    if (ingredientHeadingIndex >= 0) {
      const end = instructionHeadingIndex > ingredientHeadingIndex ? instructionHeadingIndex : normalizedLines.length;
      ingredientLines = normalizedLines.slice(ingredientHeadingIndex + 1, end).filter(Boolean);
      ingredientConfidence = ingredientLines.length >= 2 && ingredientLines.filter(looksLikeIngredientLine).length >= Math.max(2, Math.ceil(ingredientLines.length * 0.45));
    } else {
      ingredientLines = findIngredientBlock(normalizedLines);
      ingredientConfidence = ingredientLines.length >= 3;
    }

    if (instructionHeadingIndex >= 0) {
      instructionLines = normalizedLines.slice(instructionHeadingIndex + 1).filter(Boolean);
      instructionConfidence = instructionLines.length >= 1;
    } else {
      instructionLines = findInstructionBlock(normalizedLines, ingredientLines);
      instructionConfidence = instructionLines.length >= 1;
    }

    const ingredients = ingredientConfidence ? ingredientLines.join('\n').trim() : '';
    const instructions = instructionConfidence ? instructionLines.join('\n').trim() : '';

    return {
      title,
      ingredients,
      instructions,
      recipeYield: '',
      cuisine: '',
      tags: inferTagsFromText(clean),
      ocrText: clean,
      confidence: {
        title: !!title,
        ingredients: ingredientConfidence,
        instructions: instructionConfidence
      }
    };
  }

  function pickLikelyTitle(lines) {
    const candidate = lines[0] || '';
    if (!candidate) return '';
    if (candidate.length > 90) return '';
    if (looksLikeIngredientLine(candidate)) return '';
    if (/^(ingredients?|directions?|instructions?|method|prep|yield|serves)\b/i.test(candidate)) return '';
    return oneLine(candidate);
  }

  function looksLikeIngredientLine(line) {
    const clean = String(line || '').trim();
    if (!clean) return false;
    if (clean.length > 120) return false;
    if (/^(advertisement|tips?|nutrition|note|notes|copyright|photo|photograph|serves|yield|prep|cook time)\b/i.test(clean)) return false;
    if (/\b\d+\s*(min|minutes|hour|hours)\b/i.test(clean)) return false;
    const measurement = /(\b\d+[\/\d\s.-]*\s*(cup|cups|tbsp|tablespoons?|tsp|teaspoons?|oz|ounce|ounces|lb|pound|pounds|g|kg|ml|l|clove|cloves|can|cans|package|packages|pinch|dash)\b)|(^[\d¼½¾⅓⅔⅛⅜⅝⅞]+)/i;
    const foodish = /\b(onion|garlic|salt|pepper|oil|butter|sugar|flour|milk|cream|cheese|egg|eggs|chicken|beef|pork|fish|salmon|mushroom|rice|beans?|tomato|potato|carrot|thyme|basil|parsley|cilantro|lemon|lime|vinegar|broth|stock)\b/i;
    return measurement.test(clean) || (foodish.test(clean) && clean.length < 70);
  }

  function looksLikeInstructionLine(line) {
    const clean = String(line || '').trim();
    if (!clean) return false;
    if (looksLikeIngredientLine(clean) && clean.length < 70) return false;
    return /[.!?]/.test(clean) || /^(step\s*\d+|\d+\.|heat|stir|add|cook|bake|whisk|mix|combine|bring|simmer|drain|serve|preheat)\b/i.test(clean);
  }

  function findIngredientBlock(lines) {
    let best = [];
    let current = [];
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (looksLikeIngredientLine(line)) {
        current.push(line);
      } else {
        if (current.length > best.length) best = current.slice();
        current = [];
      }
    }
    if (current.length > best.length) best = current.slice();
    return best;
  }

  function findInstructionBlock(lines, ingredientLines) {
    const ingredientSet = new Set((ingredientLines || []).map((line) => line.trim()));
    const candidates = lines.filter((line, index) => index > 0 && !ingredientSet.has(line.trim()) && looksLikeInstructionLine(line));
    return candidates.slice(0, 18);
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

    if (!state.supabase) {
      setStatus('Save failed: Supabase is not connected. Nothing was saved locally.', 'error');
      return;
    }

    setStatus('Saving recipe…', 'neutral');
    setBusy(els.saveRecipeBtn, true, 'Saving…');
    const newlyUploadedPaths = [];
    let savedRecipe = null;
    let cleanupWarning = '';

    try {
      const uploads = await uploadImages(recipe.id, newlyUploadedPaths);
      recipe.featured_image_url = uploads.featured || '';
      recipe.source_image_urls = uploads.sources;
      const { data, error } = await state.supabase.from(TABLE).upsert(toPayload(recipe)).select().single();
      if (error) throw error;
      savedRecipe = normalizeRecipe(data);
      upsertRecipe(savedRecipe);
      state.loadedFrom = 'Supabase';

      const referencedUrls = [savedRecipe.featured_image_url, ...savedRecipe.source_image_urls].filter(Boolean);
      try {
        await cleanupRemovedImageUrls(state.draft.pendingDeleteUrls, referencedUrls);
        await cleanupRecipeStorageFolder(savedRecipe.id, referencedUrls);
      } catch (cleanupError) {
        console.warn('Recipe saved, but image cleanup failed', cleanupError);
        cleanupWarning = ' The recipe was saved, but one or more unused uploaded files could not be removed.';
      }

      cacheLocalRecipes(state.recipes);
      refreshPendingLocalRecipes();
      refreshAll();
      updateSyncUi();
      state.selectedId = recipe.id;
      revokeDraftPreviewUrls();
      state.draft = imageDraftFromRecipe(savedRecipe);
      renderDetail(savedRecipe);
      setMobileBrowseView('detail');
      routeTo('browsePage');
      setStatus(`Recipe saved to ${state.loadedFrom}.${cleanupWarning}`, cleanupWarning ? 'warn' : 'success');
    } catch (error) {
      console.error(error);
      if (!savedRecipe && newlyUploadedPaths.length) {
        try {
          await removeStoragePaths(newlyUploadedPaths);
        } catch (cleanupError) {
          console.warn('Failed-save image cleanup also failed', cleanupError);
        }
      }
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

  async function uploadImages(recipeId, uploadedPaths = []) {
    const uploaded = { featured: state.draft.featuredExisting || '', sources: [] };
    const bucket = (window.RECIPE_APP_CONFIG || {}).storageBucket || BUCKET;
    if (state.draft.featuredFile) {
      const result = await uploadFile(state.draft.featuredFile, recipeId, bucket, 'featured');
      uploaded.featured = result.url;
      uploadedPaths.push(result.path);
    }
    for (const item of state.draft.sourceItems) {
      if (item.kind === 'existing') {
        uploaded.sources.push(item.url);
        continue;
      }
      const result = await uploadFile(item.file, recipeId, bucket, 'source');
      uploaded.sources.push(result.url);
      uploadedPaths.push(result.path);
    }
    return uploaded;
  }

  async function uploadFile(file, recipeId, bucket, kind) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${recipeId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await state.supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = state.supabase.storage.from(bucket).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('The image uploaded, but its public URL could not be created.');
    return { url: data.publicUrl, path };
  }

  function storageReferenceFromUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    try {
      const url = new URL(raw);
      const configuredHost = new URL((window.RECIPE_APP_CONFIG || {}).supabaseUrl || '').host;
      if (!configuredHost || url.host !== configuredHost) return null;
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
      if (!match) return null;
      return {
        bucket: decodeURIComponent(match[1]),
        path: match[2].split('/').map((part) => decodeURIComponent(part)).join('/')
      };
    } catch {
      return null;
    }
  }

  async function removeStoragePaths(paths) {
    const unique = [...new Set((paths || []).filter(Boolean))];
    if (!unique.length) return 0;
    const bucket = (window.RECIPE_APP_CONFIG || {}).storageBucket || BUCKET;
    for (let index = 0; index < unique.length; index += 100) {
      const batch = unique.slice(index, index + 100);
      const { error } = await state.supabase.storage.from(bucket).remove(batch);
      if (error) throw error;
    }
    return unique.length;
  }

  async function cleanupRemovedImageUrls(urls, keepUrls = []) {
    const bucket = (window.RECIPE_APP_CONFIG || {}).storageBucket || BUCKET;
    const keep = new Set(keepUrls.map(storageReferenceFromUrl).filter((ref) => ref?.bucket === bucket).map((ref) => ref.path));
    const paths = urls
      .map(storageReferenceFromUrl)
      .filter((ref) => ref?.bucket === bucket && !keep.has(ref.path))
      .map((ref) => ref.path);
    return removeStoragePaths(paths);
  }

  async function cleanupRecipeStorageFolder(recipeId, keepUrls = []) {
    const bucket = (window.RECIPE_APP_CONFIG || {}).storageBucket || BUCKET;
    const keep = new Set(keepUrls.map(storageReferenceFromUrl).filter((ref) => ref?.bucket === bucket).map((ref) => ref.path));
    const { data, error } = await state.supabase.storage.from(bucket).list(recipeId, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    const unusedPaths = (data || [])
      .filter((item) => item?.name && (item.id || item.metadata))
      .map((item) => `${recipeId}/${item.name}`)
      .filter((path) => !keep.has(path));
    return removeStoragePaths(unusedPaths);
  }

  function toPayload(recipe) {
    return {
      id: recipe.id,
      title: recipe.title,
      recipe_type: recipe.recipe_type,
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
    if (!state.supabase) {
      setStatus('Delete failed: Supabase is not connected. The recipe was not removed.', 'error');
      return;
    }
    if (!window.confirm(`Delete “${recipe.title}”?`)) return;

    try {
      const { error } = await state.supabase.from(TABLE).delete().eq('id', recipe.id);
      if (error) throw error;
      let cleanupWarning = '';
      try {
        await cleanupRecipeStorageFolder(recipe.id, []);
      } catch (cleanupError) {
        console.warn('Recipe deleted, but its uploaded files could not all be removed', cleanupError);
        cleanupWarning = ' The recipe record is gone, but one or more uploaded files may still need cleanup.';
      }
      state.recipes = state.recipes.filter((item) => item.id !== recipe.id);
      cacheLocalRecipes(state.recipes);
      refreshPendingLocalRecipes();
      refreshAll();
      updateSyncUi();
      state.selectedId = null;
      renderDetail(null);
      setStatus(`Recipe deleted.${cleanupWarning}`, cleanupWarning ? 'warn' : 'success');
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
      if (!state.supabase) throw new Error('Supabase is not connected. Nothing was imported.');
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('JSON import expects an array of recipes.');
      const recipes = parsed.map(normalizeRecipe);
      const { data, error } = await state.supabase.from(TABLE).upsert(recipes.map(toPayload)).select();
      if (error) throw error;
      (data || []).map(normalizeRecipe).forEach(upsertRecipe);
      state.loadedFrom = 'Supabase';
      cacheLocalRecipes(state.recipes);
      refreshPendingLocalRecipes();
      refreshAll();
      updateSyncUi();
      setStatus(`JSON import complete. Saved ${recipes.length} recipe${recipes.length === 1 ? '' : 's'} to Supabase.`, 'success');
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
    if (renderAfter) renderList({ resetPagination: true });
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
      renderList({ resetPagination: true });
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
    newRecipeBtn: () => startNewRecipeFlow(),
    runOcrBtn: () => runOcrOnSourcePages(),
    importFromUrlBtn: () => openUrlImportDialog(),
    saveRecipeBtn: () => saveRecipe()
  };
})();
