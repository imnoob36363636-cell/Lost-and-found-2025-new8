const Item = require('../models/Item');
const { uploadToCloudinary } = require('../services/storageService');
const { generateTextEmbedding, computeSimilarity } = require('../services/mlService');

const createItem = async (req, res) => {
  try {
    const { title, description, category, location, type, imageUrl, verificationQuestion, verificationAnswer } = req.body;

    // Combine text for embedding generation
    const textForEmbedding = `${title} ${description} ${category} ${location}`;

    // Generate embedding (non-blocking fallback)
    let embedding = [];
    try {
      const generatedEmbedding = await generateTextEmbedding(textForEmbedding);
      if (generatedEmbedding) {
        embedding = generatedEmbedding;
      }
    } catch (mlError) {
      console.error('Embedding generation failed:', mlError);
      // Continue without embedding
    }

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
      embedding,
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

    const filter = { status: 'active' };
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

    // Find similar items based on embedding similarity
    let similarItems = [];
    if (item.embedding && item.embedding.length === 768) {
      try {
        const allItems = await Item.find({ _id: { $ne: item._id }, status: 'active' })
          .populate('user', 'name email')
          .lean()
          .limit(100);

        const similarities = [];

        for (const otherItem of allItems) {
          if (otherItem.embedding && otherItem.embedding.length === 768) {
            const similarity = await computeSimilarity(item.embedding, otherItem.embedding);
            if (similarity !== null && similarity >= 0.40) {
              similarities.push({
                item: otherItem,
                similarity: Math.round(similarity * 1000) / 1000
              });
            }
          }
        }

        // Sort by similarity descending and take top 5
        similarities.sort((a, b) => b.similarity - a.similarity);
        similarItems = similarities.slice(0, 5).map(s => ({
          id: s.item._id.toString(),
          title: s.item.title,
          imageUrl: s.item.imageUrl,
          category: s.item.category,
          similarity: s.similarity,
          link: `/item/${s.item._id.toString()}`
        }));
      } catch (err) {
        console.error('Error computing similar items:', err);
        // Continue without similar items
      }
    }

    res.json({
      item,
      similarItems
    });
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
    const { query, useSemanticSearch } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // If semantic search is requested, try ML-powered search first
    if (useSemanticSearch) {
      try {
        const { performSemanticSearch } = require('../services/mlService');

        // Get all active items
        const allItems = await Item.find({ status: 'active' })
          .populate('user', 'name email')
          .lean();

        // Perform semantic search
        const semanticResults = await performSemanticSearch(query, allItems);

        if (semanticResults && semanticResults.length > 0) {
          // Filter results with similarity > 0.3 (threshold)
          const filteredResults = semanticResults
            .filter((result) => result.similarity > 0.3)
            .map((result) => ({
              ...result,
              id: result.item_id,
              _id: result.item_id,
            }));

          return res.json({
            items: filteredResults,
            semantic: true,
            count: filteredResults.length
          });
        }
      } catch (mlError) {
        console.error('Semantic search failed, falling back to regex:', mlError);
        // Fall through to regex search
      }
    }

    // Fallback to regex-based search
    const items = await Item.find({
      status: 'active',
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
        { location: { $regex: query, $options: 'i' } },
      ],
    })
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json({ items, semantic: false });
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
