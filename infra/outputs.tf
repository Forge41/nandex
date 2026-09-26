output "app_url" {
  description = "The API, behind Caddy on the EC2 instance. nip.io resolves this to the Elastic IP."
  value       = "https://${aws_eip.app.public_ip}.nip.io"
}

output "instance_id" {
  description = "For SSM -- there is no SSH."
  value       = aws_instance.app.id
}
