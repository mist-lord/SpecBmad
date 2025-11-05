import fs from 'fs';
import { ConfigManager } from '../../src/utils/config';

// 模拟fs模块
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// 取消模拟config模块以使用真实的ConfigManager
jest.unmock('../../src/utils/config');

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
    jest.clearAllMocks();
    
    // 默认模拟文件不存在
    mockFs.existsSync.mockReturnValue(false);
  });

  describe('load', () => {
    it('应该返回空配置当文件不存在时', () => {
      const config = configManager.load();
      
      expect(config).toEqual({});
    });
  });

  describe('save', () => {
    it('应该调用writeFileSync保存配置', () => {
      configManager.save({ projectName: 'Test Project' });
      
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('应该返回undefined当配置不存在时', () => {
      configManager.load(); // 加载空配置
      const projectName = configManager.get('projectName');
      
      expect(projectName).toBeUndefined();
    });
  });

  describe('set', () => {
    it('应该设置配置值但不自动保存', () => {
      configManager.set('projectName', 'Updated Project');
      
      // set方法不会自动调用save
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      
      // 但应该能够获取到设置的值
      expect(configManager.get('projectName')).toBe('Updated Project');
    });
  });
});