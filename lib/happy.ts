import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// AWS CDK Imports
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as imgbuilder from 'aws-cdk-lib/aws-imagebuilder';
import * as iam from 'aws-cdk-lib/aws-iam';
// AWS HAPPy Infrastructure Functions

function create_server_alpha_template(scope: Construct, env_type: string, ami_params: any){
  var instance_type = '';
  if (env_type == "demo"){
    console.log("Server A Environment type is demo! Using t2.micro instance...") 
    instance_type = 't2.micro';

  }
  else if (env_type == "small"){
    console.log("Server A Environment type is small! Using t3.medium instance...") 
    instance_type = 't3.medium';

  } else if (env_type == 'production'){    
    console.log("Server A Environment type is production! Using c6in.8xlarge instance...") 
    instance_type = 'c6in.8xlarge';

  } else {
    instance_type = 't2.micro';
    console.log("Incorrect env_type defined, so I will use a t2.micro instance...");

  }

  const server_alpha_config = new imgbuilder.CfnInfrastructureConfiguration(scope, 'Happy-ServerA-AMI-InfraConfig', {
    name: 'Happy-ServerA-AMI-InfraConfig',
    instanceProfileName: '',
    instanceTypes: [instance_type],
    keyPair: ami_params.keyPair
  })

}

function create_server_bravo_template(scope: Construct, env_type: string, ami_params: any){
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
  const server_bravo_instance_role = new iam.Role(scope, "Happy-ServerB-IAM-Role", {
    roleName: 'Happy-ServerB-IAM-Role',
    assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
  });
  server_bravo_instance_role.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(scope,"Happy-MMROLE_SSM", "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"));
  server_bravo_instance_role.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(scope,"Happy-MMROLE_LOGS", "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"));
  server_bravo_instance_role.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(scope,"Happy-MMROLE_CODE", "arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforAWSCodeDeploy"));

  const server_bravo_instance_profile = new iam.InstanceProfile(scope, 'Happy-ServerB-AMI-InstanceProfile', {
    role: server_bravo_instance_role,
    instanceProfileName: 'server_bravo_instance_profile'
  });

  const server_bravo_config = new imgbuilder.CfnInfrastructureConfiguration(scope, 'Happy-ServerB-AMI-InfraConfig', {
    name: 'Happy-ServerB-AMI-InfraConfig',
    instanceProfileName: server_bravo_instance_profile.instanceProfileName,
    instanceTypes: [instance_type],
    keyPair: ami_params.keyPair
  });

  const server_bravo_ami = new imgbuilder.CfnImage(scope, 'Happy-ServerB-AMI', {
    infrastructureConfigurationArn: server_bravo_config.attrArn,

  });
}
/* There are 3 env types: 
* 1. Demo - this is where all instance types are t2.micro
* 2. Small - this is where all instance types are t3.medium
* 3. Production - this is the real instance size of i4i.metal is used for Server B and c6in.8xlarge for the Server A type.
*/
function create_region(region_name: string, env_type: string){

}

export class Happy extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    create_server_alpha_template(this, "production", {
      keyPair: "tekp-keypair"
    });
    create_server_bravo_template(this, "production", {
      keyPair: "tekp-keypair"
    });
    // First things first, we need a VPC

    const happy_vpc = new ec2.Vpc( this,  'HappyVPC', {
      reservedAzs: 2,
      subnetConfiguration: [
        {
          name: 'HappyPublicSubnet', // FIXME: Figure out how to set the CIDR block
          cidrMask: 24,
          mapPublicIpOnLaunch: true,
          subnetType: ec2.SubnetType.PUBLIC
      }, 
      {
        name: 'HappyPrivateSubnet',
        cidrMask: 24,
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }
      ]
    }
    )


  }
}
