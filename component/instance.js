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
    const { data, render, beforeMount, mounted, beforeUpdate, updated } = componentOptions
    const state = reactive(data())
    
    const instance = {
        state,
        isMounted: false,
        subTree: null
    }
    
    vnode.component = instance
    
    effect(() => {
        const subTree = render.call(state, state)
        if (!instance.isMounted) {
            beforeMount && beforeMount.call(state)
            patch(null, subTree, container)
            instance.isMounted = true
            mounted && mounted.call(state)
        } else {
            beforeUpdate && beforeUpdate.call(state)
            patch(instance.subTree, subTree. container)
            updated && updated.call(state)
        }
        instance.subTree = subTree
    }, {
        scheduler: queueJob
    })
}

const MyComponent = {
    name: 'MyComponent',
    data() {
        return {
            foo : 1
        }
    },
    render() {
        return {
            type: 'div',
            children: `foo的值为${this.foo}`
        }
    }
}
const CompVNode = {
    type: MyComponent
}