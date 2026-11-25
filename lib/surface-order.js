/**
 * Surface-order arithmetic for message retraction.
 *
 * A DSH session log is append-only. A conversation is the *surface* of that
 * log: the ordered message-producing events (`system/message`, `user/message`,
 * `assistant/message`, `tool/result`, `developer/message`), which a later
 * replacement event can shadow by covering a range of the current surface.
 * Model history is derived from that surface, so shadowing a tail is how a
 * message is retracted without editing stored history.
 *
 * This module reimplements just enough of the session package's surface fold to
 * plan a retraction on the Host side:
 *
 * - {@link foldEventOrder} replays the current surface order and records every
 *   replacement with the surface nodes it shadowed.
 * - {@link collectRetractions} finds this plugin's own retraction events in a
 *   log and rebuilds their plans (needed after a reload, so the client can hide
 *   the rows again).
 * - {@link planRetraction} turns "the user clicked message X" into the exact
 *   replacement range, the message text, and the client-side hide rules.
 *
 * The client renders its transcript from *append-origin* surface events, so a
 * retraction never removes rows by itself; the plan's `rules` describe what the
 * browser half hides (`turns` are `[data-chat-turn]` values, `keys` are
 * `[data-chat-node-key]` values).
 *
 * @module dsh-desktop-plus/surface-order
 */

import { LEGACY_RETRACTION_MESSAGE_PREFIXES, RETRACTION_MESSAGE_PREFIX } from './names.js'

/**
 * Message id prefix that marks a replacement as one of this plugin's
 * retractions. The replacement message is otherwise an empty system prompt
 * node, which derives no model message and changes no visible prompt. Owned by
 * `names.js` because it is written into stored logs and must survive a rename.
 */
export { RETRACTION_MESSAGE_PREFIX }

/** Every prefix that marks one of this plugin's retractions, old and new. */
const RETRACTION_PREFIXES = [RETRACTION_MESSAGE_PREFIX, ...LEGACY_RETRACTION_MESSAGE_PREFIXES]

/**
 * Whether a message id is one of this plugin's retraction replacements.
 * @param {unknown} id - candidate message id.
 * @returns {boolean} whether it carries a retraction prefix.
 */
function isRetractionId(id) {
  return typeof id === 'string' && RETRACTION_PREFIXES.some((prefix) => id.startsWith(prefix))
}

/** Event types that can join the model-visible surface. */
const SURFACE_TYPES = new Set(['system/message', 'developer/message', 'user/message', 'assistant/message', 'tool/result'])

/**
 * Client node-key prefixes this plugin hides.
 *
 * Keys are built by the Web client as `${kind.length}:${kind}${id}` from its own
 * conversation Definitions. These three kinds are the only rows a retraction
 * needs to address directly: user/context messages, assistant steps, and the
 * per-turn action footer. When a future client build renames a Definition,
 * hiding degrades to a visible leftover row; the model context stays correct,
 * because that part is enforced by the session log, not by these selectors.
 */
const KEY_PREFIX_USER = `${'input-message'.length}:${'input-message'}`
const KEY_PREFIX_ASSISTANT_STEP = `${'assistant-step'.length}:${'assistant-step'}`
const KEY_PREFIX_TURN_TAIL = `${'turn-tail'.length}:${'turn-tail'}`

/**
 * Build a sequence-addressable view of a stored log.
 * @param {readonly object[]} events - contiguous events in seq order.
 * @returns {{bySeq: Map<number, object>, ordered: object[]}} the view.
 */
function indexEvents(events) {
  const bySeq = new Map()
  for (const event of events) {
    if (typeof event?.seq !== 'number') continue
    bySeq.set(event.seq, event)
  }
  return { bySeq, ordered: [...bySeq.values()].sort((left, right) => left.seq - right.seq) }
}

