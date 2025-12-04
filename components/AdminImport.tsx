import React, { useState, useRef } from "react";
import { geminiService } from "../services/geminiService";
import { storageService } from "../services/storageService";
import { Question } from "../types";
import {
  Upload,
  Image as ImageIcon,
  FileText,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  PlusCircle
} from "lucide-react";

type Mode = "text" | "image" | "file";

const AdminImport: React.FC<{ userId: string }> = ({ userId }) => {
  const [mode, setMode] = useState<Mode>("text");
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [questionCount, setQuestionCount] = useState<number>(5);

  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Generate Questions
  // ------------------------------------------------------------------
  const handleGenerate = async () => {
    if (!subject.trim() || !topic.trim()) {
      setResultMsg({ type: "error", text: "Please enter both Subject and Topic." });
      return;
    }

    if (questionCount < 1) {
      setResultMsg({ type: "error", text: "Question count should be at least 1." });
      return;
    }

    setLoading(true);
    setResultMsg(null);

    try {
      let questions: Question[] = [];

      if (mode === "text") {
        questions = await geminiService.generateQuestionsFromText(
          subject,
          topic,
          questionCount
        );
      } else if (mode === "image") {
        if (images.length === 0) {
          throw new Error("Please upload at least one image.");
        }
        questions = await geminiService.generateQuestionsFromImages(
          images,
          subject,
          topic,
          questionCount
        );
      } else if (mode === "file") {
        if (!fileContent) {
          throw new Error("Please upload a valid file.");
        }
        questions = await geminiService.generateQuestionsFromFile(
          fileContent,
          subject,
          topic,
          questionCount
        );
      }

      if (!questions || questions.length === 0) {
        throw new Error("AI did not generate any usable questions.");
      }

      // 1) Remove duplicates by text
      const uniqueByText = Array.from(
        new Map(questions.map((q) => [q.text.trim(), q])).values()
      );

      // 2) Enforce EXACTLY up to requested count
     const finalQuestions = uniqueByText.slice(0, questionCount);

if (finalQuestions.length === 0) {
  throw new Error("No unique questions found after filtering.");
}

// Inject unique IDs
const finalWithIds = finalQuestions.map(q => ({
  ...q,
  id: crypto.randomUUID(),
}));

await storageService.addQuestions(userId, finalWithIds);


      setResultMsg({
        type: "success",
        text: `Added ${finalQuestions.length} questions`
      });

      // Reset only mode-specific state
      setImages([]);
      setFileContent(null);

    } catch (err: any) {
      setResultMsg({
        type: "error",
        text: err?.message || "Unexpected error occurred."
      });
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Image Upload (Base64)
  // ------------------------------------------------------------------
 const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files) return;

  const files = Array.from(e.target.files).slice(0, 10);

  Promise.all(
    files.map(
      (file:File) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file); // VERY IMPORTANT
        })
    )
  ).then((base64s) => setImages((prev) => [...prev, ...base64s]));
};
;

  // ------------------------------------------------------------------
  // File Upload (Text-based)
  // ------------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileContent(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  // ------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
          <PlusCircle className="w-6 h-6 text-indigo-600" />
          AI Content Importer
        </h2>

        <p className="text-slate-500 mb-6">
          Generate quiz questions from text prompts, uploaded images (up to 10), or large text files.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "text", label: "Text Prompt", icon: FileText },
            { id: "image", label: "Images (1–10)", icon: ImageIcon },
            { id: "file", label: "Text File", icon: Upload }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setMode(tab.id as Mode);
                  setResultMsg(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                  mode === tab.id
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-6">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Example: Physics, JavaScript, History"
            />
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Example: Motion, React Hooks"
            />
          </div>

          {/* Info Box */}
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-indigo-800 text-sm font-medium">
            {mode === "text" && "AI will generate questions based on your Subject and Topic."}
            {mode === "image" && "Upload study images. AI will extract questions from image content."}
            {mode === "file" && "Upload text-based files. AI will extract questions from the file content."}
          </div>

          {/* Image Upload */}
          {mode === "image" && (
            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-6 hover:bg-slate-50 cursor-pointer text-center"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageUpload}
              />

              <ImageIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Click to upload images</p>

              {images.length > 0 && (
                <div className="flex justify-center gap-2 mt-4 flex-wrap">
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt="preview"
                      className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* File Upload */}
          {mode === "file" && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <input
                type="file"
                accept=".txt,.json,.csv,.md"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {fileContent && (
                <p className="mt-2 text-xs text-green-600">
                  File loaded successfully
                </p>
              )}
            </div>
          )}

          {/* Question Count */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Number of Questions (1–100)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={questionCount}
              onChange={(e) =>
                setQuestionCount(
                  Math.max(1, Math.min(100, Number(e.target.value) || 1))
                )
              }
              className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 disabled:opacity-50 text-lg"
          >
            {loading ? (
              <Loader2 className="animate-spin w-6 h-6" />
            ) : (
              <Sparkles className="w-6 h-6" />
            )}
            {loading ? "Processing..." : `Extract & Import ${questionCount} Questions`}
          </button>

          {/* Result Message */}
          {resultMsg && (
            <div
              className={`flex items-center gap-2 p-4 rounded-lg font-medium ${
                resultMsg.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {resultMsg.type === "success" ? (
                <Check className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              {resultMsg.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminImport;
