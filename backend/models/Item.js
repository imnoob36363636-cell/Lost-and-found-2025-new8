const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'electronics',
        'clothing',
        'accessories',
        'books',
        'id cards',
        'keys',
        'other',
      ],
      lowercase: true,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      lowercase: true,
    },
    imageUrl: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      required: true,
      enum: ['lost', 'found'],
    },
    status: {
      type: String,
      enum: ['active', 'resolved', 'closed'],
      default: 'active',
    },
    reports: {
      type: Number,
      default: 0,
    },
    verificationQuestion: {
      type: String,
      default: '',
    },
    verificationAnswer: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
    },
    aiGeneratedDescription: {
      type: String,
      default: '',
    },
    embedding: {
      type: [Number],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length === 0 || arr.length === 768;
        },
        message: 'Embedding must be 768 dimensions (Gemini text-embedding-004)'
      }
    },
    embeddingGenerated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

itemSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Item', itemSchema);