/**
 * Replay the current model-visible surface order.
 *
 * This mirrors the shipped fold's positional rule: an append enters at its own
 * log position, a replacement re-uses the position of the range it shadows.
 * Invalid replacement ranges are tolerated here (they cannot exist in a log the
 * Host accepted), so a damaged log degrades to "treat it as an append" instead
 * of throwing while the user merely opens a session.
 *
 * @param {readonly object[]} events - contiguous events in seq order.
 * @returns {{nodes: number[], replacements: {seq: number, startSeq: number, endSeq: number, shadowedSeqs: number[]}[]}} the fold.
 */
export function foldEventOrder(events) {
  const nodes = []
  const replacements = []
  for (const event of events) {
    if (!SURFACE_TYPES.has(event?.type)) continue
    const op = event.surfaceOp
    if (op === undefined) continue
    if (op === 'append') {
      nodes.push(event.seq)
      continue
    }
    if (op === null || typeof op !== 'object' || op.op !== 'replace') {
      nodes.push(event.seq)
      continue
    }
    const startIdx = nodes.indexOf(op.startSeq)
    const endIdx = nodes.indexOf(op.endSeq)
    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      nodes.push(event.seq)
      continue
    }
    const shadowedSeqs = nodes.slice(startIdx, endIdx + 1)
    nodes.splice(startIdx, endIdx - startIdx + 1, event.seq)
    replacements.push({ seq: event.seq, startSeq: op.startSeq, endSeq: op.endSeq, shadowedSeqs })
  }
  return { nodes, replacements }
}

/**
 * Read every turn boundary in a log.
 * @param {readonly object[]} events - contiguous events in seq order.
 * @returns {{turn: number, startSeq: number, endSeq: number}[]} turn ranges in order.
 */
export function turnRanges(events) {
  const ranges = []
  let open = null
  for (const event of events) {
    if (event?.type === 'turn/start' && typeof event.data?.turn === 'number') {
      open = { turn: event.data.turn, startSeq: event.seq, endSeq: Number.POSITIVE_INFINITY }
      ranges.push(open)
    } else if (event?.type === 'turn/end' && open !== null) {
      open.endSeq = event.seq
      open = null
    }
  }
  return ranges
}

/**
 * Resolve the turn an event belongs to.
 *
 * A `user/message` carries no turn of its own: the prompt is recorded inside the
 * turn that consumes it, so the enclosing range answers for it. A message
 * queued before any turn starts belongs to the next turn.
 *
 * @param {number} seq - event position.
 * @param {{turn: number, startSeq: number, endSeq: number}[]} ranges - turn ranges.
 * @returns {number | undefined} the turn number.
 */
export function turnAt(seq, ranges) {
  for (const range of ranges) {
    if (seq >= range.startSeq && seq <= range.endSeq) return range.turn
  }
  let next
  for (const range of ranges) {
    if (range.startSeq >= seq && (next === undefined || range.startSeq < next.startSeq)) next = range
  }
  return next?.turn ?? ranges.at(-1)?.turn
}

/**
 * Join the visible text of one recorded message.
 * @param {unknown} content - message content blocks.
 * @returns {string} concatenated text.
 */
export function textOfContent(content) {
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block?.type !== 'text' || typeof block.text !== 'string') continue
    if (block.text.trim() === '') continue
    parts.push(block.text)
  }
  return parts.join('\n\n')
}

/**
 * Collect the durable image references of one recorded message.
 *
 * A retracted user prompt goes back to the composer as text, and its images go
 * back with it. The browser can only stage an image it holds as a `File`, so a
 * plan carries the identity of each image rather than its bytes: the client
 * reads them back through the shipped attachment route.
 *
 * Only a complete reference is carried. The read side verifies the stored
 * object against every field of the reference it is given, so a reference with
 * a missing or invented count could only fail: an incomplete one is dropped
 * here, and the retraction degrades to text instead of being blocked by it.
 *
 * @param {unknown} content - message content blocks.
 * @returns {{attachmentId: string, mediaType: string, bytes: number, width: number, height: number, name?: string}[]} image references in block order.
 */
