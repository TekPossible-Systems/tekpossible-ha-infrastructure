#!/bin/bash

# Wazuh Agent Deploy
sudo dnf install -y uuid
sudo hostnamectl set-hostname $(uuid -v 4)-BravoServer
curl -o wazuh-agent-4.7.4-1.x86_64.rpm https://packages.wazuh.com/4.x/yum/wazuh-agent-4.7.4-1.x86_64.rpm
sudo WAZUH_MANAGER='REPLACE' rpm -ivh wazuh-agent-4.7.4-1.x86_64.rpm
sudo systemctl daemon-reload
sudo systemctl enable wazuh-agent
sudo systemctl start wazuh-agent

# AWS SSN Agent Deploy
sudo dnf install -y https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm
sudo systemctl enable --now amazon-ssm-agent

# CodeDeploy Stuff - Maybe we do this later once we have code to deploy
# cd /home/ec2-user
# sudo dnf install ruby -y
# wget https://aws-codedeploy-us-west-2.s3.us-west-2.amazonaws.com/latest/install
# chmod +x ./install
# sudo ./install auto

# Update and reboot the system
sudo dnf update -y
# sudo shutdown -r -h +1

# Trigger the lifecycle hook completion and install awscli dependencies
sudo dnf install python3-pip -y
sudo pip3 install awscli

TOKEN=`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`

INSTANCE_ID=`curl -H "X-aws-ec2-metadata-token: $TOKEN" "http://169.254.169.254/latest/meta-data/instance-id"`

aws autoscaling complete-lifecycle-action --lifecycle-action-result CONTINUE \
  --instance-id "$INSTANCE_ID" --lifecycle-hook-name "REPLACE_LC_HOOK_NAME" \
  --auto-scaling-group-name "REPLACE_ASG_NAME_HERE"