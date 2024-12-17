import fs from "fs";
import { Command } from "commander";
const program = new Command();

const { config } = program
  .name("Gemini Api to OpenAI Api Converter")
  .option("-c, --config [config]", "config file", "genai.config.json")
  .parse(process.argv)
  .opts<{
    config: string;
  }>();

if (!fs.existsSync(config)) {
  console.log("config not found");
  process.exit(1);
}

export const configJson = JSON.parse(fs.readFileSync(config, "utf8")) as {
  api_keys: string[];
  server?: {
    port?: number;
  };
  no_docs?: boolean;
  retry?: {
    enabled?: boolean;
    retries?: number;
    factor?: number;
    minTimeout?: number;
    maxTimeout?: number;
  };
  debug?: {
    stream?: {
      log?: boolean;
    };
  };
  bodyLimit?: number;
};

if (configJson.api_keys.length === 0) {
  console.log("api_key is empty");
  process.exit(1);
}
