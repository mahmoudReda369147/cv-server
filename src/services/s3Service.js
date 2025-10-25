const AWS = require('aws-sdk');
const config = require('../config/config');

// Configure AWS with credentials from environment variables
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Create S3 service object
const s3 = new AWS.S3();

/**
 * Upload a file to S3 bucket
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} fileName - The name to give the file in S3
 * @param {string} contentType - The content type of the file
 * @returns {Promise<string>} - The URL of the uploaded file
 */
const uploadToS3 = async (fileBuffer, fileName, contentType) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read' // Make the file publicly accessible
    };

    const uploadResult = await s3.upload(params).promise();
    return uploadResult.Location; // Return the URL of the uploaded file
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
};

module.exports = {
  uploadToS3
};