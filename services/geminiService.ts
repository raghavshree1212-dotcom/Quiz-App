import { GoogleGenAI, Type } from '@google/genai';
import { Question, QuizResult } from '../types';

// Ensure API Key is available
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper for unique ID generation
const generateId = () => Math.random().toString(36).substr(2, 9);

export const geminiService = {
  /**
   * Generates questions based on a text topic or prompt.
   */
  async generateQuestionsFromText(subject: string, topic: string, count: number = 5): Promise<Question[]> {
    if (!process.env.API_KEY) throw new Error("API Key missing");

    const prompt = `Generate ${count} multiple-choice questions for the subject "${subject}" specifically about the topic "${topic}".
    Ensure diversity in difficulty.
    Strictly output JSON.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING, description: "Must be exactly one of the options" },
                topic: { type: Type.STRING },
                subject: { type: Type.STRING }
              }
            }
          }
        }
      });

      const rawData = JSON.parse(response.text || '[]');
      // Ensure we limit to count and fallback metadata
      return rawData.slice(0, count).map((item: any) => ({
        id: generateId(),
        text: item.question,
        options: item.options,
        correctAnswer: item.correctAnswer,
        topic: topic || item.topic, // Prefer user input
        subject: subject || item.subject || 'General'
      }));

    } catch (error) {
      console.error("Gemini Gen Error:", error);
      throw new Error("Failed to generate questions. Please try again.");
    }
  },

  /**
   * Extract questions from image data (base64).
   */
  async generateQuestionsFromImages(base64Images: string[], subject: string, topic: string, count: number = 5): Promise<Question[]> {
    if (!process.env.API_KEY) throw new Error("API Key missing");

    const parts: any[] = base64Images.map(img => ({
      inlineData: {
        mimeType: 'image/jpeg', // Assuming jpeg for simplicity
        data: img.split(',')[1] 
      }
    }));

    parts.push({
      text: `Analyze these images. They contain quiz material. Extract exactly ${count} multiple-choice questions related to Subject: "${subject}", Topic: "${topic}". 
      If the images don't have enough direct questions, generate new ones based on the visual content.
      Output structured JSON.` 
    });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                topic: { type: Type.STRING },
                subject: { type: Type.STRING }
              }
            }
          }
        }
      });

      const rawData = JSON.parse(response.text || '[]');
      return rawData.slice(0, count).map((item: any) => ({
        id: generateId(),
        text: item.question,
        options: item.options,
        correctAnswer: item.correctAnswer,
        topic: topic || item.topic || 'Imported',
        subject: subject || item.subject || 'General'
      }));

    } catch (error) {
      console.error("Gemini Vision Error:", error);
      throw new Error("Failed to process images.");
    }
  },

   /**
   * Generates questions based on a file content string.
   */
   async generateQuestionsFromFile(content: string, subject: string, topic: string, count: number = 5): Promise<Question[]> {
    if (!process.env.API_KEY) throw new Error("API Key missing");
    
    // Truncate content to avoid token limits if necessary, though Flash 2.5 has large context
    const truncatedContent = content.substring(0, 30000); 

    const prompt = `Context: ${truncatedContent}
    
    Task: Generate ${count} multiple-choice questions based on the text above.
    Subject: ${subject}
    Topic: ${topic}
    Strictly output JSON.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                topic: { type: Type.STRING },
                subject: { type: Type.STRING }
              }
            }
          }
        }
      });

      const rawData = JSON.parse(response.text || '[]');
      return rawData.slice(0, count).map((item: any) => ({
        id: generateId(),
        text: item.question,
        options: item.options,
        correctAnswer: item.correctAnswer,
        topic: topic || item.topic,
        subject: subject || item.subject
      }));
    } catch (error) {
       console.error("Gemini File Gen Error:", error);
       throw new Error("Failed to generate questions from file.");
    }
  },

  /**
   * Generates a study plan based on quiz history.
   */
  async generateStudyPlan(history: QuizResult[]): Promise<string> {
    if (!process.env.API_KEY) throw new Error("API Key missing");

    const recent = history.slice(-5);
    const summary = recent.map(r => 
      `Topic: ${r.topic}, Score: ${r.score}/${r.totalQuestions}, Date: ${new Date(r.timestamp).toLocaleDateString()}`
    ).join('\n');

    const prompt = `Based on the following recent quiz performance:\n${summary}\n\n
    Provide a personalized, 3-bullet-point study plan. Be encouraging but specific about what topics to review. 
    Keep it under 100 words.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Keep practicing to generate a study plan!";
  },

  /**
   * Explains why an answer is correct/incorrect.
   */
  async explainAnswer(question: string, selected: string, correct: string): Promise<string> {
    if (!process.env.API_KEY) throw new Error("API Key missing");

    const prompt = `Question: "${question}"
    User Selected: "${selected}"
    Correct Answer: "${correct}"
    
    Explain why the correct answer is right and (if different) why the selected answer is wrong. 
    Keep it to max 5 sentences. be concise and educational.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Explanation currently unavailable.";
  }
};