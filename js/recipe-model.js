(() => {
  'use strict';

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

  function csvToArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(str).filter(Boolean);
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  }

  function str(value) {
    return String(value || '').trim();
  }

  window.RecipeTrackerModel = {
    normalizeRecipe,
    toPayload,
    csvToArray
  };
})();
