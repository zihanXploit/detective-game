"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Shared flow for "call the API, then land in the room": tracks which action is
 * pending, surfaces the error message, and navigates on success.
 */
export function useRoomEntry<Action extends string>() {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enter = async (action: Action, request: () => Promise<{ code: string }>) => {
    setPending(action);
    setError(null);
    try {
      const { code } = await request();
      router.push(`/room/${code}`);
      // Re-run the server component when we are already on that URL (the join prompt).
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(null);
    }
  };

  return { pending, error, enter };
}
