// src/components/QuizPlayer.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Question, QuizResult } from "../types";
import { storageService } from "../services/storageService";
import { Clock, Bookmark, ChevronLeft, ChevronRight } from "lucide-react";

interface QuizPlayerProps {
  questions: Question[];
  topic: string;
  userId: string;
  onComplete: (result: QuizResult) => void;
  onExit: () => void;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({
  questions,
  topic,
  userId,
  onComplete,
  onExit
}) => {
  const safeQuestions = Array.isArray(questions) ? questions : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(safeQuestions.length * 60);

  const timerRef = useRef<number | null>(null);

  // Convert correctAnswer (letter or text) → always text
  const getCorrectOptionText = (q: Question): string => {
    const ans = q.correctAnswer.trim();

    // Case 1: A/B/C/D
    if (ans.length === 1 && ans.match(/[A-D]/i)) {
      const idx = ans.toUpperCase().charCodeAt(0) - 65;
      return q.options[idx] || q.options[0];
    }

    // Case 2: Already text
    return ans;
  };

  // Reset quiz when new questions load
  useEffect(() => {
    setCurrentIndex(0);
    setAnswers({});
    setBookmarks(new Set());
    setTimeLeft(safeQuestions.length * 60);
  }, [questions]);

  // Load existing bookmarks
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const ids = await storageService.getUserBookmarks(userId);
        if (!active) return;

        const relevant = new Set(ids.filter(id => safeQuestions.some(q => q.id === id)));
        setBookmarks(relevant);
      } catch (err) {
        console.warn("Bookmark load failed", err);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, safeQuestions]);

  // Submit Quiz — fully fixed
  const handleSubmit = useCallback(() => {
    let score = 0;

    const details = safeQuestions.map(q => {
      const selected = answers[q.id] || null;
      const correctText = getCorrectOptionText(q);
      const isCorrect = selected === correctText;

      if (isCorrect) score++;

      return {
        questionId: q.id,
        selectedOption: selected,
        correctAnswer: correctText,
        isCorrect
      };
    });

    const result: QuizResult = {
      id: Math.random().toString(36).slice(2, 10),
      userId,
      timestamp: Date.now(),
      score,
      totalQuestions: safeQuestions.length,
      topic,
      details
    };

    storageService.saveQuizResult(userId, result).finally(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      onComplete(result);
    });
  }, [safeQuestions, answers, userId, topic, onComplete]);

  // Timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (safeQuestions.length === 0) return;

    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [safeQuestions.length, handleSubmit]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const q = safeQuestions[currentIndex];
  const selected = answers[q?.id] ?? null;
  const isBookmarked = bookmarks.has(q?.id);

  const progress = ((currentIndex + 1) / safeQuestions.length) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-4 shadow-sm border flex justify-between items-center">
        <button onClick={onExit} className="text-slate-500 hover:text-slate-900">
          Exit
        </button>

        <div className="font-semibold text-slate-700">{topic}</div>

        <div className="flex items-center gap-4">
          <div
            className={`px-3 py-1 rounded font-mono ${
              timeLeft < 60 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-700"
            }`}
          >
            <Clock className="inline w-4 h-4 mr-1" /> {formatTime(timeLeft)}
          </div>

          <button
            onClick={handleSubmit}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
          >
            Submit
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-slate-200 rounded overflow-hidden">
        <div
          className="h-full bg-indigo-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question */}
      <div className="bg-white p-8 rounded-xl border shadow-sm">
        <div className="flex justify-between mb-4">
          <span className="text-sm text-slate-500">
            Question {currentIndex + 1} / {safeQuestions.length}
          </span>

          <button
            onClick={async () => {
              await storageService.toggleBookmark(userId, q.id);
              setBookmarks(prev => {
                const next = new Set(prev);
                if (next.has(q.id)) next.delete(q.id);
                else next.add(q.id);
                return next;
              });
            }}
            className={`p-2 rounded-full ${
              isBookmarked ? "bg-amber-100 text-amber-600" : "text-slate-300 hover:bg-slate-100"
            }`}
          >
            <Bookmark className="w-5 h-5" />
          </button>
        </div>

        <h2 className="text-xl font-semibold text-slate-800 mb-6">{q.text}</h2>

        {q.options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const active = selected === opt;

          return (
            <button
              key={i}
              onClick={() => setAnswers(p => ({ ...p, [q.id]: opt }))}
              className={`w-full text-left p-4 border-2 rounded-xl mb-3 transition ${
                active
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                    active ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {letter}
                </div>
                {opt}
              </div>
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex(i => i - 1)}
          className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
        >
          <ChevronLeft className="inline w-5 h-5" /> Previous
        </button>

        <button
          disabled={currentIndex === safeQuestions.length - 1}
          onClick={() => setCurrentIndex(i => i + 1)}
          className="px-4 py-2 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 disabled:opacity-50"
        >
          Next <ChevronRight className="inline w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default QuizPlayer;
