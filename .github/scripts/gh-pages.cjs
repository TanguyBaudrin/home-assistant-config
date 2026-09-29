// Pagination explicite pour les scripts GitHub Actions.
//
// Pourquoi ne pas utiliser `github.paginate` : le plugin de pagination n'a pas
// livre d'elements dans le contexte de `actions/github-script`, ce qui faisait
// croire qu'une etiquette existait deja n'existait pas, et l'API repondait
// 422. Un script qui croit a tort qu'une ressource est absente est un script
// qui echoue de facon incomprehensible, donc on appelle directement la methode
// REST et on boucle sur `page` nous-memes.
//
// Utilisation :
//   const { fetchAll } = require('./.github/scripts/gh-pages.cjs');
//   const comments = await fetchAll(github.rest.issues.listComments, pr);

/**
 * Recupere toutes les pages d'un endpoint REST lie.
 *
 * @param {Function} fn methode liee, ex. octokit.rest.issues.listComments
 * @param {object} params parametres de l'appel (sans per_page ni page)
 * @param {number} perPage taille de page
 * @param {number} maxPages garde-fou contre une boucle sans fin
 * @returns {Promise<Array<any>>} tous les elements concatenes
 */
async function fetchAll(fn, params = {}, perPage = 100, maxPages = 50) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await fn({ ...params, per_page: perPage, page });
    const data = res.data;
    if (!Array.isArray(data)) {
      throw new Error('Reponse inattendue : data n\'est pas un tableau.');
    }
    out.push(...data);
    if (data.length < perPage) return out;
  }
  throw new Error(`Pagination non terminee apres ${maxPages} pages : borne atteinte.`);
}

module.exports = { fetchAll };
