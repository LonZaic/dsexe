import { ref, watch } from 'vue'

export function useTheme() {
    const isDark = ref(false)

    isDark.value = localStorage.getItem('theme') === 'dark'

    document.documentElement.classList.toggle('dark', isDark.value)

    watch(isDark, (val) => {
        localStorage.setItem('theme', val ? 'dark' : 'light')
        document.documentElement.classList.toggle('dark', val)
    })

    function toggleTheme() {
        isDark.value = !isDark.value
    }

    return { isDark, toggleTheme }
}