export function imagesOfContent(content) {
  if (!Array.isArray(content)) return []
  const images = []
  for (const block of content) {
    if (block?.type !== 'image') continue
    const attachment = block.attachment
    if (typeof attachment?.attachmentId !== 'string' || attachment.attachmentId === '') continue
    if (typeof attachment.mediaType !== 'string' || attachment.mediaType === '') continue
    if (!isPositiveCount(attachment.bytes) || !isPositiveCount(attachment.width) || !isPositiveCount(attachment.height)) continue
    const image = {
      attachmentId: attachment.attachmentId,
      mediaType: attachment.mediaType,
      bytes: attachment.bytes,
      width: attachment.width,
      height: attachment.height,
    }
    if (typeof attachment.name === 'string' && attachment.name !== '') image.name = attachment.name
    images.push(image)
  }
  return images
}

/**
 * Whether a stored count is usable as-is. A reference is compared field by
 * field on read, so a guess would make the whole reference unreadable.
 * @param {unknown} value - caller-supplied count.
 * @returns {boolean} whether it is a positive finite number.
 */
function isPositiveCount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Whether an event is one of this plugin's retraction replacements.
 * @param {object | undefined} event - candidate event.
 * @returns {boolean} whether it is a retraction.
 */
export function isRetractionEvent(event) {
  // New retractions are `user/message` (a surface type with no open-turn
  // requirement); `system/message` is still recognized so logs written by the
  // previous build keep rebuilding their hide rules.
  if (event?.type === 'user/message') {
    const id = event.data?.id
    return isRetractionId(id)
  }
  if (event?.type !== 'system/message') return false
  const id = event.data?.message?.id
  return isRetractionId(id)
}

/**
 * Plan the client-side hiding for one shadowed surface range.
 * @param {readonly object[]} events - contiguous events in seq order.
 * @param {{startSeq: number, endSeq: number, shadowedSeqs: number[]}} range - a surface range.
 * @param {Map<number, object>} bySeq - seq-indexed events.
 * @returns {object} the hide plan.
 */
function planForRange(events, range, bySeq) {
  const ranges = turnRanges(events)
  const cut = bySeq.get(range.startSeq)
  const kind = cut?.type === 'user/message' ? 'user' : 'assistant'
  const shadowed = range.shadowedSeqs.map((seq) => bySeq.get(seq)).filter((event) => event !== undefined)
  const cutTurn = kind === 'assistant' ? cut?.data?.turn : turnAt(range.startSeq, ranges)
  const cutStep = kind === 'assistant' ? cut?.data?.step : undefined

  const affectedTurns = new Set()
  for (const event of shadowed) {
    const turn = typeof event.data?.turn === 'number' ? event.data.turn : turnAt(event.seq, ranges)
    if (typeof turn === 'number') affectedTurns.add(turn)
  }
  if (typeof cutTurn === 'number') affectedTurns.add(cutTurn)
  const turnList = [...affectedTurns].sort((left, right) => left - right)
  const highestTurn = turnList.at(-1)

  const keys = new Set()
  const turns = []
  if (kind === 'user') {
    const id = cut?.data?.id
    if (typeof id === 'string') keys.add(`${KEY_PREFIX_USER}${id}`)
  }
  for (const event of shadowed) {
    if (event.type === 'assistant/message') {
      const turn = event.data?.turn
      const step = event.data?.step
      if (typeof turn === 'number' && typeof step === 'number') keys.add(`${KEY_PREFIX_ASSISTANT_STEP}${turn}:${step}`)
    } else if (event.type === 'user/message' && event.data?.source?.kind !== 'user') {
      const id = event.data?.id
      if (typeof id === 'string') keys.add(`${KEY_PREFIX_USER}${id}`)
    }
  }
  for (const turn of turnList) keys.add(`${KEY_PREFIX_TURN_TAIL}${turn}`)
  if (typeof cutTurn === 'number' && typeof highestTurn === 'number') {
    const firstHiddenTurn = kind === 'user' ? cutTurn : cutTurn + 1
    for (let turn = firstHiddenTurn; turn <= highestTurn; turn += 1) turns.push(turn)
  }

  const shadowedUserMessages = shadowed.filter((event) => event.type === 'user/message' && event.data?.source?.kind === 'user')
  const cutId = kind === 'user' ? cut?.data?.id : cut?.data?.message?.id
  const removedUserMessages = shadowedUserMessages.filter((event) => event.data?.id !== cutId)
  const messageCount = shadowed.filter((event) => event.type === 'user/message' || event.type === 'assistant/message').length
  const content = kind === 'user' ? cut?.data?.content : cut?.data?.message?.content

  return {
    kind,
    text: textOfContent(content),
    images: kind === 'user' ? imagesOfContent(content) : [],
    turn: typeof cutTurn === 'number' ? cutTurn : undefined,
    step: typeof cutStep === 'number' ? cutStep : undefined,
    startSeq: range.startSeq,
    endSeq: range.endSeq,
    shadowedCount: shadowed.length,
    messageCount,
    removesHistory: removedUserMessages.length > 0,
    rules: { turns, keys: [...keys] },
  }
}

