const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require('uuid');

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1'
});

/**
 * Upload HTML portfolio to S3 with public access
 * @param {string} htmlContent - The HTML content to upload
 * @param {string} originalFileName - The original file name for reference
 * @param {string} username - Optional custom username for permanent URL
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
async function uploadToS3(htmlContent, originalFileName, username = null) {
    try {
        const bucketName = process.env.S3_BUCKET_NAME;
        
        if (!bucketName) {
            throw new Error('S3_BUCKET_NAME environment variable is not set');
        }

        let s3Key;
        
        if (username) {
            // Clean username (remove special characters, convert to lowercase)
            const cleanUsername = username.toLowerCase().replace(/[^a-z0-9-_]/g, '');
            if (!cleanUsername) {
                throw new Error('Invalid username format');
            }
            // Use custom path with username for permanent URL
            s3Key = `portfolio/${cleanUsername}/index.html`;
        } else {
            // Generate unique file name for the portfolio (legacy)
            const timestamp = Date.now();
            const uniqueId = uuidv4();
            const cleanName = originalFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-');
            s3Key = `portfolios/${cleanName}-${timestamp}-${uniqueId}.html`;
        }

        // Upload parameters
        const uploadParams = {
            Bucket: bucketName,
            Key: s3Key,
            Body: htmlContent,
            ContentType: 'text/html',
            CacheControl: 'max-age=31536000', // Cache for 1 year
            Metadata: {
                'original-filename': originalFileName,
                'generated-date': new Date().toISOString()
            }
        };

        // Upload to S3
        console.log(`Uploading to S3: ${s3Key}`);
        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        // Construct public URL
        const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;
        
        console.log(`File uploaded successfully: ${publicUrl}`);
        return publicUrl;

    } catch (error) {
        console.error('Error uploading to S3:', error);
        throw new Error(`S3 upload failed: ${error.message}`);
    }
}

/**
 * Alternative: Upload with CloudFront distribution
 * @param {string} htmlContent - The HTML content to upload
 * @param {string} originalFileName - The original file name for reference
 * @returns {Promise<string>} - CloudFront URL of the uploaded file
 */
async function uploadToS3WithCloudFront(htmlContent, originalFileName) {
    try {
        // First upload to S3
        const s3Url = await uploadToS3(htmlContent, originalFileName);
        
        // If CloudFront distribution is configured, return CloudFront URL
        const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN;
        if (cloudFrontDomain) {
            const s3Key = s3Url.split('.amazonaws.com/')[1];
            return `https://${cloudFrontDomain}/${s3Key}`;
        }
        
        return s3Url;
    } catch (error) {
        throw new Error(`CloudFront upload failed: ${error.message}`);
    }
}

module.exports = {
    uploadToS3,
    uploadToS3WithCloudFront
};
