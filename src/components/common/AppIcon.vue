<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="viewBox"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    :class="iconClass"
  >
    <!-- Send -->
    <template v-if="name === 'send'">
      <path d="M12 20V4M12 4L5 11M12 4L19 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Stop -->
    <template v-else-if="name === 'stop'">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
    </template>

    <!-- Plus -->
    <template v-else-if="name === 'plus'">
      <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </template>

    <!-- File -->
    <template v-else-if="name === 'file'">
      <path d="M14 2H6C5.47 2 5 2.47 5 3V21C5 21.53 5.47 22 6 22H18C18.53 22 19 21.53 19 21V7L14 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 2V7H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Image -->
    <template v-else-if="name === 'image'">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
      <path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Globe / Web Search -->
    <template v-else-if="name === 'globe'">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
      <path d="M2 12H22M12 2C14.5 5 15.5 9 15.5 12C15.5 15 14.5 19 12 22M12 2C9.5 5 8.5 9 8.5 12C8.5 15 9.5 19 12 22" stroke="currentColor" stroke-width="1.5"/>
    </template>

    <!-- GitHub -->
    <template v-else-if="name === 'github'">
      <path d="M15 22V18C15.14 16.92 14.87 15.82 14.24 14.94C17.24 14.6 20 13.04 20 9.5C19.99 8.35 19.54 7.24 18.75 6.43C19.17 5.28 19.02 4 18.36 3C18.36 3 17.36 2.68 15.25 4.23C13.29 3.69 11.2 3.69 9.24 4.23C7.13 2.68 6.13 3 6.13 3C5.47 4 5.32 5.28 5.74 6.43C4.95 7.24 4.5 8.35 4.5 9.5C4.5 13.03 7.26 14.6 10.26 14.93C9.63 15.82 9.36 16.92 9.5 18V22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9.5 18C5.5 19.5 4.5 16 3 15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Settings -->
    <template v-else-if="name === 'settings'">
      <path d="M12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15Z" stroke="currentColor" stroke-width="1.5"/>
      <path d="M19.4 15C19.27 15.29 19.2 15.62 19.2 15.96C19.2 17.08 20.12 18 21.24 18C21.38 18 21.5 18.04 21.6 18.13L21.6 18.13C22.34 18.61 22.5 19.56 22.13 20.27C21.82 20.87 21.22 21.27 20.56 21.39C20.19 21.46 19.82 21.4 19.5 21.22L19.45 21.19C18.63 20.72 17.49 20.96 16.91 21.69L16.87 21.74C16.5 22.24 16.5 22.88 16.5 23.25C16.5 24.11 15.73 24.82 14.87 24.76C14.24 24.72 13.72 24.28 13.59 23.67C13.5 23.24 13.27 22.85 12.93 22.56C12.59 22.28 12.17 22.11 11.73 22.07H11.66C10.77 22 10 21.23 10 20.34V20.26C10 19.82 10.13 19.39 10.37 19.03C10.61 18.67 10.95 18.4 11.34 18.25L11.5 18.18C12.05 17.94 12.46 17.49 12.68 16.93C12.9 16.38 12.91 15.77 12.69 15.21C12.48 14.65 12.06 14.2 11.52 13.97L11.37 13.92C10.97 13.78 10.63 13.52 10.39 13.17C10.14 12.82 10.01 12.4 10 11.96V11.88C10 10.98 10.72 10.24 11.62 10.22L11.75 10.23C12.18 10.25 12.6 10.14 12.96 9.92C13.31 9.69 13.59 9.36 13.74 8.97L13.8 8.81C14.18 7.93 14.99 7.32 15.92 7.18C16.7 7.06 17.48 7.37 18 8L18.07 8.09C18.44 8.54 18.97 8.82 19.56 8.88C20.42 8.97 21.09 9.68 21.16 10.54C21.21 11.13 20.92 11.69 20.44 12.05C20.04 12.33 19.75 12.72 19.6 13.18L19.56 13.32C19.34 13.88 19.35 14.49 19.57 15.04L19.4 15Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Sun -->
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </template>

    <!-- Moon -->
    <template v-else-if="name === 'moon'">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Panel Right -->
    <template v-else-if="name === 'panel-right'">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M15 3V21" stroke="currentColor" stroke-width="1.5"/>
    </template>

    <!-- Panel Close -->
    <template v-else-if="name === 'panel-close'">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M9 3V21" stroke="currentColor" stroke-width="1.5"/>
    </template>

    <!-- Copy -->
    <template v-else-if="name === 'copy'">
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 15H4C2.9 15 2 14.1 2 13V4C2 2.9 2.9 2 4 2H13C14.1 2 15 2.9 15 4V5" stroke="currentColor" stroke-width="1.5"/>
    </template>

    <!-- Download -->
    <template v-else-if="name === 'download'">
      <path d="M12 3V16M12 16L7 11M12 16L17 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4 17V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </template>

    <!-- Code -->
    <template v-else-if="name === 'code'">
      <polyline points="16 18 22 12 16 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="8 6 2 12 8 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Play -->
    <template v-else-if="name === 'play'">
      <polygon points="7 4 19 12 7 20 7 4" fill="currentColor"/>
    </template>

    <!-- User -->
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
      <path d="M4 21C4 17.13 7.13 14 11 14H13C16.87 14 20 17.13 20 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </template>

    <!-- Users / Group -->
    <template v-else-if="name === 'users'">
      <circle cx="9" cy="7" r="3" stroke="currentColor" stroke-width="1.5"/>
      <path d="M2 19C2 15.69 4.69 13 8 13H10C13.31 13 16 15.69 16 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="17" cy="6" r="2.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M18 12H19C21.21 12 23 13.79 23 16V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </template>

    <!-- Message / Chat -->
    <template v-else-if="name === 'message'">
      <path d="M21 15C21 15.53 20.79 16.04 20.41 16.41C20.04 16.79 19.53 17 19 17H7L3 21V5C3 3.9 3.9 3 5 3H19C20.1 3 21 3.9 21 5V15Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Folder -->
    <template v-else-if="name === 'folder'">
      <path d="M22 19C22 19.53 21.79 20.04 21.41 20.41C21.04 20.79 20.53 21 20 21H4C2.9 21 2 20.1 2 19V5C2 3.9 2.9 3 4 3H9L11 6H20C21.1 6 22 6.9 22 8V19Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Chevron Down -->
    <template v-else-if="name === 'chevron-down'">
      <polyline points="6 9 12 15 18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Chevron Right -->
    <template v-else-if="name === 'chevron-right'">
      <polyline points="9 18 15 12 9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Chevron Left -->
    <template v-else-if="name === 'chevron-left'">
      <polyline points="15 18 9 12 15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- X / Close -->
    <template v-else-if="name === 'x'">
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </template>

    <!-- Check -->
    <template v-else-if="name === 'check'">
      <polyline points="5 13 10 17 19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Branch -->
    <template v-else-if="name === 'branch'">
      <circle cx="6" cy="6" r="2" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="6" cy="18" r="2" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="18" cy="6" r="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M6 8V16M6 8C6 8 10 6 18 8" stroke="currentColor" stroke-width="1.5"/>
    </template>

    <!-- Agent / Bot -->
    <template v-else-if="name === 'agent'">
      <rect x="3" y="4" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="9" cy="11" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="11" r="1.5" fill="currentColor"/>
      <path d="M8 16H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </template>

    <!-- Lightbulb / Thinking -->
    <template v-else-if="name === 'lightbulb'">
      <path d="M9.66 18H14.34C14.3 19.24 14.06 20.11 13.68 20.68C13.27 21.28 12.76 21.5 12.25 21.5C11.74 21.5 11.23 21.28 10.82 20.68C10.44 20.11 10.2 19.24 10.16 18H9.66Z" stroke="currentColor" stroke-width="1.5"/>
      <path d="M10 9.15C10 8.09 10.76 7.21 11.75 7.08C12.93 6.92 14 7.77 14 9C14 10.17 13.21 10.85 12.54 11.42C12.18 11.72 12 12.16 12 12.61V13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7 14.93C4.99 13.46 3.5 11.09 3.5 8.5C3.5 3.81 7.31 0 12 0C16.69 0 20.5 3.81 20.5 8.5C20.5 11.22 18.88 13.68 16.71 15.13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </template>

    <!-- Menu / Hamburger -->
    <template v-else-if="name === 'menu'">
      <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </template>

    <!-- Trash -->
    <template v-else-if="name === 'trash'">
      <path d="M4 5H20M9 5V3H15V5M6 5V20C6 20.53 6.47 21 7 21H17C17.53 21 18 20.53 18 20V5H6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Edit -->
    <template v-else-if="name === 'edit'">
      <path d="M17 3C17.26 3 17.51 3.1 17.71 3.29L20.71 6.29C21.1 6.68 21.1 7.32 20.71 7.71L8 20.41L3 21L3.59 16L16.29 3.29C16.49 3.1 16.74 3 17 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Refresh -->
    <template v-else-if="name === 'refresh'">
      <path d="M1 4V10H7M23 20V14H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M20.49 9C19.98 6.64 18.19 4.67 15.83 3.79C13.47 2.91 10.82 3.26 8.73 4.75L1 10M23 14L15.27 19.25C13.18 20.74 10.53 21.09 8.17 20.21C5.81 19.33 4.02 17.36 3.51 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Search -->
    <template v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </template>

    <!-- Database -->
    <template v-else-if="name === 'database'">
      <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" stroke-width="1.5"/>
      <path d="M3 5V19C3 20.66 7.03 22 12 22C16.97 22 21 20.66 21 19V5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M3 12C3 13.66 7.03 15 12 15C16.97 15 21 13.66 21 12" stroke="currentColor" stroke-width="1.5"/>
    </template>

    <!-- Home -->
    <template v-else-if="name === 'home'">
      <path d="M3 12L12 3L21 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 10V20H19V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Time / Clock -->
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </template>

    <!-- Memory -->
    <template v-else-if="name === 'memory'">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M3 10H21" stroke="currentColor" stroke-width="1.5"/>
    </template>

    <!-- External Link -->
    <template v-else-if="name === 'external-link'">
      <path d="M18 13V19C18 20.1 17.1 21 16 21H5C3.9 21 3 20.1 3 19V8C3 6.9 3.9 6 5 6H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M15 3H21V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 14L21 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </template>

    <!-- Eye (preview) -->
    <template v-else-if="name === 'eye'">
      <path d="M2 12C2 12 6 5 12 5C18 5 22 12 22 12C22 12 18 19 12 19C6 19 2 12 2 12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.5"/>
    </template>

    <!-- Eye Off (no preview / binary) -->
    <template v-else-if="name === 'eye-off'">
      <path d="M17.94 17.94C15.69 19.27 13.19 19.77 10.64 19.03C8.09 18.29 5.83 16.41 4.5 13.87C3.95 12.7 3.95 11.3 4.5 10.13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9.9 4.24C10.59 4.08 11.29 4 12 4C18 4 22 12 22 12C21.39 13.29 20.63 14.46 19.74 15.47" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M14.12 14.12C13.56 14.68 12.8 15 12 15C10.34 15 9 13.66 9 12C9 11.2 9.32 10.44 9.88 9.88" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </template>

    <!-- File Text -->
    <template v-else-if="name === 'file-text'">
      <path d="M14 2H6C5.47 2 5 2.47 5 3V21C5 21.53 5.47 22 6 22H18C18.53 22 19 21.53 19 21V7L14 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 2V7H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="8" y1="17" x2="13" y2="17" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="8" y1="9" x2="10" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    </template>

    <!-- File Zip -->
    <template v-else-if="name === 'file-zip'">
      <path d="M14 2H6C5.47 2 5 2.47 5 3V21C5 21.53 5.47 22 6 22H18C18.53 22 19 21.53 19 21V7L14 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 2V7H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="8" y="10" width="8" height="2" rx="0.5" stroke="currentColor" stroke-width="1.2"/>
      <path d="M9 14L11 10H13L15 14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- Maximize -->
    <template v-else-if="name === 'maximize'">
      <path d="M15 3H21V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M21 3L14 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9 21H3V15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 21L10 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </template>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 18 },
})

// Dynamic viewBox per icon type
const viewBox = computed(() => {
  return '0 0 24 24'
})

const iconClass = computed(() => {
  return `app-icon app-icon-${props.name}`
})
</script>

<style scoped>
.app-icon {
  flex-shrink: 0;
  display: block;
  vertical-align: middle;
}
</style>
