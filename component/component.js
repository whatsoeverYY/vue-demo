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
function mountComponent(n1, n2, container) {
    const componentOptions = vnode.type
    let { data, render } = componentOptions
    const state = reactive(data())
    effect(() => {
        const subTree = render.call(state, state)
        patch(null, subTree, container)
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