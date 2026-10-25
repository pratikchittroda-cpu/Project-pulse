export const supportedIntegrationProviders = ["github"] as const;

export type IntegrationProvider =
  (typeof supportedIntegrationProviders)[number];

export * from "./github-delivery.js";
