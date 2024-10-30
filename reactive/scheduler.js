const data = {
    foo: 1,
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
        fn()
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
    }
    effectFn.deps = [] // 用来存储所有与当前副作用函数相关的依赖集合(也就是下面的buckets Set)
    effectFn.options = options
    effectFn()
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

const jobQueue = new Set()
const p = Promise.resolve()

let isFlushing = false

function flushJob() {
    if (isFlushing) return
    isFlushing = true
    p.then(() => {
        jobQueue.forEach(job => job())
    }).finally(() => {
        isFlushing = false
    })
}

// 测试一
effect(() => {
    console.log(obj.foo)
}, {
    scheduler(fn) {
        jobQueue.add(fn)
        flushJob()
    }
})