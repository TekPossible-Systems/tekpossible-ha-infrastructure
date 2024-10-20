import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// AWS CDK Imports
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as efs from 'aws-cdk-lib/aws-efs';
// Read files from the assets folder
import { readFileSync } from 'fs';

/* There are 3 env types: 
* 1. Demo - this is where all instance types are t2.micro
* 2. Small - this is where all instance types are t3.medium
* 3. Production - this is the real instance size of p4d.24xlarge is used for Server B and c6in.8xlarge for the Server A type.
*/

function create_happy_vpc(scope: Construct, region_name: string, config: any){

  const launchTemplateRequireImdsv2Aspect = new ec2.LaunchTemplateRequireImdsv2Aspect({ suppressWarnings: false  });

  const server_instance_role = new iam.Role(scope, "Happy-Server-IAM-Role", {
    roleName: 'Happy-Server-IAM-Role',
    assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
  });
  server_instance_role.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(scope,"Happy-MMROLE_SSM", "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"));
  server_instance_role.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(scope,"Happy-MMROLE_LOGS", "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"));
  server_instance_role.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(scope,"Happy-MMROLE_CODE", "arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforAWSCodeDeploy"));


  // First things first, we need a VPC
  // This will create 1 public subnets and 1 private subnets per availability zone(s) specified in the config.json file
  const happy_vpc = new ec2.Vpc( scope,  config.vpc_name, {
    ipAddresses: ec2.IpAddresses.cidr('172.16.0.0/16'),
    availabilityZones: config.azs,
    enableDnsSupport: true,
    enableDnsHostnames: true, // Needed for some EFS DNS stuff
    createInternetGateway: true,
    subnetConfiguration: [
      {
        name: 'HappyPublicSubnet',
        cidrMask: 24,
        mapPublicIpOnLaunch: true,
        subnetType: ec2.SubnetType.PUBLIC,
    }, 
    {
      name: 'HappyPrivateSubnet',
      cidrMask: 24,
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
    }
    ]
  }
  );
  const server_a_sg = new ec2.SecurityGroup(scope, config.vpc_name + 'ServerAlpha-SecurityGroup', {  vpc: happy_vpc   });
  config.alpha_server_ports.forEach(function(port: any) {
    server_a_sg.addIngressRule(ec2.Peer.ipv4("172.16.0.0/16"), ec2.Port.tcp(port));
  });
  server_a_sg.addIngressRule(ec2.Peer.ipv4("172.16.0.0/16"), ec2.Port.icmpPing());
  
  const server_b_sg = new ec2.SecurityGroup(scope, config.vpc_name + 'ServerBravo-SecurityGroup', {  vpc: happy_vpc   });
  config.bravo_server_ports.forEach(function(port: any) {
    server_b_sg.addIngressRule(ec2.Peer.ipv4("172.16.0.0/16"), ec2.Port.tcp(port));
  });
  server_b_sg.addIngressRule(ec2.Peer.ipv4("172.16.0.0/16"), ec2.Port.icmpPing());

  var instance_type_alpha = '';
  var instance_type_bravo = '';
  var efs_removal_policy = cdk.RemovalPolicy.DESTROY;
  if (config.env_type == "demo"){
    console.log("Server A Environment type is demo! Using t2.micro instance...");
    console.log("Server B Environment type is demo! Using t2.micro instance...");
    console.log("EFS environment is demo! Removal policy is set to DESTROY...");
    instance_type_alpha = 't2.micro';
    instance_type_bravo = 't2.micro';
    efs_removal_policy = cdk.RemovalPolicy.DESTROY;
  }
  else if (config.env_type == "small"){
    console.log("Server A Environment type is small! Using t3.medium instance...");
    console.log("Server B Environment type is small! Using t3.medium instance...");
    console.log("EFS environment is small! Removal policy is set to RETAIN...");
    instance_type_alpha = 't3.medium';
    instance_type_bravo = 't3.medium';
    efs_removal_policy = cdk.RemovalPolicy.RETAIN;

  } else if (config.env_type == 'production'){   
    console.log("Server A Environment type is production! Using c6in.8xlarge instance..."); 
    console.log("Server B Environment type is production! Using p4d.24xlarge instance...");
    console.log("EFS environment is production! Removal policy is set to RETAIN...");
    instance_type_alpha = 'c6in.8xlarge';
    instance_type_bravo = 'p4d.24xlarge';
    efs_removal_policy = cdk.RemovalPolicy.RETAIN;


  } else {
    console.log("Incorrect env_type defined, so I will use a t2.micro instance for both servers...");
    console.log("EFS environment is not defined! Removal policy is set to DESTROY...");
    instance_type_alpha = 't2.micro';
    instance_type_bravo = 't2.micro';
    efs_removal_policy = cdk.RemovalPolicy.DESTROY;

  }

  // Create EFS (AWS NFS) Share
  const efs_security_group = new ec2.SecurityGroup(scope, config.vpc_name + "EFS-SHARE-SG", {
    vpc: happy_vpc
  });

  efs_security_group.addIngressRule(ec2.Peer.ipv4("172.16.0.0/16"), ec2.Port.NFS);
  var efs_shares: any = [];

  config.efs_shares.forEach(function(share: any){
    var happy_efs_share = new efs.FileSystem(scope, config.vpc_name + "EFS-SHARE-" + share.name, {
      vpc: happy_vpc,
      encrypted: true,
      fileSystemName: config.vpc_name + "EFS-SHARE-" + share.name,
      allowAnonymousAccess: false,
      enableAutomaticBackups: true,
      oneZone: false, // For our setup this needs to be false - there are 2 AZs by default and you could theoretically add more
      securityGroup: efs_security_group,
      removalPolicy: efs_removal_policy
    });

    happy_efs_share.grantRootAccess(server_instance_role);   
    efs_shares.push({"fsid" :happy_efs_share.fileSystemId, "mount": "/" + share.name });

  });

  // Modify user data to mount the nfs shares
  var efs_share_user_data = '#!/bin/bash\n\n sudo dnf install -y https://cdn.amazonlinux.com/al2023/core/guids/9cf1057036ef7d615de550a658447fad88617805da0cfc9b854ba0fb8a668466/x86_64/../../../../blobstore/9866146da4d009f3e37eb83b7dd6361da7b87078e9b8be60a6e9fc9695d10533/amazon-efs-utils-1.35.0-1.amzn2023.noarch.rpm\n';
  efs_shares.forEach(function(share: any){
    efs_share_user_data += "sudo mkdir " + share.mount + "\n"
    efs_share_user_data += "sudo echo '" + share.fsid  + ":/ " + share.mount + " efs _netdev,noresvport,tls,iam 0 0' >> /etc/fstab\n"
  });

  efs_share_user_data += "sudo mount -a\n\n"

  var autoscaling_groups_alpha = [];
  var autoscaling_groups_bravo = [];

  var alpha_user_data = readFileSync("./assets/init_alpha.sh", "utf-8");
  var bravo_user_data = readFileSync("./assets/init_bravo.sh", "utf-8");
  alpha_user_data = alpha_user_data.replace("PORTS", config.alpha_server_ports.join(" "));
  bravo_user_data = bravo_user_data.replace("PORTS", config.bravo_server_ports.join(" "));

  const keypair = ec2.KeyPair.fromKeyPairName(scope, config.keyPair, config.keyPair)

  const loadbalancer_security_group = new ec2.SecurityGroup(scope, config.vpc_name + "NLB-SG", {
    vpc: happy_vpc, 
    allowAllOutbound: true
  });

  config.loadbalancer_external_connections.forEach(function(port: any) {
    loadbalancer_security_group.addIngressRule(ec2.Peer.ipv4("0.0.0.0/0"), ec2.Port.tcp(port));

  });
  


  for (var i = 0; i < config.azs.length; i++) {
    var asg_alpha = new autoscaling.AutoScalingGroup(scope, config.vpc_name + "ServerA-ASG-AZ" + String(i+1), {
      autoScalingGroupName: config.vpc_name + "ServerA-ASG-AZ" + String(i+1),
      vpc: happy_vpc, 
      instanceType:new ec2.InstanceType(instance_type_alpha),
      role: server_instance_role,
      machineImage: ec2.MachineImage.genericLinux(config.ami),
      minCapacity: config.min_alpha_server_capacity,
      maxCapacity: config.max_alpha_server_capacity,
      healthCheck: autoscaling.HealthCheck.ec2({ grace: cdk.Duration.minutes(config.alpha_server_warmup_time_minutes) }),
      defaultInstanceWarmup: cdk.Duration.minutes(config.alpha_server_warmup_time_minutes),
      vpcSubnets: happy_vpc.selectSubnets({ availabilityZones: config.azs[i], subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
      keyPair: keypair,
      securityGroup: server_a_sg,
      allowAllOutbound: true,
    });
    
    var asg_bravo = new autoscaling.AutoScalingGroup(scope, config.vpc_name + "ServerB-ASG-AZ" + String(i+1), {
      autoScalingGroupName: config.vpc_name + "ServerB-ASG-AZ" + String(i+1),
      vpc: happy_vpc, 
      instanceType:new ec2.InstanceType(instance_type_bravo),
      role: server_instance_role,
      machineImage: ec2.MachineImage.genericLinux(config.ami),
      minCapacity: config.min_bravo_server_capacity,
      maxCapacity: config.max_bravo_server_capacity,
      healthCheck: autoscaling.HealthCheck.ec2({ grace: cdk.Duration.minutes(config.bravo_server_warmup_time_minutes) }),
      defaultInstanceWarmup: cdk.Duration.minutes(config.bravo_server_warmup_time_minutes),
      vpcSubnets: happy_vpc.selectSubnets({ availabilityZones: config.azs[i], subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
      keyPair: keypair, 
      securityGroup: server_b_sg,
      allowAllOutbound: true
    });
    
    autoscaling_groups_alpha[i] = asg_alpha;
    autoscaling_groups_bravo[i] = asg_bravo;

    asg_alpha.scaleOnCpuUtilization(config.vpc_name+'ServerA-ASG', {
      targetUtilizationPercent: config.max_alpha_server_cpu_pct, 
      disableScaleIn: false,
    });
    asg_alpha.addUserData(alpha_user_data);

    asg_bravo.scaleOnCpuUtilization(config.vpc_name+'ServerB-ASG', {
      targetUtilizationPercent: config.max_bravo_server_cpu_pct, 
      disableScaleIn: false,
    });

    asg_bravo.addUserData(bravo_user_data);

    var alpha_lb = new elb.NetworkLoadBalancer(scope, config.vpc_name + "ServerA-NLB-AZ" + String(i+1), {
      vpc: happy_vpc,
      vpcSubnets: happy_vpc.selectSubnets({ availabilityZones: config.azs[i], subnetType: ec2.SubnetType.PUBLIC }),
      internetFacing: false, // Create an internal load balancer,
      crossZoneEnabled: false,
      loadBalancerName: config.vpc_name + "ServerA-NLB-AZ" + String(i+1),
      securityGroups: [loadbalancer_security_group]
    });

    var bravo_lb = new elb.NetworkLoadBalancer(scope, config.vpc_name + "ServerB-NLB-AZ" + String(i+1), {
      vpc: happy_vpc,
      vpcSubnets: happy_vpc.selectSubnets({ availabilityZones: config.azs[i], subnetType: ec2.SubnetType.PUBLIC }),
      internetFacing: false, // Create an internal load balancer
      crossZoneEnabled: false,
      loadBalancerName: config.vpc_name + "ServerB-NLB-AZ" + String(i+1),
      securityGroups: [loadbalancer_security_group],
    });

    config.loadbalancer_external_connections.forEach(function(port: any) {
      alpha_lb.addListener(config.vpc_name + "ServerA-NLB-AZ" + String(i+1) + "-LISTENER-PORT-" + String(port), {
        port: Number(port),
        protocol: elb.Protocol.TCP,
      }).addTargets(config.vpc_name + "ServerA-NLB-AZ" + String(i+1) + "-TGT-P" + String(port), {
        port: port,
        protocol: elb.Protocol.TCP,
        targets: [asg_alpha],
        targetGroupName: config.vpc_name + "ServerA-NLB-AZ" + String(i+1) + "-TGT-P" + String(port)
      });

      bravo_lb.addListener(config.vpc_name + "ServerB-NLB-AZ" + String(i+1) + "-LISTENER-PORT-" + String(port), {
        port: Number(port),
        protocol: elb.Protocol.TCP,
      }).addTargets(config.vpc_name + "ServerB-NLB-AZ" + String(i+1) + "-TGT-P" + String(port), {
        port: port,
        protocol: elb.Protocol.TCP,
        targets: [asg_bravo],
        targetGroupName: config.vpc_name + "ServerB-NLB-AZ" + String(i+1) + "-TGT-P" + String(port)
      });
      
      // Tags are added so that instances can dynamically be added to the codedeploy deployment group

      cdk.Tags.of(asg_alpha).add("codedeploy_group", config.alpha_codedeploy_tag, { 
        applyToLaunchedInstances: true
      });

      cdk.Tags.of(asg_bravo).add("codedeploy_group", config.bravo_codedeploy_tag, { 
        applyToLaunchedInstances: true
      });

    });

  }

}


export class Happy extends cdk.Stack {
  constructor(scope: Construct, id: string, config: any, props?: cdk.StackProps) {
    super(scope, id, props);
    create_happy_vpc(this, config.region, config);
  }
}


