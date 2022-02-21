# mincopy

Synchronize and watch folder, with minimal write operations (by comparing file contents). Useful if a watcher is monitoring the destination folder.

Installation:

```
pnpm i -g mincopy
```

Usage:

```
mincopy some/source/folder a/destination/directory --exclude "**/node_modules/**"
```
