import { describe, it, expect, vi, beforeEach } from "vitest";
import * as cdk from "aws-cdk-lib";

// Hoisted mocks to ensure they are applied before importing the module under test
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

// Ensure any AWS SDK client that tries to resolve credentials gets a fake static credential
vi.mock("@aws-sdk/credential-provider-node", () => ({
  defaultProvider: () => async () => ({
    accessKeyId: "test",
    secretAccessKey: "test",
    sessionToken: "test",
  }),
}));

// Mock aws-cdk ec2 lookup so it doesn't attempt any real context or SDK calls
vi.mock("aws-cdk-lib/aws-ec2", async () => {
  const actual = await vi.importActual<any>("aws-cdk-lib/aws-ec2");
  return {
    ...actual,
    Vpc: {
      ...actual.Vpc,
      fromLookup: vi.fn(() => ({ vpcId: "vpc-12345" })),
    },
  };
});

// Now import the module under test after mocks are in place
import { VpcLookupStack } from "../lib/vpc-lookup-stack";
import { EnvironmentConfig } from "../lib/config/environment-config";
// Import real AWS SDK v3 classes and monkey-patch the client's send method
import {
  EC2Client as RealEC2Client,
  DescribeSubnetsCommand,
  DescribeSecurityGroupsCommand,
} from "@aws-sdk/client-ec2";

// Intercept all EC2Client.send calls at runtime
(RealEC2Client as any).prototype.send = function (command: any) {
  return mockSend(command);
};

const mockSubnets = {
  Subnets: [
    {
      SubnetId: "subnet-12345",
      VpcId: "vpc-12345",
      Tags: [{ Key: "Name", Value: "Test-App" }],
    },
    {
      SubnetId: "subnet-67890",
      VpcId: "vpc-12345",
      Tags: [{ Key: "Name", Value: "Test-Web" }],
    },
    {
      SubnetId: "subnet-abcde",
      VpcId: "vpc-12345",
      Tags: [{ Key: "Name", Value: "Test-Data" }],
    },
  ],
};

const mockSecurityGroups = {
  SecurityGroups: [
    {
      GroupId: "sg-12345",
      GroupName: "App",
      VpcId: "vpc-12345",
    },
    {
      GroupId: "sg-67890",
      GroupName: "Web",
      VpcId: "vpc-12345",
    },
    {
      GroupId: "sg-abcde",
      GroupName: "Data",
      VpcId: "vpc-12345",
    },
  ],
};

describe("VpcLookupStack", () => {
  let app: cdk.App;
  const envConfig: EnvironmentConfig = {
    account: "123456789012",
    region: "us-west-2",
    stageTagName: "Test",
    notificationEmails: ["test@example.com"],
    allowedOrigins: [],
  };

  beforeEach(() => {
    app = new cdk.App();
    mockSend.mockClear();
    // Ensure AWS SDK v3 never attempts to resolve real credentials in tests
    process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "test";
    process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "test";
    process.env.AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN || "test";
    process.env.AWS_REGION = process.env.AWS_REGION || "us-west-2";
    process.env.AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION || "us-west-2";
  });

  it("should look up an existing VPC", async () => {
    // Mock AWS SDK responses
    mockSend.mockImplementation((command) => {
      if (command.constructor.name === "DescribeSubnetsCommand") {
        return Promise.resolve(mockSubnets);
      }
      if (command.constructor.name === "DescribeSecurityGroupsCommand") {
        return Promise.resolve(mockSecurityGroups);
      }
      return Promise.resolve({});
    });

    // Act - Create the VPC lookup stack using the static create method
    const stack = await VpcLookupStack.create(app, "TestVpcLookupStack", {
      envConfig,
      env: {
        account: envConfig.account,
        region: envConfig.region,
      },
    });

    // Assert - Check if the VPC and related resources are properly set
    expect(stack.vpc).toBeDefined();
    expect(stack.vpc.vpcId).toBe("vpc-12345");
    expect(stack.appSubnetIds).toContain("subnet-12345");
    expect(stack.webSubnetIds).toContain("subnet-67890");
    expect(stack.dataSubnetIds).toContain("subnet-abcde");
    // Security groups are looked up by name, not tags
    expect(stack.appSecurityGroupId).toBe("sg-12345");
    expect(stack.webSecurityGroupId).toBe("sg-67890");
    expect(stack.dataSecurityGroupId).toBe("sg-abcde");
  });

  it("should handle errors during VPC lookup", async () => {
    // Mock a failing AWS SDK call
    mockSend.mockRejectedValueOnce(new Error("Failed to describe Subnets"));

    // Act & Assert
    await expect(
      VpcLookupStack.create(app, "TestVpcLookupStack2", {
        envConfig,
        env: {
          account: envConfig.account,
          region: envConfig.region,
        },
      }),
    ).rejects.toThrow("Failed to describe Subnets");
  });
});
