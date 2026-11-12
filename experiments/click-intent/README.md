# Click / Zen hover trial (2.7.390-click1015.1)

This updates the existing DEV userscript identity and preserves its settings. Do not enable duplicate copies. Build with `node experiments/click-intent/build.cjs`. Production dist is unchanged.

Changes:
- Keep the floating Zen control within its video link's DOM ancestry; use the popover top layer to avoid clipping. No header-specific class selectors.
- Cancel navigation only for the Zen control's own click. Hide on scroll, resize, Escape, or outside click.
- Include the click intent boundary fix for nested author/tag links, controls, and editable content.

Checks: automated native Chrome mouse test and 116 related unit cases. Real signed-in follow dropdown remains user acceptance pending. Supplied HTML confirmed the link wraps both thumbnail and title; no private HTML is published.

Acceptance:
1. Zen mode: open header follow dropdown, hover video then Zen. Dropdown stays open. Click Zen: one player, no official tab/page navigation.
2. Repeat after scrolling dropdown; check thumbnail and title. Close player and repeat.
3. Click-to-open mode: video thumbnail/title/card blank/date launch once, without navigating the page. Author/tag links retain their ordinary action.

Known limitation: generic click propagation/third-party viewed marking is not solved in this trial. Existing double-navigation suppression remains enabled by default.

Rollback: install https://raw.githubusercontent.com/ButaMonky/ZenzaWatch/develop/dist/ZenzaWatch-dev.user.js over this trial; confirm downgrade in Tampermonkey. Settings are retained.
