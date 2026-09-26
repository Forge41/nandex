# The one box. Everything except the frontend, Temporal and LiveKit runs here.
#
# ap-southeast-2 is not a preference: SCP p-u5qwnset denies all but a handful of global
# actions in every other region, including EC2 outright in us-east-1.

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Resolved rather than pinned: a hardcoded AMI id is a security update nobody applies.
data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_security_group" "app" {
  name        = "nandex-app"
  description = "Public HTTPS for the API. No SSH -- SSM Session Manager instead."
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "API, via Caddy"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Let's Encrypt's HTTP-01 challenge only. Caddy redirects everything else to 443.
  ingress {
    description = "ACME HTTP-01"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# A stable address, because it is baked into the nip.io hostname and therefore into the
# certificate and the frontend's BACKEND_ORIGIN. Losing it on a stop/start would mean
# reissuing both.
resource "aws_eip" "app" {
  domain = "vpc"
}

resource "aws_eip_association" "app" {
  instance_id   = aws_instance.app.id
  allocation_id = aws_eip.app.id
}

# SSM for shell access without a key or an open port; one secret for the runtime
# environment. Nothing else -- the instance has no reason to reach the rest of AWS.
resource "aws_iam_role" "app" {
  name = "nandex-app"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "read_app_secret" {
  name = "read-app-secret"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = data.aws_secretsmanager_secret.app_env.arn
    }]
  })
}

data "aws_secretsmanager_secret" "app_env" {
  name = var.secret_name
}

resource "aws_iam_instance_profile" "app" {
  name = "nandex-app"
  role = aws_iam_role.app.name
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.value
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  root_block_device {
    volume_size = 40
    volume_type = "gp3"
    encrypted   = true
  }

  # The hostname depends on the EIP, which depends on this instance, so it cannot be
  # baked in here. cloud-init writes the environment and brings the stack up; the
  # hostname arrives with the first deploy.
  user_data = file("${path.module}/user_data.sh")

  # user_data only runs on first boot. Changing it should replace the instance rather
  # than leave a box running a script it never executed.
  user_data_replace_on_change = true

  tags = { Name = "nandex-app" }
}
