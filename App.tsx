import React, { useState, useEffect } from 'react';
import { AppState, Question, QuestionCount, QuizResult, User } from './types';
import { authService } from './services/authService';
import { storageService } from './services/storageService';
import Dashboard from './components/Dashboard';
import QuizPlayer from './components/QuizPlayer';
import Review from './components/Review';
import AdminImport from './components/AdminImport';
import { LogOut, User as UserIcon, Settings, LayoutDashboard, AlertTriangle, Copy, Check, Users } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    view: 'auth',
    currentUser: null,
    activeQuiz: null,
    lastResult: null,
  });

  const [loginError, setLoginError] = useState<{code: string, message: string, domain?: string} | null>(null);
  const [copied, setCopied] = useState(false);

  // Check auth status on mount using Firebase listener
  useEffect(() => {
    // Debug log to help user identify domain in console if UI is confusing
    console.log("App is running on hostname:", window.location.hostname);

    const unsubscribe = authService.onAuthStateChanged((user) => {
      if (user) {
        setAppState(prev => ({ 
          ...prev, 
          currentUser: user, 
          view: prev.view === 'auth' ? 'dashboard' : prev.view 
        }));
        setLoginError(null);
      } else if (!appState.currentUser?.uid.startsWith('guest_')) {
        // Only reset to auth if we aren't in guest mode (guest mode isn't managed by firebase listener)
        setAppState(prev => ({ 
          ...prev, 
          currentUser: null, 
          view: 'auth' 
        }));
      }
    });

    return () => unsubscribe();
  }, [appState.currentUser]);

  const handleGuestLogin = async () => {
    try {
      const guestUser = await authService.loginAsGuest();
      setAppState(prev => ({ 
        ...prev, 
        currentUser: guestUser, 
        view: 'dashboard' 
      }));
      setLoginError(null);
    } catch (e) {
      console.error("Guest login failed", e);
    }
  };

  const handleLogin = async () => {
    setLoginError(null);
    try {
      await authService.signInWithGoogle();
      // State update handled by onAuthStateChanged
    } catch (e: any) {
      console.error("Login Error Full:", e);
      
      // Broader check for unauthorized domain errors (checks code AND message)
      const isDomainError = e.code === 'auth/unauthorized-domain' || 
                            e.message?.includes('unauthorized-domain') || 
                            e.message?.includes('unauthorized domain');

      if (isDomainError) {
        // Show error UI with the domain so user can add it to Firebase Console
        setLoginError({
          code: 'auth/unauthorized-domain',
          message: "Domain not authorized. Copy the domain below to Firebase Console -> Authentication -> Settings -> Authorized Domains.",
          domain: window.location.hostname
        });
      } else if (e.code !== 'auth/popup-closed-by-user') {
        setLoginError({
          code: e.code || 'unknown',
          message: e.message || "An unexpected error occurred.",
          domain: window.location.hostname // Ensure domain is always passed for debugging
        });
      }
    }
  };

  const handleCopyDomain = () => {
    // Use the stored error domain or fallback to current hostname
    const domainToCopy = loginError?.domain || window.location.hostname;
    navigator.clipboard.writeText(domainToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    if (appState.currentUser?.uid.startsWith('guest_')) {
      setAppState(prev => ({ ...prev, currentUser: null, view: 'auth' }));
    } else {
      await authService.signOut();
      // State update handled by onAuthStateChanged
    }
  };

  const startQuiz = async (topic: string, count: QuestionCount, isBookmarkMode: boolean = false) => {
    if (!appState.currentUser) return;

    let questions: Question[] = [];
    if (isBookmarkMode) {
      const ids = await storageService.getUserBookmarks(appState.currentUser.uid);
      questions = await storageService.getQuestionsByIds(ids);
    } else {
      const all = await storageService.getQuestions();
      if (topic === 'Random' || topic === 'Random (All Topics)') {
          questions = all;
      } else {
          questions = all.filter(q => q.topic === topic);
      }
      
      // Shuffle
      const shuffled = questions.sort(() => 0.5 - Math.random());
      const limit = count === 'Full' ? shuffled.length : count;
      questions = shuffled.slice(0, typeof limit === 'number' ? limit : shuffled.length);
    }

    if (questions.length === 0) {
      alert("No questions found for this selection.");
      return;
    }

    setAppState(prev => ({
      ...prev,
      view: 'quiz',
      activeQuiz: {
        questions,
        currentIndex: 0,
        answers: {},
        startTime: Date.now(),
        topic: isBookmarkMode ? 'Bookmarks Review' : topic
      }
    }));
  };

  const handleQuizComplete = (result: QuizResult) => {
    setAppState(prev => ({
      ...prev,
      view: 'review',
      activeQuiz: null,
      lastResult: result
    }));
  };

  // Special handling for Review to get question data
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([]);
  useEffect(() => {
    if (appState.view === 'review' && appState.lastResult) {
      const ids = appState.lastResult.details.map(d => d.questionId);
      storageService.getQuestionsByIds(ids).then(setReviewQuestions);
    }
  }, [appState.view, appState.lastResult]);

  const renderContent = () => {
    switch (appState.view) {
      case 'auth':
        return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
            <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-md w-full transition-all">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner">
                🎓
              </div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">Quiz Portal</h1>
              <p className="text-slate-500 mb-8">Master any topic with AI-powered quizzes and personalized study plans.</p>
              
              {loginError ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-800 text-sm">Authentication Error</h3>
                      <p className="text-xs text-red-600 mt-1 mb-2">{loginError.message}</p>
                      
                      {/* Always show debugging help for ANY error in this environment */}
                      <div className="bg-white p-3 rounded border border-red-100 mt-2 text-left space-y-3">
                        <p className="text-xs text-slate-600 font-medium">
                          Troubleshooting:
                        </p>
                        
                        <div className="bg-slate-50 p-2 rounded text-xs text-slate-500">
                          Current Domain to Add:
                          <div className="flex items-center justify-between gap-2 bg-white p-2 rounded mt-1 border border-slate-200 font-mono text-slate-800 break-all font-bold">
                            {window.location.hostname}
                            <button 
                                onClick={handleCopyDomain} 
                                className="p-1.5 hover:bg-slate-100 rounded shadow-sm transition-all border border-transparent hover:border-slate-200" 
                                title="Copy to clipboard"
                            >
                              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                            </button>
                          </div>
                        </div>

                        <button 
                          onClick={handleGuestLogin}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          <Users className="w-3 h-3" /> Continue as Guest Instead
                        </button>
                      </div>
                      
                      <button onClick={() => setLoginError(null)} className="text-xs font-medium text-red-700 underline mt-3 hover:text-red-900">
                        Back to Login
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <button 
                    onClick={handleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-semibold py-3 px-6 rounded-xl hover:bg-slate-50 transition-all shadow-sm hover:shadow-md group"
                  >
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                    Sign in with Google
                  </button>
                  <button 
                    onClick={handleGuestLogin}
                    className="w-full text-slate-500 text-sm font-medium hover:text-indigo-600 hover:underline transition-all"
                  >
                    Continue as Guest
                  </button>
                </div>
              )}
            </div>
            
            <div className="mt-8 text-white/50 text-xs text-center font-mono">
              Host: {window.location.hostname}
            </div>
          </div>
        );

      case 'dashboard':
        return appState.currentUser ? (
          <Dashboard 
            user={appState.currentUser} 
            onStartQuiz={startQuiz} 
            onNavigateToAdmin={() => setAppState(prev => ({ ...prev, view: 'admin' }))}
          />
        ) : null;

      case 'quiz':
        return appState.activeQuiz && appState.currentUser ? (
          <QuizPlayer 
            questions={appState.activeQuiz.questions} 
            topic={appState.activeQuiz.topic}
            userId={appState.currentUser.uid}
            onComplete={handleQuizComplete}
            onExit={() => setAppState(prev => ({ ...prev, view: 'dashboard', activeQuiz: null }))}
          />
        ) : null;

      case 'review':
        return appState.lastResult && appState.currentUser ? (
          <Review 
            result={appState.lastResult} 
            questions={reviewQuestions} 
            onBack={() => setAppState(prev => ({ ...prev, view: 'dashboard', lastResult: null }))} 
          />
        ) : null;

      case 'admin':
        return <AdminImport />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {appState.currentUser && appState.view !== 'auth' && (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAppState(p => ({...p, view: 'dashboard'}))}>
                <div className="bg-indigo-600 text-white p-1.5 rounded-lg font-bold text-lg shadow-sm">QP</div>
                <span className="font-bold text-xl tracking-tight text-slate-800">QuizPortal</span>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setAppState(p => ({ ...p, view: 'dashboard' }))}
                  className={`p-2 rounded-lg transition-colors ${appState.view === 'dashboard' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <LayoutDashboard className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setAppState(p => ({ ...p, view: 'admin' }))}
                  className={`p-2 rounded-lg transition-colors ${appState.view === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <Settings className="w-5 h-5" />
                </button>
                <div className="h-8 w-px bg-slate-200 mx-2"></div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-slate-800">{appState.currentUser.displayName}</p>
                    <p className="text-xs text-slate-500">{appState.currentUser.email || 'Guest Session'}</p>
                  </div>
                  <img src={appState.currentUser.photoURL} alt="Avatar" className="w-9 h-9 rounded-full border border-slate-200" />
                  <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors ml-2">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className={appState.currentUser ? "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" : ""}>
        {appState.view === 'review' ? (
          <Review 
            result={appState.lastResult!} 
            questions={reviewQuestions} 
            onBack={() => setAppState(prev => ({ ...prev, view: 'dashboard', lastResult: null }))}
          />
        ) : renderContent()}
      </main>
    </div>
  );
};

export default App;