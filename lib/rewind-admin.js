/**
 * Conversation retraction: let the user take back one message and everything
 * after it, in place, without editing the stored log.
 *
 * The operation is one appended empty `user/message` replacement (a legal
 * surface carrier between turns; see `apply` below for why not `system/message`):
 *
 * - it shadows the clicked surface node and every surface node after it, so the
 *   model-visible history ends right before the clicked message;
 * - its content is empty, which the session layer never derives into a message
 *   and the client never renders as a prompt row;
 * - its message id carries {@link RETRACTION_MESSAGE_PREFIX}, which is how this
 *   plugin finds its own retractions again after a reload.
 *
 * Nothing is deleted: the shadowed records stay in the log, the replacement is
 * an ordinary record, and replaying the session reproduces the same shortened
 * conversation. The browser half hides the shadowed rows using the rules this
 * module returns; those rules are rebuilt from the log, so a page reload shows
 * the same shortened transcript.
 *
 * @module dsh-desktop-plus/rewind-admin
 */

import { randomUUID } from 'node:crypto'
import { errorMessage, ModError } from './session-admin.js'
import {
  RETRACTION_MESSAGE_PREFIX,
  collectRetractions,
  foldEventOrder,
  planRetraction,
  unionRules,
} from './surface-order.js'

/** Session ids the store is known to use: branded `session-<uuid>`, legacy bare uuids. */
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/u

/** Largest message id this mod accepts. */
const MAX_MESSAGE_ID_LENGTH = 256

/** The two things a per-message button can ask for. */
export const REWIND_MODES = new Set(['retract', 'edit'])

/**
 * Read one complete stored log without owning it.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} sessionId - the session to read.
 * @returns {Promise<readonly object[]>} the events.
 */
async function readStoredEvents(ctx, sessionId) {
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined) {
    throw new ModError('storage-unavailable', 'dsh-desktop-plus: this Host has no session persistence service')
  }
  let handle
  try {
    handle = await persistence.open(sessionId, 'read')
  } catch (error) {
    if (error instanceof Error && error.name === 'SessionPersistenceNotFoundError') {
      throw new ModError('session-unknown', `dsh-desktop-plus: session "${sessionId}" is not stored`, { sessionId })
    }
    throw new ModError('session-unreadable', `dsh-desktop-plus: session "${sessionId}" cannot be opened: ${errorMessage(error)}`, {
      sessionId,
    })
  }
  try {
    const result = await handle.read()
    return result.events
  } catch (error) {
    throw new ModError('session-unreadable', `dsh-desktop-plus: session "${sessionId}" cannot be read: ${errorMessage(error)}`, {
      sessionId,
    })
  } finally {
    await Promise.resolve(handle.close()).catch(() => {})
  }
}

/**
 * Read a live session's complete log.
 * @param {object} session - live Session instance.
 * @returns {readonly object[]} the events.
 */
function readLiveEvents(session) {
  if (typeof session.snapshotEvents === 'function') return session.snapshotEvents()
  const events = []
  const length = typeof session.seq === 'number' ? session.seq : 0
  for (let index = 0; index < length; index += 1) {
    const event = session.eventAt?.(index)
    if (event !== undefined) events.push(event)
  }
  return events
}

/**
 * Ask the composed providers what still runs for one session. The shipped
 * archive path reads the same waterfall before it hides a session.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} sessionId - the session to probe.
 * @returns {Promise<readonly object[]>} reported activity, empty when idle.
 */
async function sessionActivity(ctx, sessionId) {
  try {
    return await ctx.waterfall('workspace/session-activity', { sessionId }, () => Promise.resolve([]))
  } catch (error) {
    ctx.logger?.warn?.(`dsh-desktop-plus: the session-activity probe failed: ${String(error)}`)
    return []
  }
}

/**
 * Validate one raw session id.
 * @param {unknown} raw - caller-supplied id.
 * @returns {string} the validated id.
 */
function requireSessionId(raw) {
  const sessionId = typeof raw === 'string' ? raw.trim() : ''
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new ModError('session-id-invalid', `dsh-desktop-plus: ${JSON.stringify(String(raw))} is not a session id`, {
      sessionId: String(raw),
    })
  }
  return sessionId
}

/**
 * Validate one clicked message id.
 * @param {unknown} raw - caller-supplied id.
 * @returns {string} the validated id.
 */
function requireMessageId(raw) {
  const messageId = typeof raw === 'string' ? raw.trim() : ''
  if (messageId === '' || messageId.length > MAX_MESSAGE_ID_LENGTH) {
    throw new ModError('message-id-invalid', 'dsh-desktop-plus: the request carries no usable message id')
  }
  return messageId
}

