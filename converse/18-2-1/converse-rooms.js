// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window */

/* This is a Converse.js plugin which add support for multi-user chat rooms, as
 * specified in XEP-0045 Multi-user chat.
 */
(function (root, factory) {
    define("converse-rooms", [
        "converse-core",
        "converse-api",
        "tpl!createroom",
        "typeahead",
        "converse-chatview",
        "jquery",
        "changeToPinYin",
        "sortByPinYin"
    ], factory);
}(this, function (converse,
                  converse_api,
                  tpl_createroom) {
    "use strict";
    converse.templates.createroom = tpl_createroom;

    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
        $iq = converse_api.env.$iq,
        $build = converse_api.env.$build,
        $msg = converse_api.env.$msg,
        $pres = converse_api.env.$pres,
        b64_sha1 = converse_api.env.b64_sha1,
        utils = converse_api.env.utils;
    // Other necessary globals
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        moment = converse_api.env.moment;

    // For translations
    var __ = utils.__.bind(converse);
    var ___ = utils.___;

    // Add Strophe Namespaces
    Strophe.addNamespace('MUC_ADMIN', Strophe.NS.MUC + "#admin");
    Strophe.addNamespace('MUC_OWNER', Strophe.NS.MUC + "#owner");
    Strophe.addNamespace('MUC_REGISTER', "jabber:iq:register");
    Strophe.addNamespace('MUC_ROOMCONF', Strophe.NS.MUC + "#roomconfig");
    Strophe.addNamespace('MUC_USER', Strophe.NS.MUC + "#user");

    converse_api.plugins.add('converse-rooms', {

        initialize: function () {

            var converse = this.converse;

            this.updateSettings({
                muc_service_url: "@muc." + converse.domain,
            });

            converse.officialInfo = function (official_id) {
                var official_account,
                    official_id = Number(official_id);

                if (converse.official_list && converse.official_list.length > 0) {
                    for (var i = 0; i < converse.official_list.length; i++) {
                        if (converse.official_list[i].officialId === official_id) {
                            official_account = converse.official_list[i];
                            break;
                        }
                    }
                }

                if (!official_account) {
                    var official_json = $.ajax({
                        url: converse.imapi_url + converse.imapi_official_find,
                        data: {'officialId': official_id, 'access_token': converse.access_token},
                        cache: false,
                        async: false
                    }).responseText;
                    var official_info = JSON.parse(official_json);
                    if (official_info && official_info.resultCode && official_info.resultCode == 1 && official_info.data && official_info.data.onlineService && official_info.data.status && official_info.data.status === 1) {
                        official_account = official_info.data;
                        if (converse.official_list && converse.official_list.length > 0) {
                            converse.official_list[converse.official_list.length] = official_account;
                        } else {
                            converse.official_list = new Array();
                            converse.official_list[0] = official_account;
                        }

                        //更改公众号列表中信息
                        if (converse.allow_official) {
                            converse_api.officials.editItem(official_account);
                        }
                    }
                }

                return official_account;
            },

                converse.officialByDomain = function (domain) {
                    var official_account;

                    if (converse.official_list && converse.official_list.length > 0) {
                        for (var i = 0; i < converse.official_list.length; i++) {
                            if (converse.official_list[i].domain === domain) {
                                official_account = converse.official_list[i];
                                break;
                            }
                        }
                    }

                    if (!official_account) {
                        var official_json = $.ajax({
                            url: converse.imapi_url + converse.imapi_online_official_list,
                            data: {'access_token': converse.access_token},
                            cache: false,
                            async: false
                        }).responseText;
                        var official_list = JSON.parse(official_json);
                        if (official_list && official_list.resultCode && official_list.resultCode == 1 && official_list.data) {
                            converse.official_list = official_list.data;

                            for (var i = 0; i < official_list.data.length; i++) {
                                if (official_list.data[i].domain === domain) {
                                    official_account = official_list.data[i];
                                }
                            }
                        }
                    }
                    return official_account;
                },

                //room_jid不包含service_url
                converse.roomInfo = function (room_jid) {
                    var room_list = converse.muc_room_list, room_info;
                    if (room_list && room_list.length > 0) {
                        for (var r = 0; r < room_list.length; r++) {
                            if (room_jid === room_list[r].jid) {
                                room_info = room_list[r];
                                break;
                            }
                        }
                    }
                    if (!room_info) {
                        var html = $.ajax({
                            url: converse.imapi_url + converse.imapi_room_get,
                            data: {roomJid: room_jid, access_token: converse.access_token},
                            cache: false,
                            async: false
                        }).responseText;
                        var room_info_data = JSON.parse(html);
                        if (room_info_data && room_info_data.resultCode && room_info_data.resultCode == 1 && room_info_data.data) {
                            room_info = room_info_data.data;
                            room_list[room_list.length] = room_info;
                        }
                    }
                    return room_info;
                },

                //从im读取房间信息并更新本地
                converse.imRoomInfo = function (room_jid) {
                    var room_info;
                    if (room_jid) {
                        var html = $.ajax({
                            url: converse.imapi_url + converse.imapi_room_get,
                            data: {roomJid: room_jid, access_token: converse.access_token},
                            cache: false,
                            async: false
                        }).responseText;
                        var room_info_data = JSON.parse(html);
                        if (room_info_data && room_info_data.resultCode && room_info_data.resultCode == 1 && room_info_data.data) {
                            room_info = room_info_data.data;

                            var room_list = converse.muc_room_list,
                                isExist = false;
                            if (room_list && room_list.length > 0) {
                                for (var r = 0; r < room_list.length; r++) {
                                    if (room_info.id === room_list[r].id) {
                                        room_list.splice(r, 1, room_info);
                                        isExist = true;
                                        break;
                                    }
                                }
                                if (!isExist) {
                                    room_list[room_list.length] = room_info;
                                }
                            }
                        }
                    }
                    return room_info;
                },

                converse.editRoomName = function (room_jid, content) {
                    /*
                     var room = converse.imRoomInfo(room_jid);
                     */

                    if (content.indexOf('修改群名称') > -1) {
                        var text = content.substring(content.indexOf('修改群名称') + 6);

                        var textEncode = converse.htmlEncode(text);
                        var room_list = converse.muc_room_list;
                        if (room_list && room_list.length > 0) {
                            for (var r = 0; r < room_list.length; r++) {
                                if (room_jid === room_list[r].jid) {
                                    room_list[r].name = text;
                                }
                            }
                        }

                        //修改会话窗口群聊标题
                        var jid = room_jid + converse.muc_service_url;

                        //修改群列表中房间名称
                        $('#chatrooms #available-chatrooms dd.available-chatroom').each(function (index, element) {
                            var a_btn = $(element).find('a');
                            var room_jid = a_btn.attr('data-room-jid');
                            if (room_jid === jid) {
                                a_btn.attr('title', textEncode);
                                a_btn.text(text);
                            }
                        });

                        //修复联系人面板群聊列表中名称
                        $(converse.roster_room_list_item_class).each(function (index, element) {
                            var a_btn = $(element).find('a');
                            var item_jid = a_btn.attr('data-room-jid');
                            if (jid === item_jid) {
                                a_btn.attr('title', text);
                                a_btn.text(text);
                            }
                        });

                        if (converse.allow_chatlist) {
                            converse_api.chatlist.update(jid, text);
                        }

                        var room_window = converse.chatboxviews.get(jid);

                        if (room_window) {

                            var $chat_title = $(room_window.el).find('.chat-head-chatroom').find('.chat-title');
                            $chat_title.text(text);

                        }
                    }
                },

                //接收群聊删除消息删除本地群聊
                converse.localRoomDel = function (room_jid) {
                    var c_room_jid = room_jid + converse.muc_service_url;
                    //删除面板列表中的房间信息
                    if (room_jid.indexOf('online') >= 0) {
                        $('#conversejs #officials #converse-official-list .officials-room-item-list .official-room-group-item').each(function (index, element) {
                            var a_btn = $(element).find('a');
                            var room_jid = a_btn.attr('data-room-jid');
                            if (room_jid === c_room_jid) {
                                $(element).remove();
                            }
                        });
                    } else {
                        $('#chatrooms #available-chatrooms dd.available-chatroom').each(function (index, element) {
                            var a_btn = $(element).find('a');
                            var item_jid = a_btn.attr('data-room-jid');
                            if (c_room_jid === item_jid) {
                                $(element).remove();
                            }
                        });

                        $(converse.roster_room_list_item_class).each(function (index, element) {
                            var a_btn = $(element).find('a');
                            var item_jid = a_btn.attr('data-room-jid');
                            if (c_room_jid === item_jid) {
                                $(element).remove();
                            }
                        });

                        if (converse.allow_chatlist) {
                            converse_api.chatlist.deleteitem(c_room_jid);
                        }
                    }

                    converse_api.rooms.close(c_room_jid, true);
                },

                //房间是否存在
                converse.roomIsExists = function (room_jid) {
                    try {
                        var html = $.ajax({
                            url: converse.imapi_url + converse.imapi_room_get,
                            data: {roomJid: room_jid, access_token: converse.access_token},
                            cache: false,
                            async: false
                        }).responseText;
                        var room_info = JSON.parse(html);
                        if (room_info && room_info.resultCode && room_info.resultCode === 1 && room_info.data) {
                            return room_info.data;
                        }
                    } catch (e) {
                        return null;
                    }
                },

                //创建群聊显示页面
                converse.createRoomShow = function () {

                    var id = 'createroom-' + Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                    //查看是否有新建群聊页面，如果有打开
                    var div_id = $("#" + id).length;
                    if (div_id > 0) {
                        return div_id;
                    }

                    var input = "",
                        friends_list = converse.friends_list,
                        colleagues_list = converse.colleagues_list,
                        default_img = converse.emoticons_file_path + converse.user_default_img,
                        show_users = [],
                        concat_list = [];
                    if (friends_list != null && friends_list.length > 0) {
                        concat_list = concat_list.concat(friends_list);
                    }
                    if (colleagues_list != null && colleagues_list.length > 0) {
                        concat_list = concat_list.concat(colleagues_list);
                    }
                    concat_list = converse.sortListByPingYin(concat_list);
                    if (concat_list && concat_list.length > 0) {
                        for (var i = 0; i < concat_list.length; i++) {
                            var data = concat_list[i],
                                user_avatar_url = data.hasAvatar ? converse.imapi_url + converse.imapi_download_avatar + '?userId=' + data.userId + '&type=t&access_token=' + converse.access_token : default_img;
                            if ($.inArray(data.userId, show_users) === -1) {
                                input += '<div id="left'+data.userId+'" class="col-xs-12 left" style="margin-top: 10px;margin-bottom: 5px;padding: 0">'
                                    +'<img width="40" height="40" class="room-img"  style="float: left"  src="' + user_avatar_url + '" onerror="javascript:this.src=' + "'" + default_img + "'" + ';">'
                                    +'<i class="fa fa-circle-o" style=""></i>'
                                    +'<input type="checkbox" data-leftuserid="' + data.userId + '"  value="' + data.userId + '">'
                                    +'<label for="' + data.userId + '"> ' + data.nickname + '</label>' + '</input>' +
                                    '</div>';
                                show_users.push(data.userId);
                            }
                        }
                    }
                    var html = converse.templates.createroom({
                        'id': id,
                        'input': input
                    });
                    $('#conversejs').append(html);

                    ////对按钮绑定事件
                    // $(".create-room-body #btnRight").on('click', converse.createRoomTORight);
                    // $(".create-room-body #btnLeft").on('click', converse.createRoomTOLeft);
                    // $(".create-room-body #btnAllMoveRight").on('click', converse.createRoomTOAllRight);
                    // $(".create-room-body #btnAllMoveLeft").on('click', converse.createRoomTOAllLeft);

                    $('.create-room .close-chatbox-button').on('click', converse.createRoomClose);
                    $(".create-room-body .create-room-submit").on('click', converse.createRoomSubmit);
                    $('.create-room .filter-user-chat').on('click',converse.filterUser);
                    $('.create-room-body #listLeft .left').on('click',converse.addRightUser);
                },
                //cgh 选择用户left copy right
                converse.addRightUser = function () {
                    var $this = $(this),id=$this.find("input").attr("data-leftuserid");
                    if(!$(this).hasClass("ok")){//选中用户
                        //左边 .left -> .left .ok
                        //右边 .right .remove
                        var removeClassIcon = "right remove";
                        $this.addClass("ok");
                        $this.find("i").removeClass("fa-circle-o").addClass("fa-check-circle");
                        var html = '<div id="right'+id+'" class="col-xs-12" style="margin-top: 10px;margin-bottom: 5px;padding: 0">'
                            +'<img width="40" height="40" class="room-img" style="float:left" src="'+ $.trim($(this).find("img").attr("src")) + '" onerror="'+$.trim($(this).find("img").attr("onerror"))+'"/>'
                            +'<i class="fa fa-times-circle"></i>'
                            +'<input type="checkbox" class="'+removeClassIcon+'" value="'+id+'">'
                            +'<label> '+$this.find("label").text()+'</label>'
                            +"</input></div>";
                        $(".create-room-body  #listRight").append(html);
                        $('.create-room-body #listRight .right').unbind().bind('click',converse.removeLeftUser);
                    }else{//重复选择用户取消选中
                        $("#right"+id).remove();

                        $this.removeClass("ok");
                        $this.find("i").removeClass("fa-check-circle").addClass("fa-circle-o");
                    }
                },
                //cgh 删除 right 移除
                converse.removeLeftUser = function () {
                    var $this = $(this),id = $this.val();
                    $this.parent().remove();
                    $("#left"+id).removeClass("ok");
                    $("#left"+id).find("i").removeClass("fa-check-circle").addClass("fa-circle-o");
                },

                //cgh 搜索用户 绑定选中事件
                converse.filterUser = function () {
                    var nickname = $.trim($("#filteruser").val());
                    var input = '',
                        friends_list = converse.friends_list,
                        colleagues_list = converse.colleagues_list,
                        default_img = converse.emoticons_file_path + converse.user_default_img,
                        show_users = [],
                        concat_list = [],
                        rightUserIds = [];
                    if (friends_list != null && friends_list.length > 0) {
                        concat_list = concat_list.concat(friends_list);
                    }
                    if (colleagues_list != null && colleagues_list.length > 0) {
                        concat_list = concat_list.concat(colleagues_list);
                    }
                    concat_list = converse.sortListByPingYin(concat_list);
                    if (concat_list == null || concat_list.length < 0) {
                        alert(__("Please add the contact and try again"));
                        return;
                    }
                    $("#listLeft").html(input);
                    $("#listRight .right").each(function (index, el) {
                        rightUserIds.push($.trim($(el).val()));
                    });
                    if (concat_list && concat_list.length > 0) {
                        for (var i = 0; i < concat_list.length; i++) {
                            var data = concat_list[i],
                                user_avatar_url = data.hasAvatar ? converse.imapi_url + converse.imapi_download_avatar + '?userId=' + data.userId + '&type=t&access_token=' + converse.access_token : default_img,
                                ok = "",circle = ' fa-circle-o';
                            if( rightUserIds.indexOf(data.userId+"") != -1){
                                ok = " ok";
                                circle = " fa-check-circle";
                            }

                            if ($.inArray(data.userId, show_users) === -1) {
                                if (data.nickname && data.nickname.indexOf(nickname) != -1){
                                    input +=
                                        '<div id="left'+data.userId+'" class="col-xs-12 left'+ok+'" style="margin-top: 10px;margin-bottom: 5px;padding: 0">'
                                        + '<img width="40" height="40" class="room-img"  style="float: left"  src="' + user_avatar_url + '" onerror="javascript:this.src=' + "'" + default_img + "'" + ';">'
                                        + '<i class="fa'+circle+'"></i>'
                                        + '<input type="checkbox" data-leftuserid="' + data.userId + '" value="' + data.userId + '">'
                                        + '<label for="' + data.userId + '"> ' + data.nickname + '</label>' + '</input>' + '</div>';
                                    show_users.push(data.userId);
                                }
                            }
                        }
                    }
                    $("#listLeft").html(input);
                    $('.create-room-body #listLeft .left').unbind().bind('click',converse.addRightUser);
                },
                converse.createRoomClose = function () {
                    $(".create-room").remove();
                },

     /*           converse.createRoomTORight = function () {
                    var nodes = $(".create-room-body #listLeft input:checked").parent();
                    $(".create-room-body #listRight").append(nodes);
                },

                converse.createRoomTOLeft = function () {
                    var nodes = $(".create-room-body #listRight input:checked").parent();
                    $(".create-room-body  #listLeft").append(nodes);
                },

                converse.createRoomTOAllRight = function () {
                    var nodes = $(".create-room-body #listLeft").children();
                    $(".create-room-body #listRight").append(nodes);
                },

                converse.createRoomTOAllLeft = function () {
                    var nodes = $(".create-room-body #listRight").children();
                    $(".create-room-body  #listLeft").append(nodes);
                },*/

                //创建群聊确定创建
                converse.createRoomSubmit = function () {

                    if ($(".create-room-body #listRight [type=checkbox]").length < 1) {
                        if (converse.new_modal) {
                            $.dialog('alert', __('prompt'), __("Please choose friends"), 0);
                        } else {
                            alert(__("Please choose friends"));
                        }
                        return false;
                    }
                    $("#chatrooms  .create-room-skip").click();
                    $('ul#controlbox-tabs li a[href="#chatlist"]').click();
                },
                converse.randomWord = function (randomFlag, min, max) {
                    var str = "",
                        range = min,
                        arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

                    // 随机产生
                    if (randomFlag) {
                        range = Math.round(Math.random() * (max - min)) + min;
                    }
                    for (var i = 0; i < range; i++) {
                        var pos = Math.round(Math.random() * (arr.length - 1));
                        str += arr[pos];
                    }
                    return str;
                },

            /**返回月日时分*/
                converse.longToDate = function (longTime) {
                    var time = moment(longTime);
                    var t1 = time.format('MM-DD HH:mm');
                    return t1;
                },

            /**返回年月日*/
                converse.longToDate1 = function (longTime) {
                    var time = moment(longTime);
                    var t1 = time.format('YYYY-MM-DD');
                    return t1;
                },

            /**返回年月日时分秒**/
                converse.longToDateTime = function (longTime) {
                    var time2 = moment(longTime);
                    var t2 = time2.format('YYYY-MM-DD HH:mm:ss');
                    return t2;
                },

            /**
             *返回在线客服会话中是不是客户
             */
                converse.isCustomer = function (room_jid) {
                    var customer;
                    if (room_jid) {
                        var user_id = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                            customer = room_jid.split('_')[2];
                        var official_id = room_jid.split('_')[1];
                        if (user_id === customer) {
                            customer = true;
                        } else {
                            customer = false;
                        }
                    }
                    return customer;
                },

                converse.editOfficialList = function (jid, name, room_id) {
                    var isExists = false;
                    $("#conversejs #officials #converse-official-list .officials-room-item-list .official-room-group-item").each(function (index, el) {
                        var a_btn = $(el).find('a');
                        var off_room_jid = a_btn.attr('data-room-jid');
                        if (jid === off_room_jid) {
                            isExists = true;
                        }
                    });

                    if (!isExists) {
                        var room_jid = Strophe.getNodeFromJid(jid),
                            default_img = converse.emoticons_file_path + converse.room_default_img,
                            avatar_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + room_id + '&type=t&access_token=' + converse.access_token,
                            hidden_item = false;

                        if (room_jid.indexOf('online') >= 0) {
                            var user_id = room_jid.split('_')[2],
                                official_id = room_jid.split('_')[1],
                                c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                                official = converse.officialInfo(official_id);

                            if (c_jid != user_id && c_jid != official_id) {
                                var user_info = converse.getUserInfo2(Number(user_id));

                                default_img = converse.emoticons_file_path + converse.user_default_img;
                                avatar_url = user_info && user_info.hasAvatar ? converse.imapi_url + converse.imapi_download_avatar + '?userId=' + user_id + '&type=t&access_token=' + converse.access_token : default_img;
                                if (!name) {
                                    name = user_info.nickname + "(" + official.officialName + ")";
                                }
                            } else {
                                default_img = converse.emoticons_file_path + converse.official_default_img;
                                avatar_url = official && official.logoUrl ? official.logoUrl : default_img;
                                if (!name) {
                                    name = official.officialName;
                                }
                            }

                        }

                        var name_input = $('#conversejs #officials #official-user-name').val();
                        if (name_input && name_input.trim()) {
                            if (name.toUpperCase().indexOf(name_input.trim().toUpperCase()) === -1) {
                                hidden_item = true;
                            }
                        }

                        var room_item = converse.templates.official_room_item({
                            'room_name': name,
                            'jid_id': jid,
                            'open_title': __('Click to open this online service'),
                            'a_class': 'open-service-room',
                            'user_avatar_url': avatar_url,
                            'default_img': default_img,
                            'show_avatar': true,
                            'hidden_item': hidden_item,
                            'show_operation': false,
                            'operation_title': __('send new session')
                        });
                        $("#conversejs #officials #converse-official-list .officials-room-item-list").prepend(room_item);
                    }
                },

                converse.sortListByPingYin = function (concatList) {
                    if (concatList == null || concatList.length == 0) {
                        return;
                    }
                    var nameByMap = {
                        A: [],
                        B: [],
                        C: [],
                        D: [],
                        E: [],
                        F: [],
                        G: [],
                        H: [],
                        I: [],
                        J: [],
                        K: [],
                        L: [],
                        M: [],
                        N: [],
                        O: [],
                        P: [],
                        Q: [],
                        R: [],
                        S: [],
                        T: [],
                        U: [],
                        V: [],
                        W: [],
                        X: [],
                        Y: [],
                        Z: [],
                        "START": [],
                        "END": []
                    };
                    for (var i = 0, len = concatList.length; i < len; i++) {
                        var tempInfo = pinyin.getFullChars(concatList[i].nickname);
                        concatList[i].py = tempInfo;
                        if (/^[A-Za-z]*$/.test(tempInfo[0])) {
                            nameByMap[tempInfo[0].toUpperCase()].push(concatList[i]);
                        } else if (/^[0-9]*$/.test(tempInfo[0])) {
                            nameByMap["START"].push(concatList[i]);
                        } else {
                            nameByMap["END"].push(concatList[i]);
                        }

                    }
                    Object.keys(nameByMap).forEach(function (element) {
                        nameByMap[element].sort(function (a, b) {
                            return naturalComparator(a.py, b.py);
                        })
                    });
                    concatList = [];

                    for (var key in nameByMap) {
                        var arr = nameByMap[key];
                        if(arr instanceof Array && arr.length>0){
                            for(var i =0,len = arr.length;i<len;i++){
                                concatList.push(nameByMap[key][i]);
                            }
                        }
                    }
                    return concatList;
                },

                _.extend(converse_api, {
                    'createroom': {
                        'randomJid': function (randomFlag, min, max) {
                            return converse.randomWord(randomFlag, min, max);
                        },
                        'open': function () {
                            converse.createRoomShow();
                        },
                        'get': function (jids, attrs, create) {

                        }
                    }
                });
        }


    });
}));
