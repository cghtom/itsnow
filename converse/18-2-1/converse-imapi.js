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
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as a module called "myplugin"
        define("converse-imapi", [
            "converse-core",
            "converse-api",
            "typeahead",
            "converse-chatview"
        ], factory);
    } else {
        // Browser globals. If you're not using a module loader such as require.js,
        // then this line below executes. Make sure that your plugin's <script> tag
        // appears after the one from converse.js.
        factory(converse);
    }
}(this, function (converse, converse_api) {
    "use strict";
    // Commonly used utilities and variables can be found under the "env"
    // namespace of converse_api

    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
        $iq = converse_api.env.$iq,
        $build = converse_api.env.$build,
        $msg = converse_api.env.$msg,
        $pres = converse_api.env.$pres,
        b64_sha1 = converse_api.env.b64_sha1,
        utils = converse_api.env.utils;

    // Other frequently used utilities
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        moment = converse_api.env.moment;
    var __ = utils.__.bind(converse);
    var ___ = utils.___;


    // The following line registers your plugin.
    converse_api.plugins.add('converse-imapi', {

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            // Configuration values for this plugin
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.

            this.updateSettings({
                imapi_login: '/user/login/new',
                imapi_friend_list: '/friends/attention/list',
                imapi_user: '/user/get',
                imapi_friend_add: '/friends/attention/add3',
                imapi_friend_del: '/friends/delete',
                imapi_friend_comfirm: '/friends/attention/add',
                imapi_user_colleagues: '/user/colleagues',
                imapi_official_find: '/official/find',
                imapi_official_list: '/official/findAll',
                imapi_online_official_list: '/user/officials',//'/official/findAll/online',
                imapi_room_add: '/room/add',
                imapi_room_get: '/room/get2',
                imapi_room_list: '/room/list/his',
                imapi_oline_room_list: '/room/list/online',
                imapi_room_delete: '/room/delete',
                imapi_room_member_delete: '/room/member/delete',
                imapi_room_update: '/room/member/update',
                imapi_room_info_update: '/room/update',
                imapi_room_message: '/room/messages',
                imapi_online_agents: '/online/agents',
                imapi_online_invite_agents: '/online/invite/agents',
                imapi_official_default: '/official/default',
                imapi_user_official: '/user/officials',
                imapi_download: '/attachment/download',
                imapi_download_avatar: '/attachment/download/avatar',
                imapi_upload: '/attachment/upload',
                imapi_agent_online: '/user/agent/online',
                imapi_agent_offline: '/user/agent/offline',
                imapi_agent_available: '/online/agents/available/count',
                imapi_online_evaluation: '/online/wg/session/evaluation/add',
                imapi_chat_message: '/chat/messages',
                imapi_room_offline: '/room/list/offline',
                imapi_chat_list: '/chat/latest',
                imapi_session_add: '/online/sessions/add',
                imapi_session_del: '/online/sessions/delete',
                imapi_chat_withdraw: '/chat/withdraw',
                imapi_room_withdraw: '/room/withdraw',

                itsnow_create_desk_agent: '/#/itsm/maintenance/workFlowProcesses/serviceDesk/proxyServiceOrder/add?workFlowTemplateName=ServiceOrderWorkflowTemplate&subQuery=proxyServiceOrder&trueSelectedCategory=proxyServiceOrder&view=proxyServiceOrder',
                itsnow_query_desk_list: '/operation/api/cmdb/ci/',
                itsnow_query_desk: '/#/itsm/maintenance/workFlowProcesses/serviceDesk/allServiceOrder/task',
            });

            /**登陆imapi*/
            converse.imapiLogin = function (isConnection) {
                var url = converse.imapi_url + converse.imapi_login + "?telephone=" + converse.mobile + "&password=" + converse.password + '&serial=' + Strophe.getResourceFromJid(converse.jid);
                $.ajax({
                    type: "POST",
                    url: url,
                    async: false,
                    datatype: "application/x-www-form-urlencoded",
                    success: function (data) {
                        if (converse.debug) {
                            console.log('imapi login:');
                            console.log(data);
                        }
                        var result = data.resultCode;
                        if (result && result == 1) {
                            var nickname = data.data.nickname;
                            var userid = data.data.userId;
                            var username = data.data.username;
                            var usertype = data.data.user_type;
                            var access_token = data.data.access_token;
                            //var isAgent = data.data.isAgent;
                            var account_name = data.data.accountName;
                            converse.access_token = access_token;
                            converse.username = username;
                            converse.nick_name = nickname;
                            converse.user_type = usertype;
                            //converse.is_agent = isAgent;
                            converse.account_name = account_name;
                            window.sessionStorage.removeItem('token-session-' + Strophe.getNodeFromJid(converse.jid));
                            window.sessionStorage.setItem('token-session-' + Strophe.getNodeFromJid(converse.jid), JSON.stringify({
                                'access_token': converse.access_token
                            }));
                            if (isConnection) {
                                converse.connection.connect(converse.jid, converse.password, converse.onConnectStatusChanged);
                            }
                        }
                    },
                    error: function () {
                        console.log("login imapi error");
                    }
                });
            },

            converse.imapiFriendsCom = function (user_id) {
                try {
                    var result_json = $.ajax({
                        url: converse.imapi_url + converse.imapi_friend_comfirm,
                        data: {toUserId: user_id, access_token: converse.access_token},
                        dataType: 'json',
                        cache: false,
                        async: false
                    }).responseText;
                    var result = JSON.parse(result_json);
                    if (converse.debug) {
                        console.log('add friend comfirm :');
                        console.log(result);
                    }
                    if (result && result.resultCode && result.resultCode === 1) {
                        result = result.data;
                    }
                    return result;
                } catch (e) {
                    if (converse.debug) {
                        console.log('add friend comfirm err:' + e);
                    }
                    return null;
                }
                ;
            },

            converse.imapiUser = function (user_id, telephone) {
                try {
                    var result_json = $.ajax({
                        url: converse.imapi_url + converse.imapi_user,
                        data: {userId: user_id, telephone: telephone, access_token: converse.access_token},
                        dataType: 'json',
                        cache: false,
                        async: false
                    }).responseText;
                    var result = JSON.parse(result_json);
                    if (converse.debug) {
                        console.log('get user:');
                        console.log(result);
                    }
                    if (result && result.resultCode && result.resultCode === 1) {
                        result = result.data;
                    }
                    return result;
                } catch (e) {
                    if (converse.debug) {
                        console.log('get user error:' + e);
                    }
                    return null;
                }
                ;
            },

            converse.uploadMessage = function (formData) {
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
                            return data;
                        }
                    });
                } catch (e) {
                    if (converse.debug) {
                        console.log('get user error:' + e);
                    }
                    return null;
                }
            },

            converse.userOfficial = function () {
                try {
                    var result_json = $.ajax({
                        url: converse.imapi_url + converse.imapi_user_official,
                        data: {access_token: converse.access_token},
                        dataType: 'json',
                        cache: false,
                        async: false
                    }).responseText;
                    var result = JSON.parse(result_json);
                    if (converse.debug) {
                        console.log('get user:');
                        console.log(result);
                    }
                    if (result && result.resultCode && result.resultCode === 1) {
                        result = result.data;
                    }
                    return result;
                } catch (e) {
                    if (converse.debug) {
                        console.log('get user error:' + e);
                    }
                    return null;
                }
                ;
            },
            converse.imapiUpdateUser = function () {

                $.getJSON(converse.imapi_url + converse.imapi_user, {access_token: converse.access_token}, function (data) {
                    if (converse.debug) {
                        console.log('update user:');
                        console.log(data);
                    }
                    if (data && data.resultCode == 1) {
                        var nickname = data.data.nickname;
                        var username = data.data.username;
                        var agentStatus = data.data.agentStatus;
                        var usertype = data.data.user_type;
                        var isAgent = data.data.isAgent;
                        var account_name = data.data.accountName;
                        converse.user_type = usertype;
                        converse.is_agent = isAgent;
                        converse.username = username;
                        converse.nick_name = nickname;
                        converse.agent_status = agentStatus;
                        converse.account_name = account_name;
                    }
                });
            },

            converse.imapiFriendAdd = function (name) {
                $.ajax({
                    type: "POST",
                    url: converse.imapi_url + converse.imapi_friend_add,
                    data: {'toUserTelephone': name, 'access_token': converse.access_token},
                    datatype: "application/x-www-form-urlencoded",//"xml", "html", "script", "json", "jsonp", "text".
                    success: function (data) {
                        if (converse.debug) {
                            console.log('add friend:');
                            console.log(data);
                        }
                        var result = data.resultCode;
                        console.log("result:" + result);
                        if (result && result == 1) {
                            var jid = data.toUserId + '@' + converse.domain;
                            var name = data.toNickname;
                            return jid;

                        } else {
                            console.warn("add friends failed");
                            return null;
                        }

                    },
                    error: function (e) {
                        if (converse.debug) {
                            console.log('add friend error:' + e);
                        }
                    }
                })

            },

            converse.imapiGetOfficial = function (official_id) {
                $.post(converse.imapi_url + converse.imapi_official_find, {
                    'officialId': official_id,
                    'access_token': converse.access_token
                }, function (data, status) {
                    if (converse.debug) {
                        console.log('get official:');
                        console.log(data);
                    }
                    if (data != null) {
                        return data;
                    }
                });
            },

            converse.isExistColleagues = function (user_jid) {
                var isExist = false,
                    friends = converse.colleagues_list;

                if (friends && friends.length > 0) {
                    for (var j = 0; j < friends.length; j++) {
                        if (friends[j].userId === user_jid) {
                            isExist = true;
                        }
                    }
                }
                return isExist;
            },

            converse.addFriendsList = function (data) {
                var isExist = false,
                    friends = converse.friends_list,
                    colleagues = converse.colleagues_list;
                if (colleagues && colleagues.length > 0) {
                    for (var j = 0; j < colleagues.length; j++) {
                        if (colleagues[j].userId === data.userId) {
                            isExist = true;
                        }
                    }
                }
                if (!isExist) {
                    if (friends && friends.length > 0) {
                        for (var j = 0; j < friends.length; j++) {
                            if (friends[j].userId === data.userId) {
                                isExist = true;
                            }
                        }
                    }
                    if (!isExist) {
                        if (!friends) {
                            friends = new Array();
                        }
                        friends[friends.length] = data;
                    }
                }
                converse.friends_list = friends;
            },

            converse.addColleagues_List = function (data) {
                var isExist = false,
                    colleagues = converse.colleagues_list;
                if (colleagues && colleagues.length > 0) {
                    for (var j = 0; j < colleagues.length; j++) {
                        if (colleagues[j].userId === data.userId) {
                            isExist = true;
                        }
                    }
                }
                if (!isExist) {
                    if (!colleagues) {
                        colleagues = new Array();
                    }
                    colleagues[colleagues.length] = data;
                }
                converse.colleagues_list = colleagues;
            },

                converse.addAllUser_list = function (data) {
                    var isExist = false,
                        users = converse.allUser_list;
                    if (users && users.length > 0) {
                        for (var j = 0; j < users.length; j++) {
                            if (users[j].userId === data.userId) {
                                isExist = true;
                            }
                        }
                    }
                    if (!isExist) {
                        if (!users) {
                            users = new Array();
                        }
                        users[users.length] = data;
                    }
                    converse.allUser_list = users;
                },

            converse.delFriendsList = function (user_id) {
                if (converse.friends_list && converse.friends_list.length > 0) {
                    for (var j = 0; j < converse.friends_list.length; j++) {
                        if (converse.friends_list[j].userId === Number(user_id)) {
                            converse.friends_list.splice(j, 1);
                        }
                    }
                }

            },

            converse.queryUserIsAgent = function () {
                var is_agent = false;

                $.ajax({
                    type:"POST",
                    url: converse.imapi_url+"/user/get",
                    async:false,
                    data:{access_token: converse.access_token},
                    datatype: "application/x-www-form-urlencoded",
                    success:function(data) {
                        if(data && data.resultCode == 1 && data.data) {
                            is_agent = data.data.isAgent && data.data.agentStatus === 1;
                        }
                    }
                });
                return is_agent;
            },

            /**
             * 从im查询
             */
            converse.getUserInfo = function (user_id) {
                var friends = converse.friends_list,
                    colleagues = converse.colleagues_list,
                    user;

                if (!user_id) {
                    return user;
                }

                if (!user) {
                    $.ajax({
                        type: "POST",
                        url: converse.imapi_url + converse.imapi_user,
                        data: {userId: user_id, access_token: converse.access_token},
                        async: false,
                        success: function (data) {
                            var result = data.resultCode;
                            if (result && result == 1 && data.data) {
                                user = data.data;
                                if (friends && friends.length > 0) {
                                    for (var j = 0; j < friends.length; j++) {
                                        if (friends[j].userId === Number(user_id)) {
                                            friends[j] = data.data;
                                            break;
                                        }
                                    }
                                }


                                if (colleagues && colleagues.length > 0) {
                                    for (var j = 0; j < colleagues.length; j++) {
                                        if (colleagues[j].userId === Number(user_id)) {
                                            colleagues[j] = data.data;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    });
                }

                return user;
            },

            //先从本地查找，未有再请求服务器
            converse.getUserInfo2 = function (user_id) {
                var friends = converse.friends_list,
                    colleagues = converse.colleagues_list,
                    officials = converse.official_list,
                    allUsers = converse.allUser_list,
                    user;

                if (!user_id) {
                    return user;
                }

                if (friends && friends.length > 0) {
                    for (var j = 0; j < friends.length; j++) {
                        if (friends[j].userId === Number(user_id)) {
                            user = friends[j];
                            break;
                        }
                    }
                }

                if (!user) {
                    if (colleagues && colleagues.length > 0) {
                        for (var j = 0; j < colleagues.length; j++) {
                            if (colleagues[j].userId === Number(user_id)) {
                                user = colleagues[j];
                                break;
                            }
                        }
                    }
                }

                if(!user){
                    if(officials && officials.length > 0){
                        for (var k = 0; k < officials.length; k++) {
                            if (officials[k].officialId === Number(user_id)) {
                                user = officials[k];
                                break;
                            }
                        }
                    }
                }

                if (!user) {
                    if (allUsers && allUsers.length > 0) {
                        for (var f = 0; f < allUsers.length; f++) {
                            if (allUsers[f].userId === Number(user_id)) {
                                user = allUsers[f];
                                break;
                            }
                        }
                    }
                }

                if (!user) {
                    $.ajax({
                        type: "POST",
                        url: converse.imapi_url + converse.imapi_user,
                        data: {userId: user_id, access_token: converse.access_token},
                        async: false,
                        success: function (data) {
                            var result = data.resultCode;
                            if (result && result == 1 && data.data) {
                                user = data.data;

                                converse.addAllUser_list(data.data);

                                if (friends && friends.length > 0) {
                                    for (var j = 0; j < friends.length; j++) {
                                        if (friends[j].userId === Number(user_id)) {
                                            friends[j] = data.data;
                                            break;
                                        }
                                    }
                                }

                                if (colleagues && colleagues.length > 0) {
                                    for (var j = 0; j < colleagues.length; j++) {
                                        if (colleagues[j].userId === Number(user_id)) {
                                            colleagues[j] = data.data;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    });
                }

                return user;
            },

            converse.getUserByLocal = function (user_id) {
                var friends = converse.friends_list,
                    colleagues = converse.colleagues_list,
                    user;

                if (!user_id) {
                    return user;
                }

                if (friends && friends.length > 0) {
                    for (var j = 0; j < friends.length; j++) {
                        if (friends[j].userId === Number(user_id)) {
                            user = friends[j];
                            break;
                        }
                    }
                }

                if (!user) {
                    if (colleagues && colleagues.length > 0) {
                        for (var j = 0; j < colleagues.length; j++) {
                            if (colleagues[j].userId === Number(user_id)) {
                                user = colleagues[j];
                                break;
                            }
                        }
                    }
                }
                return user;
            },

            //添加好友面板监听，鼠标离开时隐藏此框
            converse.listen_friend_add_div = function (user_id) {

                 $(document).click(function(e){
                     e = window.event || e; // 兼容IE7
                     var $target = $(e.target),
                         is_add_friend = false,
                         is_agent_status = false;

                     if(!$target.is("#conversejs .add-friend-panel *")){
                         is_add_friend = true;
                     }

                     if(!$target.is("#conversejs .agent-status-panel *")){
                         is_agent_status = true;
                     }

                     if(is_add_friend){
                         if($('#conversejs .add-friend-dd').css("display")!="none") {
                             $('#conversejs .add-friend-dd').hide();
                             return;
                         }
                     }

                     if(is_agent_status) {
                         if($('#conversejs .agent-status-panel ul').css("display")!="none") {
                             $('#conversejs .agent-status-panel ul').hide();
                             return;
                         }
                     }
                 });

            },

            converse.queryCreateRoomPanel = function () {
                if($('.create-room').length > 0){
                    var result = confirm(__("Are you sure create group chat"));
                    if (result === true) {
                        return true;
                    } else {
                        $(".create-room").remove();
                        return false;
                    }
                }
            },

            converse.htmlEncode = function (param) {
                param=param.replace(/&/g,"&amp;");
                param=param.replace(/"/g,"&quot;");
                param=param.replace(/'/g,"&apos;");
                param=param.replace(/</g,"&lt;");
                param=param.replace(/>/g,"&gt;");

                return param;
            }

        }

    });

}));
 


