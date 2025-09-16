# Matomo Analytics on AWS

This project provisions a production-ready Matomo analytics platform on AWS using the AWS Cloud Development Kit (CDK) in TypeScript. The infrastructure is designed to be secure, scalable, and cost-effective.

> **Note**: This is an internal BC Government project for web analytics.

## Stacks

- **VpcLookupStack**: Looks up or creates the required VPC and subnets for the
  environment.
- **MatomoDatabaseStack**: Provisions an RDS database for Matomo, including
  secrets management.
- **MatomoServiceStack**: Deploys Matomo on ECS Fargate with EFS, ALB, WAF, and API
  Gateway.
- **MatomoMonitoringStack**: Deploys CloudWatch monitoring and alerting for
  Matomo.

## Key Features

- **Multi-environment Support**: Deploy to different stages (dev, prod) using environment variables
- **High Availability**: Auto-scaling ECS Fargate tasks across multiple AZs
- **Secure by Default**:
  - Private subnets for all resources
  - Security groups with least-privilege access
  - AWS WAF protection
  - Encrypted data at rest and in transit
- **Scalable Architecture**:
  - Auto-scaling ECS Fargate tasks
  - Multi-AZ RDS MySQL database
  - Shared EFS storage for Matomo data
- **Monitoring & Operations**:
  - CloudWatch dashboards
  - SNS email notifications
  - Centralized logging
- **API Access**:
  - HTTP API Gateway with VPC Link
  - CORS support for web applications
  - Rate limiting and request validation

## Prerequisites

### AWS Account Setup

1. **AWS CLI Configuration**:

   ```sh
   aws configure
   ```

   Or set environment variables:

   ```sh
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_DEFAULT_REGION=ca-central-1
   ```

2. **For BCGov LZA Accounts**:
   Follow the [AWS SSO Profile Setup Guide](https://github.com/bcgov/quickstart-aws-helpers/blob/main/AWS-SSO-Profiles.md)

### Development Environment

- **Node.js**: v18 or later (LTS recommended)

- **AWS CDK**:

  ```sh
  npm install -g aws-cdk
  ```

- **Docker**: Required for local testing and asset building

### Required IAM Permissions

Ensure your IAM user/role has permissions for:
- CloudFormation
- IAM
- ECS
- RDS
- EFS
- API Gateway
- CloudWatch
- SNS
- WAFv2

## Usage

### Install dependencies

```sh
npm install
```

### Bootstrap the environment (required once per AWS account/region)

```sh
npx cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
```

Replace `<ACCOUNT_ID>` and `<REGION>` with your AWS account number and region
(e.g., `ca-central-1`).

### Build the project

```sh
npm run build
```

### Deploy to a specific stage (e.g., prod)

```sh
npx cdk deploy -c stage=prod
```

### View stack differences for a stage

```sh
npx cdk diff -c stage=prod
```

### Run unit tests

```sh
npm test
```

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```sh
# Required
STAGE=dev                        # Deployment stage (dev/stage/prod)
ENV_ID=dev-lza                   # Environment identifier
AWS_ACCOUNT=123456789012         # AWS account ID
AWS_REGION=ca-central-1          # AWS region

# Optional with defaults
NOTIFICATION_EMAILS=user@example.com  # For alerts
ALLOWED_ORIGINS=https://example.com   # Comma-separated CORS origins
```

### Variable Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `STAGE` | Yes | Deployment stage | `dev`, `prod` |
| `ENV_ID` | Yes | Environment identifier | `dev-lza` |
| `AWS_ACCOUNT` | Yes | AWS account ID | `123456789012` |
| `AWS_REGION` | Yes | AWS region | `ca-central-1` |
| `NOTIFICATION_EMAILS` | No | Comma-separated emails for alerts | `user@example.com` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins | `https://example.com` |

## Project Structure

```text
.
├── bin/
│   └── app.ts                  # CDK app entry point
├── lib/
│   ├── config/                 # Configuration files
│   │   └── environment-config.ts
│   ├── matomo-database-stack.ts # RDS database stack
│   ├── matomo-monitoring-stack.ts # CloudWatch monitoring stack
│   ├── matomo-service-stack.ts  # ECS, ALB, API Gateway stack
│   └── vpc-lookup-stack.ts     # VPC and networking
├── test/                       # Unit tests
└── cdk.json                   # CDK configuration
```

## Destroying Stacks

To delete all resources for a given stage:

```sh
npx cdk destroy -c stage=prod
```

## Troubleshooting

### Common Issues

1. **Bootstrap Errors**

   ```sh
   Error: This stack uses assets, so the toolkit stack must be deployed to the environment
   ```

   **Solution**: Run `npx cdk bootstrap aws://ACCOUNT/REGION`

2. **Permission Issues**

   ```sh
   API: iam:CreateRole User: ... is not authorized to perform: iam:CreateRole
   ```

   **Solution**: Ensure your IAM user has AdministratorAccess or equivalent permissions

3. **Context Caching**

   ```sh
   Error: No VPC found matching ...
   ```

   **Solution**: Delete `cdk.context.json` and redeploy

4. **Resource Deletion**

   Some resources (RDS, EFS) have deletion protection enabled by default.

   **Solution**: Disable protection before stack deletion or delete manually in the AWS Console.

## CDK Context Caching

CDK caches context lookups in `cdk.context.json`. If you change VPCs, subnets,
or other environment details, you may need to delete this file and rerun your
CDK commands:

```sh
rm cdk.context.json
```

- Make sure your AWS credentials are configured for the target account.
- EFS and RDS resources are set to retain on stack deletion for data safety.
- For production, review and adjust resource sizing, scaling, and security
  settings as needed.

## Deployment Guide

### First-Time Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Bootstrap your AWS account (once per account/region):

   ```sh
   npx cdk bootstrap aws://ACCOUNT/REGION
   ```

### Development Workflow

1. Make your changes

2. Run tests:

   ```sh
   npm test
   ```

3. Synthesize CloudFormation template:

   ```sh
   npx cdk synth
   ```

4. Deploy to development:

   ```sh
   npx cdk deploy
   ```

### Production Deployment

1. Update `.env` with production values

2. Deploy with explicit approval:

   ```sh
   npx cdk deploy --require-approval never
   ```

### Useful Commands

| Command | Description |
|---------|-------------|
| `cdk ls` | List all stacks |
| `cdk diff` | Compare deployed stack with current state |
| `cdk doctor` | Check your setup for potential issues |
| `cdk destroy` | Destroy a stack |

## Cleanup

To remove all resources:

```sh
npx cdk destroy
```

> **Note**: RDS and EFS volumes are retained by default to prevent accidental data loss. Delete them manually from the AWS Console if needed.

---

For more details, see the source files and comments.
