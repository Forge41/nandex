# Every provider reads its credential from the environment. Nothing authenticates from
# a file in this repo, and no key reaches Terraform state by way of a variable default.
#
#   RENDER_API_KEY   render dashboard -> account settings -> API keys
#   NETLIFY_TOKEN    netlify user settings -> applications -> personal access tokens

provider "render" {
  owner_id = var.render_owner_id
}

provider "netlify" {}

# The profile is pinned rather than inherited: an apply must not reach whichever AWS
# account happens to be in the caller's environment.
provider "aws" {
  profile = var.aws_profile
  region  = var.aws_region
}
