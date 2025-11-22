const cloudinary = require('cloudinary').v2;
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configure Cloudinary
if (process.env.CLOUDINARY_URL) {
  cloudinary.config();
} else if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// Configure AWS S3 (if needed)
let s3 = null;
if (process.env.UPLOAD_PROVIDER === 'aws' || (!process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_CLOUD_NAME)) {
  s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  });
}

/**
 * Upload file to Cloudinary
 * @param {Object} file - Multer file object
 * @param {String} folder - Folder path in Cloudinary
 * @returns {Promise<String>} - Public URL of uploaded file
 */
const uploadToCloudinary = async (file, folder) => {
  return new Promise((resolve, reject) => {
    // Use data URI format for Cloudinary upload
    const uploadOptions = {
      folder: folder,
      resource_type: 'auto',
      public_id: uuidv4(), // Generate unique ID
      overwrite: false,
      invalidate: true
    };

    // Convert buffer to base64 data URI
    const base64Data = file.buffer.toString('base64');
    const dataUri = `data:${file.mimetype};base64,${base64Data}`;

    cloudinary.uploader.upload(
      dataUri,
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(new Error('Error uploading file to Cloudinary'));
        } else {
          // Return secure_url (HTTPS) for public access
          resolve(result.secure_url);
        }
      }
    );
  });
};

/**
 * Upload file to AWS S3
 * @param {Object} file - Multer file object
 * @param {String} folder - Folder path in S3
 * @returns {Promise<String>} - Public URL of uploaded file
 */
const uploadToS3 = async (file, folder) => {
  if (!s3) {
    throw new Error('AWS S3 is not configured');
  }

  const fileExtension = file.originalname.split('.').pop();
  const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read'
  };

  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Error uploading file to S3');
  }
};

/**
 * Main upload function - switches between Cloudinary and AWS based on configuration
 * @param {Object} file - Multer file object
 * @param {String} folder - Folder path
 * @returns {Promise<String>} - Public URL of uploaded file
 */
const uploadFile = async (file, folder) => {
  // Determine upload provider
  const provider = process.env.UPLOAD_PROVIDER || 'cloudinary';
  
  // Auto-detect provider if not explicitly set
  const hasCloudinaryConfig = process.env.CLOUDINARY_URL || 
                               (process.env.CLOUDINARY_CLOUD_NAME && 
                                process.env.CLOUDINARY_API_KEY && 
                                process.env.CLOUDINARY_API_SECRET);
  
  const hasAwsConfig = process.env.AWS_ACCESS_KEY_ID && 
                       process.env.AWS_SECRET_ACCESS_KEY && 
                       process.env.AWS_REGION && 
                       process.env.AWS_S3_BUCKET;

  // Use Cloudinary by default if configured, otherwise fall back to AWS
  if (provider === 'cloudinary' && hasCloudinaryConfig) {
    return uploadToCloudinary(file, folder);
  } else if (provider === 'aws' && hasAwsConfig) {
    return uploadToS3(file, folder);
  } else if (hasCloudinaryConfig) {
    return uploadToCloudinary(file, folder);
  } else if (hasAwsConfig) {
    return uploadToS3(file, folder);
  } else {
    throw new Error('No upload provider configured. Please configure either Cloudinary or AWS S3.');
  }
};

/**
 * Generate folder path for group images
 * @param {String} groupId - Group ID (MongoDB ObjectId)
 * @returns {String} - Folder path
 */
const getGroupImageFolder = (groupId) => {
  return `group_${groupId}`;
};

/**
 * Generate folder path for expense receipts/bills
 * @param {String} groupId - Group ID (MongoDB ObjectId)
 * @returns {String} - Folder path
 */
const getExpenseReceiptFolder = (groupId) => {
  return `group_${groupId}/expenses`;
};

module.exports = {
  uploadFile,
  uploadToCloudinary,
  uploadToS3,
  getGroupImageFolder,
  getExpenseReceiptFolder
};

