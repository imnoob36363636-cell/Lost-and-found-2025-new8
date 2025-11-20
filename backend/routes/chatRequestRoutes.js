const express = require('express');
const {
  submitVerificationAnswer,
  getIncomingChatRequests,
  approveChatRequest,
  declineChatRequest,
  getChatRequestStatus,
} = require('../controllers/chatRequestController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/answer', protect, submitVerificationAnswer);
router.get('/incoming', protect, getIncomingChatRequests);
router.get('/status/:itemId', protect, getChatRequestStatus);
router.patch('/:chatRequestId/approve', protect, approveChatRequest);
router.patch('/:chatRequestId/decline', protect, declineChatRequest);

module.exports = router;
