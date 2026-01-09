#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProfiliaStack } from '../lib/profilia-stack';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

const app = new cdk.App();

new ProfiliaStack(app, 'ProfiliaStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
  },
  description: 'Profilia - AI-Powered Resume to Portfolio Generator',
  tags: {
    Project: 'Profilia',
    Environment: process.env.ENVIRONMENT || 'production',
    ManagedBy: 'CDK'
  }
});
