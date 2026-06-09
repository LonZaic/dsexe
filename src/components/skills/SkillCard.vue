<template>
  <div class="sc-card" :class="{ auto: !skill.userInvocable }">
    <div class="sc-card-main">
      <div class="sc-card-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="sc-card-info">
        <div class="sc-card-name">/{{ skill.slug }}</div>
        <div class="sc-card-desc">{{ skill.description || 'No description' }}</div>
        <div class="sc-card-meta">
          <span class="sc-source">{{ skill.source }}</span>
          <span v-if="skill.model" class="sc-model">model: {{ skill.model }}</span>
          <span v-if="skill.version" class="sc-version">v{{ skill.version }}</span>
          <span v-if="!skill.userInvocable" class="sc-auto">auto</span>
        </div>
      </div>
    </div>
    <div class="sc-card-actions">
      <button class="sc-act-btn view" title="View" @click="$emit('view', skill.slug)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
      <button class="sc-act-btn remove" title="Delete" @click="$emit('delete', skill.slug)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  skill: { type: Object, required: true },
})
defineEmits(['view', 'delete'])
</script>

<style scoped>
.sc-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px; border-radius: var(--radius);
  border: 1px solid var(--border); background: var(--bg3);
  transition: border-color .15s; margin-bottom: 6px;
}
.sc-card:hover { border-color: var(--border2); }
.sc-card.auto { opacity: .7; }

.sc-card-main { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }

.sc-card-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--bg4); display: flex; align-items: center; justify-content: center;
  color: var(--text2); flex-shrink: 0;
}

.sc-card-info { flex: 1; min-width: 0; }
.sc-card-name {
  font-size: 13px; font-weight: 500; color: var(--accent); margin-bottom: 2px;
  font-family: var(--font-mono);
}
.sc-card-desc {
  font-size: 11px; color: var(--text3); font-weight: 300;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sc-card-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 10px; }
.sc-source { color: var(--text2); background: var(--bg4); padding: 1px 6px; border-radius: var(--radius-full); }
.sc-model { color: var(--yellow); }
.sc-version { color: var(--text3); }
.sc-auto { color: var(--accent); background: var(--accent-muted); padding: 1px 6px; border-radius: var(--radius-full); }

.sc-card-actions { display: flex; gap: 2px; flex-shrink: 0; }
.sc-act-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent;
  color: var(--text3); cursor: pointer;
  transition: all .12s;
}
.sc-act-btn:hover { background: var(--bg4); color: var(--text2); }
.sc-act-btn.remove:hover { background: rgba(248,81,73,0.12); color: var(--red); }
</style>
