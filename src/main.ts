import "./preload";
import "./process_catch";
import fastify, { FastifyReply } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import cors from "@fastify/cors";
import path from "path";

import {
  jsonSchemaTransform,
  createJsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";

import v1_models from "./v1/models";
import v1_chat_completions from "./v1/chat/completions";
import v1_completions from "./v1/completions";
import v1_embeddings from "./v1/embeddings";

import { configJson } from "./args";

const app = fastify({
  logger: true,
});
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

if (!configJson.no_docs) {
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Gemini Api (openai api compatible) Documentation",
        description: "Sample backend service",
        version: "1.0.0",
      },
      servers: [],
    },
    transform: jsonSchemaTransform,
  });

  app.register(fastifySwaggerUI, {
    routePrefix: "/docs",
    baseDir: process.env.IS_PACKED ? path.join(__dirname, "static") : undefined,
  });
}

app.after(async () => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    handler: (req, res) => {
      res.send({ ok: true });
    },
  });

  await app.register(cors, {
    origin: true,
    preflight: false,
    strictPreflight: false,
  });

  const plugins = [
    v1_models,
    v1_chat_completions,
    v1_completions,
    v1_embeddings,
  ];

  for (const plugin of plugins) {
    await app.withTypeProvider<ZodTypeProvider>().register(plugin);
  }
});

async function run() {
  await app.ready();

  await app.listen({
    port: configJson.server?.port ?? 4949,
  });

  console.log(`Server running at http://localhost:4949`);
  if (!configJson.no_docs) {
    console.log(`Documentation running at http://localhost:4949/docs`);
  }
}

run();
