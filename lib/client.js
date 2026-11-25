/**
 * Web client entry for the dsh-desktop-plus bundle.
 *
 * The browser half is split into lazy package-local chunks:
 * - \`client.sessions.js\` — session deletion, single and multi-select
 * - \`client.rewind.js\` — per-message retraction and inline editing
 * - \`client.preview.js\` — the conversation preview column
 *
 * This entry keeps the shared runtime (dictionary, late-bound translator,
 * diagnostics, hide rules, request helper, mount helper) and mounts each
 * chunk's slots after \`require.async\` resolves.
 */
/**
 * Web client half of `dsh-desktop-plus`.
 *
 * Workspace session deletion. It contributes two affordances and
 * one frame-wide dialog:
 *
 * - `sidebar.workspaces.session.row.action` — the trash button in a Session
 *   row's hover strip, after the shipped archive (100) and pin (200) entries.
 * - `sidebar.workspaces.session.menu.item` — the same action as a menu row, for
 *   the menu the row's "…" trigger opens.
 * - `shell.overlay` — the confirmation dialog, in the frame-wide floating layer
 *   next to the shipped archive/rename dialogs, so it is never clipped by a
 *   column's scroll container.
 *
 * Per-message conversation retraction. Each user message grows two icon buttons
 * (retract, edit again) and each finalized assistant message grows one
 * (retract). They live in the message's shipped action row, next to the copy
 * button, so a retraction control is found exactly where every other message
 * action is; a user row's controls are mounted into that row because no slot
 * reaches inside it. The Host half appends one surface replacement that removes
 * the clicked message and everything after it from the model-visible context;
 * this half hides the matching transcript rows through rules rebuilt from the
 * log. Every retraction confirms itself first, and a retracted user prompt —
 * like a prompt being re-edited — goes back into the composer through the
 * slot's `inputActions`.
 *
 * The Host half owns every operation. This module asks the Host for a plan
 * before it mutates anything, so a session that cannot be changed explains
 * itself instead of failing after the click.
 */

