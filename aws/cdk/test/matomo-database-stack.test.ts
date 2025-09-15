import { describe, it, expect, vi } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Template } from 'aws-cdk-lib/assertions';
import { MatomoDatabaseStack } from '../lib/matomo-database-stack';

// Mock the AWS SDK
vi.mock('@aws-sdk/client-rds', () => ({
  RDSClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({})
  }))
}));

describe('MatomoDatabaseStack', () => {
  it('should create an RDS instance with the correct configuration', () => {
    // Arrange
    const app = new cdk.App();
    
    // Create a test stack with a VPC
    const testStack = new cdk.Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-west-2',
      },
    });

    // Create a VPC with subnets and a security group
    const vpc = new ec2.Vpc(testStack, 'TestVpc', {
      subnetConfiguration: [
        {
          name: 'data',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Create a mock security group
    const securityGroup = new ec2.SecurityGroup(testStack, 'TestSecurityGroup', {
      vpc,
      securityGroupName: 'Data',
      description: 'Test security group for data',
    });

    // Get the data subnet IDs
    const dataSubnetIds = vpc.isolatedSubnets.map(subnet => subnet.subnetId);

    // Act - Create the database stack with the mock security group
    const stack = new MatomoDatabaseStack(testStack, 'TestDatabaseStack', {
      vpc,
      dataSubnetIds,
      rdsSecurityGroup: securityGroup,
      env: {
        account: '123456789012',
        region: 'us-west-2',
      },
    });

    // Assert
    const template = Template.fromStack(stack);
    
    // Verify RDS instance is created with correct properties
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      DBInstanceClass: 'db.t3.small',
      AllocatedStorage: '20',
      Engine: 'mysql',
      EngineVersion: '8.4.4',
      StorageEncrypted: true,
      DeletionProtection: false,
    });

    // Verify the RDS instance is created with the correct security group
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      VPCSecurityGroups: [
        {
          'Fn::ImportValue': 'TestStack:ExportsOutputFnGetAttTestSecurityGroup880B57C0GroupIdE8B1161D'
        }
      ]
    });
  });

  it('should throw an error if no data subnets are provided', () => {
    // Arrange
    const app = new cdk.App();
    
    // Create a test stack with a VPC
    const testStack = new cdk.Stack(app, 'TestStack2', {
      env: {
        account: '123456789012',
        region: 'us-west-2',
      },
    });

    const vpc = new ec2.Vpc(testStack, 'TestVpc');

    // Mock the security group lookup to throw an appropriate error
    const mockFromLookupByName = vi.spyOn(ec2.SecurityGroup, 'fromLookupByName');
    mockFromLookupByName.mockImplementation(() => {
      throw new Error('No data subnets provided');
    });

    // Act & Assert
    expect(() => {
      new MatomoDatabaseStack(testStack, 'TestDatabaseStack2', {
        vpc,
        dataSubnetIds: [], // Empty subnets should trigger an error
        env: {
          account: '123456789012',
          region: 'us-west-2',
        },
      });
    }).toThrow('No data subnets provided');
    
    // Clean up the mock
    mockFromLookupByName.mockRestore();
  });
});
