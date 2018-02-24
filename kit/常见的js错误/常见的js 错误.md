
10 个最常见的 JavaScript 错误

1. Uncaught TypeError: Cannot read property
最简单的方法：在构造函数中用合理的默认值来初始化 state。
 var s = undefined;s = s.ss;
2. TypeError: ‘undefined’ is not an object (evaluating
 var s = undefined;s = s.length;
3. Uncaught TypeError: Cannot read property 'length' of null/undefined
 var s = null;s = s.length;
读取属性或调用 空对象(null) 上的方法时发生的错误
undefined == null  true
undefined !== null true

4 (unknown): Script error
当一个未捕获的 JavaScript 错误违反了跨域策略时，就会出现这类脚本错误。
将 Access-Control-Allow-Origin 头信息设置为 * ，表示可以从任何域正确访问资源。如有必要，您可以用你的域名替换 *，
例如 Access-Control-Allow-Origin: www.example.com 

处理多个域名会有些棘手:
https://stackoverflow.com/questions/1653308/access-control-allow-origin-multiple-origin-domains

下面是一些如何在不同环境中设置 Access-Control-Allow-Origin 头信息的例子。
Apache
在 JavaScript 文件所在的文件夹中，使用以下内容创建一个 .htaccess 文件：
Header add Access-Control-Allow-Origin "*"

Nginx
location ~ ^/assets/ {
    add_header Access-Control-Allow-Origin *;
}

HAProxy
rspadd Access-Control-Allow-Origin:\ *

在 script 标签上设置 crossorigin="anonymous" 属性
在你的 HTML 源代码中，对于你设置的 Access-Control-Allow-Origin 头信息的每个脚本，在 script 标签上设置 crossorigin="anonymous" 。在添加脚本标记上的 crossorigin 属性之前，请确保验证上述头信息是否正确发送。在 Firefox 中，如果存在 crossorigin 属性，但  Access-Control-Allow-Origin 头信息不存在，则脚本将不会执行。

5.TypeError: Object doesn’t support property
这是你在调用未定义方法时发生在IE中的错误。你可以在IE开发者工具的控制台进行测试。
this.aaa();
6.TypeError: ‘undefined’ is not a function 
chrome firefox
this.aaa();

7.Uncaught RangeError: Maximum call stack
这是 Chrome 在一些情况下会发生的错误。一个情况是当你调用一个不终止的递归函数时。

9.Uncaught TypeError: Cannot set property
当我们尝试访问一个未定义的变量时，它总是返回 undefined ，我们不能获取或设置任何  undefined 的属性。
在这种情况下，应用程序将抛出 “Uncaught TypeError cannot set property of undefined.” 错误。
var s = undefined;
s.s = "222";
Uncaught TypeError: Cannot set property 's' of undefined

10.ReferenceError: event is not defined
当你尝试访问未定义的变量或超出当前作用域的变量时，会引发此错误.

function ss(){
    var s = 123;
}
console.log(s);