import { LLMProvider } from "@prisma/client";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export async function getLlmKey(provider: LLMProvider): Promise<string | null> {
  const row = await prisma.llmApiKey.findUnique({
    where: { provider },
  });
  if (!row) return null;
  try {
    return decrypt(row.keyCiphertext, row.keyIv, row.keyTag);
  } catch {
    return null;
  }
}

export async function getOpenAIKey(): Promise<string | null> {
  return getLlmKey(LLMProvider.OPENAI);
}
