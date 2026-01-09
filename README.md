# NR Parks Web Analytics - Matomo Deployment Infrastructure

This repository provides Infrastructure-as-Code (IaC) configurations for deploying Matomo Analytics across multiple cloud platforms including AWS, GCP, and OpenShift. It supports various IaC tools such as Terraform, AWS CDK, Helm, and Kustomize, enabling flexible, scalable, and secure deployments tailored to different environments.

## Project Status

Please Note: This repository is currently under development. As of now, only the implementation for AWS using CDK is complete and functional. The other platforms and tools described in this README represent the planned future state of the project.

Supported Platforms & Tools
AWS
Terraform: (Planned) Declarative provisioning of AWS resources.

AWS CDK: (Available) TypeScript-based infrastructure definitions.

GCP
Terraform: (Planned) Infrastructure provisioning for GCP.

Deployment Manager: (Planned) Native GCP IaC tool.

OpenShift
Helm: (Planned) Package manager for Kubernetes applications.

Kustomize: (Planned) Template-free customization of Kubernetes YAML.

## Folder Structure

The following represents the target folder structure for this project. Directories for planned IaC tools may not be present in the repository yet.

```shell
nr-parks-web-analytics-matomo/
├── aws/
│   ├── terraform/          # (Planned) AWS deployment using Terraform
│   └── cdk/                # AWS deployment using AWS CDK
├── gcp/
│   ├── terraform/          # (Planned) GCP deployment using Terraform
│   └── deployment-manager/ # (Planned) Optional GCP IaC
├── openshift/
│   ├── helm/               # (Planned) Helm charts for OpenShift
│   └── kustomize/          # (Planned) Kustomize configs
├── scripts/                # Common setup/teardown scripts
├── docs/                   # Architecture diagrams, setup guides
└── .github/
    └── workflows/          # CI/CD pipelines
```

## Getting Started

Currently, only deployment via AWS CDK is supported. The other examples are for future implementations.

### GitHub Actions Deployment Example

Sample GitHub Actions workflow to deploy the Matomo infrastructure using CDK can be found in the `.github/workflows` directory.

### Prerequisites

AWS CLI / GCP SDK / OpenShift CLI

Terraform CLI

Node.js & npm (for CDK)

Helm & Kustomize (for OpenShift)

Python (optional for scripting)

### Example: Deploying to AWS with CDK (Available)

```shell
cd aws/cdk
npm install
cdk synth
cdk deploy
```

### Example: Deploying to AWS with Terraform (Planned)

> This is not yet implemented

```shell
cd aws/terraform
terraform init
terraform plan
terraform apply
```

### Example: Deploying to OpenShift with Helm (Planned)

> This is not yet implemented

```shell
cd openshift/helm
helm install matomo ./matomo-chart
```

## Security & Configuration

HTTPS via ACM or cert-manager

IAM roles and policies (AWS)

Secrets managed via AWS Secrets Manager, GCP Secret Manager, or Kubernetes Secrets

Optional integrations: RDS, CloudFront, Route53, GCS, OpenShift Routes

## Contributing

Contributions are welcome! Please open issues or submit pull requests for improvements, bug fixes, or new features.

## Contact

For questions or support, please reach out via GitHub Issues or contact the maintainers.