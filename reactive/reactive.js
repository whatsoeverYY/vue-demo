const data = {
    ok: true,
    content: 'content',
    text: 'one',
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
function effect(fn) {
    const effectFn = () => {
        cleanUp(effectFn)
        activeEffect = effectFn
        effectStack.push(effectFn)
        fn()
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
    }
    effectFn.deps = [] // 用来存储所有与当前副作用函数相关的依赖集合(也就是下面的buckets Set)
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
    const bucketsToRun = new Set(buckets)
    bucketsToRun.forEach(fn => {
        if (fn !== activeEffect) {
            fn()
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

// 测试一
effect(() => {
    console.log('do the effect')
    document.body.innerText = obj.ok ? obj.text : 'zero'
})

effect(() => {
    console.log('another', obj.ok)
})
obj.ok = false // 界面展示变为zero
obj.text = 'three' // 不会触发副作用函数执行

// 测试二
effect(() => {
    console.log('effect 1')

    effect(() => {
        console.log('effect 2', obj.content)
        document.body.innerText = obj.content
    })

    console.log('obj.text', obj.text)
})

// 测试三
effect(() => {
    console.log('obj', obj.foo)
    obj.foo++
})

obj.text = 'two' // 内外层副作用函数均执行