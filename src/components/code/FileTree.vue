<template>
  <div class="ft-root">
    <div class="ft-list" ref="listRef">
      <template v-for="node in displayTree" :key="node.path">
        <div
          class="ft-item"
          :class="{ active: activeFile === node.path, dir: node.isDir }"
          :style="{ paddingLeft: (node.depth * 14 + 8) + 'px' }"
          @click="onClick(node)"
        >
          <!-- Folder: chevron + icon -->
          <template v-if="node.isDir">
            <svg class="ft-chev" :class="{ open: node._open }" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-if="node._open" width="14" height="14" viewBox="0 0 14 14" fill="none" class="ft-icon">
              <path d="M1.5 3.5h4.5L7.3 5H12.5V11H1.5V3.5z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none" class="ft-icon">
              <path d="M2 3h3.8L7 4.5H12V11H2V3z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
            </svg>
          </template>
          <!-- File icon -->
          <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none" class="ft-icon">
            <path d="M3 2h5l1.5 1.5H12v8H3V2z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
            <path d="M4.5 6h5M4.5 8.5h3" stroke="currentColor" stroke-width=".7" stroke-linecap="round" opacity=".5"/>
          </svg>
          <span class="ft-name">{{ node.name }}</span>
        </div>
      </template>
      <div v-if="!tree || !tree.length" class="ft-empty">加载中...</div>
      <div v-else-if="!displayTree.length && tree.length" class="ft-empty">空目录</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  tree: { type: Array, default: () => [] },
  activeFile: { type: String, default: '' },
})
const emit = defineEmits(['selectFile'])

const expanded = ref({})

// Build visible tree: only show expanded directories' children
const displayTree = computed(() => {
  const treeData = props.tree || []
  if (!treeData.length) return []

  const result = []
  const hidden = new Set()

  // Mark hidden nodes: children of collapsed directories and their descendants
  for (const node of treeData) {
    if (!node.isDir) continue
    if (!expanded.value[node.path]) {
      // Hide all descendants of this collapsed directory
      const prefix = node.path + '\\'
      for (const child of treeData) {
        if (child.path !== node.path && child.path.startsWith(prefix)) {
          hidden.add(child.path)
        }
      }
    }
  }

  for (const node of treeData) {
    if (hidden.has(node.path)) continue
    result.push({ ...node, _open: expanded.value[node.path] || false })
  }

  return result
})

// Auto-expand depth-0 directories on tree load
watch(() => props.tree, (tree) => {
  if (tree && tree.length) {
    const ex = { ...expanded.value }
    for (const node of tree) {
      if (node.isDir && node.depth === 0) ex[node.path] = true
    }
    expanded.value = ex
  }
}, { immediate: true, deep: true })

function onClick(node) {
  if (node.isDir) {
    expanded.value = { ...expanded.value, [node.path]: !expanded.value[node.path] }
  } else {
    emit('selectFile', node)
  }
}
</script>

<style scoped>
.ft-root { display: flex; flex-direction: column; overflow: hidden; flex: 1; min-height: 0; }
.ft-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.ft-list::-webkit-scrollbar { width: 3px; }
.ft-list::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }
.ft-item {
  display: flex; align-items: center; gap: 5px;
  padding: 3px 10px; cursor: pointer;
  font-size: 12px; font-weight: 300; color: var(--text2);
  transition: background .08s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  user-select: none;
}
.ft-item:hover { background: var(--bg3); }
.ft-item.active { background: rgba(79,125,255,.1); color: var(--accent); }
.ft-chev { flex-shrink: 0; color: var(--text3); transition: transform .12s; }
.ft-chev.open { transform: rotate(90deg); }
.ft-icon { flex-shrink: 0; color: var(--text3); }
.ft-item.active .ft-icon { color: var(--accent); }
.ft-item.dir { font-weight: 400; }
.ft-name { overflow: hidden; text-overflow: ellipsis; }
.ft-empty { padding: 16px 10px; font-size: 11px; color: var(--text3); font-weight: 300; text-align: center; }
</style>
