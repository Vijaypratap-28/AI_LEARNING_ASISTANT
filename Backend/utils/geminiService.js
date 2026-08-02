import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

if (!process.env.GEMINI_API_KEY) {
  console.error('FATAL ERROR: GEMINI_API_KEY is not set in the environment variables.');
  process.exit(1);
}

const createFallbackSummary = (text) => {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return 'This document contains key concepts and supporting details that can be reviewed in the uploaded content.';
  }

  return sentences.slice(0, 3).join(' ').slice(0, 1200);
};

const createFallbackFlashcards = (text, count) => {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (sentences.slice(0, Math.max(1, count || 5))).map((sentence, index) => ({
    question: `What is being explained in point ${index + 1}?`,
    answer: sentence.slice(0, 400),
    difficulty: index < 2 ? 'easy' : 'medium'
  }));
};

const createFallbackQuiz = (text, numQuestions) => {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const questions = [];
  for (let i = 0; i < Math.min(numQuestions || 5, sentences.length); i += 1) {
    const sentence = sentences[i] || 'This document discusses several important ideas.';
    questions.push({
      question: `What is the main idea of this passage?`,
      options: [
        sentence.slice(0, 120),
        'A supporting detail from the document',
        'A general introduction to the topic',
        'A conclusion or summary point'
      ],
      correctAnswer: sentence.slice(0, 120),
      explanation: 'This fallback question was generated from the uploaded document content.',
      difficulty: i % 2 === 0 ? 'easy' : 'medium'
    });
  }

  return questions;
};

const createFallbackChatAnswer = (question, chunks) => {
  const context = chunks.map((chunk) => chunk.content || '').join(' ');
  if (!context.trim()) {
    return 'I could not find enough context in the document to answer that question confidently.';
  }

  const keywords = question.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const matchedKeyword = keywords.find((keyword) => context.toLowerCase().includes(keyword));

  if (matchedKeyword) {
    return `The document appears to discuss "${matchedKeyword}" in the available context. Review the relevant section for a fuller explanation.`;
  }

  return `The document contains related material, but the answer needs a closer review of the surrounding context.`;
};

const createFallbackConceptExplanation = (concept, context) => {
  if (!context.trim()) {
    return `I could not find enough context to explain "${concept}" clearly.`;
  }

  return `The concept "${concept}" appears to be discussed within the uploaded document context. Review the relevant passages for a more detailed explanation.`;
};

/**
 * Generate flashcards from text
 * @param {string} text - Document text
 * @param {number} count - Number of flashcards to generate
 * @returns {Promise<Array<{question: string, answer: string, difficulty: string}>>}
 */
export const generateFlashcards = async (text, count = 10) => {
  const prompt = `Generate exactly ${count} educational flashcards from the following text.
Format each flashcard as:
Q: [Clear, specific question]
A: [Concise, accurate answer]
D: [Difficulty level: easy, medium, or hard]

Separate each flashcard with "---"

Text:
${text.substring(0, 15000)}`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const generatedText = response.text;

    // Parse the response
    const flashcards = [];
    const cards = generatedText.split('---').filter(c => c.trim());

    for (const card of cards) {
      const lines = card.trim().split('\n');
      let question = '', answer = '', difficulty = 'medium';

      for (const line of lines) {
        if (line.startsWith('Q:')) {
          question = line.substring(2).trim();
        } else if (line.startsWith('A:')) {
          answer = line.substring(2).trim();
        } else if (line.startsWith('D:')) {
          const diff = line.substring(2).trim().toLowerCase();
          if (['easy', 'medium', 'hard'].includes(diff)) {
            difficulty = diff;
          }
        }
      }

      if (question && answer) {
        flashcards.push({ question, answer, difficulty });
      }
    }

    return flashcards.slice(0, count);
  } catch (error) {
    console.warn('Gemini unavailable, using fallback flashcards:', error.message);
    return createFallbackFlashcards(text, count);
  }
};

