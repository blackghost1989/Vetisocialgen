import { NextResponse } from "next/server";
import { ChromaClient } from "chromadb";

// GET: List all documents grouped by source file
export async function GET() {
    try {
        const client = new ChromaClient({ path: "http://localhost:8000" });

        let collection;
        try {
            collection = await client.getCollection({ name: "veti_textbooks" });
        } catch {
            // Collection doesn't exist yet
            return NextResponse.json({ documents: [] });
        }

        const all = await collection.get();

        if (!all.ids || all.ids.length === 0) {
            return NextResponse.json({ documents: [] });
        }

        // Group by source file
        const grouped: Record<string, { count: number; ids: string[] }> = {};
        for (let i = 0; i < all.ids.length; i++) {
            const source = (all.metadatas?.[i] as any)?.source || "未知來源";
            if (!grouped[source]) {
                grouped[source] = { count: 0, ids: [] };
            }
            grouped[source].count++;
            grouped[source].ids.push(all.ids[i]);
        }

        const documents = Object.entries(grouped).map(([source, data]) => ({
            source,
            chunkCount: data.count,
            ids: data.ids,
        }));

        return NextResponse.json({ documents, totalChunks: all.ids.length });
    } catch (error: any) {
        console.error("Failed to list documents:", error);
        return NextResponse.json(
            { error: error?.message || "無法連接 ChromaDB" },
            { status: 500 }
        );
    }
}

// DELETE: Remove documents by source name or specific IDs
export async function DELETE(req: Request) {
    try {
        const body = await req.json();
        const { source, ids, deleteAll } = body;

        const client = new ChromaClient({ path: "http://localhost:8000" });

        if (deleteAll) {
            await client.deleteCollection({ name: "veti_textbooks" });
            return NextResponse.json({ success: true, message: "已清空所有知識庫資料" });
        }

        const collection = await client.getCollection({ name: "veti_textbooks" });

        if (ids && ids.length > 0) {
            await collection.delete({ ids });
            return NextResponse.json({ success: true, message: `已刪除 ${ids.length} 個片段` });
        }

        if (source) {
            // Get all IDs matching this source
            const results = await collection.get({
                where: { source },
            });
            if (results.ids.length > 0) {
                await collection.delete({ ids: results.ids });
            }
            return NextResponse.json({
                success: true,
                message: `已刪除「${source}」的 ${results.ids.length} 個片段`,
            });
        }

        return NextResponse.json({ error: "請指定要刪除的來源或 ID" }, { status: 400 });
    } catch (error: any) {
        console.error("Failed to delete documents:", error);
        return NextResponse.json(
            { error: error?.message || "刪除失敗" },
            { status: 500 }
        );
    }
}
