/**
 * Professional delete confirmation dialog.
 * - Single confirm: one dialog with subtle red accents
 * - Double confirm: first dialog has red, second is aggressively red (warning of irreversibility)
 * No emoji. SVG icons only. Returns Promise<boolean>.
 */

let _activeResolve = null

/**
 * Show a delete confirmation dialog.
 * @param {Object} opts
 * @param {string}  opts.title       — dialog title
 * @param {string}  opts.message     — body text
 * @param {number}  opts.step        — 1 = first confirm, 2 = second confirm (more red)
 * @param {boolean} opts.destructive — if true, step-2 level red styling
 * @returns {Promise<boolean>}
 */
export function confirmDelete({
  title = '确认删除',
  message = '确定要删除吗？',
  step = 1,
  destructive = false,
} = {}) {
  // Resolve any previous dangling dialog
  if (_activeResolve) {
    _activeResolve(false)
    cleanup()
  }

  return new Promise((resolve) => {
    _activeResolve = resolve

    const isStep2 = step >= 2 || destructive
    const accent = isStep2 ? '#f85149' : 'var(--red, #f85149)'
    const bgDanger = isStep2
      ? 'rgba(248,81,73,0.12)'
      : 'rgba(248,81,73,0.06)'

    const overlay = document.createElement('div')
    overlay.className = 'cfm-overlay'
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,0.55);
      display:flex;align-items:center;justify-content:center;
      animation:cfmFadeIn .15s ease;
    `

    const box = document.createElement('div')
    box.className = 'cfm-box'
    box.style.cssText = `
      background:var(--bg,#1a1916);border:1px solid var(--border,rgba(255,255,255,0.08));
      border-radius:12px;padding:24px;width:360px;max-width:92vw;
      box-shadow:0 16px 48px rgba(0,0,0,0.7);
      animation:cfmSlideUp .2s cubic-bezier(0.16,1,0.3,1);
    `

    // Icon
    const iconColor = isStep2 ? '#f85149' : '#d97706'
    const iconSvg = isStep2
      ? `<svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="${iconColor}" stroke-width="1.5"/>
          <path d="M12 8v4M12 16h.01" stroke="${iconColor}" stroke-width="2" stroke-linecap="round"/>
        </svg>`
      : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="${iconColor}" stroke-width="1.5"/>
          <path d="M12 8v4M12 16h.01" stroke="${iconColor}" stroke-width="2" stroke-linecap="round"/>
        </svg>`

    const titleColor = isStep2 ? '#f85149' : 'var(--text, #e8e6e0)'

    box.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:20px;">
        <div style="flex-shrink:0;">${iconSvg}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:600;color:${titleColor};margin-bottom:6px;">
            ${escapeHtml(title)}
          </div>
          <div style="font-size:13px;color:var(--text2,#9a9890);line-height:1.5;">
            ${escapeHtml(message)}
          </div>
          ${isStep2 ? `
            <div style="margin-top:10px;padding:8px 12px;border-radius:6px;background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.15);font-size:11px;color:#f85149;line-height:1.4;">
              此操作不可恢复，请谨慎确认
            </div>
          ` : ''}
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button class="cfm-btn-cancel" style="
          padding:7px 18px;border-radius:7px;border:1px solid var(--border,rgba(255,255,255,0.08));
          background:var(--bg2,#222220);color:var(--text2,#9a9890);font-size:12px;
          cursor:pointer;font-family:inherit;transition:all .12s;
        ">取消</button>
        <button class="cfm-btn-confirm" style="
          padding:7px 18px;border-radius:7px;border:none;
          background:${isStep2 ? '#e03131' : accent};
          color:#fff;font-size:12px;font-weight:600;
          cursor:pointer;font-family:inherit;transition:all .12s;
        ">${isStep2 ? '确认删除' : '删除'}</button>
      </div>
    `

    // Inject styles once
    if (!document.getElementById('cfm-styles')) {
      const style = document.createElement('style')
      style.id = 'cfm-styles'
      style.textContent = `
        @keyframes cfmFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes cfmSlideUp { from{opacity:0;transform:translateY(12px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        .cfm-overlay { font-family: var(--font-sans, 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif); }
        .cfm-btn-cancel:hover { background:var(--bg3,#2a2a27);color:var(--text,#e8e6e0); }
        .cfm-btn-confirm:hover { filter:brightness(1.15); }
        .cfm-btn-confirm:active { transform:scale(0.97); }
      `
      document.head.appendChild(style)
    }

    overlay.appendChild(box)
    document.body.appendChild(overlay)

    // Events
    const cancelBtn = box.querySelector('.cfm-btn-cancel')
    const confirmBtn = box.querySelector('.cfm-btn-confirm')

    function onConfirm() {
      resolve(true)
      cleanup()
    }
    function onCancel() {
      resolve(false)
      cleanup()
    }
    function onOverlayClick(e) {
      if (e.target === overlay) onCancel()
    }
    function onKeydown(e) {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }

    cancelBtn.addEventListener('click', onCancel)
    confirmBtn.addEventListener('click', onConfirm)
    overlay.addEventListener('click', onOverlayClick)
    document.addEventListener('keydown', onKeydown)

    function cleanup() {
      cancelBtn.removeEventListener('click', onCancel)
      confirmBtn.removeEventListener('click', onConfirm)
      overlay.removeEventListener('click', onOverlayClick)
      document.removeEventListener('keydown', onKeydown)
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
      _activeResolve = null
    }

    // Focus confirm button
    setTimeout(() => confirmBtn.focus(), 50)
  })
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