/**
 * Generate quiz questions
 * @param {string} text - Document text
 * @param {number} numQuestions - Number of questions
 * @returns {Promise<Array<{question: string, options: Array, correctAnswer: string, explanation: string, difficulty: string}>>}
 */
export const generateQuiz = async (text, numQuestions = 5) => {
  const prompt = `Generate exactly ${numQuestions} multiple choice questions from the following text.
Format each question as:
Q: [Question]
01: [Option 1]
02: [Option 2]
03: [Option 3]
04: [Option 4]
C: [Correct option - exactly as written above,no need to add option number just add currect option answer value]
E: [Brief explanation]
D: [Difficulty: easy, medium, or hard]

Separate questions with "---"

Text:
${text.substring(0, 15000)}`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const generatedText = response.text;

    const questions = [];
    const questionBlocks = generatedText.split('---').filter(q => q.trim());

    for (const block of questionBlocks) {
      const lines = block.trim().split('\n');
      let question = '', options = [], correctAnswer = '', explanation = '', difficulty = 'medium';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('Q:')) {
          question = trimmed.substring(2).trim();
        } else if (trimmed.match(/^0\d:/)) {
          options.push(trimmed.substring(3).trim());
        } else if (trimmed.startsWith('C:')) {
          correctAnswer = trimmed.substring(2).trim();
        } else if (trimmed.startsWith('E:')) {
          explanation = trimmed.substring(2).trim();
        } else if (trimmed.startsWith('D:')) {
          const diff = trimmed.substring(2).trim().toLowerCase();
          if (['easy', 'medium', 'hard'].includes(diff)) {
            difficulty = diff;
          }
        }
      }

      if (question && options.length === 4 && correctAnswer) {
        questions.push({ question, options, correctAnswer, explanation, difficulty });
      }
    }

    return questions.slice(0, numQuestions);
  } catch (error) {
    console.warn('Gemini unavailable, using fallback quiz:', error.message);
    return createFallbackQuiz(text, numQuestions);
  }
};

/**
 * Generate document summary
 * @param {string} text - Document text
 * @returns {Promise<string>}
 */
export const generateSummary = async (text) => {
  const prompt = `Provide a concise summary of the following text, highlighting the key concepts, main ideas, and important points.
Keep the summary clear and structured.

Text:
${text.substring(0, 20000)}`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const generatedText = response.text;
    return generatedText;
  } catch (error) {
    console.warn('Gemini unavailable, using fallback summary:', error.message);
    return createFallbackSummary(text);
  }
};

/**
 * Chat with document context
 * @param {string} question - User question
 * @param {Array<Object>} chunks - Relevant document chunks
 * @returns {Promise<string>}
 */
export const chatWithContext = async (question, chunks) => {
  const context = chunks.map((c, i) => `[Chunk ${i + 1}]\n${c.content}`).join('\n\n');

  const prompt = `Based on the following context from a document, Analyse the context and answer the user's question.
If the answer is not in the context, say so.

Context:
${context}

Question: ${question}

Answer:`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const generatedText = response.text;
    return generatedText;
  } catch (error) {
    console.warn('Gemini unavailable, using fallback chat answer:', error.message);
    return createFallbackChatAnswer(question, chunks);
  }
};

/**
 * Explain a specific concept
 * @param {string} concept - Concept to explain
 * @param {string} context - Relevant context
 * @returns {Promise<string>}
 */
export const explainConcept = async (concept, context) => {
  const prompt = `Explain the concept of "${concept}" based on the following context.
Provide a clear, educational explanation that's easy to understand.
Include examples if relevant.

Context:
${context.substring(0, 10000)}`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const generatedText = response.text;
    return generatedText;
  } catch (error) {
    console.warn('Gemini unavailable, using fallback concept explanation:', error.message);
    return createFallbackConceptExplanation(concept, context);
  }
};
