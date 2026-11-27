import { constants } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

async function copyMissingFiles(source: string, target: string): Promise<number> {
  await mkdir(target, { recursive: true });
  let copied = 0;

  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copied += await copyMissingFiles(from, to);
      continue;
    }
    if (!entry.isFile()) continue;

    try {
      await copyFile(from, to, constants.COPYFILE_EXCL);
      copied += 1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }

  return copied;
}

async function main() {
  if (process.env.SEED_DEPLOYMENT_UPLOADS !== 'true') return;

  const uploadDir = process.env.UPLOAD_DIR;
  if (!uploadDir) throw new Error('UPLOAD_DIR is required to seed deployment uploads.');

  const source = path.resolve(process.cwd(), 'deployment-assets', 'uploads');
  const copied = await copyMissingFiles(source, path.resolve(uploadDir));
  console.log(`Seeded ${copied} missing production upload file(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
