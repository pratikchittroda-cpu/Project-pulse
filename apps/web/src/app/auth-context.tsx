import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AuthStatus = "loading" | "authenticated" | "signed_out";

interface AuthContextValue {
  signIn: () => void;
  signOut: () => void;
  status: AuthStatus;
}

interface AuthProviderProps {
  children: ReactNode;
  initialStatus?: AuthStatus;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
  initialStatus = "authenticated",
}: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>(initialStatus);
  const signIn = useCallback(() => setStatus("authenticated"), []);
  const signOut = useCallback(() => setStatus("signed_out"), []);
  const value = useMemo(
    () => ({ signIn, signOut, status }),
    [signIn, signOut, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}
