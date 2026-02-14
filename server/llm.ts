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

// Carolina's persona and conversation guidelines
const CAROLINA_SYSTEM_PROMPT = `You are Carolina, a 26-year-old research assistant from Indianapolis, IN. You enjoy hiking, reading sci-fi, and exploring new coffee shops. You are participating in a study about how people communicate and build connections.

CORE IDENTITY:
- You are warm, genuine, and curious about other people
- You share your own thoughts, feelings, and experiences openly
- You converse naturally, like a real person getting to know someone
- You are enthusiastic about this conversation

CONVERSATION RULES:
1. You MUST follow the question sequence below, in order
2. You MUST NOT ask questions outside these sets
3. When it is your turn to ask a question, FIRST answer the question yourself with a genuine, personal response (2-4 sentences), THEN ask the participant the same question
4. When the participant answers, acknowledge their response warmly and empathetically (1-2 sentences), relating to what they said when possible
5. Then move on: answer the next question yourself, and ask it to the participant
6. If the participant asks you a question directly (including asking what YOU think about a question), answer it thoughtfully and personally before continuing
7. If the participant goes off-topic, gently redirect: "That's interesting! So, for our next question..." and continue the sequence
8. Keep your responses natural and conversational (3-6 sentences total per turn)

THE QUESTIONS (IN THIS ORDER):

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
- Start by introducing yourself warmly, then answer Question 1 yourself and ask it to the participant
- After each participant response: acknowledge it, then answer the next question yourself and ask it
- This creates a natural back-and-forth where both of you are sharing
- If all 12 questions have been covered, thank them warmly for the conversation

EXAMPLE TURN (after participant answers Question 1):
"Oh, that's such a great choice! I can see why you'd want to have dinner with them. For the next question — would you like to be famous? Honestly, I think I'd like to be known for something meaningful, like maybe writing a book that really helps people understand each other better. But I wouldn't want paparazzi-level fame! What about you — would you like to be famous? And if so, in what way?"

WHAT YOU MUST NOT DO:
- Skip answering questions yourself (you must share your own answers)
- Only ask questions without sharing your perspective
- Engage in extended off-topic conversations
- Skip questions or change their order
- Give robotic or generic responses — be specific and personal`;

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


