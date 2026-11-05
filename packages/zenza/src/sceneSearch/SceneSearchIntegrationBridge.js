// GENERATED FROM tools/typescript-stage1/nico-src/SceneSearchIntegrationBridge.ts
import {SceneSearchDomLease} from './SceneSearchDomLease';
import {SceneSearchLayoutResources} from './SceneSearchLayoutResources';
import {SceneSearchPreferenceConnection} from './SceneSearchPreferenceConnection';
import {SceneSearchObstacleCollector} from './SceneSearchObstacleCollector';
import {SceneSearchVisibleRectCollector} from './SceneSearchVisibleRectCollector';
//===BEGIN===
//@require SceneSearchDomLease
//@require SceneSearchLayoutResources
//@require SceneSearchPreferenceConnection
//@require SceneSearchObstacleCollector
//@require SceneSearchVisibleRectCollector
/** P13-09C: canonical Bridge with typed native DOM, seek and cleanup owners.
 * Legacy player/Config/card factories are dependency-injected JavaScript. Their
 * interop remains explicitly scoped, never presented as fully strict typed.
 */
class SceneSearchIntegrationBridge {
    constructor({ classes, document, container, seekElement, commentPreviewElement, legacyTooltipElement, getThumbnailElement, config, registry, clock, layoutSettings, getChats, getSeekTime, onSeekRelative, onSeekAbsolute, loadPreview, onError, createCommentList } = {}) {
        if (!document || !container || !seekElement || !config || !registry ||
            typeof config.getValue !== 'function' || typeof config.setValue !== 'function' ||
            typeof onSeekRelative !== 'function' || typeof onSeekAbsolute !== 'function') {
            throw new TypeError('Scene search integration requires DOM, config, registry and seek callbacks');
        }
        const required = ['Controller', 'Interaction', 'IdleLimiter', 'SeekStepControl',
            'CommentSearch', 'CommentSearchPanel', 'ShortcutRouter', 'VisibilityRegistry'];
        if (!classes || required.some(name => typeof classes[name] !== 'function' &&
            !(name === 'VisibilityRegistry' && typeof classes[name]?.connect === 'function'))) {
            throw new TypeError('Missing scene-search integration dependencies');
        }
        this.document = document;
        this.container = container;
        this.seekElement = seekElement;
        // Pointer coordinates are measured against the real seekbar, not against
        // the video duration or the width of the whole player container.
        this._seekClientX = null;
        this._commentPreviewElement = commentPreviewElement || null;
        this._commentPreviewOriginal = null;
        this._commentDock = null;
        this._createCommentList = createCommentList || null;
        this._twinList = null;
        this._twinListCleanup = null;
        this._commentHoverCleanup = null;
        this._legacyTooltipElement = legacyTooltipElement || null;
        this._legacyTooltipOriginal = null;
        this._getThumbnailElement = typeof getThumbnailElement === 'function' ?
            getThumbnailElement : null;
        this._sharedThumbnail = null;
        this.config = config;
        this.registry = registry;
        this.layoutSettings = { ...(layoutSettings || {}),
            getSeekGeometry: () => this._getSeekGeometry(),
            getSeekGeometryUnclipped: () => this._getSeekGeometry(true),
            getLegacyTooltip: () => this._legacyTooltipElement,
            getLegacyComment: () => this._commentPreviewElement,
            getMiniCommentMode: () => this.config.getValue('sceneSearch.miniCommentMode'),
            ...(config.resolveSceneSearch ? { getAppearance: () => config.resolveSceneSearch() } : {}),
            getThumbnail: () => this._getThumbnailElement?.(),
            getSeekBarContainer: () => this.seekElement.closest?.('.seekBarContainer') || null };
        this._clock = clock || null;
        this._classes = classes;
        this._getChats = typeof getChats === 'function' ? getChats : () => [];
        this._getSeekTime = typeof getSeekTime === 'function' ? getSeekTime : null;
        this._onSeekRelative = onSeekRelative;
        this._onSeekAbsolute = onSeekAbsolute;
        this._onError = typeof onError === 'function' ? onError : () => { };
        this._cleanup = new SceneSearchLayoutResources((error, key) => this._onError(error, key));
        this._active = null;
        this._cardCleanup = null;
        this._visibility = null;
        this._subscriptions = [];
        this._running = false;
        this._disposed = false;
        this._style = null;
        this._placementContext = 'normal';
        this._placementGeometry = null;
        this._placementHold = false;
        this._seekListeners = {
            mouseenter: e => {
                if (this._disposed)
                    return;
                this._seekClientX = Number.isFinite(e?.clientX) ? e.clientX : null;
                this.interaction.seekEnter(e);
            },
            mousemove: e => {
                if (this._disposed)
                    return;
                this._seekClientX = Number.isFinite(e?.clientX) ? e.clientX : null;
                this.interaction.seekMove(e);
                const seconds = this._getSeekTime?.(e);
                if (Number.isFinite(seconds) && seconds >= 0) {
                    this.controller.setTime(seconds);
                }
            },
            mouseleave: e => {
                if (this._disposed)
                    return;
                this.interaction.seekLeave(e);
                // Retain the last seek anchor while travelling to preview controls.
            },
            pointerdown: e => this._startPointer(e)
        };
        this.controller = new classes.Controller({
            getPreference: (key) => config.getValue(key),
            resolvePreferences: config.resolveSceneSearch ? () => config.resolveSceneSearch() : null,
            createLayout: ({ id, mode }) => this._createLayout({ id, mode }),
            loadPreview: loadPreview || null,
            onSeek: (delta) => this._onSeekRelative(delta),
            onError: (error, key) => this._onError(error, key)
        });
        this.commentSearch = new classes.CommentSearch({
            getChats: () => this._getChats(),
            getVideoId: () => this.controller.snapshot.videoId,
            seekTo: (seconds) => this._onSeekAbsolute(seconds)
        });
        this.idleLimiter = new classes.IdleLimiter({
            controller: this.controller,
            getSeconds: () => config.getValue('sceneSearch.idleHideSeconds'),
            clock: this._clock || undefined,
            onIdleHidden: (hidden) => this._active?.root?.classList.toggle('is-idle-suppressed', hidden)
        });
        this.interaction = new classes.Interaction({
            controller: this.controller,
            getPreviewRect: () => this._previewRects(),
            subscribePointerMove: (listener) => {
                document.addEventListener('mousemove', listener, true);
                return () => document.removeEventListener('mousemove', listener, true);
            },
            clock: this._clock || undefined,
            idleLimiter: this.idleLimiter
        });
        this.router = new classes.ShortcutRouter({
            controller: this.controller, interaction: this.interaction,
            getPreference: (key) => config.getValue(key),
            setPreference: (key, value) => key.startsWith('sceneSearch.') && typeof config.persistSceneSearchSelection === 'function' ?
                config.persistSceneSearchSelection({ [key]: value }) : config.setValue(key, value),
            onToggleControls: () => this._active?.root?.classList.toggle('is-expanded'),
            onError: (error, key) => this._onError(error, key)
        });
    }
    _getSeekGeometry(unclipped = false) {
        // One typed, read-only geometry owner for preview and seek surfaces.
        return SceneSearchVisibleRectCollector.seekGeometry({
            seekElement: this.seekElement, container: this.container,
            document: this.document, pointerClientX: this._seekClientX, unclipped
        });
    }
    _startPointer(e) {
        if (this._disposed) {
            return;
        }
        // Only interaction owns the native pointer ID set and document capture.
        this.interaction.startNativePointer(e, this.document, () => this._clearPointers());
    }
    _clearPointers() {
        const active = this.interaction.clearNativePointers();
        if (active || this._running) {
            this.interaction.setDragging(false);
            this._resumePlacement();
        }
    }
    _createLayout({ id, mode }) {
        // Finish old native returns before a replacement view captures its owners.
        this._cleanup.retry();
        this._placementGeometry = null;
        this._placementResult = null;
        if (id === 'follow' || id === 'fixed')
            return this._createModernLayout({ id, mode });
        if (id === 'legacy')
            id = '00';
        const card = this.registry.create({ id, mode, document: this.document,
            container: this.container, settings: this.layoutSettings,
            onAction: (action, ctx, event) => this._onCardAction(action, ctx, event) });
        let layoutDisposed = false;
        const wired = {
            get root() { return card.root; },
            mount: (state) => {
                try {
                    if (id === '00') {
                        this._restoreSharedThumbnail();
                        this._restoreCommentPreviewDock();
                        this._restoreLegacyTooltip();
                    }
                    card.mount(state);
                    if (id === '00') {
                        this._active = card;
                        this._mountLegacyControls(card);
                        return;
                    }
                    this._active = card;
                    this._hideLegacyTooltip();
                    if (id !== '01' && id !== '02') {
                        this.container.dataset.sceneSearchLayout = id;
                        this.container.dataset.sceneMode = mode;
                    }
                    this._mountCardControls(card);
                }
                catch (error) {
                    wired.dispose();
                    throw error;
                }
            },
            renderTime: (state) => wired.render(state, true),
            render: (state, timeOnly = false) => {
                if (this._disposed)
                    return;
                card.render(state);
                if (id === '00')
                    return; // Original tooltip/comment renderer owns UI00.
                // The original VideoControlBar already advances flowing mini rows
                // on mousemove. Leave its DOM untouched on time-only renders. A
                // separately docked list still needs the card's updated position.
                if (!timeOnly || state.commentListMode === true) {
                    this._syncCommentPreviewDock(card, state);
                }
                if (id === '02') {
                    const player = this.container.getBoundingClientRect?.();
                    const windowHeight = this.document.defaultView?.innerHeight;
                    const width = player?.width || this.container.clientWidth || 800;
                    const room = Number.isFinite(windowHeight) && Number.isFinite(player?.bottom) ?
                        windowHeight - player.bottom : 0;
                    const enough = mode === 'normal' && room >= 230;
                    this.container.dataset.scenePlacement = enough ? 'below' : 'visible-fallback';
                    this._updateTwinCommentPlacement(enough, player);
                }
                if (id !== '01' && id !== '02') {
                    const width = this.container.offsetWidth ||
                        this.container.getBoundingClientRect?.().width ||
                        this.container.clientWidth || 800;
                    this.container.dataset.sceneNarrow = String(width < 580);
                    this.container.dataset.sceneWide = String(width >= 980);
                    this.container.dataset.scenePlacement =
                        card.root?.dataset.scuiPlacement || 'overlay';
                    if (id === '10') {
                        const raw = Number.parseFloat(card.root?.style.getPropertyValue('--scene-x'));
                        this.container.dataset.sceneCommentSide = Number.isFinite(raw) &&
                            raw > width * .55 ? 'left' : 'right';
                    }
                }
                if (!timeOnly)
                    this._visibility?.refresh?.();
                if (card.root && !timeOnly) {
                    const reveal = this.config.getValue('sceneSearch.controlsReveal');
                    const animation = this.config.getValue('sceneSearch.animation');
                    card.root.dataset.sceneReveal = ['click', 'always'].includes(reveal) ? reveal : 'hover-focus';
                    card.root.dataset.sceneAnimation = ['off', 'full'].includes(animation) ? animation : 'subtle';
                }
            },
            onPreview: (asset, request) => {
                if (this._disposed || id === '00')
                    return; // Existing seekbar still owns storyboard canvas.
                card.onPreview?.(asset, request);
                if (this._sharedThumbnail?.node && card.root?.contains(this._sharedThumbnail.node)) {
                    const slot = card.root.querySelector('.zenzaSceneImageBox');
                    if (slot) {
                        const image = slot.querySelector('.zenzaSceneImage');
                        const placeholder = slot.querySelector('.zenzaSceneImagePlaceholder');
                        if (image) {
                            image.hidden = true;
                        }
                        if (placeholder) {
                            placeholder.hidden = true;
                        }
                    }
                }
            },
            dispose: () => {
                if (layoutDisposed)
                    return;
                layoutDisposed = true;
                this._releaseCard(card);
                this._cleanup.release(() => card.dispose(), 'scene-layout-' + id);
                if (id === '00')
                    return;
                if (id === '02') {
                    delete this.container.dataset.scenePlacement;
                    this.container.style.removeProperty('--scui-twin-comment-top');
                }
                if (id !== '01' && id !== '02' &&
                    this.container.dataset.sceneSearchLayout === id) {
                    delete this.container.dataset.sceneSearchLayout;
                    delete this.container.dataset.sceneMode;
                    delete this.container.dataset.sceneNarrow;
                    delete this.container.dataset.sceneWide;
                    delete this.container.dataset.scenePlacement;
                    delete this.container.dataset.sceneCommentSide;
                }
            }
        };
        return wired;
    }
    _createModernLayout({ id, mode }) {
        const d = this.document, portal = d.createElement('div');
        // The native player disables input/animation on non-player body children.
        // This portal owns player controls even when it is outside the dialog DOM.
        portal.className = 'zenzaScenePreviewPortal zen-family';
        portal.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;';
        // Native row actions (seek / NG) still enter the original player dispatcher.
        portal.addEventListener('command', event => {
            event.stopPropagation();
            this.container.dispatchEvent(new d.defaultView.CustomEvent('command', { detail: event.detail, bubbles: true, composed: true }));
        });
        let card;
        try {
            (d.fullscreenElement || d.body).append(portal);
            card = this.registry.create({ id, mode, document: d, container: portal, settings: this.layoutSettings,
                onAction: (action, ctx, event) => this._onCardAction(action, ctx, event) });
        }
        catch (error) {
            this._cleanup.release(() => portal.remove(), 'scene-preview-portal');
            throw error;
        }
        let list = null, layoutDisposed = false;
        const dispose = () => {
            if (layoutDisposed)
                return;
            layoutDisposed = true;
            this._releaseCard(card);
            this._cleanup.release(() => card.dispose(), 'scene-layout-' + id);
            this._cleanup.release(() => portal.remove(), 'scene-preview-portal');
            if (this._modernPortal === portal)
                this._modernPortal = null;
            this._placementResult = null;
            this._placementGeometry = null;
        };
        const render = (state) => {
            if (this._disposed)
                return;
            const prefs = this.config.resolveSceneSearch();
            if (prefs.listOpen && !list && this._createCommentList) {
                const candidate = this._createCommentList(portal);
                try {
                    card.setListView(candidate);
                    list = candidate;
                }
                catch (error) {
                    if (candidate)
                        this._cleanup.release(() => candidate.dispose(), 'scene-new-comment-list');
                    dispose();
                    throw error;
                }
            }
            const returnListFocus = !prefs.listOpen && card.root?.querySelector('.zenzaSceneListSlot')?.contains(d.activeElement);
            if (!prefs.listOpen)
                this._commentPanel?.close();
            card.render({ ...state, ...prefs });
            if (returnListFocus)
                card.root.querySelector('[data-scui-action="comment-toggle"]')?.focus();
            if (card.root) {
                card.root.dataset.sceneReveal = this.config.getValue('sceneSearch.controlsReveal') || 'hover-focus';
                card.root.dataset.sceneAnimation = this.config.getValue('sceneSearch.animation') || 'subtle';
            }
            this._visibility?.refresh?.();
            this._placeModern(card, state);
            if (!state.shown && !state.pinned)
                this.interaction?.clearCorridor?.();
        };
        return { get root() { return card.root; },
            mount: () => {
                try {
                    card.mount();
                    this._active = card;
                    this._modernPortal = portal;
                    this._hideLegacyTooltip();
                    this._mountCardControls(card);
                }
                catch (error) {
                    dispose();
                    throw error;
                }
            },
            render, renderTime: render, onPreview: () => this.refreshSharedThumbnail(),
            dispose };
    }
    updatePlacementContext({ context = 'normal', interactionActive = false } = {}) {
        if (this._disposed)
            return;
        this._placementContext = ['normal', 'small', 'fullscreen'].includes(context) ? context : 'normal';
        this._placementHold = interactionActive;
        this._placementGeometry = null;
        this.idleLimiter.pause('player-manipulation', interactionActive);
        if (this._active?.fit)
            this._placeModern(this._active, this.controller.snapshot);
    }
    _placeModern(card, state) {
        if (!card.root || !this._classes.Placement)
            return;
        const d = this.document, win = d.defaultView, portal = this._modernPortal;
        const parent = d.fullscreenElement || d.body;
        if (portal && portal.parentNode !== parent)
            parent.append(portal);
        if (!this._placementGeometry) {
            const player = (this.container.querySelector('.videoPlayer') || this.container).getBoundingClientRect();
            const seekbar = this.seekElement.getBoundingClientRect();
            const fullscreen = this._placementContext === 'fullscreen' || !!d.fullscreenElement;
            // Geometry is in post-transform client coordinates. Keep the native
            // toolbar and popups intact; only visible, actionable/painted portions
            // become obstacles. This is sampled on invalidation, not mousemove.
            const { obstacles, controlTops } = SceneSearchObstacleCollector.collect({
                document: d, container: this.container, fullscreen
            });
            const seekBottom = Number.isFinite(seekbar.bottom) ? seekbar.bottom : seekbar.top + seekbar.height;
            const seekWrap = this.seekElement.closest?.('.seekBarContainer');
            const wrapRect = seekWrap?.getBoundingClientRect?.();
            const wrapScale = wrapRect?.width > 0 && seekWrap?.offsetWidth > 0 ?
                wrapRect.width / seekWrap.offsetWidth : 1;
            let previewAnchorTop = !fullscreen && Number.isFinite(wrapRect?.top) ?
                wrapRect.top - 14 * wrapScale : seekBottom - 24;
            // In fullscreen anchor against the actual buttons, not their often
            // oversized transparent wrappers (Issue #3 / Task951, Task956).
            if (fullscreen && controlTops.length) {
                previewAnchorTop = Math.min(previewAnchorTop, ...controlTops);
            }
            const origin = portal?.getBoundingClientRect() || { left: 0, top: 0, width: 0, height: 0 };
            this._placementGeometry = { player, seekbar, obstacles, origin, previewAnchorTop,
                viewport: { left: 0, top: 0, width: win.innerWidth, height: win.innerHeight } };
        }
        const g = this._placementGeometry, prefs = this.config.resolveSceneSearch();
        const hold = this._placementHold || state.pinned || this.interaction?.holdingPreview === true;
        const input = { ...g, layout: state.layoutId, context: this._placementContext,
            imageSize: { width: 180, height: 90 }, requestedScale: prefs.scale, listOpen: prefs.listOpen, listScale: prefs.listScale,
            anchorX: this._seekClientX ?? g.seekbar.left + g.seekbar.width / 2, previous: this._placementResult, hold,
            // Constant footer reserve keeps the preview box's height and bottom
            // edge stable while time labels and buttons change during seeking.
            footerHeight: 64 };
        try {
            const result = this._classes.Placement.compute(input);
            // Modern factory or the caller's fit guard establishes this capability.
            card.fit(result);
            const x = g.origin.width && portal?.clientWidth ? portal.clientWidth / g.origin.width : 1;
            const y = g.origin.height && portal?.clientHeight ? portal.clientHeight / g.origin.height : 1;
            card.root.style.left = (result.rect.left - g.origin.left) * x + 'px';
            card.root.style.top = (result.rect.top - g.origin.top) * y + 'px';
            card.root.style.width = result.rect.width + 'px';
            card.root.style.height = result.rect.height + 'px';
            card.root.style.transformOrigin = '0 0';
            card.root.style.transform = 'scale(' + x + ',' + y + ')';
            card.root.dataset.sceneContext = this._placementContext;
            this._placementResult = result;
        }
        catch (error) {
            // A partial fit is not a valid cached placement. The next observation
            // must recalculate obstacles, then the owning layout can recover/dispose.
            this._placementGeometry = null;
            this._placementResult = null;
            throw error;
        }
    }
    _updateTwinCommentPlacement(below, player) {
        if (!below || !player) {
            this.container.style.removeProperty('--scui-twin-comment-top');
            return;
        }
        const comment = this._twinList?.element || this._commentPreviewElement;
        const owner = (comment?.offsetParent || comment?.parentElement);
        const origin = owner?.getBoundingClientRect?.();
        if (!origin || !Number.isFinite(origin.top) || !Number.isFinite(player.bottom)) {
            return;
        }
        const scale = origin.width && owner.offsetWidth ?
            owner.offsetWidth / origin.width : 1;
        const top = (player.bottom - origin.top) * scale + 15;
        if (Number.isFinite(top)) {
            this.container.style.setProperty('--scui-twin-comment-top', Math.round(Math.max(0, top)) + 'px');
        }
    }
    _onCardAction(action, context) {
        if (action === 'more') {
            this._resumePlacement();
            return;
        }
        if (action === 'comment-toggle') {
            if (this.config.resolveSceneSearch?.()?.listAllowed === false)
                return;
            // Legacy tooltip button selects flowing/list mode, NOT global visibility.
            this.config.setValue('enableCommentPreview', this.config.getValue('enableCommentPreview') !== true);
            this.controller.onPreferencesChanged('enableCommentPreview');
            return;
        }
        if (action === 'frame-seek') {
            const seconds = context?.time;
            if (!Number.isFinite(seconds) || seconds < 0) {
                return;
            }
            const duration = typeof this.layoutSettings.getDuration === 'function' ?
                this.layoutSettings.getDuration() : this.layoutSettings.duration;
            this._onSeekAbsolute(Number.isFinite(duration) && duration > 0 ?
                Math.min(seconds, duration) : seconds);
            return;
        }
        const commands = {
            'seek-back': 'sceneSearch-seekBack',
            'seek-forward': 'sceneSearch-seekForward',
            pin: 'sceneSearch-togglePin',
            'comment-search': 'sceneSearch-toggleCommentSearch'
        };
        if (action === 'seek-step') {
            this._stepWidget?.openMenu();
            return;
        }
        if (commands[action]) {
            this.router.handle(commands[action]);
        }
    }
    _mountCardControls(card) {
        const root = card.root;
        if (!root) {
            throw new Error('Cannot wire unmounted scene card');
        }
        const classNames = {
            pin: 'zenzaSceneSearchPin',
            'comment-toggle': 'zenzaSceneCommentToggle',
            'comment-search': 'zenzaSceneCommentSearchToggle',
            more: 'zenzaSceneSearchMore'
        };
        for (const [action, css] of Object.entries(classNames)) {
            root.querySelector('[data-scui-action="' + action + '"]')?.classList.add(css);
        }
        const actionList = root.querySelector('.zenzaSceneActions');
        if (!actionList) {
            throw new Error('Scene controls missing');
        }
        if (root.dataset.layout === '02') {
            // Keep the expander accessible when the twin-panel action tray is
            // collapsed below the preview card. Do not edit Task532's provider.
            const foot = root.querySelector('.zenzaSceneFoot');
            const more = actionList.querySelector('.scene-more');
            if (foot && more)
                foot.insertBefore(more, actionList);
        }
        actionList.classList.add('zenzaSceneSeekStepControl');
        for (const [action, tag] of [
            ['seek-back', 'back'], ['seek-forward', 'forward'], ['seek-step', 'open']
        ]) {
            const button = root.querySelector('[data-scui-action="' + action + '"]');
            if (button) {
                button.dataset.scui = tag;
            }
        }
        const C = this._classes;
        const step = new C.SeekStepControl({
            document: this.document,
            getSeconds: () => this.config.getValue('sceneSearch.seekStepSeconds'),
            setSeconds: (value) => {
                this.config.setValue('sceneSearch.seekStepSeconds', value);
                this.controller.onPreferencesChanged('sceneSearch.seekStepSeconds');
            },
            onSeek: (delta) => this._onSeekRelative(delta),
            onCompactChange: () => this.controller.onPreferencesChanged('sceneSearch.seekStepSeconds'),
            onMenuChange: (open) => {
                if (this._disposed) {
                    return;
                }
                this.idleLimiter.pause('step-menu', open);
                if (open) {
                    this.interaction.previewEnter('step-menu');
                }
                else {
                    this.interaction.previewLeave('step-menu');
                    // Some DOM hosts retain activeElement inside a newly hidden popup.
                    // Release only that stale focus, preserving any visible control.
                    const focused = this.document.activeElement;
                    if (root.contains(focused) && focused.closest('[hidden]')) {
                        this.interaction.previewFocus(false, root);
                    }
                }
            },
            onError: (error) => this._onError(error, 'sceneSearch.seekStepSeconds')
        });
        const modern = root.classList.contains('zenzaSceneSharedPreview');
        // Modern controls use the shared seek commands; seconds stay in settings.
        // Retain the step model for existing keyboard shortcuts, without its popup.
        this._stepWidget = step;
        if (modern)
            step.updateFromConfig();
        else
            step.mount(actionList);
        const searchPanel = new C.CommentSearchPanel({
            document: this.document, search: this.commentSearch,
            onOpenChange: (open) => {
                const button = root.querySelector('[data-scui-action="comment-search"]');
                button?.setAttribute('aria-expanded', String(open));
                if (!open && searchPanel.root?.contains(this.document.activeElement))
                    button?.focus();
            }
        });
        this._commentPanel = searchPanel;
        searchPanel.mount(modern ? root.querySelector('.zenzaSceneListSlot') : root);
        this.router.seekStepControl = step;
        this.router.commentSearchPanel = modern ? { toggle: () => {
                if (this.config.resolveSceneSearch().listAllowed === false)
                    return;
                if (this.config.getValue('enableCommentPreview') !== true)
                    this.config.setValue('enableCommentPreview', true);
                searchPanel.toggle();
            } } : searchPanel;
        this._cardCleanup = this._bindPreviewSurface(root);
        this._visibility = C.VisibilityRegistry.connect(this.config, root, 'scene');
        this.refreshSharedThumbnail();
    }
    _mountLegacyControls(card) {
        // UI00 deliberately has no new scene card. Its native seek tooltip
        // buttons and the separate scrollable CommentPreview are still controls:
        // hovering/focusing either must pause BOTH leave/corridor and idle timers.
        const nodes = [card?.root, this._commentPreviewElement].filter(Boolean);
        let hovered = false, focused = false, active = false, retired = false;
        const owns = (node) => nodes.some(root => root === node ||
            !!node && 'nodeType' in node && root.contains(node));
        const sync = () => {
            const next = hovered || focused;
            if (next === active)
                return;
            active = next;
            if (next)
                this.interaction.previewEnter();
            else
                this.interaction.previewLeave();
        };
        const onEnter = () => { hovered = true; sync(); };
        const onLeave = (e) => {
            if (owns(e?.relatedTarget))
                return;
            hovered = false;
            sync();
        };
        const onFocusIn = () => { focused = true; sync(); };
        const onFocusOut = (e) => {
            if (owns(e?.relatedTarget))
                return;
            focused = false;
            sync();
        };
        const bindings = [
            ['mouseenter', onEnter], ['mouseleave', onLeave],
            ['focusin', onFocusIn], ['focusout', onFocusOut]
        ]
            .map(([event, handler]) => [event, (e) => {
                if (!retired && !this._disposed)
                    handler(e);
            }]);
        this._cardCleanup = () => {
            retired = true;
            for (const node of nodes)
                for (const [key, handler] of bindings) {
                    this._cleanup.release(() => node.removeEventListener(key, handler), 'scene-legacy-events');
                }
            if (active) {
                active = false;
                this._cleanup.release(() => this.interaction.previewLeave(), 'scene-legacy-hover');
            }
        };
        for (const node of nodes)
            for (const [key, handler] of bindings)
                node.addEventListener(key, handler);
    }
    _releaseCard(card) {
        if (this._active !== card) {
            return;
        }
        this._restoreSharedThumbnail();
        this._restoreCommentPreviewDock();
        this._restoreLegacyTooltip();
        // Detach the references first. Pending disposers retain their own resource,
        // so a retry can never act on controls belonging to a replacement card.
        const cleanup = this._cardCleanup, visibility = this._visibility;
        const panel = this._commentPanel, step = this._stepWidget;
        this._cardCleanup = null;
        this._visibility = null;
        this._commentPanel = null;
        this._stepWidget = null;
        this.router.seekStepControl = null;
        this.router.commentSearchPanel = null;
        this._active = null;
        if (cleanup)
            this._cleanup.release(cleanup, 'scene-card-events');
        if (visibility)
            this._cleanup.release(() => visibility.dispose?.(), 'scene-card-visibility');
        if (panel)
            this._cleanup.release(() => panel.dispose(), 'scene-comment-search');
        if (step)
            this._cleanup.release(() => step.dispose(), 'scene-seek-step');
    }
    refreshSharedThumbnail() {
        if (this._disposed)
            return false;
        this._cleanup.retry();
        if (this._active?.setImage) {
            try {
                this._active.setImage(this._getThumbnailElement?.() || null);
                return true;
            }
            catch (error) {
                this._onError(error, 'existing-seek-thumbnail');
                return false;
            }
        }
        if (['00', 'legacy'].includes(this.controller.snapshot.layoutId)) {
            // Native UI00 may acquire its flowing comments after the Canvas arrives.
            this._active?.render?.(this.controller.snapshot);
            return false;
        }
        if (this.controller.snapshot.layoutId === '07') {
            this.controller.onPreferencesChanged('sceneSearch.idleHideSeconds');
        }
        if (!this._active?.root || !this._getThumbnailElement)
            return false;
        let node;
        try {
            node = this._getThumbnailElement();
        }
        catch (error) {
            this._restoreSharedThumbnail();
            this._hideLegacyTooltip();
            this._onError(error, 'existing-seek-thumbnail');
            return false;
        }
        if (!node || !node.parentNode) {
            this._restoreSharedThumbnail();
            this._hideLegacyTooltip();
            return false;
        }
        const slot = this._active.root.querySelector('.zenzaSceneImageBox');
        if (!slot)
            return false;
        if (this._sharedThumbnail?.node === node && slot.contains(node))
            return true;
        if (!node.querySelector?.('canvas'))
            return false;
        this._restoreSharedThumbnail();
        try {
            // Register the return record before the first fallible DOM mutation.
            this._sharedThumbnail = new SceneSearchDomLease(node, { position: true });
            this._sharedThumbnail.moveTo(slot);
            slot.querySelector('.zenzaSceneImage')?.setAttribute('hidden', '');
            slot.querySelector('.zenzaSceneImagePlaceholder')?.setAttribute('hidden', '');
            this._hideLegacyTooltip();
            return true;
        }
        catch (error) {
            this._restoreSharedThumbnail();
            this._onError(error, 'existing-seek-thumbnail');
            return false;
        }
    }
    _restoreSharedThumbnail() {
        const old = this._sharedThumbnail;
        if (!old)
            return;
        this._sharedThumbnail = null;
        this._cleanup.release(() => old.restore(), 'scene-thumbnail-return');
        const slot = this._active?.root?.querySelector('.zenzaSceneImageBox');
        const image = slot?.querySelector('.zenzaSceneImage');
        const placeholder = slot?.querySelector('.zenzaSceneImagePlaceholder');
        const hasImage = !!image?.getAttribute('src');
        if (image)
            image.hidden = !hasImage;
        if (placeholder)
            placeholder.hidden = hasImage;
    }
    _hideLegacyTooltip() {
        const tooltip = this._legacyTooltipElement;
        if (!tooltip?.style || this._legacyTooltipOriginal)
            return;
        if (!this._cleanup.retry('scene-legacy-tooltip-return')) {
            throw new Error('Native tooltip return is still pending');
        }
        this._legacyTooltipOriginal = new SceneSearchDomLease(tooltip, { styles: ['display'], hidden: true });
        tooltip.hidden = true;
        tooltip.style.setProperty('display', 'none', 'important');
    }
    _restoreLegacyTooltip() {
        const previous = this._legacyTooltipOriginal;
        this._legacyTooltipOriginal = null;
        if (previous)
            this._cleanup.release(() => previous.restore(), 'scene-legacy-tooltip-return');
    }
    _resumePlacement() {
        if (!this._disposed && this._active?.fit)
            this._placeModern(this._active, this.controller.snapshot);
    }
    _bindPreviewSurface(node) {
        let pointerFocus = false, retired = false;
        const enter = () => { this.interaction.previewEnter(node); this._resumePlacement(); };
        const leave = (e) => {
            const active = this.document.activeElement;
            // Clicked buttons retain DOM focus after the mouse leaves. That is not
            // continued keyboard interaction and must not freeze following or idle.
            // Editable search fields and keyboard navigation keep their focus hold.
            const editing = active?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
            if (pointerFocus && node.contains(active) && !editing) {
                active.blur?.();
                this.interaction.previewFocus(false, node);
            }
            this.interaction.previewLeave(node, e);
            this._resumePlacement();
        };
        const focus = () => { this.interaction.previewFocus(true, node); this._resumePlacement(); };
        const blur = (e) => {
            // relatedTarget may be Window/another non-Node EventTarget. It cannot
            // belong to this DOM surface and must release, not strand, focus hold.
            const target = e.relatedTarget;
            if (!target || !('nodeType' in target) || !node.contains(target)) {
                this.interaction.previewFocus(false, node);
                this._resumePlacement();
            }
        };
        const pointer = (e) => { pointerFocus = true; this._startPointer(e); };
        const keyboard = () => { pointerFocus = false; };
        // Tab may arrive from outside this surface. All registrations share the
        // same rollback path, including an addEventListener that throws midway.
        const bindings = [
            [this.document, 'keydown', keyboard, true],
            ...[['mouseenter', enter], ['mouseleave', leave], ['focusin', focus], ['focusout', blur],
                ['pointerdown', pointer]]
                .map(([event, fn]) => [node, event, fn, false])
        ]
            .map(([target, event, fn, capture]) => [target, event, (e) => {
                if (!retired && !this._disposed)
                    fn(e);
            }, capture]);
        const cleanup = () => {
            // A failed listener removal must not keep an old layout's scope alive.
            retired = true;
            for (const [target, event, fn, capture] of bindings) {
                this._cleanup.release(() => target.removeEventListener(event, fn, capture), 'scene-preview-events');
            }
            this._cleanup.release(() => this.interaction.previewLeave(node), 'scene-preview-hover');
            this._cleanup.release(() => this.interaction.previewFocus(false, node), 'scene-preview-focus');
        };
        try {
            for (const [target, event, fn, capture] of bindings)
                target.addEventListener(event, fn, capture);
        }
        catch (error) {
            cleanup();
            throw error;
        }
        return cleanup;
    }
    _restoreTwinList() {
        const handle = this._twinList, cleanup = this._twinListCleanup;
        this._twinList = null;
        this._twinListCleanup = null;
        if (cleanup)
            this._cleanup.release(cleanup, 'scene-twin-list-events');
        if (handle)
            this._cleanup.release(() => {
                handle.element?.classList.remove('is-scui-active');
                handle.dispose();
            }, 'scene-twin-list');
    }
    _previewRects() {
        if (this._active?.getRects)
            return this._active.getRects();
        return SceneSearchVisibleRectCollector.collect({
            root: this._active?.root,
            comment: this._commentPreviewElement,
            twin: this._twinList?.element,
            document: this.document
        });
    }
    _syncCommentPreviewDock(card, state) {
        const node = this._commentPreviewElement, root = card?.root;
        if (this._disposed || !node || !root)
            return;
        try {
            if (!this._commentDock) {
                // CommentPreviewView normally inherits the *player* typography.
                // Modern scene cards use 12px system-ui: reparenting its original DOM
                // silently changed every 16px mini row and broke alignment/CA spaces.
                // Snapshot the native computed typography BEFORE the first move.
                const computed = this.document.defaultView?.getComputedStyle?.(node);
                const props = SceneSearchDomLease.typography;
                const typography = props.map(name => ({ name, native: computed?.getPropertyValue(name) || '' }));
                this._commentDock = { typography, lease: new SceneSearchDomLease(node, {
                        position: true, styles: props, classes: ['zenzaSceneCommentAttached', 'is-scui-flow',
                            'is-scui-list', 'is-scui-active', 'is-scui-classic-side']
                    }) };
                for (const { name, native } of typography) {
                    if (native)
                        node.style.setProperty(name, native);
                }
                this._commentHoverCleanup = this._bindPreviewSurface(node);
            }
            const listRequested = this.config.getValue('enableCommentPreview') === true;
            const twin = root.dataset.layout === '02' && typeof this._createCommentList === 'function';
            if (twin && listRequested && !this._twinList) {
                this._twinList = this._createCommentList(this.container) || null;
                if (this._twinList?.element) {
                    const panel = this._twinList.element;
                    panel.classList.add('zenzaSceneTwinList', 'zenzaSceneCommentAttached', 'is-scui-list');
                    panel.tabIndex = 0;
                    panel.setAttribute('aria-label', 'シーンのコメント一覧');
                    for (const { name, native } of this._commentDock.typography || []) {
                        if (native)
                            panel.style.setProperty(name, native);
                    }
                    this._twinListCleanup = this._bindPreviewSurface(panel);
                }
            }
            if (!listRequested)
                this._restoreTwinList();
            const list = listRequested && !(twin && this._twinList);
            const classic = root.dataset.layout === '01';
            // Task728: the ORIGINAL CommentPreviewView flows ON TOP of the
            // storyboard image in UI01. ONLY the scrollable LIST moves to the right
            // sibling pane. Never clone native chat rows or replace their animation.
            const image = root.querySelector('.zenzaSceneImageBox');
            const target = classic ? (list ? root : image) :
                list ? this.container : image;
            if (target && node.parentNode !== target)
                this._commentDock.lease.moveTo(target);
            node.classList.add('zenzaSceneCommentAttached');
            node.classList.toggle('is-scui-list', list);
            node.classList.toggle('is-scui-flow', !list);
            node.classList.toggle('is-scui-classic-side', classic && list);
            const active = (state?.shown !== false || state?.pinned === true) &&
                this.config.getValue('sceneSearch.commentPreviewVisible') !== false &&
                !root.classList.contains('is-idle-suppressed');
            node.classList.toggle('is-scui-active', active);
            if (this._twinList?.element) {
                this._twinList.element.classList.toggle('is-scui-active', active && listRequested);
            }
            if (twin) {
                const toggle = root.querySelector('[data-scui-action="comment-toggle"]');
                const label = listRequested ? 'コメント一覧を閉じる' : 'コメント一覧を表示';
                toggle?.setAttribute('aria-label', label);
                toggle?.setAttribute('title', label);
                toggle?.setAttribute('aria-expanded', String(listRequested));
            }
            if (classic) {
                if (list)
                    this._positionClassicCommentSide(root, list);
                else
                    root.dataset.scuiSidePlacement = 'overlay';
            }
            else if (list) {
                const x = Number.parseFloat(root.style.getPropertyValue('--scene-x'));
                if (Number.isFinite(x))
                    this.container.style.setProperty('--scui-list-x', x + 'px');
            }
        }
        catch (error) {
            this._restoreCommentPreviewDock();
            this._onError(error, 'scene-native-comment-dock');
        }
    }
    _positionClassicCommentSide(root, list) {
        const rect = root.getBoundingClientRect?.();
        const viewport = this.document.defaultView?.innerWidth ||
            this.document.documentElement?.clientWidth || 0;
        if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.right) ||
            !Number.isFinite(viewport) || viewport <= 0)
            return;
        const scale = rect.width > 0 && root.offsetWidth > 0 ?
            rect.width / root.offsetWidth : 1;
        // Layout01 precomputes a group clamp and pane width with the SAME
        // viewport geometry. Reuse these values; calculating a second, different
        // clamp here caused the native comment view to leave the right edge.
        const configuredGap = Number.parseFloat(root.style.getPropertyValue('--scui-side-gap'));
        const configuredWidth = Number.parseFloat(root.style.getPropertyValue('--scui-side-width'));
        const gap = Number.isFinite(configuredGap) ? configuredGap : 8;
        const margin = 8;
        const room = (viewport - margin - rect.right - gap * scale) / scale;
        const panelWidth = Number.isFinite(configuredWidth) && configuredWidth > 0 ?
            configuredWidth : Math.min(list ? 350 : 180, Math.max(1, room));
        // Never swap to the left or move above; on the right edge, the entire
        // group stops together while CommentPreviewView retains native owners.
        const cardWidth = rect.width / scale;
        const left = (root.offsetWidth || cardWidth) + gap;
        root.dataset.scuiSidePlacement = 'right';
        root.style.setProperty('--scui-side-left', left.toFixed(2) + 'px');
        root.style.setProperty('--scui-side-width', panelWidth.toFixed(2) + 'px');
        // Flow mode has no independent pane or coordinate offset. Its ORIGINAL
        // CommentPreviewView is positioned directly inside .zenzaSceneImageBox.
    }
    _restoreCommentPreviewDock() {
        this._restoreTwinList();
        const old = this._commentDock, cleanup = this._commentHoverCleanup;
        this._commentDock = null;
        this._commentHoverCleanup = null;
        if (cleanup)
            this._cleanup.release(cleanup, 'scene-native-comment-events');
        if (old)
            this._cleanup.release(() => old.lease.restore(), 'scene-native-comment-return');
        if (old)
            this.container.style.removeProperty('--scui-list-x');
    }
    _syncCommentPreviewVisibility() {
        if (this.config.resolveSceneSearch)
            return; // Effective state belongs to shared view / legacy adapter.
        const node = this._commentPreviewElement;
        if (!node?.style) {
            return;
        }
        const visible = this.config.getValue('sceneSearch.commentPreviewVisible') !== false;
        if (!visible) {
            if (!this._commentPreviewOriginal) {
                // Never snapshot the previous generation's unfinished hidden override.
                if (!this._cleanup.retry('scene-native-comment-visibility'))
                    return;
                this._commentPreviewOriginal = new SceneSearchDomLease(node, { styles: ['display'], hidden: true });
            }
            // CSS :hover can override [hidden]; inline !important is essential.
            node.hidden = true;
            node.style.setProperty('display', 'none', 'important');
        }
        else {
            this._restoreCommentPreviewVisibility();
        }
    }
    _restoreCommentPreviewVisibility() {
        const previous = this._commentPreviewOriginal;
        this._commentPreviewOriginal = null;
        if (previous)
            this._cleanup.release(() => previous.restore(), 'scene-native-comment-visibility');
    }
    static validSavedPreference(key, value) {
        return SceneSearchPreferenceConnection.validSavedPreference(key, value);
    }
    _refreshSavedPreferenceViews(keys) {
        if (this._disposed || !keys.length) {
            return;
        }
        const layoutKey = keys.find(key => key.startsWith('sceneSearch.layout.') || key.startsWith('sceneSearch.presentation.'));
        this.controller.onPreferencesChanged(layoutKey || keys[0]);
        if (keys.includes('sceneSearch.commentPreviewVisible'))
            this._syncCommentPreviewVisibility();
        if (keys.includes('sceneSearch.idleHideSeconds'))
            this.interaction.idlePreferencesChanged();
        if (keys.includes('sceneSearch.seekStepSeconds'))
            this._stepWidget?.updateFromConfig();
    }
    _connectSavedPreferences(keys) {
        const connection = new SceneSearchPreferenceConnection({
            window: this.document.defaultView, config: this.config, keys,
            isDisposed: () => this._disposed,
            onApplying: active => { this._externalSettingsBatch = active; },
            onRefresh: changed => this._refreshSavedPreferenceViews(changed),
            onError: (error) => this._onError(error, 'saved-scene-settings')
        });
        // Keep the disposer before connection: a listener wrapper may install and
        // then throw, and its failed rollback must remain available to Bridge.
        this._savedPreferencesCleanup = () => connection.dispose();
        connection.connect();
    }
    start(mode = 'normal') {
        if (this._disposed) {
            throw new Error('Integration bridge disposed');
        }
        if (this._running) {
            return this.controller.snapshot;
        }
        this._running = true;
        try {
            const style = this.document.createElement('style');
            this._style = style;
            style.dataset.scuiBridgeStyle = '1';
            style.textContent = SceneSearchIntegrationBridge.CSS;
            this.document.head.appendChild(style);
            if (this._disposed)
                return this.controller.snapshot;
            this.controller.start(mode);
            if (this._disposed)
                return this.controller.snapshot;
            for (const [event, handler] of Object.entries(this._seekListeners)) {
                if (this._disposed)
                    return this.controller.snapshot;
                // Match UI00: update follow geometry before the older bubble-phase
                // comment/thumbnail handler. Do not intercept media click ownership.
                this.seekElement.addEventListener(event, handler, event === 'mousemove');
            }
            const keys = ['sceneSearch.presentation.normal', 'sceneSearch.presentation.fullscreen',
                'sceneSearch.enabled', 'sceneSearch.commentListScale', 'sceneSearch.miniCommentVisible', 'sceneSearch.commentListVisible',
                'sceneSearch.thumbnailScale', 'sceneSearch.commentListBackgroundOpacity',
                'sceneSearch.layout.normal', 'sceneSearch.layout.fullscreen',
                'sceneSearch.layout.linkFullscreen', 'sceneSearch.seekStepSeconds',
                'sceneSearch.commentPreviewVisible', 'sceneSearch.miniCommentMode', 'sceneSearch.idleHideSeconds',
                'sceneSearch.controlsReveal', 'sceneSearch.animation', 'enableCommentPreview'];
            if (typeof this.config.onkey === 'function') {
                for (const key of keys) {
                    if (this._disposed)
                        return this.controller.snapshot;
                    const callback = () => {
                        if (this._disposed || this._externalSettingsBatch)
                            return;
                        if (key.startsWith('sceneSearch.presentation.') || key.startsWith('sceneSearch.layout.'))
                            this.interaction.reset();
                        this.controller.onPreferencesChanged(key);
                        if (key === 'sceneSearch.commentPreviewVisible') {
                            this._syncCommentPreviewVisibility();
                        }
                        if (key === 'sceneSearch.idleHideSeconds')
                            this.interaction.idlePreferencesChanged();
                        if (key === 'sceneSearch.seekStepSeconds')
                            this._stepWidget?.updateFromConfig();
                    };
                    this._subscriptions.push([key, callback]);
                    this.config.onkey(key, callback);
                }
            }
            if (this._disposed)
                return this.controller.snapshot;
            this._connectSavedPreferences(keys);
            if (this._disposed)
                return this.controller.snapshot;
            this._syncCommentPreviewVisibility();
        }
        catch (error) {
            this.dispose();
            throw error;
        }
        return this.controller.snapshot;
    }
    setMode(mode) {
        this._clearPointers();
        this.interaction.reset();
        return this.controller.setMode(mode);
    }
    setVideo(videoId) {
        this._clearPointers();
        this.interaction.reset();
        this.commentSearch.reset();
        return this.controller.onVideoChange(videoId);
    }
    setTime(seconds) { return this.controller.setTime(seconds); }
    previewAt(seconds, token) {
        const promise = this.controller.previewAt(seconds);
        return Promise.resolve(promise).then(ok => {
            if (ok && token !== undefined)
                this.interaction.thumbnailChanged(token);
            return ok;
        });
    }
    get state() { return this.controller.snapshot; }
    handleShortcut(command) { return this.router.handle(command); }
    dispose() {
        // Stop acquisition immediately, but keep failed releases available on every
        // subsequent dispose. Idempotence must not discard unfinished native returns.
        if (this._disposed) {
            this._cleanup.retry();
            return;
        }
        this._disposed = true;
        this._cleanup.release(() => this._clearPointers(), 'scene-active-pointers');
        this._restoreCommentPreviewDock();
        const savedCleanup = this._savedPreferencesCleanup;
        this._savedPreferencesCleanup = null;
        if (savedCleanup)
            this._cleanup.release(savedCleanup, 'scene-saved-preferences');
        this._restoreSharedThumbnail();
        this._restoreLegacyTooltip();
        this._restoreCommentPreviewVisibility();
        if (this._running) {
            for (const [event, handler] of Object.entries(this._seekListeners)) {
                this._cleanup.release(() => this.seekElement.removeEventListener(event, handler, event === 'mousemove'), 'scene-seek-events');
            }
        }
        this._cleanup.release(() => this.interaction.dispose(), 'scene-interaction');
        this._cleanup.release(() => this.controller.dispose(), 'scene-controller');
        this._cleanup.release(() => this.commentSearch.dispose(), 'scene-comment-model');
        if (typeof this.config.offkey === 'function') {
            for (const [key, handler] of this._subscriptions) {
                this._cleanup.release(() => this.config.offkey(key, handler), 'scene-config-' + key);
            }
        }
        this._subscriptions.length = 0;
        const style = this._style;
        this._style = null;
        if (style)
            this._cleanup.release(() => style.remove(), 'scene-bridge-style');
        this._placementContext = 'normal';
        this._placementGeometry = null;
        this._placementHold = false;
        this._running = false;
        this._cleanup.retry();
    }
    static get CSS() {
        return `
/* Old seekbar-only hover rules hide previews when the pointer enters a new
   card. Reuse the actual CommentPreviewView node without cloning its data. */
.zenzaSceneSearchHost .zenzaSceneImageBox{position:relative}
.zenzaCommentPreview.zenzaSceneCommentAttached{display:none!important}
.zenzaCommentPreview.zenzaSceneCommentAttached.is-scui-active{display:block!important}
.zenzaSceneSearchHost .zenzaSceneImageBox >.zenzaCommentPreview.is-scui-flow{
  position:absolute!important;inset:0!important;
  left:0!important;right:0!important;top:0!important;bottom:0!important;
  width:100%!important;height:100%!important;max-height:none!important;
  margin:0!important;transform:none!important;overflow:hidden!important;
  /* The original thumbnail is a grid item with z-index:100; keep flowing
     mini-comments above its opaque canvas without changing the card/list layers. */
  z-index:200;background:transparent!important;border:0!important;
  pointer-events:none!important
}
.zenzaSceneSearchHost .zenzaSceneImageBox >.zenzaCommentPreview.is-scui-flow .listContainer{
  width:100%;height:100%;pointer-events:none!important
}
.zenzaCommentPreview.zenzaSceneCommentAttached.is-scui-list{
  position:absolute;z-index:250;max-height:200px;
  pointer-events:auto!important;overflow:auto;transform:none!important
}
/* UI01 FLOW: use the ORIGINAL CommentPreviewView over the actual
   storyboard canvas, not as a right-side sibling. The shared image-box
   absolute-position rule sets inset:0 and z-index:200 above the canvas.
   Preserve UI00's native rows, durations and preview-text-moving animation. */
.zenzaSceneSearchHost.zenzaSceneLayout01 .zenzaSceneImageBox
  >.zenzaCommentPreview.is-scui-flow{
  /* Same bright native UI00 mini, keep its original drop-shadow filter. */
  opacity:1!important;
  background:transparent!important;background-image:none!important;
  border:0!important;box-shadow:none!important;
  pointer-events:none!important
}
.zenzaSceneSearchHost.zenzaSceneLayout01 .zenzaSceneImageBox
  >.zenzaCommentPreview.is-scui-flow .listContainer{
  width:100%!important;height:100%!important;
  background:transparent!important;background-image:none!important;
  box-shadow:none!important
}
.zenzaSceneSearchHost.zenzaSceneLayout01 .zenzaSceneImageBox
  >.zenzaCommentPreview.is-scui-flow .listContainer>.nicoChat .text{
  animation-play-state:running!important
}
/* UI01 LIST only: the SAME native DOM becomes a separate scrollable panel
   to the RIGHT of the scene card. No side reversal or vertical fallback. */
.zenzaSceneSearchHost.zenzaSceneLayout01 >.zenzaCommentPreview.is-scui-classic-side.is-scui-list{
  position:absolute!important;
  left:var(--scui-side-left,calc(100% + 8px))!important;
  right:auto!important;top:auto!important;bottom:0!important;
  width:var(--scui-side-width,350px)!important;
  max-width:calc(100vw - 16px)!important;
  margin:0!important;transform:none!important;box-sizing:border-box;
  z-index:250;
  height:200px!important;max-height:200px!important;
  overflow:auto!important;pointer-events:auto!important;
  opacity:1!important;background:rgba(0,0,0,.96)!important
}

/* The original seekbar remains the sole seek click owner. */
/* "off" suppresses SCUI decorations across ALL layouts 01..10, never the
   native CommentPreviewView flow/list timing. The previous selector canceled
   preview-text-moving for UI02..10 even in the default non-reduced mode. */
.zenzaSceneSearchHost[data-scene-animation="off"],
.zenzaSceneSearchHost[data-scene-animation="off"]
  :not(.zenzaCommentPreview):not(.zenzaCommentPreview *){
  transition:none!important;animation:none!important
}
.zenzaSceneSearchHost[data-scene-animation="full"] .zenzaSceneBtn{transition-duration:.22s}
.zenzaSceneSearchHost[data-scene-reveal="always"] .zenzaSceneActions,
.zenzaSceneSearchHost[data-scene-reveal="always"] .zenzaSceneBtn{
 opacity:1!important;visibility:visible!important;pointer-events:auto!important
}
/* Keep the layout tray's translateX(-50%) and side-drawer transforms.
   Resetting ALL transforms clipped the 04/06 actions at the viewport edge. */
.zenzaSceneSearchHost[data-scene-reveal="always"] .zenzaSceneBtn{
 transform:none!important
}
.zenzaSceneSearchHost:not(.zenzaSceneSharedPreview)[data-scene-reveal="click"]:not(.is-expanded):not(.is-pinned) :is(.scene-pin,.scene-comment-toggle,.scene-comment-search,.scene-seek-step),
.zenzaSceneEdgeDrawer[data-scene-reveal="click"]:not(.is-expanded):not(.is-pinned) .zenzaSceneActions{
 opacity:0!important;visibility:hidden!important;pointer-events:none!important
}
.zenzaSceneSearchHost .zenzaSceneActions > .zenzaSceneSeekStepControl
 >[data-scui="back"],
.zenzaSceneSearchHost .zenzaSceneActions > .zenzaSceneSeekStepControl
 >[data-scui="forward"],
.zenzaSceneSearchHost .zenzaSceneActions > .zenzaSceneSeekStepControl
 >[data-scui="open"]{display:none!important}
.zenzaSceneSearchHost .zenzaSceneSeekStepControl .zenzaSceneStepPopup{
 position:absolute;min-width:164px;max-width:min(280px,calc(100vw - 24px));
 bottom:calc(100% + 6px);right:0;
 padding:7px;z-index:320;background:#101824;color:#fff;
 border:1px solid #64748b;border-radius:6px;
 box-shadow:0 8px 20px #0009
}
.zenzaSceneSearchHost .zenzaSceneStepPopup[hidden]{display:none!important}
.zenzaSceneSearchHost .zenzaSceneStepPresets{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.zenzaSceneSearchHost .zenzaSceneStepPopup button{cursor:pointer}
.zenzaSceneSearchHost.is-idle-suppressed{display:none!important}
/* Task544: restore the original UI02 twin-panel design without touching
   the separately reserved Layout01_02/LegacyAdapter owner (Task532).
   Normal = two separate panels outside video, full = inside both edges. */
[data-scene-search-layout="02"] .zenzaSceneSearchHost.zenzaSceneLayout02{
  width:min(245px,calc(50% - 20px))!important;
}
[data-scene-search-layout="02"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaSceneLayout02{
  left:12px!important;right:auto!important;top:calc(100% + 15px)!important;
  bottom:auto!important;transform:none!important;
}
[data-scene-search-layout="02"][data-scene-mode="normal"][data-scene-placement="visible-fallback"] .zenzaSceneLayout02{
  left:12px!important;right:auto!important;top:auto!important;
  bottom:94px!important;transform:none!important;
}
[data-scene-search-layout="02"][data-scene-mode="fullscreen"] .zenzaSceneLayout02{
  left:17px!important;right:auto!important;top:auto!important;
  bottom:94px!important;transform:none!important;
}
/* The per-layout action row opens below the scene card, not off its right
   edge. The visible 'more' handle stays inside .zenzaSceneFoot. */
[data-scene-search-layout="02"] .zenzaSceneLayout02 .zenzaSceneActions{
  position:absolute!important;left:8px!important;right:auto!important;
  top:calc(100% - 1px)!important;bottom:auto!important;
  width:max-content;max-width:calc(100% - 16px);
  min-width:0;display:flex;flex-flow:row wrap;justify-content:center;
  padding:5px;gap:4px;border-radius:9px;border:1px solid #536e88;
  background:#101c2c;box-shadow:0 8px 20px #0008;
  opacity:0;visibility:hidden;pointer-events:none;
  transform:translateY(-8px);
  transition:opacity .16s,transform .16s,visibility .16s;
}
[data-scene-search-layout="02"] .zenzaSceneLayout02 .zenzaSceneActions>.zenzaSceneBtn{
  position:static!important;left:auto!important;right:auto!important;
  top:auto!important;bottom:auto!important;min-width:25px;
  opacity:1;visibility:inherit;pointer-events:inherit;
  transform:none!important;
}
[data-scene-search-layout="02"] .zenzaSceneLayout02:is(:hover,:focus-within,.is-expanded,.is-pinned) .zenzaSceneActions{
  opacity:1;visibility:visible;pointer-events:auto;
  transform:translateY(0);
}
[data-scene-search-layout="02"] .zenzaSceneLayout02 .scene-more{
  position:static!important;opacity:1;visibility:visible;pointer-events:auto;
}
/* UI02 secondary native list shares the card's visibility and stays adjacent. */
[data-scene-search-layout="02"] .zenzaCommentPreview.is-scui-list{
  position:absolute;left:auto!important;right:12px!important;top:auto!important;
  bottom:94px!important;transform:none!important;
  width:min(350px,calc(50% - 20px))!important;
  max-width:calc(50% - 20px)!important;height:200px;box-sizing:border-box;
}
[data-scene-search-layout="02"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview.is-scui-list{
  top:var(--scui-twin-comment-top,calc(100% + 15px))!important;
  bottom:auto!important;
}
[data-scene-search-layout="02"] .zenzaSceneLayout02 .zenzaSceneImageBox
 >.zenzaCommentPreview.is-scui-flow{
  background:transparent!important;opacity:1!important;
}
[data-scene-search-layout="02"] .zenzaSceneLayout02 .is-scui-flow .text{
  animation-play-state:running!important;
}
/* Task542: real comment list stays in the legacy seekbar owner; only
   selected layout's coordinates change. Keep its hover/list modes,
   click actions, scroll, visibility and other event owners untouched. */
[data-scene-search-layout="03"] .zenzaCommentPreview,
[data-scene-search-layout="04"] .zenzaCommentPreview,
[data-scene-search-layout="05"] .zenzaCommentPreview,
[data-scene-search-layout="06"] .zenzaCommentPreview,
[data-scene-search-layout="07"] .zenzaCommentPreview,
[data-scene-search-layout="08"] .zenzaCommentPreview,
[data-scene-search-layout="09"] .zenzaCommentPreview,
[data-scene-search-layout="10"] .zenzaCommentPreview{
  box-sizing:border-box;max-width:calc(100% - 24px);
  transform:none!important;
}
/* 03 right shelf / 04 top edge: comments on the opposite edge. */
[data-scene-search-layout="03"][data-scene-mode="normal"] .zenzaCommentPreview{
  left:18px!important;right:auto!important;top:auto!important;bottom:90px!important;
}
[data-scene-search-layout="03"][data-scene-mode="fullscreen"] .zenzaCommentPreview{
  left:auto!important;right:20px!important;top:auto!important;bottom:95px!important;
}
[data-scene-search-layout="04"][data-scene-mode="normal"] .zenzaCommentPreview{
  left:15px!important;right:auto!important;top:auto!important;bottom:87px!important;
}
[data-scene-search-layout="04"][data-scene-mode="fullscreen"] .zenzaCommentPreview{
  left:auto!important;right:19px!important;top:auto!important;bottom:90px!important;
}
/* 05 deck: beside the below-video controls only while there is room.
   In Zenza's viewport-filling modes, keep comments inside the player. */
[data-scene-search-layout="05"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;top:auto!important;bottom:90px!important;
}
[data-scene-search-layout="05"][data-scene-mode="normal"][data-scene-placement="below"][data-scene-wide="true"] .zenzaCommentPreview{
  left:calc(50% + 280px)!important;right:auto!important;
  top:calc(100% + 9px)!important;bottom:auto!important;
  max-width:calc(50% - 20px);
}
/* 06 capsule: a separate right-hand comment list (seek card follows cursor). */
[data-scene-search-layout="06"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;top:auto!important;bottom:91px!important;
}
/* 07 original filmstrip: list below video, opposite the left filmstrip.
   Fullscreen or clipped below-video layout uses the right lower overlay. */
[data-scene-search-layout="07"] .zenzaCommentPreview{
  left:auto!important;right:13px!important;top:auto!important;bottom:94px!important;
}
[data-scene-search-layout="07"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview{
  left:auto!important;right:5px!important;top:calc(100% + 10px)!important;bottom:auto!important;
}
/* 08 drawer changes sides between normal and fullscreen. */
[data-scene-search-layout="08"][data-scene-mode="normal"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;top:auto!important;bottom:87px!important;
}
[data-scene-search-layout="08"][data-scene-mode="fullscreen"] .zenzaCommentPreview{
  left:12px!important;right:auto!important;top:auto!important;bottom:91px!important;
}
/* 09 remote: separated right-side controller with comments beneath it. */
[data-scene-search-layout="09"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;top:auto!important;bottom:153px!important;
}
[data-scene-search-layout="09"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;top:calc(100% + 74px)!important;bottom:auto!important;
}
/* 10 smart placement: put comments on the opposite side of the chosen card. */
[data-scene-search-layout="10"] .zenzaCommentPreview{
  left:auto!important;right:12px!important;top:auto!important;bottom:91px!important;
}
[data-scene-search-layout="10"][data-scene-mode="fullscreen"] .zenzaCommentPreview{
  bottom:96px!important;
}
[data-scene-search-layout="10"][data-scene-comment-side="left"] .zenzaCommentPreview{
  left:12px!important;right:auto!important;
}
/* Narrow viewports: preserve the existing 350/180px comment modes while
   preventing off-screen panels. Avoid covering a below-video filmstrip. */
[data-scene-narrow="true"][data-scene-search-layout="05"] .zenzaCommentPreview,
[data-scene-narrow="true"][data-scene-search-layout="07"] .zenzaCommentPreview,
[data-scene-narrow="true"][data-scene-search-layout="09"] .zenzaCommentPreview{
  left:12px!important;right:12px!important;
  max-width:calc(100% - 24px);
  transform:none!important;
}
[data-scene-narrow="true"][data-scene-search-layout="05"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview{
  top:calc(100% + 111px)!important;bottom:auto!important;
}
[data-scene-narrow="true"][data-scene-search-layout="07"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview{
  top:calc(100% + 157px)!important;bottom:auto!important;
}
[data-scene-narrow="true"][data-scene-search-layout="09"][data-scene-mode="normal"][data-scene-placement="below"] .zenzaCommentPreview{
  top:calc(100% + 112px)!important;bottom:auto!important;
}
`;
    }
}
//===END===
export {SceneSearchIntegrationBridge};
