function ref(val) {
    const wrapper = { value: val }
    Object.defineProperty(wrapper, '__v_isRef', { value: true })
    return reactive(wrapper)
}

function toRef(obj, key) {
    const wrapper = {
        get value() {
            return obj[key]
        }
    }
    Object.defineProperty(wrapper, '__v_isRef', { value: true })
    return wrapper
}

function toRefs(obj) {
    const res = {}
    for (var key in obj) {
        res[key] = toRef(obj, key)
    }
    return res
}

function proxyRefs(target) {
    return new Proxy(target, {
        get(target, key, receiver) {
            const value = Reflect.get(target, key, receiver)
            if (target[key].__v_isRef__) {
                return value.value
            }
            return value
        },
        set(target, key, newValue, receiver) {
            const value = target[key]
            if (value.__v_isRef__) {
                value.value = newValue
                return true
            }
            Reflect.set(target, key, newValue, receiver)
        }
    })
}