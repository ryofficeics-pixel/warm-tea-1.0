# Warm Tea V2 Breakdown

Split pages per step so each step can be edited independently:

1. `01-home.html` - arrival
2. `02-pour.html` - step 1 (voice/text dump)
3. `03-sort.html` - step 2 (weights)
4. `04-carry.html` - step 3 (bucket cycle)
5. `05-release.html` - step 4 (release)
6. `06-breathe.html` - step 5 (breathing)
7. `07-return.html` - step 6 (finish/save/reset)
8. `08-past.html` - archive view

Shared files:

- `shared.css` - shared visual style
- `shared.js` - shared state + flow logic

State uses LocalStorage keys:

- `wt_v2_breakdown_state`
- `wt_s` (saved cups archive)
