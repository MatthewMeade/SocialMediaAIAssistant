type EventCallback<T = any> = (detail: T) => void

class AppEventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map()

  on<T = any>(eventName: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set())
    }
    this.listeners.get(eventName)!.add(callback)

    return () => {
      const callbacks = this.listeners.get(eventName)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.listeners.delete(eventName)
        }
      }
    }
  }

  dispatch<T = any>(eventName: string, detail: T): void {
    const callbacks = this.listeners.get(eventName)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(detail)
        } catch (error) {
          console.error(`Error in event handler for ${eventName}:`, error)
        }
      })
    }
  }

  off(eventName: string): void {
    this.listeners.delete(eventName)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const appEventBus = new AppEventBus()

