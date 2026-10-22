export const supportedIntegrationProviders = ["github"] as const;

export type IntegrationProvider =
  (typeof supportedIntegrationProviders)[number];
