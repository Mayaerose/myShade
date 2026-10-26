# Shade Matcher 10-Tone Catalog — Review Notes

**Prepared:** October 24, 2026  
**Status:** Review draft; do not import until the proposed matches are checked.

## Files in this review set

- `shade-matcher-40-brand-roster.csv`: 40 curated brands, one selected foundation/complexion line per brand, captured shade-label counts, example labels, official sources, and source-coverage notes.
- `shade-matcher-10-tone-recommendations.csv`: 80 proposed recommendation rows: 8 distinct brands for each of the 10 Monk swatches. It preserves the brand's exact shade label, the proposed app range, source links, confidence, and review status.
- `shade-matcher-plan-and-schema-10-tones.md`: revised app plan and schema using range levels 1–10.

## How to review the recommendation CSV

- Every row is a proposed app mapping to one Monk swatch. Brands do not publish a shared Monk-scale conversion, so these are not brand-certified equivalencies.
- The same eight broad-range brands are represented in each Monk group: Fenty Beauty, M·A·C Cosmetics, L’Oréal Paris, Estée Lauder, NARS, Haus Labs, Bobbi Brown, and Rare Beauty. Rare Beauty is updated to its current True to Myself Natural Matte Longwear Foundation, whose official selector lists 48 numbered shades.
- The CSV has exactly 8 distinct brands per group (80 rows total). The separate 40-brand roster shows the wider research pool; the other 32 brands have not been mapped into these ten recommendations yet.
- Shade names were checked against the earlier source-linked 40-brand shade research CSV. Each row includes the captured source-coverage status; a shade being listed in a research draft does not by itself confirm current stock or full product-line coverage.
- Fenty’s current line page reports 50 all-new shades, while 45 shade-specific labels were captured; verify the five missing labels. Estée Lauder’s captured options came from a sampler source and need reconciliation with the live product selector. Haus Labs availability varies by shade. These rows remain review-only.
- Shade images are not included. The CSV includes official product/shade-source links; use product images only after deciding that their reuse is allowed.

## Review before import

1. Check every selected shade on its official source page and confirm current availability.
2. Decide whether each shade belongs under its proposed Monk swatch. Use `mapping_basis` and `mapping_confidence` as review aids, not guarantees.
3. Keep or replace each recommendation, then recount distinct brands for every group.
4. Change `review_status` to `approved` only after review. No Atlas changes were made for this draft.
