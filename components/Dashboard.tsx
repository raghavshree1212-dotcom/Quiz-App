import React, { useEffect, useState, useCallback } from "react";
import { User, QuizResult, QuestionCount } from "../types";
import { storageService } from "../services/storageService";
import { geminiService } from "../services/geminiService";

import {
  Play,
  BookOpen,
  BarChart3,
  Brain,
  Loader2,
  Zap
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

interface DashboardProps {
  user: User;
  onStartQuiz: (topic: string, count: QuestionCount, isBookmarkMode?: boolean) => void;
  onNavigateToAdmin: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onStartQuiz, onNavigateToAdmin }) => {
  const [stats, setStats] = useState({
    totalQuestions: 0,
    bookmarksCount: 0,
    uniqueTopics: 0,
    quizzesTaken: 0
  });

  const [topics, setTopics] = useState<string[]>([]);
  const [history, setHistory] = useState<QuizResult[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("Random (All Topics)");
  const [questionCount, setQuestionCount] = useState<QuestionCount>(25);

  const [studyPlan, setStudyPlan] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  // Load dashboard data
  useEffect(() => {
    loadData();
  }, [user.uid]);

  const loadData = async () => {
    const [allQuestions, userBookmarks, userHistory] = await Promise.all([
      storageService.getQuestions(user.uid),
      storageService.getUserBookmarks(user.uid),
      storageService.getQuizHistory(user.uid)
    ]);

    // Deduplicate questions by ID
    const uniqueQuestions = Array.from(new Map(allQuestions.map(q => [q.id, q])).values());

    const uniqueTopicsList = Array.from(new Set(uniqueQuestions.map(q => q.topic))).sort();

    setTopics(["Random (All Topics)", ...uniqueTopicsList]);
    setSelectedTopic("Random (All Topics)");

    setHistory(userHistory);

    setStats({
      totalQuestions: uniqueQuestions.length,
      bookmarksCount: userBookmarks.length,
      uniqueTopics: uniqueTopicsList.length,
      quizzesTaken: userHistory.length
    });
  };

  // Generate AI Study Plan
  const generatePlan = async () => {
    setLoadingPlan(true);
    try {
      const plan = await geminiService.generateStudyPlan(history);
      setStudyPlan(plan);
    } catch {
      alert("Could not generate plan. Please try again.");
    }
    setLoadingPlan(false);
  };

  // Chart data
  const chartData =
    history?.slice(-10).map((h, i) => ({
      name: `Q${i + 1}`,
      score: (h.score / h.totalQuestions) * 100,
      topic: h.topic
    })) || [];

  // Start quiz handler
  const handleStartQuiz = useCallback(() => {
    const topic = selectedTopic === "Random (All Topics)" ? "Random" : selectedTopic;
    onStartQuiz(topic, questionCount);
  }, [selectedTopic, questionCount, onStartQuiz]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Welcome back, {user.displayName.split(" ")[0]}!
          </h1>
          <p className="text-slate-500">Ready to challenge yourself today?</p>
        </div>

        <button
          onClick={generatePlan}
          disabled={loadingPlan || history.length === 0}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {loadingPlan ? <Loader2 className="animate-spin w-4 h-4" /> : <Brain className="w-4 h-4" />}
          {studyPlan ? "Regenerate AI Plan" : "Generate AI Study Plan"}
        </button>
      </div>

      {/* AI Plan */}
      {studyPlan && (
        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-indigo-900 mb-2 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            Your Personalized Strategy
          </h3>
          <div className="prose prose-indigo text-indigo-800 max-w-none whitespace-pre-line text-sm">
            {studyPlan}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<BookOpen />} label="Total Questions" value={stats.totalQuestions} color="bg-blue-100 text-blue-600" />
        <StatCard icon={<BarChart3 />} label="Quizzes Taken" value={stats.quizzesTaken} color="bg-green-100 text-green-600" />

        {/* AI Generate Button */}
        <div
          onClick={onNavigateToAdmin}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-indigo-300 transition-all group"
        >
          <div className="p-3 rounded-xl bg-indigo-100 text-indigo-600 group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Generate New</p>
            <p className="text-lg font-bold text-indigo-600 group-hover:underline">Create with AI</p>
          </div>
        </div>

        <StatCard icon={<div className="font-bold text-lg">★</div>} label="Bookmarks" value={stats.bookmarksCount} color="bg-amber-100 text-amber-600" />
      </div>

      {/* Quiz setup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Play className="w-5 h-5 text-indigo-600" />
            Configure and Start Quiz
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Topic Select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Topic</label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Quiz Length */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Quiz Length</label>
              <select
                value={questionCount}
                onChange={(e) =>
                  setQuestionCount(e.target.value === "Full" ? "Full" : Number(e.target.value))
                }
                className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value={10}>10 Questions</option>
                <option value={20}>20 Questions</option>
                <option value={25}>25 Questions</option>
                <option value="Full">Full Quiz</option>
              </select>

              <p className="text-xs text-slate-400 mt-1">Available Qs: {stats.totalQuestions}</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <button
              onClick={handleStartQuiz}
              disabled={stats.totalQuestions === 0}
              className="w-full sm:w-auto px-8 bg-slate-500 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Quiz
            </button>

            <button
              onClick={() => onStartQuiz("Bookmarks", "Full", true)}
              disabled={stats.bookmarksCount === 0}
              className="w-full sm:w-auto px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-lg font-semibold shadow-sm border border-slate-200 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="font-bold text-amber-500">★</div>
              Start Bookmarked Review ({stats.bookmarksCount} Qs)
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Recent Performance</h2>

          <div className="w-full h-[250px] mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                  }}
                />
                <Bar dataKey="score" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {history.length === 0 && (
            <p className="text-center text-slate-400 text-sm mt-2">No quizzes taken yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  color
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
    <div>
      <p className="text-slate-500 text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  </div>
);

export default Dashboard;
