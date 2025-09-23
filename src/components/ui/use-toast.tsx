"use client"

import * as React from "react";

type Toast = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
};

type State = { toasts: Toast[] };

type Action =
  | { type: "ADD"; toast: Toast }
  | { type: "DISMISS"; id: string }
  | { type: "REMOVE"; id: string };

const StateContext = React.createContext<State | undefined>(undefined);
const DispatchContext = React.createContext<React.Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD":
      return { toasts: [...state.toasts, action.toast] };
    case "DISMISS":
      return state; // visuel simple; on retire directement via REMOVE
    case "REMOVE":
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, { toasts: [] });

  // expose dispatch globalement pour des appels statiques si besoin
  React.useEffect(() => {
    (window as any).__TOASTS__DISPATCH__ = dispatch;
  }, []);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useToast() {
  const state = React.useContext(StateContext);
  const dispatch = React.useContext(DispatchContext);
  if (!state || !dispatch) throw new Error("useToast must be used inside <ToastProvider>");

  function toast(input: { title?: React.ReactNode; description?: React.ReactNode }) {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: "ADD", toast: { id, ...input } });
    // auto-remove après 4s
    setTimeout(() => dispatch({ type: "REMOVE", id }), 4000);
    return { id };
  }

  function dismiss(id: string) {
    dispatch({ type: "DISMISS", id });
    dispatch({ type: "REMOVE", id });
  }

  return { toast, dismiss, toasts: state.toasts };
}
