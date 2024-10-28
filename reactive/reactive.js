const data = {
    ok: true,
    content: 'content',
    text: 'one'
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

// 数据代理
const obj = new Proxy(data, {
    get(target, prop) {
        // console.log('get', prop)
        if (!activeEffect) return
        let targetMap = effectMap.get(target)
        if (!targetMap) {
            effectMap.set(target, (targetMap = new Map)) // 创建map，以对象属性作为key
        }
        let buckets = targetMap.get(prop)
        if (!buckets) {
            targetMap.set(prop, (buckets = new Set())) // 创建set，存储副作用函数
        }
        buckets.add(activeEffect)
        activeEffect.deps.push(buckets)
        return target[prop]
    },
    set(target, prop, newValue) {
        // console.log('set', prop)
        target[prop] = newValue
        const targetMap = effectMap.get(target)
        if (!targetMap) return
        const buckets = targetMap.get(prop)
        const bucketsToRun = new Set(buckets)
        bucketsToRun.forEach(fn => fn())
        return true
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

obj.text = 'two' // 内外层副作用函数均执行