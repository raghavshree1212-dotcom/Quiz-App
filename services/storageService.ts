// src/services/storageService.ts
import { db } from "./firebaseConfig";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { Question, QuizResult } from "../types";

export const storageService = {
  // ----------------------------------------------------
  // USER-SPECIFIC QUESTION BANK
  // ----------------------------------------------------
 async addQuestions(userId: string, questions: Question[]): Promise<void> {
  const colRef = collection(db, "users", userId, "questions");

  const ops = questions.map((q) => {
    // ALWAYS assign unique Firestore ID
    const docRef = doc(colRef, crypto.randomUUID());

    return setDoc(docRef, {
      ...q,
      id: docRef.id,   // keep ID stored inside the question
    });
  });

  await Promise.all(ops);
}
,

  async getQuestions(userId: string): Promise<Question[]> {
  const snapshot = await getDocs(collection(db, "users", userId, "questions"));

  const list: Question[] = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    // Ignore invalid docs (array format)
    if (Array.isArray(data.questions)) {
      return; // skip bad document
    }

    // Validate single question format
    if (data.id && data.text && data.options && data.correctAnswer) {
      list.push(data as Question);
    }
  });

  return list;
}
,

  async getQuestionsByIds(userId: string, ids: string[]): Promise<Question[]> {
    if (!ids || ids.length === 0) return [];

    const all = await this.getQuestions(userId);
    const map = new Map(all.map((q) => [q.id, q]));

    return ids.map((id) => map.get(id)).filter(Boolean) as Question[];
  },

  // ----------------------------------------------------
  // USER QUIZ HISTORY
  // ----------------------------------------------------
  async saveQuizResult(userId: string, result: QuizResult) {
    const ref = doc(db, "users", userId, "quizHistory", result.id);
    await setDoc(ref, result);
  },

  async getQuizHistory(userId: string): Promise<QuizResult[]> {
    const snapshot = await getDocs(collection(db, "users", userId, "quizHistory"));
    return snapshot.docs.map((d) => d.data() as QuizResult);
  },

  // ----------------------------------------------------
  // USER BOOKMARKS
  // ----------------------------------------------------
  async getUserBookmarks(userId: string): Promise<string[]> {
    const ref = doc(db, "users", userId, "meta", "bookmarks");
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data().ids || [] : [];
  },

  async toggleBookmark(userId: string, qId: string): Promise<boolean> {
    const ref = doc(db, "users", userId, "meta", "bookmarks");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, { ids: [qId] });
      return true;
    }

    const ids: string[] = snap.data().ids || [];
    const isAdded = !ids.includes(qId);

    if (isAdded) {
      await updateDoc(ref, { ids: arrayUnion(qId) });
    } else {
      await updateDoc(ref, { ids: arrayRemove(qId) });
    }

    return isAdded;
  },
};
