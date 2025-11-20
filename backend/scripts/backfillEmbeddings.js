require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('../models/Item');
const { generateTextEmbedding, generateBatchEmbeddings } = require('../services/mlService');

const BATCH_SIZE = 10;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lost-found');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const backfillEmbeddings = async () => {
  try {
    const itemsWithoutEmbedding = await Item.find({
      $or: [
        { embedding: { $exists: false } },
        { embedding: [] },
        { embedding: { $size: 0 } }
      ]
    }).lean();

    console.log(`Found ${itemsWithoutEmbedding.length} items without embeddings`);

    if (itemsWithoutEmbedding.length === 0) {
      console.log('All items have embeddings. Nothing to backfill.');
      return;
    }

    // Process in batches
    for (let i = 0; i < itemsWithoutEmbedding.length; i += BATCH_SIZE) {
      const batch = itemsWithoutEmbedding.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(itemsWithoutEmbedding.length / BATCH_SIZE)}`);

      const textsForEmbedding = batch.map(item =>
        `${item.title} ${item.description} ${item.category} ${item.location}`
      );

      try {
        const embeddings = await generateBatchEmbeddings(textsForEmbedding);

        if (embeddings && embeddings.length === batch.length) {
          // Update each item with its embedding
          for (let j = 0; j < batch.length; j++) {
            const item = batch[j];
            const embedding = embeddings[j];

            if (embedding && embedding.length === 768) {
              await Item.updateOne(
                { _id: item._id },
                { embedding }
              );
              console.log(`Updated item: ${item.title}`);
            }
          }
        } else {
          console.warn(`Batch embedding returned unexpected count or format`);
        }
      } catch (batchError) {
        console.error(`Error processing batch starting at index ${i}:`, batchError.message);
      }

      // Small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\nBackfill completed successfully!');
  } catch (error) {
    console.error('Backfill error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

connectDB().then(() => backfillEmbeddings());
