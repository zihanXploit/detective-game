"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "displayName";

/** Remembers the player's name between visits. Purely a convenience; the server is the authority. */
export function useDisplayName() {
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setName(saved);
    } catch {
      // Storage can be blocked; the field just starts empty.
    }
  }, []);

  const remember = (value: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignore: nothing depends on this succeeding.
    }
  };

  return { name, setName, remember };
}
