import { env } from "@lib/env/environment.js";
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
        console.log("Connected to MongoDB database");
      })
      .catch((err) => {
        console.log("Error connecting to MongoDB database:", err);
      })
      .finally(() => {
        console.log("MongoDB connection handshake attempt finished");
      });
    process.nextTick(() => this.spyOnConnection());
  }

  private spyOnConnection() {
    this.connection.on("open", () => console.log("MongoDB: open"));
    this.connection.on("disconnected", () =>
      console.log("MongoDB: disconnected"),
    );
    this.connection.on("reconnected", () =>
      console.log("MongoDB: reconnected"),
    );
    this.connection.on("disconnecting", () =>
      console.log("MongoDB: disconnecting"),
    );
    this.connection.on("close", () => console.log("MongoDB: close"));
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
