provider "aws" {
  region = var.aws_region
}

terraform {
  backend "s3" {
    bucket = "nova-verify-terraform-state"
    key    = "state/terraform.tfstate"
    region = "us-east-1"
  }
}

resource "aws_vpc" "nova-verify_vpc" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "nova-verify-vpc"
    Environment = var.environment
  }
}

resource "aws_security_group" "web_sg" {
  name        = "nova-verify-web-sg"
  description = "Allow inbound traffic"
  vpc_id      = aws_vpc.nova-verify_vpc.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
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