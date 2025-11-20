const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_TIMEOUT = 30000;

const generateTextEmbedding = async (text) => {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/embedding`,
      { text },
      { timeout: ML_TIMEOUT }
    );

    if (response.data.success) {
      return response.data.embedding;
    } else {
      throw new Error('Embedding generation failed');
    }
  } catch (error) {
    console.error('ML Service embedding error:', error.message);
    return null;
  }
};

const generateBatchEmbeddings = async (texts) => {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/embeddings/batch`,
      { texts },
      { timeout: ML_TIMEOUT * 2 }
    );

    if (response.data.success) {
      return response.data.embeddings;
    } else {
      throw new Error('Batch embedding generation failed');
    }
  } catch (error) {
    console.error('ML Service batch embedding error:', error.message);
    return null;
  }
};

const performSemanticSearch = async (query, items) => {
  try {
    const itemDescriptions = items.map((item) => ({
      id: item._id.toString(),
      title: item.title,
      description: item.description,
      category: item.category,
      location: item.location,
      type: item.type,
      imageUrl: item.imageUrl,
      createdAt: item.createdAt,
      user: item.user,
      embedding: item.embedding || [],
    }));

    const response = await axios.post(
      `${ML_SERVICE_URL}/search`,
      {
        query,
        item_descriptions: itemDescriptions,
        threshold: 0.3,
        use_hybrid: true
      },
      { timeout: ML_TIMEOUT }
    );

    if (response.data.success) {
      return response.data.results;
    } else {
      throw new Error('Semantic search failed');
    }
  } catch (error) {
    console.error('ML Service search error:', error.message);
    return null;
  }
};

const computeSimilarity = async (embeddingA, embeddingB) => {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/similarity`,
      {
        embedding_a: embeddingA,
        embedding_b: embeddingB
      },
      { timeout: ML_TIMEOUT }
    );

    if (response.data.success) {
      return response.data.similarity;
    } else {
      throw new Error('Similarity computation failed');
    }
  } catch (error) {
    console.error('ML Service similarity error:', error.message);
    return null;
  }
};

const checkMLServiceHealth = async () => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/health`, {
      timeout: 5000,
    });
    return response.data;
  } catch (error) {
    console.error('ML Service health check failed:', error.message);
    return { status: 'unhealthy' };
  }
};

module.exports = {
  generateTextEmbedding,
  generateBatchEmbeddings,
  performSemanticSearch,
  computeSimilarity,
  checkMLServiceHealth,
};
