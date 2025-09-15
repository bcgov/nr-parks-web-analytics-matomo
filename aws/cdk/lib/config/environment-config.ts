export interface EnvironmentConfig {
  account: string;
  region: string;
  stageTagName: string;
  notificationEmails: string[];
}

interface Config {
  [key: string]: EnvironmentConfig;
}

const REGION = "ca-central-1";

export const config: Config = {
  dev: {
    stageTagName: "Dev",
    account: "1234567890",
    region: REGION,
    notificationEmails: [],
  },
  prod: {
    stageTagName: "Prod",
    account: "0987654321",
    region: REGION,
    notificationEmails: [],
  },
};

export function getEnvConfigForStage(stage: string): EnvironmentConfig {
  const envConfig = config[stage];
  if (!envConfig) {
    throw new Error(`No configuration found for stage: ${stage}`);
  }
  return envConfig;
}
