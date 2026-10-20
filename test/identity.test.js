import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_IDENTITY,
  HARNESS_IDENTITY_SECTION,
  configuredIdentity,
  overrideHarnessIdentity,
  validIdentity,
} from '../lib/identity.js';

const OLD = 'You are an AI agent powered by DeepSeek Harness.';

function assembly() {
  const other = { name: 'deployment:persona-prefix', text: 'Keep this {{model}}.' };
  const extra = { name: 'tools:read', text: 'Read files.' };
  const identity = { name: HARNESS_IDENTITY_SECTION, text: OLD };
  return {
    sections: [identity, other, extra],
    contexts: [{ name: 'runtime', text: 'Current directory.' }],
    tools: [{ name: 'read_file', parameters: {} }],
    variables: { model: 'demo' },
  };
}

test('default matches the exact requested text', () => {
  assert.equal(DEFAULT_IDENTITY,
    'You are a capable, task-oriented AI agent that proactively uses available tools, researches existing projects and proven solutions when relevant, and delivers correct and complete results.');
});

test('only the named identity section is replaced, without reordering or mutating the input', () => {
  const before = assembly();
  const other = before.sections[1];
  const replacement = overrideHarnessIdentity(before, DEFAULT_IDENTITY);
  assert.notEqual(replacement, before);
  assert.notEqual(replacement.sections, before.sections);
  assert.equal(replacement.sections.length, before.sections.length);
  assert.deepEqual(replacement.sections.map(section => section.name), before.sections.map(section => section.name));
  assert.deepEqual(replacement.sections[0], {
    name: HARNESS_IDENTITY_SECTION,
    text: DEFAULT_IDENTITY,
    interpolate: false,
  });
  assert.equal(before.sections[0].text, OLD);
  assert.equal(replacement.sections[1], other);
  assert.equal(replacement.sections[2], before.sections[2]);
  assert.equal(replacement.contexts, before.contexts);
  assert.equal(replacement.tools, before.tools);
  assert.equal(replacement.variables, before.variables);
});

test('multiline and literal prompt variable syntax survive verbatim', () => {
  const message = 'You are the model.\nRefer to {{unknown_variable}} literally.';
  const after = overrideHarnessIdentity(assembly(), message);
  assert.equal(after.sections[0].text, message);
  assert.equal(after.sections[0].interpolate, false);
  assert.equal(after.sections[1].interpolate, undefined);
});

test('missing builtin identity or invalid value does not add a section', () => {
  const original = assembly();
  const missing = { ...original, sections: original.sections.slice(1) };
  assert.equal(overrideHarnessIdentity(missing, DEFAULT_IDENTITY), missing);
  assert.equal(overrideHarnessIdentity(original, ''), original);
  assert.equal(overrideHarnessIdentity(original, '\n  '), original);
  assert.equal(overrideHarnessIdentity(original, 123), original);
});

test('volatile settings are read afresh, with a default for invalid configuration', () => {
  let current = 'My first agent identity';
  const config = { identityText: { get() { return current; } } };
  assert.equal(configuredIdentity(config), current);
  current = 'My second agent identity';
  assert.equal(configuredIdentity(config), current);
  assert.equal(configuredIdentity({ identityText: 'A custom identity' }), 'A custom identity');
  assert.equal(configuredIdentity({ identityText: '\n  ' }), DEFAULT_IDENTITY);
  assert.equal(configuredIdentity({}), DEFAULT_IDENTITY);
  assert.equal(validIdentity('x\ny'), true);
  assert.equal(validIdentity(null), false);
});
