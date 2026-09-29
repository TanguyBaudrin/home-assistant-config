// Test de .github/scripts/gh-pages.cjs avec un faux client REST.
const assert = require('assert');
const { fetchAll } = require('./gh-pages.cjs');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok   ${name}`); }
  catch (e) { failures++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

// Fabrique une methode liee servant `total` elements, `perPage` par page.
function fake(total) {
  const calls = [];
  const fn = async (params) => {
    calls.push(params);
    const start = (params.page - 1) * params.per_page;
    return { data: Array.from({ length: Math.max(0, Math.min(params.per_page, total - start)) },
                              (_, i) => ({ name: `item-${start + i}` })) };
  };
  fn.calls = calls;
  return fn;
}

(async () => {
  const tests = [
    ['une seule page complette', async () => {
      const fn = fake(30);
      const out = await fetchAll(fn, {});
      assert.strictEqual(out.length, 30);
      assert.strictEqual(fn.calls.length, 1);
    }],
    ['plusieurs pages', async () => {
      const fn = fake(250);
      const out = await fetchAll(fn, {});
      assert.strictEqual(out.length, 250);
      assert.strictEqual(fn.calls.length, 3);
      assert.strictEqual(out[0].name, 'item-0');
      assert.strictEqual(out[249].name, 'item-249');
    }],
    ['aucun element', async () => {
      const fn = fake(0);
      assert.deepStrictEqual(await fetchAll(fn, {}), []);
      assert.strictEqual(fn.calls.length, 1);
    }],
    ['exactement une page pleine', async () => {
      const fn = fake(100);
      const out = await fetchAll(fn, {});
      assert.strictEqual(out.length, 100);
      assert.strictEqual(fn.calls.length, 2, 'une page vide de plus est necessaire');
    }],
    ['les parametres sont propages', async () => {
      const fn = fake(5);
      await fetchAll(fn, { owner: 'o', repo: 'r' });
      assert.strictEqual(fn.calls[0].owner, 'o');
      assert.strictEqual(fn.calls[0].repo, 'r');
    }],
    ['per_page impose', async () => {
      const fn = fake(5);
      await fetchAll(fn, {}, 100);
      assert.strictEqual(fn.calls[0].per_page, 100);
    }],
    ['data non tableau : erreur explicite', async () => {
      let msg = '';
      try { await fetchAll(async () => ({ data: { bogus: true } }), {}); }
      catch (e) { msg = e.message; }
      assert.match(msg, /n'est pas un tableau/);
    }],
    ['serveur qui renvoie toujours une page pleine : borne', async () => {
      let msg = '';
      try { await fetchAll(async (p) => ({ data: Array(p.per_page).fill({}) }), {}, 100, 3); }
      catch (e) { msg = e.message; }
      assert.match(msg, /borne atteinte/);
    }],
  ];

  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  ok   ${name}`); }
    catch (e) { failures++; console.log(`  FAIL ${name}\n       ${e.message}`); }
  }
  console.log(failures ? `\n${failures} ECHEC(S)` : '\nTous les tests passent.');
  process.exit(failures ? 1 : 0);
})();
