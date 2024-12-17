import { GoogleGenerativeAI } from "@google/generative-ai";
import { configJson } from "./args";
import fetch from "./utils/fetch";
import { RequestInit } from "node-fetch";
import { Mode } from "fs";

class GenAIHub {
  clients = [] as GoogleGenerativeAI[];
  index = 0;

  // NOTE: 这个类用于创建 GoogleGenerativeAI 实例，并提供随机轮询和记录错误的能力
  constructor(api_keys: string[]) {
    this.clients = api_keys.map((key) => new GoogleGenerativeAI(key));
  }

  next() {
    this.index = (this.index + 1) % this.clients.length;
    return this.clients[this.index];
  }

  random(not_is?: GoogleGenerativeAI) {
    const clients = this.clients.filter((client) => client !== not_is);
    if (clients.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * clients.length);
    console.log(`[hub]client index: ${index}`);
    return clients[index];
  }
}
export const gen_ai_hub = new GenAIHub(configJson.api_keys);

// prettier-ignore
export type Model = {
  name:                       string;
  version:                    string;
  displayName:                string;
  description:                string;
  inputTokenLimit:            number;
  outputTokenLimit:           number;
  supportedGenerationMethods: string[];
  temperature?:               number;
  topP?:                      number;
  topK?:                      number;
  maxTemperature?:            number;
}

/**
 * 拓展方法 有的方法 @google/generative-ai 里面没有实现
 */
export class GenAIExtMethods {
  static BASE_URL = "https://generativelanguage.googleapis.com";

  constructor(readonly api_key: string) {}

  join_url(pathname: string) {
    const url = new URL(pathname, GenAIExtMethods.BASE_URL);
    url.searchParams.set("key", this.api_key);
    return url.toString();
  }

  fetch(pathname: string, init?: RequestInit) {
    const url = this.join_url(pathname);
    return fetch(url, {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  }

  models_cached: any = null;

  async getModels(): Promise<{
    models: Model[];
  }> {
    if (this.models_cached) {
      return this.models_cached;
    }
    const resp = await this.fetch("/v1beta/models");
    const data = await resp.json();
    this.models_cached = data;
    return data as any;
  }
}
