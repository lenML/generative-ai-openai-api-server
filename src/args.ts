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
  api_key: string;
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
};

if (configJson.api_key === "") {
  console.log("api_key is empty");
  process.exit(1);
}
