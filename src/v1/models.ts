import { FastifyPluginAsync } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { configJson } from "src/args";
import { GenAIExtMethods } from "src/genAI";

const gen_ai0 = new GenAIExtMethods(configJson.api_keys[0]);

// 路由插件
const listModelsRoute: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/v1/models",
    handler: async (_req, res) => {
      const { models } = await gen_ai0.getModels();
      const response = {
        object: "list",
        data:
          models?.map((x) => ({
            id: x.name.replace("models/", ""),
            object: "model",
            owned_by: "google",
            created: 1666666666,

            _extra: x,
          })) || [],
      };
      res.send(response);
    },
  });
};

export default listModelsRoute;
