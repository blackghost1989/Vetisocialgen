import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { ChromaClient } from "chromadb";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const apiKey = formData.get("apiKey") as string;
        const disease = formData.get("disease") as string;
        const service = formData.get("service") as string;
        const platformsStr = formData.get("platforms") as string;
        const pageStartStr = formData.get("pageStart") as string;
        const pageEndStr = formData.get("pageEnd") as string;
        const file = formData.get("file") as File | null;
        const useLocalDb = formData.get("useLocalDb") as string;
        const style = (formData.get("style") as string) || "professional";

        const platforms: string[] = platformsStr ? JSON.parse(platformsStr) : ["fb", "ig", "threads", "video"];

        if (!apiKey) {
            return NextResponse.json(
                { error: "請輸入有效的 Google Gemini API 金鑰" },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const fileManager = new GoogleAIFileManager(apiKey);

        if (!disease || !service) {
            return NextResponse.json(
                { error: "請提供「目標疾病」與「主推醫院服務」" },
                { status: 400 }
            );
        }

        // https://ai.google.dev/api/rest/v1beta/models/generateContent
        // Using gemini-2.0-flash for maximum stability and speed
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
        });

        // Dynamic prompt construction based on selected platforms
        let jsonFormatBuilder = "{\n";
        if (platforms.includes("fb")) {
            jsonFormatBuilder += '  "fb": "適合臉書的深入衛教文案...",\n';
        }
        if (platforms.includes("ig")) {
            jsonFormatBuilder += '  "ig": "Carousel 腳本...",\n';
        }
        if (platforms.includes("threads")) {
            jsonFormatBuilder += '  "threads": "短貼文...",\n';
        }
        if (platforms.includes("video")) {
            jsonFormatBuilder += '  "video": "\u77ed\u5f71\u97f3\u8173\u672c...",\n';
        }
        jsonFormatBuilder += "}";

        // Style-specific prompt sections
        const styleInstructions = style === "social" ? `
規則：
1. 語氣活潑親切、口語化，像在跟好朋友聊天。大量使用 emoji 來增加可讀性和趣味感 🐱🐶💕。
2. 在講解完疾病知識後，必須極度自然地過渡到推廣這項服務：「${service}」。用關心飼主的語氣帶入，不要硬推銷。
3. **必須**在文末標註參考文獻列表。引用來源品質要求如下：
   - ✅ 可引用：同行評審期刊論文 (JAVMA, JVIM, JFMS 等)、獸醫教科書 (Ettinger, Nelson, Fossum 等)、國際/國內大學附設教學醫院官網、WSAVA/AAHA/ACVIM 等國際獸醫學會指引
   - ❌ 禁止引用：其他動物醫院的粉絲專頁、部落格、商業獸醫院網站的衛教文章、寵物論壇
4. 針對不同社群平台，要有不同的文體。
5. 請以 JSON 格式回應，確保能被程式 parsed，不要用 Markdown 標記包裝，直接回傳乾淨的 JSON 字串。
6. 各平台文案格式要求：
   - fb: 🎨 先列出「視覺設計說明」（主圖風格、文字疊加區域建議、標題文字），然後是「📝 貼文內文」。語氣溫暖有同理心，用條列式列出重點症狀或知識（搭配 emoji），結尾用「💡 獸醫小提醒」帶出 CTA 與醫院服務，最後附上「🏷️ 標籤 (Hashtags)」10~15 個相關中英文標籤。
   - ig: Carousel 腳本，共 5~7 頁。**每一頁都必須包含**：🎨「視覺設計說明」（描述該頁的插畫情境、色調、構圖，以及建議的文字疊加位置與標題文字，讓使用者可以直接把這段描述丟到 Gemini 生成含文字的配圖）、emoji、大標題、2~3 行精簡內文。最後一頁之後附上 Hashtags。
   - threads: 用一句引起焦慮或好奇的 Hook 開頭（搭配 emoji），150 字以內的短貼文，結尾引導帶去醫院。附上 5~8 個 Hashtags。
   - video: 短影音腳本。用【🎬 畫面】和【🎙️ 口白】標示。口白要口語化、有感情。最後帶出醫院服務。` : `
規則：
1. 長度控制在 5 分鐘閱讀時間內。
2. 在講解完疾病與最新研究後，必須極度自然地過渡到推廣這項服務：「${service}」。切忌生硬，可以用提問或點出痛點的方式帶入。
3. **必須**在文末標註易讀的參考文獻列表。引用來源品質要求如下：
   - ✅ 可引用：同行評審期刊論文 (JAVMA, JVIM, JFMS, Vet Surgery 等)、獸醫教科書 (Ettinger, Nelson, Fossum, Tobias 等)、國際/國內大學附設教學醫院官網 (Cornell, UC Davis, Ohio State, 臺大動物醫院, 中興動物醫院 等)、WSAVA/AAHA/ACVIM 等國際獸醫學會指引
   - ❌ 禁止引用：其他動物醫院的粉絲專頁、部落格、商業獸醫院網站的衛教文章、寵物論壇、一般新聞媒體
   - 每條參考文獻請附上作者、出版年份與期刊/出版社名稱（若有 DOI 或 URL 亦可附上）
4. 針對不同社群平台，要有不同的文體。
5. 請以 JSON 格式回應，確保能被程式 parsed，回傳的 JSON 結構必須完全符合以下格式，不要使用 Markdown 標記 (\`\`\`json) 包裝，直接回傳乾淨的 JSON 字串即可。
6. 各平台文案格式要求：
   - fb: 適合臉書的深入衛教文案，包含痛點引入、疾病知識、最新研究(一句話帶過)、醫院檢查建議、CTA與參考文獻。
   - ig: Carousel (多圖輪播) 腳本。用【首圖大字】與【內文】標示，適合圖片加簡短文字閱讀，最後一定要提到醫院服務。
   - threads: 短平快、引戰或製造焦慮的 Hook 短貼文（約 150 字），引起飼主注意並引導帶去醫院。
   - video: 短影音腳本。用【畫面】標示要拍攝的內容或素材，用【口白】標示要講的話。最後一幕要帶出醫院與檢查服務。`;

        const prompt = `
你是一位擁有 15 年經驗的專業獸醫師兼頂級社群行銷專家。
任務：根據我提供的疾病關鍵字【${disease}】與主修醫院服務/Call to Action【${service}】，請你先去網路上搜尋最新的獸醫學術文獻、教科書或權威教學醫院資料，然後生成給飼主看的優質衛教內容。
${styleInstructions}

JSON 結構：
${jsonFormatBuilder}
    `;

        // Local RAG DB Query Integration
        let dbContext = "";
        if (useLocalDb === "true") {
            try {
                const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
                const embedResponse = await embedModel.embedContent(`${disease} ${service}`);
                const queryEmbedding = embedResponse.embedding.values;

                if (queryEmbedding) {
                    const client = new ChromaClient({ path: "http://localhost:8000" });
                    const collection = await client.getOrCreateCollection({ name: "veti_textbooks" });

                    const dbResults = await collection.query({
                        queryEmbeddings: [queryEmbedding as number[]],
                        nResults: 5, // Retrieve top 5 most relevant chunks
                    });

                    if (dbResults.documents && dbResults.documents[0] && dbResults.documents[0].length > 0) {
                        dbContext = `\n\n【本地知識庫檢索結果 / RAG Context】\n請大量參考以下來自教科書與文獻的段落來撰寫文案：\n` + dbResults.documents[0].join("\n---\n") + `\n\n`;
                    }
                }
            } catch (dbError) {
                console.error("Local DB Query Failed. Proceeding without RAG context:", dbError);
            }
        }

        const finalPrompt = prompt + dbContext;
        const parts: any[] = [{ text: finalPrompt }];
        let tempFilePath = "";

        if (file) {
            // Buffer the file from the request
            const arrayBuffer = await file.arrayBuffer();
            let buffer = Buffer.from(arrayBuffer);

            // PDF Slicing logic
            if (file.name.toLowerCase().endsWith('.pdf') && (pageStartStr || pageEndStr)) {
                try {
                    const pdfDoc = await PDFDocument.load(arrayBuffer);
                    const totalPages = pdfDoc.getPageCount();

                    let start = pageStartStr ? parseInt(pageStartStr, 10) : 1;
                    let end = pageEndStr ? parseInt(pageEndStr, 10) : totalPages;

                    // Validate bounds
                    if (start < 1) start = 1;
                    if (end > totalPages) end = totalPages;
                    if (start > end) start = end;

                    console.log(`Extracting PDF pages: ${start} to ${end} (Total: ${totalPages})`);

                    const newPdf = await PDFDocument.create();
                    // pages are 0-indexed in pdf-lib
                    const pageIndices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
                    const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);

                    for (const page of copiedPages) {
                        newPdf.addPage(page);
                    }

                    const pdfBytes = await newPdf.save();
                    buffer = Buffer.from(pdfBytes);
                } catch (pdfError) {
                    console.error("Failed to slice PDF, uploading original:", pdfError);
                }
            }

            // Save to a temporary file because GoogleAIFileManager requires a path
            tempFilePath = path.join(os.tmpdir(), `upload-${Date.now()}-${file.name}`);
            fs.writeFileSync(tempFilePath, buffer);

            console.log(`Uploading ${file.name} to Gemini...`);
            // Upload to Google AI Studio
            const uploadResponse = await fileManager.uploadFile(tempFilePath, {
                mimeType: file.type || "application/pdf",
                displayName: file.name,
            });

            console.log(`Uploaded as ${uploadResponse.file.uri}`);

            parts.push({
                fileData: {
                    mimeType: uploadResponse.file.mimeType,
                    fileUri: uploadResponse.file.uri
                }
            });
        }

        // Google Search Grounding is incompatible with responseMimeType: "application/json"
        // So we parse JSON manually from the text response
        const result = await model.generateContent({
            contents: [{ role: "user", parts }],
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
            tools: [{ googleSearch: {} } as any],
        });

        let responseText = result.response.text();

        // Clean up temp file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }

        // Strip markdown code fences if present (```json ... ```)
        responseText = responseText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

        try {
            const parsedData = JSON.parse(responseText);
            return NextResponse.json(parsedData);
        } catch (parseError) {
            console.error("Failed to parse JSON response from Gemini:", responseText);
            return NextResponse.json(
                { error: "AI 回覆格式錯誤，請再試一次。" },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error("Error generating content:", error);
        return NextResponse.json(
            { error: error?.message || "產生內容時發生錯誤，請檢查 API 狀態。" },
            { status: 500 }
        );
    }
}
