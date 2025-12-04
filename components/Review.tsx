// src/components/Review.tsx
import React, { useState } from "react";
import { QuizResult, Question } from "../types";
import { geminiService } from "../services/geminiService";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  ArrowLeft
} from "lucide-react";

interface ReviewProps {
  result: QuizResult;
  questions: Question[];
  onBack: () => void;
}

const Review: React.FC<ReviewProps> = ({ result, questions, onBack }) => {
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const getExplanation = async (q: Question, detail: any) => {
    if (explanations[q.id]) return;

    setLoading(q.id);
    try {
      const exp = await geminiService.explainAnswer(
        q.text,
        detail.selectedOption || "No Answer",
        detail.correctAnswer
      );
      setExplanations((prev) => ({ ...prev, [q.id]: exp }));
    } catch (e) {
      console.error("AI explanation failed", e);
    } finally {
      setLoading(null);
    }
  };

  const percentage = Math.round((result.score / result.totalQuestions) * 100);

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* SUMMARY BOX */}
      <div className="bg-indigo-600 text-white p-10 rounded-3xl shadow-lg text-center">
        <h2 className="text-indigo-200 uppercase tracking-wide text-sm font-medium">
          Quiz Completed
        </h2>

        <div className="text-7xl font-extrabold my-4">{percentage}%</div>

        <p className="text-lg">
          You scored <b>{result.score}</b> out of <b>{result.totalQuestions}</b>
        </p>

        <button
          onClick={onBack}
          className="mt-6 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl"
        >
          <ArrowLeft className="inline w-4 h-4 mr-2" />
          Back to Dashboard
        </button>
      </div>

      {/* QUESTION REVIEW LIST */}
      <div className="space-y-6">
        {questions.map((q) => {
          const detail = result.details.find((d) => d.questionId === q.id);
          if (!detail) return null;

          const isCorrect = detail.isCorrect;
          const userAns = detail.selectedOption;
          const correct = detail.correctAnswer; // Now always TEXT

          return (
            <div
              key={q.id}
              className={`p-6 rounded-2xl bg-white border-l-8 shadow-sm ${
                isCorrect
                  ? "border-green-500"
                  : userAns === null
                  ? "border-amber-500"
                  : "border-red-500"
              }`}
            >
              {/* HEADER */}
              <div className="flex items-start gap-3 mb-4">
                {isCorrect ? (
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                ) : userAns === null ? (
                  <AlertCircle className="w-7 h-7 text-amber-500" />
                ) : (
                  <XCircle className="w-7 h-7 text-red-600" />
                )}

                <h3 className="text-xl font-semibold text-slate-800">
                  {q.text}
                </h3>
              </div>

              {/* OPTIONS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {q.options.map((opt, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-xl border ${
                      opt === correct
                        ? "bg-green-100 border-green-300 text-green-800 font-semibold"
                        : opt === userAns && !isCorrect
                        ? "bg-red-100 border-red-300 text-red-700 line-through"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    {opt}
                  </div>
                ))}
              </div>

              {/* AI EXPLANATION */}
              {!explanations[q.id] ? (
                <button
                  onClick={() => getExplanation(q, detail)}
                  disabled={loading === q.id}
                  className="mt-4 text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {loading === q.id ? "Asking AI Tutor..." : "Explain Answer"}
                </button>
              ) : (
                <div className="mt-4 bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-indigo-700 font-semibold mb-1">
                    <Sparkles className="w-4 h-4" /> AI Tutor Explanation
                  </div>
                  <p className="text-indigo-900 text-sm">{explanations[q.id]}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Review;
