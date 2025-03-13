const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images are allowed.'), false);
  }
};

// Custom error handling for multer
const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('image');

// Wrapper middleware with better error handling
const upload = (req, res, next) => {
  multerUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          status: 'error',
          message: 'File size too large. Maximum size is 5MB'
        });
      }
      return res.status(400).json({
        status: 'error',
        message: 'File upload error: ' + err.message
      });
    } else if (err) {
      // Other errors
      return res.status(400).json({
        status: 'error',
        message: err.message
      });
    }
    next();
  });
};

module.exports = { upload }; 