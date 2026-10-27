// Task966 (second step): DialogElement, bundled in ZenzaWatch-dev and ZenzaHLS (both bumped
// in Task966 anyway). Legacy strictness, ordinary //===BEGIN=== module.
export default {
  task: 'task966',
  title: 'dialog element (legacy strictness)',
  modules: {
    DialogElement: {runtime: 'packages/components/src/element/DialogElement.js', cls: 'auto', legacy: true},
  },
  allowlist: [
    ['components\\/src\\/element\\/(?:BaseCommandElement|SettingPanelElement|VideoItemElement))',
      'components\\/src\\/element\\/(?:BaseCommandElement|SettingPanelElement|VideoItemElement|DialogElement))'],
  ],
};
