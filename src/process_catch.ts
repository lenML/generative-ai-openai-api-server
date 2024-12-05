process.on("uncaughtException", (err) => {
  console.error(`[Uncaught exception]`);
  console.error(err);
});
process.on("unhandledRejection", (err) => {
  if (err instanceof DOMException && err.name === "AbortError") {
    // ref: https://github.com/google-gemini/generative-ai-js/issues/303
    console.log(`[Abort] ${err.message}`);
    return;
  }

  console.error(`[Unhandled rejection]`);
  console.error(err);
});
