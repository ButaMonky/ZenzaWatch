'use strict';
// Extract complete expressions from trusted local JS, not delimiters inside strings.
const {parse}=require('@babel/parser');
const cache=new Map();
function ast(source){if(!cache.has(source))cache.set(source,parse(source,{sourceType:'module'}));return cache.get(source);}
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const [key,value]of Object.entries(node)){if(['loc','tokens','comments'].includes(key))continue;if(Array.isArray(value))value.forEach(n=>walk(n,visit));else if(value&&typeof value==='object')walk(value,visit);}}
function name(node){return node?.type==='Identifier'?node.name:node?.type==='MemberExpression'&&!node.computed?name(node.object)+'.'+name(node.property):null;}
function unique(source,predicate){const hits=[];walk(ast(source),n=>{if(predicate(n))hits.push(n);});if(hits.length!==1)throw Error('Expected unique source expression, found '+hits.length);return hits[0];}
function evaluate(source,node,scope={}){return Function(...Object.keys(scope),'"use strict";return ('+source.slice(node.start,node.end)+');')(...Object.values(scope));}
function staticValue(source,key,scope={}){const node=unique(source,n=>n.type==='AssignmentExpression'&&name(n.left)===key);return evaluate(source,node.right,scope);}
function variableValue(source,key,scope={}){const node=unique(source,n=>n.type==='VariableDeclarator'&&n.init&&name(n.id)===key);return evaluate(source,node.init,scope);}
function labeledStyle(source,label,scope={}){
  const node=unique(source,n=>n.type==='CallExpression'&&['css.addStyle','util.addStyle'].includes(name(n.callee))&&n.arguments[1]?.type==='ObjectExpression'&&n.arguments[1].properties.some(p=>(p.key?.name||p.key?.value)==='className'&&p.value?.value===label));
  return evaluate(source,node.arguments[0],scope);
}
function classText(source,key){const node=unique(source,n=>n.type==='ClassDeclaration'&&n.id?.name===key);return source.slice(node.start,node.end);}
function topLevelStyles(source,scope={}){
  return ast(source).program.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression'&&['css.addStyle','util.addStyle'].includes(name(n.expression.callee))).map(n=>({css:evaluate(source,n.expression.arguments[0],scope),options:n.expression.arguments[1]?evaluate(source,n.expression.arguments[1],scope):{}}));
}
module.exports={staticValue,variableValue,labeledStyle,classText,topLevelStyles};
module.exports.methodText=function(source,klass,method){const c=unique(source,n=>n.type==='ClassDeclaration'&&n.id?.name===klass);const m=c.body.body.filter(n=>n.key?.name===method);if(m.length!==1)throw Error('Expected unique class method '+klass+'.'+method);return source.slice(m[0].start,m[0].end);};
module.exports.bindingValue=function(source,klass,key,scope={}){
 const traverse=require('@babel/traverse').default,hits=[];
 traverse(ast(source),{ClassDeclaration(p){if(p.node.id?.name===klass)hits.push(p.scope.getBinding(key)?.path.node);}});
 if(hits.length!==1||!hits[0]?.init)throw Error('Expected unique bound value '+klass+':'+key);
 return evaluate(source,hits[0].init,scope);
};
