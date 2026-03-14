import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Pinecone } from "@pinecone-database/pinecone";

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const GROQ_EMBED_URL = "https://api.groq.com/openai/v1/embeddings";

function splitTextIntoChunks(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(GROQ_EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nomic-embed-text-v1_5",
      input: text,
    }),
  });
  const data = await res.json();
  return data.data?.[0]?.embedding || [];
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileUrl = formData.get("url") as string;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    let textContent = "";
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require("pdf-parse") as { PDFParse: new (opts: { data: Uint8Array }) => { load: () => Promise<void>; getText: () => Promise<{ text: string }> } };
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      await parser.load();
      const result = await parser.getText();
      textContent = result.text;
    } catch (e) {
      console.error("PDF parse error:", e);
      textContent = buffer.toString("utf-8");
    }

    const document = await prisma.document.create({
      data: {
        name: file.name,
        url: fileUrl || "",
        size: file.size,
        mimeType: file.type || "application/pdf",
        userId,
      },
    });

    const chunks = splitTextIntoChunks(textContent);

    const dbChunks = await Promise.all(
      chunks.map((content, i) =>
        prisma.chunk.create({
          data: {
            content,
            documentId: document.id,
            pageNumber: i + 1,
          },
        })
      )
    );

    try {
      const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
      const index = pc.index(process.env.PINECONE_INDEX_NAME!);

      const vectors = [];
      for (let i = 0; i < chunks.length; i++) {
        try {
          const embedding = await getEmbedding(chunks[i]);
          if (embedding.length > 0) {
            vectors.push({
              id: dbChunks[i].id,
              values: embedding,
              metadata: {
                text: chunks[i],
                documentId: document.id,
                userId,
                fileName: file.name,
              },
            });
          }
        } catch (e) {
          console.error(`Embedding error for chunk ${i}:`, e);
        }
      }

      if (vectors.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < vectors.length; i += batchSize) {
          await index.upsert({ records: vectors.slice(i, i + batchSize) });
        }
      }
    } catch (e) {
      console.error("Pinecone upsert error:", e);
    }

    await prisma.activity.create({
      data: {
        type: "DOCUMENT_UPLOAD",
        details: `Uploaded document: ${file.name} (${chunks.length} chunks)`,
        userId,
      },
    });

    return NextResponse.json({
      document,
      chunks: chunks.length,
      message: "Document processed successfully",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to process document" }, { status: 500 });
  }
}
