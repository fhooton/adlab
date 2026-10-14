terraform {
  required_version = ">= 1.8"
}

variable "image" {
  type    = string
  default = "ghcr.io/OWNER/adlab:latest"
}

module "api" {
  source = "../../modules/service"
  name   = "adlab-api"
  image  = var.image
}

module "worker" {
  source  = "../../modules/service"
  name    = "adlab-worker"
  image   = var.image
  command = ["npx", "tsx", "apps/worker/src/main.ts"]
}