/**
 * Validate one requested mode.
 * @param {unknown} raw - caller-supplied mode.
 * @returns {'retract' | 'edit'} the mode.
 */
function requireMode(raw) {
  const mode = typeof raw === 'string' ? raw : 'retract'
  if (!REWIND_MODES.has(mode)) throw new ModError('mode-invalid', `dsh-desktop-plus: unknown rewind mode "${mode}"`)
  return /** @type {'retract' | 'edit'} */ (mode)
}

/**
 * Build the retraction operations over the composed Host services.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @returns {object} `info`, `rulesFor`, `prepare`, and `apply`.
 */
export function createRewindAdmin(ctx) {
  const sessionsOf = () => ctx.get('sessions')

  /**
   * Load one session's log, preferring the live instance.
   * @param {string} sessionId - session to read.
   * @returns {Promise<{session: object | undefined, events: readonly object[]}>} the log.
   */
  async function load(sessionId) {
    const live = sessionsOf()?.get(sessionId)
    if (live !== undefined) return { session: live, events: readLiveEvents(live) }
    return { session: undefined, events: await readStoredEvents(ctx, sessionId) }
  }

  /**
   * Build one plan or explain why it is refused.
   * @param {readonly object[]} events - the complete log.
   * @param {string} sessionId - session the log belongs to.
   * @param {string} messageId - clicked message.
   * @param {'retract' | 'edit'} mode - requested action.
   * @param {{session: object | undefined, activity?: readonly object[]}} context - runtime facts.
   * @returns {object} the plan.
   */
  function buildPlan(events, sessionId, messageId, mode, context) {
    const plan = planRetraction(events, messageId)
    if (plan === undefined) {
      throw new ModError('message-unknown', `dsh-desktop-plus: session "${sessionId}" has no message "${messageId}"`, {
        sessionId,
        messageId,
      })
    }
    if (plan.alreadyRetracted === true) {
      throw new ModError('message-retracted', `dsh-desktop-plus: message "${messageId}" is already retracted`, {
        sessionId,
        messageId,
      })
    }
    if ((context.activity?.length ?? 0) > 0) {
      throw new ModError('session-active', `dsh-desktop-plus: session "${sessionId}" is still running work`, {
        sessionId,
        activity: context.activity.map((entry) => ({ kind: entry?.kind ?? 'unknown' })),
      })
    }
    if (context.session === undefined) {
      throw new ModError('session-not-live', `dsh-desktop-plus: session "${sessionId}" is not open in this Host process`, {
        sessionId,
      })
    }
    return {
      sessionId,
      messageId,
      mode,
      kind: plan.kind,
      text: plan.text,
      images: plan.images ?? [],
      turn: plan.turn,
      step: plan.step,
      startSeq: plan.startSeq,
      endSeq: plan.endSeq,
      shadowedCount: plan.shadowedCount,
      messageCount: plan.messageCount,
      removesHistory: plan.removesHistory,
      rules: plan.rules,
    }
  }

  /**
   * Rebuild the hide rules of every retraction recorded in one session.
   * @param {unknown} rawSessionId - session id.
   * @returns {Promise<{rules: {turns: number[], keys: string[]}, retractions: object[]}>} the rules.
   */
  async function rulesFor(rawSessionId) {
    const sessionId = requireSessionId(rawSessionId)
    const { events } = await load(sessionId)
    const plans = collectRetractions(events)
    return {
      sessionId,
      rules: unionRules(plans),
      retractions: plans.map((plan) => ({
        seq: plan.seq,
        kind: plan.kind,
        turn: plan.turn,
        messageCount: plan.messageCount,
      })),
    }
  }

  /**
   * Answer what a retraction would do without changing anything.
   * @param {{sessionId: unknown, messageId: unknown, mode?: unknown}} request - caller input.
   * @returns {Promise<object>} the plan.
   */
  async function prepare(request) {
    const sessionId = requireSessionId(request?.sessionId)
    const messageId = requireMessageId(request?.messageId)
    const mode = requireMode(request?.mode)
    const { session, events } = await load(sessionId)
    const activity = await sessionActivity(ctx, sessionId)
    return { plan: buildPlan(events, sessionId, messageId, mode, { session, activity }) }
  }

  /**
   * Validate the optional end of a bounded retraction: the edit flow captures the
   * tail when the user clicks edit and must not swallow messages that arrived
   * while the prompt sat in the composer.
   * @param {unknown} raw - caller-supplied surface seq.
   * @param {readonly number[]} surface - current surface seqs, in surface order.
   * @param {number} startSeq - the clicked message's seq.
   * @returns {number} the end seq to replace (the surface tail when not supplied).
   */
  function boundedEnd(raw, surface, startSeq) {
    if (raw === undefined || raw === null) return surface.at(-1)
    const endSeq = typeof raw === 'number' && Number.isInteger(raw) ? raw : Number.NaN
    if (!Number.isInteger(endSeq) || endSeq < startSeq || !surface.includes(endSeq)) {
      throw new ModError('rewind-rejected', `dsh-desktop-plus: the requested retraction end (${String(raw)}) is not a surface point of this session`, {
        startSeq,
        untilSeq: raw,
      })
    }
    return endSeq
  }

  /**
   * Append one retraction and answer the rebuilt rules.
   * @param {{sessionId: unknown, messageId: unknown, mode?: unknown, untilSeq?: unknown}} request - caller input.
   * @returns {Promise<object>} the outcome.
   */
  async function apply(request) {
    const prepared = await prepare(request)
    const plan = prepared.plan

    const session = sessionsOf()?.get(plan.sessionId)
    if (session === undefined) {
      throw new ModError('session-not-live', `dsh-desktop-plus: session "${plan.sessionId}" is not open in this Host process`, {
        sessionId: plan.sessionId,
      })
    }
    const { events } = await load(plan.sessionId)
    const range = planRetraction(events, plan.messageId)
    if (range === undefined || range.alreadyRetracted === true) {
      throw new ModError('message-retracted', `dsh-desktop-plus: message "${plan.messageId}" is no longer on the surface`, {
        sessionId: plan.sessionId,
        messageId: plan.messageId,
      })
    }
    const surface = foldEventOrder(events).nodes
    const startIdx = surface.indexOf(range.startSeq)
    if (startIdx === -1) {
      throw new ModError('message-retracted', `dsh-desktop-plus: message "${plan.messageId}" is no longer on the surface`, {
        sessionId: plan.sessionId,
        messageId: plan.messageId,
      })
    }
    // Every surface node the replacement shadows, in surface order: the append
    // requires citing all of them, and this slice is exactly that set.
    const endSeq = boundedEnd(request?.untilSeq, surface, range.startSeq)
    const endIdx = surface.indexOf(endSeq)
    const replacementSeqs = surface.slice(startIdx, endIdx + 1)
    const bounded = { ...plan, endSeq, shadowedCount: replacementSeqs.length }

    let event
    try {
      // The replacement must be a *surface* event that derives no model message.
      // An empty `system/message` was the original choice, but format v4 treats
      // it as a step event: it only validates inside an open turn+step, and a
      // retraction always happens between turns. `user/message` is a surface
      // type without that requirement, folds the surface identically, and every
      // adapter drops a user message whose content is empty — the replacement
      // never reaches a provider.
      event = session.append(
        'user/message',
        {
          id: `${RETRACTION_MESSAGE_PREFIX}${randomUUID()}`,
          role: 'user',
          content: [],
          source: { kind: 'user' },
        },
        {
          surfaceOp: { op: 'replace', startSeq: range.startSeq, endSeq },
          sourceEventSeqs: replacementSeqs,
        },
      )
    } catch (error) {
      throw new ModError('rewind-rejected', `dsh-desktop-plus: the Host rejected this retraction: ${errorMessage(error)}`, {
        sessionId: plan.sessionId,
        messageId: plan.messageId,
      })
    }

    try {
      await ctx.get('sessions')?.flush?.(session)
    } catch (error) {
      ctx.logger?.warn?.(`dsh-desktop-plus: flushing the retraction failed: ${errorMessage(error)}`)
    }

    ctx.logger?.info?.(
      `dsh-desktop-plus: retracted ${bounded.shadowedCount} surface node(s) in session "${plan.sessionId}" from seq ${range.startSeq} to ${endSeq} (${plan.kind})`,
    )
    const plans = collectRetractions(readLiveEvents(session))
    return {
      plan: bounded,
      applied: true,
      retractionSeq: event?.seq,
      rules: unionRules(plans),
      retractions: plans.map((item) => ({ seq: item.seq, kind: item.kind, turn: item.turn, messageCount: item.messageCount })),
    }
  }

  /** Report the mounted capability so the browser half can fail fast. */
  function info() {
    return {
      mod: 'dsh-desktop-plus',
      features: ['session-delete', 'message-rewind'],
      sessionListAvailable: sessionsOf() !== undefined,
    }
  }

  return { info, rulesFor, prepare, apply }
}
