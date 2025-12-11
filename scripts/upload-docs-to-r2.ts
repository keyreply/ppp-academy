#!/usr/bin/env bun
/**
 * Upload all markdown files to R2 for AI Search indexing
 *
 * This script uploads all .md files from the repository (excluding node_modules)
 * to the R2 bucket under the folder "kira.self/documents/" for self-documentation.
 *
 * AI Search will automatically index these files for RAG queries.
 *
 * Usage:
 *   bun run scripts/upload-docs-to-r2.ts
 *
 * Prerequisites:
 *   - Wrangler CLI authenticated
 *   - R2 bucket exists (keyreply-kira-docs)
 *   - AI Search instance connected to the bucket
 */

import { $ } from 'bun';
import { readdir, readFile, stat } from 'fs/promises';
import { join, relative, basename } from 'path';

// Configuration
const R2_BUCKET = 'keyreply-kira-docs';
const TENANT_FOLDER = 'kira.self'; // Self-documentation tenant
const PROJECT_ROOT = join(import.meta.dir, '..');
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', '.wrangler'];

interface UploadResult {
  file: string;
  r2Key: string;
  status: 'success' | 'error';
  error?: string;
  size: number;
}

/**
 * Recursively find all markdown files
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (EXCLUDED_DIRS.includes(entry.name)) {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * Generate R2 key from file path
 * Format: kira.self/documents/{relative-path-with-underscores}.md
 */
function generateR2Key(filePath: string, projectRoot: string): string {
  const relativePath = relative(projectRoot, filePath);
  // Replace path separators with underscores for flat structure
  // Or keep structure: kira.self/documents/PRD/filename.md
  const cleanPath = relativePath.replace(/\\/g, '/');
  return `${TENANT_FOLDER}/documents/${cleanPath}`;
}

/**
 * Upload a single file to R2 using wrangler
 */
async function uploadFile(filePath: string, r2Key: string): Promise<UploadResult> {
  const stats = await stat(filePath);

  try {
    // Read file content
    const content = await readFile(filePath, 'utf-8');

    // Create a temp file for wrangler to upload
    const tempFile = `/tmp/${basename(filePath)}`;
    await Bun.write(tempFile, content);

    // Upload using wrangler r2 object put (--remote flag to upload to actual R2, not local emulator)
    const result = await $`CLOUDFLARE_ACCOUNT_ID=2e25a3c929c0317b8c569a9e7491cf78 wrangler r2 object put ${R2_BUCKET}/${r2Key} --file ${tempFile} --content-type text/markdown --remote`.quiet();

    // Clean up temp file
    await $`rm ${tempFile}`.quiet();

    return {
      file: filePath,
      r2Key,
      status: 'success',
      size: stats.size
    };
  } catch (error) {
    return {
      file: filePath,
      r2Key,
      status: 'error',
      error: (error as Error).message,
      size: stats.size
    };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Finding markdown files...\n');

  const files = await findMarkdownFiles(PROJECT_ROOT);
  console.log(`Found ${files.length} markdown files\n`);

  if (files.length === 0) {
    console.log('No markdown files found.');
    return;
  }

  // List files to be uploaded
  console.log('Files to upload:');
  for (const file of files) {
    const relativePath = relative(PROJECT_ROOT, file);
    console.log(`  - ${relativePath}`);
  }
  console.log('');

  // Upload files
  console.log(`📤 Uploading to R2 bucket: ${R2_BUCKET}`);
  console.log(`   Folder: ${TENANT_FOLDER}/documents/\n`);

  const results: UploadResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  let totalSize = 0;

  for (const file of files) {
    const r2Key = generateR2Key(file, PROJECT_ROOT);
    const relativePath = relative(PROJECT_ROOT, file);

    process.stdout.write(`  Uploading ${relativePath}... `);

    const result = await uploadFile(file, r2Key);
    results.push(result);

    if (result.status === 'success') {
      successCount++;
      totalSize += result.size;
      console.log('✅');
    } else {
      errorCount++;
      console.log(`❌ ${result.error}`);
    }
  }

  // Summary
  console.log('\n📊 Upload Summary:');
  console.log(`   Total files: ${files.length}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${errorCount}`);
  console.log(`   Total size: ${(totalSize / 1024).toFixed(2)} KB`);

  if (errorCount > 0) {
    console.log('\n❌ Failed uploads:');
    for (const result of results) {
      if (result.status === 'error') {
        console.log(`   - ${relative(PROJECT_ROOT, result.file)}: ${result.error}`);
      }
    }
  }

  console.log('\n✨ AI Search will automatically index these files.');
  console.log(`   Query with tenant filter: folder = "${TENANT_FOLDER}/documents/"`);

  // Generate example query code
  console.log('\n📝 Example query in code:');
  console.log(`
const response = await env.AI.autorag('keyreply-kira-search').search({
  query: 'How does the voice pipeline work?',
  filters: {
    type: 'and',
    filters: [
      { type: 'gt', key: 'folder', value: '${TENANT_FOLDER}/documents//' },
      { type: 'lte', key: 'folder', value: '${TENANT_FOLDER}/documents/z' }
    ]
  },
  max_num_results: 5
});
`);
}

// Run
main().catch(console.error);
