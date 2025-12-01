import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration from user provided snippet
const firebaseConfig = {
  apiKey: "AIzaSyDTJk6N5bxHTMOJ4HZ3E2ZV2R--1or2EzA",
  authDomain: "quizportal-57025.firebaseapp.com",
  projectId: "quizportal-57025",
  storageBucket: "quizportal-57025.firebasestorage.app",
  messagingSenderId: "371363017336",
  appId: "1:371363017336:web:307aeaca1d83a55f60338d",
  measurementId: "G-RFRCYL18ED"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);