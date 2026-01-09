const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const PROGRESS_TABLE = process.env.PROGRESS_TABLE_NAME || 'profilia-job-progress';

/**
 * Create a new job entry in DynamoDB
 * @param {string} jobId - Unique job identifier
 * @param {string} fileName - Original file name
 * @returns {Promise<void>}
 */
async function createJob(jobId, fileName) {
    const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now
    
    const command = new PutCommand({
        TableName: PROGRESS_TABLE,
        Item: {
            jobId,
            fileName,
            status: 'started',
            progress: 0,
            stage: 'File uploaded',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ttl
        }
    });

    await docClient.send(command);
}

/**
 * Update job progress
 * @param {string} jobId - Job identifier
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} stage - Current processing stage
 * @param {string} status - Job status (processing, completed, failed)
 * @param {object} additionalData - Additional data to store
 * @returns {Promise<void>}
 */
async function updateJobProgress(jobId, progress, stage, status = 'processing', additionalData = {}) {
    try {
        const command = new UpdateCommand({
            TableName: PROGRESS_TABLE,
            Key: { jobId },
            UpdateExpression: 'SET progress = :progress, stage = :stage, #status = :status, updatedAt = :updatedAt, #data = :data',
            ExpressionAttributeNames: {
                '#status': 'status',
                '#data': 'data'
            },
            ExpressionAttributeValues: {
                ':progress': progress,
                ':stage': stage,
                ':status': status,
                ':updatedAt': new Date().toISOString(),
                ':data': additionalData
            }
        });

        await docClient.send(command);
        console.log(`Progress updated: ${jobId} - ${progress}% - ${stage}`);
    } catch (error) {
        console.error('Error updating job progress:', error);
        // Don't throw error - we don't want progress tracking to break the main flow
    }
}

/**
 * Mark job as completed
 * @param {string} jobId - Job identifier
 * @param {string} portfolioUrl - URL of the generated portfolio
 * @param {object} metadata - Additional metadata
 * @returns {Promise<void>}
 */
async function completeJob(jobId, portfolioUrl, metadata = {}) {
    await updateJobProgress(jobId, 100, 'Portfolio ready', 'completed', {
        portfolioUrl,
        ...metadata
    });
}

/**
 * Mark job as failed
 * @param {string} jobId - Job identifier
 * @param {string} errorMessage - Error message
 * @returns {Promise<void>}
 */
async function failJob(jobId, errorMessage) {
    await updateJobProgress(jobId, 0, 'Failed', 'failed', {
        error: errorMessage
    });
}

/**
 * Get job status
 * @param {string} jobId - Job identifier
 * @returns {Promise<object|null>} Job data or null if not found
 */
async function getJobStatus(jobId) {
    try {
        const command = new GetCommand({
            TableName: PROGRESS_TABLE,
            Key: { jobId }
        });

        const response = await docClient.send(command);
        return response.Item || null;
    } catch (error) {
        console.error('Error getting job status:', error);
        return null;
    }
}

module.exports = {
    createJob,
    updateJobProgress,
    completeJob,
    failJob,
    getJobStatus
};
