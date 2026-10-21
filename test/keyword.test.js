import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt';
import { configuredKeyword, replaceSystemPromptKeywords } from '../lib/keyword.js';

function assembly() {
  return {
    sections: [
      { name: 'harness:identity', text: 'You are powered by DeepSeek Harness.' },
      { name: 'persona', text: 'Use deepseek harness. DeepSeek HARNESS is useful.' },
      { name: 'tool:guidance', text: 'Welcome to DEEPSEEK HARNESS.' },
      { name: 'model', text: 'Using {{model}}.' },
    ],
    contexts: [{ name: 'runtime', text: 'DeepSeek Harness user-role context.' }],
    tools: [{ name: 'search', description: 'DeepSeek Harness search' }],
    variables: { model: 'DeepSeek Harness' },
  };
}

test('empty search is disabled even with nonempty replacement', () => {
  const source = assembly();
  assert.strictEqual(replaceSystemPromptKeywords(source, '', 'harness'), source);
  assert.strictEqual(replaceSystemPromptKeywords(source, null, 'harness'), source);
  assert.strictEqual(replaceSystemPromptKeywords(source, 'DeepSeek', null), source);
});

test('replaces all case variants throughout the complete assembled section set', () => {
  const before = assembly();
  const after = replaceSystemPromptKeywords(before, 'DeepSeek harness', 'harness');
  assert.notStrictEqual(after, before);
  assert.deepEqual(after.sections.map(s => s.name), before.sections.map(s => s.name));
  assert.deepEqual(after.sections.map(s => s.text), [
    'You are powered by harness.',
    'Use harness. harness is useful.',
    'Welcome to harness.',
    'Using harness.',
  ]);
  assert.equal(after.sections[3].interpolate, false);
  assert.deepEqual(after.tools, before.tools);
  assert.strictEqual(after.tools, before.tools);
  assert.strictEqual(after.contexts, before.contexts);
  assert.strictEqual(after.variables, before.variables);
  assert.equal(before.sections[0].text, 'You are powered by DeepSeek Harness.');
  assert.equal(renderPrompt(after), 'You are powered by harness.\n\nUse harness. harness is useful.\n\nWelcome to harness.\n\nUsing harness.');
});

test('search text is a literal even if it includes regex metacharacters', () => {
  const source = {
    ...assembly(),
    sections: [{ name: 'regex', text: 'a+b is not ab; A+B is same as a+b' }],
  };
  const after = replaceSystemPromptKeywords(source, 'a+b', '$&{{name}}\\code');
  assert.equal(after.sections[0].text, '$&{{name}}\\code is not ab; $&{{name}}\\code is same as $&{{name}}\\code');
  assert.equal(renderPrompt(after), after.sections[0].text);
});

test('empty replacement deletes every occurrence', () => {
  const source = assembly();
  const after = replaceSystemPromptKeywords(source, 'DeepSeek Harness', '');
  assert.equal(after.sections[0].text, 'You are powered by .');
  assert.equal(after.sections[1].text, 'Use .  is useful.');
  assert.equal(after.sections[2].text, 'Welcome to .');
});

test('only changed sections are materialized; interpolation and metadata are preserved on others', () => {
  const source = assembly();
  const other = { name: 'unrelated', text: 'Do not change {{x}}!', extra: 'custom', interpolate: true };
  const input = { ...source, sections: [source.sections[1], other], variables: { x: 'anything' } };
  const after = replaceSystemPromptKeywords(input, 'DeepSeek Harness', 'harness');
  assert.strictEqual(after.sections[1], other);
  assert.deepEqual(after.sections[0], { name: 'persona', text: 'Use harness. harness is useful.', interpolate: false });
  assert.equal(renderPrompt(after), 'Use harness. harness is useful.\n\nDo not change anything!');
});

test('keyword replacement catches rendered variable values without changing variables or runtime context', () => {
  const source = {
    ...assembly(),
    sections: [{ name: 'slot', text: 'You use {{model}} ({{model}}).', extra: 5 }],
  };
  const after = replaceSystemPromptKeywords(source, 'deepseek harness', 'harness');
  assert.deepEqual(after.sections[0], { name: 'slot', text: 'You use harness (harness).', extra: 5, interpolate: false });
  assert.equal(renderPrompt(after), 'You use harness (harness).');
  assert.equal(source.variables.model, 'DeepSeek Harness');
  assert.strictEqual(after.variables, source.variables);
});

test('custom replacement with literal {{braces}} is not interpolated on changed sections', () => {
  const source = {
    ...assembly(),
    sections: [{ name: 'slot', text: 'Welcome, {{model}}!' }],
  };
  const after = replaceSystemPromptKeywords(source, 'deepseek harness', '{{unknown}}');
  assert.equal(after.sections[0].text, 'Welcome, {{unknown}}!');
  assert.equal(after.sections[0].interpolate, false);
  assert.equal(renderPrompt(after), 'Welcome, {{unknown}}!');
});

test('disabled identity section does not disable keyword replacement in other sections', () => {
  const source = assembly();
  source.sections.shift();
  const after = replaceSystemPromptKeywords(source, 'DeepSeek Harness', 'harness');
  assert.equal(after.sections.length, 3);
  assert.equal(after.sections[0].text, 'Use harness. harness is useful.');
});

test('volatile fields use a fresh snapshot; invalid values are safe and do not disable replacement', () => {
  let find = 'DeepSeek Harness';
  let replacement = 'harness';
  const config = { keywordFind: { get: () => find }, keywordReplace: { get: () => replacement } };
  assert.deepEqual(configuredKeyword(config), { find, replacement });
  find = 'Some keyword';
  replacement = '';
  assert.deepEqual(configuredKeyword(config), { find, replacement });
  assert.deepEqual(configuredKeyword({}), { find: '', replacement: '' });
  assert.deepEqual(configuredKeyword({ keywordFind: 2, keywordReplace: null }), { find: '', replacement: '' });
});

test('when keyword is absent, no existing section object is changed', () => {
  const source = assembly();
  assert.strictEqual(replaceSystemPromptKeywords(source, 'not present', 'new'), source);
});
