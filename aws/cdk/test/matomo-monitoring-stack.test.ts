import { describe, it, expect, vi } from "vitest";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Template } from "aws-cdk-lib/assertions";
import { MatomoMonitoringStack } from "../lib/matomo-monitoring-stack";

// Mock the AWS SDK
vi.mock("@aws-sdk/client-cloudwatch", () => ({
  CloudWatchClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
}));

describe("MatomoMonitoringStack", () => {
  it("should create CloudWatch alarms and SNS topic for notifications", () => {
    // Arrange
    const app = new cdk.App();

    // Create a test stack
    const testStack = new cdk.Stack(app, "TestStack", {
      env: {
        account: "123456789012",
        region: "us-west-2",
      },
    });

    // Create a VPC for testing
    const vpc = new ec2.Vpc(testStack, "TestVpc");

    // Create a load balancer and target group
    const loadBalancer = new elbv2.ApplicationLoadBalancer(
      testStack,
      "TestLoadBalancer",
      {
        vpc,
        internetFacing: true,
      },
    );

    const targetGroup = new elbv2.ApplicationTargetGroup(
      testStack,
      "TestTargetGroup",
      {
        vpc,
        port: 80,
        targetType: elbv2.TargetType.IP,
      },
    );

    // Add a listener to the load balancer that forwards to the target group
    loadBalancer.addListener("TestListener", {
      port: 80,
      defaultAction: elbv2.ListenerAction.forward([targetGroup]),
    });

    // Create a Fargate service for testing
    const cluster = new ecs.Cluster(testStack, "TestCluster", { vpc });
    const taskDefinition = new ecs.FargateTaskDefinition(
      testStack,
      "TestTaskDef",
      {
        memoryLimitMiB: 512,
        cpu: 256,
      },
    );

    const container = taskDefinition.addContainer("TestContainer", {
      image: ecs.ContainerImage.fromRegistry("nginx:latest"),
    });

    container.addPortMappings({
      containerPort: 80,
    });

    const fargateService = new ecs.FargateService(testStack, "TestService", {
      cluster,
      taskDefinition,
    });

    // Act - Create the monitoring stack
    const stack = new MatomoMonitoringStack(testStack, "TestMonitoringStack", {
      fargateService,
      targetGroup,
      envConfig: {
        account: "123456789012",
        region: "us-west-2",
        stageTagName: "Test",
        notificationEmails: ["test@example.com"],
        allowedOrigins: ["https://example.com"],
      },
      env: {
        account: "123456789012",
        region: "us-west-2",
      },
    });

    // Assert
    const template = Template.fromStack(stack);

    // Verify CPU Alarm
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      Namespace: "AWS/ECS",
      MetricName: "CPUUtilization",
      Threshold: 85,
      ComparisonOperator: "GreaterThanThreshold",
      EvaluationPeriods: 3,
      Period: 60,
      Statistic: "Average",
      DatapointsToAlarm: 2,
    });

    // Verify Memory Alarm
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      Namespace: "AWS/ECS",
      MetricName: "MemoryUtilization",
      Threshold: 85,
      ComparisonOperator: "GreaterThanThreshold",
      EvaluationPeriods: 3,
      Period: 60,
      Statistic: "Average",
      DatapointsToAlarm: 2,
    });

    // Verify Unhealthy Hosts Alarm
    template.hasResourceProperties("AWS::CloudWatch::Alarm", {
      Namespace: "AWS/ApplicationELB",
      MetricName: "UnHealthyHostCount",
      Threshold: 1,
      ComparisonOperator: "GreaterThanOrEqualToThreshold",
      EvaluationPeriods: 2,
      Period: 120,
      Statistic: "Average",
      DatapointsToAlarm: 2,
    });

    // Verify SNS topic is created
    template.hasResourceProperties("AWS::SNS::Topic", {
      DisplayName: "Matomo Service Alerts",
    });
  });
});
