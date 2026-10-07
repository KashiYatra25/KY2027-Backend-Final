import { env } from "@lib/env/environment.js";
import { logger } from "@logger/index.js";
import mongoose, { type ConnectOptions, Document, Model, Schema } from "mongoose";

export class MongoDbConnection {
  private connection!: mongoose.Connection;

  private static instance: MongoDbConnection;

  private constructor() {
    this.connection = mongoose.connection;
    const options: ConnectOptions = {
      dbName: "ky_2027",
    } as ConnectOptions;
    mongoose
      .connect(env.Mongodb_Database_URL, options)
      .then(() => {
        logger.info("MongoDB connected");
      })
      .catch((err: unknown) => {
        logger.error("MongoDB connection failed", { error: (err as Error).message });
      })
      .finally(() => {
        logger.debug("MongoDB connection handshake attempt finished");
      });
    process.nextTick(() => this.spyOnConnection());
  }

  private spyOnConnection() {
    this.connection.on("open", () => logger.info("MongoDB: connection open"));
    this.connection.on("disconnected", () => logger.warn("MongoDB: disconnected"));
    this.connection.on("reconnected", () => logger.info("MongoDB: reconnected"));
    this.connection.on("disconnecting", () => logger.warn("MongoDB: disconnecting"));
    this.connection.on("close", () => logger.info("MongoDB: connection closed"));
  }

  public static getInstance(): MongoDbConnection {
    if (!MongoDbConnection.instance) {
      MongoDbConnection.instance = new MongoDbConnection();
    }
    return MongoDbConnection.instance;
  }

  public getModel<TSchema extends Document>(
    name: string,
    schema: Schema<TSchema>,
  ): Model<TSchema> {
    if (this.connection.modelNames().includes(name)) {
      return this.connection.model<TSchema>(name);
    }
    return this.connection.model<TSchema>(name, schema);
  }
}

export const connInstance = MongoDbConnection.getInstance();
