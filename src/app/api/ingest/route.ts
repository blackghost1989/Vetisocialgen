import { NextResponse } from "next/server";
import { ChromaClient } from "chromadb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFParse } from "pdf-parse";

// Function to chunk text into reasonable lengths
function chunkText(text: string, chunkSize: number = 800, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + chunkSize));
        i += chunkSize - overlap;
    }
    return chunks;
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const apiKey = formData.get("apiKey") as string;
        const file = formData.get("file") as File | null;

        if (!apiKey) {
            return NextResponse.json({ error: "API 金鑰遺失" }, { status: 400 });
        }

        if (!file) {
            return NextResponse.json({ error: "未選擇檔案" }, { status: 400 });
        }

        console.log(`開始處理上傳的教科書: ${file.name}`);

        // 1. Read PDF Text
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        await parser.destroy();
        const text = pdfData.text.replace(/\n/g, " ");

        // 2. Chunk Text
        const chunks = chunkText(text);
        console.log(`教科書已分割為 ${chunks.length} 個文字塊 (Chunks)`);

        // 3. Generate Embeddings using Google Generative AI SDK
        const genAI = new GoogleGenerativeAI(apiKey);
        const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

        console.log("正在呼叫 Gemini Embedding API 將文字轉化為向量...");
        const embeddings = await Promise.all(
            chunks.map(async (chunk) => {
                const response = await embedModel.embedContent(chunk);
                return response.embedding.values;
            })
        );

        if (embeddings.length === 0 || !embeddings[0]) {
            throw new Error("未能成功產生物件向量");
        }

        // 4. Connect to ChromaDB and store
        console.log("正在連接至本地 ChromaDB (http://localhost:8000)...");
        const client = new ChromaClient({ path: "http://localhost:8000" });

        const collection = await client.getOrCreateCollection({
            name: "veti_textbooks",
        });

        // 建立唯一 ID 確保能溯源是哪本書
        const ids = chunks.map((_, i) => `${file.name.replace(/[^a-zA-Z0-9]/g, '_')}_chunk_${i}`);
        const metadatas = chunks.map((_, i) => ({ source: file.name, chunk_index: i }));

        console.log("正在寫入資料庫...");
        await collection.upsert({
            ids: ids,
            embeddings: embeddings as number[][],
            metadatas: metadatas,
            documents: chunks,
        });

        return NextResponse.json({
            success: true,
            message: `成功將 ${file.name} 寫入本地記憶庫！共存入 ${chunks.length} 段知識。`
        });

    } catch (error: any) {
        console.error("Ingestion failed:", error);
        return NextResponse.json(
            { error: error?.message || "資料庫寫入失敗，請確認 ChromaDB 已經在本機啟動 (Port 8000)。" },
            { status: 500 }
        );
    }
}
