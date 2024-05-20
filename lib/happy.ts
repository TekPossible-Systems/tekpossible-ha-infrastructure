import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// AWS CDK Imports
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as imgbuilder from 'aws-cdk-lib/aws-imagebuilder';
import * as iam from 'aws-cdk-lib/aws-iam';

import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
// AWS HAPPy Infrastructure Functions

// function create_server_alpha_template(scope: Construct, env_type: string, ami_params: any){
//   var instance_type = '';
//   if (env_type == "demo"){
//     console.log("Server A Environment type is demo! Using t2.micro instance...") 
//     instance_type = 't2.micro';

//   }
//   else if (env_type == "small"){
//     console.log("Server A Environment type is small! Using t3.medium instance...") 
//     instance_type = 't3.medium';

//   } else if (env_type == 'production'){    
//     console.log("Server A Environment type is production! Using c6in.8xlarge instance...") 
//     instance_type = 'c6in.8xlarge';

//   } else {
//     instance_type = 't2.micro';
//     console.log("Incorrect env_type defined, so I will use a t2.micro instance...");

//   }

  // const server_alpha_config = new imgbuilder.CfnInfrastructureConfiguration(scope, 'Happy-ServerB-AMI-InfraConfig-'+ami_params.name, {
  //   name: 'Happy-ServerB-AMI-InfraConfig-'+ami_params.name,
  //   instanceProfileName: ami_params.instance_profile_name,
  //   instanceTypes: [instance_type],
  //   keyPair: ami_params.keyPair
  // });

  // const server_alpha_ami = new imgbuilder.CfnImage(scope, 'Happy-ServerB-AMI', {
  //   infrastructureConfigurationArn: server_alpha_config.attrArn,

  // });

// }

// function create_server_bravo_template(scope: Construct, env_type: string, ami_params: any){
//   var instance_type = '';
//   if (env_type == "demo"){
//     console.log("Server B Environment type is demo! Using t2.micro instance...")
//     instance_type = 't2.micro';

//   }
//   else if (env_type == "small"){
//     console.log("Server B Environment type is small! Using t3.medium instance...")
//     instance_type = 't3.medium';

//   } else if (env_type == 'production'){   
//     console.log("Server B Environment type is production! Using i4i.metal instance...") 
//     instance_type = 'i4i.metal';

//   } else {
//     instance_type = 't2.micro';
//     console.log("Incorrect env_type defined, so I will use a t2.micro instance...");

//   }

//   const server_bravo_config = new imgbuilder.CfnInfrastructureConfiguration(scope, 'Happy-ServerB-AMI-InfraConfig-'+ami_params.name, {
//     name: 'Happy-ServerB-AMI-InfraConfig-'+ami_params.name,
//     instanceProfileName: ami_params.instance_profile_name,
//     instanceTypes: [instance_type],
//     keyPair: ami_params.keyPair
//   });

//   const server_bravo_ami = new imgbuilder.CfnImage(scope, 'Happy-ServerB-AMI', {
//     infrastructureConfigurationArn: server_bravo_config.attrArn,

//   });
// }
/* There are 3 env types: 
* 1. Demo - this is where all instance types are t2.micro
* 2. Small - this is where all instance types are t3.medium
* 3. Production - this is the real instance size of i4i.metal is used for Server B and c6in.8xlarge for the Server A type.
*/

function create_happy_vpc(scope: Construct, region_name: string, config: any){
  const env_type = config.environment; 

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

  var instance_type = '';
  if (env_type == "demo"){
    console.log("Server B Environment type is demo! Using t2.micro instance...")
    instance_type = 't2.micro';

  }
  else if (env_type == "small"){
    console.log("Server B Environment type is small! Using t3.medium instance...")
    instance_type = 't3.medium';

  } else if (env_type == 'production'){   
    console.log("Server B Environment type is production! Using i4i.metal instance...") 
    instance_type = 'i4i.metal';

  } else {
    instance_type = 't2.micro';
    console.log("Incorrect env_type defined, so I will use a t2.micro instance...");

  }

  // TODO: Need to research the ASG a little bit more
  const server_a_asg_az1 = new autoscaling.AutoScalingGroup(scope, config.vpc_name+"ServerA-ASG", {
    vpc: happy_vpc, 
    instanceType:new ec2.InstanceType(instance_type),
    role: server_instance_role,
    machineImage: config.ami_arn,
    minCapacity: config.min_alpha_server_capacity,
    maxCapacity: config.max_alpha_server_capacity,
    vpcSubnets: happy_vpc.selectSubnets({ availabilityZones: config.azs[0], subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
    keyPair: config.keyPair,
    securityGroup: server_a_sg


  });



}


export class Happy extends cdk.Stack {
  constructor(scope: Construct, id: string, config: any, props?: cdk.StackProps) {
    super(scope, id, props);
    create_happy_vpc(this, "us-east-2", config);
  }
}


