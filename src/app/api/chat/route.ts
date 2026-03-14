import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Pinecone } from "@pinecone-database/pinecone";

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_EMBED_URL = "https://api.groq.com/openai/v1/embeddings";

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

async function queryPinecone(embedding: number[], topK = 5): Promise<string[]> {
  try {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const index = pc.index(process.env.PINECONE_INDEX_NAME!);
    const results = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });
    return (results.matches?.map((m) => String(m.metadata?.text || "")).filter(Boolean) || []) as string[];
  } catch (e) {
    console.error("Pinecone query error:", e);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { message, conversationId, documentId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let convId = conversationId;
    if (!convId) {
      const conv = await prisma.conversation.create({
        data: {
          title: message.slice(0, 50),
          userId,
        },
      });
      convId = conv.id;
    }

    await prisma.message.create({
      data: {
        role: "user",
        content: message,
        conversationId: convId,
        userId,
        documentId: documentId || null,
      },
    });

    let contextChunks: string[] = [];
    try {
      const embedding = await getEmbedding(message);
      if (embedding.length > 0) {
        contextChunks = await queryPinecone(embedding);
      }
    } catch (e) {
      console.error("RAG error:", e);
    }

    const systemPrompt = contextChunks.length > 0
      ? `You are a helpful PDF document analysis assistant. Use the following context from uploaded documents to answer questions accurately. If the context doesn't contain relevant information, say so.\n\nContext:\n${contextChunks.join("\n\n")}`
      : "You are a helpful PDF document analysis assistant. Help users analyze and understand their documents. If no documents have been uploaded yet, let the user know they can upload PDFs for analysis.";

    const previousMessages = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const messages = [
      { role: "system", content: systemPrompt },
      ...previousMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    const groqData = await groqRes.json();
    const assistantContent = groqData.choices?.[0]?.message?.content || "I apologize, I couldn't generate a response. Please try again.";

    const assistantMsg = await prisma.message.create({
      data: {
        role: "assistant",
        content: assistantContent,
        conversationId: convId,
        userId,
      },
    });

    await prisma.activity.create({
      data: {
        type: "CHAT_MESSAGE",
        details: `Sent message in conversation ${convId}`,
        userId,
      },
    });

    return NextResponse.json({
      message: assistantMsg,
      conversationId: convId,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}
