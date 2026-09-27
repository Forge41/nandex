# The provider has no netlify_site resource -- it manages settings on sites that
# already exist. Both were created outside Terraform (`netlify sites:create`) and are
# deployed by .github/workflows/deploy.yml, not by Netlify's git integration.

resource "netlify_site_build_settings" "frontend" {
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
  site_id = var.netlify_site_id
  team_id = var.netlify_team_id
  key     = "BACKEND_ORIGIN"

  # Every scope and context: free plans cannot customise scopes, and the deploy
  # workflow's CLI builds must see it whatever context they run in.
  scopes = ["builds", "functions", "runtime", "post-processing"]

  values = [{
    value   = "https://${aws_eip.app.public_ip}.nip.io"
    context = "all"
  }]
}

# The portfolio: a second site on the same repository and the same backend.
resource "netlify_site_build_settings" "portfolio" {
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
  site_id = var.netlify_portfolio_site_id
  team_id = var.netlify_team_id
  key     = "BACKEND_ORIGIN"
  scopes  = ["builds", "functions", "runtime", "post-processing"]

  values = [{
    value   = "https://${aws_eip.app.public_ip}.nip.io"
    context = "all"
  }]
}

resource "netlify_environment_variable" "portfolio_booking_url" {
  count = var.portfolio_booking_url == "" ? 0 : 1

  site_id = var.netlify_portfolio_site_id
  team_id = var.netlify_team_id
  key     = "NEXT_PUBLIC_BOOKING_URL"
  scopes  = ["builds", "functions", "runtime"]

  values = [{
    value   = var.portfolio_booking_url
    context = "production"
  }]
}

resource "netlify_site_domain_settings" "frontend" {
  site_id       = var.netlify_site_id
  custom_domain = "interview.nandish.online"
}

# porto. is primary; the others are aliases that portfolio/netlify.toml redirects to it.
# DNS for nandish.online is at Hostinger (not in Terraform): @ A 75.2.60.5, and
# porto/www/contact/interview/nantex CNAMEs to the sites' netlify.app names.
resource "netlify_site_domain_settings" "portfolio" {
  site_id        = var.netlify_portfolio_site_id
  custom_domain  = "porto.nandish.online"
  domain_aliases = ["nandish.online", "www.nandish.online", "contact.nandish.online"]
}

# nantex's static page. Only its domain lives here, beside the other nandish.online names;
# Forge41/nantex's site.yml deploys it. DNS: nantex CNAME nantex.netlify.app.
resource "netlify_site_domain_settings" "nantex" {
  site_id       = var.netlify_nantex_site_id
  custom_domain = "nantex.nandish.online"
}

# These settings existed before Terraform managed them. Importing adopts them rather
# than creating duplicates, which Netlify rejects for environment variables.
import {
  to = netlify_site_build_settings.frontend
  id = var.netlify_site_id
}

import {
  to = netlify_environment_variable.api_base
  id = "${var.netlify_team_id}:${var.netlify_site_id}:BACKEND_ORIGIN"
}

import {
  to = netlify_site_domain_settings.frontend
  id = var.netlify_site_id
}

import {
  to = netlify_site_build_settings.portfolio
  id = var.netlify_portfolio_site_id
}

import {
  to = netlify_environment_variable.portfolio_backend_origin
  id = "${var.netlify_team_id}:${var.netlify_portfolio_site_id}:BACKEND_ORIGIN"
}

import {
  to = netlify_site_domain_settings.portfolio
  id = var.netlify_portfolio_site_id
}

import {
  to = netlify_site_domain_settings.nantex
  id = var.netlify_nantex_site_id
}
