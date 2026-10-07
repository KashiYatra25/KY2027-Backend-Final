import cluster from "cluster";
import { availableParallelism } from "os";
import { logger } from "@logger/index.js";
import { startServer } from "../server";

const totalCPUs = availableParallelism();

if (cluster.isPrimary) {
  logger.info("Primary cluster process started", { pid: process.pid, workers: totalCPUs });

  for (let i = 0; i < totalCPUs; i += 1) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    logger.warn("Worker exited — forking replacement", { pid: worker.process.pid, code, signal });
    cluster.fork();
  });
} else {
  logger.info("Worker process started", { pid: process.pid });

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception — shutting down worker", { error: err.message, stack: err.stack });
    process.exit(1);
  });

  const server = await startServer();

  process.on("unhandledRejection", (err) => {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error("Unhandled rejection — closing server", { error: message, stack });
    if (server) {
      server.close(() => {
        logger.info("Server closed after unhandled rejection");
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
}
