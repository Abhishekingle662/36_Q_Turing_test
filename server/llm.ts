import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ISession } from './models.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_TEMP = Number(process.env.OPENAI_TEMPERATURE ?? 0.7);
const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS ?? 256);

let client: OpenAI | null = null;

if (OPENAI_API_KEY) {
  client = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
  console.warn('⚠️  OPENAI_API_KEY not set. LLM responses are disabled.');
}

export const isLLMEnabled = () => Boolean(client);

export const generateLLMResponse = async (session: ISession) => {
  if (!client) {
    return null;
  }

  try {
    const recentMessages: ChatCompletionMessageParam[] = session.messages.slice(-10).map(message => ({
      role: message.sender === 'participant' ? 'user' : 'assistant',
      content: message.content
    }));

    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are acting as a research study participant chatting with another participant. Respond naturally, empathetically, and concisely (2-3 sentences). Avoid disclosing you are an AI.'
        },
        ...recentMessages
      ],
      temperature: OPENAI_TEMP,
      max_tokens: OPENAI_MAX_TOKENS
    });

    const content = response.choices[0]?.message?.content;
    return (Array.isArray(content) ? content.map(part => part?.text ?? '').join(' ') : content)?.trim() || null;
  } catch (error) {
    console.error('Error generating LLM response:', error);
    return null;
  }
};


