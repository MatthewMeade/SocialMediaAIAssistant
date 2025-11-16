/**
 * Global event bus for application-wide events.
 * Used for the "suggestion model" where the AI suggests changes
 * and components subscribe to receive and apply those suggestions.
 */

type EventCallback<T = any> = (detail: T) => void

class AppEventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map()

  /**
   * Subscribe to an event.
   * @param eventName The name of the event to listen for
   * @param callback The function to call when the event is dispatched
   * @returns A function to unsubscribe
   */
  on<T = any>(eventName: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set())
    }
    this.listeners.get(eventName)!.add(callback)

    // Return unsubscribe function
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

  /**
   * Dispatch an event to all subscribers.
   * @param eventName The name of the event
   * @param detail The data to pass to subscribers
   */
  dispatch<T = any>(eventName: string, detail: T): void {
    const callbacks = this.listeners.get(eventName)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(detail)
        } catch (error) {
          console.error(
            `[EVENT_BUS] Error in event handler for ${eventName}:`,
            error,
          )
        }
      })
    }
  }

  /**
   * Remove all listeners for an event.
   * @param eventName The name of the event
   */
  off(eventName: string): void {
    this.listeners.delete(eventName)
  }

  /**
   * Remove all listeners.
   */
  clear(): void {
    this.listeners.clear()
  }
}

// Singleton instance
export const appEventBus = new AppEventBus()

