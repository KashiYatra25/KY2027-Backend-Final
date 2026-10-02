import { RuntimeManager } from "./manager.js"
import { createRuntimeEnvironment } from "./runtimeData.js";

const managerInstance = new RuntimeManager();
const { runTimeEnv } = await managerInstance.getRuntimeConfig();
export const env = createRuntimeEnvironment(runTimeEnv);
