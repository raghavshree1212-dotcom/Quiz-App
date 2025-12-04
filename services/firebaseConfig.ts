import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// -----------------------------------------------------
// Correct Firebase Configuration
// -----------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCDaiL-WJDyedwdbtH6l4KZJm959X_M_pg",
  authDomain: "myquizapp-1e724.firebaseapp.com",
  projectId: "myquizapp-1e724",
  
  // Corrected storage bucket (MUST NOT use .firebasestorage.app)
  storageBucket: "myquizapp-1e724.appspot.com",

  messagingSenderId: "844293890344",
  appId: "1:844293890344:web:aba7188c71d2bd0b80b01d"
};

// -----------------------------------------------------
// Initialize Firebase safely (prevents duplicate init)
// -----------------------------------------------------
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// -----------------------------------------------------
// Export Firebase Services
// -----------------------------------------------------
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Provider setup
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
