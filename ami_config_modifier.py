import json
import sys

region = str(sys.argv[1])
ami_id = str(sys.argv[2])

with open("./config/config.json", "r") as infrastructure_config: 
    infrastructure_config_json = json.load(infrastructure_config)
    infrastructure_config_json["ami"][region] = ami_id
    with open("./config/config.json", "w") as infrastructure_config_write:
            json.dump(infrastructure_config_json, infrastructure_config_write, indent=4)