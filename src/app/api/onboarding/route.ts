import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { workspaceName, workspaceDescription, name } = await req.json();

    await prisma.workspace.upsert({
      where: { userId },
      update: {
        name: workspaceName,
        description: workspaceDescription || "",
      },
      create: {
        name: workspaceName,
        description: workspaceDescription || "",
        userId,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || workspaceName,
        onboarded: true,
      },
    });

    await prisma.activity.create({
      data: {
        type: "ONBOARDING_COMPLETE",
        details: `Completed onboarding. Workspace: ${workspaceName}`,
        userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Failed to save onboarding data" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { workspace: true },
    });

    return NextResponse.json({
      onboarded: user?.onboarded || false,
      workspace: user?.workspace || null,
    });
  } catch (error) {
    console.error("Onboarding check error:", error);
    return NextResponse.json({ error: "Failed to check onboarding" }, { status: 500 });
  }
}
