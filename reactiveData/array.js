let activeEffect
const effectMap = new WeakMap() // 创建weakMap，以需要代理的对象作为key
const effectStack = []
let shouldTrack = true

const arrayInstruments = {}

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
        // cleanUp(effectFn) // 多个副作用函数存在时，清理会出现问题
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
    if (!activeEffect || !shouldTrack) return
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

const trigger = (target, key, type, newValue) => {
    const targetMap = effectMap.get(target)
    if (!targetMap) return

    const effects = targetMap.get(key)
    const effectsToRun = new Set()
    
    // 如果是修改了对象的length值，就把所有大于length值的索引对应的副作用函数拿出来执行
    if (Array.isArray(target) && key === 'length') {
        targetMap.forEach((effects, index) => {
            if (index >= newValue) {
                effects.forEach(fn => {
                    if (fn !== activeEffect) {
                        effectsToRun.add(fn)
                    }
                })
            }
        })
    }
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
    if (type === TriggerType.ADD && Array.isArray(target)) {
        const lengthEffect = targetMap.get('length')
        lengthEffect && lengthEffect.forEach(fn => {
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

;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
    const originMethod = Array.prototype[method]
    arrayInstruments[method] = function (...arg) {
        shouldTrack = false
        const res = originMethod.apply(this, arg)
        shouldTrack = true
        return res
    }
})


function createReactive(obj, isShallow = false, isReadonly = false) {
    return new Proxy(obj, {
        get(target, key, receiver) {
            console.log('get')
            if (key === RAW) {
                return target // 支持用户用RAW来访问原始对象
            }
            if (Array.isArray(target) && arrayInstruments.hasOwnProperty(key)) {
                return Reflect.get(arrayInstruments, key, receiver)
            }
            if (!isReadonly && typeof key !== 'symbol') {
                track(target, key)
            }
            const res = Reflect.get(target, key, receiver)
            if (isShallow) {
                return res
            }
            if (typeof res === 'object' && res !== null) {
                return isReadonly ? readonly(res) : reactive(res)
            }
            return res
        },
        set(target, key, newValue, receiver) {
            console.log('set')
            if (isReadonly) {
                console.warn(`属性${key}是只读的`)
                return true
            }
            const oldValue = target[key]
            const type = Array.isArray(target)
                ? (Number(key) < target.length ? TriggerType.SET : TriggerType.ADD)
                : (Object.prototype.hasOwnProperty.call(target, key) ? TriggerType.SET : TriggerType.ADD)
            const res = Reflect.set(target, key, newValue, receiver)
            if (target === receiver[RAW]) { // 屏蔽由原型引起的更新
                if (oldValue !== newValue && (oldValue === oldValue || newValue === newValue)) {
                    trigger(target, key, type, newValue)
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
            if (Array.isArray(target)) {
                track(target, 'length')
            } else {
                track(target, ITERATE_KEY)
            }
            return Reflect.ownKeys(target)
        }
    })
}

function reactive(obj) {
    return createReactive(obj)
}

const arr = [1, 2, 3]

const obj = reactive(arr)

effect(() => {
    console.log('index', obj[0], obj[7])
})

effect(() => {
    console.log('length', obj.length)
})
effect(() => {
    for (const objKey in obj) {
        console.log('objKey', objKey)
    }
})
effect(() => {
    for (const objElement of obj) {
        console.log('objElement', objElement)
    }
})
// concat/join/every/some/find/findIndex/includes
effect(() => {
    console.log('concat', obj.concat([99]))
})
effect(() => {
    console.log('join', obj.join(','))
})
effect(() => {
    console.log('every', obj.every(ele => ele))
})
effect(() => {
    console.log('some', obj.some(ele => ele))
})
effect(() => {
    console.log('find', obj.find((ele) => ele === 1))
})
effect(() => {
    console.log('findIndex', obj.findIndex((ele) => ele === 2))
})
effect(() => {
    console.log('includes', obj.includes(1))
})

effect(() => {
    console.log('push1', obj.push(1))
})
effect(() => {
    console.log('push2', obj.push(1))
})

obj[0] = 0
obj[4] = 5
obj.length = 2