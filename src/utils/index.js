export function debounce(fn, delay = 300) {
    let timer = null
    return function(...args) {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            fn.apply(this, args)
        }, delay)
    }
}

export function throttle(fn, delay = 300) {
    let lastTime = 0
    return function(...args) {
        const now = Date.now()
        if (now - lastTime >= delay) {
            lastTime = now
            fn.apply(this, args)
        }
    }
}

export function deepClone(obj, map = new WeakMap()) {
    if (obj === null || typeof obj !== 'object') {
        return obj
    }
    if (map.has(obj)) return map.get(obj)

    const result = Array.isArray(obj) ? [] : {}
    map.set(obj, result)

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            result[key] = deepClone(obj[key], map)
        }
    }

    return result
}
