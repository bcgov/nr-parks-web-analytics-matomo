import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import * as efs from "aws-cdk-lib/aws-efs";
import { EnvironmentConfig } from "./config/environment-config";

interface MatomoServiceStackProps extends cdk.StackProps {
  vpc: IVpc;
  rdsEndpointAddress: string;
  rdsEndpointPort: string;
  rdsSecretName: string;
  appSubnetIds: string[];
  webSubnetIds: string[];
  appSecurityGroupId: string;
  webSecurityGroupId: string;
  envConfig: EnvironmentConfig;
}

export class MatomoServiceStack extends cdk.Stack {
  public readonly fargateService: ecs.FargateService;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  public readonly envConfig: EnvironmentConfig;

  constructor(scope: Construct, id: string, props: MatomoServiceStackProps) {
    super(scope, id, props);
    this.envConfig = props.envConfig;

    const vpc = props.vpc;

    const appSubnetIds = props.appSubnetIds.map((subnetId) =>
      ec2.Subnet.fromSubnetId(this, `AppSubnet-${subnetId}`, subnetId),
    );
    const webSubnetIds = props.webSubnetIds.map((subnetId) =>
      ec2.Subnet.fromSubnetId(this, `WebSubnet-${subnetId}`, subnetId),
    );

    const appSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      "ExistingAppSecurityGroup",
      props.appSecurityGroupId,
      { mutable: false },
    );

    const webSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      "ExistingWebSecurityGroup",
      props.webSecurityGroupId,
      { mutable: false },
    );

    const dbSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "MatomoDbSecret",
      props.rdsSecretName,
    );

    const cluster = new ecs.Cluster(this, "MatomoCluster", { vpc });

    // EFS File System for matomo configs
    const fileSystem = new efs.FileSystem(this, "MatomoFileSystem", {
      vpc,
      vpcSubnets: { subnets: appSubnetIds },
      securityGroup: appSecurityGroup,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      encrypted: true,
    });

    // EFS Access Point for Matomo data
    const accessPoint = fileSystem.addAccessPoint("MatomoAccessPoint", {
      posixUser: {
        gid: "0",
        uid: "0",
      },
      createAcl: {
        ownerGid: "0",
        ownerUid: "0",
        permissions: "775",
      },
    });

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "MatomoTaskDef",
      {
        memoryLimitMiB: 2048,
        cpu: 1024,
        volumes: [
          {
            name: "MatomoEfsVolume",
            efsVolumeConfiguration: {
              fileSystemId: fileSystem.fileSystemId,
              transitEncryption: "ENABLED",
              authorizationConfig: {
                accessPointId: accessPoint.accessPointId,
                iam: "ENABLED",
              },
            },
          },
        ],
      },
    );

    fileSystem.grantRootAccess(taskDefinition.taskRole);

    const matomoAdminSecret = new secretsmanager.Secret(
      this,
      "MatomoAdminSecret",
      {
        secretName: "MatomoAdminSecret",
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ username: "matomoadmin" }),
          generateStringKey: "password",
          excludePunctuation: true,
        },
      },
    );

    const container = taskDefinition.addContainer("MatomoContainer", {
      image: ecs.ContainerImage.fromRegistry(
        "public.ecr.aws/bitnami/matomo:latest",
      ),
      environment: {
        MARIADB_HOST: props.rdsEndpointAddress,
        MARIADB_PORT_NUMBER: props.rdsEndpointPort,
        MARIADB_DATABASE_NAME: "matomo",
        MATOMO_DATABASE_HOST: props.rdsEndpointAddress,
        MATOMO_DATABASE_PORT_NUMBER: props.rdsEndpointPort,
        MATOMO_DATABASE_NAME: "matomo",
        MATOMO_USERNAME: "matomoadmin",
      },
      secrets: {
        MATOMO_DATABASE_USER: ecs.Secret.fromSecretsManager(
          dbSecret,
          "username",
        ),
        MATOMO_DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(
          dbSecret,
          "password",
        ),
        MATOMO_PASSWORD: ecs.Secret.fromSecretsManager(
          matomoAdminSecret,
          "password",
        ),
      },
      portMappings: [{ containerPort: 8080 }], // Bitnami Matomo default port
      logging: ecs.LogDriver.awsLogs({ streamPrefix: "matomo-ecs" }),
      healthCheck: {
        command: [
          "CMD-SHELL",
          "curl -f http://localhost:8080/index.php || exit 1",
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addMountPoints({
      containerPath: "/bitnami/matomo",
      sourceVolume: "MatomoEfsVolume",
      readOnly: false,
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, "InternalMatomoAlb", {
      vpc,
      internetFacing: false,
      vpcSubnets: { subnets: webSubnetIds },
      securityGroup: webSecurityGroup,
    });

    const listener = alb.addListener("HttpListener", {
      port: 80,
      open: false,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    this.fargateService = new ecs.FargateService(this, "MatomoFargateService", {
      cluster,
      taskDefinition,
      desiredCount: 2,
      assignPublicIp: false,
      vpcSubnets: { subnets: appSubnetIds },
      securityGroups: [appSecurityGroup],
    });

    // Auto-scaling configuration - scale on cpu & memory utilization of 70%
    const scalableTaskCount = this.fargateService.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 4,
    });
    scalableTaskCount.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
    scalableTaskCount.scaleOnMemoryUtilization("MemoryScaling", {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    this.targetGroup = listener.addTargets("MatomoTarget", {
      port: 8080,
      targets: [this.fargateService],
      healthCheck: {
        path: "/index.php",
        interval: cdk.Duration.seconds(60),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
      },
    });

    const albWaf = new wafv2.CfnWebACL(this, "MatomoAlbWaf", {
      defaultAction: { allow: {} },
      scope: "REGIONAL",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "MatomoAlbWafMetric",
        sampledRequestsEnabled: true,
      },
      name: "MatomoAlbWebACL",
      rules: [
        {
          name: "RateLimit1000Requests5Minutes",
          priority: 2,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 1000,
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimitMetric",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    new wafv2.CfnWebACLAssociation(this, "MatomoAlbWafAssociation", {
      webAclArn: albWaf.attrArn,
      resourceArn: alb.loadBalancerArn,
    });

    // Create VPC Link for HttpApi
    const vpcLink = new apigwv2.VpcLink(this, "MatomoVpcLink", {
      vpc,
      subnets: { subnets: webSubnetIds },
      securityGroups: [webSecurityGroup],
    });

    // Create HTTP API Gateway with CORS configuration
    const httpApi = new apigwv2.HttpApi(this, "MatomoHttpApi", {
      apiName: "MatomoServiceApi",
      description: "HTTP API Gateway for Matomo Service",
      corsPreflight: {
        allowOrigins: props.envConfig.allowedOrigins,
        maxAge: cdk.Duration.days(1),
      },
    });

    // Set up API Gateway integration with the ALB via VPC Link
    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new integrations.HttpAlbIntegration(
        "MatomoHttpApiAlbIntegration",
        listener,
        {
          vpcLink,
        },
      ),
    });

    new cdk.CfnOutput(this, "MatomoHttpApiUrl", {
      description: "Matomo HTTP API URL",
      value: httpApi.apiEndpoint,
    });

    new cdk.CfnOutput(this, "InternalAlbDnsName", {
      description: "Internal ALB DNS Name (Accessible within VPC)",
      value: alb.loadBalancerDnsName,
    });
  }
}
