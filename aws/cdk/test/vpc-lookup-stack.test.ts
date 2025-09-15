import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { VpcLookupStack } from '../lib/vpc-lookup-stack';


// Mock the AWS SDK
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-ec2', () => ({
  EC2Client: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  DescribeSubnetsCommand: vi.fn((args) => ({
    ...args,
    constructor: { name: 'DescribeSubnetsCommand' },
  })),
  DescribeSecurityGroupsCommand: vi.fn((args) => ({
    ...args,
    constructor: { name: 'DescribeSecurityGroupsCommand' },
  })),
  DescribeVpcsCommand: vi.fn((args) => ({
    ...args,
    constructor: { name: 'DescribeVpcsCommand' },
  })),
}));

// Test data
const mockVpc = {
  Vpcs: [{
    VpcId: 'vpc-12345678',
    Tags: [{ Key: 'Name', Value: 'Test' }]
  }]
};

const mockSubnets = {
  Subnets: [
    { 
      SubnetId: 'subnet-12345', 
      VpcId: 'vpc-12345678',
      Tags: [{ Key: 'Name', Value: 'Test-App' }]
    },
    { 
      SubnetId: 'subnet-67890', 
      VpcId: 'vpc-12345678',
      Tags: [{ Key: 'Name', Value: 'Test-Web' }]
    },
    { 
      SubnetId: 'subnet-abcde', 
      VpcId: 'vpc-12345678',
      Tags: [{ Key: 'Name', Value: 'Test-Data' }]
    }
  ]
};

const mockSecurityGroups = {
  SecurityGroups: [
    { 
      GroupId: 'sg-12345', 
      GroupName: 'App',
      VpcId: 'vpc-12345678'
    },
    { 
      GroupId: 'sg-67890', 
      GroupName: 'Web',
      VpcId: 'vpc-12345678'
    },
    { 
      GroupId: 'sg-abcde', 
      GroupName: 'Data',
      VpcId: 'vpc-12345678'
    }
  ]
};

describe('VpcLookupStack', () => {
  let app: cdk.App;
  const envConfig = {
    account: '123456789012',
    region: 'us-west-2',
    stageTagName: 'Test',
    notificationEmails: ['test@example.com'],
  };

  beforeEach(() => {
    app = new cdk.App();
    mockSend.mockClear();
  });

  it('should look up an existing VPC', async () => {
    // Mock AWS SDK responses
    mockSend.mockImplementation((command) => {
      if (command.constructor.name === 'DescribeVpcsCommand') {
        return Promise.resolve({
          Vpcs: [{
            VpcId: 'vpc-12345',
            Tags: [{ Key: 'Name', Value: 'Test' }]
          }]
        });
      }
      if (command.constructor.name === 'DescribeSubnetsCommand') {
        return Promise.resolve(mockSubnets);
      }
      if (command.constructor.name === 'DescribeSecurityGroupsCommand') {
        return Promise.resolve(mockSecurityGroups);
      }
      return Promise.resolve({});
    });

    // Act - Create the VPC lookup stack using the static create method
    const stack = await VpcLookupStack.create(app, 'TestVpcLookupStack', {
      envConfig,
      env: {
        account: envConfig.account,
        region: envConfig.region,
      },
    });

    // Assert - Check if the VPC and related resources are properly set
    expect(stack.vpc).toBeDefined();
    expect(stack.vpc.vpcId).toBe('vpc-12345');
    expect(stack.appSubnetIds).toContain('subnet-12345');
    expect(stack.webSubnetIds).toContain('subnet-67890');
    expect(stack.dataSubnetIds).toContain('subnet-abcde');
    // Security groups are looked up by name, not tags
    expect(stack.appSecurityGroupId).toBe('sg-12345');
    expect(stack.webSecurityGroupId).toBe('sg-67890');
    expect(stack.dataSecurityGroupId).toBe('sg-abcde');
  });

  it('should handle errors during VPC lookup', async () => {
    // Mock a failing AWS SDK call
    mockSend.mockRejectedValueOnce(new Error('Failed to describe VPCs'));

    // Act & Assert
    await expect(
      VpcLookupStack.create(app, 'TestVpcLookupStack2', {
        envConfig,
        env: {
          account: envConfig.account,
          region: envConfig.region,
        },
      })
    ).rejects.toThrow('Failed to describe VPCs');
  });
});
