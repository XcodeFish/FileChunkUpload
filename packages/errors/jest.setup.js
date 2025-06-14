/**
 * 测试设置文件
 * 用于在所有测试运行前执行一些通用配置
 */

// 增加全局测试超时时间到30秒，解决retry-manager等测试的超时问题
// eslint-disable-next-line no-undef
jest.setTimeout(30000);
