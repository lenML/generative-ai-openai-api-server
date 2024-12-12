import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { object, z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { genAI } from "src/genAI";
import fetch from "src/utils/fetch";
import {
  EnhancedGenerateContentResponse,
  GenerationConfig,
  GoogleGenerativeAIError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIRequestInputError,
  GoogleGenerativeAIResponseError,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
import { writeFileSync } from "fs";
import { fromBuffer } from "file-type-cjs";
import retry from "async-retry";
import { AbortError, FetchError } from "node-fetch";
import { configJson } from "src/args";

const all_none_safety_settings = [
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  "HARM_CATEGORY_CIVIC_INTEGRITY" as any,
  // HarmCategory.HARM_CATEGORY_UNSPECIFIED,
].map((x) => ({
  category: x,
  threshold: HarmBlockThreshold.BLOCK_NONE,
}));

// 定义请求体的 Zod Schema
const CHAT_COMPLETION_SCHEMA = z.object({
  model: z.string().describe("ID of the model to use."),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.union([
          z.string(),
          z.array(
            z.union([
              z.object({
                type: z.literal("text"),
                text: z.string(),
              }),
              z.object({
                type: z.literal("image_url"),
                image_url: z.object({
                  url: z.string(),
                }),
              }),
              z.object({
                type: z.literal("audio"),
                input_audio: z.object({
                  data: z.string(),
                  format: z.string(),
                }),
              }),
            ])
          ),
        ]),
      })
    )
    .describe("A list of messages comprising the conversation so far."),
  store: z.boolean().nullable().optional().default(false),
  metadata: z.record(z.string()).nullable().optional(),
  frequency_penalty: z.number().min(-2.0).max(2.0).nullable().optional(),
  logit_bias: z.record(z.number()).nullable().optional(),
  logprobs: z.boolean().nullable().optional(),
  top_logprobs: z.number().int().min(0).max(20).nullable().optional(),
  max_tokens: z.number().nullable().optional(),
  max_completion_tokens: z.number().nullable().optional(),
  n: z.number().int().nullable().optional().default(1),
  modalities: z.array(z.string()).nullable().optional(),
  prediction: z.record(z.any()).nullable().optional(),
  audio: z.record(z.any()).nullable().optional(),
  presence_penalty: z.number().min(-2.0).max(2.0).nullable().optional(),
  response_format: z.record(z.any()).nullable().optional(),
  seed: z.number().int().nullable().optional(),
  service_tier: z.enum(["auto", "default"]).nullable().optional(),
  stop: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  stream: z.boolean().nullable().optional().default(false),
  stream_options: z.record(z.any()).nullable().optional(),
  temperature: z.number().min(0).max(2).nullable().optional().default(1),
  top_p: z.number().min(0).max(1).nullable().optional().default(1),
  tools: z
    .array(
      z.object({
        type: z.string(),
        function: z.object({
          name: z.string(),
          description: z.string(),
          parameters: z.record(z.any()),
        }),
      })
    )
    .optional(),
  tool_choice: z
    .union([
      z.string(),
      z.object({
        type: z.string(),
        function: z.object({ name: z.string() }),
      }),
    ])
    .nullable()
    .optional(),
  parallel_tool_calls: z.boolean().nullable().optional().default(true),
  user: z.string().optional(),
});

async function* mock_stream() {
  const chunk = {
    text: () => "hello.\n",
    candidates: [
      {
        finishReason: "stop",
      },
    ],
    usageMetadata: {
      promptTokenCount: 1,
      candidatesTokenCount: 1,
      totalTokenCount: 1,
    },
  };
  yield chunk;
  yield chunk;
  yield chunk;
}

class ChatCompletionsHandler {
  private app: FastifyInstance;
  private body: z.infer<typeof CHAT_COMPLETION_SCHEMA>;
  private reply: FastifyReply;
  private req: FastifyRequest;
  private includeUsage: boolean;
  private id: string;
  private firstChunkSent: boolean = false;

  private chunks: any[] = [];

  private retryConfig = {
    enabled: configJson.retry?.enabled ?? false,
    retries: configJson.retry?.retries ?? 5,
    factor: configJson.retry?.factor ?? 2,
    minTimeout: configJson.retry?.minTimeout ?? 1000,
    maxTimeout: configJson.retry?.maxTimeout ?? 5000,
    onRetry: (err: Error, attempt: number) => {
      console.warn(`Retry attempt ${attempt}: ${err?.message ?? err}`);
    },
  };

