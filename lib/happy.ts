import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// AWS CDK Imports
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as imgbuilder from 'aws-cdk-lib/aws-imagebuilder';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancing';

// Read files from the assets folder
import { readFileSync } from 'fs';

/* There are 3 env types: 
* 1. Demo - this is where all instance types are t2.micro
* 2. Small - this is where all instance types are t3.medium
* 3. Production - this is the real instance size of i4i.metal is used for Server B and c6in.8xlarge for the Server A type.
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
  // This will create 2 public subnets and 2 private subnets in different availability zones
  const happy_vpc = new ec2.Vpc( scope,  config.vpc_name, {
    ipAddresses: ec2.IpAddresses.cidr('172.16.0.0/16'),
    availabilityZones: config.azs,
    enableDnsSupport: true,
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

  

  const server_b_sg = new ec2.SecurityGroup(scope, config.vpc_name + 'ServerBravo-SecurityGroup', {  vpc: happy_vpc   });
  config.bravo_server_ports.forEach(function(port: any) {
    server_b_sg.addIngressRule(ec2.Peer.ipv4("172.16.0.0/16"), ec2.Port.tcp(port));
  });

  var instance_type_alpha = '';
  var instance_type_bravo = '';
  if (config.env_type == "demo"){
    console.log("Server A Environment type is demo! Using t2.micro instance...");
    console.log("Server B Environment type is demo! Using t2.micro instance...");
    instance_type_alpha = 't2.micro';
    instance_type_bravo = 't2.micro';

  }
  else if (config.env_type == "small"){
    console.log("Server A Environment type is small! Using t3.medium instance...");
    console.log("Server B Environment type is small! Using t3.medium instance...");
    instance_type_alpha = 't3.medium';
    instance_type_bravo = 't3.medium';

  } else if (config.env_type == 'production'){   
    console.log("Server A Environment type is production! Using c6in.8xlarge instance..."); 
    console.log("Server B Environment type is production! Using i4i.metal instance...");
    instance_type_alpha = 'c6in.8xlarge';
    instance_type_bravo = 'i4i.metal';

  } else {
    console.log("Incorrect env_type defined, so I will use a t2.micro instance for both servers...");
    instance_type_alpha = 't2.micro';
    instance_type_bravo = 't2.micro';

  }
  var autoscaling_groups_alpha = [];
  var autoscaling_groups_bravo = [];

  var alpha_user_data = readFileSync("./assets/init_alpha.sh", "utf-8");
  var bravo_user_data = readFileSync("./assets/init_bravo.sh", "utf-8");
  alpha_user_data = alpha_user_data.replace("REPLACE", config.wazuh_server_name);
  bravo_user_data = bravo_user_data.replace("REPLACE", config.wazuh_server_name);

  const keypair = ec2.KeyPair.fromKeyPairName(scope, config.keyPair, config.keyPair)
  for (var i = 0; i < config.azs.length; i++) {
    var asg_alpha = new autoscaling.AutoScalingGroup(scope, config.vpc_name + "ServerA-ASG-AZ" + String(i+1), {
      autoScalingGroupName: config.vpc_name + "ServerA-ASG-AZ" + String(i+1),
      vpc: happy_vpc, 
      instanceType:new ec2.InstanceType(instance_type_alpha),
      role: server_instance_role,
      machineImage: ec2.MachineImage.genericLinux({ 'us-east-1': 'ami-0fe630eb857a6ec83', 'us-east-2': 'ami-078cbc4c2d057c244', 'us-west-1': 'ami-014b33341e3a1178e', 'us-west-2': 'ami-0f7197c592205b389' }),
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
      machineImage: ec2.MachineImage.genericLinux({ 'us-east-1': 'ami-0fe630eb857a6ec83', 'us-east-2': 'ami-078cbc4c2d057c244', 'us-west-1': 'ami-014b33341e3a1178e', 'us-west-2': 'ami-0f7197c592205b389' }),
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

    var alpha_lb = new elb.LoadBalancer(scope, config.vpc_name + "ServerA-ASG-AZ" + String(i+1) + "-CLB", {
      vpc: happy_vpc,
      subnetSelection: happy_vpc.selectSubnets({ availabilityZones: config.azs[i], subnetType: ec2.SubnetType.PUBLIC }),
      internetFacing: true,
      crossZone: false,
      healthCheck: {
        port: config.loadbalancer_external_connections[0]
      }
    });


    var bravo_lb = new elb.LoadBalancer(scope, config.vpc_name + "ServerB-ASG-AZ" + String(i+1) + "-CLB", {
      vpc: happy_vpc,
      subnetSelection: happy_vpc.selectSubnets({ availabilityZones: config.azs[i], subnetType: ec2.SubnetType.PUBLIC }),
      internetFacing: true,
      crossZone: false,
      healthCheck: {
        port: config.loadbalancer_external_connections[0]
      }
    });

    config.loadbalancer_external_connections.forEach(function(port: any) {
      alpha_lb.addListener({
        externalPort: Number(port),
        externalProtocol: elb.LoadBalancingProtocol.TCP,
        internalPort: Number(port),
        internalProtocol: elb.LoadBalancingProtocol.TCP
      })

      bravo_lb.addListener({
        externalPort: Number(port),
        externalProtocol: elb.LoadBalancingProtocol.TCP,
        internalPort: Number(port),
        internalProtocol: elb.LoadBalancingProtocol.TCP
      })
    });

    asg_alpha.attachToClassicLB(alpha_lb);
    asg_bravo.attachToClassicLB(bravo_lb);
  }




}


export class Happy extends cdk.Stack {
  constructor(scope: Construct, id: string, config: any, props?: cdk.StackProps) {
    super(scope, id, props);
    create_happy_vpc(this, "us-east-2", config);
  }
}


