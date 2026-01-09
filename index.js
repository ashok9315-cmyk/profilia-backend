const { extractTextFromFile } = require('./services/textExtractor');
const { generatePortfolio } = require('./services/portfolioGenerator');
const { uploadToS3 } = require('./services/s3Uploader');
const { createJob, updateJobProgress, completeJob, failJob, getJobStatus } = require('./services/progressTracker');
const { v4: uuidv4 } = require('uuid');

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];

exports.handler = async (event) => {
    try {
        // Handle GET request for status check
        if (event.requestContext?.http?.method === 'GET' || event.httpMethod === 'GET') {
            const jobId = event.queryStringParameters?.jobId;
            
            if (!jobId) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        error: 'Missing jobId parameter'
                    })
                };
            }

            const jobStatus = await getJobStatus(jobId);
            
            if (!jobStatus) {
                return {
                    statusCode: 404,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        error: 'Job not found'
                    })
                };
            }

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(jobStatus)
            };
        }

        // Handle POST request for file upload
        const body = JSON.parse(event.body);
        
        // Get file data from request
        const { file, fileName, fileType, username } = body;
        
        if (!file || !fileName) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Missing required fields: file and fileName'
                })
            };
        }
        
        // Validate username if provided
        if (username && !/^[a-zA-Z0-9-_]{3,30}$/.test(username)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Username must be 3-30 characters (letters, numbers, hyphens, underscores only)'
                })
            };
        }
        
        // Convert base64 to buffer
        const fileBuffer = Buffer.from(file, 'base64');
        
        // Validate file size
        if (fileBuffer.length > MAX_FILE_SIZE) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: `File size exceeds maximum allowed size of 2MB`
                })
            };
        }
        
        // Validate file extension
        const fileExtension = fileName.split('.').pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: `Invalid file format. Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`
                })
            };
        }
        
        console.log(`Processing file: ${fileName} (${fileExtension})`);
        
        // Generate unique job ID
        const jobId = uuidv4();
        
        // Create job entry in DynamoDB
        await createJob(jobId, fileName);
        
        // Return job ID immediately for polling
        // We'll continue processing in the background
        const response = {
            statusCode: 202, // Accepted
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Job started',
                jobId: jobId
            })
        };
        
        // Process asynchronously (Lambda will continue running)
        processResume(jobId, fileBuffer, fileExtension, fileName, username).catch(error => {
            console.error('Background processing error:', error);
            failJob(jobId, error.message);
        });
        
        return response;
        
    } catch (error) {
        console.error('Error processing request:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: error.message
            })
        };
    }
};

/**
 * Process resume in background with progress updates
 */
async function processResume(jobId, fileBuffer, fileExtension, fileName, username = null) {
    try {
        // Step 1: Extract text (10% progress)
        await updateJobProgress(jobId, 10, 'Extracting text from document...');
        const extractedText = await extractTextFromFile(fileBuffer, fileExtension);
        
        if (!extractedText || extractedText.trim().length === 0) {
            throw new Error('Could not extract text from the file');
        }
        
        console.log(`Extracted ${extractedText.length} characters from resume`);
        
        // Step 2: Generate portfolio with AI (30% -> 80% progress)
        await updateJobProgress(jobId, 30, 'Analyzing resume content...');
        
        await updateJobProgress(jobId, 50, 'Generating portfolio with AI...');
        const portfolioHTML = await generatePortfolio(extractedText);
        
        console.log('Portfolio HTML generated successfully');
        await updateJobProgress(jobId, 80, 'Portfolio generated, uploading to S3...');
        
        // Step 3: Upload to S3 (90% progress)
        await updateJobProgress(jobId, 90, 'Uploading portfolio...');
        const portfolioUrl = await uploadToS3(portfolioHTML, fileName, username);
        
        console.log(`Portfolio uploaded to: ${portfolioUrl}`);
        
        // Step 4: Complete (100% progress)
        await completeJob(jobId, portfolioUrl, {
            extractedTextLength: extractedText.length,
            fileName: fileName,
            username: username || 'N/A'
        });
        
        console.log(`Job ${jobId} completed successfully`);
        
    } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
        await failJob(jobId, error.message);
        throw error;
    }
}
