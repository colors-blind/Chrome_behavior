# Simple Behavior Logger Extension

一个最简 Chrome 插件示例，用来记录以下行为并输出到页面控制台：

- 输入框内容变化（`input`）
- 光标移动（`mousemove`）
- 光标停留时长（基于两次移动之间的时间差）
- 点击事件（`click`）

## 使用方法

1. 打开 Chrome，进入 `chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前目录
5. 打开任意网页，按 `F12` 打开开发者工具，在 `Console` 查看日志

日志前缀为：`[BehaviorLogger]`
