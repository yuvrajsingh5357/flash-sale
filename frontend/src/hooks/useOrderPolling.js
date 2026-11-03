import { useEffect, useRef, useCallback } from "react";

const BASE_URL = "http://localhost:8080";

/**
 * Polls /orders/{orderId} every 2s until a terminal status is reached.
 * Calls onResult(status) when done, onError() on fetch failure.
 */
export function useOrderPolling() {
  const intervalRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (orderId, onResult, onError) => {
      stopPolling();

      intervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${BASE_URL}/orders/${orderId}`);
          const data = await res.json();

          if (
            data.status === "SUCCESS" ||
            data.status === "FAILED" ||
            data.status === "NOT_FOUND"
          ) {
            stopPolling();
            onResult(data.status);
          }
          // PENDING → keep polling
        } catch {
          stopPolling();
          onError();
        }
      }, 2000);
    },
    [stopPolling],
  );

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  return { startPolling, stopPolling };
}
