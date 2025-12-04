import { GoogleGenerativeAI } from "@google/generative-ai";
import { Question, QuizResult } from "../types";
import { db } from "./firebaseConfig";
import { collection, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Create unique ID for each question
const generateId = () => Math.random().toString(36).substr(2, 9);

// Save helper
const saveToFirestore = async (path: string, data: any) => {
  try {
    await addDoc(collection(db, path), data);
  } catch (e) {
    console.error("Firestore save failed:", e);
  }
};

// Clean JSON returned by AI (sometimes Gemini wraps JSON in text)
const extractJson = (text: string) => {
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]") + 1;
    return JSON.parse(text.substring(start, end));
  } catch {
    throw new Error("AI returned invalid JSON.");
  }
};

export const geminiService = {
  // ==========================================================
  // TEXT → MCQ
  // ==========================================================
  async generateQuestionsFromText(subject: string, topic: string, count: number): Promise<Question[]> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
Generate exactly ${count} multiple-choice questions on:
Subject: ${subject}
Topic: ${topic}

Return ONLY a JSON array in this format:

[
  {
    "question": "text",
    "options": ["A","B","C","D"],
    "correctAnswer": "A",
    "topic": "${topic}",
    "subject": "${subject}"
  }
]
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const json = extractJson(text);

    // Save to user Firestore
    const user = getAuth().currentUser;

    if (user) {
      await saveToFirestore(`users/${user.uid}/questions`, {
        subject,
        topic,
        questions: json,
        timestamp: Date.now(),
      });
    }

    return json.map((q: any) => ({
      id: generateId(),
      text: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      topic: q.topic,
      subject: q.subject
    }));
  },

  // ==========================================================
  // IMAGE → MCQ
  // ==========================================================
  async generateQuestionsFromImages(images: string[], subject: string, topic: string, count: number): Promise<Question[]> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const imgParts = images.map(img => ({
      inlineData: {
        mimeType: "image/jpeg",
        data: img.split(",")[1]
      }
    }));

    const promptPart = {
      text: `
Extract ${count} MCQs based ONLY on these images.

Format (JSON ONLY):

[
  {
    "question": "text",
    "options": ["A","B","C","D"],
    "correctAnswer": "A",
    "topic": "${topic}",
    "subject": "${subject}"
  }
]
`
    };

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [...imgParts, promptPart]
        }
      ]
    });

    const text = result.response.text();
    const json = extractJson(text);

    const user = getAuth().currentUser;
    if (user) {
      await saveToFirestore(`users/${user.uid}/questions`, {
        subject,
        topic,
        questions: json,
        timestamp: Date.now(),
      });
    }

    return json.map((q: any) => ({
      id: generateId(),
      text: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      topic: q.topic,
      subject: q.subject
    }));
  },

  // ==========================================================
  // FILE → MCQ
  // ==========================================================
  async generateQuestionsFromFile(content: string, subject: string, topic: string, count: number): Promise<Question[]> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
Using ONLY this content:

${content.slice(0, 20000)}

Generate exactly ${count} MCQs in JSON format:

[
  {
    "question": "text",
    "options": ["A","B","C","D"],
    "correctAnswer": "A",
    "topic": "${topic}",
    "subject": "${subject}"
  }
]
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const json = extractJson(text);

    const user = getAuth().currentUser;
    if (user) {
      await saveToFirestore(`users/${user.uid}/questions`, {
        subject,
        topic,
        questions: json,
        timestamp: Date.now(),
      });
    }

    return json.map((q: any) => ({
      id: generateId(),
      text: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      topic: q.topic,
      subject: q.subject
    }));
  },

  // ==========================================================
  // EXPLANATION
  // ==========================================================
  async explainAnswer(question: string, selected: string, correct: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
Question: ${question}
User Selected: ${selected}
Correct Answer: ${correct}

Explain in 4 short sentences.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    await saveToFirestore("explanations", {
      question, selected, correct,
      explanation: text,
      timestamp: Date.now()
    });

    return text;
  },

  // ==========================================================
  // STUDY PLAN
  // ==========================================================
  async generateStudyPlan(history: QuizResult[]): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const summary = history
      .slice(-5)
      .map(h => `Topic: ${h.topic} | Score: ${h.score}/${h.totalQuestions}`)
      .join("\n");

    const prompt = `
Based on this quiz history:

${summary}

Write a 3-step study plan under 120 words.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    await saveToFirestore("studyPlans", {
      history, studyPlan: text, timestamp: Date.now()
    });

    return text;
  }
};
