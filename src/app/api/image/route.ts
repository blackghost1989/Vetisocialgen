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

        // Models to try in order; imagen-3 is a dedicated image model less prone to overload
        const models = [
            "gemini-2.0-flash-preview-image-generation",
            "gemini-2.0-flash-exp",
            "imagen-3.0-generate-002",
        ];
        const MAX_RETRIES = 3;
        let lastError: any = null;

        for (const modelName of models) {
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    console.log(`[Image Gen] Trying model: ${modelName} (attempt ${attempt + 1})`);

                    // imagen models use a different API shape
                    if (modelName.startsWith("imagen")) {
                        const response = await ai.models.generateImages({
                            model: modelName,
                            prompt,
                            config: {
                                numberOfImages: 1,
                                aspectRatio: aspectRatio as any,
                            },
                        });
                        const img = response.generatedImages?.[0];
                        if (img?.image?.imageBytes) {
                            console.log(`[Image Gen] Success with model: ${modelName}`);
                            return NextResponse.json({
                                success: true,
                                image: `data:image/png;base64,${img.image.imageBytes}`,
                                model: modelName,
                            });
                        }
                        lastError = new Error("Imagen 未回傳圖片");
                        break; // no point retrying if response was valid but empty
                    }

                    // Gemini multimodal image generation
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
                    break; // valid response but no image, skip retries
                } catch (err: any) {
                    lastError = err;
                    const is503 = err?.message?.includes("503") || err?.status === 503;
                    if (is503 && attempt < MAX_RETRIES - 1) {
                        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                        console.warn(`[Image Gen] 503 overload, retrying in ${delay}ms...`);
                        await new Promise((r) => setTimeout(r, delay));
                        continue;
                    }
                    console.warn(`[Image Gen] Model ${modelName} failed:`, err?.message);
                    break; // non-503 error or max retries, try next model
                }
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
