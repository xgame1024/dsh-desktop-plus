/**
 * Web client chunk: permanent session deletion, single and multi-select.
 *
 * Loaded by \`lib/client.js\` through \`require.async('./client.sessions.js')\`.
 * The entry passes the shared runtime (text, reportClient, requestJson,
 * getContext, mountSlot, ...) to \`mount\`; nothing here imports the entry.
 */
window.__ModuleLoader__.load({
  id: 'dsh-desktop-plus',
  chunk: 'client.sessions.js',
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

    /** Must match \`ROUTE_PREFIX\` in the entry. */
    const DELETE_ROUTE = '/dsh-desktop-plus/sessions/delete'
    /** Key naming this plugin's own \`contextMenu.icon\` contribution. */
    const MENU_ICON_KEY = 'dsh-desktop-plus.cleanup'
    /** Row highlight for a ticked session. */
    const SELECT_CSS =       '[data-row-key^="session:"]:has([data-dsh-desktop-plus="session-select"][aria-checked="true"]){background-color:var(--dsw-alias-interactive-bg-hover)!important;box-shadow:inset 0 0 0 1.5px var(--dsw-alias-brand-primary)}'

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


    /** One pending confirmation, shared by every affordance and the dialog. */
    const pendingDialog = (() => {
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
     * Ask the dialog for one session.
     * @param {{sessionId: string, displayTitle?: string}} request - the row the click belongs to.
     */
    function requestDelete(request) {
      pendingDialog.set({ sessionId: request.sessionId, displayTitle: typeof request.displayTitle === 'string' ? request.displayTitle : '' })
    }

    /** The trash glyph used by both affordances. */
    function TrashIcon() {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 14,
          height: 14,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M2.9 4.4h10.2' }),
        h('path', { d: 'M6.3 4.4V3.2c0-.47.38-.85.85-.85h1.7c.47 0 .85.38.85.85v1.2' }),
        h('path', { d: 'M4.2 4.4l.58 8.05c.04.53.48.93 1.01.93h4.42c.53 0 .97-.4 1.01-.93l.58-8.05' }),
        h('path', { d: 'M6.7 7v3.6M9.3 7v3.6' }),
      )
    }

    /**
     * The hover-strip button of one Session row.
     * @param {object} props - owner props (`sessionId`, `displayTitle`) plus the slot's hooks.
     */
    function DeleteRowAction(props) {
      const sessionId = typeof props?.sessionId === 'string' ? props.sessionId : ''
      const [hovered, setHovered] = React.useState(false)
      if (sessionId === '') return null
      const label = text('action')
      return h(
        'button',
        {
          type: 'button',
          title: label,
          'aria-label': label,
          'data-dsh-desktop-plus': 'session-delete',
          onClick(event) {
            event.preventDefault()
            event.stopPropagation()
            requestDelete(props)
          },
          onPointerDown(event) {
            event.stopPropagation()
          },
          onMouseEnter() {
            setHovered(true)
          },
          onMouseLeave() {
            setHovered(false)
          },
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            padding: 0,
            border: 'none',
            borderRadius: 5,
            background: 'transparent',
            color: hovered ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-secondary)',
            cursor: 'pointer',
            lineHeight: 0,
          },
        },
        TrashIcon(),
      )
    }

    /**
     * Dismiss the menu that hosted a menu row. The Session menu supplies
     * `useMenuOpenState` as a `[open, setOpen]` hook; anything else is ignored,
     * which only leaves the menu open behind the dialog.
     * @param {object} props - the menu row's props.
     */
    function closeMenu(props) {
      const hook = props?.useMenuOpenState
      if (typeof hook !== 'function') return
      try {
        const state = hook()
        if (Array.isArray(state)) {
          if (typeof state[1] === 'function') state[1](false)
          return
        }
        if (typeof state === 'function') {
          state(false)
          return
        }
        if (typeof state?.setOpen === 'function') state.setOpen(false)
      } catch {
        // A different hook shape is not a reason to block the action.
      }
    }

    /**
     * The same action as one Session menu row.
     * @param {object} props - owner props plus the slot's hooks.
     */
    function DeleteMenuItem(props) {
      const sessionId = typeof props?.sessionId === 'string' ? props.sessionId : ''
      const [hovered, setHovered] = React.useState(false)
      if (sessionId === '') return null
      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          'data-dsh-desktop-plus': 'session-delete-menu',
          onClick(event) {
            event.preventDefault()
            event.stopPropagation()
            closeMenu(props)
            requestDelete(props)
          },
          onMouseEnter() {
            setHovered(true)
          },
          onMouseLeave() {
            setHovered(false)
          },
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            border: 'none',
            borderRadius: 6,
            background: hovered ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
            color: hovered ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-primary)',
            font: 'inherit',
            fontSize: 13,
            textAlign: 'left',
            cursor: 'pointer',
          },
        },
        TrashIcon(),
        h('span', null, text('action')),
      )
    }

    /** One button of the confirmation dialog. */
    function DialogButton(props) {
      const [hovered, setHovered] = React.useState(false)
      const destructive = props.destructive === true
      const disabled = props.disabled === true
      const base = {
        minWidth: 84,
        height: 32,
        padding: '0 14px',
        borderRadius: 8,
        font: 'inherit',
        fontSize: 13,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 120ms ease, color 120ms ease',
      }
      const look = destructive
        ? {
            border: '1px solid transparent',
            background: 'var(--dsw-alias-state-error-primary)',
            color: 'var(--dsw-alias-bg-base)',
            // The danger Button in the Harness dims itself on hover.
            filter: hovered && !disabled ? 'brightness(1.08)' : 'none',
          }
        : {
            border: '1px solid var(--dsw-alias-border-l2)',
            background: hovered && !disabled ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
            color: 'var(--dsw-alias-label-primary)',
          }
      return h(
        'button',
        {
          type: 'button',
          disabled,
          autoFocus: props.autoFocus === true,
          onClick: disabled ? undefined : props.onClick,
          onMouseEnter() {
            setHovered(true)
          },
          onMouseLeave() {
            setHovered(false)
          },
          style: { ...base, ...look },
        },
        props.children,
      )
    }

    /**
     * Turn one Host failure or refusal into localized text.
     * @param {unknown} value - the parsed response body, or a plan with a `blockedReason`.
     * @param {number} [status] - HTTP status.
     * @returns {string} the message.
     */
    function messageFor(value, status) {
      const code = typeof value?.code === 'string' ? value.code : typeof value?.blockedReason === 'string' ? value.blockedReason : ''
      switch (code) {
        case 'session-live':
          return text('live')
        case 'session-active':
          return text('active')
        case 'session-unknown':
          return text('unknown')
        case 'session-log-unresolved':
          return text('unresolved')
        case 'session-id-invalid':
          return text('invalid')
        default:
          if (typeof value?.message === 'string' && value.message !== '') return `${text('failed')}: ${value.message}`
          return status === undefined ? text('failed') : `${text('failed')} (HTTP ${status})`
      }
    }

    /**
     * Render one byte count in the reader's units.
     * @param {number} bytes - stored size.
     * @returns {string} the formatted size.
     */
    function formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) return ''
      if (bytes < 1024) return text('bytes', { size: bytes })
      if (bytes < 1024 * 1024) return text('kb', { size: (bytes / 1024).toFixed(1) })
      return text('mb', { size: (bytes / (1024 * 1024)).toFixed(1) })
    }

    /**
     * The frame-wide confirmation dialog. It renders nothing while no row asked
     * for a deletion, so it costs one subscription per page.
     */
    function DeleteDialog() {
      const [pending, setPending] = React.useState(pendingDialog.get())
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      // The click handler and the button's own re-render race each other, so the
      // guard reads a ref: two clicks in one frame must not send two deletes.
      const busyRef = React.useRef(false)

      React.useEffect(
        () =>
          pendingDialog.subscribe(() => {
            setPending(pendingDialog.get())
            setError('')
            setBusy(false)
            busyRef.current = false
          }),
        [],
      )

      React.useEffect(() => {
        if (pending === null) return undefined
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          pendingDialog.set(null)
        }
        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
      }, [pending])

      if (pending === null) return null

      const title = pending.displayTitle === '' ? '' : pending.displayTitle
      const description = title === '' ? text('bodyUntitledNoSize') : text('bodyNoSize', { title })

      const confirm = async () => {
        if (busyRef.current) return
        busyRef.current = true
        setBusy(true)
        setError('')
        try {
          const response = await fetch(DELETE_ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-dsh-desktop-plus': '1' },
            body: JSON.stringify({ sessionId: pending.sessionId }),
          })
          const value = await response.json().catch(() => null)
          if (response.ok === true && value?.ok === true) {
            pendingDialog.set(null)
            return
          }
          setError(messageFor(value, response.status))
        } catch (failure) {
          setError(messageFor({ message: String(failure?.message ?? failure) }))
        } finally {
          busyRef.current = false
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
            // `shell.overlay` is a click-through layer: an occupant opts back in.
            pointerEvents: 'auto',
          },
          onMouseDown(event) {
            if (event.target === event.currentTarget) pendingDialog.set(null)
          },
        },
        h(
          'div',
          {
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': text('title'),
            'data-dsh-desktop-plus': 'session-delete-dialog',
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
          h('div', { style: { fontSize: 15, fontWeight: 600 } }, text('title')),
          h('div', { style: { color: 'var(--dsw-alias-label-secondary)' } }, description),
          error === '' ? null : h('div', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, error),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 } },
            h(DialogButton, { onClick: () => pendingDialog.set(null), disabled: busy, autoFocus: true }, text('cancel')),
            h(DialogButton, { destructive: true, disabled: busy, onClick: confirm }, busy ? text('deleting') : text('confirm')),
          ),
        ),
      )
    }

    /* ───────────────── feature 1b: multi-select session deletion ───────────────── */

    /**
     * The ticks the multi-select bar works from, or null while the sidebar is not
     * in selection mode.
     *
     * It holds only what the browser itself knows: the Workspace the user started
     * from, the Session ids that Workspace accounted for at that moment, and the
     * ids ticked since. Whatever the Host decides about them is answered when the
     * batch is confirmed, so nothing here can go stale on its own.
     */
    const selection = (() => {
      let state = null
      const listeners = new Set()
      /**
       * Ids whose row currently renders the mode's checkbox. The Host mounts
       * that seat only on an idle, unarchived row, so this set is the only
       * honest answer to "may this row be ticked" — no activity data needed.
       */
      const tickable = new Set()
      /**
       * Copy one state so every listener sees a new object identity. The mode
       * always starts with nothing ticked.
       * @param {{workspaceId: string, workspaceTitle?: string, members: readonly string[]}} next - raw state.
       * @returns {object} the stored state.
       */
      const shape = (next) => ({
        workspaceId: next.workspaceId,
        workspaceTitle: typeof next.workspaceTitle === 'string' ? next.workspaceTitle : '',
        members: [...next.members],
        selected: new Set(),
      })
      const publish = () => {
        for (const listener of [...listeners]) listener()
      }
      return {
        get: () => state,
        /**
         * Enter selection mode for one Workspace.
         * @param {{workspaceId: string, workspaceTitle?: string, members: readonly string[]}} next - the Workspace and the Sessions it accounts for.
         */
        start(next) {
          state = shape(next)
          publish()
        },
        /** Leave selection mode and drop every tick. */
        stop() {
          if (state === null) return
          state = null
          tickable.clear()
          publish()
        },
        /**
         * Tick or untick one Session the Workspace accounts for.
         * @param {string} sessionId - the row's Session.
         */
        toggle(sessionId) {
          if (state === null || !state.members.includes(sessionId)) return
          const selected = new Set(state.selected)
          if (selected.has(sessionId)) selected.delete(sessionId)
          else selected.add(sessionId)
          state = { ...state, selected }
          publish()
        },
        /**
         * Replace the ticks, dropping ids this Workspace does not account for.
         * @param {readonly string[]} ids - the wanted ticks.
         */
        setSelected(ids) {
          if (state === null) return
          const { members } = state
          state = { ...state, selected: new Set(ids.filter((id) => members.includes(id))) }
          publish()
        },

        /**
         * Record that one row can be ticked, because its box mounted.
         * @param {string} sessionId - the row's Session.
         */
        register(sessionId) {
          if (state === null || !state.members.includes(sessionId)) return
          const size = tickable.size
          tickable.add(sessionId)
          if (tickable.size !== size) publish()
        },

        /**
         * Forget one row: its box unmounted (the row went busy, archived,
         * collapsed, or was deleted). The tick goes with it: a tick the user
         * can no longer see is a tick they cannot undo, and the Host would be
         * asked to delete a row that is not on screen.
         * @param {string} sessionId - the row's Session.
         */
        unregister(sessionId) {
          const dropped = tickable.delete(sessionId)
          const wasTicked = state !== null && state.selected.has(sessionId)
          if (wasTicked) {
            const selected = new Set(state.selected)
            selected.delete(sessionId)
            state = { ...state, selected }
          }
          if (dropped || wasTicked) publish()
        },

        /**
         * Whether one row may be ticked right now.
         * @param {string} sessionId - the row's Session.
         * @returns {boolean} true while its box is mounted.
         */
        /** @returns {string[]} the ids whose box is mounted. */
        tickableIds() {
          return [...tickable]
        },

        /**
         * The ticks that are still visible, and therefore the only ones a
         * batch may act on. A Session whose row went busy, got archived or was
         * collapsed loses its tick together with its box (`unregister`); this
         * filter is the second gate for the same rule, so no batch can act on a
         * row the user can no longer see.
         * @returns {string[]} the ticked ids whose box is mounted.
         */
        tickedIds() {
          if (state === null) return []
          return [...state.selected].filter((id) => tickable.has(id))
        },
        /**
         * Subscribe to changes.
         * @param {() => void} listener - notified after every change.
         * @returns {() => void} the unsubscribe.
         */
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    })()

    /** The batch the confirmation dialog is working on, or null while it is closed. */
    const batchRequest = (() => {
      let pending = null
      const listeners = new Set()
      return {
        get: () => pending,
        /**
         * Open the dialog for one batch, or close it with null.
         * @param {{sessionIds: readonly string[]} | null} next - the batch.
         */
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
     * The client context, kept so an affordance can read the services it needs
     * instead of every component taking them as props. Both readers below
     * degrade to empty values: a deployment that exposes neither `workspaces`
     * nor `sessions` still gets the box and the bar, only without sibling rows
     * and titles.
     */
    let clientContext = null

    /**
     * The Workspace rows the sidebar's own service reports.
     * @returns {object[]} the rows, empty when the service is absent.
     */
    function workspaceRows() {
      try {
        const items = clientContext?.get?.('workspaces')?.list?.getSnapshot?.()?.items
        return Array.isArray(items) ? items : []
      } catch {
        return []
      }
    }

    /**
     * One Session's display title, falling back to its id.
     * @param {string} sessionId - the Session.
     * @returns {string} the title.
     */
    function sessionTitleOf(sessionId) {
      try {
        const title = clientContext?.get?.('sessions')?.list?.getSnapshot?.()?.byId?.[sessionId]?.displayTitle
        return typeof title === 'string' && title !== '' ? title : sessionId
      } catch {
        return sessionId
      }
    }

    /**
     * While selection mode is on, a click anywhere on a selectable Session row
     * ticks it instead of opening it.
     *
     * The row's own handler runs from the app root, which sits below `document`:
     * a capture-phase listener here runs first and can stop the click before the
     * Session opens. Clicks on any button inside the row (its menu trigger, its
     * other hover actions) are left alone, so the row's own affordances keep
     * working.
     * @param {MouseEvent} event - the click.
     */
    function onRowClickCapture(event) {
      const state = selection.get()
      if (state === null) return
      const target = event.target
      if (typeof target?.closest !== 'function') return
      const key = target.closest('[data-row-key]')?.getAttribute?.('data-row-key') ?? ''
      const prefix = 'session:'
      if (!key.startsWith(prefix)) return
      const sessionId = key.slice(prefix.length)
      if (!state.members.includes(sessionId)) return
      if (target.closest('button') !== null) return
      event.preventDefault()
      event.stopPropagation()
      // Only a row that shows a box may be ticked. A busy or archived row
      // swallows the click here instead of opening the Session mid-selection,
      // which is the whole point of a mode.
      if (!selection.tickableIds().includes(sessionId)) return
      selection.toggle(sessionId)
    }

    /** The tick drawn inside a ticked box. */
    function TickIcon() {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 9,
          height: 9,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M3.2 8.7l3.2 3.2 6.4-6.6' }),
      )
    }

    /**
     * The checklist glyph of the cleanup mode, shown beside its menu row.
     *
     * The Harness draws a menu icon by rendering the keyed `contextMenu.icon`
     * slot the item names, so this component is registered under a key of our
     * own instead of importing the client UI package's icon set.
     */
    function ListIcon() {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 14,
          height: 14,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M2.4 4.4l1 1 1.8-2' }),
        h('path', { d: 'M2.4 9.8l1 1 1.8-2' }),
        h('path', { d: 'M7.4 4.8h6.2M7.4 10.2h6.2' }),
      )
    }

    /**
     * The tick box in one Session row's leading cell, while selection mode is on.
     *
     * That cell exists only while the row is idle and unarchived, so a busy or
     * archived row shows no box. Without a box it is not selectable either: the
     * bar leaves it out of the count, and a click on the row neither ticks it
     * nor opens the Session (see `onRowClickCapture`).
     * @param {object} props - `sessionId` plus the slot's standard props.
     */
    function SelectionCheckbox(props) {
      const sessionId = typeof props?.sessionId === 'string' ? props.sessionId : ''
      const [state, setState] = React.useState(selection.get())
      React.useEffect(() => selection.subscribe(() => setState(selection.get())), [])
      // The mode's identity, not just the row's: leaving and re-entering the
      // mode re-registers this box even though its own Session never changed.
      const modeKey = state === null ? '' : state.workspaceId
      // Registered while the box is mounted, which is exactly the window in
      // which the Host lets this seat render: mounted means tickable.
      React.useEffect(
        () => {
          selection.register(sessionId)
          return () => selection.unregister(sessionId)
        },
        [sessionId, modeKey],
      )
      if (sessionId === '' || state === null || !state.members.includes(sessionId)) return null
      const checked = state.selected.has(sessionId)
      const label = checked ? text('multiUncheck') : text('multiCheck')
      return h(
        'button',
        {
          type: 'button',
          role: 'checkbox',
          'aria-checked': checked,
          title: label,
          'aria-label': label,
          'data-dsh-desktop-plus': 'session-select',
          onClick(event) {
            event.preventDefault()
            event.stopPropagation()
            selection.toggle(sessionId)
          },
          onPointerDown(event) {
            event.stopPropagation()
          },
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 14,
            height: 14,
            padding: 0,
            borderRadius: 3,
            border: checked ? '1px solid var(--dsw-alias-brand-primary)' : '1.5px solid var(--dsw-alias-border-l2)',
            background: checked ? 'var(--dsw-alias-brand-primary)' : 'transparent',
            color: 'var(--dsw-alias-bg-base)',
            cursor: 'pointer',
            lineHeight: 0,
          },
        },
        checked ? TickIcon() : null,
      )
    }

    /**
     * Enter cleanup mode for one Workspace, from that Workspace's own menu.
     *
     * The menu hands over the row it was opened on; the members come from the
     * Workspaces store. No row is pre-ticked: the user asked to look at the
     * whole Workspace.
     * @param {{workspaceId?: string, displayTitle?: string}} target - the menu target.
     */
    function startWorkspaceCleanup(target) {
      const workspaceId = typeof target?.workspaceId === 'string' ? target.workspaceId : ''
      if (workspaceId === '') return
      const workspace = workspaceRows().find((row) => String(row?.workspaceId ?? '') === workspaceId)
      const title = typeof target?.displayTitle === 'string' && target.displayTitle !== ''
        ? target.displayTitle
        : (typeof workspace?.title === 'string' ? workspace.title : '')
      selection.start({
        workspaceId,
        workspaceTitle: title,
        members: Array.isArray(workspace?.sessionIds) ? [...workspace.sessionIds] : [],
      })
    }

    /**
     * Where the mode bar belongs, given the Workspace row it stands in for and
     * the list around it. Arithmetic on two measured boxes, so the placement
     * rules stay readable — and testable — without a browser.
     * @param {{left:number,top:number,width:number,height:number}|null} row - the Workspace row.
     * @param {{left:number,top:number,width:number,height:number}|null} list - the list area.
     * @returns {{visible:boolean,left:number,top:number,width:number,height:number}} the box to draw.
     */
    function cleanupBarRect(row, list) {
      const hidden = { visible: false, left: 0, top: 0, width: 0, height: 0 }
      if (row === null || row === undefined) return hidden
      // A collapsed sidebar turns the row into a rail icon: no room for a bar,
      // and the mode stays reachable through Escape and the row menu.
      if (row.width < 120) return hidden
      // No viewport to clip against: the row's own box is all there is. The
      // overlay is frame-wide, so a missing marker must not hide the mode.
      if (list === null || list === undefined) {
        return { visible: true, left: row.left, top: row.top, width: row.width, height: row.height }
      }
      // A fixed-position bar is not clipped by the scroller, so a half-scrolled
      // row would paint over the header: clip it to the list viewport instead.
      const top = Math.max(row.top, list.top)
      const bottom = Math.min(row.top + row.height, list.top + list.height)
      if (bottom - top < 4) return hidden
      return {
        visible: true,
        left: Math.max(row.left, list.left),
        top,
        width: Math.min(row.width, list.width),
        height: bottom - top,
      }
    }

    /**
     * Whether two boxes are close enough that nothing has to be re-rendered.
     * @param {object|null} a - previous box.
     * @param {object|null} b - next box.
     * @returns {boolean} true when the bar would look the same.
     */
    function sameCleanupBox(a, b) {
      if (a === null || a === undefined || b === null || b === undefined) return a === b
      return a.visible === b.visible &&
        Math.abs(a.left - b.left) < 0.5 &&
        Math.abs(a.top - b.top) < 0.5 &&
        Math.abs(a.width - b.width) < 0.5 &&
        Math.abs(a.height - b.height) < 0.5
    }

    /**
     * The mode itself. It stands in for the Workspace row, so the scope, the
     * ticks and the way out all live where the scope does: an all-box, the
     * name, one destructive icon that stays disabled until something is
     * ticked, and the way out.
     *
     * It sits in `shell.overlay` above the sidebar but below every dialog, so
     * it never covers the confirmation it opens.
     */
    function CleanupBar() {
      const [state, setState] = React.useState(selection.get())
      const [box, setBox] = React.useState(null)
      const workspaceId = state === null ? '' : state.workspaceId
      React.useEffect(() => selection.subscribe(() => setState(selection.get())), [])

      React.useEffect(() => {
        if (state === null) return undefined
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          // The confirmation dialog owns Escape while it is open: it registers
          // its own capture listener on the same node, and `stopPropagation()`
          // cannot keep that listener from running.
          if (batchRequest.get() !== null) return
          if (pendingDialog.get() !== null) return
          if (pendingRewind.get() !== null) return
          event.stopPropagation()
          selection.stop()
        }
        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
      }, [state === null])

      // The bar is a frame overlay, so it has to follow the row it covers
      // across scrolling, resizing, a collapsed sidebar and list re-renders.
      React.useEffect(() => {
        if (state === null || typeof document === 'undefined') return undefined
        // The mode only ever starts from a Workspace row, so that row is the anchor.
        const anchorSelector = '[data-row-key=' + cssString('workspace:' + workspaceId) + ']'
        let frame = 0
        let schedule = () => {}
        let watchedRow = null
        let watchedView = null
        const readBox = (node) => {
          const measured = node?.getBoundingClientRect?.()
          if (measured === undefined || measured === null) return null
          return { left: measured.left, top: measured.top, width: measured.width, height: measured.height }
        }
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null
        const mutations = typeof MutationObserver === 'function' ? new MutationObserver(() => schedule()) : null
        const measure = () => {
          frame = 0
          const rowNode = document.querySelector(anchorSelector)
          const viewNode = rowNode?.closest?.('[data-sidebar-scrollport]') ??
            document.querySelector('[data-sidebar-list-area]')
          if (rowNode !== watchedRow || viewNode !== watchedView) {
            observer?.disconnect()
            if (rowNode !== null) observer?.observe(rowNode)
            if (viewNode !== null && viewNode !== undefined) observer?.observe(viewNode)
            watchedRow = rowNode
            watchedView = viewNode ?? null
          }
          const next = cleanupBarRect(readBox(rowNode), readBox(viewNode))
          setBox((previous) => (sameCleanupBox(previous, next) ? previous : next))
        }
        schedule = () => {
          if (frame !== 0) return
          if (typeof requestAnimationFrame !== 'function') {
            measure()
            return
          }
          frame = requestAnimationFrame(measure)
        }
        measure()
        mutations?.observe(document.body ?? document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-expanded', 'data-row-key'],
        })
        document.addEventListener('scroll', schedule, { capture: true, passive: true })
        window.addEventListener('resize', schedule)
        return () => {
          if (frame !== 0 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
          document.removeEventListener('scroll', schedule, true)
          window.removeEventListener('resize', schedule)
          observer?.disconnect()
          mutations?.disconnect()
        }
      }, [state === null, workspaceId])


      if (state === null || box === null || box.visible !== true) return null
      const tickedIds = selection.tickedIds()
      const count = tickedIds.length
      const tickableIds = selection.tickableIds()
      const everyTicked = tickableIds.length > 0 && tickableIds.every((id) => state.selected.has(id))
      const someTicked = !everyTicked && tickableIds.some((id) => state.selected.has(id))
      const checkAll = () => {
        const wanted = everyTicked
          ? [...state.selected].filter((id) => !tickableIds.includes(id))
          : [...new Set([...state.selected, ...tickableIds])]
        selection.setSelected(wanted)
      }
      const boxStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 14,
        height: 14,
        padding: 0,
        borderRadius: 3,
        cursor: 'pointer',
        lineHeight: 0,
        border: everyTicked || someTicked ? '1px solid var(--dsw-alias-brand-primary)' : '1.5px solid var(--dsw-alias-border-l2)',
        background: everyTicked ? 'var(--dsw-alias-brand-primary)' : 'transparent',
        color: everyTicked ? 'var(--dsw-alias-bg-base)' : 'var(--dsw-alias-brand-primary)',
      }
      return h(
        'div',
        {
          'data-dsh-desktop-plus': 'selection-bar',
          role: 'region',
          'aria-label': text('multiBar', { count }),
          style: {
            position: 'fixed',
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            boxSizing: 'border-box',
            zIndex: 3900,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 6px 0 8px',
            borderRadius: 7,
            background: 'var(--dsw-alias-bg-layer-2)',
            boxShadow: 'inset 2px 0 0 var(--dsw-alias-brand-primary), inset 0 0 0 1px var(--dsw-alias-border-l2)',
            color: 'var(--dsw-alias-label-primary)',
            fontSize: 12.5,
            pointerEvents: 'auto',
          },
        },
        h(
          'button',
          {
            type: 'button',
            role: 'checkbox',
            'aria-checked': everyTicked ? 'true' : someTicked ? 'mixed' : 'false',
            'aria-label': text('multiSelectAll'),
            title: text('multiSelectAll'),
            'data-dsh-desktop-plus': 'selection-all',
            onClick: checkAll,
            style: boxStyle,
          },
          everyTicked
            ? TickIcon()
            : someTicked
              ? h('span', { style: { width: 7, height: 1.5, borderRadius: 1, background: 'currentColor', display: 'block' } })
              : null,
        ),
        h(
          'span',
          {
            title: state.workspaceTitle,
            style: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 },
          },
          state.workspaceTitle,
        ),
        h(
          'button',
          {
            type: 'button',
            'data-dsh-desktop-plus': 'selection-delete',
            'aria-label': text('multiDelete'),
            title: count === 0 ? text('multiDelete') : text('multiConfirm', { count }),
            disabled: count === 0,
            onClick: () => batchRequest.set({ sessionIds: tickedIds }),
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              padding: 0,
              border: 'none',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--dsw-alias-state-error-primary)',
              cursor: count === 0 ? 'default' : 'pointer',
              opacity: count === 0 ? 0.35 : 1,
            },
          },
          TrashIcon(),
        ),
        h(
          'button',
          {
            type: 'button',
            'aria-label': text('multiExit'),
            title: text('multiExit'),
            onClick: () => selection.stop(),
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              padding: 0,
              border: 'none',
              borderRadius: 5,
              background: 'transparent',
              color: 'var(--dsw-alias-label-tertiary)',
              cursor: 'pointer',
              fontSize: 12,
              lineHeight: 1,
            },
          },
          '✕',
        ),
      )
    }

    /**
     * The batch confirmation.
     *
     * It lists the Sessions the user ticked and, once the delete has run,
     * reports each outcome. It decides no policy of its own: `canDelete` and
     * `blockedReason` on a result row are the Host's.
     */
    function BatchDeleteDialog() {
      const [request, setRequest] = React.useState(batchRequest.get())
      const [busy, setBusy] = React.useState(false)
      // `busy` as the handlers can read it: the Escape and backdrop handlers are
      // captured once per request, so a state read inside them would be stale.
      const busyRef = React.useRef(false)
      const [error, setError] = React.useState('')
      const [outcome, setOutcome] = React.useState(null)
      // Titles frozen when the batch opened: a deleted Session leaves the
      // sidebar's list, so reading it back after the delete would show its id.
      const [titles, setTitles] = React.useState(() => new Map())
      React.useEffect(
        () =>
          batchRequest.subscribe(() => {
            setRequest(batchRequest.get())
            setOutcome(null)
            const opened = batchRequest.get()
            setTitles(new Map((opened?.sessionIds ?? []).map((sessionId) => [sessionId, sessionTitleOf(sessionId)])))
            setError('')
            setBusy(false)
            busyRef.current = false
          }),
        [],
      )
      React.useEffect(() => {
        if (request === null) return undefined
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          if (busyRef.current) return
          event.stopPropagation()
          batchRequest.set(null)
        }
        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
      }, [request])
      if (request === null) return null

      // Exactly what the dialog is about: the ids it was opened with.
      const sessionIds = Array.isArray(request.sessionIds) ? request.sessionIds : []
      const count = sessionIds.length
      const description = text('multiBodyNoSize', { count })

      /**
       * One line of the batch list: the title, plus the outcome it got once
       * the delete has run.
       * @param {object} item - a bare `{sessionId}` row, or a result row.
       * @returns {object} the element.
       */
      const listRow = (item) => {
        const sessionId = typeof item?.sessionId === 'string' ? item.sessionId : ''
        let note = ''
        let tone = 'var(--dsw-alias-state-warn-primary)'
        if (item?.deleted === true) {
          note = text('multiDeleted')
          tone = 'var(--dsw-alias-label-tertiary)'
        } else if (item?.failed === true) {
          note = text('multiFailed') + ' · ' + messageFor(item)
          tone = 'var(--dsw-alias-state-error-primary)'
        } else if (item?.skipped === true) {
          note = text('multiSkipped') + ' · ' + messageFor(item)
        } else if (item?.canDelete === false) {
          note = messageFor(item)
        }
        return h(
          'div',
          {
            key: sessionId,
            'data-dsh-desktop-plus': 'batch-row',
            style: { display: 'flex', alignItems: 'baseline', gap: 8 },
          },
          h(
            'span',
            { style: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
            titles.get(sessionId) ?? sessionId,
          ),
          note === '' ? null : h('span', { style: { flex: 'none', color: tone, fontSize: 12 } }, note),
        )
      }

      const confirm = async () => {
        if (busyRef.current) return
        busyRef.current = true
        setBusy(true)
        setError('')
        try {
          const result = await requestJson(DELETE_ROUTE, { sessionIds })
          if (result.ok === true) {
            setOutcome(result.value ?? null)
            // Only the rows that really left the disk drop their tick: a row
            // the Host refused or could not remove is still wanted, and the
            // report offers it back for a retry.
            const removed = new Set(
              (Array.isArray(result.value?.results) ? result.value.results : [])
                .filter((row) => row?.deleted === true)
                .map((row) => row.sessionId),
            )
            const left = [...(selection.get()?.selected ?? [])].filter((id) => !removed.has(id))
            if (left.length === 0) selection.stop()
            else selection.setSelected(left)
            return
          }
          setError(messageFor(result.value, result.status))
        } catch (failure) {
          setError(messageFor({ message: String(failure?.message ?? failure) }))
        } finally {
          setBusy(false)
          busyRef.current = false
        }
      }

      const results = outcome === null ? null : new Map((outcome.results ?? []).map((row) => [row.sessionId, row]))
      const rows = sessionIds.map((sessionId) => results?.get(sessionId) ?? { sessionId }).map(listRow)
      const skipped = outcome === null ? 0 : (outcome.skipped ?? 0)

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
            if (busyRef.current) return
            if (event.target === event.currentTarget) batchRequest.set(null)
          },
        },
        h(
          'div',
          {
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': text('multiTitle', { count }),
            'data-dsh-desktop-plus': 'batch-dialog',
            style: {
              width: 'min(520px, 100%)',
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
          h('div', { style: { fontSize: 15, fontWeight: 600 } }, text('multiTitle', { count })),
          h('div', { style: { color: 'var(--dsw-alias-label-secondary)' } }, description),
          error === '' ? null : h('div', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary)' } }, error),
          rows.length === 0
            ? null
            : h(
                'div',
                {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    maxHeight: 260,
                    overflowY: 'auto',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--dsw-alias-bg-layer-2)',
                  },
                },
                rows,
              ),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 } },
            outcome === null
              ? null
              : h(
                  'span',
                  { style: { marginRight: 'auto', color: 'var(--dsw-alias-label-secondary)' } },
                  text('multiOutcome', { deleted: outcome.deleted ?? 0, skipped, failed: outcome.failed ?? 0 }),
                ),
            selection.tickedIds().length === 0 || outcome === null
              ? null
              : h(
                  DialogButton,
                  {
                    destructive: true,
                    disabled: busy,
                    onClick: () => batchRequest.set({ sessionIds: selection.tickedIds() }),
                  },
                  text('multiRetry', { count: selection.tickedIds().length }),
                ),
            outcome === null
              ? h(DialogButton, { onClick: () => batchRequest.set(null), disabled: busy, autoFocus: true }, text('cancel'))
              : h(
                  DialogButton,
                  {
                    onClick: () => {
                      batchRequest.set(null)
                      if (selection.tickedIds().length === 0) selection.stop()
                    },
                    autoFocus: true,
                  },
                  text('multiDone'),
                ),
            outcome === null
              ? h(
                  DialogButton,
                  { destructive: true, disabled: busy || count === 0, onClick: confirm },
                  busy ? text('deleting') : text('multiConfirm', { count }),
                )
              : null,
          ),
        ),
      )
    }

    /**
     * Register this chunk's slots and effects.
     * @param {object} ctx - the plugin context.
     * @param {object} rt - the shared runtime from the entry.
     */
    function mount(ctx, rt) {
      runtime = rt
      clientContext = rt.getContext()
      ensureCss('sessions', SELECT_CSS)
      const mountSlot = (slot, factory) => rt.mountSlot(slot, factory)
      mountSlot('sidebar.workspaces.session.row.action', () =>
        ctx.slots.register({ name: 'sidebar.workspaces.session.row.action', id: 'dsh-desktop-plus-delete', order: 300 }, DeleteRowAction),
      )
      mountSlot('sidebar.workspaces.session.menu.item', () =>
        ctx.slots.register({ name: 'sidebar.workspaces.session.menu.item', id: 'dsh-desktop-plus-delete', order: 0 }, DeleteMenuItem),
      )
      mountSlot('shell.overlay', () =>
        ctx.slots.register({ name: 'shell.overlay', id: 'dsh-desktop-plus-delete-dialog', order: 1000 }, DeleteDialog),
      )
      mountSlot('sidebar.session.row.leading', () =>
        ctx.slots.register({ name: 'sidebar.session.row.leading', id: 'dsh-desktop-plus-select', order: 0 }, SelectionCheckbox),
      )
      mountSlot('shell.overlay', () =>
        ctx.slots.register({ name: 'shell.overlay', id: 'dsh-desktop-plus-selection-bar', order: 999 }, CleanupBar),
      )
      mountSlot('shell.overlay', () =>
        ctx.slots.register({ name: 'shell.overlay', id: 'dsh-desktop-plus-batch-dialog', order: 1002 }, BatchDeleteDialog),
      )

      // A click on a selectable row ticks it instead of opening it. Capture on
      // \`document\` runs before the app root's own handler.
      ctx.effect(
        () => {
          if (typeof document === 'undefined') return () => {}
          document.addEventListener('click', onRowClickCapture, true)
          return () => document.removeEventListener('click', onRowClickCapture, true)
        },
        'dsh-desktop-plus: selection row clicks',
      )

      // The Workspace row's own menu is where the mode starts from: the
      // cleanup's scope is a Workspace, so its entry belongs to that row.
      ctx.inject(['contextMenus'], (scoped) => {
        const menus = scoped.get('contextMenus')
        if (menus === undefined || typeof menus?.register !== 'function') {
          reportClient({ phase: 'menu', component: 'workspace-unavailable' })
          return
        }
        try {
          scoped.slots.inject('contextMenu.icon', () =>
            scoped.slots.register({ name: 'contextMenu.icon', key: MENU_ICON_KEY }, ListIcon),
          )
          reportClient({ phase: 'menu', component: 'icon-registered' })
        } catch (error) {
          reportClient({ phase: 'menu', component: 'icon-failed', error: String(error?.message ?? error) })
        }
        try {
          scoped.effect(
            () =>
              menus.register({
                id: 'dsh-desktop-plus.workspace.cleanup',
                target: 'workspace',
                order: 250,
                resolve: (target) =>
                  typeof target?.workspaceId === 'string' && target.workspaceId !== ''
                    ? [{
                      id: 'cleanup',
                      label: text('multiAction'),
                      icon: { key: MENU_ICON_KEY },
                      run: () => startWorkspaceCleanup(target),
                    }]
                    : [],
              }),
            'dsh-desktop-plus: workspace cleanup menu',
          )
          reportClient({ phase: 'menu', component: 'workspace-registered' })
        } catch (error) {
          reportClient({ phase: 'menu', component: 'workspace-failed', error: String(error?.message ?? error) })
        }
      })
    }

    return { mount }
  },
})
