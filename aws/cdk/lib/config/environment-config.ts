export interface EnvironmentConfig {
  account: string;
  region: string;
  stageTagName: string;
  notificationEmails: string[];
  allowedOrigins: string[];
}

// in aws, resources in each environment are tagged with the environment name
export const STAGE_STAGE_TAG_NAME: Record<string, string> = {
  dev: "Dev",
  test: "Test",
  prod: "Prod",
};
