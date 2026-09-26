# The only AWS resource this account is permitted to create. SCP p-tz1m4zii denies
# ec2, rds, lambda, ssm and s3:CreateBucket, which is why the runner is not here and
# why state is not in S3.
#
# This budget watches the wrong account: it is a member of organization o-0hr6njrabz,
# and the bill consolidates to payer 867982505588. It will report this account's own
# usage and nothing else. A budget on the payer needs credentials we do not have.
resource "aws_budgets_budget" "monthly" {
  name         = "nandex-monthly"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
