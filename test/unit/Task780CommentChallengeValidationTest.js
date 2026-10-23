'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
const ctx = createContext();
const wire = run(beginSection('packages/lib/src/nico/CommentPostWire.js') + ';CommentPostWire;', ctx);
describe('Task780 TypeScript-owned postKey challenge response validation', () => {
  it('interprets valid required and nonrequired responses without losing the siteKey', () => {
    const required = wire.readChallenge({postKey: 'fixture', challenge: {
      isRequired: true, siteKey: '0x00000000000000000000AA'
    }});
    assert.strictEqual(required.required, true);
    assert.strictEqual(required.siteKey, '0x00000000000000000000AA');
    assert.strictEqual(wire.readChallenge({postKey: 'fixture', challenge: {isRequired: false}}).required, false);
  });
  it('allows a legacy response without the optional challenge property', () => {
    assert.strictEqual(wire.readChallenge({postKey: 'fixture'}).required, false);
  });
  it('fails closed for unexpected challenge shapes rather than POSTing unauthenticated', () => {
    const inputs = [
      {challenge: null}, {challenge: 'none'}, {challenge: []},
      {challenge: {}}, {challenge: {isRequired: 'false'}},
      {challenge: {isRequired: 1}}, {challenge: {isRequired: null}},
      {challenge: {isRequired: true, siteKey: 2}},
      {challenge: {isRequired: true, siteKey: ' '}}
    ];
    for(const input of inputs) {
      const result = wire.readChallenge(input);
      assert.notStrictEqual(result.required, false, JSON.stringify(input));
      assert.notStrictEqual(result.required, true, JSON.stringify(input));
    }
  });
  it('does not inherit or accept forged prototype sitekeys or isRequired', () => {
    const malformed = {challenge: Object.assign(Object.create({isRequired: true, siteKey:'inherited'}), {})};
    assert.strictEqual(wire.readChallenge(malformed).required, null);
    const required = {challenge: {isRequired: true}};
    Object.setPrototypeOf(required.challenge, {siteKey: 'inherited'});
    const data = wire.readChallenge(required);
    assert.strictEqual(data.required, null);
  });
});
