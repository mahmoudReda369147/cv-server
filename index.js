// index.js
const JSON5 = require("json5");
require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const SYSTEM_INSTRUCTION = process.env.SYSTEM_PROMPT || "أنت مساعد افتراضي مفيد.";

app.post("/chat", async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    if (!message || !conversationId)
      return res.status(400).json({ error: "Message and conversationId are required" });

    // 🧠 استرجاع المحادثة السابقة
    const dbHistory = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    const history = dbHistory.map((msg) => ({
      role: msg.role.toLowerCase(),
      parts: [{ text: msg.content }],
    }));

    // 🤖 إعداد نموذج Gemini
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);
    const modelResponse = result.response.text();

    // 🗃️ حفظ الرسائل في قاعدة البيانات
    await prisma.message.createMany({
      data: [
        { role: "user", content: message, conversationId },
        { role: "model", content: modelResponse, conversationId },
      ],
    });

    // 🧩 محاولة استخراج JSON من الرد
    let parsed;
    try {
      const jsonBlock = modelResponse.match(/```json([\s\S]*?)```/);
      if (!jsonBlock) throw new Error("No JSON block found in AI response");

      parsed = JSON5.parse(jsonBlock[1]);
    } catch (err) {
      console.error("❌ JSON Parse Error:", err);
      return res.status(400).json({ error: "Invalid JSON format in AI response" });
    }

    const htmlCode = parsed.code;
    if (!parsed.isGenerated) {
      return res.json({
        isGenerated: false,
        message: parsed.message || "Continue the conversation.",
      });
    }

    if (!htmlCode) {
      return res.status(400).json({ error: "No HTML code found in AI response" });
    }

    // 🖨️ تحويل HTML إلى PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // ✅ تأكد من وجود عناصر HTML كاملة
    const wrappedHtml = htmlCode.includes("<html")
      ? htmlCode
      : `
        <html>
          <head>
            <meta charset="UTF-8" />
            <style>
              @page { size: A4; margin: 1cm; }
              body {
                font-family: 'Arial', sans-serif;
                margin: 40px;
                line-height: 1.5;
                color: #222;
              }
              h1, h2, h3 {
                color: #333;
                margin-bottom: 8px;
              }
              hr {
                border: none;
                border-top: 1px solid #ccc;
                margin: 10px 0;
              }
              section, div { page-break-inside: avoid; }
              .page-break { page-break-after: always; }
            </style>
          </head>
          <body>${htmlCode}</body>
        </html>`;

    await page.setContent(wrappedHtml, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
    });

    await browser.close();

    // 📥 إرسال الـ PDF كتنزيل تلقائي
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=\"resume.pdf\"");
    res.send(pdfBuffer);

  } catch (error) {
    console.error("💥 Error in /chat:", error);
    res.status(500).json({ error: "Something went wrong: " + error.message });
  }
});

// 🚀 تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
