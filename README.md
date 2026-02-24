# Veti-Social-Gen 🩺✨

**獸醫師專屬社群衛教文案產生器**

一鍵生成 Facebook、Instagram、Threads、短影音腳本，搭配 AI 自動配圖。
整合 Google Search Grounding 即時搜尋最新獸醫文獻，也可搭配本地向量知識庫 (RAG) 讓 AI 引用您自己的教科書。

---

## ✨ 功能一覽

### 🎯 核心功能
- **多平台文案一鍵生成**：輸入疾病主題與醫院服務，自動產出 FB / IG Carousel / Threads / 影音腳本
- **Google Search Grounding**：AI 自動搜尋 Google 取得最新獸醫學術文獻，確保內容有實證基礎
- **兩種文案風格**：
  - 🌸 **社群推廣風**：口語活潑、emoji 豐富、含視覺設計說明與 Hashtags
  - 🎓 **專業學術風**：正式文體、深度論述、引用同行評審期刊與教科書

### 🖼️ AI 配圖生成
- **手動模式**：文案內含 🎨 視覺設計說明，可複製到 Gemini / Midjourney / Canva AI 手動生圖
- **自動模式**：使用 Gemini 3 Pro 根據文案自動生成配圖（支援各平台比例：FB 16:9、IG 1:1、Threads 4:5）
- 生成的圖片可直接下載使用

### 📄 PDF 智慧處理
- 直接上傳教科書或論文 PDF 作為補充參考資料
- **分頁截取**：指定起始/結束頁，節省 API Token 消耗

### 📚 本地知識庫 (RAG)（選配）
- 上傳獸醫教科書至本地 ChromaDB 向量資料庫永久保存
- AI 生成文案時自動從知識庫檢索最相關段落
- **知識庫管理介面**：查看已存入文件、單本刪除、一鍵清空
- 100% 隱私安全：所有資料保留在您的電腦硬碟中

---

## 🚀 快速開始

### 最低需求
- Node.js 18+
- Google Gemini API Key（[免費取得](https://aistudio.google.com/)）

### 啟動步驟

```bash
# 1. Clone 專案
git clone https://github.com/blackghost1989/Vetisocialgen.git
cd Vetisocialgen

# 2. 安裝依賴
npm install

# 3. 啟動開發伺服器
npm run dev
```

打開瀏覽器前往 `http://localhost:3000`，貼上 API Key 即可開始使用！

> 💡 **不需要額外設定資料庫**，核心功能只需 API Key 就能運作。本地知識庫 (RAG) 為選配功能。

---

## 📖 使用教學

### 基本使用（寫文案）

1. 進入 `http://localhost:3000`，貼上你的 **Google Gemini API Key**
2. 填入**目標疾病**（例：貓齒吸收、犬二尖瓣退化）
3. 填入**主推醫院服務 / CTA**（例：本院配備數位牙科X光與氣體麻醉，鼓勵飼主安排洗牙檢查）
4. 勾選要產出的平台、選擇文案風格與配圖模式
5. 按下**「一鍵生成多平台文案」**
6. 可在右側預覽各平台文案，點擊**「複製內容」**直接貼到社群平台

### 進階：本地知識庫 (RAG)

需要額外啟動 ChromaDB：

**選項 A：Docker（推薦）**
```bash
docker run -p 8000:8000 chromadb/chroma
```
> 沒有 Docker？前往 [Docker 官網](https://www.docker.com/products/docker-desktop/) 下載安裝

**選項 B：Python**
```bash
pip install chromadb
chroma run --path ./chroma_data
```

啟動後，切換到「本地資料庫 (Ingest)」分頁：
1. 上傳獸醫教科書 PDF → 系統自動切分並存入向量資料庫
2. 回到「寫文案」分頁，AI 會自動從知識庫檢索相關內容
3. 在管理介面可查看、刪除已存入的文件

---

## 🏗️ 技術架構

| 層級 | 技術 |
|------|------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 |
| AI Model | Gemini 2.5 Flash（文案）+ Gemini 3 Pro（生圖） |
| Embedding | Gemini Embedding 001 |
| Vector DB | ChromaDB（選配，本地部署） |
| PDF 處理 | pdf-lib（分頁截取）+ pdf-parse（全文擷取） |

### API Routes

| Route | 說明 |
|-------|------|
| `POST /api/generate` | 生成多平台衛教文案（支援 PDF 上傳、RAG 檢索、Google Search） |
| `POST /api/image` | AI 配圖生成（Gemini 3 Pro，自動 fallback） |
| `POST /api/ingest` | 上傳 PDF 並寫入 ChromaDB 向量資料庫 |
| `GET /api/documents` | 查詢已存入的知識庫文件 |
| `DELETE /api/documents` | 刪除指定文件或清空知識庫 |

---

## 📝 License

MIT
