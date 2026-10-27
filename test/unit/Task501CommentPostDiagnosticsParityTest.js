'use strict';
const assert=require('assert');
const {beginSection,read,createContext,run}=require('../helpers/extractSource');
function oldDiagnostic() {
  return run(read('test/fixtures/Task501PostFailureDiagnostics.before.js')+
    ';getCommentPostFailureDetails;',createContext({}));
}
function newDiagnostic() {
  // The classifier now lives in TypeScript-canonical ThreadLoader (Task648).
  // Evaluate only its pure lexical helper group, never the player/transport.
  const source=read('packages/lib/src/nico/ThreadLoader.js');
  const from=source.indexOf('    const safeStatusCode = ');
  const to=source.indexOf('    const createCommentPostDiagnostic = ',from);
  assert(from>=0 && to>from,'comment-post diagnostics helper layout changed');
  return run(source.slice(from,to)+';getCommentPostFailureDetails;',createContext({}));
}
function scenario(error) {
  const before=oldDiagnostic();
  const after=newDiagnostic();
  const lhs=JSON.parse(JSON.stringify(before(error)));
  const rhs=JSON.parse(JSON.stringify(after(error)));
  assert.deepStrictEqual(rhs,lhs);
  return rhs;
}
describe('Task501 TypeScript comment-post diagnostic classifier parity',()=>{
  it('keeps real HTTP400 challenge and token error codes',()=>{
    for(const errorCode of ['INVALID_CHALLENGE_TOKEN','INVALID_PARAMETER',
      'INVALID_TOKEN','EXPIRED_TOKEN','TOO_MANY_REQUESTS']){
      const result=scenario({result:{status:400,errorCode,kind:'API'}});
      assert.strictEqual(result.statusCode,400);
      assert.strictEqual(result.errorCode,errorCode);
    }
  });
  it('preserves network, parser, header-timeout and Retry-After metadata',()=>{
    for(const error of [
      {kind:'network',result:{}},
      {result:{httpStatus:502,name:'SyntaxError'}},
      {kind:'body-timeout',result:{httpStatus:504,retryAfterMs:2000}},
      {result:{status:429,errorCode:'TOO_MANY_REQUESTS',retryAfterMs:7000}},
      {result:{status:'400',errorCode:'FORBIDDEN'}},
      {result:{status:400,errorCode:'INVALID_TOKEN',kind:'API',name:'Error'}}
    ])scenario(error);
  });
  it('matches legacy diagnostics for null or wrongly-shaped errors',()=>{
    for(const error of [null,undefined,false,0,'',[],{},
      {result:null},{result:false},{result:{}},
      {result:{status:0,errorCode:123}},
      {result:{errorCode:'bad-error',status:403}},
      {result:{errorCode:'A'.repeat(81),status:400}},
      {result:{kind:'!untrusted-value!',retryAfterMs:-100,status:400}},
      {result:{retryAfterMs:undefined,status:200}}])
      scenario(error);
  });
  it('does not include bodies, post keys or raw server error messages',()=>{
    const privateBody='private-post-text-123';
    const secrets=['postkey-secret','challenge-token-secret','private-user-id'];
    const payload={result:{status:400,errorCode:'INVALID_CHALLENGE_TOKEN',
      message:privateBody,postKey:secrets[0],challengeToken:secrets[1],
      userId:secrets[2]}};
    const details=scenario(payload);
    const serialized=JSON.stringify(details);
    for(const s of [privateBody,...secrets])assert(!serialized.includes(s));
    assert.deepStrictEqual(details,{statusCode:400,errorCode:'INVALID_CHALLENGE_TOKEN'});
  });
});
