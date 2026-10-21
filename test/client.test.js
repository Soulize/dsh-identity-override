import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DEFAULT_IDENTITY } from '../lib/identity.js';

function createUI() {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  const hooks = [];
  let cursor = 0;
  const React = {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children };
    },
    useState(initial) {
      const position = cursor++;
      if (!(position in hooks)) hooks[position] = initial;
      return [hooks[position], value => {
        hooks[position] = typeof value === 'function' ? value(hooks[position]) : value;
      }];
    },
    useEffect() { /* server revision changes are not needed in this test */ },
  };
  let captured;
  const window = { __ModuleLoader__: { load(bundle) { captured = bundle; } } };
  vm.runInNewContext(source, { window }, { filename: 'lib/client.js' });
  assert.equal(captured.id, 'dsh-identity-override');
  const client = captured.factory(specifier => {
    assert.equal(specifier, 'react');
    return React;
  });
  const registrations = [];
  client.apply({
    effect() { /* stylesheet is not relevant to the form contract */ },
    slots: {
      inject(key, callback) { assert.equal(key, 'plugins.row.config'); callback(); },
      register(options, render) { registrations.push({ options, render }); },
    },
  });
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].options.key, 'dsh-identity-override#identity-override');
  const row = registrations[0];
  return {
    row,
    render(form) {
      cursor = 0;
      const vnode = row.render({ view: 'page', form });
      return vnode.type(vnode.props);
    },
  };
}

function findNode(tree, match) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (match(tree)) return tree;
  for (const child of tree.children ?? []) {
    const found = findNode(child, match);
    if (found) return found;
  }
  return undefined;
}

function control(tree, type, text) {
  return findNode(tree, node => node.type === type &&
    (text === undefined || node.children.includes(text)));
}

test('client default equals the Host default and row renders an editable textarea', () => {
  const ui = createUI();
  const form = { state: { status: 'ready', revision: 1, writable: true, value: {} } };
  const tree = ui.render(form);
  const input = control(tree, 'textarea');
  assert.equal(input.props.value, DEFAULT_IDENTITY);
  assert.equal(control(tree, 'button', 'Save').props.disabled, true);
  assert.equal(input.props.disabled, false);
});

test('Save writes only identityText, including line breaks and literal template braces', async () => {
  const ui = createUI();
  const updates = [];
  const form = {
    state: { status: 'ready', revision: 8, writable: true, value: {} },
    async mutate(operations, revision) {
      updates.push({ operations, revision });
      return true;
    },
  };
  const replacement = 'Agent identity\nKeep {{literal}} as text';
  control(ui.render(form), 'textarea').props.onChange({ target: { value: replacement } });
  const save = control(ui.render(form), 'button', 'Save');
  assert.equal(save.props.disabled, false);
  await save.props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(updates)), [{
    revision: 8,
    operations: [{ op: 'set', path: ['identityText'], value: replacement }],
  }]);
});

test('empty text cannot be saved; reset changes draft but requires Save', () => {
  const ui = createUI();
  const form = { state: { status: 'ready', revision: 4, writable: true, value: { identityText: 'Saved value' } } };
  control(ui.render(form), 'textarea').props.onChange({ target: { value: ' \n  ' } });
  let tree = ui.render(form);
  assert.equal(control(tree, 'button', 'Save').props.disabled, true);
  const reset = control(tree, 'button', 'Use recommended default');
  reset.props.onClick();
  tree = ui.render(form);
  assert.equal(control(tree, 'textarea').props.value, DEFAULT_IDENTITY);
  assert.equal(control(tree, 'button', 'Save').props.disabled, false);
});

test('read-only settings never enable saving', () => {
  const ui = createUI();
  const form = { state: { status: 'ready', revision: 1, writable: false, value: {} } };
  const tree = ui.render(form);
  assert.equal(control(tree, 'textarea').props.disabled, true);
  assert.equal(control(tree, 'button', 'Save').props.disabled, true);
});

function keywordInput(tree, id) {
  return findNode(tree, node => node.type === 'input' && node.props.id === id);
}

test('keyword editors appear side by side with empty disabled-rule defaults', () => {
  const ui = createUI();
  const tree = ui.render({ state: { status: 'ready', revision: 1, writable: true, value: {} } });
  const grid = findNode(tree, node => node.props?.className === 'dio-keywords');
  assert.ok(grid);
  assert.equal(grid.children.length, 2);
  assert.equal(keywordInput(tree, 'dio-keyword-find').props.value, '');
  assert.equal(keywordInput(tree, 'dio-keyword-replace').props.value, '');
  assert.equal(keywordInput(tree, 'dio-keyword-find').props.placeholder, 'DeepSeek harness');
  assert.equal(keywordInput(tree, 'dio-keyword-replace').props.placeholder, 'harness');
  assert.equal(control(tree, 'button', 'Save').props.disabled, true);
});

