import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/** S3-compatible object storage behind an interface; local disk for local-first operation. */
export interface Storage {
  put(
    key: string,
    data: Uint8Array | { fromFile: string },
    contentType?: string,
  ): Promise<{ key: string; url: string }>;
  get(key: string): Promise<Uint8Array | null>;
  localPath(key: string): string | null;
  url(key: string): string;
}

export class LocalStorage implements Storage {
  constructor(
    private readonly root: string,
    private readonly publicBase = "/files",
  ) {}

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error(`Invalid storage key: ${key}`);
    return full;
  }

  async put(key: string, data: Uint8Array | { fromFile: string }) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    if (data instanceof Uint8Array) await writeFile(full, data);
    else await copyFile(data.fromFile, full);
    return { key, url: this.url(key) };
  }

  async get(key: string) {
    try {
      return new Uint8Array(await readFile(this.resolve(key)));
    } catch {
      return null;
    }
  }

  localPath(key: string) {
    return this.resolve(key);
  }

  url(key: string) {
    return `${this.publicBase}/${key}`;
  }

  async exists(key: string) {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
