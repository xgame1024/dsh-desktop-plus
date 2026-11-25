/**
 * The one implementation of "permanently delete one workspace session".
 *
 * DSH has no delete for sessions: archiving only hides one, and the persistence
 * seam exposes create/open/flush/stat/list with no removal verb. So this module
 * performs the two moves a real delete needs:
 *
 * 1. remove the session's stored log directory from the JSONL backend
 *    (`<root>/<project>/<sessionId>/session.v*.jsonl.zstd`),
 * 2. remove its projection-cache checkpoint
 *    (`<dshHome>/storages/session_projcache/sessions/<id>.json`), and
 * 3. clear every durable record that still points at the id — the owning
 *    Workspace's ordered session account, plus the registry-global archive and
 *    pin sets — and announce the departure with `api-session/removed` so a
 *    browser that already holds the row drops it.
 *
 * The persistence backend scans directories on every `list()`/`stat()`, so the
 * session is gone from the Host's own listings the moment the directory is
 * removed; no restart is involved.
 *
 * Two states are refused because deleting under them leaves the app holding
 * half a session:
 * - running work (a turn, a job, a subagent, a terminal), and
 * - a live agent, unless `allowLiveSessionDelete` is on. DSH keeps an agent for
 *   every session the client still retains, so such a session would reappear on
 *   the next page load even though its log is gone. The switch is on by default
 *   because refusing them would block deletion until the app restarts; turning
 *   it off makes the Host refuse instead of leaving that half-session behind.
 *
 * @module dsh-desktop-plus/session-admin
 */

import { readdir, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join } from 'node:path'

/** Session ids the store is known to use: branded `session-<uuid>`, legacy bare uuids. */
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/u

/**
 * Most sessions one batch call may address.
 *
 * The browser sends every id in one request body and the whole batch is
 * inspected before anything is removed, so a selection beyond this bound is far
 * more likely to be a slip than an intent: it is refused instead of becoming a
 * long delete the user cannot review.
 */
export const BATCH_SESSION_LIMIT = 200

/** A failure with a stable wire code the browser half maps to localized text. */
export class ModError extends Error {
  /**
   * @param {string} code - stable machine code, e.g. `session-live`.
   * @param {string} message - English diagnostic for logs and the UI fallback.
   * @param {object} [details] - extra structured context.
   */
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'ModError'
    this.code = code
    this.details = details
  }
}

/**
 * Resolve the directory that owns one session's stored log.
 *
 * The JSONL backend reports `{ kind: 'jsonl', path }` where `path` is the
 * current generation FILE (for example `.../<id>/session.v4.jsonl.zstd`). The
 * directory is therefore its parent, and it must be named exactly after the
 * session id: a misreported location can then never widen the recursive delete
 * above the session's own directory.
 *
 * @param {{kind: string, path: string} | undefined} location - snapshot location.
 * @param {string} sessionId - the session the location must belong to.
 * @returns {string | undefined} the session directory, or undefined when unresolvable.
 */
export function sessionDirectoryFrom(location, sessionId) {
  const reported = typeof location?.path === 'string' ? location.path : ''
  if (reported === '' || !isAbsolute(reported)) return undefined
  const candidate = basename(reported) === sessionId ? reported : dirname(reported)
  if (basename(candidate) !== sessionId) return undefined
  if (candidate === dirname(candidate)) return undefined
  return candidate
}

/**
 * Resolve one session's persisted projection-cache file.
 *
 * DSH keeps the cache under `<dshHome>/storages/session_projcache/sessions/`
 * (`per-record` layout, one JSON document per session). The cache is derived
 * state: removing it only costs a tail replay on the next open, never data.
 * The log directory is `<dshHome>/sessions/<project>/<sessionId>`, so the home
 * can be recovered from the stored location when the log still exists.
 *
 * @param {string} sessionId - validated session id.
 * @param {string} [dshHome] - DSH home; defaults to `$DSH_HOME` or `~/.dsh`.
 * @returns {string} absolute path of the cache document.
 */
export function projectionCachePathFor(sessionId, dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')) {
  return join(dshHome, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)
}

/**
 * Recover the DSH home from one session's stored log directory.
 * @param {string | undefined} logDirectory - `<dshHome>/sessions/<project>/<id>`.
 * @returns {string | undefined} the DSH home.
 */
function dshHomeFromLogDirectory(logDirectory) {
  return logDirectory === undefined ? undefined : dirname(dirname(dirname(logDirectory)))
}

/**
 * Sum the bytes stored under one session directory. Best effort: an unreadable
 * entry contributes nothing.
 * @param {string} directory - session directory.
 * @returns {Promise<number>} stored bytes.
 */
