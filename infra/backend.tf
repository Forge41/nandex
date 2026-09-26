# State lives in HCP Terraform because this AWS account cannot create an S3 bucket --
# `s3:CreateBucket` is denied by the organization's SCP. Local state cannot be locked,
# and state in git would publish every credential it holds.
#
# Configured by environment rather than literals, so the organization name is not
# baked into the repo:
#
#   export TF_CLOUD_ORGANIZATION=<org>
#   export TF_WORKSPACE=nandex-prod
terraform {
  cloud {}
}
