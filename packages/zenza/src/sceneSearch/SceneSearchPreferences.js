// GENERATED FROM tools/typescript-stage1/nico-src/SceneSearchPreferences.ts
//===BEGIN===
class SceneSearchPreferences {
    static validLayout(value) {
        return value === 'follow' || value === 'fixed' || value === 'legacy';
    }
    static resolve(read, hasSaved) {
        const migration = [];
        const layout = (mode) => {
            const key = 'sceneSearch.presentation.' + mode, value = read(key);
            if (hasSaved(key) && this.validLayout(value))
                return value;
            const oldKey = 'sceneSearch.layout.' + mode, old = read(oldKey);
            if (!hasSaved(oldKey) || typeof old !== 'string' || !/^(00|0[1-9]|10)$/.test(old))
                return 'follow';
            const result = old === '00' ? 'legacy' : old === '01' || old === '06' ? 'follow' : 'fixed';
            migration.push({ key, oldValue: old, newValue: result });
            return result;
        };
        const enabled = read('sceneSearch.enabled') !== false;
        const master = enabled && read('sceneSearch.commentPreviewVisible') !== false;
        const oldMini = read('sceneSearch.miniCommentMode');
        const miniVisible = hasSaved('sceneSearch.miniCommentVisible') ?
            read('sceneSearch.miniCommentVisible') !== false : oldMini !== 'hidden';
        const listVisible = read('sceneSearch.commentListVisible') !== false;
        const bounded = (key, min, max, fallback) => {
            const value = read(key);
            return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback;
        };
        return { enabled, listScale: bounded('sceneSearch.commentListScale', 100, 200, 100), normal: layout('normal'), fullscreen: layout('fullscreen'),
            linked: read('sceneSearch.layout.linkFullscreen') === true,
            miniStyle: oldMini === 'static' ? 'static' : 'flow', miniVisible, listVisible,
            miniEnabled: master && miniVisible, listAllowed: master && listVisible,
            listOpen: master && listVisible && read('enableCommentPreview') === true,
            opacity: bounded('sceneSearch.commentListBackgroundOpacity', 0, 100, 90),
            scale: bounded('sceneSearch.thumbnailScale', 50, 200, 100), migration };
    }
}
//===END===
export {SceneSearchPreferences};
