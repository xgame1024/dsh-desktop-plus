/**
 * `dsh-desktop-plus`: session and conversation control for DeepSeek Harness.
 *
 * The Host half of this bundle owns the operations that need the Host's file
 * system, registry, and session-log access. The Web client half
 * (`lib/client.js`) renders the affordances and calls these routes.
 *
 * Workspace session deletion. Archiving only hides a session, so
 * this mod adds the missing operation: permanently delete one session's stored
 * log and clear every durable record that points at it.
 *
 * Per-message conversation retraction. A conversation message can be
 * taken back together with everything after it: the Host appends one surface
 * replacement that shadows that tail from the model-visible history, and the
 * browser half hides the shadowed rows and puts a retracted user prompt back
 * into the composer for editing. Stored history is never rewritten.
 *
 * @module dsh-desktop-plus
 */

import { Config, resolveOptions } from './config.js'
import { errorMessage, ModError, createSessionAdmin } from './session-admin.js'
import { createRewindAdmin } from './rewind-admin.js'
import { PACKAGE_NAME, REQUEST_HEADER, ROW_ID } from './names.js'

/** Plugin name used by the loader. */
export const name = ROW_ID

export { Config }

/** Header the browser half sends; a cross-origin caller cannot set it without a preflight this route never answers. */
export { REQUEST_HEADER }

/**
 * Largest request body this mod accepts, in bytes.
 *
 * Sized for a batch delete: 200 session ids of 44 characters plus JSON
 * punctuation stays well below this, while an accidental upload still fails
 * fast.
 */
const MAX_BODY_BYTES = 32768

/**
 * Keys a response never carries.
 *
 * A Host directory path names the operator's account, and the browser has no use
 * for one: every field it reads is an id, a byte count or a decision. The path
 * still reaches the Host log, which is where an operator looks for it.
 */
const PRIVATE_KEYS = new Set(['logDirectory', 'directory'])

/**
 * Copy a response value without its filesystem paths.
 * @param {unknown} value - any JSON-serializable response value.
 * @returns {unknown} the same value, with {@link PRIVATE_KEYS} removed at every depth.
 */
function withoutPaths(value) {
  if (Array.isArray(value)) return value.map(withoutPaths)
  if (value === null || typeof value !== 'object') return value
  const copy = {}
  for (const [key, item] of Object.entries(value)) {
    if (PRIVATE_KEYS.has(key)) continue
    copy[key] = withoutPaths(item)
  }
  return copy
}

/**
 * Write one JSON response.
 * @param {import('node:http').ServerResponse} response - the response.
 * @param {number} status - HTTP status.
 * @param {unknown} value - JSON-serializable body.
 */
function writeJson(response, status, value) {
  if (response.headersSent) return
  const body = JSON.stringify(withoutPaths(value))
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

/**
 * Read a size-bounded request body as JSON.
 * @param {import('node:http').IncomingMessage} request - the request.
 * @returns {Promise<unknown>} the parsed body.
 */
async function readJsonBody(request) {
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > MAX_BODY_BYTES) throw new ModError('body-too-large', 'dsh-desktop-plus: the request body is too large')
    chunks.push(chunk)
  }
  if (bytes === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new ModError('body-invalid', 'dsh-desktop-plus: the request body is not JSON')
  }
}

/**
 * Whether a request may change Host state.
 *
 * Two cheap gates, both of which a hostile web page fails while the app's own
 * page passes: a custom header (a cross-origin request carrying it needs a
 * preflight this mod never answers) and, when the browser sends one, an Origin
 * whose host matches the server's own origin.
 *
 * @param {import('node:http').IncomingMessage} request - the request.
 * @param {string} origin - the Web server's own origin.
 * @returns {boolean} whether the request is admitted.
 */
function admitted(request, origin) {
  if (request.headers[REQUEST_HEADER] !== '1') return false
  const reported = request.headers.origin
  if (typeof reported !== 'string' || reported === '') return true
  try {
    return new URL(reported).host === new URL(origin).host
  } catch {
    return false
  }
}

/**
 * Map one failure onto a status and a stable code.
 * @param {unknown} error - anything thrown by the operations.
 * @returns {{status: number, body: object}} the response.
 */
function failureOf(error) {
  if (error instanceof ModError) {
    const status =
      error.code === 'session-live' ||
      error.code === 'session-active' ||
      error.code === 'session-not-live' ||
      error.code === 'message-retracted'
        ? 409
        : error.code === 'session-unknown' || error.code === 'message-unknown'
          ? 404
          : error.code === 'forbidden'
            ? 403
            : 400
    return { status, body: { ok: false, code: error.code, message: error.message, details: error.details } }
  }
  return { status: 500, body: { ok: false, code: 'internal', message: errorMessage(error) } }
}

/**
 * Describe the browser half's composed module, when the Host exposes its client
 * module registry. Used by the diagnostics route only.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @returns {object} composition facts.
 */
function describeClientModule(ctx) {
  try {
    const modules = ctx.get('clientModules')
    if (modules === undefined) return { available: false }
    const clientPath = typeof modules.clientPath === 'function' ? modules.clientPath(PACKAGE_NAME) ?? null : null
    const graph = typeof modules.graph === 'function' ? modules.graph() : undefined
    const entries = Array.isArray(graph?.entries) ? graph.entries : []
    const row = entries.find((entry) => entry?.id === PACKAGE_NAME) ?? null
    return {
      available: true,
      clientPath,
      graphRow: row === null ? null : {
        id: row.id,
        rev: row.rev,
        immediately: row.immediately === true,
        inject: Array.isArray(row.inject) ? row.inject : [],
      },
    }
  } catch (error) {
    return { available: false, error: errorMessage(error) }
  }
}

