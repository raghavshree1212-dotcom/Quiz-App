import React, { useState, useEffect, useCallback } from 'react';
import { Question, QuizResult } from '../types';
import { storageService } from '../services/storageService';
import { Clock, Bookmark, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

interface QuizPlayerProps {
  questions: Question[];
  topic: string;
  userId: string;
  onComplete: (result: QuizResult) => void;
  onExit: () => void;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ questions, topic, userId, onComplete, onExit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(questions.length * 60); // 1 min per question
  const [startTime] = useState(Date.now());

  // Load initial bookmarks
  useEffect(() => {
    storageService.getUserBookmarks(userId).then(ids => {
      // Only set bookmarks relevant to current questions to show state correctly
      const relevant = new Set(ids.filter(id => questions.find(q => q.id === id)));
      setBookmarks(relevant);
    });
  }, [userId, questions]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleOptionSelect = (option: string) => {
    setAnswers(prev => ({ ...prev, [questions[currentIndex].id]: option }));
  };

  const toggleBookmark = async () => {
    const qId = questions[currentIndex].id;
    const isAdded = await storageService.toggleBookmark(userId, qId);
    setBookmarks(prev => {
      const newSet = new Set(prev);
      if (isAdded) newSet.add(qId);
      else newSet.delete(qId);
      return newSet;
    });
  };

  const handleSubmit = () => {
    let score = 0;
    const details = questions.map(q => {
      const selected = answers[q.id] || null;
      const isCorrect = selected === q.correctAnswer;
      if (isCorrect) score++;
      return { questionId: q.id, selectedOption: selected, isCorrect };
    });

    const result: QuizResult = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      timestamp: Date.now(),
      score,
      totalQuestions: questions.length,
      topic,
      details
    };

    storageService.saveQuizResult(userId, result).then(() => {
      onComplete(result);
    });
  };

  const currentQuestion = questions[currentIndex];
  const isBookmarked = bookmarks.has(currentQuestion.id);
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex justify-between items-center sticky top-4 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="text-slate-400 hover:text-slate-600 font-medium">Exit</button>
          <div className="h-6 w-px bg-slate-200"></div>
          <span className="font-semibold text-slate-700">{topic}</span>
        </div>
        
        <div className="flex items-center gap-4">
           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-medium ${timeLeft < 60 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'}`}>
             <Clock className="w-4 h-4" />
             {formatTime(timeLeft)}
           </div>
           <button 
             onClick={handleSubmit}
             className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
           >
             Submit Quiz
           </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px] flex flex-col">
        <div className="p-8 flex-1">
          <div className="flex justify-between items-start mb-6">
            <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <button 
              onClick={toggleBookmark}
              className={`p-2 rounded-full transition-colors ${isBookmarked ? 'bg-amber-50 text-amber-500' : 'text-slate-300 hover:bg-slate-50'}`}
            >
              <Bookmark className="w-5 h-5 fill-current" />
            </button>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-8 leading-relaxed">
            {currentQuestion.text}
          </h2>

          <div className="grid grid-cols-1 gap-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = answers[currentQuestion.id] === option;
              return (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(option)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all group ${
                    isSelected 
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900' 
                      : 'border-slate-100 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                      isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-slate-400 group-hover:border-slate-400'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className="font-medium">{option}</span>
                  </div>
                  {isSelected && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between">
          <button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          
          <button
            onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
            disabled={currentIndex === questions.length - 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
             Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizPlayer;
