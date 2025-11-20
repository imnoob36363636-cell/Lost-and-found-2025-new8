const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const ChatRequest = require('../models/ChatRequest');
const Item = require('../models/Item');
const { createNotification } = require('../utils/notificationHelper');

const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate('participants', 'name email')
      .populate('lastMessage')
      .populate('item', 'title')
      .sort({ updatedAt: -1 });

    const formattedConversations = conversations.map((conv) => {
      const otherUser = conv.participants.find(
        (p) => p._id.toString() !== req.user._id.toString()
      );

      const unreadMessages = conv.lastMessage
        ? conv.lastMessage.sender.toString() !== req.user._id.toString() &&
          !conv.lastMessage.read
          ? 1
          : 0
        : 0;

      return {
        id: conv._id,
        otherUser: {
          id: otherUser._id,
          name: otherUser.name,
          email: otherUser.email,
        },
        lastMessage: conv.lastMessage
          ? {
              content: conv.lastMessage.content,
              createdAt: conv.lastMessage.createdAt,
            }
          : { content: 'No messages yet', createdAt: conv.createdAt },
        unreadCount: unreadMessages,
      };
    });

    res.json({ conversations: formattedConversations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getConversationMessages = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const messages = await Message.find({ conversation: req.params.id })
      .populate('sender', 'name email')
      .sort({ createdAt: 1 });

    await Message.updateMany(
      {
        conversation: req.params.id,
        sender: { $ne: req.user._id },
        read: false,
      },
      { read: true }
    );

    const formattedMessages = messages.map((msg) => ({
      id: msg._id,
      content: msg.content,
      senderId: msg.sender._id,
      createdAt: msg.createdAt,
    }));

    res.json({ messages: formattedMessages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId).populate('item');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (conversation.item && conversation.item.verificationQuestion) {
      const chatRequest = await ChatRequest.findOne({
        item: conversation.item._id,
        requester: req.user._id,
        status: 'approved',
      });

      if (!chatRequest) {
        return res.status(403).json({
          message: 'Chat verification not approved. Answer the verification question first.',
        });
      }
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      content,
    });

    conversation.lastMessage = message._id;
    await conversation.save();

    const recipient = conversation.participants.find(
      (p) => p.toString() !== req.user._id.toString()
    );

    await createNotification({
      user: recipient,
      type: 'message',
      title: 'New Message',
      message: `${req.user.name} sent you a message`,
      relatedConversation: conversationId,
    });

    const populatedMessage = await Message.findById(message._id).populate(
      'sender',
      'name email'
    );

    const formattedMessage = {
      id: populatedMessage._id,
      content: populatedMessage.content,
      senderId: populatedMessage.sender._id,
      createdAt: populatedMessage.createdAt,
    };

    res.status(201).json({ message: formattedMessage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createConversation = async (req, res) => {
  try {
    const { recipientId, itemId, message } = req.body;

    if (recipientId === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: 'Cannot create conversation with yourself' });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, recipientId] },
      item: itemId || null,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, recipientId],
        item: itemId || null,
      });
    }

    if (message) {
      const newMessage = await Message.create({
        conversation: conversation._id,
        sender: req.user._id,
        content: message,
      });

      conversation.lastMessage = newMessage._id;
      await conversation.save();

      await createNotification({
        user: recipientId,
        type: 'message',
        title: 'New Message',
        message: `${req.user.name} sent you a message`,
        relatedConversation: conversation._id,
      });
    }

    res.status(201).json({ conversation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getConversations,
  getConversationMessages,
  sendMessage,
  createConversation,
};
