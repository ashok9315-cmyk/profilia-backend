import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import * as path from 'path';

export class ProfiliaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get environment variables
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    // Domain configuration
    const domainName = process.env.DOMAIN_NAME || 'your-domain.example.com';
    const hostedZoneId = process.env.HOSTED_ZONE_ID || 'YOUR_HOSTED_ZONE_ID';
    const zoneName = process.env.ZONE_NAME || 'example.com';

    // ========================================
    // DynamoDB Table for Progress Tracking
    // ========================================
    const progressTable = new dynamodb.Table(this, 'ProgressTable', {
      tableName: 'profilia-job-progress',
      partitionKey: {
        name: 'jobId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
      timeToLiveAttribute: 'ttl', // Auto-delete old jobs after 24 hours
    });

    // ========================================
    // S3 Bucket for Generated Portfolios
    // ========================================
    const portfolioBucket = new s3.Bucket(this, 'PortfolioBucket', {
      bucketName: `profilia-portfolios-${this.account}`,
      publicReadAccess: false, // CloudFront will handle access via OAC
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
      autoDeleteObjects: true, // Remove for production
    });

    // ========================================
    // Lambda Function for Portfolio Generation
    // ========================================
    const portfolioLambda = new lambda.Function(this, 'PortfolioLambda', {
      functionName: 'profilia-portfolio-generator',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../'), {
        exclude: ['cdk', 'public_html', '.git', '*.md', 'test-event.json', 'template.yaml', '.env']
      }),
      timeout: cdk.Duration.minutes(15), // Maximum Lambda timeout
      memorySize: 1536,
      environment: {
        S3_BUCKET_NAME: portfolioBucket.bucketName,
        ANTHROPIC_API_KEY: anthropicApiKey,
        PROGRESS_TABLE_NAME: progressTable.tableName,
      },
      layers: [],
    });

    // Grant permissions
    portfolioBucket.grantPut(portfolioLambda);
    progressTable.grantReadWriteData(portfolioLambda);

    // Lambda Function URL (replaces API Gateway)
    const functionUrl = portfolioLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.POST, lambda.HttpMethod.GET],
        allowedHeaders: ['*'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // ========================================
    // S3 Bucket for Frontend Website
    // ========================================
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `profilia-website-${this.account}`,
      publicReadAccess: false, // CloudFront will handle access
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ========================================
    // Route 53 Hosted Zone (existing)
    // ========================================
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: hostedZoneId,
      zoneName: zoneName,
    });

    // ========================================
    // ACM Certificate for Custom Domain
    // ========================================
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // ========================================
    // CloudFront Function for Directory Index
    // ========================================
    const directoryIndexFunction = new cloudfront.Function(this, 'DirectoryIndexFunction', {
      functionName: 'profilia-directory-index',
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // Check if the URI ends with a slash or has no extension
    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    } else if (!uri.includes('.')) {
        request.uri += '/index.html';
    }
    
    return request;
}
      `),
    });

    // ========================================
    // CloudFront Distribution
    // ========================================
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: [domainName],
      certificate: certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      additionalBehaviors: {
        // Serve portfolio files from the portfolio bucket
        '/portfolio/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(portfolioBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          functionAssociations: [{
            function: directoryIndexFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US, Canada, Europe
      comment: 'Profilia Website Distribution',
    });

    // ========================================
    // Route 53 A Record for Subdomain
    // ========================================
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // ========================================
    // Deploy Frontend to S3
    // ========================================
    const deployment = new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../public_html')),
        // Inject Lambda Function URL into frontend
        s3deploy.Source.jsonData('config.json', {
          apiUrl: functionUrl.url,
          region: this.region,
        }),
      ],
      destinationBucket: websiteBucket,
      distribution: distribution,
      distributionPaths: ['/*'],
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront Website URL',
      exportName: 'ProfiliaWebsiteURL',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionURL', {
      value: functionUrl.url,
      description: 'Lambda Function URL for API calls',
      exportName: 'ProfiliaLambdaURL',
    });

    new cdk.CfnOutput(this, 'PortfolioBucketName', {
      value: portfolioBucket.bucketName,
      description: 'S3 Bucket for generated portfolios',
      exportName: 'ProfiliaPortfolioBucket',
    });

    new cdk.CfnOutput(this, 'ProgressTableName', {
      value: progressTable.tableName,
      description: 'DynamoDB table for job progress tracking',
      exportName: 'ProfiliaProgressTable',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: 'ProfiliaDistributionId',
    });

    new cdk.CfnOutput(this, 'CustomDomainURL', {
      value: `https://${domainName}`,
      description: 'Custom domain URL',
    });
  }
}
