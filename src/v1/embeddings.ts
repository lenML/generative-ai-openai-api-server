import { FastifyPluginAsync } from "fastify";
import { object, z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { genAI } from "src/genAI";
import { EmbedContentRequest } from "@google/generative-ai";

// 定义请求体的 Zod Schema
const EMBEDDINGS_SCHEMA = z.object({
  input: z.union([z.string(), z.array(z.string())]),
  model: z.string(),
  encoding_format: z.enum(["float", "base64"]).optional().default("float"),
  dimensions: z.number().nullable().optional(),
  user: z.string().nullable().optional(),
});

function build_embedding_payload(body: z.infer<typeof EMBEDDINGS_SCHEMA>) {
  const { input, model, encoding_format, dimensions, user } = body;
  const gen_model = genAI.getGenerativeModel({
    model: model,
  });
  const input_arr = Array.isArray(input) ? input : [input];
  const requests: EmbedContentRequest[] = input_arr.map((x) => ({
    content: {
      role: "user",
      parts: [
        {
          text: x,
        },
      ],
    },
  }));
  return {
    gen_model,
    requests,
  };
}

// 路由插件
const embeddingsRoute: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/v1/embeddings",
    schema: { body: EMBEDDINGS_SCHEMA },
    handler: async (req, res) => {
      const { model } = req.body;
      const payload = build_embedding_payload(req.body);

      const resp = await payload.gen_model.batchEmbedContents({
        requests: payload.requests,
      });

      const response = {
        object: "list",
        data: resp.embeddings.map((emb, index) => {
          return {
            index,
            object: "embedding",
            embedding: emb.values,
          };
        }),
        model,
      };

      res.send(response);
    },
  });
};

export default embeddingsRoute;
