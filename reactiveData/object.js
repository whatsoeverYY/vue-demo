let activeEffect
const effectMap = new WeakMap() // 创建weakMap，以需要代理的对象作为key
const effectStack = []

// 执行副作用函数时，首先把它从所有关联的依赖集合中删除
// 接着副作用函数执行时，所有关联会重新收集依赖
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
const data = {
    foo: 1
}
const ITERATE_KEY = Symbol()
const TriggerType = {
    SET: 'SET',
    ADD: 'ADD',
    DELETE: 'DELETE'
}
const obj = new Proxy(data, {
    set(target, key, newValue, receiver) {
        const type = Object.prototype.hasOwnProperty.call(target, key) ? TriggerType.SET : TriggerType.ADD
        const res = Reflect.set(target, key, newValue, receiver)
        trigger(target, key, type)
        return res
    },
    deleteProperty(target, key) {
        const hasKey = Object.prototype.hasOwnProperty.call(target, key)
        const res = Reflect.deleteProperty(target, key)
        if (res && hasKey) {
            trigger(target, key, TriggerType.DELETE)
        }
        return res
    },
    get(target, key, receiver) {
        track(target, key)
        return Reflect.get(target, key, receiver)
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

effect(() => {
    console.log(obj.foo)
})

effect(() => {
    console.log('in', 'foo' in obj)
})

effect(() => {
    for (const objKey in obj) {
        console.log('key', objKey)
    }
})

obj.foo = 2
obj.bar = 'bar'

delete obj.foo


