# The provider has no netlify_site resource -- it manages settings on a site that
# already exists. The site is created once, outside Terraform:
#
#   netlify sites:create --name nandex
#
# then its id goes into netlify_site_id. Until then these resources are skipped
# rather than failing a plan on an empty id.

resource "netlify_site_build_settings" "frontend" {
  count = var.netlify_site_id == "" ? 0 : 1

  site_id           = var.netlify_site_id
  production_branch = var.branch
  # Built from the repository root so the pnpm workspace resolves; frontend/ holds
  # the site's netlify.toml.
  base_directory    = ""
  package_directory = "frontend"
  build_command     = "pnpm --filter frontend build"
  publish_directory = "frontend/.next"

  # Off deliberately: a preview deploy of this frontend would point at the one
  # production backend, and its sessions would be real rows in the real database.
  deploy_previews = false
}

# The /api/* rewrite deliberately stays in frontend/next.config.ts rather than moving
# here. It changes with the frontend, in the same commit and the same review.
resource "netlify_environment_variable" "api_base" {
  count = var.netlify_site_id == "" ? 0 : 1

  site_id = var.netlify_site_id
  team_id = var.netlify_team_id
  key     = "BACKEND_ORIGIN"

  # Free plans cannot customise scopes; this exact set is what the provider requires.
  scopes = ["builds", "functions", "runtime"]

  values = [{
    value   = "https://${aws_eip.app.public_ip}.nip.io"
    context = "production"
  }]
}

# The portfolio: a second site on the same repository and the same backend.
resource "netlify_site_build_settings" "portfolio" {
  count = var.netlify_portfolio_site_id == "" ? 0 : 1

  site_id           = var.netlify_portfolio_site_id
  production_branch = var.branch
  base_directory    = ""
  package_directory = "portfolio"
  build_command     = "pnpm --filter portfolio build"
  publish_directory = "portfolio/.next"

  # Same reason as nandex: a preview would talk to the production backend.
  deploy_previews = false
}

resource "netlify_environment_variable" "portfolio_backend_origin" {
  count = var.netlify_portfolio_site_id == "" ? 0 : 1

  site_id = var.netlify_portfolio_site_id
  team_id = var.netlify_team_id
  key     = "BACKEND_ORIGIN"
  scopes  = ["builds", "functions", "runtime"]

  values = [{
    value   = "https://${aws_eip.app.public_ip}.nip.io"
    context = "production"
  }]
}

resource "netlify_environment_variable" "portfolio_booking_url" {
  count = var.netlify_portfolio_site_id == "" || var.portfolio_booking_url == "" ? 0 : 1

  site_id = var.netlify_portfolio_site_id
  team_id = var.netlify_team_id
  key     = "NEXT_PUBLIC_BOOKING_URL"
  scopes  = ["builds", "functions", "runtime"]

  values = [{
    value   = var.portfolio_booking_url
    context = "production"
  }]
}
