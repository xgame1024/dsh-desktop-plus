/**
 * Configuration schema for the dsh-desktop-plus bundle.
 *
 * The dangerous switch is ON by default, and that is the lesser evil: this
 * Harness keeps an agent for every session it has opened since launch, so
 * refusing live sessions would make deletion impossible until the app restarts.
 * The trade — a deleted live row can reappear until that restart — is stated in
 * the switch's own description and in the README's known limitations.
 * Retracting a conversation message never deletes anything, so it needs no
 * destructive switch.
 * @module dsh-desktop-plus/config
 */

import z from '@deepseek-ai/schemastery'
import { ROUTE_PREFIX } from './names.js'

/**
 * HTTP path prefix every route is mounted under, re-exported for the Host half.
 * Kept in sync with `lib/client.js` by hand: the browser half of a plain-JS
 * bundle cannot import this module.
 */
export { ROUTE_PREFIX }

/** Plugin configuration schema. */
export const Config = z.object({
  allowLiveSessionDelete: z
    .boolean()
    .default(true)
    .description(
      'Allow deleting a session whose agent is still live in this Host process. On by default because this Harness keeps an agent for every session it has opened since launch: the Remote session controller drops the AgentHandle whose dispose would release it, so a session stays "live" long after its tab is closed, and refusing those would make deletion impossible until the app restarts. The trade: because that agent outlives the log, the deleted row can reappear — with nothing behind it — until the app restarts. Set it to false to refuse such sessions instead and delete only after a restart.',
    ),
})

/**
 * Normalize one raw Loader config into the detached options this bundle uses.
 * @param {object} config - the row's config as validated by {@link Config}.
 * @returns {{routePath: string, allowLiveSessionDelete: boolean}} resolved options.
 */
export function resolveOptions(config) {
  return {
    routePath: ROUTE_PREFIX,
    allowLiveSessionDelete: config?.allowLiveSessionDelete === true,
  }
}
