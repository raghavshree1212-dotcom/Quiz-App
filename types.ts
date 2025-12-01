export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  topic: string;
  subject: string;
  explanation?: string; // Cache explanation if generated
}

export interface QuizResult {
  id: string;
  userId: string;
  timestamp: number;
  score: number;
  totalQuestions: number;
  topic: string;
  details: {
    questionId: string;
    selectedOption: string | null; // null if unattempted
    isCorrect: boolean;
  }[];
}

export interface Bookmark {
  userId: string;
  questionId: string;
  timestamp: number;
}

export interface AppState {
  view: 'dashboard' | 'quiz' | 'review' | 'admin' | 'auth';
  currentUser: User | null;
  activeQuiz: {
    questions: Question[];
    currentIndex: number;
    answers: Record<string, string | null>; // questionId -> selectedOption
    startTime: number;
    topic: string;
  } | null;
  lastResult: QuizResult | null;
}

export type QuestionCount = 10 | 20 | 25 | 'Full';
