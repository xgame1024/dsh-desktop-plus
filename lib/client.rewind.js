/**
 * Web client chunk: per-message retraction and inline editing.
 *
 * Loaded by \`lib/client.js\` through \`require.async('./client.rewind.js')\`.
 * The entry passes the shared runtime (text, reportClient, requestJson,
 * hide rules, mountSlot, ...) to \`mount\`; nothing here imports the entry.
 */
window.__ModuleLoader__.load({
  id: 'dsh-desktop-plus',
  chunk: 'client.rewind.js',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    let runtime = null
    const text = (key, values) => runtime.text(key, values)
    const reportClient = payload => runtime.reportClient(payload)
    const requestJson = (url, body) => runtime.requestJson(url, body)
    const getContext = () => runtime.getContext()
    const cssString = value => runtime.cssString(value)
    const reactDOM = () => runtime.reactDOM()
    const applyHideRules = (sessionId, rules) => runtime.applyHideRules(sessionId, rules)
    const publishHideRules = () => runtime.publishHideRules()

    /** Must match the entry's route prefix. */
    const ROUTE_PREFIX = '/dsh-desktop-plus'
    /** Rows waiting for the rules fetch, so one session is fetched once. */
    const rulesPending = new Set()
    /** Session id -> learned hide rules; replaced by the runtime's map in mount. */
    let hideRules = new Map()
    /** View components that redraw when a session's hidden-turn set changes. */
    let hideRuleListeners = new Set()
    /** The client context, set by mount; readers keep their empty fallbacks. */
    let clientContext = null
    /** Retraction controls' static CSS. */
    const REWIND_CSS =       '[data-dsh-desktop-plus-action="fallback"]{width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;padding:6px;display:inline-flex}' +
      '[data-dsh-desktop-plus-action="fallback"]:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}' +
      '[data-dsh-desktop-plus-action="fallback"][data-unavailable]{cursor:default;opacity:.4}' +
      '[data-dsh-desktop-plus-action="fallback"][data-unavailable]:hover{background:0 0;color:var(--dsw-alias-label-tertiary)}' +
      '[data-dsh-desktop-plus-action="fallback"] svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}' +
      '[data-dsh-desktop-plus="tooltip"]{position:fixed;z-index:1100;max-width:min(50vw,calc(100vw - 24px));padding:3px 7px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-tooltip-bg);color:var(--dsw-static-neutral-bluish-00);font-size:13px;line-height:20px;white-space:pre-line;overflow-wrap:break-word;pointer-events:none;visibility:hidden;opacity:0}' +
      '[data-dsh-desktop-plus="tooltip"][data-open="true"]{visibility:visible;opacity:1;animation:dsh-desktop-plus-tooltip-in .15s var(--ds-ease-in-out,ease-in-out)}' +
      '[data-dsh-desktop-plus-editing] [data-message-bubble],[data-dsh-desktop-plus-editing] [data-clock]{display:none !important}' +
      // The inline editor's two buttons wear the shipped message-action button
      // (`.action`: 24px, transparent, secondary icon, hover-only fill) rather
      // than the 28px action-row fallback above. They stand directly under a
      // message bubble, so that row — not the Button component — is what a reader
      // compares them against. The send keeps the one filled treatment so the
      // pair still reads primary / secondary.
      '[data-dsh-desktop-plus="editor-cancel"],[data-dsh-desktop-plus="editor-send"]{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}' +
      '[data-dsh-desktop-plus="editor-cancel"] svg,[data-dsh-desktop-plus="editor-send"] svg{width:16px;height:16px}' +
      '[data-dsh-desktop-plus="editor-cancel"]:hover:not([data-unavailable]){background:var(--dsw-alias-interactive-bg-hover)}' +
      '[data-dsh-desktop-plus="editor-cancel"]:active:not([data-unavailable]){background:var(--dsw-alias-interactive-bg-active)}' +
      '[data-dsh-desktop-plus="editor-send"]{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}' +
      '[data-dsh-desktop-plus="editor-send"]:hover:not([data-unavailable]){background:var(--dsw-alias-button-primary-hover);color:var(--dsw-alias-label-primary-foreground)}' +
      '[data-dsh-desktop-plus="editor-cancel"]:focus-visible,[data-dsh-desktop-plus="editor-send"]:focus-visible{outline:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}' +
      '[data-dsh-desktop-plus="editor-cancel"][data-unavailable],[data-dsh-desktop-plus="editor-send"][data-unavailable]{cursor:not-allowed;opacity:.4}' +
      '[data-dsh-desktop-plus="editor-cancel"][data-unavailable]:hover{background:transparent}' +
      '[data-dsh-desktop-plus="editor-send"][data-unavailable]:hover{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}' +
      '@keyframes dsh-desktop-plus-tooltip-in{0%{opacity:0}}' +
      '@media (prefers-reduced-motion:reduce){[data-dsh-desktop-plus="tooltip"][data-open="true"]{animation:none}}'

    /**
     * Install this feature's static stylesheet once.
     * @param {string} id - feature id used in the style element's key.
     * @param {string} css - the rules.
     * @returns {HTMLStyleElement | null} the element, or null without a document.
     */
    function ensureCss(id, css) {
      if (typeof document === 'undefined') return null
      const key = 'dsh-desktop-plus/' + id
      const existing = document.querySelector('style[data-plugin-css="' + key + '"]')
      const tag = existing !== null ? existing : document.createElement('style')
      tag.dataset.plugin = 'dsh-desktop-plus'
      tag.dataset.pluginCss = key
      tag.textContent = css
      if (existing === null) document.head.appendChild(tag)
      return tag
    }

    /* ───────────────────────── feature 2: per-message retraction ───────────────────────── */

    /** Must match the Host half's rewind routes. */
    const REWIND_ROUTE = ROUTE_PREFIX + '/rewind'
    const REWIND_PREPARE_ROUTE = REWIND_ROUTE + '/prepare'
    const REWIND_RULES_ROUTE = REWIND_ROUTE + '/rules'

    /** Header the Host half requires on mutating requests. */
    const EDITOR_HEADER = 'x-dsh-desktop-plus'


    /**
     * Read the session id from the conversation body above one rendered row.
     * The standard slot props normally carry it; this is the fallback used when
     * a build delivers a different prop set.
     * @param {Element | null} node - any element inside the conversation.
     * @returns {string} the session id, or an empty string.
     */
    function sessionIdNear(node) {
      const host = node?.closest?.('[data-conversation-session]')
      return host?.getAttribute?.('data-conversation-session') ?? ''
    }

    /**
     * The client node-key prefix of a user/context message row.
     * The Web client builds keys as `${kind.length}:${kind}${id}` for its own
     * `input-message` Definition, so the durable message id is the suffix. A row
     * whose key does not match is left without controls instead of acting on a
     * guessed id.
     */
    const USER_NODE_KEY_PREFIX = 'input-message'.length + ':input-message'

    /** Stable selection value the chain slot delivers for a real user prompt row. */
    const USER_PROMPT_MATCH = { kind: 'user-prompt' }

    /**
     * Elect this entry only for durable human prompts, so steering rows and
     * injected context never grow retraction controls.
     * @param {object} owner - the chain slot's owner currency (`source`, `kind`).
     * @returns {object | null} the stable match, or null for other rows.
     */
    function selectUserPrompt(owner) {
      return owner?.kind === 'user' && owner?.source?.kind === 'user' ? USER_PROMPT_MATCH : null
    }


    function rewindErrorText(result) {
      const code = typeof result?.value?.code === 'string' ? result.value.code : ''
      switch (code) {
        case 'message-retracted':
          return text('messageRetracted')
        case 'message-unknown':
        case 'session-unknown':
          return text('messageUnknown')
        case 'session-active':
          return text('sessionActive')
        case 'session-not-live':
          return text('sessionNotLive')
        case 'image-unreadable':
          return text('imageUnreadable')
        default: {
          const detail = typeof result?.value?.message === 'string' && result.value.message !== '' ? ': ' + result.value.message : ''
          return text('rewindFailed') + (result?.status === undefined ? '' : ' (HTTP ' + result.status + ')') + detail
        }
      }
    }

    /**
     * Describe a transport failure in the retraction vocabulary.
     * @param {unknown} failure - a thrown fetch/parse failure.
     * @returns {string} the message.
     */
    function rewindTransportText(failure) {
      const detail = failure instanceof Error ? failure.message : String(failure)
      return text('rewindFailed') + (detail === '' ? '' : ': ' + detail)
    }

    /**
     * Learn a session's retraction rules once, so a reload hides the same rows.
     * @param {string} sessionId - the session being rendered.
     */
    function ensureHideRules(sessionId) {
      if (typeof sessionId !== 'string' || sessionId === '') return
      if (hideRules.has(sessionId) || rulesPending.has(sessionId)) return
      rulesPending.add(sessionId)
      requestJson(REWIND_RULES_ROUTE + '?sessionId=' + encodeURIComponent(sessionId))
        .then((result) => {
          if (result.ok === true) applyHideRules(sessionId, result.value?.rules)
        })
        .catch(() => {
          // A missing capability must not break the transcript; controls simply
          // appear without restored hide rules.
        })
        .finally(() => {
          rulesPending.delete(sessionId)
        })
    }

    /** One pending retraction confirmation, shared by every affordance and the dialog. */
    const pendingRewind = (() => {
      let pending = null
      const listeners = new Set()
      return {
        get: () => pending,
        set(next) {
          pending = next
          for (const listener of [...listeners]) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    })()
    /**
     * The message the user is editing in place: its row shows an editable bubble
     * instead of the sent one, and nothing is written to the log until that text
     * is sent.
     */
    const inlineEdit = (() => {
      let pending = null
      const listeners = new Set()
      return {
        get: () => pending,
        set(next) {
          pending = next
          for (const listener of [...listeners]) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    })()

    /** The editable bubble's box when the sent one cannot be measured. */
    const FALLBACK_BUBBLE = {
      width: 'min(100%, 480px)',
      padding: '10px 16px',
      borderRadius: '20px',
      background: 'var(--dsw-alias-bg-layer-2)',
      color: 'var(--dsw-alias-label-primary)',
      font: 'inherit',
    }

    /**
     * Read the sent bubble's own box so the editor replaces it without a visual
     * jump: the shipped skin is a plain div, and its computed values follow the
     * active theme and font size.
     * @param {Element | null} bubble - the row's `[data-message-bubble]`.
     * @returns {typeof FALLBACK_BUBBLE} the box to copy.
     */
    function bubbleAppearance(bubble) {
      if (bubble === null || bubble === undefined || typeof window === 'undefined') return FALLBACK_BUBBLE
      const style = window.getComputedStyle(bubble)
      const rect = bubble.getBoundingClientRect()
      return {
        width: rect.width > 0 ? Math.max(220, Math.round(rect.width)) + 'px' : FALLBACK_BUBBLE.width,
        padding: style.padding,
        borderRadius: style.borderRadius,
        background: style.backgroundColor,
        color: style.color,
        font: style.font,
      }
    }

    /**
     * Apply one retraction, optionally bounded to the surface range captured when
     * the user started editing.
     * @param {{sessionId: string, messageId: string, plan?: object, untilSeq?: number}} request - the retraction.
     * @returns {Promise<{ok: boolean, value: any, status: number}>} the Host outcome.
     */
    async function applyRewind(request) {
      const body = { sessionId: request.sessionId, messageId: request.messageId, mode: 'retract' }
      if (Number.isInteger(request.untilSeq)) body.untilSeq = request.untilSeq
      const result = await requestJson(REWIND_ROUTE, body)
      if (result.ok !== true) return result
      applyHideRules(request.sessionId, result.value?.rules ?? request.plan?.rules)
      const editing = inlineEdit.get()
      if (editing !== null && editing.sessionId === request.sessionId && editing.messageId === request.messageId) inlineEdit.set(null)
      return result
    }

    /**
     * The Conversation service's private draft registry, when this build has
     * one. Draft attachments live in that registry, so an id it never saw is
     * dropped from the composer rail on the next render.
     * @returns {object | null} the service, or null when the method is absent.
     */
    function draftController() {
      const conversation = clientContext?.get?.('conversation')
      return typeof conversation?.createDrafts === 'function' ? conversation : null
    }

    /**
     * The client session's attachment reader for one session.
     * @param {string} sessionId - the session holding the image.
     * @returns {{session: object, read: Function} | null} the reader, or null.
     */
    function sessionAttachmentReader(sessionId) {
      const sessions = clientContext?.get?.('sessions')
      const binding = typeof sessions?.binding === 'function' ? sessions.binding(sessionId) : undefined
      const session = binding?.session
      if (typeof session?.readAttachment !== 'function') return null
      return { session, read: session.readAttachment.bind(session) }
    }

    /**
     * Whether this build can put a retracted message's images back.
     *
     * Three shipped capabilities are involved — a draft registry, the composer's
     * public action face, and the session's attachment reader — so the answer is
     * per build: a DSH release that renames one of them degrades a retraction to
     * its text half (and says so before the user confirms) instead of failing it.
     * @param {{sessionId: string, inputActions?: object}} request - the click.
     * @returns {boolean} whether the image half can run.
     */
    function canRestoreImages(request) {
      if (draftController() === null) return false
      if (typeof request?.inputActions?.addAttachments !== 'function') return false
      return sessionAttachmentReader(request?.sessionId) !== null
    }

    /**
     * The name a restored image keeps in the composer rail.
     * @param {object} image - one image reference.
     * @returns {string} the stored name, or one derived from the media type.
     */
    function imageFileName(image) {
      if (typeof image?.name === 'string' && image.name !== '') return image.name
      const subtype = String(image?.mediaType ?? '').split('/')[1] ?? ''
      if (subtype === 'jpeg') return 'image.jpg'
      if (subtype === '') return 'image.png'
      return 'image.' + subtype
    }

    /**
     * Read a retracted message's images back out of the session store.
     *
     * A retracted message is hidden from the transcript, not deleted, and the
     * attachment route reads by id without consulting history, so its images are
     * still there. Every image is read before anything is retracted: a failure
     * here must leave the message and the composer exactly as they were.
     * @param {string} sessionId - the session holding them.
     * @param {readonly object[]} images - the plan's image references.
     * @returns {Promise<File[]>} browser files, in the order the message held them.
     */
    async function readRetractedImages(sessionId, images) {
      const reader = sessionAttachmentReader(sessionId)
      if (reader === null) throw new Error('the session attachment reader is unavailable')
      const files = []
      for (const image of images) {
        const result = await reader.read(image)
        if (result?.ok !== true) {
          throw new Error(result?.error?.code ? String(result.error.code) : 'image unreadable')
        }
        files.push(new File([result.value?.data], imageFileName(image), { type: image.mediaType }))
      }
      return files
    }

    /**
     * Stage restored images as composer drafts, the way a paste does: the rail
     * shows them and a send carries them exactly like a freshly added image. The
     * image is re-admitted from its original bytes, whose digest is the
     * attachment id, so the same stored object is reused rather than a copy
     * being written. A draft carries its own random id, which is what the rail
     * is addressed by.
     * @param {string} sessionId - the session the draft belongs to.
     * @param {readonly File[]} files - the images, in message order.
     * @param {object | undefined} inputActions - the composer's public action face.
     * @returns {boolean} whether every image reached the rail.
     */
    function stageRestoredImages(sessionId, files, inputActions) {
      const controller = draftController()
      if (controller === null || typeof inputActions?.addAttachments !== 'function') return false
      const reader = sessionAttachmentReader(sessionId)
      const uploadImages = reader?.session?.getSnapshot?.()?.subagent === null
      const drafts = controller.createDrafts(sessionId, files, uploadImages)
      const ids = Array.isArray(drafts) ? drafts.map((draft) => draft?.id).filter((id) => typeof id === 'string') : []
      let admitted = false
      try {
        admitted = ids.length === files.length && inputActions.addAttachments(ids) === true
      } finally {
        if (!admitted) releaseDrafts(controller, ids)
      }
      return admitted
    }

    /**
     * Drop drafts the rail refused, so the browser keeps no preview of an image
     * the user never sees.
     * @param {object} controller - the draft registry.
     * @param {readonly string[]} ids - draft ids to release.
     */
    function releaseDrafts(controller, ids) {
      if (typeof controller?.releaseDraftAttachment !== 'function') return
      for (const id of ids) {
        try {
          controller.releaseDraftAttachment(id)
        } catch {
          // An id the registry already forgot needs no second release.
        }
      }
    }

    /**
     * Ask the Host what one message's retraction would do.
     * @param {{sessionId: string, messageId: string, mode: 'retract'|'edit'}} request - the click.
     * @param {(message: string) => void} onError - failure reporter.
     * @returns {Promise<object | null>} the plan, or null after reporting the failure.
     */
    async function prepareRewind(request, onError) {
      let prepared
      try {
        prepared = await requestJson(REWIND_PREPARE_ROUTE, {
          sessionId: request.sessionId,
          messageId: request.messageId,
          mode: request.mode,
        })
      } catch (failure) {
        onError(rewindTransportText(failure))
        return null
      }
      if (prepared.ok !== true) {
        onError(rewindErrorText(prepared))
        return null
      }
      const plan = prepared.value?.plan
      return plan ?? null
    }

    /**
     * Turn one sent message into an editable bubble in place. Nothing is retracted
     * yet: the message keeps its place in the transcript and the log until the
     * edited text is sent.
     *
     * The editor is opened with the message's images only when they can be
     * staged again; otherwise it says so up front, because the replacement is a
     * resend and a silent drop would be the one irreversible kind of loss here.
     * @param {{sessionId: string, messageId: string, anchor: Element | null, inputActions?: object, onError: (message: string) => void}} request - the click.
     */
    async function beginEdit(request) {
      const plan = await prepareRewind({ ...request, mode: 'edit' }, request.onError)
      if (plan === null) return
      const row = request.anchor?.closest?.('[data-chat-node-key]') ?? null
      if (row === null) {
        request.onError(text('rewindFailed'))
        return
      }
      const images = plan.kind === 'user' && Array.isArray(plan.images) ? plan.images : []
      const restoresImages = images.length > 0 && canRestoreImages({ sessionId: request.sessionId, inputActions: request.inputActions })
      inlineEdit.set({
        sessionId: request.sessionId,
        messageId: request.messageId,
        startSeq: plan.startSeq,
        endSeq: plan.endSeq,
        text: typeof plan.text === 'string' ? plan.text : '',
        images: restoresImages ? images : [],
        inputActions: request.inputActions,
        appearance: bubbleAppearance(row.querySelector('[data-message-bubble]')),
        busy: false,
        error: images.length > 0 && !restoresImages ? text('editImagesUnavailable', { count: images.length }) : '',
      })
      reportClient({ phase: 'edit', component: 'open' })
    }

    /** Leave the editable bubble without touching the transcript. */
    function cancelInlineEdit() {
      if (inlineEdit.get() === null) return
      inlineEdit.set(null)
      reportClient({ phase: 'edit', component: 'cancel' })
    }

    /**
     * Replace the edited message: retract it and the range captured when editing
     * started, then send the edited text as the next turn. The message's images
     * are read first and staged as drafts, so the replacement message carries
     * them too — an edit is a resend, not a way to lose the picture. The editor
     * only opens with images it can stage, so an image-less replacement here is
     * one the user was warned about when the editor opened.
     * @param {string} text - the edited prompt.
     */
    async function commitInlineEdit(text) {
      const edit = inlineEdit.get()
      if (edit === null || edit.busy === true) return
      const composer = edit.inputActions
      if (typeof composer?.setDraft !== 'function' || typeof composer?.submit !== 'function') {
        // Refuse before retracting anything. Once the tail is retracted this row
        // is hidden by the hide rules, so an editor kept open afterwards would be
        // invisible and the edited text would die with it — the retraction itself
        // is what has to wait, not the message.
        inlineEdit.set({ ...edit, busy: false, error: rewindErrorText({ ok: false, value: { code: 'draft-unavailable' } }) })
        reportClient({ phase: 'edit', component: 'draft-unavailable' })
        return
      }
      inlineEdit.set({ ...edit, busy: true, error: '' })
      const images = Array.isArray(edit.images) ? edit.images : []
      let files = []
      if (images.length > 0) {
        try {
          files = await readRetractedImages(edit.sessionId, images)
        } catch (failure) {
          const detail = String(failure?.message ?? failure)
          inlineEdit.set({
            ...edit,
            busy: false,
            error: rewindErrorText({ ok: false, value: { code: 'image-unreadable', message: detail } }),
          })
          reportClient({ phase: 'edit', component: 'images-unreadable', detail })
          return
        }
      }
      let result
      try {
        result = await applyRewind({ sessionId: edit.sessionId, messageId: edit.messageId, untilSeq: edit.endSeq })
      } catch (failure) {
        result = { ok: false, value: { code: 'network', message: failure?.message ?? String(failure) }, status: undefined }
      }
      if (result.ok !== true) {
        inlineEdit.set({ ...edit, busy: false, error: rewindErrorText(result) })
        reportClient({ phase: 'edit', component: 'failed', code: result.value?.code ?? 'unknown' })
        return
      }
      inlineEdit.set(null)
      reportClient({ phase: 'edit', component: 'sent' })
      try {
        composer.setDraft(text)
        if (files.length > 0) {
          try {
            const staged = stageRestoredImages(edit.sessionId, files, composer)
            reportClient({ phase: 'edit', component: staged ? 'images-restored' : 'images-failed' })
          } catch (failure) {
            reportClient({ phase: 'edit', component: 'images-failed', detail: String(failure?.message ?? failure) })
          }
        }
        composer.submit()
      } catch (failure) {
        // The draft already holds the text, so the composer is the recovery path.
        reportClient({ phase: 'edit', component: 'send-failed', detail: String(failure?.message ?? failure) })
      }
    }

    /**
     * One retraction, always behind a confirmation.
     *
     * Every retraction changes what the model sees next, so every one of them
     * asks first — the last exchange included. A retracted user prompt is the
     * case worth the extra step: its text is the thing the user wanted to say
     * differently, so a successful retraction puts that text back into the
     * composer (replacing the draft there), where editing and sending is one
     * keystroke away. Its images come back the same way: their bytes are read
     * from the session store first, before anything is retracted, and then
     * staged as ordinary composer drafts, so a resend carries them exactly like
     * a freshly added image. An assistant message has neither, and the composer
     * is left alone.
     * @param {{sessionId: string, messageId: string, inputActions?: object, onError: (message: string) => void}} request - the click.
     */
    async function beginRetract(request) {
      const plan = await prepareRewind({ ...request, mode: 'retract' }, request.onError)
      if (plan === null) return
      const promptText = typeof plan.text === 'string' ? plan.text : ''
      const images = plan.kind === 'user' && Array.isArray(plan.images) ? plan.images : []
      const restoresText = plan.kind === 'user' && promptText !== ''
      const restoresImages = images.length > 0 && canRestoreImages(request)
      const execute = async () => {
        let files = []
        if (restoresImages) {
          try {
            files = await readRetractedImages(request.sessionId, images)
          } catch (failure) {
            const detail = String(failure?.message ?? failure)
            reportClient({ phase: 'retract', component: 'images-unreadable', detail })
            return { ok: false, value: { code: 'image-unreadable', message: detail }, status: undefined }
          }
        }
        // Reading the bytes takes one round trip per image, which is long enough
        // for the dialog to be dismissed under it: a closed confirmation must not
        // retire the message afterwards.
        if (pendingRewind.get() !== pending) {
          reportClient({ phase: 'retract', component: 'dismissed' })
          return { ok: false, value: { code: 'cancelled' }, status: undefined }
        }
        let result
        try {
          result = await applyRewind({ ...request, plan })
        } catch (failure) {
          return { ok: false, value: { code: 'network', message: rewindTransportText(failure) }, status: undefined }
        }
        if (result.ok !== true) return result
        if (restoresText) {
          try {
            // Only after the Host accepted the retraction: a refused one must
            // leave the composer exactly as the user left it.
            request.inputActions?.setDraft?.(promptText)
            reportClient({ phase: 'retract', component: 'draft-restored' })
          } catch {
            reportClient({ phase: 'retract', component: 'draft-failed' })
          }
        }
        if (files.length > 0) {
          try {
            const staged = stageRestoredImages(request.sessionId, files, request.inputActions)
            reportClient({ phase: 'retract', component: staged ? 'images-restored' : 'images-failed' })
          } catch (failure) {
            reportClient({ phase: 'retract', component: 'images-failed', detail: String(failure?.message ?? failure) })
          }
        }
        return result
      }
      let body =
        plan.removesHistory === true
          ? text('retractConfirmBody', { count: plan.messageCount ?? 0 })
          : text('retractConfirmBodyLast')
      if (images.length > 0) {
        const imageNote = restoresImages
          ? text('retractImagesBack', { count: images.length })
          : text('retractImagesUnavailable', { count: images.length })
        body += ' ' + imageNote
      }
      const pending = {
        title: text('retractConfirmTitle'),
        body,
        confirm: text('confirmRetract'),
        run: execute,
      }
      pendingRewind.set(pending)
    }

    /**
     * The retract glyph: a counter-clockwise arrow.
     *
     * The shipped icon set draws every glyph on a 16-unit grid with a 1-unit
     * stroke. The glyphs below follow that contract instead of the heavier 1.4
     * stroke of the first build, which is what made the controls read as foreign
     * next to the copy button.
     */
    function RetractIcon(props) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: props?.size ?? 16,
          height: props?.size ?? 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M3.2 7.1A5 5 0 1 1 4.6 11.4' }),
        h('path', { d: 'M3 3.6v3.8h3.8' }),
      )
    }

    /**
     * The re-edit glyph: the shipped `edit-outline` icon, path for path, so it is
     * the same pencil the rest of the app uses.
     */
    function EditIcon(props) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: props?.size ?? 16,
          height: props?.size ?? 16,
          fill: 'none',
          strokeWidth: 1,
          'aria-hidden': true,
          focusable: false,
        },
        h('path', {
          d: 'M8.85596 2.69971H4.19971C3.37141 2.69971 2.69992 3.37146 2.69971 4.19971V11.8003C2.69992 12.6285 3.37141 13.3003 4.19971 13.3003H11.8003C12.6283 13.2999 13.3001 12.6283 13.3003 11.8003V7.89893H14.3003V11.8003C14.3001 13.1806 13.1806 14.2999 11.8003 14.3003H4.19971C2.81913 14.3003 1.69992 13.1808 1.69971 11.8003V4.19971C1.69992 2.81918 2.81913 1.69971 4.19971 1.69971H8.85596V2.69971Z',
          fill: 'currentColor',
        }),
        h('path', { d: 'M7.7849 8.23878L13.888 2.13574', stroke: 'currentColor' }),
      )
    }

    /**
     * The cancel glyph of the inline editor: a plain cross, drawn on the same
     * 16-unit grid and 1-unit stroke as the retract and edit glyphs so the three
     * never disagree.
     */
    function CloseIcon(props) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: props?.size ?? 16,
          height: props?.size ?? 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1,
          strokeLinecap: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M4.2 4.2l7.6 7.6' }),
        h('path', { d: 'M11.8 4.2l-7.6 7.6' }),
      )
    }

    /**
     * The send glyph of the inline editor: an upward arrow, the shape a composer
     * uses for "send this".
     */
    function SendIcon(props) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: props?.size ?? 16,
          height: props?.size ?? 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M8 12.4V3.6' }),
        h('path', { d: 'M4 7.6 8 3.6l4 4' }),
      )
    }

    /**
     * The shipped action row (clock / copy / branch) of the message row that
     * contains one of this module's anchors.
     *
     * The row is not a slot: `conversation.chat.user.before` renders above the
     * bubble while the row renders below it, as a sibling. A message row is the
     * `[data-chat-node-key]` element the client already stamps, and its actions
     * are the only `[data-clock]` element inside it, so the lookup stays
     * structural instead of depending on the shipped hashed class names.
     * @param {Element | null} node - any element of the message row.
     * @returns {Element | null} the action row, or null when this build has none.
     */
    function actionRowNear(node) {
      if (node === null || node === undefined || typeof node.closest !== 'function') return null
      const inside = node.closest('[data-clock]')
      if (inside !== null) return inside
      const messageRow = node.closest('[data-chat-node-key]')
      if (messageRow === null) return null
      const actions = messageRow.querySelector('[data-clock]')
      if (actions === null) return null
      // A nested row (a quote, a tool card) must not lend its actions.
      return actions.closest('[data-chat-node-key]') === messageRow ? actions : null
    }

    /**
     * The shipped copy button of one action row: the row's first button.
     * @param {Element | null} actions - the action row.
     * @returns {Element | null} the button, or null.
     */
    function copyButtonOf(actions) {
      return actions === null || actions === undefined ? null : actions.querySelector('button')
    }

    /**
     * The class the shipped action buttons wear. Reading it from the live copy
     * button, instead of copying its CSS, keeps our controls identical across
     * themes, font-size deltas and future restyles of the shipped row.
     * @param {Element | null} button - the copy button.
     * @returns {string} the class attribute, or an empty string.
     */
    function actionClassOf(button) {
      return button !== null && typeof button.className === 'string' ? button.className.trim() : ''
    }

    /** The one hover label this module reuses, created on first hover. */
    let tooltipNode = null

    /**
     * Show this module's hover label under one action button.
     *
     * The shipped action buttons reveal a small tooltip bubble; a `title`
     * attribute would show the operating system's own tooltip instead, which is
     * the one visible difference left after the buttons share a row. The bubble
     * below copies the shipped box (same tokens, padding, radius, 13/20 text and
     * 0.15s fade), and one element serves every button on the page.
     * @param {Element | null} anchor - the button the label describes.
     * @param {string} label - the text.
     */
    function showTooltip(anchor, label) {
      if (typeof document === 'undefined' || anchor === null || anchor === undefined) return
      if (tooltipNode === null || tooltipNode.isConnected !== true) {
        // Reuse the bubble a previous module generation left behind: this half is
        // hot-reloaded, and one hidden <div> per reload would accumulate.
        const existing = document.querySelector('[data-dsh-desktop-plus="tooltip"]')
        tooltipNode = existing ?? document.createElement('div')
        tooltipNode.setAttribute('data-dsh-desktop-plus', 'tooltip')
        tooltipNode.setAttribute('role', 'tooltip')
        if (existing === null) document.body.appendChild(tooltipNode)
      }
      const node = tooltipNode
      // Position while still hidden, then reveal: the bubble must never be seen
      // at a stale place.
      node.dataset.open = 'false'
      node.textContent = label
      node.style.left = '0px'
      node.style.top = '0px'
      const rect = anchor.getBoundingClientRect()
      const width = node.offsetWidth
      const height = node.offsetHeight
      const margin = 12
      const viewWidth = typeof window === 'undefined' ? 0 : window.innerWidth
      const viewHeight = typeof window === 'undefined' ? 0 : window.innerHeight
      let left = rect.left + rect.width / 2 - width / 2
      if (viewWidth > 0) left = Math.max(margin, Math.min(left, viewWidth - margin - width))
      let top = rect.bottom + 8
      // The shipped bubble flips above its anchor when the bottom edge is close.
      if (viewHeight > 0 && top + height > viewHeight - margin) top = rect.top - 8 - height
      node.style.left = left + 'px'
      node.style.top = top + 'px'
      node.dataset.open = 'true'
    }

    /** Hide this module's hover label. */
    function hideTooltip() {
      if (tooltipNode === null) return
      tooltipNode.dataset.open = 'false'
    }

    /**
     * One icon button living inside a shipped message action row.
     *
     * `className` is the live copy button's class, so the button inherits the
     * host's own size, radius, color, hover fill and hover-reveal behavior; when
     * that class could not be read the button falls back to the module's copy of
     * the same rules. Busy state uses the host's own `data-unavailable` treatment
     * instead of a disabled attribute, which would grey the label differently.
     * @param {object} props - marker, label, glyph, className, disabled, onClick.
     */
    function ActionIconButton(props) {
      const anchorRef = React.useRef(null)
      const disabled = props.disabled === true
      const label = typeof props.label === 'string' ? props.label : ''
      const className = typeof props.className === 'string' ? props.className : ''
      const hover = () => {
        if (disabled !== true) showTooltip(anchorRef.current, label)
      }
      return h(
        'button',
        {
          ref: anchorRef,
          type: 'button',
          'data-dsh-desktop-plus': props.marker,
          'data-dsh-desktop-plus-action': className === '' ? 'fallback' : undefined,
          'data-unavailable': disabled ? 'true' : undefined,
          className: className === '' ? undefined : className,
          'aria-label': label,
          'aria-disabled': disabled ? 'true' : undefined,
          onClick(event) {
            event.preventDefault()
            event.stopPropagation()
            hideTooltip()
            if (disabled !== true && typeof props.onClick === 'function') props.onClick()
          },
          onPointerEnter: hover,
          onPointerLeave: hideTooltip,
          onFocus: hover,
          onBlur: hideTooltip,
          onKeyDown(event) {
            if (event.key === 'Escape') hideTooltip()
          },
        },
        props.glyph,
      )
    }

    /**
     * The retract control in one finalized assistant message's action strip.
     * @param {object} props - `messageId`, `sessionId`, and the standard slot props.
     */
    function AssistantRetractAction(props) {
      const propSessionId = typeof props?.sessionId === 'string' ? props.sessionId : ''
      const messageId = typeof props?.messageId === 'string' ? props.messageId : ''
      const inputActions = props?.inputActions
      const anchorRef = React.useRef(null)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [actionClass, setActionClass] = React.useState('')
      const mounted = React.useRef(true)
      React.useEffect(() => {
        mounted.current = true
        return () => {
          mounted.current = false
        }
      }, [])
      // The entry renders into the shipped action row, so the row's own copy
      // button is right next to it and its class is what this button wears.
      React.useEffect(() => {
        const copy = copyButtonOf(actionRowNear(anchorRef.current))
        if (copy === null) return
        const className = actionClassOf(copy)
        setActionClass(className)
        reportClient({ phase: 'placement', component: 'assistant', placement: 'action-row', actionClass: className })
      }, [messageId])
      React.useEffect(() => {
        const sessionId = propSessionId || sessionIdNear(anchorRef.current)
        ensureHideRules(sessionId)
        reportClient({
          phase: 'render',
          component: 'assistant',
          hasSessionId: propSessionId !== '',
          hasMessageId: messageId !== '',
          hasInputActions: typeof inputActions?.setDraft === 'function',
          propKeys: Object.keys(props ?? {}).slice(0, 30),
        })
      }, [propSessionId, messageId])
      if (messageId === '') return null
      const label = text('retract')
      const start = () => {
        if (busy) return
        const sessionId = propSessionId || sessionIdNear(anchorRef.current)
        if (sessionId === '') {
          setError(text('rewindFailed'))
          return
        }
        setBusy(true)
        setError('')
        beginRetract({
          sessionId,
          messageId,
          inputActions,
          onError: (message) => {
            if (mounted.current) setError(message)
          },
        }).finally(() => {
          if (mounted.current) setBusy(false)
        })
      }
      return h(
        'span',
        { ref: anchorRef, 'data-dsh-desktop-plus-anchor': 'assistant', style: { display: 'contents' } },
        h(ActionIconButton, {
          marker: 'assistant-retract',
          label,
          className: actionClass,
          glyph: h(RetractIcon, null),
          disabled: busy,
          onClick: start,
        }),
        error === '' ? null : h('span', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)', fontSize: 12, paddingLeft: 4 } }, error),
      )
    }

    /**
     * The editable bubble that replaces one sent message in place.
     * @param {{edit: object}} props - the edit being composed.
     */
    function InlineMessageEditor(props) {
      const edit = props.edit
      const busy = edit.busy === true
      const appearance = edit.appearance ?? FALLBACK_BUBBLE
      const [value, setValue] = React.useState(edit.text)
      const areaRef = React.useRef(null)
      // Both run before paint: a `useEffect` here would let one frame render the
      // editor at its unmeasured height and then resize it, which reads as the
      // bubble flashing while it is being replaced.
      React.useLayoutEffect(() => {
        const area = areaRef.current
        if (area === null) return
        area.focus()
        area.setSelectionRange(area.value.length, area.value.length)
      }, [])
      React.useLayoutEffect(() => {
        const area = areaRef.current
        if (area === null) return
        area.style.height = 'auto'
        area.style.height = area.scrollHeight + 'px'
      }, [value])
      const send = () => {
        if (busy || value.trim() === '') return
        void commitInlineEdit(value)
      }
      return h(
        React.Fragment,
        null,
        h(
          'div',
          {
            'data-dsh-desktop-plus': 'editor-bubble',
            style: {
              boxSizing: 'border-box',
              width: appearance.width,
              maxWidth: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: appearance.padding,
              borderRadius: appearance.borderRadius,
              background: appearance.background,
              color: appearance.color,
              font: appearance.font,
            },
          },
          h('textarea', {
            ref: areaRef,
            value,
            rows: 1,
            spellCheck: false,
            'aria-label': text('editAction'),
            'data-dsh-desktop-plus': 'editor-input',
            disabled: busy,
            onChange(event) {
              setValue(event.target.value)
            },
            onKeyDown(event) {
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelInlineEdit()
                return
              }
              if (event.key !== 'Enter' || event.shiftKey === true || event.isComposing === true) return
              event.preventDefault()
              send()
            },
            style: {
              boxSizing: 'border-box',
              width: '100%',
              minWidth: 0,
              margin: 0,
              padding: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'inherit',
              font: 'inherit',
              lineHeight: 'inherit',
              resize: 'none',
              overflow: 'hidden',
            },
          }),
        ),
        h(
          'div',
          {
            'data-dsh-desktop-plus': 'editor-actions',
            style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, maxWidth: '100%' },
          },
          edit.error === ''
            ? null
            : h('span', { role: 'alert', style: { marginRight: 'auto', color: 'var(--dsw-alias-state-error-primary)', fontSize: 12, lineHeight: '18px' } }, edit.error),
          h(ActionIconButton, {
            marker: 'editor-cancel',
            label: text('editCancelHint'),
            glyph: h(CloseIcon, null),
            disabled: busy,
            onClick: cancelInlineEdit,
          }),
          h(ActionIconButton, {
            marker: 'editor-send',
            label: text('editSendHint'),
            glyph: h(SendIcon, null),
            disabled: busy || value.trim() === '',
            onClick: send,
          }),
        ),
      )
    }

    /**
     * The per-message retract/re-edit controls of one user bubble.
     *
     * They belong in the message's shipped action row (clock / copy / branch),
     * not above the bubble: that row is where this client puts every message
     * action, it already owns the hover reveal, and it is what a reader compares
     * them against. No slot reaches inside it, so this entry keeps its
     * `conversation.chat.user.before` seat as an anchor, then mounts its two
     * buttons into the same message's action row through a portal and wears the
     * copy button's own class. A host that renders no such row falls back to the
     * entry's own quiet row, so the controls never disappear.
     *
     * Editing happens in place: while one row is being edited this entry renders
     * the editable bubble instead of the buttons, and the row's sent bubble and
     * action row are hidden by the stylesheet.
     *
     * The durable message id is read from the surrounding flow row's
     * `[data-chat-node-key]` attribute, the client's own stable row anchor; the
     * slot's owner props carry only the message source.
     * @param {object} props - the standard session-scoped slot props.
     */
    function UserMessageActions(props) {
      const propSessionId = typeof props?.sessionId === 'string' ? props.sessionId : ''
      const inputActions = props?.inputActions
      const anchorRef = React.useRef(null)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [messageId, setMessageId] = React.useState('')
      const [editing, setEditing] = React.useState(null)
      const [placement, setPlacement] = React.useState({ row: false, host: null, className: '' })
      const mounted = React.useRef(true)
      React.useEffect(() => {
        mounted.current = true
        return () => {
          mounted.current = false
        }
      }, [])
      React.useEffect(() => {
        const row = anchorRef.current?.closest?.('[data-chat-node-key]')
        const key = row?.getAttribute?.('data-chat-node-key') ?? ''
        setMessageId(key.startsWith(USER_NODE_KEY_PREFIX) ? key.slice(USER_NODE_KEY_PREFIX.length) : '')
      }, [])
      React.useEffect(() => {
        const sessionId = propSessionId || sessionIdNear(anchorRef.current)
        ensureHideRules(sessionId)
        reportClient({
          phase: 'render',
          component: 'user',
          hasSessionId: propSessionId !== '',
          hasInputActions: typeof inputActions?.setDraft === 'function',
          propKeys: Object.keys(props ?? {}).slice(0, 30),
        })
      }, [propSessionId])
      React.useEffect(() => {
        const sync = () => {
          const current = inlineEdit.get()
          setEditing(current !== null && messageId !== '' && current.messageId === messageId ? current : null)
        }
        sync()
        return inlineEdit.subscribe(sync)
      }, [messageId])
      // Hiding the sent bubble and its action row is what makes room for the
      // editor. Doing it after paint leaves one frame showing the bubble and the
      // editor stacked, which is the flash this entry used to have.
      React.useLayoutEffect(() => {
        if (editing === null) return undefined
        const row = anchorRef.current?.closest?.('[data-chat-node-key]')
        if (row === null || row === undefined) return undefined
        row.setAttribute('data-dsh-desktop-plus-editing', '')
        return () => row.removeAttribute('data-dsh-desktop-plus-editing')
      }, [editing])

      // Mount the controls into this message's shipped action row. The row is
      // created in the same commit as this entry, so it exists by the time the
      // effect runs; the watcher re-attaches them if React replaces the row's
      // children later, which keeps them in place across transcript updates.
      React.useEffect(() => {
        const anchor = anchorRef.current
        if (anchor === null || typeof document === 'undefined') return undefined
        let host = null
        let attached = false
        let fallbackTimer = null
        let observer = null
        const attach = () => {
          // Read the ref each time: the effect's own node can be replaced when the
          // fallback row renders instead of the anchor.
          const anchor = anchorRef.current
          if (anchor === null) return false
          const actions = actionRowNear(anchor)
          if (actions === null) return false
          const copy = copyButtonOf(actions)
          if (copy === null) return false
          const className = actionClassOf(copy)
          const dom = reactDOM()
          if (dom !== null) {
            if (host === null) {
              host = document.createElement('span')
              host.setAttribute('data-dsh-desktop-plus', 'user-actions')
              host.style.display = 'contents'
            }
            if (host.parentNode !== actions || host.previousElementSibling !== copy) {
              actions.insertBefore(host, copy.nextSibling)
            }
          }
          if (!attached) {
            attached = true
            if (fallbackTimer !== null) {
              clearTimeout(fallbackTimer)
              fallbackTimer = null
            }
            setPlacement({ row: true, host, className })
            reportClient({
              phase: 'placement',
              component: 'user',
              placement: dom === null ? 'own-row-no-portal' : 'action-row',
              actionClass: className,
            })
          }
          return true
        }
        if (!attach()) {
          // The row is normally created in the same commit as this entry. When a
          // build renders none — or renders it much later — the controls fall back
          // to the entry's own row instead of disappearing.
          fallbackTimer = setTimeout(() => {
            fallbackTimer = null
            if (attached) return
            setPlacement({ row: true, host: null, className: '' })
            reportClient({ phase: 'placement', component: 'user', placement: 'own-row', actionClass: '' })
          }, 800)
          const scope = anchor.parentElement
          if (scope !== null && typeof MutationObserver === 'function') {
            observer = new MutationObserver(() => {
              attach()
            })
            observer.observe(scope, { childList: true, subtree: true })
          }
        }
        return () => {
          if (fallbackTimer !== null) clearTimeout(fallbackTimer)
          if (observer !== null) observer.disconnect()
          if (host !== null && host.parentNode !== null) host.parentNode.removeChild(host)
        }
      }, [])

      const start = (mode) => {
        if (busy) return
        const sessionId = propSessionId || sessionIdNear(anchorRef.current)
        if (messageId === '' || sessionId === '') {
          setError(text('rewindFailed'))
          return
        }
        setBusy(true)
        setError('')
        const request = {
          sessionId,
          messageId,
          anchor: anchorRef.current,
          inputActions,
          onError: (message) => {
            if (mounted.current) setError(message)
          },
        }
        const action = mode === 'edit' ? beginEdit(request) : beginRetract(request)
        action.finally(() => {
          if (mounted.current) setBusy(false)
        })
      }

      if (editing !== null) {
        return h(
          'span',
          { ref: anchorRef, 'data-dsh-desktop-plus-anchor': 'user', style: { display: 'contents' } },
          h(InlineMessageEditor, { edit: editing }),
        )
      }

      const buttons = h(
        React.Fragment,
        null,
        h(ActionIconButton, {
          marker: 'user-retract',
          label: text('retract'),
          className: placement.className,
          glyph: h(RetractIcon, null),
          disabled: busy,
          onClick: () => start('retract'),
        }),
        h(ActionIconButton, {
          marker: 'user-edit',
          label: text('editAction'),
          className: placement.className,
          glyph: h(EditIcon, null),
          disabled: busy,
          onClick: () => start('edit'),
        }),
      )

      const errorNode =
        error === ''
          ? null
          : h(
              'span',
              {
                role: 'alert',
                style: { color: 'var(--dsw-alias-state-error-primary)', fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap' },
              },
              error,
            )

      const dom = reactDOM()
      if (placement.row && placement.host !== null && dom !== null) {
        return h(
          'span',
          { ref: anchorRef, 'data-dsh-desktop-plus-anchor': 'user', style: { display: 'contents' } },
          errorNode,
          dom.createPortal(buttons, placement.host),
        )
      }
      if (placement.row) {
        // This module graph cannot portal: keep the controls in the entry's own
        // row, where they also serve as the fallback look.
        return h(
          'div',
          {
            ref: anchorRef,
            'data-dsh-desktop-plus-anchor': 'user',
            style: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, width: '100%' },
          },
          errorNode,
          buttons,
        )
      }
      // Placement not known yet (first commit) or impossible on this host: the
      // anchor is display:contents and empty, so it costs no layout at all.
      return h('span', { ref: anchorRef, 'data-dsh-desktop-plus-anchor': 'user', style: { display: 'contents' } }, errorNode)
    }

    /** The pending-retraction confirmation dialog. */
    function RewindDialog() {
      const [pending, setPending] = React.useState(pendingRewind.get())
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      React.useEffect(
        () =>
          pendingRewind.subscribe(() => {
            setPending(pendingRewind.get())
            setBusy(false)
            setError('')
          }),
        [],
      )
      React.useEffect(() => {
        if (pending === null) return undefined
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          pendingRewind.set(null)
        }
        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
      }, [pending])
      if (pending === null) return null
      const confirm = async () => {
        if (busy) return
        setBusy(true)
        setError('')
        try {
          const result = await pending.run()
          if (result.ok === true) {
            pendingRewind.set(null)
            return
          }
          setError(rewindErrorText(result))
        } catch (failure) {
          setError(rewindTransportText(failure))
        } finally {
          setBusy(false)
        }
      }
      return h(
        'div',
        {
          style: {
            position: 'fixed',
            inset: 0,
            zIndex: 4000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(0, 0, 0, 0.42)',
            pointerEvents: 'auto',
          },
          onMouseDown(event) {
            if (event.target === event.currentTarget) pendingRewind.set(null)
          },
        },
        h(
          'div',
          {
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': pending.title,
            'data-dsh-desktop-plus': 'rewind-dialog',
            style: {
              width: 'min(460px, 100%)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: '18px 20px 16px',
              borderRadius: 12,
              border: '1px solid var(--dsw-alias-border-l1)',
              background: 'var(--dsw-alias-bg-overlay)',
              boxShadow: '0 18px 48px rgba(0, 0, 0, 0.35)',
              color: 'var(--dsw-alias-label-primary)',
              fontSize: 13,
              lineHeight: 1.55,
            },
          },
          h('div', { style: { fontSize: 15, fontWeight: 600 } }, pending.title),
          h('div', { style: { color: 'var(--dsw-alias-label-secondary)' } }, pending.body),
          error === '' ? null : h('div', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, error),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 } },
            h(DialogButton, { onClick: () => pendingRewind.set(null), disabled: busy, autoFocus: true }, text('cancel')),
            h(DialogButton, { destructive: true, disabled: busy, onClick: confirm }, busy ? text('rewinding') : pending.confirm),
          ),
        ),
      )
    }

    /**
     * Register this chunk's slots.
     * @param {object} ctx - the plugin context.
     * @param {object} rt - the shared runtime from the entry.
     */
    function mount(ctx, rt) {
      runtime = rt
      clientContext = rt.getContext()
      hideRules = rt.hideRules
      hideRuleListeners = rt.hideRuleListeners
      ensureCss('rewind', REWIND_CSS)
      rt.mountSlot('conversation.chat.user.before', () =>
        ctx.slots.register({ name: 'conversation.chat.user.before', select: selectUserPrompt }, UserMessageActions),
      )
      rt.mountSlot('conversation.chat.assistant-actions', () =>
        ctx.slots.register(
          { name: 'conversation.chat.assistant-actions', id: 'dsh-desktop-plus-retract', order: 20 },
          AssistantRetractAction,
        ),
      )
      rt.mountSlot('shell.overlay', () =>
        ctx.slots.register({ name: 'shell.overlay', id: 'dsh-desktop-plus-rewind-dialog', order: 1001 }, RewindDialog),
      )
    }

    return { mount }
  },
})
