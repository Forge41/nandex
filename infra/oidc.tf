# GitHub Actions assumes a role here instead of holding an access key. This repository
# is public; a long-lived key in its secrets is a key that only ever gets more exposed.

data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_actions" {
  name        = "nandex-github-actions"
  description = "Assumed by the Infra workflow to plan and apply this configuration"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        # Scoped to this repository, and within it to main and to pull requests.
        # Without this any GitHub workflow anywhere could assume the role.
        #
        # This organisation issues *immutable* subject claims, which carry the numeric
        # org and repo ids: the real subject is
        #   repo:Forge41@194065758/nandex@1355965819:pull_request
        # not repo:Forge41/nandex:pull_request. Only CloudTrail says so -- the API
        # answers "Not authorized to perform sts:AssumeRoleWithWebIdentity" either way.
        #
        # Both forms are listed so the role keeps working if that setting is turned
        # off. Matching on ids is the stronger of the two: they survive a rename and
        # cannot be squatted by recreating a repository under the same name.
        StringLike = {
          "token.actions.githubusercontent.com:sub" = [
            "repo:Forge41@194065758/nandex@1355965819:ref:refs/heads/main",
            "repo:Forge41@194065758/nandex@1355965819:pull_request",
            "repo:Forge41/nandex:ref:refs/heads/main",
            "repo:Forge41/nandex:pull_request",
          ]
        }
      }
    }]
  })
}

# PowerUser covers everything this configuration touches except IAM, which is granted
# narrowly below rather than by attaching AdministratorAccess to a role a public
# repository can assume.
resource "aws_iam_role_policy_attachment" "github_actions_power" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

resource "aws_iam_role_policy" "github_actions_iam" {
  name = "manage-app-instance-role"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "iam:GetRole", "iam:CreateRole", "iam:DeleteRole", "iam:UpdateRole",
          "iam:TagRole", "iam:ListRoleTags", "iam:ListRolePolicies",
          "iam:GetRolePolicy", "iam:PutRolePolicy", "iam:DeleteRolePolicy",
          "iam:ListAttachedRolePolicies", "iam:AttachRolePolicy", "iam:DetachRolePolicy",
          "iam:PassRole",
          "iam:GetInstanceProfile", "iam:CreateInstanceProfile", "iam:DeleteInstanceProfile",
          "iam:AddRoleToInstanceProfile", "iam:RemoveRoleFromInstanceProfile",
          "iam:ListInstanceProfilesForRole",
        ]
        # Only the roles this configuration owns. Notably not itself: a role that can
        # rewrite its own trust policy is a role that can be granted to anyone.
        Resource = [
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/nandex-app",
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:instance-profile/nandex-app",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["iam:ListOpenIDConnectProviders", "iam:GetOpenIDConnectProvider"]
        Resource = "*"
      },
      {
        # Read-only on itself and on the provider that lets it exist. Terraform manages
        # both, so a plan has to refresh them -- without this the plan fails on
        # GetRole 403 before it reaches anything else.
        #
        # Read only, deliberately: a role that can rewrite its own trust policy can
        # grant itself to anyone. Changing the CI role is therefore a local apply by a
        # human, and an apply on main that tries to change it will fail. That is the
        # intended friction, not an oversight.
        Effect = "Allow"
        Action = [
          "iam:GetRole", "iam:ListRolePolicies", "iam:GetRolePolicy",
          "iam:ListAttachedRolePolicies", "iam:ListRoleTags",
        ]
        Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/nandex-github-actions"
      },
    ]
  })
}

output "github_actions_role_arn" {
  description = "Set as the AWS_ROLE_ARN repository variable for the Infra workflow."
  value       = aws_iam_role.github_actions.arn
}
