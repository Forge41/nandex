# Every provider reads its credential from the environment. Nothing authenticates from
# a file in this repo, and no key reaches Terraform state by way of a variable default.
#
#   RENDER_API_KEY   render dashboard -> account settings -> API keys
#   NETLIFY_TOKEN    netlify user settings -> applications -> personal access tokens

provider "render" {
  owner_id = var.render_owner_id
}

provider "netlify" {}
