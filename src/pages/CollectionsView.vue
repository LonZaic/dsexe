<template>
  <div class="collections-page">
    <!-- Header -->
    <div class="col-header">
      <div class="col-header-top">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="col-header-icon">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="col-title">收藏</span>
        <button class="col-add-folder-btn" title="新建收藏夹" @click="showNewFolder = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Search -->
      <div class="col-search-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="col-search-icon">
          <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input
          v-model="searchText"
          class="col-search-input"
          placeholder="搜索收藏..."
          @input="store.doSearch(searchText)"
        />
        <button v-if="searchText" class="col-search-clear" @click="searchText = ''; store.doSearch('')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>

      <!-- Folder tabs -->
      <div class="col-folders">
        <button
          :class="['col-folder-tab', { active: store.currentCollectionId === null }]"
          @click="store.selectCollection(null)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>全部</span>
        </button>
        <button
          v-for="col in store.collections"
          :key="col.id"
          :class="['col-folder-tab', { active: store.currentCollectionId === col.id }]"
          @click="store.selectCollection(col.id)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>{{ col.name }}</span>
          <span class="col-folder-del" @click.stop="deleteFolder(col)" title="删除收藏夹" role="button" tabindex="0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </span>
        </button>
      </div>
    </div>

    <!-- Items list -->
    <div class="col-items">
      <TransitionGroup name="col-item">
        <div
          v-for="item in store.filteredItems"
          :key="item.id"
          class="col-item"
          @click="openItem(item)"
        >
          <div class="col-item-preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="col-item-icon">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14 2v6h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="col-item-text">{{ item.preview || '(无内容)' }}</span>
          </div>
          <div class="col-item-meta">
            <span class="col-item-time">{{ formatTime(item.created_at) }}</span>
            <button class="col-item-transfer" @click.stop="openTransfer(item, $event)" title="转移">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M9 8l3-3 3 3M9 16l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="col-item-del" @click.stop="removeSavedItem(item)" title="删除">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
      </TransitionGroup>

      <div v-if="!store.filteredItems.length" class="col-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" class="col-empty-icon">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>{{ searchText ? '未找到匹配的收藏' : '还没有收藏，去对话中点书签按钮吧' }}</span>
      </div>
    </div>

    <!-- New folder modal -->
    <Transition name="fade">
      <div v-if="showNewFolder" class="col-modal-overlay" @click.self="showNewFolder = false">
        <div class="col-modal">
          <div class="col-modal-title">新建收藏夹</div>
          <input
            ref="folderInputRef"
            v-model="newFolderName"
            class="col-modal-input"
            placeholder="收藏夹名称"
            @keydown.enter="createFolder"
          />
          <div class="col-modal-actions">
            <button class="col-modal-btn cancel" @click="showNewFolder = false">取消</button>
            <button class="col-modal-btn confirm" @click="createFolder" :disabled="!newFolderName.trim()">创建</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Transfer popup — Teleported to body to avoid scroll clipping -->
    <Teleport to="body">
      <Transition name="bm-pop">
        <div v-if="showTransfer" ref="transferPopupRef" class="transfer-popup" :style="transferStyle" @click.stop>
          <div class="transfer-popup-title">转移到</div>
          <div class="transfer-popup-list">
            <button class="transfer-popup-opt" @click="doTransfer(null)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>全局收藏</span>
            </button>
            <button v-for="col in transferCollections" :key="col.id" class="transfer-popup-opt" @click="doTransfer(col.id)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>{{ col.name }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Item detail modal -->
    <Transition name="fade">
      <div v-if="detailItem" class="col-modal-overlay" @click.self="detailItem = null">
        <div class="col-detail">
          <div class="col-detail-header">
            <span class="col-detail-title">收藏详情</span>
            <button class="col-detail-close" @click="detailItem = null">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="col-detail-body markdown-body" v-html="detailHtml"></div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { useCollectionStore } from '../stores/collectionStore.js'
import { renderMarkdown } from '../utils/markdown.js'
import { confirmDelete } from '../utils/confirm.js'
import { moveSavedItem, getCollections } from '../db/database.js'

const store = useCollectionStore()
const searchText = ref('')
const showNewFolder = ref(false)
const newFolderName = ref('')
const folderInputRef = ref(null)
const detailItem = ref(null)

onMounted(() => {
  store.refresh()
})

function createFolder() {
  const name = newFolderName.value.trim()
  if (!name) return
  store.addCollection(name)
  newFolderName.value = ''
  showNewFolder.value = false
}