async function measureDirectory(directory) {
  let total = 0
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      try {
        if (entry.isFile()) total += (await stat(path)).size
      } catch {
        // A file that vanished or cannot be read contributes nothing.
      }
    }
  } catch {
    // An unreadable directory contributes nothing.
  }
  return total
}

/**
 * Build the session-deletion operations over the composed Host services.
 *
 * Both methods are safe to call from more than one caller; the mutation path is
 * the only place that touches disk and registry state.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {{routePath: string, allowLiveSessionDelete: boolean}} options - resolved config.
 * @returns {{info: () => object, inspect: (sessionId: string) => Promise<object>, inspectMany: (sessionIds: string[]) => Promise<object>, deleteSession: (sessionId: string) => Promise<object>, deleteMany: (sessionIds: string[]) => Promise<object>}} the operations.
 */
export function createSessionAdmin(ctx, options) {
  const registryOf = () => ctx.get('workspaceRegistry')
  const persistenceOf = () => ctx.get('sessionPersistence')

  /**
   * Validate one raw session id.
   * @param {unknown} raw - caller-supplied id.
   * @returns {string} the validated id.
   */
  function requireSessionId(raw) {
    const sessionId = typeof raw === 'string' ? raw.trim() : ''
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      throw new ModError('session-id-invalid', `dsh-desktop-plus: ${JSON.stringify(String(raw))} is not a session id`, { sessionId: String(raw) })
    }
    return sessionId
  }

  /**
   * Validate one batch of raw session ids.
   *
   * A malformed list is a caller bug and fails the whole call; a single bad id
   * inside a well-formed list is answered per item by `inspectMany`, so one
   * stale row never blocks the rest of the selection.
   * @param {unknown} raw - caller-supplied ids.
   * @returns {string[]} the unique, trimmed ids, in the order given.
   */
  function requireBatchIds(raw) {
    if (!Array.isArray(raw)) {
      throw new ModError('batch-invalid', 'dsh-desktop-plus: sessionIds must be an array of session ids')
    }
    const ids = []
    for (const item of raw) {
      if (typeof item !== 'string') {
        throw new ModError('batch-invalid', 'dsh-desktop-plus: sessionIds must contain only strings')
      }
      const id = item.trim()
      if (id !== '' && !ids.includes(id)) ids.push(id)
    }
    if (ids.length === 0) {
      throw new ModError('batch-empty', 'dsh-desktop-plus: no session id was given')
    }
    if (ids.length > BATCH_SESSION_LIMIT) {
      throw new ModError('batch-too-large', `dsh-desktop-plus: at most ${BATCH_SESSION_LIMIT} sessions can be deleted at once`, {
        limit: BATCH_SESSION_LIMIT,
        requested: ids.length,
      })
    }
    return ids
  }

  /**
   * Decide whether one inspected session may be deleted under the current
   * policy. The single source of truth for both the plan the browser shows and
   * the mutation itself.
   * @param {object} plan - an `inspect()` result.
   * @returns {{allowed: boolean, reason: string | null}} the decision.
   */
  function decisionFor(plan) {
    // Without the persistence service nothing can tell "the log is already gone"
    // apart from "this Host cannot look", so the two must not be conflated: an
    // absent service refuses instead of reporting a delete that removed nothing.
    if (plan.persistenceAvailable === false) return { allowed: false, reason: 'session-log-unresolved' }
    // Nothing on disk means the log is already gone (an earlier delete, or
    // another tool): only stale bookkeeping can remain, and clearing that is
    // safe even for a live session, so it is always allowed.
    if (!plan.stored) {
      const stale = plan.workspaceIds.length > 0 || plan.archived || plan.pinned
      return stale ? { allowed: true, reason: null } : { allowed: false, reason: 'session-unknown' }
    }
    if (plan.live && options.allowLiveSessionDelete !== true) return { allowed: false, reason: 'session-live' }
    if (plan.logDirectory === undefined) return { allowed: false, reason: 'session-log-unresolved' }
    return { allowed: true, reason: null }
  }

  /**
   * Read everything a delete would act on, without changing anything.
   * @param {unknown} raw - caller-supplied session id.
   * @returns {Promise<object>} the plan.
   */
  async function inspect(raw) {
    const sessionId = requireSessionId(raw)
    const persistence = persistenceOf()
    const registry = registryOf()
    const live = ctx.get('agents')?.get(sessionId) !== undefined
    const snapshot = persistence === undefined ? undefined : await persistence.stat(sessionId)
    const directory = snapshot === undefined ? undefined : sessionDirectoryFrom(snapshot.location, sessionId)
    const owners = (registry?.list() ?? []).filter((workspace) => workspace.sessionIds.includes(sessionId))
    const plan = {
      sessionId,
      live,
      stored: snapshot !== undefined,
      persistenceAvailable: persistence !== undefined,
      logDirectory: directory,
      logBytes: directory === undefined ? 0 : await measureDirectory(directory),
      workspaceIds: owners.map((workspace) => String(workspace.id)),
      archived: registry?.archivedSessionIds.includes(sessionId) === true,
      pinned: registry?.pinnedSessionIds.includes(sessionId) === true,
    }
    const decision = decisionFor(plan)
    return { ...plan, canDelete: decision.allowed, blockedReason: decision.reason }
  }

  /**
   * Permanently delete one session: its stored log and every durable record
   * that points at it.
   *
   * The log removal runs first because it is the only irreversible step: a
   * failure there is thrown with every record still pointing at the session, so
   * the operator can see the row and retry. Registry cleanup follows, and a
   * failure in that half becomes a warning rather than a rollback — the log is
   * already gone, so a leftover reference is a stale row, not a lost session.
   *
   * @param {unknown} raw - caller-supplied session id.
   * @returns {Promise<object>} the outcome, including warnings for partial cleanup.
   */
  async function deleteSession(raw) {
    const plan = await inspect(raw)
    const { sessionId } = plan
    if (!plan.canDelete) throw blocked(plan.blockedReason, sessionId)

    const warnings = []

    // Remove the stored log first: it is the step that cannot be undone, so it
    // runs before any registry write. A refusal or a failure here therefore
    // leaves every record — workspace, archive set, pin set — exactly as it was,
    // instead of leaving a session that vanished from every surface while its
    // log stayed on disk.
    let logRemoved = false
    if (plan.logDirectory !== undefined) {
      try {
        await rm(plan.logDirectory, { recursive: true, force: true })
        logRemoved = true
      } catch (error) {
        // The path stays in the Host log; the wire carries only the code, because
        // an fs message would report the operator's account to the page.
        ctx.logger?.error?.(`dsh-desktop-plus: removing "${plan.logDirectory}" failed: ${errorMessage(error)}`)
        throw new ModError('session-delete-failed', `dsh-desktop-plus: removing the stored log failed: ${failureCode(error)}`, {
          sessionId,
          cause: failureCode(error),
        })
      }
    }

    // Drop the id from every workspace that accounts for it, so no grouping
    // surface keeps a row whose log is gone. This runs whether or not the
    // session still has a live agent: a Harness that has opened the session
    // keeps that agent until the process exits, so "live" says nothing about
    // whether a surface is showing it.
    for (const workspaceId of plan.workspaceIds) {
      const workspace = registryOf()?.get(workspaceId)
      if (workspace === undefined) {
        warnings.push({ code: 'workspace-missing', workspaceId })
        continue
      }
      try {
        await workspace.detachSession(sessionId)
      } catch (error) {
        warnings.push({ code: 'workspace-detach-failed', workspaceId, message: errorMessage(error) })
      }
    }
    try {
      await registryOf()?.unarchiveSession(sessionId)
    } catch (error) {
      warnings.push({ code: 'unarchive-failed', message: errorMessage(error) })
    }
    try {
      await registryOf()?.unpinSession(sessionId)
    } catch (error) {
      warnings.push({ code: 'unpin-failed', message: errorMessage(error) })
    }

    // Drop the derived projection checkpoint too. It is keyed by session id and
    // would otherwise outlive the log; DSH tolerates the stale row (it is a
    // cache), but a "permanent delete" should not leave it behind.
    let projectionCacheRemoved = false
    try {
      await rm(projectionCachePathFor(sessionId, dshHomeFromLogDirectory(plan.logDirectory)), { force: true })
      projectionCacheRemoved = true
    } catch (error) {
      ctx.logger?.error?.(`dsh-desktop-plus: removing the projection cache failed: ${errorMessage(error)}`)
      warnings.push({ code: 'projection-cache-delete-failed', message: failureCode(error) })
    }

    // Any browser that fetched the list before the log disappeared still holds
    // this row (and a live agent keeps it in the Host's own list too); this
    // event is what removes that stale summary.
    try {
      ctx.emit('api-session/removed', sessionId)
    } catch (error) {
      warnings.push({ code: 'removed-event-failed', message: errorMessage(error) })
    }

    ctx.logger?.info?.(
      `dsh-desktop-plus: deleted session "${sessionId}" (log ${logRemoved ? 'removed' : 'absent'}, cache ${projectionCacheRemoved ? 'removed' : 'kept'}, live ${plan.live ? 'yes' : 'no'}, workspaces ${plan.workspaceIds.length})`,
    )
    return { ...plan, deleted: true, logRemoved, projectionCacheRemoved, warnings }
  }

  /**
   * Read what a batch delete would act on, without changing anything.
   *
   * Every id is answered: either the same plan `inspect()` produces, or a
   * refusal carrying the code the browser maps to localized text. One invalid id
   * therefore shows up as one blocked row instead of failing the selection.
   * @param {unknown} raw - caller-supplied session ids.
   * @returns {Promise<{plans: object[]}>} one plan per id, in the order given.
   */
  async function inspectMany(raw) {
    const ids = requireBatchIds(raw)
    const plans = []
    for (const id of ids) {
      try {
        plans.push(await inspect(id))
      } catch (error) {
        plans.push({
          sessionId: id,
          canDelete: false,
          blockedReason: error instanceof ModError ? error.code : 'session-delete-failed',
          message: errorMessage(error),
          logBytes: 0,
          stored: false,
          live: false,
          workspaceIds: [],
          archived: false,
          pinned: false,
        })
      }
    }
    return { plans }
  }

  /**
   * Permanently delete a batch of sessions, one at a time.
   *
   * The batch is inspected first so the caller learns every refusal before a
   * single log is removed. Each delete then re-inspects inside
   * `deleteSession()`, because a session can start running between the preview
   * and the click: the single-session policy stays the only judge.
   *
   * A refused or failed row never stops the batch; each one is reported with its
   * own code, so "deleted 4 of 6" stays answerable.
   * @param {unknown} raw - caller-supplied session ids.
   * @returns {Promise<object>} the per-session outcomes plus their totals.
   */
  async function deleteMany(raw) {
    const preflight = await inspectMany(raw)
    const results = []
    for (const plan of preflight.plans) {
      if (plan.canDelete !== true) {
        results.push({ ...plan, deleted: false, skipped: true, failed: false })
        continue
      }
      try {
        results.push({ ...(await deleteSession(plan.sessionId)), skipped: false, failed: false })
      } catch (error) {
        results.push({
          ...plan,
          canDelete: false,
          blockedReason: error instanceof ModError ? error.code : 'session-delete-failed',
          message: errorMessage(error),
          deleted: false,
          skipped: false,
          failed: true,
        })
      }
    }
    return {
      deleted: results.filter((row) => row.deleted === true).length,
      skipped: results.filter((row) => row.skipped === true).length,
      failed: results.filter((row) => row.failed === true).length,
      results,
    }
  }

  /**
   * Project one policy refusal into the error vocabulary the browser maps.
   * @param {string | null} reason - the decision's reason.
   * @param {string} sessionId - the session.
   * @returns {ModError} the failure to throw.
   */
  function blocked(reason, sessionId) {
    switch (reason) {
      case 'session-live':
        return new ModError('session-live', `dsh-desktop-plus: session "${sessionId}" still has a live agent and allowLiveSessionDelete is off`, { sessionId })
      case 'session-log-unresolved':
        return new ModError('session-log-unresolved', `dsh-desktop-plus: the stored location of session "${sessionId}" cannot be resolved to a session directory`, { sessionId })
      default:
        return new ModError('session-unknown', `dsh-desktop-plus: session "${sessionId}" is neither stored nor accounted by any workspace`, { sessionId })
    }
  }

  /** Report the mounted capability so the browser half can fail fast. */
  function info() {
    return {
      mod: 'dsh-desktop-plus',
      features: ['session-delete', 'session-delete-batch'],
      routePath: options.routePath,
      allowLiveSessionDelete: options.allowLiveSessionDelete,
      storageAvailable: persistenceOf() !== undefined,
      registryAvailable: registryOf() !== undefined,
    }
  }

  return { info, inspect, inspectMany, deleteSession, deleteMany }
}

/**
 * Read one failure as text.
 * @param {unknown} error - anything thrown.
 * @returns {string} a message.
 */
export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Read one filesystem failure as the code that goes over the wire.
 *
 * Node's fs errors embed the absolute path in their message
 * (`ENOENT: no such file or directory, lstat 'C:\Users\…'`), and every warning
 * this module returns reaches the browser. The code alone says what happened;
 * the full text stays in the Host log, where an operator looks for it.
 * @param {unknown} error - a thrown filesystem failure.
 * @returns {string} its code, e.g. `EPERM`, or `fs-error` when it carries none.
 */
export function failureCode(error) {
  return typeof error?.code === 'string' ? error.code : 'fs-error'
}
