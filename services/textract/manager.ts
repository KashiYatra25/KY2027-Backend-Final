import {
  TextractClient,
  DetectDocumentTextCommand,
  type DetectDocumentTextCommandInput,
  type Block,
} from "@aws-sdk/client-textract";
import type { ImageInput } from "./types.js";

export class TextractManager {
  private client: TextractClient;

  public constructor(region: string) {
    this.client = new TextractClient({ region });
  }

  /**
   * Extract LINE type blocks and return their text
   * @param blocks - Textract blocks
   * @returns Array of text lines
   * @example
   * 
   * const blocks = await textractManager.detectDocumentText(image);
   * const lines = textractManager.extractTextLines(blocks);
   * lines: ["GOVERNMENT OF INDIA", "SRAJAN SAXENA", "DOB: 15/08/1999", "Male", "1234 5678 9012"]
   * 
   */
  public extractTextLines(blocks: Block[]): string[] {
    return blocks
      .filter((block) => block.BlockType === "LINE" && block.Text)
      .map((block) => block.Text as string);
  }

  /**
   * Detect text in document using Amazon Textract
   * @param client - Textract client
   * @param image - Image input (buffer or S3 reference)
   * @returns Array of detected text blocks
   */
  public async detectDocumentText(image: ImageInput): Promise<Block[]> {
    let input: DetectDocumentTextCommandInput;

    if (image.type === "buffer") {
      input = {
        Document: {
          Bytes: image.data,
        },
      };
    } else {
      input = {
        Document: {
          S3Object: {
            Bucket: image.bucket,
            Name: image.key,
          },
        },
      };
    }

    const command = new DetectDocumentTextCommand(input);
    const response = await this.client.send(command);

    return response.Blocks ?? [];
  }
}