async function deleteFolder(col) {
  const ok1 = await confirmDelete({
    title: '删除收藏夹',
    message: `确定要删除收藏夹「${col.name}」吗？其中的收藏条目将移至全局收藏。`,
    step: 1,
  })
  if (!ok1) return
  const ok2 = await confirmDelete({
    title: '确认删除',
    message: `删除后无法恢复收藏夹「${col.name}」。确认继续？`,
    step: 2,
  })
  if (!ok2) return
  store.removeCollection(col.id)
}

async function removeSavedItem(item) {
  const ok = await confirmDelete({
    title: '删除收藏',
    message: '确定要删除这条收藏内容吗？',
    step: 1,
  })
  if (!ok) return
  store.removeItem(item.id)
}

// ═══ Transfer ═══
const showTransfer = ref(false)
const transferItem = ref(null)
const transferStyle = ref({})
const transferCollections = ref([])
const transferPopupRef = ref(null)
let _transferBtnEl = null

function closeTransfer() {
  showTransfer.value = false
  transferItem.value = null
  transferStyle.value = {}
  _transferBtnEl = null
  document.removeEventListener('click', onTransferOutsideClick)
}

function onTransferOutsideClick(e) {
  const insidePopup = transferPopupRef.value && transferPopupRef.value.contains(e.target)
  const insideBtn = _transferBtnEl && _transferBtnEl.contains(e.target)
  if (!insidePopup && !insideBtn) {
    closeTransfer()
  }
}

function openTransfer(item, event) {
  event.stopPropagation()
  _transferBtnEl = event.currentTarget
  transferItem.value = item
  // Filter out the current collection so we don't "transfer" to the same place
  const currentColId = item.collection_id || null
  transferCollections.value = getCollections().filter(c => c.id !== currentColId)

  const rect = _transferBtnEl.getBoundingClientRect()
  transferStyle.value = {
    position: 'fixed',
    top: (rect.bottom + 4) + 'px',
    left: Math.min(rect.right - 200, window.innerWidth - 210) + 'px',
    zIndex: '9999',
  }
  showTransfer.value = true
  setTimeout(() => document.addEventListener('click', onTransferOutsideClick), 0)
}

function doTransfer(newColId) {
  if (!transferItem.value) return
  moveSavedItem(transferItem.value.id, newColId)
  closeTransfer()
  store.refresh()
}

onBeforeUnmount(() => {
  document.removeEventListener('click', onTransferOutsideClick)
})

function openItem(item) {
  try {
    const msg = JSON.parse(item.msg_json)
    detailItem.value = msg
  } catch { detailItem.value = item }
}

const detailHtml = computed(() => {
  if (!detailItem.value) return ''
  const text = detailItem.value.text || detailItem.value.preview || ''
  try { return renderMarkdown(text) } catch { return text }
})

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts + (ts.includes('T') ? '' : 'Z').replace('Z Z', 'Z'))
  if (isNaN(d.getTime())) return ts.slice(0, 16)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return d.toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.collections-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
}

.col-header {
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.col-header-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.col-header-icon { color: var(--accent); }
.col-title { font-size: 16px; font-weight: 600; color: var(--text); }
.col-add-folder-btn {
  margin-left: auto;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm); border: 1px solid var(--border);
  background: var(--bg2); color: var(--text2); cursor: pointer;
  transition: all var(--transition-fast);
}
.col-add-folder-btn:hover { border-color: var(--accent); color: var(--accent); }

/* Search */
.col-search-wrap {
  display: flex; align-items: center; gap: 6px;
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 6px 10px;
  margin-bottom: 10px; transition: border-color var(--transition-fast);
}
.col-search-wrap:focus-within { border-color: var(--accent); }
.col-search-icon { color: var(--text3); flex-shrink: 0; }
.col-search-input {
  flex: 1; background: none; border: none; outline: none;
  color: var(--text); font-size: 13px; font-family: inherit;
}
.col-search-input::placeholder { color: var(--text3); }
.col-search-clear {
  width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; border: none; background: transparent; color: var(--text3);
  cursor: pointer; flex-shrink: 0;
}
.col-search-clear:hover { background: var(--bg3); color: var(--text); }

