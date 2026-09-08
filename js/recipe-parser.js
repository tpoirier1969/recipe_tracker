(() => {
  'use strict';

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

  function roughParseText(text) {
    const clean = String(text || '').trim();
    const lines = clean.split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line && !/^--- Page \d+ ---$/i.test(line));
    const normalizedLines = lines.map((line) => line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^[•·▪◦●]\s*/, '')
      .replace(/^[-*]\s+/, '')
      .replace(/\s+/g, ' ')
      .trim());
    const title = pickLikelyTitle(normalizedLines);
    const ingredientHeadingIndex = normalizedLines.findIndex(isIngredientHeading);
    const instructionHeadingIndex = normalizedLines.findIndex(isInstructionHeading);

    let ingredientLines = [];
    let instructionLines = [];
    let ingredientConfidence = false;
    let instructionConfidence = false;

    if (ingredientHeadingIndex >= 0) {
      const end = instructionHeadingIndex > ingredientHeadingIndex ? instructionHeadingIndex : normalizedLines.length;
      ingredientLines = normalizedLines.slice(ingredientHeadingIndex + 1, end)
        .filter((line) => line && !isNonRecipeSectionHeading(line) && !isIngredientNoise(line));
      ingredientConfidence = ingredientLines.length >= 2 && ingredientLines.filter(looksLikeIngredientLine).length >= Math.max(2, Math.ceil(ingredientLines.length * 0.45));
    } else {
      ingredientLines = findIngredientBlock(normalizedLines);
      ingredientConfidence = ingredientLines.length >= 3;
    }
    if (!ingredientConfidence) ingredientLines = [];

    if (instructionHeadingIndex >= 0) {
      instructionLines = takeInstructionBlock(normalizedLines, instructionHeadingIndex + 1);
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
    const candidates = (lines || []).slice(0, 48)
      .map((line, index) => ({ line: oneLine(line), index }))
      .filter(({ line }) => isTitleCandidate(line));
    if (!candidates.length) return '';

    const ingredientHeadingIndex = (lines || []).findIndex(isIngredientHeading);
    const instructionHeadingIndex = (lines || []).findIndex(isInstructionHeading);
    const nearestRecipeHeading = [ingredientHeadingIndex, instructionHeadingIndex]
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];

    const ranked = candidates.map((candidate) => {
      const { line, index } = candidate;
      let score = 0;
      const words = line.split(/\s+/).filter(Boolean);
      const letters = line.replace(/[^A-Za-z]/g, '');
      const uppercaseRatio = letters ? line.replace(/[^A-Z]/g, '').length / letters.length : 0;
      if (uppercaseRatio >= 0.72 && words.length >= 2) score += 5;
      else if (/^[A-Z][^.!?]{2,70}$/.test(line) && words.length >= 2) score += 2;
      if (nearestRecipeHeading >= 0) {
        const distance = Math.abs(nearestRecipeHeading - index);
        if (distance <= 3) score += 7 - distance;
      }
      if (index < 6) score += 2;
      if (/\b(cake|cookie|cookies|pie|tart|bread|muffin|pancake|lasagn|pasta|soup|stew|salad|sauce|stir[- ]?fry|chicken|beef|fish|vegetable|apple|caramel|bacon|tomato)\b/i.test(line)) score += 3;
      if (/\b(recipe|dish)\b/i.test(line)) score += 1;
      if (/[.!?]$/.test(line)) score -= 4;
      if (/\b(all the info|top tips?|quick and easy|whip up|cooking school|from .* pantry)\b/i.test(line)) score -= 8;
      if (/^(breakfast|lunch|dinner|cooking|school|food|recipe)\b$/i.test(line)) score -= 6;
      return { ...candidate, score };
    }).sort((a, b) => b.score - a.score || a.index - b.index);

    const best = ranked[0];
    if (!best || best.score < 1) return oneLine(lines[0] || '');

    const continuation = lines[best.index + 1];
    if (continuation && best.index < 12 && best.index + 1 < (nearestRecipeHeading >= 0 ? nearestRecipeHeading : lines.length)
      && continuation.length < 60 && !isSectionHeading(continuation)
      && !looksLikeIngredientLine(continuation)
      && (!looksLikeInstructionLine(continuation) || (best.index < 6 && /^[a-z]/.test(continuation)))
      && ((best.index < 6 && /^[a-z]/.test(continuation)) || /^[A-Z][A-Za-z'&-]{2,}$/.test(continuation))
      && !/[.!?]$/.test(best.line)) {
      return oneLine(`${best.line} ${continuation}`);
    }
    return best.line;
  }

  function isIngredientHeading(line) {
    return /^ingredients?(?:\s+(?:for this recipe|needed|you(?:'ll)? need))?\s*:?$/i.test(String(line || '').trim());
  }

  function isInstructionHeading(line) {
    return /^(instructions?|directions?|method|preparation|prep)(?:\s+(?:steps?|continued))?\s*:?$/i.test(String(line || '').trim());
  }

  function isSectionHeading(line) {
    return /^(ingredients?|instructions?|directions?|method|preparation|prep|notes?|nutrition|equipment|source|references?|copyright|top tips?|tips?|for writing|each serving contains)\b/i.test(String(line || '').trim());
  }

  function isNonRecipeSectionHeading(line) {
    const clean = String(line || '').trim();
    return /^(notes?|nutrition|equipment|source|references?|copyright|top tips?|tips?|for writing|each serving contains|advertisement)\b/i.test(clean)
      || /^from .* pantry$/i.test(clean);
  }

  function isIngredientNoise(line) {
    const clean = String(line || '').trim();
    return /^(serves?|yields?|makes?|prep(?:aration)? time|cook(?:ing)? time|ready in|cost per serve)\b/i.test(clean)
      || /^\d+\s*[°º]\s*(?:makes?|serves?)?/i.test(clean);
  }

  function isTitleCandidate(line) {
    const candidate = String(line || '').trim();
    if (!candidate || candidate.length > 90 || candidate.length < 3) return false;
    if (/^\d{1,2}:\d{2}(?:\s*[ap]m)?$/i.test(candidate)) return false;
    if (/^\d+\s+(?:steps?|ingredients?|items?|ways?)\b/i.test(candidate)) return false;
    if (/^[\d¼½¾⅓⅔⅛⅜⅝⅞][\/\d\s.-]*\s*(cup|cups|tbsp|tablespoons?|tsp|teaspoons?|oz|ounce|ounces|lb|pound|pounds|g|kg|ml|l|clove|cloves|can|cans|package|packages|pinch|dash)\b/i.test(candidate)) return false;
    if (isSectionHeading(candidate) || isNonRecipeSectionHeading(candidate)) return false;
    if (/^(serves?|yields?|makes?|prep(?:aration)? time|cook(?:ing)? time|ready in|cost per serve|all the info|whip up|let's wok)\b/i.test(candidate)) return false;
    if (/^[\d\W_]+$/.test(candidate)) return false;
    return true;
  }

  function takeInstructionBlock(lines, startIndex) {
    const output = [];
    for (let index = startIndex; index < lines.length; index += 1) {
      const line = String(lines[index] || '').trim();
      if (!line) continue;
      if (output.length >= 2 && isNonRecipeSectionHeading(line)) break;
      if (output.length >= 2 && isLikelyNewRecipeTitle(line, lines, index)) break;
      output.push(line);
    }
    return output;
  }

  function isLikelyNewRecipeTitle(line, lines, index) {
    if (!isTitleCandidate(line)) return false;
    const letters = line.replace(/[^A-Za-z]/g, '');
    const uppercaseRatio = letters ? line.replace(/[^A-Z]/g, '').length / letters.length : 0;
    if (uppercaseRatio < 0.72 || line.split(/\s+/).length < 2) return false;
    const next = lines[index + 1] || '';
    return /^\d|^(serves?|yield|makes?|ingredients?)\b/i.test(next) || index > 8;
  }

  function looksLikeIngredientLine(line) {
    const clean = String(line || '').trim();
    if (!clean || clean.length > 120) return false;
    if (/^(advertisement|tips?|nutrition|note|notes|copyright|photo|photograph|serves|yield|prep|cook time)\b/i.test(clean)) return false;
    if (/\b\d+\s*(min|minutes|hour|hours)\b/i.test(clean)) return false;
    const measurement = /\b\d+[\/\d\s.-]*\s*(c\.?|cup|cups|tbsp|tbs|tablespoons?|tb|tsp|teaspoons?|oz|ounce|ounces|lb|pound|pounds|g|kg|ml|l|clove|cloves|can|cans|package|packages|pkg|pkgs|pinch|dash|bsp)\b/i;
    const foodish = /\b(onion|garlic|salt|pepper|oil|butter|sugar|flour|milk|cream|cheese|egg|eggs|chicken|beef|pork|fish|salmon|mushroom|rice|beans?|tomato|potato|carrot|thyme|basil|parsley|cilantro|lemon|lime|vinegar|broth|stock)\b/i;
    const letters = clean.replace(/[^A-Za-z]/g, '');
    const uppercaseRatio = letters ? clean.replace(/[^A-Z]/g, '').length / letters.length : 0;
    if (uppercaseRatio >= 0.8 && !measurement.test(clean)) return false;
    return measurement.test(clean) || (foodish.test(clean) && clean.length < 70 && !/^(choose|use|follow|each|every)\b/i.test(clean));
  }

  function looksLikeInstructionLine(line) {
    const clean = String(line || '').trim();
    if (!clean) return false;
    if (looksLikeIngredientLine(clean) && clean.length < 70 && !looksLikeInstructionStart(clean)) return false;
    return /[.!?]/.test(clean) || /^(step\s*\d+|\d+\.\s*|\d+\s+(?=(?:cut|heat|add|cook|bake|whisk|mix|combine|bring|simmer|drain|serve|preheat|place|pour|fold|remove|allow|cream|beat|sprinkle|cover|refrigerate|saute|sauté)\b)|heat|stir(?!-fry)\b|add|cook|bake|whisk|mix|combine|bring|simmer|drain|serve|preheat|in a|when ready|feel free|place|pour|fold|remove|allow|cream|beat|sprinkle|cover|refrigerate|saute|sauté)\b/i.test(clean);
  }

  function looksLikeInstructionStart(line) {
    const clean = String(line || '').trim();
    return /^(step\s*\d+|\d+\.\s*|\d+\s+(?=(?:cut|heat|add|cook|bake|whisk|mix|combine|bring|simmer|drain|serve|preheat|place|pour|fold|remove|allow|cream|beat|sprinkle|cover|refrigerate|saute|sauté)\b)|heat|stir(?!-fry)\b|add|cook|bake|whisk|mix|combine|bring|simmer|drain|serve|preheat|in a|when ready|feel free|place|pour|fold|remove|allow|cream|beat|sprinkle|cover|refrigerate|saute|sauté)\b/i.test(clean);
  }

  function findIngredientBlock(lines) {
    let best = [];
    let current = [];
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (current.length >= 2 && looksLikeInstructionStart(line)) {
        if (current.length > best.length) best = current.slice();
        break;
      }
      if (looksLikeIngredientLine(line)) current.push(line);
      else {
        if (current.length > best.length) best = current.slice();
        current = [];
      }
    }
    if (current.length > best.length) best = current.slice();
    const measured = best.filter((line) => /\b\d+[\/\d\s.-]*\s*(c\.?|cup|cups|tbsp|tbs|tablespoons?|tb|tsp|teaspoons?|oz|ounce|ounces|lb|pound|pounds|g|kg|ml|l|clove|cloves|can|cans|package|packages|pkg|pkgs|pinch|dash|bsp)\b/i.test(line));
    return measured.length >= 1 ? best : [];
  }

  function findInstructionBlock(lines, ingredientLines) {
    const ingredientSet = new Set((ingredientLines || []).map((line) => line.trim()));
    const output = [];
    let started = false;
    for (let index = 1; index < lines.length; index += 1) {
      const line = String(lines[index] || '').trim();
      if (!line || ingredientSet.has(line)) continue;
      if (!started) {
        if (!looksLikeInstructionStart(line)) continue;
        started = true;
      } else if (isNonRecipeSectionHeading(line) || isLikelyNewRecipeTitle(line, lines, index)) break;
      if (started && looksLikeInstructionLine(line)) output.push(line);
      if (output.length >= 18) break;
    }
    return output;
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

  function oneLine(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function str(value) {
    return String(value || '').trim();
  }

  window.RecipeTrackerParser = {
    parseRecipePayload,
    parseRecipeHtml,
    roughParseText,
    inferTagsFromText
  };
})();
