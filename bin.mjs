#!/usr/bin/env node

import sade from 'sade'
import chokidar from 'chokidar'
import path from 'pathe'
import fs from 'fs-extra'
import LruCache from 'lru-cache'

sade('mincopy <source> <dest> [globs]', true)
  .describe('sync files between directories with minimal writes')
  .option('-e, --exclude <glob>', 'exclude files')
  .option('--debug', 'debug')
  .action(async (rawSource, rawDest, globs, options) => {
    const debug = options.debug

    if (globs?.startsWith('[')) {
      try {
        globs = JSON.parse(globs)
      } catch (e) {
        // noop
      }
    }
    if (!globs) {
      globs = '**/*'
    }

    // Folders
    const cwd = process.cwd()
    const source = path.resolve(cwd, rawSource)
    const dest = path.resolve(cwd, rawDest)

    // Cache
    const cache = new LruCache({
      max: 100,
      ttl: 1000 * 60 * 60,
    })

    // Watcher
    const watcher = chokidar.watch(globs, {
      ignored: options.exclude,
      ignorePermissionErrors: true,
      atomic: true,
      cwd: source,
    })
    watcher.on('add', async (file) => {
      try {
        await writeFile(file)
      } catch (e) {
        console.error(`Error in hook add ${file}:`)
        console.error(e)
      }
    })
    watcher.on('change', async (file) => {
      try {
        await writeFile(file)
      } catch (e) {
        console.error(`Error in hook change ${file}:`)
        console.error(e)
      }
    })
    watcher.on('unlink', async (file) => {
      try {
        await unlinkFile(file)
      } catch (e) {
        console.error(`Error in hook unlink ${file}:`)
        console.error(e)
      }
    })
    
    // Operations

    let writeCount = 0
    let unlinkCount = 0

    async function readDestFile (file) {
      if (cache.has(file)) {
        return cache.get(file)
      }
      const content = await fs.readFile(file)
      cache.set(file, content)
      return content
    }

    async function writeFile (file) {
      const srcFile = path.resolve(source, file)
      const destFile = path.resolve(dest, file)

      const newContent = await fs.readFile(srcFile)
      
      if (!fs.existsSync(destFile) || Buffer.compare(await readDestFile(destFile), newContent) !== 0) {
        await fs.ensureDir(path.dirname(destFile))
        await fs.writeFile(destFile, newContent)
        writeCount++
        debug && console.log('wrote', file)
      }
    }

    async function unlinkFile (file) {
      const destFile = path.resolve(dest, file)
      if (fs.existsSync(destFile)) {
        await fs.unlink(destFile)
        unlinkCount++
        debug && console.log('unlinked', file)
      }
    }

    // Log

    setInterval(() => {
      if (writeCount > 0 || unlinkCount > 0) {
        console.log(`${writeCount} files written, ${unlinkCount} files unlinked`)
        writeCount = 0
        unlinkCount = 0
      }
    }, 5000)
  })
  .parse(process.argv)