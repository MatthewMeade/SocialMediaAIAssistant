import { useEffect, useRef } from 'react'
import { appEventBus } from '@/lib/event-bus'

/**
 * Hook to subscribe to application events.
 * Automatically unsubscribes when the component unmounts.
 * 
 * @param eventName The name of the event to listen for
 * @param handler The function to call when the event is dispatched
 * @param deps Optional dependency array (like useEffect) to recreate the subscription
 * 
 * @example
 * ```tsx
 * useAppEvent('apply-caption', (event) => {
 *   if (event.postId === editedPost.id) {
 *     setEditedPost({ ...editedPost, caption: event.caption })
 *   }
 * }, [editedPost.id])
 * ```
 */
export function useAppEvent<T = any>(
  eventName: string,
  handler: (detail: T) => void,
  deps?: React.DependencyList,
) {
  const handlerRef = useRef(handler)

  // Update the handler ref when it changes
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    // Create a stable wrapper that uses the latest handler
    const wrappedHandler = (detail: T) => {
      handlerRef.current(detail)
    }

    const unsubscribe = appEventBus.on(eventName, wrappedHandler)

    return unsubscribe
  }, [eventName, ...(deps || [])])
}

