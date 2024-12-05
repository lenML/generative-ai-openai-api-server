import "dotenv/config";
import { setGlobalDispatcher, ProxyAgent } from "undici";

if (process.env.HTTPS_PROXY) {
  if (!process.env.NO_PROXY) {
    process.env.NO_PROXY = ["localhost", "127.0.0.1", "0.0.0.0"].join(",");
  }
  const dispatcher = new ProxyAgent({
    uri: new URL(process.env.HTTPS_PROXY).toString(),
  });
  setGlobalDispatcher(dispatcher);
}
