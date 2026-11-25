/**
 * The names this bundle wears, in one place.
 *
 * The two halves of the package disagree about what they can import: the Web
 * client half is a plain-JS factory the browser's module loader evaluates with
 * its own `require()`, so it repeats the route prefix and header as literals
 * under a comment that names this file. Everything the Host half says about
 * itself comes from here.
 *
 * Retraction rows are persisted in session logs. New rows use
 * {@link RETRACTION_MESSAGE_PREFIX}; earlier builds used
 * {@link LEGACY_RETRACTION_MESSAGE_PREFIXES}, which remain readable so old
 * sessions keep their hidden rows.
 *
 * @module dsh-desktop-plus/names
 */

/** npm package name, which is also the client module-graph row id. */
export const PACKAGE_NAME = 'dsh-desktop-plus'

/** Loader row id: what the bundle patch inserts, and what config overrides address. */
export const ROW_ID = 'dsh-desktop-plus'

/** Path prefix every HTTP route is mounted under. */
export const ROUTE_PREFIX = '/dsh-desktop-plus'

/** Header the browser half sends on mutating requests; a cross-site page cannot set it. */
export const REQUEST_HEADER = 'x-dsh-desktop-plus'

/** Message id prefix for new retraction replacements. */
export const RETRACTION_MESSAGE_PREFIX = 'dsh-desktop-plus-retract-'

/** Prefixes written by earlier builds; read-only compatibility for old logs. */
export const LEGACY_RETRACTION_MESSAGE_PREFIXES = ['editor-pro-retract-']
