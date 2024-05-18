# Architecture of HAPPy

Essentially it is this: 
There are 2 types of servers in HAPPy:
1. Distribution server (Server type A)- for my purposes this will be a t2.micro instance by default, but you change via the config folder
2. Processing server (Server type B) - this will also be a t2 micro server by default but should be a lot bigger in prod

These servers are in Auto Scaling Groups (ASGs) so that if something big happens, we can scale to have more servers. By default there will two of each type of server to prevent random software failures on one of the nodes. It can scan to 5 of the Distribution servers, and 10 of the Processing nodes by default. 