/* Folders */
.col-folders {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.col-folder-tab {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: var(--radius-full);
  border: 1px solid var(--border); background: var(--bg2);
  color: var(--text2); font-size: 12px; cursor: pointer;
  transition: all var(--transition-fast); font-family: inherit;
}
.col-folder-tab:hover { border-color: var(--accent-muted); color: var(--text); }
.col-folder-tab.active { background: var(--accent-muted); border-color: var(--accent); color: var(--accent); }
.col-folder-del {
  width: 16px; height: 16px; display: none; align-items: center; justify-content: center;
  border-radius: 50%; border: none; background: transparent; color: var(--text3);
  cursor: pointer; margin-left: 2px;
}
.col-folder-tab:hover .col-folder-del { display: flex; }
.col-folder-del:hover { background: rgba(248,81,73,0.12); color: var(--red); }

/* Items */
.col-items {
  flex: 1; overflow-y: auto; padding: 8px 20px;
}
.col-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-radius: var(--radius-sm);
  border: 1px solid transparent; cursor: pointer;
  transition: all var(--transition-fast);
}
.col-item:hover { background: var(--bg2); border-color: var(--border); }
.col-item-preview {
  display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;
}
.col-item-icon { color: var(--text3); flex-shrink: 0; }
.col-item-text {
  font-size: 13px; color: var(--text); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.col-item-meta {
  display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 12px;
}
.col-item-time { font-size: 11px; color: var(--text3); white-space: nowrap; }
.col-item-del {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm); border: none; background: transparent;
  color: var(--text3); cursor: pointer; opacity: 0; transition: all var(--transition-fast);
}
.col-item-transfer {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm); border: none; background: transparent;
  color: var(--text3); cursor: pointer; opacity: 0; transition: all var(--transition-fast);
}
.col-item:hover .col-item-del { opacity: 1; }
.col-item:hover .col-item-transfer { opacity: 1; }
.col-item-del:hover { background: rgba(248,81,73,0.12); color: var(--red); }
.col-item-transfer:hover { background: var(--accent-muted); color: var(--accent); }

.col-empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 60px 20px; color: var(--text3); font-size: 13px;
}
.col-empty-icon { opacity: 0.3; }

/* Item animations */
.col-item-enter-active { transition: all 0.3s ease; }
.col-item-leave-active { transition: all 0.2s ease; }
.col-item-enter-from { opacity: 0; transform: translateY(-8px); }
.col-item-leave-to { opacity: 0; transform: translateX(20px); }

/* Modal */
.col-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: var(--z-modal);
}
.col-modal {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 20px;
  width: 340px; box-shadow: var(--shadow-lg);
}
.col-modal-title { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 12px; }
.col-modal-input {
  width: 100%; padding: 8px 12px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg); color: var(--text);
  font-size: 13px; font-family: inherit; outline: none; box-sizing: border-box;
}
.col-modal-input:focus { border-color: var(--accent); }
.col-modal-actions {
  display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;
}
.col-modal-btn {
  padding: 6px 16px; border-radius: var(--radius-sm); border: none;
  font-size: 12px; cursor: pointer; font-family: inherit; transition: all var(--transition-fast);
}
.col-modal-btn.cancel { background: var(--bg3); color: var(--text2); }
.col-modal-btn.cancel:hover { background: var(--bg4); }
.col-modal-btn.confirm { background: var(--accent); color: #fff; }
.col-modal-btn.confirm:hover { background: var(--accent-hover); }
.col-modal-btn.confirm:disabled { opacity: 0.4; cursor: default; }

/* Detail modal */
.col-detail {
  background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--radius-lg); width: 600px; max-width: 90vw;
  max-height: 80vh; display: flex; flex-direction: column;
  box-shadow: var(--shadow-xl);
}
.col-detail-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--border);
}
.col-detail-title { font-size: 14px; font-weight: 600; color: var(--text); }
.col-detail-close {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm); border: none; background: transparent;
  color: var(--text2); cursor: pointer;
}
.col-detail-close:hover { background: var(--red-muted); color: var(--red); }
.col-detail-body { padding: 18px; overflow-y: auto; flex: 1; }

.fade-enter-active { transition: opacity 0.2s ease; }
.fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Transfer popup */
.transfer-popup {
  background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: 0 8px 30px rgba(0,0,0,0.18);
  padding: 8px 0; min-width: 200px;
}
.transfer-popup-title {
  font-size: 11px; font-weight: 600; color: var(--text3);
  padding: 0 12px 8px; letter-spacing: 0.5px; text-transform: uppercase;
}
.transfer-popup-list { max-height: 200px; overflow-y: auto; padding: 0 6px; }
.transfer-popup-opt {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 7px 10px; border-radius: var(--radius-sm);
  border: none; background: transparent; color: var(--text2);
  font-size: 12px; cursor: pointer; font-family: inherit; text-align: left;
  transition: all 0.12s ease;
}
.transfer-popup-opt:hover { background: var(--bg2); color: var(--text); }
.transfer-popup-opt svg { flex-shrink: 0; color: var(--text3); transition: color 0.12s; }
.transfer-popup-opt:hover svg { color: var(--accent); }

.bm-pop-enter-active { transition: all 0.18s cubic-bezier(0.16,1,0.3,1); }
.bm-pop-leave-active { transition: all 0.12s ease; }
.bm-pop-enter-from, .bm-pop-leave-to { opacity: 0; transform: translateY(6px) scale(0.96); }
</style>
