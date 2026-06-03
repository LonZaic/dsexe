<template>
    <select class="model-select" :value="model" @change="$emit('update:model', $event.target.value)">
        <option value="deepseek-v4-flash">V4 Flash</option>
        <option value="deepseek-v4-pro">V4 Pro</option>
    </select>
</template>

<script setup>
defineProps({
    model: {
        type: String,
        required: true
    }
})
defineEmits(['update:model'])
</script>

<style scoped>
    .model-select {
        margin-left: auto;
        border: 2px solid var(--border);
        padding: 6px 10px;
        font-size: 13px;
        background: var(--bg);
        color: var(--text);
        cursor: pointer;
        outline: none;
        font-weight: 600;
        transition: border-color 0.2s, background 0.2s, color 0.2s;
    }
    .model-select:focus {
        border-color: var(--primary);
    }
</style>
