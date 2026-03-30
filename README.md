# Recipe Repository v0.7.1

This build breaks the app into clearer sections so it behaves more like a usable recipe vault and less like one oversized form.

## What changed in v0.7.1
- **Home page** with basic search and jump buttons
- **Browse page** for filters, pantry matching, results, and detail view
- **Add / Correct page** for recipe entry, OCR cleanup, and tagging
- **Browse by country / cuisine** from the home page and browse filters
- clearer **OCR correction workflow** so imported text can be fixed, tagged, and saved in one place
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
   - optional `storageBucket` (default: `foodie_recipe_assets`)

## Notes
- Local mode works without Supabase.
- With Supabase enabled, images upload into Storage under each recipe id.
- Existing recipes using only `image_url` are carried forward as the featured image.
- Country / cuisine browsing uses both a preset list and any cuisines already saved in your recipes.
