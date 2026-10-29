import * as React from "react";
import type { ToastProps } from "./toast";

const TOAST_LIMIT = 5;
const TOAST_DURATION = 5000;

type ToasterToast = ToastProps & {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "destructive";
};

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type State = {
  toasts: ToasterToast[];
};

type Action =
  | { type: "ADD"; toast: ToasterToast }
  | { type: "UPDATE"; toast: Partial<ToasterToast> }
  | { type: "DISMISS"; id?: string }
  | { type: "REMOVE"; id?: string };

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD":
      return { toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case "UPDATE":
      return {
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };
    case "DISMISS": {
      const { id } = action;
      if (id) {
        return { toasts: state.toasts.map((t) => (t.id === id ? { ...t, open: false } : t)) };
      }
      return { toasts: state.toasts.map((t) => ({ ...t, open: false })) };
    }
    case "REMOVE": {
      const { id } = action;
      if (id) {
        return { toasts: state.toasts.filter((t) => t.id !== id) };
      }
      return { toasts: [] };
    }
  }
}

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

export function toast({
  title,
  description,
  variant = "default",
  duration = TOAST_DURATION,
}: {
  title?: string;
  description?: string;
  variant?: "default" | "success" | "destructive";
  duration?: number;
}) {
  const id = genId();
  const update = (props: Partial<ToasterToast>) => dispatch({ type: "UPDATE", toast: { ...props, id } });
  const dismiss = () => dispatch({ type: "DISMISS", id });

  dispatch({
    type: "ADD",
    toast: {
      id,
      title,
      description,
      variant,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
      duration,
    },
  });

  return { id, dismiss, update };
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (id?: string) => dispatch({ type: "DISMISS", id }),
  };
}
