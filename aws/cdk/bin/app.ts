#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { MatomoDatabaseStack } from "../lib/matomo-database-stack";
import { MatomoServiceStack } from "../lib/matomo-service-stack";
import { MatomoMonitoringStack } from "../lib/matomo-monitoring-stack";
import { VpcLookupStack } from "../lib/vpc-lookup-stack";
import { EnvironmentConfig } from "../lib/config/environment-config";

const app = new cdk.App();

// Get configuration from environment variables with defaults
const stage = process.env.STAGE || "dev";
const envId = process.env.ENV_ID || "dev-lza";
const awsAccount = process.env.AWS_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion =
  process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || "ca-central-1";

if (!awsAccount) {
  throw new Error(
    "AWS account must be provided via AWS_ACCOUNT environment variable or CDK_DEFAULT_ACCOUNT",
  );
}

const env = {
  account: awsAccount,
  region: awsRegion,
};

// Create environment config
const envConfig: EnvironmentConfig = {
  account: awsAccount,
  region: awsRegion,
  stageTagName: stage === "prod" ? "Prod" : "Dev",
  notificationEmails: process.env.NOTIFICATION_EMAILS
    ? process.env.NOTIFICATION_EMAILS.split(",")
    : [],
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : [],
};

export async function synthesizeCdkApp() {
  const stackPrefix = `matomo-${envId}`;

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

  // Create monitoring stack if needed
  if (process.env.ENABLE_MONITORING !== "false") {
    new MatomoMonitoringStack(app, `${stackPrefix}-monitoring`, {
      env,
      envConfig,
      fargateService: matomoServiceStack.fargateService,
      targetGroup: matomoServiceStack.targetGroup,
    });
  }

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
