import * as cdk from "aws-cdk-lib";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import { EnvironmentConfig } from "./config/environment-config";

export interface MatomoMonitoringStackProps extends cdk.StackProps {
  fargateService: ecs.FargateService;
  targetGroup: elbv2.ApplicationTargetGroup;
  envConfig: EnvironmentConfig;
}

export class MatomoMonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MatomoMonitoringStackProps) {
    super(scope, id, props);

    const { fargateService, targetGroup, envConfig } = props;

    // Create SNS Topic for alerts
    const alertTopic = new sns.Topic(this, "MatomoAlertTopic", {
      displayName: "Matomo Service Alerts",
    });

    // Subscribe emails to the alert topic
    envConfig.notificationEmails.forEach((email) => {
      alertTopic.addSubscription(new subscriptions.EmailSubscription(email));
    });

    // CPU Utilization Alarm - 2/3 datapoints breaching 85% over 3 mins
    const cpuAlarm = new cloudwatch.Alarm(this, "MatomoCpuAlarm", {
      metric: fargateService.metricCpuUtilization({
        period: cdk.Duration.minutes(1),
      }),
      threshold: 85,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "CPU utilization is too high",
    });
    cpuAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(alertTopic),
    );

    // Memory Utilization Alarm - 2/3 datapoints breaching 85% over 3 mins
    const memoryAlarm = new cloudwatch.Alarm(this, "MatomoMemoryAlarm", {
      metric: fargateService.metricMemoryUtilization({
        period: cdk.Duration.minutes(1),
      }),
      threshold: 85,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: "Memory utilization is too high",
    });
    memoryAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(alertTopic),
    );

    // Service Health Alarm (based on unhealthy hosts) - 2/2 datapoints breaching 1 over 2 mins
    const unhealthyHostsAlarm = new cloudwatch.Alarm(
      this,
      "UnhealthyHostsAlarm",
      {
        metric: targetGroup.metrics.unhealthyHostCount({
          period: cdk.Duration.minutes(2),
        }),
        threshold: 1,
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: "There are unhealthy hosts in the target group",
      },
    );
    unhealthyHostsAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(alertTopic),
    );

    // CloudWatch Dashboard for Matomo service
    const dashboard = new cloudwatch.Dashboard(this, "MatomoDashboard", {
      dashboardName: "Matomo-Service-Metrics",
    });

    // Add metrics to the dashboard
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "CPU and Memory Utilization",
        left: [fargateService.metricCpuUtilization()],
        right: [fargateService.metricMemoryUtilization()],
        leftAnnotations: [
          {
            value: 85,
            label: "CPU Alert (>85%, 2/3 points over 3m)",
            color: "#ff6961",
          },
        ],
        rightAnnotations: [
          {
            value: 85,
            label: "Memory Alert (>85%, 2/3 points over 3m)",
            color: "#ff6961",
          },
        ],
      }),
      new cloudwatch.GraphWidget({
        title: "Request Count and Target Response Time",
        left: [targetGroup.metrics.requestCount()],
        right: [targetGroup.metrics.targetResponseTime()],
      }),
      new cloudwatch.GraphWidget({
        title: "Healthy/Unhealthy Hosts",
        left: [
          targetGroup.metrics.healthyHostCount(),
          targetGroup.metrics.unhealthyHostCount(),
        ],
        leftAnnotations: [
          {
            value: 1,
            label: "Unhealthy Hosts Alert (≥1, 2/2 points over 2m)",
            color: "#ff6961",
          },
        ],
      }),
    );
  }
}
