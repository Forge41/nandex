# Every provider reads its credential from the environment. Nothing authenticates from
# a file in this repo, and no key reaches Terraform state by way of a variable default.
#
#   RENDER_API_KEY   render dashboard -> account settings -> API keys
#   NETLIFY_API_TOKEN    netlify user settings -> applications -> personal access tokens

provider "render" {
  owner_id = var.render_owner_id
}

provider "netlify" {}

# Pinned to the profile and the region rather than inherited: ap-southeast-2 is the only
# region the organization's SCP permits, and an apply must not reach whichever account
# happens to be in the caller's environment.
provider "aws" {
  profile = var.aws_profile
  region  = var.aws_region
}
