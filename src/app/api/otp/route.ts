import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    let user = await prisma.user.findUnique({ where: { email } });
    
    await prisma.otpCode.create({
      data: {
        email,
        code,
        expires,
        userId: user?.id,
      },
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Your PDF Agent Login Code",
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="text-align: center; color: #18181b;">PDF Agent</h2>
          <p style="text-align: center; color: #71717a;">Your verification code is:</p>
          <div style="text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; background: #f4f4f5; border-radius: 8px; margin: 16px 0;">
            ${code}
          </div>
          <p style="text-align: center; color: #71717a; font-size: 12px;">This code expires in 10 minutes.</p>
        </div>
      `,
    });

    await prisma.activity.create({
      data: {
        type: "OTP_SENT",
        details: `OTP sent to ${email}`,
        userId: user?.id || "",
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("OTP error:", error);
    return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
