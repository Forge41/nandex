variable "repo_url" {
  type    = string
  default = "https://github.com/Forge41/nandex"
}

variable "branch" {
  type    = string
  default = "main"
}

variable "netlify_site_id" {
  description = "Created outside Terraform -- the provider has no netlify_site resource. Empty until `netlify sites:create` has run."
  type        = string
  default     = ""
}

variable "netlify_team_id" {
  type    = string
  default = ""
}

variable "aws_profile" {
  type    = string
  default = "personal"
}

variable "aws_region" {
  description = "The only region SCP p-u5qwnset permits for compute. us-east-1 denies EC2 outright."
  type        = string
  default     = "ap-southeast-2"
}

variable "instance_type" {
  description = "2 vCPU / 8 GB. A 4 GB box cannot hold the runner's own concurrency limit."
  type        = string
  default     = "t4g.large"
}

variable "secret_name" {
  description = "Secrets Manager secret holding the runtime environment, written by make aws-secrets."
  type        = string
  default     = "nandex/app-env"
}

variable "netlify_portfolio_site_id" {
  description = "The portfolio's Netlify site, created outside Terraform like netlify_site_id (`netlify sites:create --name nandishnaik`). Empty until then."
  type        = string
  default     = ""
}

variable "portfolio_booking_url" {
  description = "Scheduling link for the portfolio's /book. Empty sends /book to /message."
  type        = string
  default     = ""
}
