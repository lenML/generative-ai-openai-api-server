import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";

// 定义请求体的 Zod Schema
const COMPLETION_SCHEMA = z.object({
  model: z.string(),
  prompt: z.union([z.string(), z.array(z.string())]),
  best_of: z.number().nullable().optional().default(1),
  echo: z.boolean().nullable().optional().default(false),
  frequency_penalty: z
    .number()
    .min(-2.0)
    .max(2.0)
    .nullable()
    .optional()
    .default(0),
  logit_bias: z.record(z.number()).nullable().optional(),
  logprobs: z.number().int().max(5).nullable().optional(),
  max_tokens: z.number().nullable().optional().default(16),
  n: z.number().int().nullable().optional().default(1),
  presence_penalty: z
    .number()
    .min(-2.0)
    .max(2.0)
    .nullable()
    .optional()
    .default(0),
  seed: z.number().int().nullable().optional(),
  stop: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  stream: z.boolean().nullable().optional().default(false),
  stream_options: z.record(z.any()).nullable().optional(),
  suffix: z.string().nullable().optional(),
  temperature: z.number().min(0).max(2).nullable().optional().default(1),
  top_p: z.number().min(0).max(1).nullable().optional().default(1),
  user: z.string().nullable().optional(),
});

// 路由插件
const completionsRoute: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/v1/completions",
    schema: { body: COMPLETION_SCHEMA },
    handler: async (req, res) => {
      const body = req.body;
      body.n ??= 1;

      // TODO: 这个不太好支持，因为不是所有模型都支持 generateText
      res.send({
        error: "TODO",
      });
      return;

      // 模拟生成的响应
      const response = {
        id: "cmpl-abc123",
        object: "text_completion",
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        system_fingerprint: "fp_example",
        choices: Array(body.n)
          .fill(null)
          .map((_, index) => ({
            index,
            text: `This is a sample completion for prompt: ${body.prompt}`,
            logprobs: null,
            finish_reason: "stop",
          })),
        usage: {
          prompt_tokens: 5,
          completion_tokens: 10 * body.n,
          total_tokens: 5 + 10 * body.n,
        },
      };

      res.send(response);
    },
  });
};

export default completionsRoute;