/**
 * Rebuild every retraction recorded in one log.
 * @param {readonly object[]} events - contiguous events in seq order.
 * @returns {object[]} plans in log order, each with its replacement `seq`.
 */
export function collectRetractions(events) {
  const { replacements } = foldEventOrder(events)
  const { bySeq } = indexEvents(events)
  const plans = []
  for (const replacement of replacements) {
    if (!isRetractionEvent(bySeq.get(replacement.seq))) continue
    plans.push({ seq: replacement.seq, ...planForRange(events, replacement, bySeq) })
  }
  return plans
}

/**
 * Union the hide rules of several plans.
 * @param {readonly {rules: {turns: number[], keys: string[]}}[]} plans - retraction plans.
 * @returns {{turns: number[], keys: string[]}} merged, sorted rules.
 */
export function unionRules(plans) {
  const turns = new Set()
  const keys = new Set()
  for (const plan of plans) {
    for (const turn of plan.rules?.turns ?? []) turns.add(turn)
    for (const key of plan.rules?.keys ?? []) keys.add(key)
  }
  return {
    turns: [...turns].sort((left, right) => left - right),
    keys: [...keys].sort(),
  }
}

/**
 * Resolve one clicked message id to its surface event.
 * @param {readonly object[]} events - contiguous events in seq order.
 * @param {string} messageId - durable message identity from the browser.
 * @returns {{event: object, messageId: string} | undefined} the message and its durable id.
 */
export function findMessageEvent(events, messageId) {
  for (const event of events) {
    if (event?.type === 'user/message' && event.data?.id === messageId) return { event, messageId }
    if (event?.type === 'assistant/message' && event.data?.message?.id === messageId) return { event, messageId }
  }
  return undefined
}

/**
 * Plan a retraction from a complete log and a clicked message id.
 *
 * The retraction always covers the clicked message and every surface node after
 * it, which is what "撤回这条消息" means: the conversation returns to the state
 * before it. Ranges are tool-pairing balanced by construction — a turn boundary
 * never splits a call from its result, because the whole tail goes away.
 *
 * @param {readonly object[]} events - contiguous events in seq order.
 * @param {string} messageId - durable message identity from the browser.
 * @returns {object | undefined} the plan, or undefined when the id names no logged message.
 */
export function planRetraction(events, messageId) {
  const found = findMessageEvent(events, messageId)
  if (found === undefined) return undefined
  const { bySeq } = indexEvents(events)
  const { nodes } = foldEventOrder(events)
  const startIdx = nodes.indexOf(found.event.seq)
  if (startIdx === -1) {
    // The message exists in the log but no longer on the surface: an earlier
    // retraction or a compaction already shadowed it.
    return { alreadyRetracted: true, messageId }
  }
  const endSeq = nodes[nodes.length - 1]
  if (endSeq === undefined) return undefined
  const range = { startSeq: found.event.seq, endSeq, shadowedSeqs: nodes.slice(startIdx) }
  return {
    messageId,
    ...planForRange(events, range, bySeq),
  }
}
