const mongoose = require('mongoose');

const chatRequestSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    verificationQuestion: {
      type: String,
      required: true,
    },
    correctAnswer: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    submittedAnswer: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    answerCorrect: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined'],
      default: 'pending',
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatRequest', chatRequestSchema);
