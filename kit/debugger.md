1. ‘debugger;’
除了 console.log , debugger; 是我们最喜欢、快速且肮脏的调试工具。一旦执行到这行代码，Chrome 会在执行时自动停止。 你甚至可以使用条件语句加上判断，这样可以只在你需要的时候运行。愚人码头注：本人实在觉得这种调试方面很不好，因为后续的调试步骤和断点调试没什么区别。而且调试完成后，还要记住删掉这行代码。确实有点肮脏。

2. 将 objects 显示为表格
有时，你有一个复杂的对象要查看。你可以用 console.log 查看并滚动浏览该对象，或者使用console.table展开，更容易看到正在处理的内容！

var animals = [
    { animal: 'Horse', name: 'Henry', age: 43 },
    { animal: 'Dog', name: 'Fred', age: 13 },
    { animal: 'Cat', name: 'Frodo', age: 18 }
];
 
console.table(animals);

3. 尝试所有的屏幕尺寸

虽然在桌面设备上安装不同移动设备模拟器非常棒，但在现实世界中并不可行。 应该是调整你的可视窗口，而不是替换移动设备？ Chrome为你提供所需的一切。 进入Chrome 开发者调试工具，然后点击 ‘toggle device mode(切换设备模式)’ 按钮。 实时观察窗口变化即可!

4. 如何快速找到DOM元素
在 Elements(元素) 面板中标记 DOM 元素，并可以在 console(控制台) 中使用它。Chrome 检测器会保留其历史记录中的最后 5 个元素，以便最终标记的元素显示 $0 ，倒数第二个标记元素 $1 ，依此类推。

如果你按照“item-4”，“item-3”，“item-2”，“item-1”，“item-0”的顺序标记下列项，则可以在控制台中像这样访问DOM节点：

5. 使用 console.time() 和 console.timeEnd() 来标记循环耗时
要确切地知道某段代码需要执行多长时间，尤其是在调试慢循环时，可能会非常有用。您甚至可以通过为该方法分配标签来设置多个定时器。让我们看看它是如何工作的：


console.time('Timer1');
 
var items = [];
 
for(var i = 0; i < 100000; i++){
   items.push({index: i});
}
 
console.timeEnd('Timer1');


6. 获取函数的堆栈跟踪信息
你可能知道JavaScript框架，会引入大量代码。

它创建视图触发事件，而且你最终会想知道函数调用是怎么发生的。

因为 JavaScript 不是一个很结构化的语言，有时候很难完整的了解到底 发生了什么 以及 什么时候发生 的。 使用 console.trace（(仅仅只是在控制台中跟踪) 可以方便地调试JavaScript 。

假设你现在想看 car 实例在第24行调用 funcZ 函数的完整堆栈轨迹信息:

var car; 
var func1 = function() {
    func2();
} 
var func2 = function() {
    func4();
}
var func3 = function() {
} 
var func4 = function() {
    car = new Car();
    car.funcX();
}
var Car = function() {
    this.brand = ‘volvo’;
    this.color = ‘red’;
    this.funcX = function() {
        this.funcY();
    }
    this.funcY = function() {
        this.funcZ();
    }
    this.funcZ = function() {
        console.trace(‘trace car’)
    }
} 
func1();
现在我们可以看到 func1 调用 func2， func2 调用 func4。 Func4 创建了一个 Car 的实例，然后调用函数 car.funcX，依此类推。

即使你认为非常了解自己的代码，这种分析仍然可以让你感到很方便。假如你想改进你的代码。获取跟踪信息和所有涉及的函数名单，每一项都可以点击，你可以在他们之间来回切换。这就像一个特地为你准备的菜单。

7. 美化代码使调试 JavaScript 变得简单
Chrome 可以将你的 Javascript 文件美化为更易阅读的格式。 {} 


8. 快速查找要调试的函数
假设你想在一个函数中设置一个断点。

最常见的两种方法是：

在源代码查看器查找到相应的行，并添加一个断点
在代码中添加debugger
在控制台中使用 debug(funcName)，当到达传入的函数时，代码将停止。
（注意：这个函数和console.debug 函数是不同的东西。）

9. 屏蔽不相关的代码