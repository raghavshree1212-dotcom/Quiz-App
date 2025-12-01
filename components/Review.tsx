import React, { useState } from 'react';
import { QuizResult, Question } from '../types';
import { geminiService } from '../services/geminiService';
import { CheckCircle2, XCircle, AlertCircle, Sparkles, ArrowLeft } from 'lucide-react';

interface ReviewProps {
  result: QuizResult;
  questions: Question[];
  onBack: () => void;
}

const Review: React.FC<ReviewProps> = ({ result, questions, onBack }) => {
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loadingExp, setLoadingExp] = useState<string | null>(null);

  const getExplanation = async (q: Question, detail: any) => {
    if (explanations[q.id]) return;
    
    setLoadingExp(q.id);
    try {
      const exp = await geminiService.explainAnswer(
        q.text, 
        detail.selectedOption || "No Answer", 
        q.correctAnswer
      );
      setExplanations(prev => ({ ...prev, [q.id]: exp }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingExp(null);
    }
  };

  const percentage = Math.round((result.score / result.totalQuestions) * 100);
  let gradeColor = 'text-red-600';
  if (percentage >= 80) gradeColor = 'text-green-600';
  else if (percentage >= 60) gradeColor = 'text-amber-600';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
        <h2 className="text-slate-500 font-medium mb-2">Quiz Results</h2>
        <div className={`text-6xl font-bold mb-4 ${gradeColor}`}>{percentage}%</div>
        <p className="text-slate-600 mb-6">
          You scored <span className="font-bold">{result.score}</span> out of <span className="font-bold">{result.totalQuestions}</span>
        </p>
        <button onClick={onBack} className="flex items-center justify-center gap-2 mx-auto text-slate-500 hover:text-slate-800 font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>

      <div className="space-y-4">
        {questions.map((q, idx) => {
          const detail = result.details.find(d => d.questionId === q.id);
          if (!detail) return null;

          const isCorrect = detail.isCorrect;
          const isSkipped = detail.selectedOption === null;
          const userAns = detail.selectedOption;
          const hasExplanation = !!explanations[q.id];

          return (
            <div key={q.id} className={`bg-white rounded-2xl p-6 border-l-4 shadow-sm ${isCorrect ? 'border-green-500' : isSkipped ? 'border-amber-400' : 'border-red-500'}`}>
              <div className="flex items-start gap-4 mb-4">
                <div className="mt-1">
                  {isCorrect ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : 
                   isSkipped ? <AlertCircle className="w-6 h-6 text-amber-500" /> : 
                   <XCircle className="w-6 h-6 text-red-500" />}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">{q.text}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {q.options.map((opt, i) => {
                      let style = "p-2 rounded border ";
                      if (opt === q.correctAnswer) style += "bg-green-50 border-green-200 text-green-800 font-medium";
                      else if (opt === userAns && !isCorrect) style += "bg-red-50 border-red-200 text-red-800 line-through";
                      else style += "bg-slate-50 border-slate-100 text-slate-500";
                      
                      return <div key={i} className={style}>{opt}</div>
                    })}
                  </div>
                </div>
              </div>

              {/* AI Tutor Section */}
              <div className="pl-10">
                {!hasExplanation && (
                  <button 
                    onClick={() => getExplanation(q, detail)}
                    disabled={loadingExp === q.id}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" /> 
                    {loadingExp === q.id ? "Asking AI Tutor..." : "Explain Answer"}
                  </button>
                )}
                
                {hasExplanation && (
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-900 mt-3 animate-in fade-in">
                    <div className="flex items-center gap-2 mb-1 font-semibold text-indigo-700">
                      <Sparkles className="w-4 h-4" /> AI Tutor Explanation
                    </div>
                    {explanations[q.id]}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Review;
