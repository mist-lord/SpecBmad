import { Command } from 'commander'
import { pluginManager } from '@/core/plugin/manager'
import { ArtifactsIndexerPlugin } from '@/plugins/artifacts-indexer'
import { log } from '@/utils/logger'

export const pluginsCommand = new Command('plugins')
  .description('管理与运行插件')
  .option('-l, --list', '列出插件')
  .option('--init-indexer', '初始化Artifacts索引插件并运行一次')
  .option('--index', '运行Artifacts索引')
  .action(async (opts) => {
    try {
      if (opts.list) {
        const all = pluginManager.getAllPlugins().map(p => p.getInfo())
        if (all.length === 0) log.info('无插件'); else for (const i of all) log.info(`${i.name}@${i.version} enabled=${i.enabled} initialized=${i.initialized}`)
        return
      }
      const name = 'artifacts-indexer'
      if (opts.initIndexer) {
        pluginManager.registerPlugin({ name, version: '0.1.0', description: 'Artifacts 索引生成', enabled: true }, ArtifactsIndexerPlugin)
        await pluginManager.initializePlugin(name)
        return
      }
      if (opts.index) {
        let plug = pluginManager.getPlugin(name) as any
        if (!plug) {
          pluginManager.registerPlugin({ name, version: '0.1.0', enabled: true }, ArtifactsIndexerPlugin)
          await pluginManager.initializePlugin(name)
          plug = pluginManager.getPlugin(name) as any
        }
        plug.indexArtifacts(process.cwd())
        return
      }
      log.info('使用 --list 或 --init-indexer 或 --index')
    } catch (e) {
      log.error(`插件命令执行失败: ${e instanceof Error ? e.message : String(e)}`)
    }
  })