test('saving keyword fields leaves existing identity unchanged', async () => {
  const ui = createUI();
  const calls = [];
  const form = {
    state: { status: 'ready', revision: 7, writable: true, value: { identityText: 'Original identity' } },
    async mutate(operations, revision) { calls.push({ operations, revision }); return true; },
  };
  keywordInput(ui.render(form), 'dio-keyword-find').props.onChange({ target: { value: 'DeepSeek harness' } });
  keywordInput(ui.render(form), 'dio-keyword-replace').props.onChange({ target: { value: 'harness' } });
  const tree = ui.render(form);
  assert.equal(control(tree, 'button', 'Save').props.disabled, false);
  await control(tree, 'button', 'Save').props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{
    revision: 7,
    operations: [
      { op: 'set', path: ['keywordFind'], value: 'DeepSeek harness' },
      { op: 'set', path: ['keywordReplace'], value: 'harness' },
    ],
  }]);
});

test('a blank replacement value can be saved to delete matched terms', async () => {
  const ui = createUI();
  const calls = [];
  const form = {
    state: { status: 'ready', revision: 7, writable: true, value: { keywordFind: 'foo', keywordReplace: 'bar' } },
    async mutate(operations) { calls.push(operations); return true; },
  };
  keywordInput(ui.render(form), 'dio-keyword-replace').props.onChange({ target: { value: '' } });
  await control(ui.render(form), 'button', 'Save').props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [[
    { op: 'set', path: ['keywordReplace'], value: '' },
  ]]);
});

test('clear keyword rule resets both editors and only persists on Save', async () => {
  const ui = createUI();
  const calls = [];
  const form = {
    state: { status: 'ready', revision: 3, writable: true, value: { keywordFind: 'foo', keywordReplace: 'bar' } },
    async mutate(operations) { calls.push(operations); return true; },
  };
  const tree = ui.render(form);
  control(tree, 'button', 'Clear keyword rule').props.onClick();
  const after = ui.render(form);
  assert.equal(keywordInput(after, 'dio-keyword-find').props.value, '');
  assert.equal(keywordInput(after, 'dio-keyword-replace').props.value, '');
  assert.equal(calls.length, 0);
  await control(after, 'button', 'Save').props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [[
    { op: 'set', path: ['keywordFind'], value: '' },
    { op: 'set', path: ['keywordReplace'], value: '' },
  ]]);
});

test('simultaneous identity and keyword changes save atomically in one mutate call', async () => {
  const ui = createUI();
  const calls = [];
  const form = {
    state: { status: 'ready', revision: 9, writable: true, value: {} },
    async mutate(operations, revision) { calls.push({ operations, revision }); return true; },
  };
  control(ui.render(form), 'textarea').props.onChange({ target: { value: 'You are a new agent.' } });
  keywordInput(ui.render(form), 'dio-keyword-find').props.onChange({ target: { value: 'DeepSeek' } });
  keywordInput(ui.render(form), 'dio-keyword-replace').props.onChange({ target: { value: 'harness' } });
  await control(ui.render(form), 'button', 'Save').props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{
    revision: 9,
    operations: [
      { op: 'set', path: ['identityText'], value: 'You are a new agent.' },
      { op: 'set', path: ['keywordFind'], value: 'DeepSeek' },
      { op: 'set', path: ['keywordReplace'], value: 'harness' },
    ],
  }]);
});

test('keyword changes cannot bypass empty identity validation or read-only settings', () => {
  const ui = createUI();
  const form = { state: { status: 'ready', revision: 6, writable: true, value: {} } };
  control(ui.render(form), 'textarea').props.onChange({ target: { value: '   ' } });
  keywordInput(ui.render(form), 'dio-keyword-find').props.onChange({ target: { value: 'DeepSeek' } });
  assert.equal(control(ui.render(form), 'button', 'Save').props.disabled, true);
  const readonly = createUI();
  const readForm = { state: { status: 'ready', revision: 6, writable: false, value: {} } };
  assert.equal(keywordInput(readonly.render(readForm), 'dio-keyword-find').props.disabled, true);
  assert.equal(keywordInput(readonly.render(readForm), 'dio-keyword-replace').props.disabled, true);
  assert.equal(control(readonly.render(readForm), 'button', 'Save').props.disabled, true);
});
