const express = require('express');
const Conversation = require('../models/Conversation');
const { SystemPrompt } = require('../models/Training');
const Knowledge = require('../models/Knowledge');
const auth = require('../middleware/auth');
const { callHuggingFace, callGroq } = require('../config/aiService');

const router = express.Router();

// GET /api/chat/conversations - get all user conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      userId: req.user._id,
      isArchived: false
    })
      .select('title createdAt updatedAt messages model')
      .sort({ updatedAt: -1 });

    const conversationsWithPreview = conversations.map(conv => ({
      _id: conv._id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: conv.messages.length,
      lastMessage: conv.messages.length > 0
        ? conv.messages[conv.messages.length - 1].content.substring(0, 100)
        : '',
      model: conv.model
    }));

    res.json(conversationsWithPreview);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// POST /api/chat/conversations - create new conversation
router.post('/conversations', auth, async (req, res) => {
  try {
    const { title } = req.body;
    const conversation = new Conversation({
      userId: req.user._id,
      title: title || 'New Chat',
      messages: []
    });
    await conversation.save();
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// GET /api/chat/conversations/:id - get specific conversation
router.get('/conversations/:id', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// PUT /api/chat/conversations/:id - update conversation title
router.put('/conversations/:id', auth, async (req, res) => {
  try {
    const { title } = req.body;
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title },
      { new: true }
    );
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// DELETE /api/chat/conversations/:id
router.delete('/conversations/:id', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// POST /api/chat/conversations/:id/message - send message and get AI response
router.post('/conversations/:id/message', auth, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };
    conversation.messages.push(userMessage);

    // Auto-generate title from first message
    if (conversation.messages.length === 1) {
      conversation.generateTitle();
    }

    // Get active system prompt for this user
    const activePrompt = await SystemPrompt.findOne({
      userId: req.user._id,
      isActive: true
    });

    const systemPromptText = activePrompt?.prompt ||
      `You are QuantumMind, a highly advanced AI coding and reasoning assistant. 
       You specialize in software architecture, debugging complex systems, and providing efficient, 
       scalable solutions. You think analytically and prioritize clean code and logical consistency. 
       Be concise but thorough. If you don't know something, say so honestly.`;

    // Prepare messages for AI (last 20 messages for context)
    const recentMessages = conversation.messages
      .slice(-20)
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    const { compare = false } = req.body;

    // ✅ Selection logic
    const hasGroq = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());
    const hasHuggingFace = !!(process.env.HUGGINGFACE_API_KEY && process.env.HUGGINGFACE_API_KEY.trim());
    const comparisonModel = process.env.COMPARISON_MODEL;

    console.log(`\n🤖 AI Selection (Compare: ${compare}):`);
    console.log(`   Personal Model:  ${hasGroq ? '🚀 GROQ' : '🤗 HuggingFace'}`);
    if (compare) console.log(`   Powerful Model:  🤗 HuggingFace (${comparisonModel})`);

    let aiResponse;
    let comparisonResponse = null;

    try {
      // 0. Perform RAG (Retrieval Augmented Generation) - GLOBAL TECHNICAL KNOWLEDGE
      let knowledgeContext = "";
      try {
        const relevantDocs = await Knowledge.find(
          { $text: { $search: content } },
          { score: { $meta: "textScore" } }
        )
          .sort({ score: { $meta: "textScore" } })
          .limit(5);

        if (relevantDocs.length > 0) {
          knowledgeContext = relevantDocs.map(doc => `[Source: ${doc.fileName}]: ${doc.content}`).join("\n\n");
          console.log(`🧠 Technical RAG: Found ${relevantDocs.length} snippets`);
        }
      } catch (ragError) {
        console.error("RAG Search failed:", ragError.message);
      }

      // Fetch Global Admin Persona/Prompt
      const adminPersona = await SystemPrompt.findOne({ isActive: true }).sort({ createdAt: -1 });
      const baseSystemPrompt = adminPersona ? adminPersona.prompt : "You are QuantumMind, a helpful and technologically advanced AI assistant.";

      // Refine System Prompt with Specialized Technical Grounding
      const groundingHeader = `
### MISSION & WORLDVIEW
You are QuantumMind, a premier technical reasoning engine. Your goal is to assist users with complex coding tasks, system architecture, and real-world problem-solving.

1. **Analytical & Precise**: Use technical rigor and precise language.
2. **Problem Solver**: If a technical challenge or bug is presented, use logic and provided knowledge to architect the most robust solution.
3. **Evidence-Based**: Use the technical contextual knowledge below as your primary source of technical truth.

### CONTEXTUAL KNOWLEDGE (TECHNICAL DATABASE)
${knowledgeContext || "No specific technical snippets found. Use general software engineering principles and logical reasoning."}
      `;

      const finalSystemPrompt = `${groundingHeader}\n\n${baseSystemPrompt}`;

      // 1. Get Personal Model Response (Groq or HF)
      if (hasGroq) {
        aiResponse = await callGroq(recentMessages, finalSystemPrompt);
      } else if (hasHuggingFace) {
        aiResponse = await callHuggingFace(recentMessages, finalSystemPrompt);
      } else {
        aiResponse = `⚠️ **No AI API key found.**`;
      }

      // 2. Get Powerful Model Response if Compare mode is on
      if (compare) {
        try {
          // Priority: Use Groq for supported powerful models (much more reliable)
          const groqModels = ['70b', 'deepseek', 'llama3', 'mixtral', 'qwen'];
          const useGroqForComparison = hasGroq && comparisonModel &&
            groqModels.some(m => comparisonModel.toLowerCase().includes(m));

          if (useGroqForComparison) {
            comparisonResponse = await callGroq(recentMessages, finalSystemPrompt, comparisonModel);
          } else if (hasHuggingFace && comparisonModel) {
            comparisonResponse = await callHuggingFace(recentMessages, finalSystemPrompt, comparisonModel);
          }
        } catch (compError) {
          console.error('❌ Comparison Model failed:', compError.message);
          comparisonResponse = `⚠️ Comparison Model Error: ${compError.message}`;
        }
      }

    } catch (aiError) {
      console.error('❌ AI call failed:', aiError.message);
      aiResponse = `⚠️ AI Error: ${aiError.message}`;
    }

    // Add assistant message
    const assistantMessage = {
      role: 'assistant',
      content: aiResponse,
      comparisonContent: comparisonResponse, // This will be null if not comparing
      timestamp: new Date()
    };
    conversation.messages.push(assistantMessage);

    await conversation.save();

    res.json({
      userMessage,
      assistantMessage,
      conversationId: conversation._id,
      title: conversation.title
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// DELETE /api/chat/conversations/:id/messages - clear conversation messages
router.delete('/conversations/:id/messages', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { messages: [], title: 'New Chat' },
      { new: true }
    );
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ message: 'Messages cleared', conversation });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear messages' });
  }
});

module.exports = router;