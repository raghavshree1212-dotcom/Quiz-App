// src/App.tsx
import React, { useState, useEffect } from "react";
import { AppState, QuestionCount, QuizResult } from "./types";
import { authService } from "./services/authService";
import { storageService } from "./services/storageService";

import Dashboard from "./components/Dashboard";
import QuizPlayer from "./components/QuizPlayer";
import Review from "./components/Review";
import AdminImport from "./components/AdminImport";

import {
  LogOut,
  Users,
  LayoutDashboard,
  Settings,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";

/**
 * App.tsx — corrected version
 * - Safe auth listener that preserves guest sessions
 * - Robust guest checks (guard against undefined)
 * - startQuiz handles 'Full' or numeric counts correctly
 * - Loads review questions safely and logs errors
 */

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    view: "auth",
    currentUser: null,
    activeQuiz: null,
    lastResult: null,
  });

  const [loginError, setLoginError] = useState<{ code: string; message: string; domain?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // ------------------------------
  // Auth listener (subscribe once)
  // - keep guest session if already present
  // ------------------------------
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((user) => {
      if (user) {
        // Signed-in via Firebase -> ensure we land on dashboard (unless already elsewhere)
        setAppState((prev) => ({
          ...prev,
          currentUser: user,
          view: prev.view === "auth" ? "dashboard" : prev.view,
        }));
        setLoginError(null);
        return;
      }

      // firebaseUser === null
      // Functional update: preserve a local guest session if present
      setAppState((prev) => {
        const prevUid = prev.currentUser?.uid;
        const isGuest = typeof prevUid === "string" && prevUid.startsWith("guest_");

        if (isGuest) {
          // keep guest session as-is
          return prev;
        }

        // No guest — move to auth screen and clear user
        return {
          ...prev,
          currentUser: null,
          view: "auth",
        };
      });
    });

    return () => unsubscribe();
  }, []);

  // ------------------------------
  // Login handlers
  // ------------------------------
  const handleLogin = async () => {
    setLoginError(null);
    try {
      await authService.signInWithGoogle();
      // onAuthStateChanged will transition to dashboard when the firebase user is available
    } catch (e: any) {
      console.error("Login Error:", e);
      const message = e?.message ?? String(e);
      const isDomainError =
        e?.code === "auth/unauthorized-domain" || (typeof message === "string" && message.includes("unauthorized-domain"));

      if (isDomainError) {
        setLoginError({
          code: "auth/unauthorized-domain",
          message:
            "Domain not authorized. Add this domain in Firebase Console -> Authentication -> Authorized Domains",
          domain: window.location.hostname,
        });
      } else if (e?.code !== "auth/popup-closed-by-user") {
        setLoginError({
          code: e?.code || "unknown",
          message: e?.message || "An unexpected error occurred.",
          domain: window.location.hostname,
        });
      }
    }
  };

  const handleGuestLogin = async () => {
    try {
      const guestUser = await authService.loginAsGuest();
      setAppState((prev) => ({ ...prev, currentUser: guestUser, view: "dashboard" }));
      setLoginError(null);
    } catch (err) {
      console.error("Guest login failed", err);
    }
  };

  const handleLogout = async () => {
    const uid = appState.currentUser?.uid;
    const isGuest = typeof uid === "string" && uid.startsWith("guest_");

    if (isGuest) {
      // Clear local guest session immediately
      setAppState({
        view: "auth",
        currentUser: null,
        activeQuiz: null,
        lastResult: null,
      });
      return;
    }

    try {
      await authService.signOut();
      // onAuthStateChanged will update UI; but also ensure fallback:
      setAppState({
        view: "auth",
        currentUser: null,
        activeQuiz: null,
        lastResult: null,
      });
    } catch (err) {
      console.error("Sign out error:", err);
      setAppState({
        view: "auth",
        currentUser: null,
        activeQuiz: null,
        lastResult: null,
      });
    }
  };

  const handleCopyDomain = () => {
    const domain = loginError?.domain || window.location.hostname;
    navigator.clipboard.writeText(domain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ------------------------------
  // Quiz handling
  // ------------------------------
  const startQuiz = async (topic: string, count: QuestionCount, isBookmarkMode: boolean = false) => {
    const user = appState.currentUser;
    if (!user) return;

    try {
      let questions: any[] = [];

      if (isBookmarkMode) {
        const ids = await storageService.getUserBookmarks(user.uid);
questions = await storageService.getQuestionsByIds(user.uid, ids);
      } else {
const all = await storageService.getQuestions(user.uid);
        const filtered = topic === "Random" ? all : all.filter((q) => q.topic === topic);

        // Shuffle non-destructively
        const shuffled = [...filtered].sort(() => 0.5 - Math.random());

        const takeCount = count === "Full" ? shuffled.length : Number(count || 0);
        questions = shuffled.slice(0, Math.max(0, takeCount));
      }

      if (!questions || questions.length === 0) {
        alert("No questions found for this topic.");
        return;
      }

      setAppState((prev) => ({
        ...prev,
        view: "quiz",
        activeQuiz: {
          questions,
          currentIndex: 0,
          answers: {},
          startTime: Date.now(),
          topic,
        },
      }));
    } catch (err) {
      console.error("Failed to start quiz:", err);
      alert("Could not start quiz. Check console for details.");
    }
  };

  const handleQuizComplete = (result: QuizResult) => {
    setAppState((prev) => ({
      ...prev,
      view: "review",
      activeQuiz: null,
      lastResult: result,
    }));
  };

  // Resolve review questions from last result
  const [reviewQuestions, setReviewQuestions] = useState<any[]>([]);
  useEffect(() => {
    if (appState.view === "review" && appState.lastResult) {
      const ids = appState.lastResult.details.map((d) => d.questionId);
storageService
  .getQuestionsByIds(appState.currentUser.uid, ids)
  .then((qs) => {

          // ensure returned array order matches ids order (optional)
          const map = new Map(qs.map((q: any) => [q.id, q]));
          const ordered = ids.map((id) => map.get(id)).filter(Boolean);
          setReviewQuestions(ordered);
        })
        .catch((err) => {
          console.error("Failed to load review questions:", err);
          setReviewQuestions([]);
        });
    } else {
      // if not in review, clear reviewQuestions (avoid stale data)
      setReviewQuestions([]);
    }
  }, [appState.view, appState.lastResult]);

  // ------------------------------
  // Render helpers
  // ------------------------------
  const renderContent = () => {
    switch (appState.view) {
      case "auth":
        return (
          <div className="min-h-screen flex items-center justify-center bg-indigo-500">
            <div className="bg-white p-10 rounded-xl shadow-md w-full max-w-md text-center">
              <h1 className="text-2xl font-bold mb-4">Quiz Portal</h1>
              <p className="mb-6 text-gray-500">AI-powered quizzes & study plans</p>

              {loginError ? (
                <div className="bg-red-50 p-4 rounded mb-4 text-left">
                  <AlertTriangle className="inline w-5 h-5 text-red-600 mr-2" />
                  <span className="text-sm text-red-600">{loginError.message}</span>

                  <div className="mt-2 flex justify-between items-center bg-white border border-gray-200 p-2 rounded font-mono text-xs">
                    {window.location.hostname}
                    <button onClick={handleCopyDomain}>
                      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-600" />}
                    </button>
                  </div>

                  <button
                    onClick={handleGuestLogin}
                    className="mt-2 w-full bg-indigo-600 text-white py-2 rounded text-sm flex justify-center gap-2 items-center"
                  >
                    <Users className="w-4 h-4" /> Continue as Guest
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleLogin}
                    className="w-full bg-white border py-2 rounded mb-2 flex justify-center items-center gap-2"
                  >
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                    Sign in with Google
                  </button>

                  <button onClick={handleGuestLogin} className="text-indigo-600 text-sm underline">
                    Continue as Guest
                  </button>
                </>
              )}
            </div>
          </div>
        );

      case "dashboard":
        return (
          appState.currentUser && (
            <Dashboard
              user={appState.currentUser}
              onStartQuiz={startQuiz}
              onNavigateToAdmin={() => setAppState((p) => ({ ...p, view: "admin" }))}
            />
          )
        );

      case "quiz":
        return (
          appState.activeQuiz &&
          appState.currentUser && (
            <QuizPlayer
              questions={appState.activeQuiz.questions}
              topic={appState.activeQuiz.topic}
              userId={appState.currentUser.uid}
              onComplete={handleQuizComplete}
              onExit={() => setAppState((p) => ({ ...p, view: "dashboard", activeQuiz: null }))}
            />
          )
        );

      case "review":
        return (
          appState.lastResult &&
          appState.currentUser && (
            <Review result={appState.lastResult} questions={reviewQuestions} onBack={() => setAppState((p) => ({ ...p, view: "dashboard", lastResult: null }))} />
          )
        );

   case "admin":
  return <AdminImport userId={appState.currentUser.uid} />;

      default:
        return null;
    }
  };

  // ------------------------------
  // Main UI
  // ------------------------------
  return (
    <div className="min-h-screen bg-gray-50">
      {appState.currentUser && appState.view !== "auth" && (
        <nav className="bg-white border-b p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAppState((p) => ({ ...p, view: "dashboard" }))}>
            <div className="bg-indigo-600 text-white p-1.5 rounded font-bold text-lg">QP</div>
            <span className="font-bold">QuizPortal</span>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => setAppState((p) => ({ ...p, view: "dashboard" }))}>
              <LayoutDashboard className="w-5 h-5" />
            </button>

            <button onClick={() => setAppState((p) => ({ ...p, view: "admin" }))}>
              <Settings className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 ml-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{appState.currentUser?.displayName}</p>
                <p className="text-xs text-gray-500">{appState.currentUser?.email || "Guest Session"}</p>
              </div>

              <img src={appState.currentUser?.photoURL} alt="avatar" className="w-9 h-9 rounded-full border" />

              <button onClick={handleLogout}>
                <LogOut className="w-5 h-5 text-gray-400 hover:text-red-500" />
              </button>
            </div>
          </div>
        </nav>
      )}

      <main className={appState.currentUser ? "max-w-7xl mx-auto px-4 py-8" : ""}>{renderContent()}</main>
    </div>
  );
};

export default App;
