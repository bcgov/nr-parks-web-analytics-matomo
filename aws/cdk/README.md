# Matomo AWS CDK Project

This project provisions a scalable, secure Matomo analytics platform on AWS
using the AWS Cloud Development Kit (CDK) in TypeScript.

## Stacks

- **VpcLookupStack**: Looks up or creates the required VPC and subnets for the
  environment.
- **MatomoDatabaseStack**: Provisions an RDS database for Matomo, including
  secrets management.
- **MatomoServiceStack**: Deploys Matomo on ECS Fargate with EFS, ALB, WAF, API
  Gateway, CloudWatch monitoring, and alerting.

## Features

- **Environment-based configuration**: Deploy to different stages (dev, prod,
  etc.) using context (`-c stage=prod`).
- **Secure networking**: Uses private subnets, security groups, and WAF for
  protection.
- **Scalable compute**: ECS Fargate auto-scales based on CPU/memory.
- **Persistent storage**: EFS for Matomo data/configs.
- **Monitoring & alerting**: CloudWatch dashboards and alarms, SNS email
  notifications.
- **API Gateway**: HTTP API Gateway with VPC Link to ALB.

## Prerequisites

- **AWS Credentials**: Configure your AWS credentials using `aws configure` or
  by setting the `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and
  `AWS_DEFAULT_REGION` environment variables. If you are using AWS LZA accounts,
  follow instructions in the
  [AWS SSO Profile Setup Guide](https://github.com/bcgov/quickstart-aws-helpers/blob/main/AWS-SSO-Profiles.md)
  to set these up
- **Node.js**: Node.js v18 or later is recommended.
- **AWS CDK**: Install AWS CDK globally if not already installed:

  ```sh
  npm install -g aws-cdk
  ```

- **CDK Version**: This project is tested with AWS CDK v2.x.

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

## Environment Configuration

Edit `lib/config/environment-config.ts` to define account, region, subnet IDs,
notification emails, and other settings per stage.

## Project Structure

- `bin/matomo-aws-cdk.ts`: Entry point for CDK app.
- `lib/`: CDK stack definitions and configuration.
- `test/`: Unit tests.

## Destroying Stacks

To delete all resources for a given stage:

```sh
npx cdk destroy -c stage=prod
```

## Troubleshooting

- **Bootstrap errors**: Ensure you have run the bootstrap command for your
  account/region.
- **Permission issues**: Make sure your AWS user/role has sufficient permissions
  for CDK operations.
- **Context caching**: If you see unexpected behavior, try deleting
  `cdk.context.json` and rerunning your command.
- **Stack deletion protection**: Some resources (like RDS/EFS) may be retained
  for safety. Review and delete manually if needed.

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

## Useful CDK Commands

- `npx cdk synth -c stage=prod` # Synthesize CloudFormation for prod
- `npx cdk deploy -c stage=prod` # Deploy prod stack
- `npx cdk diff -c stage=prod` # Diff prod stack

---

For more details, see the source files and comments.
