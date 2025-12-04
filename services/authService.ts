import { auth, googleProvider } from './firebaseConfig';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseAuthListener,
  User as FirebaseUser,
} from 'firebase/auth';

import { User } from '../types';

export const authService = {
  // -------------------------------------------------------------
  // Convert Firebase User → App User Object
  // -------------------------------------------------------------
  transformUser(firebaseUser: FirebaseUser): User {
    return {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName || 'User',
      email: firebaseUser.email || '',
      photoURL:
        firebaseUser.photoURL ||
        'https://ui-avatars.com/api/?name=User&background=444&color=fff',
    };
  },

  // -------------------------------------------------------------
  // GOOGLE SIGN-IN
  // -------------------------------------------------------------
  async signInWithGoogle(): Promise<User> {
    try {
      // Clear old guest data before logging in a new Google user
      localStorage.removeItem("quiz_guest_data");
      localStorage.removeItem("quiz_local_questions");
      
      const result = await signInWithPopup(auth, googleProvider);
      return this.transformUser(result.user);
      

    } catch (error: any) {
      console.error("Google Login Failed:", error);

      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error("Login popup was closed.");
      }

      if (error.code === 'auth/cancelled-popup-request') {
        throw new Error("Another login popup is already open.");
      }

      throw error;
    }
  },

  // -------------------------------------------------------------
  // SIGN OUT
  // -------------------------------------------------------------
  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);

      // Ensure ALL user-specific cached data is cleared
      localStorage.removeItem("quiz_guest_data");
      localStorage.removeItem("quiz_local_questions");

    } catch (error) {
      console.error("Sign Out Failed:", error);
      throw error;
    }
  },

  // -------------------------------------------------------------
  // GUEST LOGIN (fully local session)
  // -------------------------------------------------------------
  async loginAsGuest(): Promise<User> {
    // Reset any previous guest or user local data
    localStorage.removeItem("quiz_guest_data");
    localStorage.removeItem("quiz_local_questions");

    const guest: User = {
      uid: `guest_${Date.now()}`,
      displayName: 'Guest Explorer',
      email: '',
      photoURL:
        'https://ui-avatars.com/api/?name=Guest&background=6366f1&color=fff',
    };

    // Store guest flag
    localStorage.setItem("quiz_guest_data", JSON.stringify(guest));

    return guest;
  },

  // -------------------------------------------------------------
  // AUTH LISTENER
  // IMPORTANT FIX:
  //  - Does NOT override guest users
  //  - Ensures new Google user does NOT inherit old user data
  // -------------------------------------------------------------
  onAuthStateChanged(callback: (user: User | null) => void) {
    return firebaseAuthListener(auth, (firebaseUser) => {
      const guestData = localStorage.getItem("quiz_guest_data");

      // If a guest is active AND Firebase says "null", keep the guest session
      if (!firebaseUser && guestData) {
        callback(JSON.parse(guestData));
        return;
      }

      // If a Firebase user exists
      if (firebaseUser) {
        const cleanedUser = this.transformUser(firebaseUser);

        // When a real Google user logs in, remove guest data completely
        localStorage.removeItem("quiz_guest_data");

        callback(cleanedUser);
        return;
      }

      // No Firebase user AND no guest → move back to login screen
      callback(null);
    });
  },
};
