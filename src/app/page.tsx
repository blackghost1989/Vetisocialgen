"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Stethoscope,
  Send,
  Loader2,
  Facebook,
  Instagram,
  AlignLeft,
  Video,
  Copy,
  CheckCircle2,
  BookOpen,
  Database,
  Trash2,
  FileText,
  RefreshCw,
  GraduationCap,
  Sparkles,
  ImageIcon,
  Download,
} from "lucide-react";

type Platform = "fb" | "ig" | "threads" | "video";

export default function Dashboard() {
  const [disease, setDisease] = useState("");
  const [service, setService] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<Platform>("fb");
  const [copied, setCopied] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pageStart, setPageStart] = useState<string>("");
  const [pageEnd, setPageEnd] = useState<string>("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["fb", "ig", "threads", "video"]);
  const [generatedPlatforms, setGeneratedPlatforms] = useState<Platform[]>([]);
  const [style, setStyle] = useState<"professional" | "social">("social");
  const [autoImage, setAutoImage] = useState(false);
  const [images, setImages] = useState<Record<string, string[]>>({});
  const [imageLoading, setImageLoading] = useState(false);

  const [isDbMode, setIsDbMode] = useState(false);
  const [dbStatus, setDbStatus] = useState({ loading: false, message: "", success: false });

  // Document management state
  const [storedDocs, setStoredDocs] = useState<{ source: string; chunkCount: number; ids: string[] }[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [docsLoading, setDocsLoading] = useState(false);
  const [deletingSource, setDeletingSource] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      setStoredDocs(data.documents || []);
      setTotalChunks(data.totalChunks || 0);
    } catch {
      console.error("Failed to fetch documents");
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const handleDeleteSource = async (source: string) => {
    if (!confirm(`確定要刪除「${source}」的所有知識片段嗎？`)) return;
    setDeletingSource(source);
    try {
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      if (data.success) {
        setDbStatus({ loading: false, message: data.message, success: true });
        fetchDocs();
      }
    } catch (err: any) {
      setDbStatus({ loading: false, message: err.message, success: false });
    } finally {
      setDeletingSource(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("⚠️ 確定要清空整個知識庫嗎？此操作無法復原！")) return;
    try {
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      const data = await res.json();
      if (data.success) {
        setDbStatus({ loading: false, message: data.message, success: true });
        setStoredDocs([]);
        setTotalChunks(0);
      }
    } catch (err: any) {
      setDbStatus({ loading: false, message: err.message, success: false });
    }
  };

  useEffect(() => {
    const savedKey = localStorage.getItem("veti_gemini_key");
    if (savedKey) setApiKey(savedKey);
  }, []);

  // Fetch stored docs when entering DB mode
  useEffect(() => {
    if (isDbMode) fetchDocs();
  }, [isDbMode, fetchDocs]);

  const [result, setResult] = useState<Record<string, any> | null>(null);



  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disease || !service) return;

    setIsGenerating(true);
    localStorage.setItem("veti_gemini_key", apiKey);
    setGeneratedPlatforms(selectedPlatforms);
    if (selectedPlatforms.length > 0) {
      setActiveTab(selectedPlatforms[0]);
    }

    try {
      const formData = new FormData();
      formData.append("disease", disease);
      formData.append("service", service);
      formData.append("apiKey", apiKey);
      formData.append("platforms", JSON.stringify(selectedPlatforms));
      formData.append("style", style);
      formData.append("useLocalDb", "true");
      if (file) {
        formData.append("file", file);
        if (pageStart) formData.append("pageStart", pageStart);
        if (pageEnd) formData.append("pageEnd", pageEnd);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "生成失敗，請稍後再試");
      }

      setResult(data);

      // Auto image generation — extract 🎨 visual design + title from generated content
      if (autoImage) {
        setImageLoading(true);
        const newImages: Record<string, string[]> = {};

        // Helper: extract image prompts from generated content (generic)
        const extractImagePrompts = (text: string): string[] => {
          const prompts: string[] = [];
          const artBlocks = text.match(/🎨[^]*?(?=\n(?:📝|💡|🏷️|🎬|🎙️|【[^🎨]|#{1,3}\s)|$)/g);
          const titleMatches = text.match(/(?:大標題|標題文字|【首圖大字】)[：:\s]*(.+)/g);

          if (artBlocks && artBlocks.length > 0) {
            for (const block of artBlocks) {
              let combinedPrompt = block.trim();
              if (titleMatches && titleMatches.length > 0) {
                combinedPrompt += `\n標題：${titleMatches[0].replace(/(?:大標題|標題文字|【首圖大字】)[：:\s]*/g, "").trim()}`;
              }
              prompts.push(combinedPrompt);
            }
          } else if (titleMatches && titleMatches.length > 0) {
            for (const t of titleMatches) {
              const titleText = t.replace(/(?:大標題|標題文字|【首圖大字】)[：:\s]*/g, "").trim();
              prompts.push(`專業獸醫衛教插圖，主題：${titleText}。風格：現代、溫馨、專業，柔和色調，適合社群媒體。`);
            }
          }
          return prompts;
        };

        // IG-specific: parse each carousel page and build prompt with text overlay instructions
        const extractIgCarouselPrompts = (text: string): string[] => {
          const prompts: string[] = [];

          // Split by page markers: 【第N頁】, 第N頁, Page N, --- separators, or numbered headers
          const pages = text.split(/(?=【第\d+頁】|(?:^|\n)第\d+頁|(?:^|\n)Page\s*\d+|(?:^|\n)#{1,3}\s*第?\d+|(?:^|\n)---)/);

          for (const page of pages) {
            if (!page.trim()) continue;

            // Extract 🎨 visual design block
            const artMatch = page.match(/🎨[^]*?(?=\n(?:大標題|標題|內文|📝|💡|🏷️)|$)/);
            // Extract title (大標題, 標題, 【首圖大字】)
            const titleMatch = page.match(/(?:大標題|標題文字?|【首圖大字】)[：:\s]*(.+)/);
            // Extract body text (內文)
            const bodyMatch = page.match(/(?:內文)[：:\s]*([^]*?)(?=\n(?:🎨|大標題|標題|【|#{1,3}\s|---)|$)/);

            if (artMatch || titleMatch) {
              const visualDesc = artMatch ? artMatch[0].trim() : "";
              const title = titleMatch ? titleMatch[1].trim() : "";
              const body = bodyMatch ? bodyMatch[1].trim().replace(/\n+/g, " ") : "";

              let prompt = "";
              if (visualDesc) {
                prompt += visualDesc + "\n";
              }
              prompt += "圖片文字疊加規則：\n";
              if (title) {
                prompt += `- 圖片上方置中顯示大標題文字：「${title}」，使用粗體大字\n`;
              }
              if (body) {
                prompt += `- 圖片下方顯示內文：「${body}」，使用較小字體\n`;
              }
              if (!visualDesc && !title && !body) continue;
              prompt += "風格：現代、溫馨、專業的獸醫衛教插圖，適合 Instagram 輪播，正方形構圖。";
              prompts.push(prompt.trim());
            }
          }

          // If page splitting didn't work, fall back to generic extraction
          if (prompts.length === 0) {
            return extractImagePrompts(text);
          }
          return prompts;
        };

        const platformLabels: Record<string, string> = {
          fb: "Facebook 貼文主圖",
          ig: "Instagram 輪播圖",
          threads: "Threads 貼文配圖",
          video: "影片縮圖",
        };

        for (const p of selectedPlatforms) {
          const content = typeof data[p] === "string" ? data[p] : flattenContent(data[p]);
          // Use IG-specific carousel parser for Instagram, generic for others
          let imagePrompts = p === "ig" ? extractIgCarouselPrompts(content) : extractImagePrompts(content);

          // Fallback: if extraction completely failed, use disease + platform as prompt
          if (imagePrompts.length === 0) {
            const label = platformLabels[p] || "社群貼文配圖";
            imagePrompts = [`專業獸醫衛教插圖，主題：${disease}。用途：${label}。風格：現代、溫馨、專業的醫療插畫風格，柔和色調，適合社群媒體，不含任何文字。`];
            console.log(`[Image] No 🎨/title found for ${p}, using fallback prompt`);
          } else {
            console.log(`[Image] Extracted ${imagePrompts.length} prompt(s) for ${p}`);
          }

          const imgs: string[] = [];
          for (const imagePrompt of imagePrompts) {
            try {
              const imgRes = await fetch("/api/image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiKey, prompt: imagePrompt, platform: p }),
              });
              const imgData = await imgRes.json();
              if (imgData.success && imgData.image) {
                imgs.push(imgData.image);
              } else {
                console.warn(`Image gen returned no image for ${p}:`, imgData.error);
              }
            } catch (err) {
              console.warn(`Image gen failed for ${p}:`, err);
            }
          }
          if (imgs.length > 0) newImages[p] = imgs;
        }
        setImages(newImages);
        setImageLoading(false);
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Flatten nested objects into readable text
  const flattenContent = (content: any): string => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.map(flattenContent).join("\n");
    if (typeof content === "object" && content !== null) {
      return Object.entries(content)
        .filter(([key]) => key !== "imagePrompts")
        .map(([key, val]) => {
          const label = key.replace(/([A-Z])/g, " $1").trim();
          return `【${label}】\n${flattenContent(val)}`;
        })
        .join("\n\n");
    }
    return String(content);
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(flattenContent(result[activeTab]));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabs: { id: Platform; label: string; icon: React.ReactNode }[] = [
    { id: "fb", label: "Facebook", icon: <Facebook className="w-4 h-4 mr-2" /> },
    { id: "ig", label: "Instagram", icon: <Instagram className="w-4 h-4 mr-2" /> },
    { id: "threads", label: "Threads", icon: <AlignLeft className="w-4 h-4 mr-2" /> },
    { id: "video", label: "影音腳本", icon: <Video className="w-4 h-4 mr-2" /> },
  ];

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !apiKey) return;

    setDbStatus({ loading: true, message: "正在將教科書轉化並寫入本地 Chroma 資料庫... (這可能需要幾分鐘)", success: false });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("apiKey", apiKey);

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "寫入資料庫失敗");
      }

      setDbStatus({ loading: false, message: data.message, success: true });
    } catch (error: any) {
      console.error(error);
      setDbStatus({ loading: false, message: error.message, success: false });
    }
  };

  const currentTabs = tabs.filter((tab) => generatedPlatforms.includes(tab.id));

  return (
    <div className="min-h-screen bg-neutral-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Veti-Social-Gen</h1>
              <p className="text-sm text-neutral-500">獸醫師專屬社群衛教文案產生器</p>
            </div>
          </div>

          <div className="flex bg-neutral-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setIsDbMode(false)}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${!isDbMode ? 'bg-white text-blue-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              寫文案 (Generate)
            </button>
            <button
              onClick={() => setIsDbMode(true)}
              className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${isDbMode ? 'bg-white text-emerald-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
            >
              <Database className="w-4 h-4 mr-2" />
              本地資料庫 (Ingest)
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 左側：輸入表單 */}
          <div className="col-span-1 lg:col-span-4 space-y-6">
            {isDbMode ? (
              // Database Ingest UI
              <div className="bg-emerald-50/50 p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center text-emerald-800">
                  <Database className="w-5 h-5 mr-2" />
                  建立本地專屬知識庫
                </h2>
                <p className="text-sm text-neutral-600 mb-4">
                  上傳獸醫教科書、原文書或權威期刊 (PDF)。系統會自動將內容轉為向量儲存於您電腦本地的 ChromaDB 中。未來產生衛教文案時，AI 將優先從這些文獻中搜尋並參考。
                </p>

                <form onSubmit={handleIngest} className="space-y-4">
                  <div>
                    <label htmlFor="apiKeyDB" className="block text-sm font-medium text-neutral-700 mb-1">
                      Google Gemini API Key (用於執行 Embeddings)
                    </label>
                    <input
                      id="apiKeyDB"
                      type="password"
                      placeholder="AI Studio 取得的 API Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="dbFile" className="block text-sm font-medium text-neutral-700 mb-1">
                      📤 上傳要學習的文獻 (PDF)
                    </label>
                    <input
                      id="dbFile"
                      type="file"
                      accept=".pdf,.txt"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] || null);
                        setPageStart("");
                        setPageEnd("");
                      }}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={dbStatus.loading || !file || !apiKey}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                  >
                    {dbStatus.loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        正在解析與寫入向量庫...
                      </>
                    ) : (
                      <>
                        <Database className="w-5 h-5 mr-2" />
                        寫入本地資料庫永久保存
                      </>
                    )}
                  </button>
                </form>

                {dbStatus.message && (
                  <div className={`mt-4 p-4 rounded-xl text-sm ${dbStatus.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {dbStatus.message}
                  </div>
                )}

                {/* Document Management Section */}
                <div className="mt-6 pt-6 border-t border-emerald-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-emerald-800 flex items-center">
                      <FileText className="w-4 h-4 mr-1.5" />
                      已存入的知識庫文件
                      {totalChunks > 0 && (
                        <span className="ml-2 text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">
                          共 {totalChunks} 段
                        </span>
                      )}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={fetchDocs}
                        disabled={docsLoading}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                        title="重新整理"
                      >
                        <RefreshCw className={`w-4 h-4 ${docsLoading ? 'animate-spin' : ''}`} />
                      </button>
                      {storedDocs.length > 0 && (
                        <button
                          onClick={handleClearAll}
                          className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors cursor-pointer"
                        >
                          清空全部
                        </button>
                      )}
                    </div>
                  </div>

                  {docsLoading ? (
                    <div className="flex items-center justify-center py-6 text-emerald-400">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      <span className="text-sm">載入中...</span>
                    </div>
                  ) : storedDocs.length === 0 ? (
                    <div className="text-center py-6 text-neutral-400">
                      <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">尚未存入任何文件</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {storedDocs.map((doc) => (
                        <div
                          key={doc.source}
                          className="flex items-center justify-between bg-white p-3 rounded-lg border border-emerald-100 shadow-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-neutral-700 truncate">{doc.source}</p>
                              <p className="text-xs text-neutral-400">{doc.chunkCount} 個知識片段</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteSource(doc.source)}
                            disabled={deletingSource === doc.source}
                            className="flex-shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title={`刪除 ${doc.source}`}
                          >
                            {deletingSource === doc.source ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Generate Content UI
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm mr-2">1</span>
                  設定主題
                </h2>
                <form onSubmit={handleGenerate} className="space-y-4">
                  <div>
                    <label htmlFor="apiKey" className="block text-sm font-medium text-neutral-700 mb-1">
                      Google Gemini API Key
                    </label>
                    <input
                      id="apiKey"
                      type="password"
                      placeholder="AI Studio 取得的 API Key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all mb-4"
                      required
                    />
                    <div className="text-xs text-neutral-500 text-right mt-1 mb-2">
                      <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">取得免費 API 金鑰</a>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="disease" className="block text-sm font-medium text-neutral-700 mb-1">
                      目標疾病 / 衛教主題
                    </label>
                    <input
                      id="disease"
                      type="text"
                      placeholder="例如：貓齒吸收、犬二尖瓣退化..."
                      value={disease}
                      onChange={(e) => setDisease(e.target.value)}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="file" className="block text-sm font-medium text-neutral-700 mb-1">
                      📖 補充參考資料 (選項: 可直接上傳教科書或論文 PDF/TXT)
                    </label>
                    <input
                      id="file"
                      type="file"
                      accept=".pdf,.txt,.docx"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] || null);
                        setPageStart("");
                        setPageEnd("");
                      }}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    {file && file.name.toLowerCase().endsWith('.pdf') && (
                      <div className="mt-3 flex space-x-3 items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <span className="text-sm text-blue-800 font-medium">✂️ 節省 Token：指定讀取頁數 (選填)</span>
                        <input
                          type="number"
                          min="1"
                          placeholder="起始頁"
                          value={pageStart}
                          onChange={(e) => setPageStart(e.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="text-neutral-500">-</span>
                        <input
                          type="number"
                          min="1"
                          placeholder="結束頁"
                          value={pageEnd}
                          onChange={(e) => setPageEnd(e.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="service" className="block text-sm font-medium text-neutral-700 mb-1">
                      主推醫院服務 / Call to Action
                    </label>
                    <textarea
                      id="service"
                      placeholder="例如：本院配備數位牙科X光與氣體麻醉，鼓勵飼主安排洗牙檢查。"
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all min-h-[100px]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      選擇要產生的平台內容（最少勾選一項）
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {tabs.map((tab) => (
                        <label key={tab.id} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${selectedPlatforms.includes(tab.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-neutral-200 hover:bg-neutral-50'}`}>
                          <input
                            type="checkbox"
                            checked={selectedPlatforms.includes(tab.id)}
                            onChange={() => togglePlatform(tab.id)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 mr-2"
                          />
                          <span className="text-sm font-medium text-neutral-700">{tab.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      文案風格
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label
                        className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${style === "social" ? "bg-pink-50 border-pink-200" : "bg-white border-neutral-200 hover:bg-neutral-50"
                          }`}
                      >
                        <input
                          type="radio"
                          name="style"
                          checked={style === "social"}
                          onChange={() => setStyle("social")}
                          className="w-4 h-4 text-pink-500 border-gray-300 focus:ring-pink-500 mr-2 mt-0.5"
                        />
                        <div>
                          <div className="flex items-center text-sm font-medium text-neutral-700">
                            <Sparkles className="w-3.5 h-3.5 mr-1 text-pink-500" />
                            社群推廣風
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">emoji • hashtags • 觀視設計建議</p>
                        </div>
                      </label>
                      <label
                        className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${style === "professional" ? "bg-blue-50 border-blue-200" : "bg-white border-neutral-200 hover:bg-neutral-50"
                          }`}
                      >
                        <input
                          type="radio"
                          name="style"
                          checked={style === "professional"}
                          onChange={() => setStyle("professional")}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 mr-2 mt-0.5"
                        />
                        <div>
                          <div className="flex items-center text-sm font-medium text-neutral-700">
                            <GraduationCap className="w-3.5 h-3.5 mr-1 text-blue-600" />
                            專業學術風
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">正式文體 • 深度論述 • 實證引用</p>
                        </div>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      配圖生成方式
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label
                        className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${!autoImage ? "bg-gray-50 border-gray-200" : "bg-white border-neutral-200 hover:bg-neutral-50"
                          }`}
                      >
                        <input
                          type="radio"
                          name="imageMode"
                          checked={!autoImage}
                          onChange={() => setAutoImage(false)}
                          className="w-4 h-4 text-gray-600 border-gray-300 focus:ring-gray-500 mr-2 mt-0.5"
                        />
                        <div>
                          <div className="text-sm font-medium text-neutral-700">手動生圖</div>
                          <p className="text-xs text-neutral-400 mt-0.5">複製文案到 Gemini 生圖</p>
                        </div>
                      </label>
                      <label
                        className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${autoImage ? "bg-emerald-50 border-emerald-200" : "bg-white border-neutral-200 hover:bg-neutral-50"
                          }`}
                      >
                        <input
                          type="radio"
                          name="imageMode"
                          checked={autoImage}
                          onChange={() => setAutoImage(true)}
                          className="w-4 h-4 text-emerald-600 border-gray-300 focus:ring-emerald-500 mr-2 mt-0.5"
                        />
                        <div>
                          <div className="flex items-center text-sm font-medium text-neutral-700">
                            <ImageIcon className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            API 自動生圖
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">Gemini 3 Pro • 消耗 API 額度</p>
                        </div>
                      </label>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isGenerating || !disease || !service || !apiKey || selectedPlatforms.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-4"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        AI 搜尋網路文獻與生成中...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        一鍵生成多平台文案
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {!isDbMode && (
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-sm text-blue-800">
                <p className="font-semibold mb-1">💡 提示：</p>
                <p>AI 將自動搜尋 Google 取得最新獸醫文獻，並產生各平台可用的配圖 prompt（可複製到 Gemini / Midjourney / Canva AI 生圖）。</p>
              </div>
            )}
          </div>

          {/* 右側：產生結果預覽 (Only shown in Generate Mode) */}
          <div className="col-span-1 lg:col-span-8 flex flex-col space-y-4">
            {!isDbMode && (
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 min-h-[500px] flex flex-col">
                {result ? (
                  <>
                    <div className="border-b border-neutral-100 p-2 flex space-x-2 overflow-x-auto">
                      {currentTabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${activeTab === tab.id
                            ? "bg-blue-50 text-blue-700"
                            : "text-neutral-500 hover:bg-neutral-50"
                            }`}
                        >
                          {tab.icon}
                          {tab.label}
                        </button>
                      ))}
                      <div className="flex-grow"></div>
                      <button
                        onClick={handleCopy}
                        className="flex items-center px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                      >
                        {copied ? (
                          <CheckCircle2 className="w-4 h-4 mr-1 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 mr-1" />
                        )}
                        {copied ? "已複製" : "複製內容"}
                      </button>
                    </div>

                    <div className="p-6 flex-grow bg-neutral-50/50 space-y-4">
                      {/* Auto-generated images */}
                      {imageLoading && (
                        <div className="flex items-center justify-center py-6 bg-emerald-50 rounded-xl border border-emerald-200">
                          <Loader2 className="w-5 h-5 animate-spin mr-2 text-emerald-600" />
                          <span className="text-sm text-emerald-700">正在用 Gemini 3 Pro 生成配圖中...</span>
                        </div>
                      )}
                      {images[activeTab] && images[activeTab].length > 0 && (
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 shadow-sm p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <ImageIcon className="w-4 h-4 mr-2 text-emerald-700" />
                              <span className="text-sm font-semibold text-emerald-700">自動生成的配圖</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {images[activeTab].map((img, idx) => (
                              <div key={idx} className="relative group">
                                <img
                                  src={img}
                                  alt={`配圖 ${idx + 1}`}
                                  className="w-full rounded-lg border border-emerald-100 shadow-sm"
                                />
                                <a
                                  href={img}
                                  download={`${activeTab}_image_${idx + 1}.png`}
                                  className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                  title="下載圖片"
                                >
                                  <Download className="w-4 h-4 text-emerald-600" />
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Text section */}
                      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm whitespace-pre-wrap font-mono text-sm leading-relaxed text-neutral-800">
                        {flattenContent(result[activeTab])}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-neutral-400 p-8 text-center bg-gray-50/50 rounded-2xl">
                    <div className="w-20 h-20 mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
                      <Stethoscope className="w-10 h-10 text-neutral-300" />
                    </div>
                    <p className="font-medium text-neutral-600 mb-2">等待生成指令</p>
                    <p className="text-sm max-w-sm">
                      在左側輸入疾病與想推廣的服務，AI 將自動搜尋最新網路文獻並產生 Facebook、Instagram、Threads 與影音平台的專屬貼文，同時附上可複製的配圖 Prompt。
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
