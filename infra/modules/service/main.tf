# Provider-agnostic service module interface. Implement for your provider (one module per service).
variable "name" { type = string }
variable "image" { type = string }
variable "command" {
  type    = list(string)
  default = []
}
variable "env" {
  type      = map(string)
  default   = {}
  sensitive = true
}
variable "port" {
  type    = number
  default = 8787
}

output "name" { value = var.name }
