# External playback integration implementation plan

Goal: distribute external playback with ZenzaBlogPartsButton, retaining its userscript identity and legacy embedded buttons.
Architecture: packages/external-playback owns typed controls, settings, lifecycle and tested transport adapters. Its builder derives the isolated player from the current main distribution; no frozen player fork. Main and companion share settings descriptors. Existing authenticated transport remains private to userscript storage.
Tech stack: TypeScript, CommonJS build tools, browser/DOM fixtures.
Approved spec: user requested modular integration and public/private release; future main integration must reuse this package.

- [x] Move tested modules and tests into packages/external-playback; adapt current runtime with guarded build anchors.
- [x] Preserve legacy blog embed behavior; support external embeds through a private bridge driven by trusted clicks.
- [x] Preserve userscript name/namespace/update URL. Provide safe settings migration through official preference bridge; prevent coexistence double buttons and playback.
- [x] Wire normal builds and single source settings metadata, update docs and installer checks.
- [x] Test package, main settings, build distribution, browser backgrounds; review changes and publish public/private.

Constraints: no live nicovideo automation; use offline fixtures. Do not post real comments/likes for tests. Never share auth/session or GM transport messages through the DOM. Only public preferences can cross migration boundaries. Keep normal page links unchanged. No third-party-specific handlers.

Validation: 67 package tests, 152 related main/UI/distribution tests, 4 build-integrity tests passed; offline Chrome small/normal background transitions passed. Review caught late legacy detection and closing/startup race; both fixed with pending/active/save-grace regression tests. Existing CommonJS transport adapters remain intact; new controls and lifecycle modules are TypeScript. Public/private publication is the final step.
