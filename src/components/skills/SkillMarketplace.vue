<template>
  <div class="sm-root">
    <div class="sm-header">
      <h3>技能市场</h3>
      <p class="sm-sub">浏览精选技能，一键安装即可使用</p>
    </div>

    <div class="sm-grid" v-if="!loading">
      <div v-for="s in skills" :key="s.id" class="sm-card">
        <div class="sm-card-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="sm-card-body">
          <div class="sm-card-name">/{{ s.name }}</div>
          <div class="sm-card-title">{{ s.displayName }}</div>
          <div class="sm-card-desc">{{ s.description }}</div>
          <div class="sm-card-tags">
            <span v-for="t in s.tags" :key="t" class="sm-tag">{{ t }}</span>
          </div>
          <div class="sm-card-meta">
            <span class="sm-installs">{{ formatInstalls(s.installs) }} 次安装</span>
            <span class="sm-author">{{ s.author }}</span>
          </div>
        </div>
        <button
          class="sm-install-btn"
          :class="{ installed: installedSlugs.has(s.name) }"
          :disabled="installing === s.id || installedSlugs.has(s.name)"
          @click="installSkill(s)"
        >
          <template v-if="installing === s.id">
            <svg class="spin" width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1" opacity=".25"/>
              <path d="M11.5 6.5a5 5 0 00-4-4.8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
            </svg>
          </template>
          <template v-else-if="installedSlugs.has(s.name)">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width=".8"/>
              <path d="M4 6.5l2 2 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            已安装
          </template>
          <template v-else>安装</template>
        </button>
      </div>
    </div>

    <div v-else class="sm-loading"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSkillStore } from '../../stores/skillStore.js'

const emit = defineEmits(['installed'])

const skillStore = useSkillStore()
const loading = computed(() => skillStore.marketplaceLoading)
const skills = computed(() => skillStore.marketplaceSkills)
const installing = ref(null)
const installedSlugs = ref(new Set())

onMounted(async () => {
  await skillStore.loadMarketplace()
  try {
    await skillStore.loadSkills(null)
    skillStore.skills.value?.forEach(s => installedSlugs.value.add(s.slug))
  } catch {}
})

function formatInstalls(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

async function installSkill(skill) {
  installing.value = skill.id
  try {
    await skillStore.installFromMarketplace(skill.id, null)
    installedSlugs.value.add(skill.name)
    emit('installed', skill.id)
  } finally {
    installing.value = null
  }
}
</script>

<style scoped>
.sm-root { padding: 0; }
.sm-header { margin-bottom: 16px; }
.sm-header h3 { font-size: 15px; font-weight: 500; color: var(--text); margin-bottom: 4px; }
.sm-sub { font-size: 11px; color: var(--text3); font-weight: 300; }

.sm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sm-card {
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
  transition: border-color .15s;
}
.sm-card:hover { border-color: var(--border2); }

.sm-card-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--bg4); display: flex; align-items: center; justify-content: center;
  color: var(--accent); flex-shrink: 0;
}

.sm-card-body { flex: 1; }
.sm-card-name { font-size: 13px; font-weight: 500; color: var(--accent); font-family: var(--font-mono); margin-bottom: 2px; }
.sm-card-title { font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 2px; }
.sm-card-desc {
  font-size: 11px; color: var(--text3); font-weight: 300;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; line-height: 1.4; margin-bottom: 4px;
}
.sm-card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
.sm-tag { font-size: 9px; padding: 1px 6px; border-radius: var(--radius-full); background: var(--bg4); color: var(--text3); }
.sm-card-meta { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--text3); }
.sm-author { color: var(--text2); }

.sm-install-btn {
  padding: 6px 12px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg4);
  color: var(--text2); font-size: 11px; font-family: inherit; font-weight: 400;
  cursor: pointer; transition: all .12s; display: flex; align-items: center; gap: 5px;
  justify-content: center;
}
.sm-install-btn:hover:not(:disabled) { background: var(--accent); color: #fff; border-color: var(--accent); }
.sm-install-btn.installed { color: var(--green); border-color: rgba(63,185,80,.3); background: rgba(63,185,80,.08); cursor: default; }
.sm-install-btn:disabled { cursor: default; }

.sm-loading { text-align: center; color: var(--text3); font-size: 13px; font-weight: 300; padding: 32px; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
</style>
