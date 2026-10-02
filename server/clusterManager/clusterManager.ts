import cluster from "cluster";
import { availableParallelism } from "os";
import { startServer } from "../server";

const totalCPUs = availableParallelism();

if (cluster.isPrimary) {
  for (let i = 0; i < totalCPUs; i += 1) {
    cluster.fork();
  }

  cluster.on("exit", () => {
    cluster.fork();
  });
} else {
  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    console.log("Shutting down the server due to uncaught exception...");
    process.exit(1);
  });

  const server = await startServer();

  process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err);
    if (server) {
      server.close(() => {
        console.log("Server closed due to unhandled rejection");
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
}
