#!/bin/bash

# Wazuh Agent Deploy
dnf install -y uuid
hostnamectl set-hostname $(uuid -v 4)-AlphaServer
curl -o wazuh-agent-4.7.4-1.x86_64.rpm https://packages.wazuh.com/4.x/yum/wazuh-agent-4.7.4-1.x86_64.rpm
sudo WAZUH_MANAGER='REPLACE' rpm -ivh wazuh-agent-4.7.4-1.x86_64.rpm

# AWS SSN Agent Deploy
sudo dnf install -y https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm
sudo systemctl enable --now amazon-ssm-agent

# CodeDeploy Stuff - Maybe we do this later once we have code to deploy
# cd /home/ec2-user
# sudo dnf install ruby -y
# wget https://aws-codedeploy-us-west-2.s3.us-west-2.amazonaws.com/latest/install
# chmod +x ./install
# sudo ./install auto
sudo dnf update -y