const {test}=require('node:test'),assert=require('node:assert/strict');
const {siteRules,matchesSiteRule}=require('./generated/site-rules');
test('Tampermonkey-style wildcard patterns honor host boundaries, paths, schemes and exclusions',()=>{
 const rules=siteRules('// @match *://*.example.com/watch/*\n// @include https://other.test/*\n// @exclude https://example.com/private/*');assert.equal(rules.length,3);
 assert(matchesSiteRule(rules[0],'https://example.com/watch/sm9'));assert(matchesSiteRule(rules[0],'https://www.example.com/watch/sm9?x=1#ignored'));
 assert(!matchesSiteRule(rules[0],'https://evil-example.com/watch/sm9'));assert(!matchesSiteRule(rules[0],'https://evil.test/?x=https://example.com/watch/sm9'));
 assert(!matchesSiteRule(rules[0],'https://example.com/Watch/sm9'));assert(!matchesSiteRule('https://example.com/*','http://example.com/'));
 assert(matchesSiteRule('http*://example.com/*','https://example.com/'));assert(matchesSiteRule('https://example.com:8443/*','https://example.com:8443/'));
 assert(!matchesSiteRule('https://example.com:8443/*','https://example.com/'));assert(matchesSiteRule('example.com','https://www.example.com/'));
 assert(matchesSiteRule('https://*','https://example.com/nested'));assert(matchesSiteRule('*example*','https://example.com/nested'));assert(matchesSiteRule('*','https://example.com/'));assert(!matchesSiteRule('/evil/','https://example.com/'));
});
