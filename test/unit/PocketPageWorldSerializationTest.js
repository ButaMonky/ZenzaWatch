'use strict';
// Task714: prove production helper survives MylistPocket's page-world
// serialization, not merely that it exists in the outer userscript.
const assert=require('assert');
const parser=require('@babel/parser');
const traverse=require('@babel/traverse').default;
const {read,extract,createContext,run}=require('../helpers/extractSource');

describe('Task714 MylistPocket serialized page-world binding',()=>{
  it('embeds PocketThumbnail inside the serialized monkey function',()=>{
    const text=extract('dist/MylistPocket.user.js','monkey','var');
    const ctx=createContext();
    run('const monkey='+text+';this.actualInjectedFunction=monkey.toString();',ctx);
    const serialized=ctx.actualInjectedFunction;
    assert(serialized.includes('const PocketThumbnail = (() => {'),
      'The injected monkey lacks its TypeScript-generated PocketThumbnail');
    assert(serialized.includes('const ThumbnailSourcePolicy = (() => {'),
      'The page-world MylistPocket script lacks the shared thumbnail policy');
    assert(serialized.indexOf('const ThumbnailSourcePolicy = (() => {') <
      serialized.indexOf('const PocketThumbnail = (() => {'),
      'the thumbnail selection policy must initialize before PocketThumbnail');
    const wrapped='const monkey='+serialized+';';
    const ast=parser.parse(wrapped,{sourceType:'script'});
    let references=0;
    let policyReferences=0;
    const freeReferences=[];
    const freePolicyReferences=[];
    traverse(ast,{
      Identifier(p){
        if(!p.isReferencedIdentifier())return;
        if(p.node.name==='PocketThumbnail'){
          references++;
          const bound=p.scope.getBinding('PocketThumbnail');
          if(!bound || !bound.path.isVariableDeclarator())freeReferences.push(p.node.start);
        }
        if(p.node.name==='ThumbnailSourcePolicy'){
          policyReferences++;
          const bound=p.scope.getBinding('ThumbnailSourcePolicy');
          if(!bound || !bound.path.isVariableDeclarator())freePolicyReferences.push(p.node.start);
        }
      }
    });
    assert(references>=4,'No real usage sites of PocketThumbnail were checked');
    assert.deepStrictEqual(freeReferences,[],
      'PocketThumbnail must not be an outer lexical reference after monkey.toString()');
    assert(policyReferences>=1,'the shared image policy has no tested runtime usage');
    assert.deepStrictEqual(freePolicyReferences,[],
      'ThumbnailSourcePolicy must be bound inside the serialized page-world function');
    const arrow=ast.program.body[0].declarations[0].init;
    const helper=arrow.body.body.find(node=>node.type==='VariableDeclaration' &&
      node.declarations.some(d=>d.id.name==='PocketThumbnail'));
    assert(helper,'The helper is not inside monkey body');
    const fragment=wrapped.slice(helper.start,helper.end);
    const page=createContext();
    run(fragment+'\nthis.result=PocketThumbnail.legacyUrls('+
      '"https://nicovideo.cdn.nimg.jp/thumbnails/3/3.M",true);',page);
    assert.deepStrictEqual([...page.result],[
      'https://nicovideo.cdn.nimg.jp/thumbnails/3/3.L',
      'https://nicovideo.cdn.nimg.jp/thumbnails/3/3.M'
    ]);
  });

  it('retains the exact page-world injection path and matching metadata version',()=>{
    const source=read('src/_pocket.js');
    const dist=read('dist/MylistPocket.user.js');
    assert.match(source,/\(\$\{monkey\.toString\(\)\}\)\("\$\{PRODUCT\}"\)/);
    const version=dist.match(/^\/\/ @version\s+(\S+)/m)?.[1];
    const sourceVersion=source.match(/^\/\/ @version\s+(\S+)/m)?.[1];
    assert(version && /^\d+(?:\.\d+){2}-task\d+$/.test(version));
    assert.strictEqual(version,sourceVersion);
    assert(dist.includes("MylistPocket "+version),
      'The version announced at runtime differs from Tampermonkey metadata');
    assert(!source.includes('//@require PocketThumbnail\n//@require AntiPrototypeJs'),
      'The helper must not be required outside serialized monkey');
    assert(source.indexOf('//@require PocketThumbnail') >
      source.indexOf('const monkey = (PRODUCT) => {'));
  });
});
