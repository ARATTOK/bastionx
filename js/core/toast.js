document.addEventListener('alpine:init', () => {
  Alpine.store('toast', {
    items: [],
    add(type, message, duration = 3500) {
      const id = Date.now() + Math.random()
      this.items.push({ id, type, message })
      setTimeout(() => this.remove(id), duration)
    },
    success(msg) { this.add('success', msg) },
    error(msg)   { this.add('error', msg, 4500) },
    info(msg)    { this.add('info', msg) },
    remove(id)   { this.items = this.items.filter(i => i.id !== id) }
  })
})