window.__ModuleLoader__.load({
    // The module-graph row of a bundle is its package name, so the registration id
    // must stay the full package name. The loader row id, routes and locale
    // namespace use the same `dsh-desktop-plus` name.
  id: 'dsh-desktop-plus',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /**
     * `react-dom`, used to mount one entry's controls inside the shipped message
     * action row (no slot reaches inside that row). Resolution is lazy and retried
     * until it succeeds, because a module graph that does not expose it still gets
     * the controls, rendered in the entry's own row.
     * @type {{createPortal: Function} | null}
     */
    let reactDomModule
    function reactDOM() {
      if (reactDomModule !== undefined) return reactDomModule
      try {
        const dom = require('react-dom')
        if (typeof dom?.createPortal === 'function') {
          reactDomModule = dom
          return dom
        }
      } catch {
        // Fall through: the caller renders its own row instead.
      }
      return null
    }

    /** Must match `ROUTE_PREFIX` in the bundle's Host half. */
    const ROUTE_PREFIX = '/dsh-desktop-plus'
    const DELETE_ROUTE = ROUTE_PREFIX + '/sessions/delete'

    /** Key naming this plugin's own `contextMenu.icon` contribution. */
    const MENU_ICON_KEY = 'dsh-desktop-plus.cleanup'

    /** Locale namespace this plugin owns. */
    const NS = 'dsh-desktop-plus'

    const DICT = {
      en: {
        action: 'Delete session',
        title: 'Delete this session permanently?',
        body: '“{title}” and its entire event log ({size}) are removed from this computer. This cannot be undone.',
        bodyUntitled: 'This session and its entire event log ({size}) are removed from this computer. This cannot be undone.',
        bodyNoSize: '“{title}” and its entire event log are removed from this computer. This cannot be undone.',
        bodyUntitledNoSize: 'This session and its entire event log are removed from this computer. This cannot be undone.',
        confirm: 'Delete permanently',
        cancel: 'Cancel',
        deleting: 'Deleting…',
        checking: 'Checking the session…',
        failed: 'Could not delete the session',
        live: 'Strict mode is on: the Host still holds an agent for this session, and refusing it is what `allowLiveSessionDelete: false` asks for. Restart the app, then delete it.',
        active: 'This session is still running work (a turn, a job, a subagent or a terminal). Stop it first, then delete it.',
        unknown: 'This session no longer exists.',
        unresolved: 'The stored log of this session cannot be located, so nothing was deleted.',
        invalid: 'The Host refused this session id.',
        bytes: '{size} B',
        kb: '{size} KB',
        mb: '{size} MB',
        retract: 'Retract',
        editAction: 'Edit again',
        editCancelHint: 'Cancel (Esc)',
        editSendHint: 'Replace and send (Enter)',
        editImagesUnavailable: 'This message carries {count} image(s) this build cannot put back; replacing it sends the text only.',
        retractConfirmTitle: 'Retract this message?',
        retractConfirmBody: 'This message and the {count} later conversation item(s) leave the model context. Their bubbles are hidden here; the stored session log keeps the original records. This cannot be undone from the UI.',
        retractConfirmBodyLast: 'This message leaves the model context and its bubble is hidden here. The stored session log keeps the original record. This cannot be undone from the UI.',
        retractImagesBack: 'Its {count} image(s) go back into the composer together with the text.',
        retractImagesUnavailable: 'It carries {count} image(s) this build cannot put back into the composer; add them again by hand.',
        confirmRetract: 'Retract',
        rewinding: 'Retracting…',
        rewindFailed: 'Could not retract',
        imageUnreadable: 'The image in this message cannot be read back, so nothing was retracted.',
        messageRetracted: 'This message was already retracted.',
        messageUnknown: 'This message is no longer in the conversation (it may have been retracted or condensed).',
        sessionActive: 'This session is still running work. Stop it first, then retract.',
        sessionNotLive: 'This session is not open in the Host process. Send a message in it first, then retract.',
        multiAction: 'Clean up sessions…',
        multiSelectAll: 'Select all deletable sessions',
        multiRetry: 'Retry {count}',
        multiBar: '{count} session(s) selected',
        multiDelete: 'Delete…',
        multiExit: 'Exit',
        multiCheck: 'Tick this session',
        multiUncheck: 'Untick this session',
        multiTitle: 'Delete {count} session(s) permanently?',
        multiBody: 'The stored logs of {count} session(s) ({size} in total) are removed from this computer. This cannot be undone.',
        multiBodyNoSize: 'The stored logs of {count} session(s) are removed from this computer. This cannot be undone.',
        multiConfirm: 'Delete {count} permanently',
        multiNone: 'None of the selected sessions can be deleted.',
        multiDeleted: 'Deleted',
        multiSkipped: 'Skipped',
        multiFailed: 'Failed',
        multiOutcome: 'Deleted {deleted}, skipped {skipped}, failed {failed}.',
        multiDone: 'Done',
        previewTitle: 'Conversation preview',
        previewCount: '{count} turns',
        previewCountOne: '{count} turn',
        previewEmpty: 'Turns appear here once the conversation starts.',
        previewLoadHint: 'Click to load',
        previewLoading: 'Loading…',
        previewLoadFailed: 'Could not load; click to retry',
        previewRunning: 'Generating',
        previewFollow: 'Following',
        previewPaused: 'Paused',
        previewBack: 'Back to current',
        previewCollapse: 'Collapse preview',
        previewExpand: 'Expand conversation preview',
        previewResize: 'Drag to resize; double-click to fit the margin',
        previewJump: 'Go to turn {turn}',
        previewTurn: 'Turn {turn}',
      },
      zh: {
        action: '删除会话',
        title: '彻底删除这个会话？',
        body: '“{title}”及其完整事件日志（{size}）会从这台电脑上删除，且无法恢复。',
        bodyUntitled: '这个会话及其完整事件日志（{size}）会从这台电脑上删除，且无法恢复。',
        bodyNoSize: '“{title}”及其完整事件日志会从这台电脑上删除，且无法恢复。',
        bodyUntitledNoSize: '这个会话及其完整事件日志会从这台电脑上删除，且无法恢复。',
        confirm: '彻底删除',
        cancel: '取消',
        deleting: '正在删除…',
        checking: '正在检查会话…',
        failed: '删除会话失败',
        live: '严格模式已开启：Host 仍持有这个会话的 agent，`allowLiveSessionDelete: false` 就是要求拒绝它。请重启应用后再删除。',
        active: '这个会话还有正在运行的任务（对话、作业、子代理或终端）。请先停止它，再删除。',
        unknown: '这个会话已经不存在了。',
        unresolved: '找不到这个会话的日志位置，因此没有删除任何东西。',
        invalid: 'Host 拒绝了这个会话 id。',
        bytes: '{size} B',
        kb: '{size} KB',
        mb: '{size} MB',
        retract: '撤回',
        editAction: '重新编辑',
        editCancelHint: '取消（Esc）',
        editSendHint: '替换并发送（Enter）',
        editImagesUnavailable: '这条消息带有 {count} 张图片；当前版本无法保留它们，替换后只发送文本。',
        retractConfirmTitle: '撤回这条消息？',
        retractConfirmBody: '这条消息及其之后的 {count} 条对话会从模型上下文中移除。界面里对应的气泡会被隐藏，原始记录仍保留在会话日志中。界面上无法撤销这个操作。',
        retractConfirmBodyLast: '这条消息会从模型上下文中移除，界面里对应的气泡会被隐藏。原始记录仍保留在会话日志中。界面上无法撤销这个操作。',
        retractImagesBack: '其中的 {count} 张图片会随文本一起回到输入框。',
        retractImagesUnavailable: '它带有 {count} 张图片；当前版本无法把图片放回输入框，需要手动重新添加。',
        confirmRetract: '撤回',
        rewinding: '正在撤回…',
        rewindFailed: '撤回失败',
        imageUnreadable: '读不到这条消息里的图片，因此没有执行撤回。',
        messageRetracted: '这条消息已经撤回过了。',
        messageUnknown: '这条消息已经不在当前对话里了（可能已被撤回或压缩）。',
        sessionActive: '这个会话还在运行（正在生成回复或执行工具），请先停止再撤回。',
        sessionNotLive: '这个会话当前没有在 Host 里打开；先在这个会话里发一条消息，再撤回。',
        multiAction: '清理会话…',
        multiSelectAll: '全选可删的会话',
        multiRetry: '重试 {count} 个',
        multiBar: '已选 {count} 个会话',
        multiDelete: '删除…',
        multiExit: '退出',
        multiCheck: '勾选这个会话',
        multiUncheck: '取消勾选这个会话',
        multiTitle: '彻底删除 {count} 个会话？',
        multiBody: '这 {count} 个会话的存储日志（合计 {size}）会从这台电脑上删除，且无法恢复。',
        multiBodyNoSize: '这 {count} 个会话的存储日志会从这台电脑上删除，且无法恢复。',
        multiConfirm: '彻底删除 {count} 个',
        multiNone: '所选会话都不可删除。',
        multiDeleted: '已删除',
        multiSkipped: '已跳过',
        multiFailed: '失败',
        multiOutcome: '已删除 {deleted} 个，跳过 {skipped} 个，失败 {failed} 个。',
        multiDone: '完成',
        previewTitle: '对话预览',
        previewCount: '{count} 轮',
        previewCountOne: '{count} 轮',
        previewEmpty: '开始对话后，这里会显示轮次。',
        previewLoadHint: '点击加载',
        previewLoading: '正在加载…',
        previewLoadFailed: '加载失败，点击重试',
        previewRunning: '生成中',
        previewFollow: '跟随对话',
        previewPaused: '已暂停',
        previewBack: '回到当前',
        previewCollapse: '收起预览',
        previewExpand: '展开对话预览',
        previewResize: '拖动调整宽度；双击恢复自适应',
        previewJump: '定位到第 {turn} 轮',
        previewTurn: '第 {turn} 轮',
      },
    }

    /**
     * Pick the dictionary for the app's current language.
     * @returns {object} the active dictionary, falling back to English.
     */
    function fallbackDict() {
      const lang = typeof document === 'undefined' ? '' : document.documentElement.lang || ''
      return /^zh/iu.test(lang) ? DICT.zh : DICT.en
    }

    /**
     * Translate one key, interpolating `{name}` placeholders.
     * @param {string} key - dictionary key.
     * @param {object} [values] - placeholder values.
     * @returns {string} the text.
     */
    function fallbackText(key, values) {
      const active = fallbackDict()
      const template = active[key] ?? DICT.en[key] ?? key
      if (values === undefined) return template
      return template.replace(/\{(\w+)\}/gu, (match, name) => (name in values ? String(values[name]) : match))
    }

    /**
     * The translator this module renders with. `apply` upgrades it to the
     * Harness locale service when that service is reachable; the document
     * language fallback keeps the text correct either way, so a locale service
     * that is absent or shaped differently never blanks a label.
     * @type {(key: string, values?: object) => string}
     */
    let text = fallbackText


    /**
     * The client context, kept so an affordance can read the services it needs
     * instead of every component taking them as props. Both readers below
     * degrade to empty values: a deployment that exposes neither `workspaces`
     * nor `sessions` still gets the box and the bar, only without sibling rows
     * and titles.
     */
    let clientContext = null


    const EDITOR_HEADER = 'x-dsh-desktop-plus'

    /** Where the browser half reports what it managed to activate. */
    const CLIENT_REPORT_ROUTE = ROUTE_PREFIX + '/client-report'

    /** One report per phase and component per page load. */
    const reportedPhases = new Set()

    /**
     * Tell the Host how far the browser half got (fire and forget).
     *
     * A client bundle can be composed and served and still fail before it
     * renders anything; without developer tools on the user's machine there is
     * no other way to tell "not mounted" from "mounted but no rows match". The
     * Host keeps the last reports and exposes them from `/dsh-desktop-plus/info`.
     * Diagnostics must never break the page, so every failure is swallowed.
     * @param {object} payload - phase, component, and any facts worth reporting.
     */
    function reportClient(payload) {
      try {
        const key = String(payload?.phase ?? '') + ':' + String(payload?.component ?? payload?.slot ?? '')
        if (reportedPhases.has(key)) return
        reportedPhases.add(key)
        fetch(CLIENT_REPORT_ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json', [EDITOR_HEADER]: '1' },
          body: JSON.stringify({
            ...payload,
            href: typeof location === 'undefined' ? '' : String(location.href),
            lang: typeof document === 'undefined' ? '' : document.documentElement.lang || '',
          }),
        }).catch(() => {})
      } catch {
        // Never let diagnostics break the feature.
      }
    }


    const hideRules = new Map()
    /** View components that redraw when a session's hidden-turn set changes. */
    const hideRuleListeners = new Set()

    /** The single style element carrying the per-session hide rules. */
    let styleTag = null

    function cssString(value) {
      return '"' + String(value).replace(/\\/gu, '\\\\').replace(/"/gu, '\\"') + '"'
    }

    /**
     * Install (once) the style element this module writes into.
     * @returns {HTMLStyleElement | null} the element, or null without a document.
     */
    function ensureStyle() {
      if (typeof document === 'undefined') return null
      if (styleTag !== null) return styleTag
      const existing = document.querySelector('style[data-plugin="dsh-desktop-plus"][data-dsh-desktop-plus-dynamic]')
      styleTag = existing ?? document.createElement('style')
      styleTag.dataset.plugin = 'dsh-desktop-plus'
      styleTag.dataset.dshDesktopPlusDynamic = ''
      if (existing === null) document.head.appendChild(styleTag)
      return styleTag
    }

    /**
     * Rewrite the dynamic half of the style element from every learned rule.
     *
     * Rules are scoped by `[data-conversation-session]`, the conversation body
     * attribute, so hiding turn 3 in one session never touches another. A
     * retracted turn is addressed by its `[data-chat-turn]` value (which the
     * flow rows and collapsed process groups both carry); rows that live in the
     * cut turn but must not vanish — the user prompt above a retracted reply —
     * are addressed by their exact `[data-chat-node-key]`.
     */
    function publishHideRules() {
      const tag = ensureStyle()
      if (tag === null) return
      const parts = []
      for (const [sessionId, rules] of hideRules) {
        const scope = '[data-conversation-session=' + cssString(sessionId) + ']'
        for (const turn of rules.turns) parts.push(scope + ' [data-chat-turn=' + cssString(String(turn)) + ']{display:none !important}')
        for (const key of rules.keys) parts.push(scope + ' [data-chat-node-key=' + cssString(key) + ']{display:none !important}')
      }
      tag.textContent = parts.join('\n')
    }

    /**
     * Merge one retraction's rules into a session's learned set.
     * @param {string} sessionId - the session.
     * @param {{turns?: number[], keys?: string[]} | undefined} rules - incremental rules.
     */
    function applyHideRules(sessionId, rules) {
      if (typeof sessionId !== 'string' || sessionId === '' || rules === undefined || rules === null) return
      const current = hideRules.get(sessionId) ?? { turns: new Set(), keys: new Set() }
      for (const turn of rules.turns ?? []) current.turns.add(turn)
      for (const key of rules.keys ?? []) current.keys.add(key)
      hideRules.set(sessionId, current)
      publishHideRules()
      for (const listener of hideRuleListeners) {
        try {
          listener(sessionId)
        } catch {
          // A listener's failure must not cost the hide rule itself.
        }
      }
    }


    /**
     * Issue one JSON request against this bundle's Host routes.
     * @param {string} url - route.
     * @param {object} [body] - JSON body; omitted for GET.
     * @returns {Promise<{ok: boolean, value: any, status: number}>} the parsed outcome.
     */
    async function requestJson(url, body) {
      const init =
        body === undefined
          ? { method: 'GET', headers: { [EDITOR_HEADER]: '1' } }
          : { method: 'POST', headers: { 'content-type': 'application/json', [EDITOR_HEADER]: '1' }, body: JSON.stringify(body) }
      const response = await fetch(url, init)
      const value = await response.json().catch(() => null)
      return { ok: response.ok === true && value?.ok === true, value, status: response.status }
    }

    // A factory report without an \`applied\` report means the module executed but
    // the client runner never activated it; no report at all means the bundle
    // never ran in this page.
    reportClient({ phase: 'factory' })

    return {
      inject: ['slots'],
      apply(ctx) {
        /** Per-registration outcomes, reported to the Host for diagnosis. */
        clientContext = ctx
        const outcomes = []

        /**
         * Mount one slot entry, containing its failure to that entry and
         * reporting it instead of taking the rest of the module down.
         * @param {string} slot - slot name.
         * @param {() => unknown} factory - the registration factory.
         */
        const mountSlot = (slot, factory) => {
          try {
            const dispose = ctx.slots.inject(slot, () => {
              try {
                const result = factory()
                reportClient({ phase: 'slot-mounted', slot })
                return result
              } catch (error) {
                reportClient({ phase: 'register-failed', slot, error: String(error?.stack ?? error) })
                return () => {}
              }
            })
            outcomes.push(slot + ':' + (typeof dispose === 'function' ? 'ok' : 'no-disposer'))
            return dispose
          } catch (error) {
            outcomes.push(slot + ':inject-failed:' + String(error?.message ?? error))
          }
        }

        // The dynamic style holds every learned hide rule; the static styles
        // travel with their feature chunks.
        try {
          publishHideRules()
        } catch (error) {
          outcomes.push('styles-failed:' + String(error?.message ?? error))
        }

        // Prefer the Harness locale service; keep the document-language
        // fallback when it is unavailable.
        try {
          const locale = ctx.get('locale')
          if (locale !== undefined && typeof locale?.register === 'function' && typeof locale?.bind === 'function') {
            locale.register(NS, DICT)
            const translate = locale.bind(NS)
            if (typeof translate === 'function') text = (key, values) => (values === undefined ? translate(key) : translate(key, values))
            outcomes.push('locale:ok')
          } else {
            outcomes.push('locale:absent')
          }
        } catch (error) {
          outcomes.push('locale:failed:' + String(error?.message ?? error))
        }

        const runtime = {
          text: (key, values) => text(key, values),
          reportClient,
          getContext: () => clientContext,
          cssString,
          reactDOM,
          hideRules,
          hideRuleListeners,
          applyHideRules,
          publishHideRules,
          requestJson,
          routePrefix: ROUTE_PREFIX,
          mountSlot,
          outcomes,
        }

        const state = { disposed: false }
        const features = [
          ['sessions', './client.sessions.js'],
          ['rewind', './client.rewind.js'],
          ['preview', './client.preview.js'],
        ]
        const load = async () => {
          const results = await Promise.allSettled(features.map(([, path]) => require.async(path)))
          if (state.disposed) return
          for (let index = 0; index < features.length; index += 1) {
            const [name] = features[index]
            const result = results[index]
            if (result.status === 'rejected') {
              reportClient({
                phase: 'chunk-failed',
                component: name,
                error: String(result.reason?.message ?? result.reason),
              })
              continue
            }
            try {
              const dispose = result.value?.mount?.(ctx, runtime)
              if (typeof dispose === 'function') {
                // The chunk owns no long-lived registration outside the plugin
                // context; a disposer is supported for a future chunk.
                outcomes.push('chunk-mounted:' + name)
              } else {
                outcomes.push('chunk-mounted:' + name)
              }
            } catch (error) {
              reportClient({ phase: 'mount-failed', component: name, error: String(error?.stack ?? error) })
            }
          }
          reportClient({ phase: 'applied', outcomes, hasSlots: ctx.get('slots') !== undefined })
        }
        load().catch(error => reportClient({ phase: 'load-failed', error: String(error?.stack ?? error) }))
        ctx.effect(
          () => () => {
            state.disposed = true
          },
          'dsh-desktop-plus: split client load',
        )
      },
    }
  },
})
