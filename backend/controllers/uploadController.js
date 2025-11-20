const { uploadToCloudinary } = require('../services/storageService');

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const imageUrl = await uploadToCloudinary(req.file.buffer);

    res.json({
      url: imageUrl
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { uploadImage };
