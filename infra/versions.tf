terraform {
  required_version = ">= 1.9"

  required_providers {
    # Pinned exactly, not with ~>: this provider is pre-1.0, so a patch bump is
    # allowed to break the schema.
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.66"
    }
    netlify = {
      source  = "netlify/netlify"
      version = "0.4.4"
    }
  }
}
