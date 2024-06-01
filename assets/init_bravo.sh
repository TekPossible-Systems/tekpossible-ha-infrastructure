#!/bin/bash

# Wazuh Agent Deploy
sudo dnf install httpd -y
sudo systemctl enable --now httpd
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
# Todo: figure out the right grace time

sudo echo "Hostname: $(hostname -f)" > /var/www/html/index.html
sudo systemctl restart httpd

# STIG Stuff 
dnf install -y ansible-core wget
cd /home/ec2-user
wget https://dl.dod.cyber.mil/wp-content/uploads/stigs/zip/U_RHEL_9_V1R2_STIG_Ansible.zip
unzip U_RHEL_9_V1R2_STIG_Ansible.zip
unzip rhel9STIG-ansible.zip
sudo ansible-galaxy collection install ansible.posix community.general
sudo bash ./enforce.sh 