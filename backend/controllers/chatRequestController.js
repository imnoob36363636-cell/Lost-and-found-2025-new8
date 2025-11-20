const ChatRequest = require('../models/ChatRequest');
const Item = require('../models/Item');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { createNotification } = require('../utils/notificationHelper');

const submitVerificationAnswer = async (req, res) => {
  try {
    const { itemId, answer } = req.body;

    const item = await Item.findById(itemId);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (!item.verificationQuestion) {
      return res.status(400).json({
        message: 'This item does not have a verification question',
      });
    }

    const requesterId = req.user._id;
    const ownerId = item.user;

    if (requesterId.toString() === ownerId.toString()) {
      return res.status(400).json({
        message: 'You cannot request chat with yourself',
      });
    }

    let chatRequest = await ChatRequest.findOne({
      item: itemId,
      requester: requesterId,
      owner: ownerId,
    });

    const answerCorrect = answer.toLowerCase().trim() === item.verificationAnswer;

    if (!chatRequest) {
      chatRequest = await ChatRequest.create({
        item: itemId,
        requester: requesterId,
        owner: ownerId,
        verificationQuestion: item.verificationQuestion,
        correctAnswer: item.verificationAnswer,
        submittedAnswer: answer.toLowerCase().trim(),
        answerCorrect,
        status: answerCorrect ? 'pending' : 'pending',
      });
    } else {
      chatRequest.submittedAnswer = answer.toLowerCase().trim();
      chatRequest.answerCorrect = answerCorrect;
      await chatRequest.save();
    }

    if (answerCorrect) {
      await createNotification({
        user: ownerId,
        type: 'chat_request',
        title: 'New Chat Request',
        message: `${req.user.name} answered your verification question correctly`,
        relatedChatRequest: chatRequest._id,
      });
    }

    res.json({
      success: answerCorrect,
      message: answerCorrect
        ? 'Answer correct! Chat request sent to owner for approval'
        : 'Incorrect answer. Please try again.',
      chatRequest: chatRequest._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getIncomingChatRequests = async (req, res) => {
  try {
    const ownerId = req.user._id;

    const chatRequests = await ChatRequest.find({
      owner: ownerId,
      answerCorrect: true,
    })
      .populate('requester', 'name email')
      .populate('item', 'title type')
      .sort({ createdAt: -1 });

    const formatted = chatRequests.map((cr) => ({
      id: cr._id,
      requesterName: cr.requester.name,
      requesterEmail: cr.requester.email,
      requesterId: cr.requester._id,
      itemTitle: cr.item.title,
      itemType: cr.item.type,
      submittedAnswer: cr.submittedAnswer,
      status: cr.status,
      createdAt: cr.createdAt,
    }));

    res.json({ chatRequests: formatted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveChatRequest = async (req, res) => {
  try {
    const { chatRequestId } = req.params;

    const chatRequest = await ChatRequest.findById(chatRequestId);

    if (!chatRequest) {
      return res.status(404).json({ message: 'Chat request not found' });
    }

    if (chatRequest.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (!chatRequest.answerCorrect) {
      return res.status(400).json({ message: 'Answer was not correct' });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [chatRequest.requester, chatRequest.owner] },
      item: chatRequest.item,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [chatRequest.requester, chatRequest.owner],
        item: chatRequest.item,
      });
    }

    chatRequest.status = 'approved';
    chatRequest.conversation = conversation._id;
    await chatRequest.save();

    await createNotification({
      user: chatRequest.requester,
      type: 'chat_approved',
      title: 'Chat Request Approved',
      message: `${req.user.name} approved your chat request`,
      relatedConversation: conversation._id,
    });

    res.json({
      message: 'Chat request approved',
      conversation: conversation._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const declineChatRequest = async (req, res) => {
  try {
    const { chatRequestId } = req.params;

    const chatRequest = await ChatRequest.findById(chatRequestId);

    if (!chatRequest) {
      return res.status(404).json({ message: 'Chat request not found' });
    }

    if (chatRequest.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    chatRequest.status = 'declined';
    await chatRequest.save();

    await createNotification({
      user: chatRequest.requester,
      type: 'chat_declined',
      title: 'Chat Request Declined',
      message: `${req.user.name} declined your chat request`,
    });

    res.json({ message: 'Chat request declined' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getChatRequestStatus = async (req, res) => {
  try {
    const { itemId } = req.params;
    const requesterId = req.user._id;

    const chatRequest = await ChatRequest.findOne({
      item: itemId,
      requester: requesterId,
    });

    if (!chatRequest) {
      return res.json({
        hasRequest: false,
        answered: false,
      });
    }

    res.json({
      hasRequest: true,
      answered: chatRequest.submittedAnswer !== null,
      answerCorrect: chatRequest.answerCorrect,
      status: chatRequest.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  submitVerificationAnswer,
  getIncomingChatRequests,
  approveChatRequest,
  declineChatRequest,
  getChatRequestStatus,
};
