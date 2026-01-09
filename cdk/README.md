# AWS CDK Deployment Guide

This guide walks you through deploying the complete Profilia application using AWS CDK.

## 📋 Prerequisites

- Node.js 18.x or higher
- AWS CLI configured with credentials
- AWS CDK CLI installed globally
- OpenAI API Key

## 🚀 Quick Start

### 1. Install AWS CDK CLI (if not already installed)

```powershell
npm install -g aws-cdk
```

Verify installation:
```powershell
cdk --version
```

### 2. Install Dependencies

**Backend dependencies:**
```powershell
cd c:\VS Code Workspace\profilia-backend
npm install
```

**CDK dependencies:**
```powershell
cd cdk
npm install
```

### 3. Configure Environment Variables

Create `.env` file in the root directory:

```powershell
cd ..
```

Create `.env`:
```
OPENAI_API_KEY=sk-your-openai-api-key-here
AWS_REGION=us-east-1
ENVIRONMENT=production
```

### 4. Bootstrap CDK (First Time Only)

```powershell
cd cdk
cdk bootstrap
```

This creates necessary resources in your AWS account for CDK deployments.

### 5. Review Infrastructure

Preview what will be deployed:

```powershell
cdk synth
```

See differences from current deployment:

```powershell
cdk diff
```

### 6. Deploy Everything

Deploy all stacks:

```powershell
cdk deploy --all
```

Or use the npm script:

```powershell
npm run deploy
```

This will deploy:
- ✅ DynamoDB table for progress tracking
- ✅ S3 bucket for generated portfolios
- ✅ Lambda function with 15-minute timeout
- ✅ Lambda Function URL (no API Gateway needed!)
- ✅ S3 bucket for website frontend
- ✅ CloudFront distribution
- ✅ Automatic frontend deployment

### 7. Get Your URLs

After deployment completes, you'll see outputs:

```
Outputs:
ProfiliaStack.WebsiteURL = https://d1234567890.cloudfront.net
ProfiliaStack.LambdaFunctionURL = https://abc123.lambda-url.us-east-1.on.aws/
ProfiliaStack.PortfolioBucket = profilia-portfolios-123456789012
```

**Your website is now live!** 🎉

## 📁 Project Structure

```
profilia-backend/
├── cdk/                        # CDK Infrastructure code
│   ├── bin/
│   │   └── profilia-cdk.ts    # CDK app entry point
│   ├── lib/
│   │   └── profilia-stack.ts  # Main infrastructure stack
│   ├── cdk.json               # CDK configuration
│   ├── tsconfig.json          # TypeScript config
│   └── package.json           # CDK dependencies
├── services/
│   ├── textExtractor.js       # PDF/Word extraction
│   ├── portfolioGenerator.js  # AI portfolio generation
│   ├── s3Uploader.js          # S3 upload
│   └── progressTracker.js     # DynamoDB progress tracking
├── public_html/               # Frontend files
│   └── index.html             # Main website
├── index.js                   # Lambda handler
├── package.json               # Backend dependencies
└── .env                       # Environment variables
```

## 🔧 Infrastructure Details

### Lambda Function
- **Runtime:** Node.js 18.x
- **Timeout:** 15 minutes (no API Gateway 29s limit!)
- **Memory:** 1536 MB
- **Function URL:** Direct HTTP endpoint
- **CORS:** Enabled for all origins

### DynamoDB Table
- **Name:** profilia-job-progress
- **Billing:** Pay-per-request
- **TTL:** Auto-delete jobs after 24 hours
- **Purpose:** Track upload and AI generation progress

### S3 Buckets
1. **Portfolio Bucket:** Public read for generated HTML portfolios
2. **Website Bucket:** Private, accessed via CloudFront

### CloudFront
- **SSL:** Automatic HTTPS
- **Caching:** Optimized for static content
- **Error Pages:** SPA-friendly routing
- **Global:** Low latency worldwide

## 🔄 Updates and Redeployment

### Update Backend Code

```powershell
cd c:\VS Code Workspace\profilia-backend\cdk
cdk deploy
```

CDK automatically updates the Lambda function with new code.

### Update Frontend

```powershell
# Frontend is automatically deployed from public_html folder
cdk deploy
```

CloudFront cache is automatically invalidated.

### Update Environment Variables

Edit `.env` file, then:

```powershell
cdk deploy
```

## 🧪 Testing the Deployment

### 1. Test Frontend

Open the CloudFront URL in your browser.

### 2. Test File Upload

1. Click "Choose File" or drag a resume (PDF/DOCX)
2. Watch the progress bar update in real-time
3. Portfolio opens automatically when complete

### 3. Test API Directly

**Start a job:**
```powershell
$body = @{
    file = [Convert]::ToBase64String([IO.File]::ReadAllBytes("resume.pdf"))
    fileName = "resume.pdf"
    fileType = "application/pdf"
} | ConvertTo-Json

Invoke-RestMethod -Method POST -Uri "YOUR_LAMBDA_URL" -Body $body -ContentType "application/json"
```

**Check job status:**
```powershell
Invoke-RestMethod -Uri "YOUR_LAMBDA_URL?jobId=YOUR_JOB_ID"
```

## 📊 Monitoring

### CloudWatch Logs

View Lambda logs:
```powershell
aws logs tail /aws/lambda/profilia-portfolio-generator --follow
```

### DynamoDB

View jobs in progress:
```powershell
aws dynamodb scan --table-name profilia-job-progress
```

