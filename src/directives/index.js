export const vDebounce = {
    mounted(el, binding) {
        const delay = Number(binding.arg) || 300
        let timer = null

        el.addEventListener('input', () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                binding.value()
            }, delay)
        })
    }
}
