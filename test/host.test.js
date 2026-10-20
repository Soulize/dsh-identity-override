import assert from 'node:assert/strict';
import test from 'node:test';
import plugin, { apply, Config, name } from '../lib/index.js';
import { DEFAULT_IDENTITY } from '../lib/identity.js';

function hostMock() {
  const listeners = new Map();
  const emitted = [];
  const settingsCalls = [];
  const fiber = { id: 'identity-override' };
  const ctx = {
    fiber,
    on(event, fn, options) {
      listeners.set(event, { fn, options });
      return () => listeners.delete(event);
    },
    emit(event) { emitted.push(event); },
    inject(names, callback) {
      assert.deepEqual(names, ['settings']);
      callback({
        settings: {
          configure(options, target) {
            settingsCalls.push({ options, target });
            return () => {};
          },
        },
        effect(fn) { fn(); },
      });
    },
  };
  return { ctx, listeners, emitted, settingsCalls, fiber };
}

test('exports a DSH host plugin with a volatile identity field', () => {
  assert.equal(name, 'identity-override');
  assert.equal(plugin.name, name);
  assert.equal(typeof apply, 'function');
  assert.equal(Config.fields.identityText.defaultValue, DEFAULT_IDENTITY);
  assert.equal(Config.fields.identityText.isVolatile, true);
});

test('registers a waterfall override and live settings form', async () => {
  let current = 'First custom identity';
  const mock = hostMock();
  apply(mock.ctx, { identityText: { get() { return current; } } });

  assert.deepEqual(mock.settingsCalls, [{ options: { auto: false }, target: mock.fiber }]);
  const waterfall = mock.listeners.get('system-prompt/assemble');
  assert.equal(waterfall.options.prepend, true);
  const base = {
    sections: [
      { name: 'harness:identity', text: 'You are an AI agent powered by DeepSeek Harness.' },
      { name: 'other', text: 'Do not change me.' },
    ],
    tools: ['unchanged'], contexts: ['unchanged'], variables: { model: 'demo' },
  };
  let nextCalls = 0;
  const next = async () => { nextCalls++; return base; };
  const first = await waterfall.fn(base, {}, next);
  assert.equal(first.sections[0].text, current);
  assert.equal(first.sections[1], base.sections[1]);
  assert.equal(nextCalls, 1);

  current = 'Updated without remounting';
  mock.listeners.get('loader/volatile-update').fn([['identityText']]);
  assert.deepEqual(mock.emitted, ['system-prompt/change']);
  const second = await waterfall.fn(base, {}, next);
  assert.equal(second.sections[0].text, current);
  assert.equal(nextCalls, 2);

  mock.listeners.get('loader/volatile-update').fn([['unrelated']]);
  assert.deepEqual(mock.emitted, ['system-prompt/change']);
});

test('does not create an identity if upstream disabled it', async () => {
  const mock = hostMock();
  apply(mock.ctx);
  const original = { sections: [{ name: 'persona', text: 'Only persona.' }] };
  const result = await mock.listeners.get('system-prompt/assemble').fn(original, {}, async () => original);
  assert.equal(result, original);
});
