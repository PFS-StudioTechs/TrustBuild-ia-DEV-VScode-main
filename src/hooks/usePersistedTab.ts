import { useCallback, useState } from "react";

export function usePersistedTab(key: string, defaultValue: string) {
  const [tab, setTab] = useState<string>(() => {
    return sessionStorage.getItem(key) ?? defaultValue;
  });

  const handleChange = useCallback((value: string) => {
    sessionStorage.setItem(key, value);
    setTab(value);
  }, [key]);

  return [tab, handleChange] as const;
}
