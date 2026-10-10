import { spawnSync } from 'node:child_process'

export function assertProductionSource({ cwd, skipBuild = false, git } = {}) {
  if (skipBuild) throw new Error('Production deployment requires a fresh build; --skip-build is not allowed.')
  const runGit = git ?? ((args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
    if (result.status !== 0) throw new Error('Production source verification failed. Check Git access and repository state.')
    return result.stdout.trim()
  })
  const status = runGit(['status', '--porcelain', '--untracked-files=normal'])
  if (status) throw new Error('Production deployment requires a clean checkout. Commit changes and merge them into main first.')
  runGit(['fetch', 'origin', 'main', '--quiet'])
  const head = runGit(['rev-parse', 'HEAD'])
  const main = runGit(['rev-parse', 'refs/remotes/origin/main'])
  if (head !== main) throw new Error('Production deployment refused: this checkout is not the latest origin/main.')
  return head
}
