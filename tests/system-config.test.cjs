const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const configPath = path.join(__dirname, '../system-config.js');

test('identity and theme changes reach the browser without changing business rules', () => {
  const original = fs.readFileSync(configPath, 'utf8');
  const properties = new Map();
  const textNode = { dataset: { brandText: 'name' } };
  const imageNode = { dataset: { brandImage: 'logoDark' } };
  let ready;
  const document = {
    documentElement: { style: { setProperty: (key, value) => properties.set(key, value) } },
    addEventListener: (event, fn) => { if (event === 'DOMContentLoaded') ready = fn; },
    querySelectorAll: selector => selector === '[data-brand-text]' ? [textNode] : [imageNode]
  };
  const source = original.replace("name: 'NEXO'", "name: 'Marca de teste'").replace("primary: '#214E49'", "primary: '#245544'");
  const context = vm.createContext({ document });
  vm.runInContext(source, context);
  ready();
  assert.equal(document.title, 'Marca de teste · Grupos & Eventos');
  assert.equal(textNode.textContent, 'Marca de teste');
  assert.equal(imageNode.alt, 'Marca de teste');
  assert.equal(properties.get('--theme-primary'), '#245544');
  assert.equal(properties.get('--theme-primary-rgb'), '36 85 68');
  assert.equal(properties.get('--theme-primary-channels'), '36, 85, 68');
  assert.equal(context.EventSystem.config.storage.draftPrefix, 'paytrack_demo_draft_');
});

test('every application entry loads identity before UI and preserves operational configuration', () => {
  const root = path.join(__dirname, '..');
  for (const file of ['index.html', 'portal.html', 'team.html']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(source.includes('src="./system-config.js"'), file);
  }
  const config = require(configPath);
  assert.equal(config.operation.contactEmail, '');
  assert.ok(config.operation.quoteDeadline);
  for (const key of ['logoLight', 'logoDark', 'symbol', 'heroImage', 'editorialImage']) {
    assert.ok(fs.existsSync(path.resolve(root, config.brand[key])), key);
  }
});