/**
 * Mount this bundle's routes.
 * @param {import('@deepseek-ai/cordis').Context} ctx - the plugin context.
 * @param {object} config - the row's config, validated by {@link Config}.
 */
export function apply(ctx, config) {
  const options = resolveOptions(config)
  const admin = createSessionAdmin(ctx, options)
  const rewind = createRewindAdmin(ctx)

  /** Latest browser-half activation reports, newest last. */
  const clientReports = []

  ctx.inject(['webServer'], (web) => {
    /**
     * Register one exact route. The Web server refuses a duplicate
     * `(kind, path)`, so one path is registered exactly once and the wrapper
     * dispatches by method.
     * @param {string} path - pathname.
     * @param {string | string[]} methods - the accepted method(s).
     * @param {(request: object, response: object) => Promise<void>} handler - the handler.
     * @param {string} label - plugin effect label.
     */
    const route = (path, methods, handler, label) => {
      const allowed = Array.isArray(methods) ? methods : [methods]
      try {
        web.effect(
          () =>
            web.webServer.register({
              kind: 'exact',
              path,
              handler: (request, response) => {
                if (!allowed.includes(request.method)) {
                  response.writeHead(405, { allow: allowed.join(', ') })
                  response.end()
                  return
                }
                return handler(request, response)
              },
            }),
          label,
        )
      } catch (error) {
        // One refused route must never take the whole plugin (and its other
        // features) down; the failure is named in the Host log instead.
        ctx.logger?.error?.(`dsh-desktop-plus: cannot mount ${path}: ${errorMessage(error)}`)
      }
    }

    /**
     * The Web server's own origin, for the admission check.
     * @returns {string} the origin, or an empty string when unavailable.
     */
    const origin = () => {
      try {
        return web.webServer.getOrigin()
      } catch {
        return ''
      }
    }

    route(`${options.routePath}/info`, 'GET', async (request, response) => {
      writeJson(response, 200, {
        ok: true,
        ...admin.info(),
        rewind: {
          ...rewind.info(),
          routePath: options.routePath,
        },
        client: {
          reports: clientReports.slice(-10),
          module: describeClientModule(ctx),
        },
      })
    }, 'dsh-desktop-plus: info route')

    // The browser half reports its own activation here. It exists so a broken
    // client bundle can be told apart from a missing Host route without opening
    // developer tools on the user's machine. One path, two methods: the Web
    // server rejects a duplicate (kind, path) registration outright.
    route(`${options.routePath}/client-report`, ['GET', 'POST'], async (request, response) => {
      if (request.method === 'GET') {
        writeJson(response, 200, { ok: true, reports: clientReports, clientModule: describeClientModule(ctx) })
        return
      }
      if (!admitted(request, origin())) {
        writeJson(response, 403, { ok: false, code: 'forbidden', message: 'dsh-desktop-plus: this request is not admitted' })
        return
      }
      try {
        const body = await readJsonBody(request)
        clientReports.push({ ...(typeof body === 'object' && body !== null ? body : { value: body }), receivedAt: Date.now() })
        if (clientReports.length > 40) clientReports.shift()
        writeJson(response, 200, { ok: true })
      } catch (error) {
        const failure = failureOf(error)
        writeJson(response, failure.status, failure.body)
      }
    }, 'dsh-desktop-plus: client report route')

    route(`${options.routePath}/sessions/delete`, 'POST', async (request, response) => {
      if (!admitted(request, origin())) {
        writeJson(response, 403, { ok: false, code: 'forbidden', message: 'dsh-desktop-plus: this request is not admitted' })
        return
      }
      try {
        const body = await readJsonBody(request)
        // A `sessionIds` array is the batch form: one request from the
        // multi-select bar, answered per session so one failed row never
        // hides the rest. Anything else is one session.
        if (Array.isArray(body?.sessionIds)) {
          const result = await admin.deleteMany(body.sessionIds)
          writeJson(response, 200, { ok: true, ...result })
          return
        }
        const result = await admin.deleteSession(body?.sessionId)
        writeJson(response, 200, { ok: true, ...result })
      } catch (error) {
        const failure = failureOf(error)
        writeJson(response, failure.status, failure.body)
      }
    }, 'dsh-desktop-plus: session delete route')

    route(`${options.routePath}/rewind/rules`, 'GET', async (request, response) => {
      try {
        const url = new URL(request.url ?? '/', 'http://localhost')
        const result = await rewind.rulesFor(url.searchParams.get('sessionId'))
        writeJson(response, 200, { ok: true, ...result })
      } catch (error) {
        const failure = failureOf(error)
        writeJson(response, failure.status, failure.body)
      }
    }, 'dsh-desktop-plus: rewind rules route')

    route(`${options.routePath}/rewind/prepare`, 'POST', async (request, response) => {
      if (!admitted(request, origin())) {
        writeJson(response, 403, { ok: false, code: 'forbidden', message: 'dsh-desktop-plus: this request is not admitted' })
        return
      }
      try {
        const body = await readJsonBody(request)
        writeJson(response, 200, { ok: true, ...(await rewind.prepare(body)) })
      } catch (error) {
        const failure = failureOf(error)
        writeJson(response, failure.status, failure.body)
      }
    }, 'dsh-desktop-plus: rewind prepare route')

    route(`${options.routePath}/rewind`, 'POST', async (request, response) => {
      if (!admitted(request, origin())) {
        writeJson(response, 403, { ok: false, code: 'forbidden', message: 'dsh-desktop-plus: this request is not admitted' })
        return
      }
      try {
        const body = await readJsonBody(request)
        writeJson(response, 200, { ok: true, ...(await rewind.apply(body)) })
      } catch (error) {
        const failure = failureOf(error)
        writeJson(response, failure.status, failure.body)
      }
    }, 'dsh-desktop-plus: rewind route')

  })
}
