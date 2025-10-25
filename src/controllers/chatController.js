const prisma = require('../config/database');
const JSON5 = require("json5");
require("dotenv").config();
const express = require("express");

const { GoogleGenerativeAI } = require("@google/generative-ai");
const puppeteer = require("puppeteer");
const config = require('../config/config');
const { uploadToS3 } = require('../services/s3Service');
const { sendResponse, createResponse } = require('../utils/responseUtil');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const SYSTEM_INSTRUCTION = process.env.SYSTEM_PROMPT || "أنت مساعد افتراضي مفيد.";
const createMessage=  async (req, res) => {
  try {
    let { message, conversationId } = req.body;
    if (!message )
      return sendResponse(res, false, "Message and conversationId are required", null, 400);

    let conversation
    if(conversationId){
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if(!conversation)
        return sendResponse(res, false, "Conversation not found", null, 404);
    }
    if(!conversationId){
       conversation = await prisma.conversation.create({
        data: {
          userId: req.user.id,
          lastMessage:message
        },
      });
      conversationId = conversation.id;
    }
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
    

    // 🧩 محاولة استخراج JSON من الرد
    let parsed;
    try {
      const jsonBlock = modelResponse.match(/```json([\s\S]*?)```/);
      if (!jsonBlock) throw new Error("No JSON block found in AI response");

      parsed = JSON5.parse(jsonBlock[1]);
    } catch (err) {
      console.error("❌ JSON Parse Error:", err);
      return sendResponse(res, false, "Invalid JSON format in AI response", null, 400);
    }

    const htmlCode = parsed.code;
    const updated = await prisma.conversation.update({
        where: {id: conversationId },
        data:{lastMessage:message}
      
    })
    if (!htmlCode) {
      await prisma.message.createMany({
      data: [
        { role: "user", content: message, conversationId,pdfUrl: null },
        { role: "model", content: modelResponse, conversationId,pdfUrl:null },
      ],
    });
    
      return sendResponse(res, true, "the prosess is successed" || "Continue the conversation.", {
        isGenerated: false,
        message:parsed.message,
        htmlCode:null,
        pdfUrl:null
      });
    }
    
    if (!htmlCode) {
      return sendResponse(res, false, "No HTML code found in AI response", null, 400);
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
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    // Wait briefly to ensure rendering settles on some environments
    await new Promise((resolve) => setTimeout(resolve, 300));
    const screenshotBuffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: 794, height: 1123 }
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
    });

    await browser.close();

    // 📤 Upload PDF to S3
    const fileName = `resume_${Date.now()}.pdf`;
    const s3FileUrl = await uploadToS3(pdfBuffer, fileName, 'application/pdf');
    // 📤 Upload first-page thumbnail to S3
    const thumbFileName = `resume_${Date.now()}_thumb.png`;
    const imageUrl = await uploadToS3(screenshotBuffer, thumbFileName, 'image/png');
    
    // Create messages individually to get IDs
    const userMsg = await prisma.message.create({
      data: { role: "user", content: message, conversationId, pdfUrl: null }
    });
    const modelMsg = await prisma.message.create({
      data: { role: "model", content: modelResponse, conversationId, pdfUrl: s3FileUrl }
    });

    // Derive title (person name) from parsed JSON or HTML
    const extractTitle = () => {
      if (parsed?.title) return String(parsed.title).trim();
      if (parsed?.name) return String(parsed.name).trim();
      const h1Match = wrappedHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
      if (h1Match && h1Match[1]) return h1Match[1].replace(/<[^>]+>/g, '').trim();
      return (req.user?.name || 'Resume').trim();
    };
    const title = extractTitle();

    // Create Pdf record
    const pdfRecord = await prisma.pdf.create({
      data: {
        title,
        pdfUrl: s3FileUrl,
        imageUrl,
        userId: req.user.id,
        conversationId,
        messageId: modelMsg.id,
      }
    });

    // 🔗 Return S3 links and DB record info in response
    return sendResponse(res, true, "Resume generated successfully", {
      isGenerated: true,
      pdfUrl: s3FileUrl,
      htmlCode
    });

  } catch (error) {
    console.error("💥 Error in /chat:", error);
    return sendResponse(res, false, "Something went wrong: " + error.message, null, 500);
  }
}

const getAllChates =async (req,res)=>{
 try{
   const chates =await prisma.Conversation.findMany({
    where:{userId:req.user.id}
  })
  return sendResponse(res,true,"cet all chates sucssesfuly",chates.reverse())
 }catch(error){
  return sendResponse(res, false, "Something went wrong: " + error.message, null, 500);
 }
}
const getAllMessages =async (req,res)=>{
 try{
  if(!req.params.id){
    return sendResponse(res, false, "Something went wrong: " + "chat id is required", null, 400);
  }
   const messages =await prisma.Message.findMany({
    where:{conversationId:req.params.id}
  })
  return sendResponse(res,true,"get all messages sucssesfuly",messages)
 }catch(error){
  return sendResponse(res, false, "Something went wrong: " + error.message, null, 500);
 }
}

// Get PDFs by userId (only allow the authenticated user to access their own PDFs)
const getPdfsByUser = async (req, res) => {
  try {
    // Using authenticated user's id
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, false, "userId is required", null, 400);
    }

    // Pagination params
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSizeRaw = parseInt(req.query.pageSize, 10) || 9;
    const pageSize = Math.min(Math.max(1, pageSizeRaw), 100); // clamp 1..100
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [total, pdfs] = await Promise.all([
      prisma.pdf.count({ where: { userId } }),
      prisma.pdf.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return sendResponse(res, true, "PDFs fetched successfully", {
      items: pdfs,
      meta:{
        page,
      pageSize,
      total,
      totalPages
      }
    });
  } catch (error) {
    console.error(" Error in getPdfsByUser:", error);
    return sendResponse(res, false, "Something went wrong: " + error.message, null, 500);
  }
}

module.exports = {
  createMessage,
  getAllChates,
  getAllMessages,
  getPdfsByUser,
}