### S3 Portfolios

List generated portfolios:
```powershell
aws s3 ls s3://profilia-portfolios-YOUR_ACCOUNT_ID/portfolios/
```

## 💰 Cost Estimation

### Monthly Costs (1000 users)
- **Lambda:** ~$2-5 (depending on AI generation time)
- **DynamoDB:** ~$0.50 (pay-per-request)
- **S3 Storage:** ~$0.50 (20GB portfolios)
- **CloudFront:** ~$1-3 (data transfer)
- **Total:** ~$4-9/month

### AWS Free Tier Includes:
- Lambda: 1M requests + 400,000 GB-seconds
- DynamoDB: 25 GB storage + 25 WCU/RCU
- S3: 5 GB storage + 20,000 GET requests
- CloudFront: 1 TB data transfer

## 🔒 Security Best Practices

### Current Setup (Development)
- ✅ Function URL with CORS
- ✅ Public S3 for portfolios
- ✅ CloudFront for website
- ⚠️ No authentication
- ⚠️ No rate limiting

### Production Recommendations

**1. Add Lambda Authorizer:**

```typescript
// In profilia-stack.ts
const authFunction = new lambda.Function(this, 'AuthFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'authorizer.handler',
  code: lambda.Code.fromAsset('auth'),
});
```

**2. Enable AWS WAF:**

```typescript
// Add to CloudFront distribution
const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
  scope: 'CLOUDFRONT',
  defaultAction: { allow: {} },
  rules: [
    // Rate limiting rules
    {
      name: 'RateLimitRule',
      priority: 1,
      statement: {
        rateBasedStatement: {
          limit: 100,
          aggregateKeyType: 'IP',
        },
      },
      action: { block: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RateLimit',
      },
    },
  ],
  visibilityConfig: {
    sampledRequestsEnabled: true,
    cloudWatchMetricsEnabled: true,
    metricName: 'WebAcl',
  },
});
```

**3. Restrict CORS:**

Update Lambda Function URL CORS to specific domain:

```typescript
cors: {
  allowedOrigins: ['https://profolia.art'],
  allowedMethods: [lambda.HttpMethod.POST, lambda.HttpMethod.GET],
  allowedHeaders: ['Content-Type', 'Authorization'],
}
```

**4. Enable CloudWatch Alarms:**

```typescript
const errorAlarm = new cloudwatch.Alarm(this, 'LambdaErrors', {
  metric: portfolioLambda.metricErrors(),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'Alert when Lambda has too many errors',
});
```

## 🗑️ Cleanup

To delete all resources:

```powershell
cd cdk
cdk destroy --all
```

⚠️ **Warning:** This will delete:
- All generated portfolios in S3
- Progress tracking data in DynamoDB
- CloudFront distribution
- Lambda function
- Website files

## 🔧 Troubleshooting

### Issue: CDK Bootstrap Failed

**Solution:**
```powershell
cdk bootstrap --trust=$env:AWS_ACCOUNT_ID --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess
```

### Issue: Lambda Timeout

**Solution:**
- Lambda now has 15-minute timeout (max)
- Check CloudWatch logs for actual errors
- Verify OpenAI API key is valid

### Issue: Frontend Not Loading

**Solution:**
```powershell
# Check CloudFront distribution status
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID

# Wait for deployment to complete (can take 10-15 minutes)
```

### Issue: CORS Errors

**Solution:**
- Verify Lambda Function URL CORS settings
- Check browser console for specific CORS error
- Ensure CloudFront is serving correct headers

### Issue: Progress Not Updating

**Solution:**
- Verify DynamoDB table exists
- Check Lambda has write permissions
- View CloudWatch logs for progress update errors

## 🚀 Advanced Configuration

### Custom Domain

Add Route53 domain to CloudFront:

```typescript
// In profilia-stack.ts
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

const certificate = new acm.Certificate(this, 'Certificate', {
  domainName: 'profolia.art',
  validation: acm.CertificateValidation.fromDns(),
});

const distribution = new cloudfront.Distribution(this, 'Distribution', {
  // ... existing config
  domainNames: ['profolia.art', 'www.profolia.art'],
  certificate: certificate,
});

// Add DNS records
const zone = route53.HostedZone.fromLookup(this, 'Zone', {
  domainName: 'profolia.art',
});

new route53.ARecord(this, 'AliasRecord', {
  zone,
  target: route53.RecordTarget.fromAlias(
    new targets.CloudFrontTarget(distribution)
  ),
});
```

### Environment-Specific Stacks

```typescript
// Development
new ProfiliaStack(app, 'ProfiliaStack-Dev', {
  env: { account: '123', region: 'us-east-1' },
});

// Production
new ProfiliaStack(app, 'ProfiliaStack-Prod', {
  env: { account: '456', region: 'us-east-1' },
});
```

### Lambda Layers for Dependencies

Reduce deployment size:

```typescript
const layer = new lambda.LayerVersion(this, 'DependenciesLayer', {
  code: lambda.Code.fromAsset('layer'),
  compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
});

const portfolioLambda = new lambda.Function(this, 'Lambda', {
  // ... existing config
  layers: [layer],
});
```

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Lambda Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

## 🆘 Support

For issues:
1. Check CloudWatch Logs
2. Review CDK synthesis output
3. Verify IAM permissions
4. Test Lambda function directly in AWS Console

---

**Ready to deploy?** Run `cdk deploy --all` and your app will be live in ~10 minutes! 🚀
