import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "./auth-client.js";
import { useAuth } from "./auth-context.js";

export type OrganizationRole = "admin" | "member" | "owner" | "viewer";

export interface OrganizationSummary {
  id: string;
  name: string;
  role: OrganizationRole;
  slug: string;
}

interface OrganizationContextValue {
  error: string | null;
  isLoading: boolean;
  organizations: OrganizationSummary[];
  refreshOrganizations: () => Promise<void>;
  selectOrganization: (organizationId: string) => void;
  selectedOrganization: OrganizationSummary | undefined;
  selectedOrganizationId: string;
}

const STORAGE_KEY = "projectpulse.selected-organization";

const OrganizationContext = createContext<OrganizationContextValue | undefined>(
  undefined,
);

function storedOrganizationId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { session, status } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] =
    useState(storedOrganizationId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshOrganizations = useCallback(async () => {
    if (status !== "authenticated" || !session) {
      setOrganizations([]);
      setSelectedOrganizationId("");
      return;
    }

    setIsLoading(true);
    const { data, error: queryError } = await supabase
      .from("organization_memberships")
      .select("role, organization:organizations(id, name, slug)")
      .eq("user_id", session.user.id);
    setIsLoading(false);

    if (queryError) {
      setError(queryError.message);
      return;
    }

    const nextOrganizations = (data ?? []).flatMap((membership) => {
      const relatedOrganization = membership.organization as unknown;
      const organization = Array.isArray(relatedOrganization)
        ? (relatedOrganization[0] as
            | { id: string; name: string; slug: string }
            | undefined)
        : (relatedOrganization as {
            id: string;
            name: string;
            slug: string;
          } | null);
      return organization
        ? [
            {
              ...organization,
              role: membership.role as OrganizationRole,
            },
          ]
        : [];
    });
    setError(null);
    setOrganizations(nextOrganizations);
    setSelectedOrganizationId((current) => {
      const nextId = nextOrganizations.some(({ id }) => id === current)
        ? current
        : (nextOrganizations[0]?.id ?? "");
      if (typeof window !== "undefined") {
        if (nextId) {
          window.localStorage.setItem(STORAGE_KEY, nextId);
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      return nextId;
    });
  }, [session, status]);

  useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

  const selectOrganization = useCallback((organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, organizationId);
    }
  }, []);

  const selectedOrganization = organizations.find(
    ({ id }) => id === selectedOrganizationId,
  );
  const value = useMemo(
    () => ({
      error,
      isLoading,
      organizations,
      refreshOrganizations,
      selectOrganization,
      selectedOrganization,
      selectedOrganizationId,
    }),
    [
      error,
      isLoading,
      organizations,
      refreshOrganizations,
      selectOrganization,
      selectedOrganization,
      selectedOrganizationId,
    ],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);

  if (!context) {
    throw new Error(
      "useOrganization must be used inside an OrganizationProvider",
    );
  }

  return context;
}
