const mongoose = require('mongoose');

const knowledgeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String, // The extracted text snippet
        required: true
    },
    fileName: {
        type: String, // Source file name (e.g., "Islamic_Refutation.pdf")
        required: true
    },
    fileType: {
        type: String, // 'pdf' or 'txt'
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Adding a text index for full-text search during RAG
knowledgeSchema.index({ content: 'text' });

module.exports = mongoose.model('Knowledge', knowledgeSchema);
