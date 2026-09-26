variable "render_owner_id" {
  description = "Render workspace that owns every service here. Starts tea- for a team, usr- for an individual."
  type        = string
  default     = "tea-csp9bdbgbbvc73celgmg"
}

variable "render_region" {
  description = "One of frankfurt, ohio, oregon, singapore, virginia."
  type        = string
  default     = "oregon"
}

variable "repo_url" {
  type    = string
  default = "https://github.com/Forge41/nandex"
}

variable "branch" {
  type    = string
  default = "main"
}

# Starter is the floor that does not sleep. Free is not an option for any of these:
# background workers have no free instance type, and a free web service spins down
# after 15 minutes -- a sleeping worker does not pick up work.
variable "web_plan" {
  type    = string
  default = "free"
}

variable "worker_plan" {
  type    = string
  default = "starter"
}

# The interviewer processes audio in real time. Starter is 0.5 vCPU, which is the
# first thing to raise if speech stutters under load.
variable "agent_plan" {
  type    = string
  default = "starter"
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

variable "enable_workers" {
  description = "Create the Temporal worker and the interviewer agent. Needs a card on the Render account, and a Temporal and a LiveKit endpoint for them to reach."
  type        = bool
  default     = false
}
