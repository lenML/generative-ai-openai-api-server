import { GoogleGenerativeAI } from "@google/generative-ai";
import { configJson } from "./args";
import fetch from "./utils/fetch";
import { RequestInit } from "node-fetch";
import { Mode } from "fs";

export const genAI = new GoogleGenerativeAI(configJson.api_key);

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

  static join_url(pathname: string) {
    const url = new URL(pathname, GenAIExtMethods.BASE_URL);
    url.searchParams.set("key", configJson.api_key);
    return url.toString();
  }

  static fetch(pathname: string, init?: RequestInit) {
    const url = GenAIExtMethods.join_url(pathname);
    return fetch(url, {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  }

  static models_cached: any = null;

  static async getModels(): Promise<{
    models: Model[];
  }> {
    if (this.models_cached) {
      return this.models_cached;
    }
    const resp = await GenAIExtMethods.fetch("/v1beta/models");
    const data = await resp.json();
    this.models_cached = data;
    return data as any;
  }
}
