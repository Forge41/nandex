output "core_url" {
  description = "Point the frontend and the agent at this."
  value       = render_web_service.core.url
}

output "service_ids" {
  value = {
    core   = render_web_service.core.id
    worker = one(render_background_worker.temporal[*].id)
    agent  = one(render_background_worker.agent[*].id)
  }
}
