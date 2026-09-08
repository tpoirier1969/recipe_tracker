# Recipe Repository

This build breaks the app into clearer sections so it behaves more like a usable recipe vault and less like one oversized form.

## Current features
- **Home page** with basic search and jump buttons
- **Browse page** for filters, pantry matching, results, and detail view
- **Add / Correct page** for recipe entry, OCR cleanup, and tagging
- **Browse by country / cuisine** from the home page and browse filters
- clearer **OCR correction workflow** so imported text can be fixed, tagged, and saved in one place
- **Image management** for removing, ordering, and choosing a featured image
- automatic cleanup of unused new-bucket files after a recipe is saved or deleted
- a namespaced, version-controlled **Recipe Tracker OCR Edge Function** using OCR.space Engine 3 with a selective Engine 2 retry
- keeps prior features:
  - multi-photo source pages
  - featured food photo
  - OCR across all selected source pages
  - ingredient normalization / synonym handling
  - predictive ingredient suggestions
  - print page and 4x6 card output

## Supabase setup
1. Run `supabase.sql` in the Supabase SQL Editor.
2. Fill in your single `config.js` file with:
   - `supabaseUrl`
   - `supabaseAnonKey`
   - optional `storageBucket` (default: `recipe_tracker_assets`)

## Notes
- Supabase is the only writable recipe store. Browser storage is a read-only cache and a rescue path for recipes created by older builds.
- With Supabase enabled, images upload into Storage under each recipe id.
- Existing recipes using only `image_url` are carried forward as the featured image.
- The SQL migration renames `foodie_recipes` to `recipe_tracker_recipes` in place, so existing recipe rows and IDs are preserved.
- New images use `recipe_tracker_assets`. The legacy `foodie_recipe_assets` bucket remains readable so existing image URLs continue to work; it is no longer used for new uploads.
- Image cleanup is deliberately limited to `recipe_tracker_assets` and the current recipe's folder. External image URLs and legacy-bucket files are detached from recipes but are not deleted.
- Country / cuisine browsing uses both a preset list and any cuisines already saved in your recipes.
- OCR requests accept only this project's Supabase Storage URLs, require a valid project JWT, limit page and file sizes, auto-detect orientation, preserve table-like lines, and omit the old oversized raw API response.