  constructor(
    app: FastifyInstance,
    body: z.infer<typeof CHAT_COMPLETION_SCHEMA>,
    req: FastifyRequest,
    reply: FastifyReply
  ) {
    this.app = app;
    this.body = body;
    this.req = req;
    this.reply = reply;
    this.includeUsage = body.stream_options?.include_usage ?? false;
    this.id = "chatcmpl-" + Math.random().toString(16).slice(2);
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    // 以下 error 才需要 retry
    const retry_error = [
      GoogleGenerativeAIError,
      GoogleGenerativeAIFetchError,
      GoogleGenerativeAIResponseError,
      GoogleGenerativeAIRequestInputError,
      FetchError,
      AbortError,
    ];
    return retry(async (bail, attempt) => {
      try {
        return await operation();
      } catch (err: any) {
        const is_hit_err = retry_error.some((x) => err instanceof x);
        if (is_hit_err === false) {
          bail(err);
          if (err) err.bail = true;
        }
        throw err; // 触发重试
      }
    }, this.retryConfig);
  }

  async processRequest() {
    if (this.retryConfig.enabled) {
      await this.withRetry(() => this._processRequest());
    } else {
      await this._processRequest();
    }
  }

  async _processRequest() {
    if (this.body.stream) {
      return this.handleStream();
    } else {
      return this.handleSingleResponse();
    }
  }

  private async buildGeneratePayload() {
    const { body } = this;
    const {
      model,
      messages,
      temperature,
      max_completion_tokens,
      max_tokens = max_completion_tokens,
      top_p,
      stop,
      frequency_penalty,
      presence_penalty,
    } = body;
    const gen_model = genAI.getGenerativeModel({
      model: model,
    });

    const system_message = messages.find((x) => x.role === "system");
    const chat_contents = messages.filter((x) => x.role !== "system");

    const contents = await Promise.all(
      chat_contents.map(async (x) => {
        if (typeof x.content === "string") {
          return {
            role: x.role,
            parts: [
              {
                text: x.content,
              },
            ],
          };
        }
        if (!Array.isArray(x.content)) {
          throw new Error("content must be an array");
        }
        const parts = await Promise.all(
          x.content.map(async (y) => {
            if (y.type === "text") {
              return {
                text: y.text,
              };
            }
            if (y.type === "image_url") {
              let url = y.image_url.url;
              if (url.startsWith("http")) {
                const image = await fetch(y.image_url.url);
                const data = await image.arrayBuffer();
                const base64_str = Buffer.from(data).toString("base64");
                const mime = await fromBuffer(data);
                return {
                  inlineData: {
                    mimeType: mime?.mime || "image/jpeg",
                    data: base64_str,
                  },
                };
              } else {
                // url 还可以是 base64
                // 如果是 dataurl 就去掉开头
                if (url.startsWith("data:")) {
                  url = url.substring(url.indexOf(",") + 1);
                }
                // 从 base64 解析 mime
                const mime = await fromBuffer(Buffer.from(url, "base64"));
                return {
                  inlineData: {
                    mimeType: mime?.mime || "image/jpeg",
                    data: url,
                  },
                };
              }
            }
            // NOTE: 目前不支持音频，因为不知道怎么测也不通用
            throw new Error(`not support content type: ${y.type}`);
          })
        );
        return {
          role: x.role,
          parts,
        };
      })
    );
    // assistant => model
    contents.forEach((x) => {
      if (x.role === "assistant") {
        x.role = "model" as any;
      }
    });

    const systemInstruction: string | undefined =
      typeof system_message?.content === "string"
        ? system_message?.content
        : typeof (system_message?.content as any)?.text === "string"
        ? (system_message?.content as any).text
        : undefined;

    const stopSequences =
      stop === undefined || stop === null
        ? undefined
        : Array.isArray(stop)
        ? stop
        : stop
        ? [stop]
        : undefined;

    const generationConfig: GenerationConfig = {
      temperature: temperature ?? undefined,
      maxOutputTokens: max_tokens ?? undefined,
      topP: top_p ?? undefined,
      stopSequences,
      frequencyPenalty: frequency_penalty ?? undefined,
      presencePenalty: presence_penalty ?? undefined,
    };

    // Penalty is not enabled for models/gemini-exp-1121
    // Penalty is not enabled for models/gemini-1.5-pro-exp-0827
    if (model.includes("-exp")) {
      generationConfig.presencePenalty = undefined;
      generationConfig.frequencyPenalty = undefined;
    }

    return {
      gen_model,
      systemInstruction,
      contents,
      generationConfig,
    };
  }

