/**
 * Web client chunk: the turn-by-turn conversation preview column.
 *
 * Loaded by \`lib/client.js\` through \`require.async('./client.preview.js')\`.
 * The entry passes the shared runtime (text, reportClient, getContext,
 * cssString, reactDOM, hide rules, mountSlot) to \`mount\`.
 */
window.__ModuleLoader__.load({
  id: 'dsh-desktop-plus',
  chunk: 'client.preview.js',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    let runtime = null
    const text = (key, values) => runtime.text(key, values)
    const reportClient = payload => runtime.reportClient(payload)
    const getContext = () => runtime.getContext()
    const cssString = value => runtime.cssString(value)
    const reactDOM = () => runtime.reactDOM()
    /** Session id -> learned hide rules; replaced by the runtime's map in mount. */
    let hideRules = new Map()
    /** View components that redraw when a session's hidden-turn set changes. */
    let hideRuleListeners = new Set()
    /** The client context, set by mount; jumpTo reads it lazily. */
    let clientContext = null
    /** The column's static CSS. */
    const PREVIEW_CSS =       // is mounted it would duplicate every Turn and cover the transcript with
      // its hover card. The rail's nav is the only `nav[aria-label]` inside the
      // transcript scrollport; the header breadcrumb nav is outside it.
      '[data-dsh-desktop-plus-preview="on"] [data-conversation-scroll] nav[aria-label]{display:none!important}' +
      // The conversation's own right-edge width handle sits beside the preview
      // column's left-edge handle; keep the left one, which cannot be mistaken
      // for the preview's resizer, and remove the ambiguous neighbour.
      '[data-dsh-desktop-plus-preview="on"] [data-width-handle="right"]{display:none!important}' +
      // The preview is a real split pane: the scroll body gives the preview
      // room on the right, and the chat stays centered in the remaining area.
      '[data-dsh-desktop-plus-preview="on"] [data-conversation-scroll]{padding-left:0;padding-right:var(--dpt-pad-right,0px)}' +
      '.dpt-preview{position:absolute;top:0;right:var(--dpt-preview-gap,8px);bottom:0;z-index:5;display:flex;flex-direction:column;width:var(--dpt-preview-width,320px);min-width:0;border-left:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));background:var(--dsw-alias-bg-base,#fff);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 30%,var(--dsw-alias-bg-base,#fff));color:var(--dsw-alias-label-primary,#0f1115);font-family:inherit;transition:width .18s cubic-bezier(.2,.8,.2,1)}' +
      '.dpt-preview[data-resizing="true"]{transition:none}' +
      '.dpt-preview[data-collapsed="true"]{width:34px}' +
      '.dpt-resize{position:absolute;top:0;bottom:0;left:-4px;z-index:3;width:8px;cursor:col-resize}' +
      '.dpt-resize::after{content:"";position:absolute;top:0;bottom:0;left:3.5px;width:1px;background:transparent;transition:background .12s ease}' +
      '.dpt-resize:hover::after,.dpt-resize[data-dragging="true"]::after{background:var(--dsw-alias-state-business-primary,#4176e6)}' +
      '.dpt-resize:focus-visible{outline:none}' +
      '.dpt-resize:focus-visible::after{background:var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6))}' +
      '.dpt-head{flex:none;display:flex;align-items:center;gap:8px;height:44px;padding:0 10px 0 14px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.04))}' +
      '.dpt-title{font-size:12.5px;font-weight:600;letter-spacing:-.005em}' +
      '.dpt-count{font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-tertiary,#8b929a);padding:1px 6px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06));border-radius:999px;font-variant-numeric:tabular-nums}' +
      '.dpt-icon{margin-left:auto;width:26px;height:26px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-tertiary,#8b929a);cursor:pointer}' +
      '.dpt-icon:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#0f1115)}' +
      '.dpt-icon:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:-2px}' +
      '.dpt-icon svg{width:14px;height:14px}' +
      '.dpt-list{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;padding:7px 8px 12px}' +
      '.dpt-list::-webkit-scrollbar{width:0}' +
      '.dpt-ladder{position:relative}' +
      '.dpt-ladder::before{content:"";position:absolute;left:30px;top:16px;bottom:16px;width:1px;background:var(--dsw-alias-border-l2,rgba(0,0,0,.1))}' +
      '.dpt-row{position:relative;display:flex;gap:10px;width:100%;padding:8px 8px 8px 6px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}' +
      '.dpt-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}' +
      '.dpt-row[data-active="true"]{background:rgba(65,118,230,.07);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176e6) 7%,transparent)}' +
      '.dpt-row[data-active="true"]::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:2px;border-radius:2px;background:var(--dsw-alias-state-business-primary,#4176e6)}' +
      '.dpt-row:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#4176e6));outline-offset:-2px}' +
      '.dpt-no{position:relative;flex:none;width:30px;padding-top:1px;text-align:center;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10.5px;line-height:18px;color:var(--dsw-alias-label-tertiary,#8b929a);font-variant-numeric:tabular-nums}' +
      '.dpt-no::after{content:"";position:absolute;right:3px;top:8px;width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-bg-base,#fff);box-shadow:inset 0 0 0 1px var(--dsw-alias-label-tertiary,#8b929a)}' +
      '.dpt-row[data-active="true"] .dpt-no::after{background:var(--dsw-alias-state-business-primary,#4176e6);box-shadow:0 0 0 3px rgba(65,118,230,.16)}' +
      '.dpt-main{min-width:0;flex:1}' +
      '.dpt-prompt{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12.5px;line-height:1.55;font-weight:500;letter-spacing:.002em;color:var(--dsw-alias-label-primary,#0f1115)}' +
      '.dpt-row[data-active="true"] .dpt-prompt{font-weight:600}' +
      '.dpt-reply{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:2px;font-size:11.5px;line-height:1.55;color:var(--dsw-alias-label-secondary,#5d646c)}' +
      '.dpt-meta{display:flex;align-items:center;gap:5px;margin-top:4px;font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8b929a)}' +
      '.dpt-meta[data-running="true"]{color:var(--dsw-alias-state-business-primary,#4176e6)}' +
      '.dpt-pulse{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-business-primary,#4176e6);animation:dpt-preview-pulse 1.4s ease-in-out infinite}' +
      '@keyframes dpt-preview-pulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}' +
      '.dpt-empty{padding:22px 14px;color:var(--dsw-alias-label-tertiary,#8b929a);font-size:12px;line-height:1.6}' +
      '.dpt-foot{flex:none;display:flex;align-items:center;gap:8px;padding:7px 10px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.04));color:var(--dsw-alias-label-tertiary,#8b929a);font-size:10.5px}' +
      '.dpt-follow{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;color:inherit;padding:3px 4px;border-radius:6px;cursor:pointer;font:inherit}' +
      '.dpt-follow:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));color:var(--dsw-alias-label-secondary,#5d646c)}' +
      '.dpt-follow-dot{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-business-primary,#4176e6)}' +
      '.dpt-follow[data-follow="false"] .dpt-follow-dot{background:var(--dsw-alias-label-tertiary,#8b929a)}' +
      '.dpt-back{margin-left:auto;border:0;background:transparent;color:var(--dsw-alias-state-business-primary,#4176e6);font:inherit;padding:3px 5px;border-radius:6px;cursor:pointer;display:none}' +
      '.dpt-back:hover{background:rgba(65,118,230,.08)}' +
      '.dpt-foot[data-paused="true"] .dpt-back{display:inline-flex}' +
      '.dpt-rail{display:none;flex:1;flex-direction:column;align-items:center;gap:8px;min-height:0;padding:8px 0 10px}' +
      '.dpt-rail-btn{flex:none;width:26px;height:26px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-tertiary,#8b929a);cursor:pointer}' +
      '.dpt-rail-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-primary,#0f1115)}' +
      '.dpt-rail-btn svg{width:13px;height:13px}' +
      '.dpt-ticks{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;justify-content:safe center;gap:7px;padding-block:8px;overflow-y:auto;scrollbar-width:none}' +
      '.dpt-ticks::-webkit-scrollbar{width:0}' +
      '.dpt-tick{flex:none;width:14px;height:2px;padding:0;border:0;border-radius:2px;background:var(--dsw-alias-border-l4,rgba(0,0,0,.16));cursor:pointer;transition:width .12s ease,background .12s ease}' +
      '.dpt-tick:hover{background:var(--dsw-alias-label-tertiary,#8b929a)}' +
      '.dpt-tick[data-active="true"]{width:22px;background:var(--dsw-alias-state-business-primary,#4176e6)}' +
      '.dpt-rail-label{writing-mode:vertical-rl;text-orientation:mixed;font-size:10.5px;letter-spacing:.08em;color:var(--dsw-alias-label-tertiary,#8b929a)}' +
      '.dpt-preview[data-collapsed="true"] .dpt-head,.dpt-preview[data-collapsed="true"] .dpt-list,.dpt-preview[data-collapsed="true"] .dpt-foot{display:none}' +
      '.dpt-preview[data-collapsed="true"] .dpt-rail{display:flex}' +
      '.dpt-preview[data-collapsed="true"] .dpt-resize{display:none}' +
      '[data-dsh-desktop-plus-preview-flash]{box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary,#4176e6)!important;transition:box-shadow .15s ease}' +
      '@media (prefers-reduced-motion:reduce){.dpt-preview,[data-dsh-desktop-plus-preview="on"] [data-conversation-scroll]{transition:none}.dpt-pulse{animation:none}}'

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

    const PREVIEW_WIDTH_KEY = 'dsh-desktop-plus.preview.width'
    const PREVIEW_WIDTH_MODE_KEY = 'dsh-desktop-plus.preview.width-mode'
    const PREVIEW_COLLAPSED_KEY = 'dsh-desktop-plus.preview.collapsed'
    const PREVIEW_DEFAULT_WIDTH = 320
    const PREVIEW_GUTTER = 8
    const EMPTY_PREVIEW_TURNS = []

    /** Fallback chat hook for a build that does not provide `useChat` on this slot. */
    function useNoChat() {
      return EMPTY_PREVIEW_TURNS
    }

    /** Fallback projection hook; a missing projection reads as absent. */
    function useNoProjection() {
      return undefined
    }

    /** Fallback Session hook; no Session reads as not running. */
    function useNoSession() {
      return false
    }

    /**
     * Clamp a stored or dragged preview width into its contract range.
     * @param {number} value - candidate width.
     * @returns {number} an integer width between the two bounds.
     */
    function clampPreviewWidth(value, maximum = 440) {
      if (!Number.isFinite(value)) return PREVIEW_DEFAULT_WIDTH
      return Math.min(maximum, Math.max(160, Math.round(value)))
    }

    /**
     * Read the persisted preview width.
     * @returns {number} the stored width, or the default.
     */
    function readPreviewWidth() {
      try {
        if (typeof window === 'undefined') return PREVIEW_DEFAULT_WIDTH
        const raw = window.localStorage.getItem(PREVIEW_WIDTH_KEY)
        return raw === null ? PREVIEW_DEFAULT_WIDTH : clampPreviewWidth(Number(raw), 640)
      } catch (_storageUnavailable) {
        return PREVIEW_DEFAULT_WIDTH
      }
    }

    /**
     * Read the persisted collapsed state.
     * @returns {boolean} whether the column was collapsed by the reader.
     */
    function readPreviewCollapsed() {
      try {
        if (typeof window === 'undefined') return false
        return window.localStorage.getItem(PREVIEW_COLLAPSED_KEY) === '1'
      } catch (_storageUnavailable) {
        return false
      }
    }

    /**
     * Read how the column's width follows the conversation area.
     * @returns {'auto' | 'manual'} `auto` until the reader drags the edge.
     */
    function readPreviewWidthMode() {
      try {
        if (typeof window === 'undefined') return 'auto'
        return window.localStorage.getItem(PREVIEW_WIDTH_MODE_KEY) === 'manual' ? 'manual' : 'auto'
      } catch (_storageUnavailable) {
        return 'auto'
      }
    }

    /**
     * Persist one preview preference.
     * @param {string} key - storage key.
     * @param {string | number} value - value to store.
     */
    function storePreview(key, value) {
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, String(value))
      } catch (_storageUnavailable) {
        // A full or disabled storage leaves the preference for this page only.
      }
    }

    /**
     * Normalize one preview text field.
     * @param {unknown} value - wire value.
     * @returns {string} the string, or an empty one.
     */
    function previewTextOf(value) {
      return typeof value === 'string' ? value : ''
    }

    /**
     * Merge the loaded-window navigation items with the Host turn outline.
     *
     * The outline names every Turn and carries the seq needed to load one that
     * is not in the window; the loaded items carry the anchor and the richer
     * previews. Entry objects are reused while their fields are unchanged so a
     * streaming reply re-renders only the row it belongs to.
     * @param {readonly object[]} items - loaded navigation items.
     * @param {unknown} outline - `turnOutline` projection value, treated as wire data.
     * @param {Map<number, object>} cache - entry cache owned by one mounted column.
     * @returns {readonly object[]} every known Turn, ascending.
     */
    function mergePreviewTurns(items, outline, cache, skippedTurns, firstLoadedSeq, lastLoadedSeq) {
      const byTurn = new Map()
      if (Array.isArray(outline)) {
        for (const raw of outline) {
          if (raw === null || typeof raw !== 'object') continue
          const turn = raw.turn
          if (!Number.isSafeInteger(turn) || turn < 0) continue
          if (skippedTurns?.has(turn) === true) continue
          byTurn.set(turn, {
            turn,
            seq: Number.isSafeInteger(raw.seq) ? raw.seq : null,
            prompt: previewTextOf(raw.prompt),
            response: previewTextOf(raw.response),
            loaded: false,
          })
        }
      }
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item === null || typeof item !== 'object') continue
          const turn = item.turn
          if (!Number.isSafeInteger(turn) || turn < 0) continue
          if (skippedTurns?.has(turn) === true) continue
          const previous = byTurn.get(turn)
          byTurn.set(turn, {
            turn,
            seq: previous === undefined ? null : previous.seq,
            prompt: previewTextOf(item.prompt) || (previous === undefined ? '' : previous.prompt),
            response: previewTextOf(item.response) || (previous === undefined ? '' : previous.response),
            loaded: true,
          })
        }
      }
      for (const turn of cache.keys()) {
        if (!byTurn.has(turn)) cache.delete(turn)
      }
      if (firstLoadedSeq !== null && lastLoadedSeq !== null) {
        for (const [turn, entry] of byTurn) {
          if (entry.loaded) continue
          if (entry.seq === null) continue
          if (entry.seq >= firstLoadedSeq && entry.seq <= lastLoadedSeq) byTurn.delete(turn)
        }
      }
      const result = []
      for (const turn of [...byTurn.keys()].sort((left, right) => left - right)) {
        const entry = byTurn.get(turn)
        const previous = cache.get(turn)
        if (
          previous !== undefined
          && previous.prompt === entry.prompt
          && previous.response === entry.response
          && previous.loaded === entry.loaded
          && previous.seq === entry.seq
        ) {
          result.push(previous)
        } else {
          cache.set(turn, entry)
          result.push(entry)
        }
      }
      return result
    }

    /** Selector over the loaded Turn navigation items. */
    function selectPreviewTurns(snapshot) {
      return snapshot?.navigation?.items?.() ?? EMPTY_PREVIEW_TURNS
    }

    /** Selector over the Session's running flag. */
    function selectPreviewRunning(snapshot) {
      return snapshot?.running === true
    }

    /**
     * Selector over the loaded window's first anchor seq.
     * @param {object} snapshot - chat snapshot.
     * @returns {number | null} the seq, or null with no loaded node.
     */
    function selectFirstLoadedSeq(snapshot) {
      const order = snapshot?.order
      if (!Array.isArray(order) || order.length === 0) return null
      const seq = snapshot.nodes?.get?.(order[0])?.anchorSeq
      return Number.isSafeInteger(seq) ? seq : null
    }

    /**
     * Selector over the loaded window's last anchor seq.
     * @param {object} snapshot - chat snapshot.
     * @returns {number | null} the seq, or null with no loaded node.
     */
    function selectLastLoadedSeq(snapshot) {
      const order = snapshot?.order
      if (!Array.isArray(order) || order.length === 0) return null
      const seq = snapshot.nodes?.get?.(order[order.length - 1])?.anchorSeq
      return Number.isSafeInteger(seq) ? seq : null
    }

    /** Shared collapse chevron pointing left. */
    function PreviewChevronLeft() {
      return h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 },
        h('path', { d: 'M9.5 4 6 8l3.5 4' }))
    }

    /** Shared expand chevron pointing right. */
    function PreviewChevronRight() {
      return h('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 },
        h('path', { d: 'M6.5 4 10 8l-3.5 4' }))
    }

    /**
     * One Turn row in the preview ladder.
     *
     * Memoized on the facts the row draws, so a streaming reply does not
     * re-render every other Turn in a long conversation.
     */
    const PreviewTurnRow = React.memo(function PreviewTurnRow({
      entry, display, active, pending, failed, running, onJump, registerRow,
    }) {
      const meta = previewRowMeta(entry, pending, failed, running)
      return h(
        'button',
        {
          type: 'button',
          className: 'dpt-row',
          'data-active': active ? 'true' : 'false',
          'aria-current': active ? 'true' : undefined,
          'aria-busy': pending ? 'true' : undefined,
          'aria-label': text('previewJump', { turn: display }),
          ref: node => { registerRow(entry.turn, node) },
          onClick: () => { void onJump(entry) },
        },
        h('span', { className: 'dpt-no' }, String(display).padStart(2, '0')),
        h(
          'span',
          { className: 'dpt-main' },
          h('span', { className: 'dpt-prompt' }, entry.prompt === '' ? text('previewTurn', { turn: display }) : entry.prompt),
          entry.response === '' ? null : h('span', { className: 'dpt-reply' }, entry.response),
          meta,
        ),
      )
    }, (left, right) => (
      left.entry === right.entry
      && left.display === right.display
      && left.active === right.active
      && left.pending === right.pending
      && left.failed === right.failed
      && left.running === right.running
      && left.onJump === right.onJump
    ))

    /**
     * The one status line a Turn row shows, if any.
     * @param {object} entry - ladder entry.
     * @param {boolean} pending - whether its history is loading.
     * @param {boolean} failed - whether loading it failed.
     * @param {boolean} running - whether it is the streaming last Turn.
     * @returns {React.ReactElement | null} the status line.
     */
    function previewRowMeta(entry, pending, failed, running) {
      if (pending) {
        return h('span', { className: 'dpt-meta', 'data-running': 'true' }, h('span', { className: 'dpt-pulse' }), text('previewLoading'))
      }
      if (failed) return h('span', { className: 'dpt-meta' }, text('previewLoadFailed'))
      if (entry.loaded === false) return h('span', { className: 'dpt-meta' }, text('previewLoadHint'))
      if (running) {
        return h('span', { className: 'dpt-meta', 'data-running': 'true' }, h('span', { className: 'dpt-pulse' }), text('previewRunning'))
      }
      return null
    }

    /**
     * The preview column itself: a Turn ladder docked inside the conversation
     * content, with the scroll body reserving its width.
     * @param {object} props - the anchor's standard props plus the portal host.
     * @returns {React.ReactElement} the column.
     */
    function ConversationPreviewColumn(props) {
      const { host, sessionId } = props
      const useChat = typeof props.useChat === 'function' ? props.useChat : useNoChat
      const useProjection = typeof props.useProjection === 'function' ? props.useProjection : useNoProjection
      const useSession = typeof props.useSession === 'function' ? props.useSession : useNoSession
      const items = useChat(selectPreviewTurns)
      const outline = useProjection('turnOutline')
      const running = useSession(selectPreviewRunning)
      const firstLoadedSeq = useChat(selectFirstLoadedSeq)
      const lastLoadedSeq = useChat(selectLastLoadedSeq)
      const cache = React.useRef(new Map())
      const [width, setWidth] = React.useState(readPreviewWidth)
      const [collapsed, setCollapsed] = React.useState(readPreviewCollapsed)
      const [resizing, setResizing] = React.useState(false)
      const [hostWidth, setHostWidth] = React.useState(0)
      const [chatRight, setChatRight] = React.useState(null)
      const [activeTurn, setActiveTurn] = React.useState(null)
      const [follow, setFollow] = React.useState(true)
      const [widthMode, setWidthMode] = React.useState(readPreviewWidthMode)
      const [pendingTurn, setPendingTurn] = React.useState(null)
      const [failedTurn, setFailedTurn] = React.useState(null)
      const [unavailableTurns, setUnavailableTurns] = React.useState(() => new Set())
      const [hideRevision, setHideRevision] = React.useState(0)
      const widthRef = React.useRef(width)
      widthRef.current = width
      const widthModeRef = React.useRef(widthMode)
      widthModeRef.current = widthMode
      const collapsedRef = React.useRef(false)
      const listRef = React.useRef(null)
      const ticksRef = React.useRef(null)
      const rowNodes = React.useRef(new Map())
      const scrollerRef = React.useRef(null)
      const measureRef = React.useRef(null)
      const chatMeasureRef = React.useRef(null)
      const disposedRef = React.useRef(false)
      const dragCleanupRef = React.useRef(null)
      const pendingRef = React.useRef(null)
      const maxWidthRef = React.useRef(440)
      const effectiveWidthRef = React.useRef(320)
      pendingRef.current = pendingTurn

      React.useEffect(() => () => {
        disposedRef.current = true
        dragCleanupRef.current?.()
      }, [])

      React.useEffect(() => {
        const listener = changedSession => {
          if (changedSession === sessionId) setHideRevision(current => current + 1)
        }
        hideRuleListeners.add(listener)
        return () => { hideRuleListeners.delete(listener) }
      }, [sessionId])

      const hiddenTurns = hideRules.get(sessionId)?.turns
      const skippedTurns = React.useMemo(() => {
        if ((hiddenTurns === undefined || hiddenTurns.size === 0) && unavailableTurns.size === 0) return undefined
        const skipped = new Set(hiddenTurns ?? [])
        for (const turn of unavailableTurns) skipped.add(turn)
        return skipped
      }, [hiddenTurns, unavailableTurns, hideRevision])
      const turns = React.useMemo(
        () => mergePreviewTurns(items, outline, cache.current, skippedTurns, firstLoadedSeq, lastLoadedSeq),
        [items, outline, skippedTurns, firstLoadedSeq, lastLoadedSeq],
      )

      React.useEffect(() => {
        reportClient({
          phase: 'preview',
          component: 'mounted',
          hasChat: typeof props.useChat === 'function',
          hasProjection: typeof props.useProjection === 'function',
          hasSession: typeof props.useSession === 'function',
        })
        const navs = host.querySelectorAll('[data-conversation-scroll] nav[aria-label]')
        reportClient({
          phase: 'preview',
          component: 'rail',
          navs: navs.length,
          hidden: [...navs].every(nav => window.getComputedStyle(nav).display === 'none'),
        })
      }, [])

      React.useEffect(() => {
        try {
          const resetKey = 'dsh-desktop-plus.preview.width-reset'
          if (window.localStorage.getItem(resetKey) === '1') return
          window.localStorage.removeItem('dsh.conversation.contentWidth')
          window.localStorage.setItem(resetKey, '1')
          const target = host.parentElement ?? host
          target.style.removeProperty('--dsh-chat-user-width')
        } catch (_storageUnavailable) {
          // A disabled storage leaves the conversation width as it is.
        }
      }, [])

      React.useEffect(() => {
        if (turns.length > 0) reportClient({ phase: 'preview', component: 'turns', count: turns.length })
      }, [turns.length])

      React.useEffect(() => {
        if (unavailableTurns.size === 0) return
        const loaded = new Set(Array.isArray(items) ? items.map(item => item.turn) : [])
        setUnavailableTurns(current => {
          let changed = false
          const next = new Set(current)
          for (const turn of current) {
            if (loaded.has(turn)) {
              next.delete(turn)
              changed = true
            }
          }
          return changed ? next : current
        })
      }, [items, unavailableTurns.size])

      const composerOverhang = 16
      const gutterStart = chatRight === null ? null : chatRight + composerOverhang + PREVIEW_GUTTER
      const gutterAvailable = gutterStart === null || hostWidth === 0
        ? 0
        : Math.max(0, hostWidth - PREVIEW_GUTTER - gutterStart)
      const overlay = gutterStart !== null
      const naturalMargin = chatRight === null ? 0 : Math.max(0, hostWidth - chatRight)
      // The preview may take room from the chat, but the chat keeps a readable
      // floor; the cap also stops an ultrawide monitor from yielding a giant
      // column.
      const previewMax = Math.max(160, Math.min(1600, hostWidth - 680 - 8))
      const autoWidth = Math.max(160, Math.min(1200, gutterAvailable))
      const effectiveWidth = overlay
        ? (widthMode === 'auto' ? autoWidth : Math.max(160, Math.min(previewMax, width)))
        : width
      maxWidthRef.current = overlay ? previewMax : 440
      effectiveWidthRef.current = effectiveWidth
      const collapsedNow = collapsed
      const renderedWidth = collapsedNow ? 34 : effectiveWidth
      const padRight = renderedWidth + 8
      collapsedRef.current = collapsedNow

      React.useEffect(() => {
        if (hostWidth === 0) return
        reportClient({
          phase: 'preview',
          component: 'layout-overlay',
          hostWidth,
          width,
          effectiveWidth,
          widthMode,
          previewMax,
          padRight,
          naturalMargin,
          chatRight,
          gutterAvailable,
          collapsed: collapsedNow,
        })
      }, [hostWidth, width, effectiveWidth, chatRight, gutterAvailable, collapsedNow])

      React.useLayoutEffect(() => {
        if (host === null) return undefined
        host.dataset.dshDesktopPlusPreview = 'on'
        host.dataset.dptMode = 'overlay'
        host.style.setProperty('--dpt-preview-width', renderedWidth + 'px')
        host.style.setProperty('--dpt-preview-gap', PREVIEW_GUTTER + 'px')
        host.style.setProperty('--dpt-pad-right', padRight + 'px')
        return () => {
          delete host.dataset.dshDesktopPlusPreview
          delete host.dataset.dptMode
          host.style.removeProperty('--dpt-preview-width')
          host.style.removeProperty('--dpt-preview-gap')
          host.style.removeProperty('--dpt-pad-right')
        }
      }, [host, renderedWidth, padRight])

      React.useLayoutEffect(() => {
        if (host === null) return undefined
        const update = () => { setHostWidth(host.clientWidth) }
        update()
        if (typeof ResizeObserver !== 'function') return undefined
        const observer = new ResizeObserver(update)
        observer.observe(host)
        return () => { observer.disconnect() }
      }, [host])

      React.useLayoutEffect(() => {
        if (host === null) return undefined
        let frame = 0
        const measure = () => {
          frame = 0
          const column = host.querySelector('[data-chat-flow]')
          if (column === null) {
            setChatRight(null)
            return
          }
          const computedMax = Number.parseFloat(window.getComputedStyle(column).maxWidth)
          const naturalWidth = Number.isFinite(computedMax) && computedMax > 0
            ? Math.min(computedMax, host.clientWidth)
            : column.getBoundingClientRect().width
          const next = Math.round((host.clientWidth + naturalWidth) / 2)
          setChatRight(current => (current === next ? current : next))
        }
        const schedule = () => {
          if (frame === 0) frame = requestAnimationFrame(measure)
        }
        chatMeasureRef.current = measure
        measure()
        schedule()
        const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null
        if (resize !== null) {
          resize.observe(host)
          const scrollBody = host.querySelector('[data-conversation-scroll]')
          if (scrollBody !== null) resize.observe(scrollBody, { box: 'content-box' })
        }
        const mutation = typeof MutationObserver === 'function'
          ? new MutationObserver(schedule)
          : null
        if (mutation !== null) mutation.observe(host, { childList: true, subtree: true })
        return () => {
          if (frame !== 0) cancelAnimationFrame(frame)
          if (resize !== null) resize.disconnect()
          if (mutation !== null) mutation.disconnect()
          chatMeasureRef.current = null
        }
      }, [host])

      React.useLayoutEffect(() => {
        chatMeasureRef.current?.()
      }, [renderedWidth, hostWidth])

      React.useEffect(() => {
        if (host === null) return undefined
        const scroller = host.querySelector('[data-conversation-scroll]')
        if (scroller === null) return undefined
        scrollerRef.current = scroller
        let frame = 0
        const measure = () => {
          frame = 0
          const threshold = scroller.getBoundingClientRect().top + 80
          let active = null
          let firstTurn = null
          const rows = scroller.querySelectorAll('[data-chat-turn]')
          for (const row of rows) {
            if (row.offsetParent === null) continue
            const box = row.getBoundingClientRect()
            if (box.height === 0) continue
            const turn = Number(row.getAttribute('data-chat-turn'))
            if (!Number.isSafeInteger(turn)) continue
            if (firstTurn === null) firstTurn = turn
            if (box.top <= threshold) {
              active = turn
            } else if (active !== null) {
              break
            }
          }
          const resolved = active ?? firstTurn
          if (resolved !== null) {
            setActiveTurn(current => (current === resolved ? current : resolved))
          }
        }
        const onScroll = () => {
          if (frame === 0) frame = requestAnimationFrame(measure)
        }
        measureRef.current = measure
        scroller.addEventListener('scroll', onScroll, { passive: true })
        measure()
        return () => {
          scroller.removeEventListener('scroll', onScroll)
          if (frame !== 0) cancelAnimationFrame(frame)
          scrollerRef.current = null
          measureRef.current = null
        }
      }, [host])

      React.useEffect(() => {
        measureRef.current?.()
      }, [turns.length])

      React.useEffect(() => {
        if (!follow || activeTurn === null) return
        const list = listRef.current
        const row = rowNodes.current.get(String(activeTurn))
        if (list === null || row === undefined) return
        const listBox = list.getBoundingClientRect()
        if (listBox.height === 0) return
        const rowBox = row.getBoundingClientRect()
        if (rowBox.top < listBox.top + 4) {
          list.scrollTop += rowBox.top - listBox.top - 4
        } else if (rowBox.bottom > listBox.bottom - 4) {
          list.scrollTop += rowBox.bottom - listBox.bottom + 4
        }
      }, [activeTurn, follow, turns.length, renderedWidth])

      React.useEffect(() => {
        if (!collapsedNow) return
        const ticks = ticksRef.current
        if (ticks === null) return
        const tick = ticks.querySelector('[data-active="true"]')
        if (tick === null) return
        const ticksBox = ticks.getBoundingClientRect()
        const tickBox = tick.getBoundingClientRect()
        if (tickBox.top < ticksBox.top + 4) ticks.scrollTop += tickBox.top - ticksBox.top - 4
        else if (tickBox.bottom > ticksBox.bottom - 4) ticks.scrollTop += tickBox.bottom - ticksBox.bottom + 4
      }, [activeTurn, collapsedNow, turns.length])

      const registerRow = React.useCallback((turn, node) => {
        const key = String(turn)
        if (node === null) rowNodes.current.delete(key)
        else rowNodes.current.set(key, node)
      }, [])

      const onListScroll = React.useCallback(() => {
        if (!follow || activeTurn === null) return
        const list = listRef.current
        const row = rowNodes.current.get(String(activeTurn))
        if (list === null || row === undefined) return
        const listBox = list.getBoundingClientRect()
        const rowBox = row.getBoundingClientRect()
        if (rowBox.bottom < listBox.top || rowBox.top > listBox.bottom) setFollow(false)
      }, [activeTurn, follow])

      const jumpTo = React.useCallback(async entry => {
        if (pendingRef.current !== null) return
        const scroller = scrollerRef.current ?? host.querySelector('[data-conversation-scroll]')
        if (scroller === null) return
        setActiveTurn(entry.turn)
        setFollow(true)
        setFailedTurn(current => (current === entry.turn ? null : current))
        const find = () => {
          const selector = '[data-chat-turn=' + cssString(String(entry.turn)) + ']'
          for (const node of scroller.querySelectorAll(selector)) {
            if (node.offsetParent !== null && node.getBoundingClientRect().height > 0) return node
          }
          return null
        }
        let target = find()
        if (target === null && entry.loaded === false && Number.isSafeInteger(entry.seq)) {
          const sessions = clientContext?.get?.('sessions')
          const binding = sessions?.binding?.(sessionId)
          const session = binding?.session
          if (session === undefined || typeof session.loadThrough !== 'function') {
            setFailedTurn(entry.turn)
            return
          }
          setPendingTurn(entry.turn)
          setFailedTurn(null)
          try {
            const loaded = await Promise.race([
              session.loadThrough(entry.seq).then(() => true),
              new Promise(resolve => { window.setTimeout(() => { resolve(false) }, 10000) }),
            ])
            if (loaded === false) {
              if (disposedRef.current) return
              setPendingTurn(null)
              setFailedTurn(entry.turn)
              return
            }
          } catch (_loadFailed) {
            if (disposedRef.current) return
            setPendingTurn(null)
            setFailedTurn(entry.turn)
            return
          }
          const deadline = Date.now() + 1500
          while (target === null && !disposedRef.current && Date.now() < deadline) {
            await new Promise(resolve => { window.setTimeout(resolve, 40) })
            target = find()
          }
          if (disposedRef.current) return
          setPendingTurn(null)
          if (target === null) {
            setUnavailableTurns(current => {
              if (current.has(entry.turn)) return current
              const next = new Set(current)
              next.add(entry.turn)
              return next
            })
            return
          }
        }
        if (target === null) {
          setUnavailableTurns(current => {
            if (current.has(entry.turn)) return current
            const next = new Set(current)
            next.add(entry.turn)
            return next
          })
          return
        }
        if (disposedRef.current) return
        const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 16
        scroller.scrollTo({ top, behavior: 'smooth' })
        target.setAttribute('data-dsh-desktop-plus-preview-flash', '')
        window.setTimeout(() => {
          if (target.isConnected) target.removeAttribute('data-dsh-desktop-plus-preview-flash')
        }, 900)
      }, [host, sessionId])

      const collapse = React.useCallback(() => {
        setCollapsed(true)
        storePreview(PREVIEW_COLLAPSED_KEY, '1')
      }, [])

      const expand = React.useCallback(() => {
        setCollapsed(false)
        storePreview(PREVIEW_COLLAPSED_KEY, '0')
      }, [])

      const onResizeStart = React.useCallback(event => {
        if (event.button !== 0) return
        dragCleanupRef.current?.()
        const handle = event.currentTarget
        const startX = event.clientX
        const wasCollapsed = collapsedRef.current
        const startWidth = wasCollapsed ? 34 : effectiveWidthRef.current
        if (wasCollapsed) {
          collapsedRef.current = false
          setCollapsed(false)
          storePreview(PREVIEW_COLLAPSED_KEY, '0')
          widthRef.current = 34
          setWidth(34)
        }
        const previousUserSelect = document.body.style.userSelect
        document.body.style.userSelect = 'none'
        handle.dataset.dragging = 'true'
        setResizing(true)
        const move = moveEvent => {
          const next = clampPreviewWidth(startWidth + (startX - moveEvent.clientX), maxWidthRef.current)
          if (next === startWidth && widthModeRef.current === 'auto') return
          widthRef.current = next
          setWidth(next)
          if (widthModeRef.current !== 'manual') {
            widthModeRef.current = 'manual'
            setWidthMode('manual')
            storePreview(PREVIEW_WIDTH_MODE_KEY, 'manual')
          }
        }
        const teardown = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', finish)
          delete handle.dataset.dragging
          document.body.style.userSelect = previousUserSelect
        }
        const finish = () => {
          teardown()
          dragCleanupRef.current = null
          setResizing(false)
          storePreview(PREVIEW_WIDTH_KEY, widthRef.current)
        }
        dragCleanupRef.current = teardown
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', finish)
        window.addEventListener('pointercancel', finish)
      }, [])

      const onResizeKeyDown = React.useCallback(event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        if (collapsedRef.current) {
          collapsedRef.current = false
          setCollapsed(false)
          storePreview(PREVIEW_COLLAPSED_KEY, '0')
          widthRef.current = 34
          setWidth(34)
        }
        const startWidth = effectiveWidthRef.current
        const next = clampPreviewWidth(
          startWidth + (event.key === 'ArrowLeft' ? 16 : -16),
          maxWidthRef.current,
        )
        if (next === startWidth && widthModeRef.current === 'auto') return
        widthRef.current = next
        setWidth(next)
        if (widthModeRef.current !== 'manual') {
          widthModeRef.current = 'manual'
          setWidthMode('manual')
          storePreview(PREVIEW_WIDTH_MODE_KEY, 'manual')
        }
        storePreview(PREVIEW_WIDTH_KEY, next)
      }, [])

      const resetWidth = React.useCallback(() => {
        widthModeRef.current = 'auto'
        setWidthMode('auto')
        storePreview(PREVIEW_WIDTH_MODE_KEY, 'auto')
      }, [])

      const followLabel = follow ? text('previewFollow') : text('previewPaused')
      const rows = turns.map((entry, index) => h(PreviewTurnRow, {
        key: entry.turn,
        entry,
        display: index + 1,
        active: activeTurn === entry.turn,
        pending: pendingTurn === entry.turn,
        failed: failedTurn === entry.turn,
        running: running && index === turns.length - 1,
        onJump: jumpTo,
        registerRow,
      }))

      return h(
        'div',
        {
          className: 'dpt-preview',
          role: 'region',
          'aria-label': text('previewTitle'),
          'data-collapsed': collapsedNow ? 'true' : 'false',
          'data-resizing': resizing ? 'true' : undefined,
        },
        h(
          'div',
          { className: 'dpt-head' },
          h('span', { className: 'dpt-title' }, text('previewTitle')),
          turns.length === 0 ? null : h(
            'span',
            { className: 'dpt-count' },
            text(turns.length === 1 ? 'previewCountOne' : 'previewCount', { count: turns.length }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dpt-icon',
              title: text('previewCollapse'),
              'aria-label': text('previewCollapse'),
              onClick: collapse,
            },
            h(PreviewChevronLeft),
          ),
        ),
        h(
          'div',
          { className: 'dpt-list', ref: listRef, onScroll: onListScroll },
          turns.length === 0
            ? h('div', { className: 'dpt-empty' }, text('previewEmpty'))
            : h('div', { className: 'dpt-ladder' }, rows),
        ),
        h(
          'div',
          { className: 'dpt-foot', 'data-paused': follow ? 'false' : 'true' },
          h(
            'button',
            {
              type: 'button',
              className: 'dpt-follow',
              'data-follow': follow ? 'true' : 'false',
              title: followLabel,
              onClick: () => { setFollow(value => !value) },
            },
            h('span', { className: 'dpt-follow-dot' }),
            h('span', null, followLabel),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dpt-back',
              onClick: () => { setFollow(true) },
            },
            text('previewBack'),
          ),
        ),
        h(
          'div',
          { className: 'dpt-rail' },
          h(
            'button',
            {
              type: 'button',
              className: 'dpt-rail-btn',
              title: text('previewExpand'),
              'aria-label': text('previewExpand'),
              onClick: expand,
            },
            h(PreviewChevronRight),
          ),
          h(
            'div',
            { className: 'dpt-ticks', ref: ticksRef },
            turns.map((entry, index) => h('button', {
              key: entry.turn,
              type: 'button',
              className: 'dpt-tick',
              'data-active': activeTurn === entry.turn ? 'true' : 'false',
              title: text('previewJump', { turn: index + 1 }),
              'aria-label': text('previewJump', { turn: index + 1 }),
              onClick: () => { void jumpTo(entry) },
            })),
          ),
          h('span', { className: 'dpt-rail-label' }, text('previewTitle')),
        ),
        h('div', {
          className: 'dpt-resize',
          title: text('previewResize'),
          role: 'separator',
          'aria-orientation': 'vertical',
          'aria-label': text('previewResize'),
          tabIndex: 0,
          onPointerDown: onResizeStart,
          onKeyDown: onResizeKeyDown,
          onDoubleClick: resetWidth,
        }),
      )
    }

    /**
     * Session-scoped anchor that mounts the preview column into the
     * conversation content beside it.
     *
     * The header utilities seat is mounted only while the conversation shows
     * its chrome, so a blank Session grows the column with its first Turn. The
     * column itself is a portal: the seat renders nothing visible.
     */
    function ConversationPreviewAnchor(props) {
      const sessionId = props.sessionId
      const [host, setHost] = React.useState(null)

      React.useEffect(() => {
        if (typeof document === 'undefined' || sessionId === undefined) {
          setHost(null)
          return undefined
        }
        let cancelled = false
        let found = false
        let frame = 0
        let observer = null
        let missingTimer = 0
        const selector = '[data-conversation-content][data-conversation-session=' + cssString(sessionId) + ']'
        const find = () => {
          const node = document.querySelector(selector)
          if (node === null || cancelled) return false
          found = true
          reportClient({ phase: 'preview', component: 'host-found' })
          setHost(node)
          return true
        }
        if (!find()) {
          frame = requestAnimationFrame(() => {
            if (find() || cancelled) return
            observer = new MutationObserver(() => {
              if (find() && observer !== null) {
                observer.disconnect()
                observer = null
              }
            })
            observer.observe(document.body, { childList: true, subtree: true })
          })
        }
        missingTimer = window.setTimeout(() => {
          if (!cancelled && !found) reportClient({ phase: 'preview', component: 'host-missing' })
        }, 2500)
        return () => {
          cancelled = true
          if (missingTimer !== 0) window.clearTimeout(missingTimer)
          if (frame !== 0) cancelAnimationFrame(frame)
          if (observer !== null) observer.disconnect()
          setHost(null)
        }
      }, [sessionId])

      if (host === null) return null
      const dom = reactDOM()
      if (dom === null) return null
      return dom.createPortal(
        h(ConversationPreviewColumn, {
          key: sessionId,
          host,
          sessionId,
          useChat: props.useChat,
          useProjection: props.useProjection,
          useSession: props.useSession,
        }),
        host,
      )
    }

    /**
     * Contain a preview failure to the column.
     *
     * The column reads Host-owned standard props and DOM anchors; if a future
     * build changes either, the conversation must keep rendering without it.
     */
    class ConversationPreviewBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      /** @returns {object} the failed state after a render error. */
      static getDerivedStateFromError() {
        return { failed: true }
      }

      /**
       * Report the caught error once; the Host exposes it from `/dsh-desktop-plus/info`.
       * @param {unknown} error - the render or lifecycle error.
       */
      componentDidCatch(error) {
        reportClient({ phase: 'preview', component: 'failed', error: String(error?.stack ?? error) })
      }

      /** @returns {React.ReactNode} the child tree, or nothing after a failure. */
      render() {
        return this.state.failed ? null : this.props.children
      }
    }

    /**
     * The registered slot entry: the anchor inside an error boundary.
     * @param {object} props - the session-scoped standard props.
     * @returns {React.ReactElement} the boundary and anchor.
     */
    function ConversationPreviewSlot(props) {
      return h(ConversationPreviewBoundary, null, h(ConversationPreviewAnchor, props))
    }

    /**
     * Register the column's header-utility slot.
     * @param {object} ctx - the plugin context.
     * @param {object} rt - the shared runtime from the entry.
     */
    function mount(ctx, rt) {
      runtime = rt
      clientContext = rt.getContext()
      hideRules = rt.hideRules
      hideRuleListeners = rt.hideRuleListeners
      ensureCss('preview', PREVIEW_CSS)
      rt.mountSlot('conversation.session.header.utilities', () =>
        ctx.slots.register(
          { name: 'conversation.session.header.utilities', id: 'dsh-desktop-plus-preview', order: 60 },
          ConversationPreviewSlot,
        ),
      )
    }

    return { mount }
  },
})
