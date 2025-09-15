import { describe, it } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { MatomoServiceStack } from '../lib/matomo-service-stack';
import { EnvironmentConfig } from '../lib/config/environment-config';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

describe('MatomoServiceStack', () => {
  it('should create a Fargate service', () => {
    // Arrange
    const app = new cdk.App();
    const envConfig: EnvironmentConfig = {
      account: '123456789012',
      region: 'us-west-2',
      stageTagName: 'Test',
      notificationEmails: ['test@example.com'],
    };

    // Create a test stack that will contain our test resources
    const testStack = new cdk.Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-west-2',
      },
    });
    
    // Create a VPC for testing within the same stack
    const vpc = new ec2.Vpc(testStack, 'TestVpc', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'app',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'web',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });
    
    // Get the subnet IDs
    const appSubnetIds = vpc.privateSubnets.map(subnet => subnet.subnetId);
    const webSubnetIds = vpc.publicSubnets.map(subnet => subnet.subnetId);

    // Create a security group for testing
    const testSecurityGroup = new ec2.SecurityGroup(testStack, 'TestSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });

    // Act - Create the Matomo service stack
    const stack = new MatomoServiceStack(testStack, 'MatomoTestStack', {
      vpc,
      rdsEndpointAddress: 'test-db.123456789012.us-west-2.rds.amazonaws.com',
      rdsEndpointPort: '5432',
      rdsSecretName: 'test-db-secret',
      appSubnetIds: appSubnetIds.length >= 2 ? [appSubnetIds[0]] : ['subnet-12345'],
      webSubnetIds: webSubnetIds.length >= 2 ? [webSubnetIds[0]] : ['subnet-67890'],
      appSecurityGroupId: testSecurityGroup.securityGroupId,
      webSecurityGroupId: testSecurityGroup.securityGroupId,
      envConfig,
      env: {
        account: envConfig.account,
        region: envConfig.region,
      },
    });

    // Assert - Check if the stack synthesizes without errors
    const template = Template.fromStack(stack);
    
    // Verify the Fargate service is created
    template.resourceCountIs('AWS::ECS::Service', 1);
    
    // Verify the ALB is created
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
  });
});
