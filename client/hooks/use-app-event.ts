import { useEffect, useRef } from 'react'
import { appEventBus } from '@/lib/event-bus'

export function useAppEvent<T = any>(
  eventName: string,
  handler: (detail: T) => void,
  deps?: React.DependencyList,
) {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    const wrappedHandler = (detail: T) => {
      handlerRef.current(detail)
    }

    const unsubscribe = appEventBus.on(eventName, wrappedHandler)

    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, ...(deps || [])])
}

