require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const { buildQuestionnairePrompt } = require('./prompts/questionnaire');
const { buildTravelPlanPrompt } = require('./prompts/travel-plan');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load example travel plan for few-shot prompting
let examplePlan = '';
try {
  examplePlan = fs.readFileSync(path.join(__dirname, 'hangzhou-south-road-trip.md'), 'utf-8');
} catch (e) {
  console.warn('未找到示例旅行计划文件，将不使用 few-shot 示例');
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// POST /api/questionnaire - Generate questionnaire based on user input
app.post('/api/questionnaire', async (req, res) => {
  try {
    const { userInput } = req.body;
    if (!userInput || !userInput.trim()) {
      return res.status(400).json({ error: '请输入你的旅行想法' });
    }

    const prompt = buildQuestionnairePrompt(userInput.trim());

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0].text;

    // Extract JSON from response (handle potential markdown code fences)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const questions = JSON.parse(jsonStr);
    res.json({ questions });
  } catch (error) {
    console.error('问卷生成失败:', error);
    if (error instanceof SyntaxError) {
      return res.status(500).json({ error: 'AI 返回格式异常，请重试' });
    }
    res.status(500).json({ error: '服务器错误，请稍后重试' });
  }
});

// POST /api/travel-plan - Generate travel plan with SSE streaming
app.post('/api/travel-plan', async (req, res) => {
  try {
    const { userInput, answers } = req.body;
    if (!userInput || !userInput.trim()) {
      return res.status(400).json({ error: '缺少旅行想法' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const prompt = buildTravelPlanPrompt(userInput.trim(), answers || {}, examplePlan);

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
    });

    stream.on('error', (error) => {
      console.error('流式生成错误:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', content: '生成过程中出现错误，请重试' })}\n\n`);
      res.end();
    });

    stream.on('end', () => {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      stream.abort();
    });
  } catch (error) {
    console.error('旅行计划生成失败:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: '服务器错误，请稍后重试' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`🌍 AI旅行规划师已启动: http://localhost:${PORT}`);
});
