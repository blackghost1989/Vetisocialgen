import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ASPECT_RATIOS: Record<string, string> = {
    fb: "16:9",
    ig: "1:1",
    threads: "4:5",
    video: "16:9",
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { apiKey, prompt, platform } = body;

        if (!apiKey || !prompt || !platform) {
            return NextResponse.json(
                { error: "缺少必要參數 (apiKey, prompt, platform)" },
                { status: 400 }
            );
        }

        const aspectRatio = ASPECT_RATIOS[platform] || "1:1";

        console.log(`[Image Gen] Platform: ${platform}, Aspect: ${aspectRatio}`);

        const ai = new GoogleGenAI({ apiKey });

        // Try gemini-3-pro-image-preview first (best Chinese text rendering),
        // fallback to gemini-2.5-flash-image
        const models = ["gemini-3-pro-image-preview", "gemini-2.5-flash-image"];
        let lastError: any = null;

        for (const modelName of models) {
            try {
                console.log(`[Image Gen] Trying model: ${modelName}`);
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: prompt,
                    config: {
                        responseModalities: ["Image", "Text"],
                        ...(aspectRatio && {
                            imageConfig: {
                                aspectRatio: aspectRatio,
                            },
                        }),
                    },
                });

                // Extract image data from response
                const parts = response.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                    if (part.inlineData) {
                        const base64 = part.inlineData.data;
                        const mimeType = part.inlineData.mimeType || "image/png";
                        console.log(`[Image Gen] Success with model: ${modelName}`);
                        return NextResponse.json({
                            success: true,
                            image: `data:${mimeType};base64,${base64}`,
                            model: modelName,
                        });
                    }
                }

                lastError = new Error("AI 未回傳圖片");
            } catch (err: any) {
                console.warn(`[Image Gen] Model ${modelName} failed:`, err?.message);
                lastError = err;
                continue;
            }
        }

        return NextResponse.json(
            { error: lastError?.message || "所有模型都無法生成圖片，請再試一次。" },
            { status: 500 }
        );
    } catch (error: any) {
        console.error("Image generation failed:", error);
        return NextResponse.json(
            { error: error?.message || "圖片生成失敗" },
            { status: 500 }
        );
    }
}
