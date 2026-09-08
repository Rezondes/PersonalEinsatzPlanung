import type { Plugin } from 'vite';

/**
 * Removes HTML comments from the built index.html.
 *
 * Vite ships index.html's comments verbatim, so everything written there is one "view source" away
 * for every visitor, internal file paths included. The comments themselves are worth keeping in the
 * SOURCE though: the CSP is exactly the kind of line someone loosens without thinking, and the
 * reasoning standing right next to it is what prevents that. Moving the prose into a CLAUDE.md
 * would lose that proximity, so it stays where it guards and is dropped on the way out.
 *
 * Build only - during `vite dev` nothing is served from disk anyway and the comments are welcome.
 * `enforce: 'post'` so this runs after vite-plugin-pwa has injected its manifest link.
 */
export function stripHtmlComments(): Plugin {
  return {
    name: 'pep-strip-html-comments',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      // Non-greedy up to the first "-->", so two comments never merge into one match.
      // <!doctype html> is not a comment and is left alone.
      return html.replace(/\n?[ \t]*<!--[\s\S]*?-->/g, '');
    },
  };
}
