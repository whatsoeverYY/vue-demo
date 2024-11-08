const queue = new Set()
let isFlushing = false
const p = new Promise.resolve()
function queueJob(job) {
    queue.add(job)
    if (!isFlushing) {
        isFlushing = true
        p.then(() => {
            try {
                queue.forEach(job => job())
            } finally {
                isFlushing = false
                queue.length = 0
            }
        })
    }
}

function mountComponent(vnode, container) {
    const componentOptions = vnode.type
    let { data, props: propsOption, setup, render, beforeMount, mounted, beforeUpdate, updated } = componentOptions
    const state = reactive(data())
    const [props, attrs] = resolveProps(propsOption, vnode.props)
    const slots = vnode.children || {}

    const instance = {
        state,
        props: shallowReactive(props),
        isMounted: false,
        subTree: null,
        slots,
    }
    function emit(event, ...payload) {
        const eventName = `on${event[0].toUpperCase()}${event.slice(1)}`
        const handler = instance.props[eventName]
        if (handler) {
            handler(...payload)
        } else {
            console.error('事件不存在')
        }
    }
    
    const setupContext = { attrs, emit, slots }
    const setupResult = setup(shallowReadonly(instance.props), setupContext)
    let setupState = null
    if (typeof setupResult === 'function') {
        if (render) console.error('setup函数返回渲染函数，render函数将被忽略')
        render = setupResult
    } else {
        setupState = setupResult
    }

    vnode.component = instance
    const renderContent = new Proxy(instance, {
        get(target, key, receiver) {
            const {state, props} = target
            if (key === 'slots') return slots
            if (state && key in state) {
                return state[key]
            } else if (key in props) {
                return props[key]
            } else if (key in setupState) {
                return setupState[key]
            } else {
                console.error('不存在')
            }
        },
        set(target, key, newValue, receiver) {
            const {state, props} = target
            if (state && key in state) {
                state[key] = newValue
            } else if (key in props) {
                props[key] = newValue
            } else if (key in setupState) {
                setupState[key] = newValue
            }  else {
                console.error('不存在')
            }
        }
    })

    effect(() => {
        const subTree = render.call(renderContent, renderContent)
        if (!instance.isMounted) {
            beforeMount && beforeMount.call(renderContent)
            patch(null, subTree, container)
            instance.isMounted = true
            mounted && mounted.call(renderContent)
        } else {
            beforeUpdate && beforeUpdate.call(renderContent)
            patch(instance.subTree, subTree. container)
            updated && updated.call(renderContent)
        }
        instance.subTree = subTree
    }, {
        scheduler: queueJob
    })
}

function resolveProps(options, propsData) {
    const props = {}
    const attrs = {}
    for (const key in propsData) {
        if (key in options) {
            props[key] = propsData[key]
        } else {
            attrs[key] = propsData[key]
        }
    }
    return [props, attrs]
}

const MyComponent = {
    name: 'MyComponent',
    props: {
      title: String  
    },
    setup(props, {emit}) {
      const foo = ref(1)
        emit('change', foo.value)
      return {
          foo
      }  
    },
    render() {
        return {
            type: 'div',
            children: [
                `foo的值为${this.foo}，title值为${this.title}`,
                {
                    type: 'div',
                    children: [this.slots.header()]
                }
            ]
        }
    }
}
function handler(number) {
    console.log('handler', number)
}
const CompVNode = {
    type: MyComponent,
    props: {
        title: 'content',
        onChange: handler
    },
    children: {
        header() {
            return {
                type: 'h1',
                children: 'I am header'
            }
        }
    }
}