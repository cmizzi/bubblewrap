/*
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import * as extract from 'extract-zip';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as util from 'util';
import {exec, spawn} from 'child_process';
import * as tar from 'tar';
import {WebManifestIcon} from './types/WebManifest';

const execPromise = util.promisify(exec);

export async function execute(cmd: string[], env: NodeJS.ProcessEnv): Promise<void> {
  await execPromise(cmd.join(' '), {env: env});
}

export async function downloadFile(url: string, path: string): Promise<void> {
  const result = await fetch(url);
  const fileStream = fs.createWriteStream(path);

  await new Promise((resolve, reject) => {
    result.body.pipe(fileStream);
    result.body.on('error', (err) => {
      reject(err);
    });
    fileStream.on('finish', () => {
      resolve();
    });
  });
}

export function unzipFile(
    zipFile: string, destinationPath: string, deleteZipWhenDone = false): Promise<void> {
  return new Promise((resolve, reject) => {
    extract(zipFile, {dir: destinationPath}, (err) => {
      if (err) {
        reject(err);
        return;
      }
      if (deleteZipWhenDone) {
        fs.unlinkSync(zipFile);
      }
      resolve();
    });
  });
}

export async function untar(
    tarFile: string, destinationPath: string, deleteZipWhenDone = false): Promise<void> {
  console.log(`Extracting ${tarFile} to ${destinationPath}`);
  await tar.x({
    file: tarFile,
    cwd: destinationPath,
  });
  if (deleteZipWhenDone) {
    fs.unlinkSync(tarFile);
  }
}

export function execInteractive(
    cwd: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const shell = spawn(`"${cwd}"`, args, {
    stdio: 'inherit',
    env: env,
    shell: true,
  });
  return new Promise((resolve, reject) => {
    shell.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(code);
      }
    });
  });
}

/**
 * Fetches data for the largest icon from the web app manifest with a given purpose.
 * @param {Array<WebManifestIcon>|undefined} icons List of the manifest icons.
 * @param {string} purpose Purpose filter that the icon must match.
 * @param {number} minSize The minimum required icon size enforced id provided.
 */
export function findSuitableIcon(
    icons: WebManifestIcon[], purpose: string, minSize = 0): WebManifestIcon | null {
  if (icons.length === 0) {
    return null;
  }

  let largestIcon: WebManifestIcon | null = null;
  let largestIconSize = 0;
  for (const icon of icons) {
    const size = (icon.sizes || '0x0').split(' ')
        .map((size) => Number.parseInt(size, 10))
        .reduce((max, size) => Math.max(max, size), 0);
    const purposes = new Set((icon.purpose || 'any').split(' '));
    if (purposes.has(purpose) && (!largestIcon || largestIconSize < size)) {
      largestIcon = icon;
      largestIconSize = size;
    }
  }

  if (largestIcon === null || (minSize > 0 && largestIconSize < minSize)) {
    return null;
  }

  largestIcon.size = largestIconSize;
  return largestIcon;
}