  private buildChunkData({
    text,
    finishReason,
    usage,
  }: {
    text: string;
    finishReason?: string;
    usage?: any;
  }) {
    return {
      id: this.id,
      object: "chat.completion.chunk",
      created: Date.now(),
      model: this.body.model,
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            content: text,
          },
          finish_reason: finishReason,
        },
      ],
      usage: this.includeUsage ? usage : undefined,
    };
  }

  private write_sse_headers() {
    this.reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Transfer-Encoding": "chunked",
    });
  }

  private ensureFirstChunk() {
    if (this.firstChunkSent) return;

    this.write_sse_headers();
    // 如果没有第一个 chunk，发送一个空的 chunk 以避免客户端超时
    const emptyChunk = this.buildChunkData({
      text: "",
      finishReason: "empty_stop",
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    });

    this.reply.raw.write("data: " + JSON.stringify(emptyChunk) + "\n\n");
    this.firstChunkSent = true;
  }

  private async handleStream() {
    const payload = await this.buildGeneratePayload();
    // writeFileSync(
    //   "./tmp_payload.json",
    //   JSON.stringify({ ...payload, id: this.id }, null, 2)
    // );
    const abortSignal = new AbortController();
    const result = await payload.gen_model.generateContentStream(
      {
        systemInstruction: payload.systemInstruction,
        contents: payload.contents,
        generationConfig: payload.generationConfig,
        safetySettings: all_none_safety_settings,
      },
      {
        signal: abortSignal.signal,
      }
    );

    try {
      for await (const chunk of result.stream) {
        if (this.req.socket.closed) {
          abortSignal.abort();
          break;
        }
        this.chunks.push({ ...chunk });

        const data = this.buildChunkData({
          text: chunk.text(),
          finishReason: chunk.candidates?.[0].finishReason ?? undefined,
          usage: {
            prompt_tokens: chunk.usageMetadata?.promptTokenCount ?? undefined,
            completion_tokens:
              chunk.usageMetadata?.candidatesTokenCount ?? undefined,
            total_tokens: chunk.usageMetadata?.totalTokenCount ?? undefined,
          },
        });

        if (!this.firstChunkSent) {
          this.write_sse_headers();
          this.firstChunkSent = true;
        }

        this.reply.raw.write("data: " + JSON.stringify(data) + "\n\n");
      }
      this.ensureFirstChunk();
      this.reply.raw.write("data: [DONE]\n\n");
      this.reply.raw.end();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.error("Stream aborted:", error);
        this.reply.raw.write("data: [DONE]\n\n");
        this.reply.raw.end();
        return;
      }

      console.error("Stream error:", error);

      if (this.firstChunkSent) {
        // 如果是在途中报错，那就 DONE
        this.reply.raw.write("data: [DONE]\n\n");
        this.reply.raw.end();
        return;
      }
      // 如果是在开始报错，那就走 fastify 的 500 逻辑
      throw error;
    } finally {
      // DEBUG: 保存日志

      if (configJson?.debug?.stream?.log) {
        const file = `./logs/${Date.now()}.json`;
        writeFileSync(file, JSON.stringify({ chunks: this.chunks }, null, 2));
      }
    }
  }

  private async handleSingleResponse() {
    const payload = await this.buildGeneratePayload();
    try {
      const result = await payload.gen_model.generateContent({
        systemInstruction: payload.systemInstruction,
        contents: payload.contents,
        generationConfig: payload.generationConfig,
        safetySettings: all_none_safety_settings,
      });

      const content = await result.response.text();
      const response = {
        id: this.id,
        object: "chat.completion",
        created: Date.now(),
        model: this.body.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content,
            },
            finish_reason:
              result.response.candidates?.[0].finishReason ?? "stop",
          },
        ],
        usage: {
          prompt_tokens: result.response.usageMetadata?.promptTokenCount ?? 0,
          completion_tokens:
            result.response.usageMetadata?.candidatesTokenCount ?? 0,
          total_tokens: result.response.usageMetadata?.totalTokenCount ?? 0,
        },
      };

      this.reply.send(response);
    } catch (error) {
      console.error("Single response error:", error);
      throw error;
    }
  }
}

const chatCompletionsRoute: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/v1/chat/completions",
    schema: { body: CHAT_COMPLETION_SCHEMA },
    handler: async (req, reply) => {
      const handler = new ChatCompletionsHandler(
        app,
        req.body as any,
        req,
        reply
      );
      await handler.processRequest();
    },
  });
};

export default chatCompletionsRoute;
