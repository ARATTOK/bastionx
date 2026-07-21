document.addEventListener('alpine:init', () => {
  Alpine.store('toast', {
    items: [],
    add(message, type = 'info', duration = 3500) {
      const id = Date.now() + Math.random()
      this.items.push({ id, message, type })
      setTimeout(() => {
        this.items = this.items.filter(t => t.id !== id)
      }, duration)
    },
    success(m) { this.add(m, 'success') },
    error(m) { this.add(m, 'error', 5000) },
    info(m) { this.add(m, 'info') }
  })
})
