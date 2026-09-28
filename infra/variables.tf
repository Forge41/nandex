variable "repo_url" {
  type    = string
  default = "https://github.com/NandishNaik01/nandex"
}

variable "branch" {
  type    = string
  default = "main"
}

variable "netlify_site_id" {
  description = "The nandex site (nandex.netlify.app). Created outside Terraform -- the provider has no netlify_site resource."
  type        = string
  default     = "c32e2008-85eb-4629-987e-96a763818c82"
}

variable "netlify_team_id" {
  type    = string
  default = "65315a4c56c43340fb6e665e"
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
  description = "The portfolio site (nandisha-portfolio.netlify.app), created outside Terraform like netlify_site_id."
  type        = string
  default     = "85010f58-0132-4f97-8c74-5807831488af"
}

variable "netlify_nantex_site_id" {
  description = "The nantex landing page (nantex.netlify.app), created outside Terraform like netlify_site_id and deployed from NandishNaik01/nantex."
  type        = string
  default     = "738918ef-daa4-4d02-bcde-4d756ee1c21c"
}

variable "portfolio_booking_url" {
  description = "Scheduling link for the portfolio's /book. Empty sends /book to /message."
  type        = string
  default     = ""
}
