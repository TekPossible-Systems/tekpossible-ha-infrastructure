#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Happy } from '../lib/happy';
import stack_config from '../config/config.json';

const app = new cdk.App();

new Happy(app, 'Happy-Stack', stack_config, {});