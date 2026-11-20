'use strict';

// Build-time only. Lift the two UI factories out of the player that is injected
// into ordinary pages. Their lexical imports stay in the unprivileged player.
function splitOptionalPanels(runtime) {
  const load = require('node:module').createRequire(require.resolve('eslint'));
  const parser = load('espree');
  const scopeAnalyzer = load('eslint-scope');
  const prefix = 'async function runRuntime(window,externalTrial,_){const {displaySettings,externalSettingsHost,writeExternal,readExternalValues,externalSlot,installInteractionGuard,frameTopologyChanged}=externalTrial||{};\n';
  const ast = parser.parse(prefix + runtime + '\n}', {ecmaVersion:'latest',range:true});
  const scopes = scopeAnalyzer.analyze(ast, {ecmaVersion:2022,sourceType:'script',optimistic:true,ignoreEval:true}).scopes;
  const names = ['createAdvancedSettingsPanel','createVideoSharePanel'];
  const factories = [];
  const edits = [];
  for (const name of names) {
    const vars = scopes.flatMap(scope => scope.variables.filter(variable => variable.name === name));
    if (vars.length !== 1) throw Error('Expected one optional panel declaration: ' + name);
    const declaration = vars[0].defs[0].node;
    const fn = declaration.init || declaration;
    const scope = scopes.find(s => s.type === 'function' && s.block === fn);
    if (!scope) throw Error('Expected an optional panel factory: ' + name);
    const imports = [...new Set(scope.through.filter(ref => ref.resolved && ref.resolved !== vars[0]).map(ref => ref.identifier.name))].sort();
    const start = fn.start - prefix.length, end = fn.end - prefix.length;
    const source = runtime.slice(start,end);
    factories.push(name + ':function({' + imports.join(',') + '}){return (' + source + ');}');
    const call = 'loadOptionalPanel(' + JSON.stringify(name) + ').then(install => install({' + imports.join(',') + '})(...args))';
    const proxy = fn.type === 'FunctionDeclaration' ? 'function '+name+'(...args){return '+call+';}' : '(...args) => '+call;
    edits.push({start,end,proxy});
  }
  for (const {start,end,proxy} of edits.sort((a,b) => b.start-a.start)) runtime = runtime.slice(0,start) + proxy + runtime.slice(end);
  return {runtime,factories:'{' + factories.join(',\n') + '}'};
}

// Runs in the page realm. Only immutable code packaged with this installed
// userscript is supplied by the loader. Page data never crosses into GM APIs.
function panelLoader(doc, namespace) {
  const cache = new Map();
  return name => {
    if (cache.has(name)) return cache.get(name);
    const event = namespace + name;
    const pending = new Promise((resolve,reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        doc.removeEventListener(event + ':ready', ready);
      };
      const ready = result => {
        if (typeof result.detail !== 'function') return;
        cleanup();
        resolve(result.detail);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(Error('追加画面を読み込めませんでした。もう一度開いてください。'));
      }, 10000);
      doc.addEventListener(event + ':ready',ready);
      doc.dispatchEvent(new Event(event));
    });
    cache.set(name,pending);
    pending.catch(() => cache.delete(name));
    return pending;
  };
}

// Runs in the userscript realm. Each request is bound to a known local
// factory. The page cannot supply executable text, a network URL or a GM call.
function providePanels(doc, namespace, factories, addScript) {
  for (const [name,factory] of Object.entries(factories)) {
    const event = namespace + name;
    doc.addEventListener(event, () => {
      const source = 'document.dispatchEvent(new CustomEvent(' + JSON.stringify(event + ':ready') +
        ',{detail:(' + factory.toString() + ')}));\n//# sourceURL=ZenzaWatch-' + name + '.js';
      const host = doc.head || doc.documentElement;
      const inline = () => addScript(host,'script',{textContent:source})?.remove();
      let url, script;
      const release = () => { if (url) URL.revokeObjectURL(url); script?.remove(); };
      try {
        url = URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
        script = addScript(host,'script',{src:url});
        if (!script) throw Error('script');
        script.addEventListener('load',release,{once:true});
        script.addEventListener('error',() => { release(); inline(); },{once:true});
      } catch (_) { release(); inline(); }
    });
  }
}
module.exports = {splitOptionalPanels,panelLoader,providePanels};
