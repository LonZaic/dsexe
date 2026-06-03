<template>
    <div ref="containerRef" class="virtual-list-container" @scroll="onScroll">
        <div :style="{ height: topSpacer + 'px' }"></div>
        <div
            v-for="item in renderItems"
            :key="getKey(item.data, item.index)"
            :data-index="item.index"
            class="virtual-list-item"
        >
            <slot name="item" :item="item.data" :index="item.index" />
        </div>
        <div :style="{ height: bottomSpacer + 'px' }"></div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const GAP = 10

const props = defineProps({
    items: {
        type: Array,
        required: true
    },
    estimatedHeight: {
        type: Number,
        default: 60
    },
    buffer: {
        type: Number,
        default: 5
    },
    keyField: {
        type: String,
        default: 'id'
    }
})

const containerRef = ref(null)
const scrollTop = ref(0)
const containerHeight = ref(0)
const heights = ref(new Map())
let resizeObserver = null

function getKey(data, index) {
    return data[props.keyField] ?? data.id ?? index
}

function h(index) {
    return heights.value.get(index) || props.estimatedHeight
}

function itemTop(index) {
    let top = 0
    for (let i = 0; i < index; i++) {
        top += h(i) + GAP
    }
    return top
}

const totalHeight = computed(() => {
    const len = props.items.length
    if (len === 0) return 0
    return itemTop(len)
})

const startIndex = computed(() => {
    const len = props.items.length
    if (len === 0) return -1
    const st = scrollTop.value
    let idx = 0
    for (let i = 0; i < len; i++) {
        if (st < itemTop(i) + h(i) + GAP) {
            idx = i
            break
        }
        idx = i + 1
    }
    return Math.max(0, Math.min(idx - props.buffer, len - 1))
})

const endIndex = computed(() => {
    const len = props.items.length
    if (len === 0) return -1
    const bottom = scrollTop.value + containerHeight.value
    let idx = len - 1
    for (let i = 0; i < len; i++) {
        if (itemTop(i) + h(i) > bottom) {
            idx = i
            break
        }
    }
    return Math.min(idx + props.buffer, len - 1)
})

const renderItems = computed(() => {
    if (props.items.length === 0) return []
    const start = startIndex.value
    const end = endIndex.value
    const result = []
    for (let i = start; i <= end; i++) {
        result.push({ data: props.items[i], index: i })
    }
    return result
})

const topSpacer = computed(() => itemTop(startIndex.value))

const bottomSpacer = computed(() => {
    return totalHeight.value - itemTop(endIndex.value + 1)
})

function onScroll() {
    if (containerRef.value) {
        scrollTop.value = containerRef.value.scrollTop
    }
}

function measureHeights() {
    if (!containerRef.value) return
    const nodes = containerRef.value.querySelectorAll('[data-index]')
    const newHeights = new Map(heights.value)
    nodes.forEach((el) => {
        const idx = parseInt(el.getAttribute('data-index'), 10)
        if (!isNaN(idx)) {
            newHeights.set(idx, el.offsetHeight)
        }
    })
    heights.value = newHeights
}

watch(renderItems, () => {
    nextTick(() => measureHeights())
}, { flush: 'post' })

function scrollToBottom() {
    nextTick(() => {
        if (containerRef.value) {
            containerRef.value.scrollTop = containerRef.value.scrollHeight
        }
    })
}

function isAtBottom(threshold = 50) {
    if (!containerRef.value) return true
    const el = containerRef.value
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

onMounted(() => {
    if (containerRef.value) {
        containerHeight.value = containerRef.value.clientHeight
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                containerHeight.value = entry.contentRect.height
            }
        })
        resizeObserver.observe(containerRef.value)
    }
})

onUnmounted(() => {
    if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = null
    }
})

defineExpose({ scrollToBottom, isAtBottom })
</script>

<style scoped>
.virtual-list-container {
    flex: 1;
    overflow-y: auto;
    padding: 12px 10px;
    min-height: 0;
}
.virtual-list-item {
    margin-bottom: 10px;
}
.virtual-list-item:last-child {
    margin-bottom: 0;
}
</style>
