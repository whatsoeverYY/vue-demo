let activeEffect
const effectMap = new WeakMap() // 创建weakMap，以需要代理的对象作为key
const effectStack = []

function cleanUp(fn) {
    const deps = fn.deps
    for (let i = 0; i < deps.length; i++) {
        const dep = deps[i]
        dep.delete(fn)
    }
    fn.deps.length = 0
}

//副作用注册函数
function effect(fn, options = {}) {
    const effectFn = () => {
        cleanUp(effectFn)
        activeEffect = effectFn
        effectStack.push(effectFn)
        const res = fn()
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
        return res
    }
    effectFn.deps = [] // 用来存储所有与当前副作用函数相关的依赖集合(也就是下面的buckets Set)
    effectFn.options = options
    if (!options.lazy) {
        effectFn()
    }
    return effectFn
}

const track = (target, key) => {
    if (!activeEffect) return
    let targetMap = effectMap.get(target)
    if (!targetMap) {
        effectMap.set(target, (targetMap = new Map)) // 创建map，以对象属性作为key
    }
    let buckets = targetMap.get(key)
    if (!buckets) {
        targetMap.set(key, (buckets = new Set())) // 创建set，存储副作用函数
    }
    buckets.add(activeEffect)
    activeEffect.deps.push(buckets)
}

const trigger = (target, key, type) => {
    const targetMap = effectMap.get(target)
    if (!targetMap) return
    const effects = targetMap.get(key)
    const effectsToRun = new Set()
    effects && effects.forEach(fn => {
        if (fn !== activeEffect) {
            effectsToRun.add(fn)
        }
    })
    if (type === TriggerType.DELETE || type === TriggerType.ADD) {
        const iterateEffect = targetMap.get(ITERATE_KEY)
        iterateEffect && iterateEffect.forEach(fn => {
            if (fn !== activeEffect) {
                effectsToRun.add(fn)
            }
        })
    }
    effectsToRun.forEach(effectFn => {
        if (effectFn.options.scheduler) {
            effectFn.options.scheduler(effectFn)
        } else {
            effectFn()
        }
    })
}
const ITERATE_KEY = Symbol()
const TriggerType = {
    SET: 'SET',
    ADD: 'ADD',
    DELETE: 'DELETE'
}
const RAW = Symbol()
function createReactive(obj, isShallow = false, isReadonly = false) {
    return new Proxy(obj, {
        get(target, key, receiver) {
            if (key === RAW) {
                return target // 支持用户用RAW来访问原始对象
            }
            if (!isReadonly) {
                track(target, key)
            }
            const res = Reflect.get(target, key, receiver)
            if (isShallow) {
                return res
            }
            if (typeof res === 'object' && res !== null) {
                return isReadonly ? readonly(res): reactive(res)
            } 
            return res
        },
        set(target, key, newValue, receiver) {
            if (isReadonly) {
                console.warn(`属性${key}是只读的`)
                return true
            }
            const oldValue = target[key]
            const type = Object.prototype.hasOwnProperty.call(target, key) ? TriggerType.SET : TriggerType.ADD
            const res = Reflect.set(target, key, newValue, receiver)
            if (target === receiver[RAW]) { // 屏蔽由原型引起的更新
                if (oldValue !== newValue && (oldValue === oldValue || newValue === newValue)) {
                    trigger(target, key, type)
                }
            }
            return res
        },
        deleteProperty(target, key) {
            if (isReadonly) {
                console.warn(`属性${key}是只读的`)
                return true
            }
            const hasKey = Object.prototype.hasOwnProperty.call(target, key)
            const res = Reflect.deleteProperty(target, key)
            if (res && hasKey) {
                trigger(target, key, TriggerType.DELETE)
            }
            return res
        },
        has(target, key) {
            track(target, key)
            return Reflect.has(target, key)
        },
        ownKeys(target) {
            track(target, ITERATE_KEY)
            return Reflect.ownKeys(target)
        }
    })
}

function reactive(obj) {
    return createReactive(obj)
}

function shallowReactive(obj) {
    return createReactive(obj, true)
}

function readonly(obj) {
    return createReactive(obj, false, true)
}

function shallowReadonly(obj) {
    return createReactive(obj, true, true)
}

const data = {
    one: {
        name: 'ever'
    }
}

const obj = reactive(data)

effect(() => {
    console.log(obj.one.name)
})