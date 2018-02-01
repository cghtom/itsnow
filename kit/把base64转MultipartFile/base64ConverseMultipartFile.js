function pasteImg(textID) {
    var imgReader = function (item) {
        var blob = item.getAsFile(),
            reader = new FileReader();

        reader.onload = function (e) {
            //显示图像
            var msg = '<div> <image src=' + e.target.result + '/> </div>';
            $('#image-'+textID).html(msg);
            // 这些1
        };

        reader.readAsDataURL(blob);
    };

    document.querySelector("."+textID).addEventListener('paste', function (e) {
        var clipboardData = e.clipboardData,
            i = 0,
            items, item, types;

        if (clipboardData) {
            items = clipboardData.items;

            if (!items) {
                return;
            }

            item = items[0];
            types = clipboardData.types || [];

            for (; i < types.length; i++) {
                if (types[i] === 'Files') {
                    item = items[i];
                    break;
                }
            }

            if (item && item.kind === 'file' && item.type.match(/^image\//i)) {
                imgReader(item);
            }
        }
    });
}

// 这些1
var formData = new FormData();
var bytes = window.atob(e.target.result.split(",")[1]); //去掉url的头，并转换为byte
//处理异常,将ascii码小于0的转换为大于0
var ab = new ArrayBuffer(bytes.length);
var ia = new Uint8Array(ab);
for(var i = 0; i < bytes.length; i++) {
    ia[i] = bytes.charCodeAt(i);
}
var file_name = "image.png";
var blob = new Blob([ab], { type: 'image/png'});
formData.append('file',blob, file_name);
formData.append("uploadFlag",2);
formData.append("toUserId",'rt7g8mjczu6a8atqkmkw3ps430zn6i5d');
formData.append("access_token",converse.access_token);
if(!session_type){
    if(jid.indexOf(converse.muc_service_url) >=0 ){
        session_type = 'groupchat';
    } else {
        session_type = 'chat';
    }
}

try {
    $.ajax({
        url:converse.imapi_url + converse.imapi_upload,
        type:"post",
        data:formData,
        datyType:'json',
        processData:false,
        contentType:false,
        success:function(data){
            console.log(data);
            var d = JSON.parse(data);
        }

    });
} catch (e) {
    return null;
}