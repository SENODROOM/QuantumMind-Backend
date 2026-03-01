# 🧠 QuantumMind Backend — Technical AI Reasoning Guide

> [!IMPORTANT]
> **Developer Only**: AI Training and Knowledge Base features are restricted to the **Admin** role only. Regular users cannot access these features.

This guide explains how you, as the developer, can train the AI to solve complex technical problems and assist with software engineering using advanced reasoning.

---

## 🔐 Gaining Admin Access
To use the training features in the app, you must promote your account to the `admin` role:
1. Register an account in the frontend.
2. Open a terminal in the `backend/scripts` folder.
3. Run: `node makeAdmin.js your-email@example.com`
4. Log out and log back in. The **"Train AI"** button will now appear in your sidebar.

---

## 🏗️ The Training Workflow

### 1. Define your Persona
Use the **Train AI** page to set your "Core System Prompt."
- **Technical Strategy**: Tell the AI to search the Knowledge Base and use logical proofs to solve complex engineering challenges.
- **Tone**: Instruct it to be "Analytical, Precise, and Efficient."

### 2. Knowledge Base (PDF/Text)
Upload technical documentation, architecture patterns, and system designs.
- The AI uses **Global RAG**: Any user who chats with QuantumMind will now receive answers grounded in the specific technical knowledge YOU upload.

### 3. Response Guidance
Provide "few-shot" examples of how to solve specific coding problems or architectural gaps. Focus on logic and best practices.

---

## 🚀 Deployment
Once your Knowledge Base and Persona are set, the AI is "trained" globally.

- To export your data for weight-level fine-tuning on Hugging Face, use the **JSONL Export** in settings.

---

## 🔬 Comparative Analysis
Use the **Comparison Mode** feature to see how standard AI (like Llama-3 70B) responds versus your **Grounded Islamic AI**. This helps you identify gaps where you need to upload more knowledge.