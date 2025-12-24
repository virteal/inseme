import React, { createContext, useContext, useState } from "react";

export const GlobalStatusContext = createContext({
  status: "idle", // e.g. 'idle', 'loading', 'error', 'success'
  setStatus: () => {},
  message: "",
  setMessage: () => {},
});

export function GlobalStatusProvider({ children }) {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const value = {
    status,
    setStatus,
    message,
    setMessage,
  };

  return <GlobalStatusContext.Provider value={value}>{children}</GlobalStatusContext.Provider>;
}

export function useGlobalStatus() {
  return useContext(GlobalStatusContext);
}
