const data = {
    count: 1,
}
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

const trigger = (target, key) => {
    const targetMap = effectMap.get(target)
    if (!targetMap) return
    const buckets = targetMap.get(key)
    const bucketsToRun = new Set()
    buckets && buckets.forEach(fn => {
        if (fn !== activeEffect) {
            bucketsToRun.add(fn)
        }
    })
    bucketsToRun.forEach(effectFn => {
        if (effectFn.options.scheduler) {
            effectFn.options.scheduler(effectFn)
        } else {
            effectFn()
        }
    })
}

// 数据代理
const obj = new Proxy(data, {
    get(target, key) {
        track(target, key)
        return target[key]
    },
    set(target, key, newValue) {
        target[key] = newValue
        trigger(target, key)
    },
})
function traverse(value, seen = new Set()) {
    if (typeof value !== 'object' || value === null || seen.has(value)) return
    seen.add(value)
    for (const key in value) {
        traverse(value[key], seen)
    }
    return value
}
function watch(source, cb, options = {}) {
    let getter, oldValue, newValue
    if (typeof source === 'function') {
        getter = source
    } else {
        getter = () => traverse(source) // 读取响应式数据data中的所有属性
    }
    const job = () => {
        newValue = effectFn()
        cb(oldValue, newValue)
        oldValue = newValue
    }
    const effectFn = effect(
        () => getter(), 
        {
        lazy: true,
        scheduler() {
            if (options.flush === 'post') {
                const p = Promise.resolve()
                p.then(job)
            } else {
                job()
            }
        }
    })
    if (options.immediate) {
        job()
    } else {
        oldValue = effectFn()
    }
}

// 存在问题，新旧数据一致，因为是对同一个对象的引用
watch(obj, (newValue, oldValue) => {
    console.log('data changed', newValue, oldValue)
})

watch(() => obj.count, (newValue, oldValue) => {
    console.log('obj.count changed', newValue, oldValue)
}, {immediate: true})
watch(() => obj.count, (newValue, oldValue) => {
    console.log('obj.count changed', newValue, oldValue)
}, {flush: 'post'})

obj.count++