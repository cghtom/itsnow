java后端-文件下载总结

针对不同浏览器乱码问题

=====================

if (request.getHeader("User-Agent").toLowerCase().indexOf("firefox") > 0) {

name = new String(name.getBytes("UTF-8"), "ISO8859-1"); // firefox浏览器

} else if (request.getHeader("User-Agent").toUpperCase().indexOf("MSIE") > 0) {

name = java.net.URLEncoder.encode(name, "UTF-8");// IE浏览器

name = name.replaceAll("\\+", "%20");

}else if (request.getHeader("User-Agent").toUpperCase().indexOf("CHROME") > 0) {

name = new String(name.getBytes("UTF-8"), "ISO8859-1");

}else {

name = new String(name.getBytes("UTF-8"), "ISO8859-1"); // firefox浏览器

}

2文件名中有特殊字符，出线异常：

=============================

response.setHeader("Content-disposition", "attachment;filename=\"" + fileName +"\"");

3tips:

=====

ie浏览器的header有时有mise 有时没有mise

浏览器内核主要分：ie chrome Firefox

URLEncoder.encode  空格 转为 +
