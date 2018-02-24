1 npm install -g parcel-bundler
2 parcel .\src\pages\index.html

优点：
1 快速打包
Parcel 使用工作进程启用多核编译，并具有文件系统缓存，即使在重新启动后也可快速重新构建。

2 零配置代码拆分 
   parcel使用动态import()语法拆分您的输出包，所以只加载初始化时所需的包

3 模块热替换，修改代码，parcel会自动更新浏览器中的模块，不需要任何配置
   当你在开发过程中进行更改时，Parcel 会自动更新浏览器中的模块，不需要进行任何配置。

4 友好的错误记录
   遇到错误时，Parcel 会以语法高亮的形式打印的代码帧，以帮助你查明问题

5 打包所有资源 
   Parcel 支持JS，CSS，HTML，文件资源等等 - 不需要安装任何插件。
   
6 自动转换
   在需要时，代码使用 Babel，PostCSS 和 PostHTML 自动转换 - 即使是 node_modules。