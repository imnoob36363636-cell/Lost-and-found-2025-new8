const Item = require('../models/Item');
const { uploadToCloudinary } = require('../services/storageService');

const createItem = async (req, res) => {
  try {
    const { title, description, category, location, type, imageUrl, verificationQuestion, verificationAnswer } = req.body;

    const item = await Item.create({
      user: req.user._id,
      title,
      description,
      category: category?.toLowerCase?.() ?? '',
      location: location?.toLowerCase?.() ?? '',
      type,
      imageUrl: imageUrl || '',
      verificationQuestion: verificationQuestion || '',
      verificationAnswer: verificationAnswer?.toLowerCase?.()?.trim?.() ?? '',
    });

    const populatedItem = await Item.findById(item._id).populate('user', 'name email');

    res.status(201).json({ item: populatedItem });
  } catch (error) {
    console.error('createItem error:', error);
    res.status(400).json({ message: error.message });
  }
};

const getItems = async (req, res) => {
  try {
    const { category, location, type, status } = req.query;

    const filter = {};
    if (category) filter.category = category.toLowerCase();
    if (location) filter.location = location.toLowerCase();
    if (type) filter.type = type;
    if (status) filter.status = status;

    const items = await Item.find(filter).populate('user', 'name email').sort({ createdAt: -1 });

    res.json({ items });
  } catch (error) {
    console.error('getItems error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('user', 'name email');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({ item });
  } catch (error) {
    console.error('getItemById error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getUserItems = async (req, res) => {
  try {
    const items = await Item.find({ user: req.user._id }).populate('user', 'name email').sort({ createdAt: -1 });

    res.json({ items });
  } catch (error) {
    console.error('getUserItems error:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateItemStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    // One-step update: ensure ownership and return the updated document
    const updated = await Item.findOneAndUpdate(
      { _id: id, user: req.user._id }, // ensures only owner can update
      { status },
      { new: true }
    ).populate('user', 'name email');

    if (!updated) {
      return res.status(404).json({ message: 'Item not found or not authorized' });
    }

    return res.json({ item: updated });
  } catch (error) {
    console.error('updateItemStatus error:', error);
    return res.status(500).json({ message: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Item.findByIdAndDelete(req.params.id);

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('deleteItem error:', error);
    res.status(500).json({ message: error.message });
  }
};

const searchItems = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const items = await Item.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
        { location: { $regex: query, $options: 'i' } },
      ],
    })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json({ items });
  } catch (error) {
    console.error('searchItems error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createItem,
  getItems,
  getItemById,
  getUserItems,
  updateItemStatus,
  deleteItem,
  searchItems,
};
