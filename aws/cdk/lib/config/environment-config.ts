export interface EnvironmentConfig {
  account: string;
  region: string;
  stageTagName: string;
  notificationEmails: string[];
  allowedOrigins: string[];
}