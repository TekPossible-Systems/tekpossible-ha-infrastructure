import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// AWS CDK Imports
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as imgbuilder from 'aws-cdk-lib/aws-imagebuilder';
// AWS HAPPy Functions

function create_server_alpha_template(scope: Construct, env_type: string, ami_params: any){
  var instance_type = '';
  if (env_type == "demo"){
    instance_type = 't2.micro';

  }
  else if (env_type == "small"){
    instance_type = 't3.medium';

  } else if (env_type == 'production'){    
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
    instance_type = 't2.micro';

  }
  else if (env_type == "small"){
    instance_type = 't3.medium';

  } else if (env_type == 'production'){    
    instance_type = 'i4i.metal';

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
    
    // First things first, we need a VPC

    const happy_vpc = new ec2.Vpc( this,  'HappyVPC', {
      reservedAzs: 2,
      subnetConfiguration: [
        {
          name: 'HappyPublicSubnet',
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
