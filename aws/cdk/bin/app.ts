#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { MatomoDatabaseStack } from "../lib/matomo-database-stack";
import { MatomoServiceStack } from "../lib/matomo-service-stack";
import { MatomoMonitoringStack } from "../lib/matomo-monitoring-stack";
import { VpcLookupStack } from "../lib/vpc-lookup-stack";
import {
  EnvironmentConfig,
  STAGE_STAGE_TAG_NAME,
} from "../lib/config/environment-config";

const app = new cdk.App();

// Get configuration from environment variables with defaults
const stage = process.env.MATOMO_STAGE || "dev";
const envId = process.env.MATOMO_ENV_ID || "dev-lza";
const awsAccount = process.env.MATOMO_AWS_ACCOUNT;
const awsRegion = process.env.MATOMO_AWS_REGION || "ca-central-1";

if (!awsAccount) {
  throw new Error(
    "AWS account must be provided via AWS_ACCOUNT environment variable or CDK_DEFAULT_ACCOUNT",
  );
}

const stageTagName = STAGE_STAGE_TAG_NAME[stage];
if (!stageTagName) {
  throw new Error(`Invalid stage: ${stage}`);
}

const notificationEmails = process.env.MATOMO_NOTIFICATION_EMAILS
  ? process.env.MATOMO_NOTIFICATION_EMAILS!.split(",")
  : [];

const allowedOrigins = process.env.MATOMO_ALLOWED_ORIGINS
  ? process.env.MATOMO_ALLOWED_ORIGINS!.split(",")
  : [];

// Create environment config
const envConfig: EnvironmentConfig = {
  account: awsAccount,
  region: awsRegion,
  stageTagName,
  notificationEmails,
  allowedOrigins,
};

export async function synthesizeCdkApp() {
  const stackPrefix = `matomo-${envId}`;


const env: cdk.Environment = {
  account: awsAccount,
  region: awsRegion,
};

  // Create VPC stack
  const vpcStack = await VpcLookupStack.create(app, `${stackPrefix}-vpc`, {
    env,
    envConfig,
  });

  // Create RDS stack
  const rdsStack = new MatomoDatabaseStack(app, `${stackPrefix}-rds`, {
    vpc: vpcStack.vpc,
    dataSubnetIds: vpcStack.dataSubnetIds,
    env,
  });

  // Create Matomo service stack
  const matomoServiceStack = new MatomoServiceStack(
    app,
    `${stackPrefix}-service`,
    {
      vpc: vpcStack.vpc,
      appSubnetIds: vpcStack.appSubnetIds,
      webSubnetIds: vpcStack.webSubnetIds,
      appSecurityGroupId: vpcStack.appSecurityGroupId,
      webSecurityGroupId: vpcStack.webSecurityGroupId,
      rdsEndpointAddress: rdsStack.dbInstance.dbInstanceEndpointAddress,
      rdsEndpointPort: rdsStack.dbInstance.dbInstanceEndpointPort,
      rdsSecretName: rdsStack.dbSecret.secretName,
      env,
      envConfig,
    },
  );

  // Create monitoring stack
  new MatomoMonitoringStack(app, `${stackPrefix}-monitoring`, {
    env,
    envConfig,
    fargateService: matomoServiceStack.fargateService,
    targetGroup: matomoServiceStack.targetGroup,
  });

  // Set dependencies
  matomoServiceStack.addDependency(rdsStack);

  // Add tags to all stacks
  const tags = {
    Environment: `${envId}`,
    Stage: stage,
    Project: "Matomo",
    ManagedBy: "CDK",
  };

  Object.entries(tags).forEach(([key, value]) => {
    cdk.Tags.of(app).add(key, value);
  });

  app.synth();
}

// Execute the app
synthesizeCdkApp().catch((error) => {
  console.error("Error synthesizing CDK app:", error);
  process.exit(1);
});
