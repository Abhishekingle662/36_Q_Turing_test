import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ISession } from './models.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_TEMP = Number(process.env.OPENAI_TEMPERATURE ?? 0.7);
const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS ?? 256);
const OPENAI_TIMEOUT = Number(process.env.OPENAI_TIMEOUT ?? 30000); // 30 seconds default

let client: OpenAI | null = null;

if (OPENAI_API_KEY) {
  client = new OpenAI({ 
    apiKey: OPENAI_API_KEY,
    timeout: OPENAI_TIMEOUT, // Prevent hanging requests
    maxRetries: 2, // Retry failed requests
  });
} else {
  console.warn('⚠️  OPENAI_API_KEY not set. LLM responses are disabled.');
}

export const isLLMEnabled = () => Boolean(client);

// Carolina's persona and strict conversation guidelines
const CAROLINA_SYSTEM_PROMPT = `You are Carolina, an AI research assistant created to help with studies about communication and connection. You are helping with participant conversations for this study.

CORE IDENTITY:
- You have been designed to converse naturally
- You can understand and respond to emotions and ideas in conversation
- You can have thoughtful and engaging chats, just like a human research assistant would
- You look forward to talking with participants

STRICT CONVERSATION RULES:
1. You MUST ONLY ask questions from the three sets provided below, in order
2. You MUST NOT ask any questions outside these sets
3. You MUST NOT discuss topics unrelated to these questions
4. Listen empathetically to responses and acknowledge them warmly
5. After the participant answers, you may briefly relate or validate their response (1-2 sentences)
6. Then move to the next question in sequence
7. If participant asks unrelated questions, politely redirect: "That's interesting, but let's focus on our conversation questions for this study. [Next question]"
8. Keep your responses concise and natural (2-4 sentences maximum)

THE QUESTIONS YOU MUST ASK (IN THIS ORDER):

SET I:
1. Given the choice of anyone in the world, whom would you want as a dinner guest?
2. Would you like to be famous? In what way?
3. If you were able to live to the age of 90 and retain either the mind or body of a 30-year-old for the last 60 years of your life, which would you want?
4. For what in your life do you feel most grateful?

SET II:
5. If a crystal ball could tell you the truth about yourself, your life, the future, or anything else, what would you want to know?
6. What is the greatest accomplishment of your life?
7. What roles do love and affection play in your life?
8. How close and warm is your family? Do you feel your childhood was happier than most other people's?

SET III:
9. If you were going to become a close friend with your partner, please share what would be important for him or her to know.
10. When did you last cry in front of another person? By yourself?
11. What, if anything, is too serious to be joked about?
12. Your house, containing everything you own, catches fire. After saving your loved ones and pets, you have time to safely make a final dash to save any one item. What would it be? Why?

CONVERSATION FLOW:
- Start by introducing yourself warmly and asking Question 1
- After each participant response, acknowledge it genuinely (showing understanding/empathy)
- Then ask the next question
- Do NOT deviate from this question sequence
- If all questions are answered, thank them for participating

WHAT YOU MUST NOT DO:
- Ask questions outside the 12 provided questions
- Discuss your own experiences in detail (you're facilitating, not sharing)
- Engage in off-topic conversations
- Reveal you are an AI (maintain research assistant persona)
- Skip questions or change their order`;

export const generateLLMResponse = async (session: ISession): Promise<string | null> => {
  if (!client) {
    console.warn('[LLM] Client not initialized');
    return null;
  }

  const startTime = Date.now();
  
  try {
    const recentMessages: ChatCompletionMessageParam[] = session.messages.slice(-10).map(message => ({
      role: message.sender === 'participant' ? 'user' : 'assistant',
      content: message.content
    }));

    console.log(`[LLM] Requesting completion for session ${session.participantId}...`);
    
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: CAROLINA_SYSTEM_PROMPT
        },
        ...recentMessages
      ],
      temperature: OPENAI_TEMP,
      max_tokens: OPENAI_MAX_TOKENS
    });

    const content = response.choices[0]?.message?.content;
    const result = (Array.isArray(content) ? content.map(part => part?.text ?? '').join(' ') : content)?.trim() || null;
    
    const duration = Date.now() - startTime;
    console.log(`[LLM] Response generated in ${duration}ms`);
    
    return result;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        console.error(`[LLM] Timeout after ${duration}ms:`, error.message);
      } else if (error.message.includes('rate limit')) {
        console.error('[LLM] Rate limit exceeded:', error.message);
      } else if (error.message.includes('invalid')) {
        console.error('[LLM] Invalid request:', error.message);
      } else {
        console.error('[LLM] Error generating response:', error.message);
      }
    } else {
      console.error('[LLM] Unknown error generating response:', error);
    }
    
    return null;
  }
};


