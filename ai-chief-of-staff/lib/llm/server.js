import { embed, generateText as generateAiText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

const getProvider = () =>
  (process.env.LLM_PROVIDER || process.env.AI_PROVIDER || "openai").trim().toLowerCase();

const getApiKey = (provider = getProvider()) => {
  const shared = process.env.LLM_API_KEY?.trim();
  if (shared) return shared;

  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY?.trim();
  if (provider === "gemini" || provider === "google") {
    return process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  }
  return process.env.OPENAI_API_KEY?.trim();
};

export const getLlmConfig = () => {
  const provider = getProvider();

  return {
    provider,
    apiKey: getApiKey(provider),
    model: process.env.LLM_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    baseURL: process.env.LLM_BASE_URL?.trim() || "",
  };
};

export const isLlmConfigured = () => Boolean(getLlmConfig().apiKey);

const createLanguageModel = ({ provider, apiKey, baseURL, model }) => {
  if (provider === "anthropic") {
    return createAnthropic({ apiKey, baseURL: baseURL || undefined })(model);
  }

  if (provider === "gemini" || provider === "google") {
    return createGoogle({ apiKey, baseURL: baseURL || undefined })(model);
  }

  const openai = createOpenAI({
    apiKey,
    baseURL: baseURL || undefined,
    name: provider === "openai-compatible" ? "openai-compatible" : undefined,
  });

  return provider === "openai-compatible" ? openai.chat(model) : openai(model);
};

export const generateText = async ({ model, instructions, input }) => {
  const config = getLlmConfig();

  if (!config.apiKey) {
    throw new Error(
      `LLM provider is not configured. Set LLM_PROVIDER, LLM_MODEL, and LLM_API_KEY, or use the provider-specific API key for ${config.provider}.`
    );
  }

  const response = await generateAiText({
    model: createLanguageModel({
      ...config,
      model: model || config.model,
    }),
    system: instructions,
    prompt: input,
  });

  return response.text;
};

const getEmbeddingProvider = () =>
  (process.env.EMBEDDING_PROVIDER || process.env.LLM_EMBEDDING_PROVIDER || "openai").trim().toLowerCase();

const getEmbeddingApiKey = (provider) => {
  const shared = process.env.EMBEDDING_API_KEY?.trim();
  if (shared) return shared;
  if (provider === "gemini" || provider === "google") {
    return process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  }
  return process.env.OPENAI_API_KEY?.trim() || process.env.LLM_API_KEY?.trim();
};

export const getEmbeddingConfig = () => {
  const provider = getEmbeddingProvider();
  return {
    provider,
    apiKey: getEmbeddingApiKey(provider),
    model:
      process.env.EMBEDDING_MODEL?.trim() ||
      process.env.OPENAI_EMBEDDING_MODEL?.trim() ||
      DEFAULT_EMBEDDING_MODEL,
    baseURL: process.env.EMBEDDING_BASE_URL?.trim() || process.env.LLM_BASE_URL?.trim() || "",
  };
};

const createEmbeddingModel = ({ provider, apiKey, baseURL, model }) => {
  if (provider === "gemini" || provider === "google") {
    return createGoogle({ apiKey, baseURL: baseURL || undefined }).embedding(model);
  }

  return createOpenAI({
    apiKey,
    baseURL: baseURL || undefined,
    name: provider === "openai-compatible" ? "openai-compatible" : undefined,
  }).embedding(model);
};

export const createTextEmbedding = async (input) => {
  const config = getEmbeddingConfig();

  if (!config.apiKey) {
    throw new Error(
      "Embedding provider is not configured. Set EMBEDDING_PROVIDER, EMBEDDING_MODEL, and EMBEDDING_API_KEY, or provide a compatible provider key."
    );
  }

  const response = await embed({
    model: createEmbeddingModel(config),
    value: input,
  });

  return response.embedding;
};
