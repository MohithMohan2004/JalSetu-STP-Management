import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getJSON } from "./api";
import type { CurrentUser } from "./types";

const SessionCtx = createContext<CurrentUser | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    getJSON<CurrentUser>("/api/current_user")
      .then(setUser)
      .catch(() => setUser({ logged_in: false, name: "Guest", role: "", initials: "" }));
  }, []);
  return <SessionCtx.Provider value={user}>{children}</SessionCtx.Provider>;
}

export const useSession = () => useContext(SessionCtx);
