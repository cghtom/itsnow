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
    define("converse-chatlist", [
        "converse-core",
        "converse-api",
        "tpl!chatlist_tab",
        "tpl!chatlist_panel",
        "tpl!chatlist_group",
        "tpl!chatlist_item",
        "typeahead",
        "converse-chatview"
    ], factory);
}(this, function (converse,
                  converse_api,
                  tpl_chatlist_tab,
                  tpl_chatlist_panel,
                  tpl_chatlist_group,
                  tpl_chatlist_item) {
    "use strict";
    converse.templates.chatlist_tab = tpl_chatlist_tab;
    converse.templates.chatlist_panel = tpl_chatlist_panel;
    converse.templates.chatlist_group = tpl_chatlist_group;
    converse.templates.chatlist_item = tpl_chatlist_item;

    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
        b64_sha1 = converse_api.env.b64_sha1,
        utils = converse_api.env.utils;
    // Other necessary globals
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        moment = converse_api.env.moment;

    // For translations
    var __ = utils.__.bind(converse);
    var ___ = utils.___;


    if(converse.converse_complete_model) {
        converse_api.plugins.add('converse-chatlist', {
            /* Optional dependencies are other plugins which might be
             * overridden or relied upon, if they exist, otherwise they're ignored.
             *
             * However, if the setting "strict_plugin_dependencies" is set to true,
             * an error will be raised if the plugin is not found.
             *
             * NB: These plugins need to have already been loaded via require.js.
             */
            optional_dependencies: ["converse-controlbox", "converse-official"],

            overrides: {

                ControlBoxView: {
                    renderContactsPanel: function () {
                        var converse = this.__super__.converse;
                        this.__super__.renderContactsPanel.apply(this, arguments);

                        if (converse.allow_chatlist) {
                            this.chatlistpanel = new converse.ChatlistPanel({
                                '$parent': this.$el.find('.controlbox-panes'),
                                'model': new (Backbone.Model.extend({
                                    id: b64_sha1('converse.chatlist' + converse.bare_jid), // Required by sessionStorage
                                    browserStorage: new Backbone.BrowserStorage[converse.storage](
                                        b64_sha1('converse.chatlist' + converse.bare_jid))
                                }))()
                            });
                            this.chatlistpanel.render().model.fetch();
                            if (!this.chatlistpanel.model.get('nick')) {
                                this.chatlistpanel.model.save({
                                    nick: Strophe.getNodeFromJid(converse.bare_jid)
                                });
                            }
                        }
                        return this;

                    },

                    onConnected: function () {
                        var converse = this.__super__.converse;
                        this.__super__.onConnected.apply(this, arguments);
                        if (!this.model.get('connected')) {
                            return;
                        }
                        this.chatlistpanel.model.save({'showData': true});
                    }

                }

            },

            initialize: function () {
                /* The initialize function gets called as soon as the plugin is
                 * loaded by converse.js's plugin machinery.
                 */
                var converse = this.converse;

                this.updateSettings({
                    default_official: null,
                    chatlist_list_class: '#conversejs #chatlist #chatlist-group',
                    chatlist_list_item_class: '#conversejs #chatlist #chatlist-group dd.available-chatroom',
                    chatlist_tab_class: '#HBox-converse-main-view #controlbox #controlbox-tabs li',
                    chatlist_min_box_class: '.online-agent-service',
                });

                /**
                 * 更新消息标题上提示及缩小框提示
                 */
                converse.updateTipCount = function (num) {
                    num = !num ? 1 : num;
                    //chatlist tip
                    $(converse.chatlist_tab_class).each(function (index, element) {
                        if ($(element).find('a').attr('href') === '#chatlist') {
                            var $a_btn = $(element).find('a');
                            var badge_count = $(element).find('.badge');
                            if (badge_count.length > 0) {
                                var badge_num = badge_count.text();
                                badge_count.text(Number(badge_num) + num);
                            } else {
                                $a_btn.append('<span class="badge">'+num+'</span>');
                            }
                            return false;
                        }
                    });

                    //minibox tip
                    if (!converse.default_form) {
                        var $converse_toggle = $(converse.chatlist_min_box_class);
                        var $converse_badge = $converse_toggle.find('.badge');
                        if ($converse_badge.length > 0) {
                            var badge_num = $converse_badge.text();
                            $converse_badge.text(Number(badge_num) + num);
                        } else {
                            $(converse.chatlist_min_box_class).append('<span class="badge">'+num+'</span>');
                        }
                    }
                },

                converse.chatlistApi = function (api_name, param) {
                    if(!api_name){
                        return;
                    }

                    if(api_name === 'add'){
                        converse_api.chatlist.add(param.from_jid, param.type, param.badge_show, param.badge_num, param.add_session);
                    }

                    if(api_name === 'first'){
                        converse_api.chatlist.first(param.from_jid, param.type);
                    }

                    if(api_name === 'updateItemMsg'){
                        converse_api.chatlist.updateItemMsg(param.jid, param.content, param.type);
                    }
                },

                /**
                 * 更新缩小框提示用于主面板为关闭状态，但是会话窗口为打开状态
                 * 更新小提示框，并将此记录，记录到session中
                 */
                converse.updateMinBoxTip = function (jid, type) {
                    var $converse_badge = $('.online-agent-service .badge');
                    if ($converse_badge.length > 0) {
                        var badge_num = $converse_badge.text();
                        $converse_badge.text(Number(badge_num) + 1);
                    } else {
                        $(converse.chatlist_min_box_class).append('<span class="badge">1</span>');
                    }
                    //add session
                    converse.addSession(jid, type);
                },

                converse.removeTipCount = function (num) {
                    //chatlist tip
                    $(converse.chatlist_tab_class).each(function (index, element) {
                        if ($(element).find('a').attr('href') === '#chatlist') {
                            var badge_count = $(element).find('.badge');
                            if (badge_count.length > 0) {
                                var badge_num = badge_count.text();
                                var show_num = Number(badge_num) - Number(num);
                                if (show_num > 0) {
                                    badge_count.text(show_num);
                                } else {
                                    badge_count.remove();
                                }
                            }
                        }
                    });

                    //
                    if (!converse.default_form) {
                        var $converse_badge = $('.online-agent-service .badge');
                        if ($converse_badge.length > 0) {
                            var badge_num = $converse_badge.text();
                            var show_num = Number(badge_num) - Number(num);
                            if (show_num > 0) {
                                $converse_badge.text(show_num);
                            } else {
                                $converse_badge.remove();
                            }
                        }
                    }
                },

                /**
                 * 重新更新缩小框中的未读消息计数
                 */
                converse.updateMinBoxTipByTabNum = function () {
                 $(converse.chatlist_tab_class).each(function (index, element) {
                     if ($(element).find('a').attr('href') === '#chatlist') {
                         var badge_count = $(element).find('.badge'),
                             badge_num = 0;
                         if (badge_count.length > 0) {
                             badge_num = badge_count.text();
                         }

                         var $converse_badge = $(converse.chatlist_min_box_class).find('.badge');
                         if ($converse_badge.length > 0) {
                             if(Number(badge_num) > 0){
                                 $converse_badge.text(badge_num);
                             } else {
                                 $converse_badge.remove();
                             }
                         } else {
                             if(Number(badge_num) > 0){
                                 $(converse.chatlist_min_box_class).append('<span class="badge">'+badge_num+'</span>');
                             }
                         }
                         return false;
                     }
                 });

                 converse.updateSession();
                },

                converse.addSession = function (jid, type) {
                    var list = JSON.parse(window.sessionStorage.getItem('msg-tip-'+converse.mobile + converse.itsnow_url));
                    if(typeof list !== "undefined" && list !== null && list.length > 0){
                        var isExist = false;
                        for(var i=0;i<list.length;i++){
                            var tip = list[i];
                            if(tip.jid === jid){
                                isExist = true;
                                tip.num = tip.num + 1;
                            }
                        }
                        if(!isExist){
                            list[list.length] = {jid: jid, num :1, type: type};
                        }
                    } else {
                        list = [{jid: jid, num :1, type: type}];
                    }
                    window.sessionStorage.removeItem('msg-tip-'+converse.mobile + converse.itsnow_url);
                    window.sessionStorage.setItem('msg-tip-'+converse.mobile + converse.itsnow_url, JSON.stringify(list));
                },

                converse.removeSession = function (jid) {
                    var list = JSON.parse(window.sessionStorage.getItem('msg-tip-'+converse.mobile + converse.itsnow_url));
                    if(typeof list !== "undefined" && list !== null && list.length > 0){
                        for(var i=0;i<list.length;i++){
                            var tip = list[i];
                            if(tip.jid === jid){
                                list.splice(i, 1);
                            }
                        }
                        window.sessionStorage.removeItem('msg-tip-'+converse.mobile + converse.itsnow_url);
                        window.sessionStorage.setItem('msg-tip-'+converse.mobile + converse.itsnow_url, JSON.stringify(list));
                    }
                },

                /**
                 * 根据列表中的提示更新
                 */
                converse.updateSession = function () {
                    var list = [];
                    $(converse.chatlist_list_item_class).each(function (index, element) {
                        var a_btn = $(element).find('a'),
                            badge = $(element).find('.badge');

                        if(badge.length > 0){
                            var badge_count = badge.text();

                            list[list.length] = {jid: a_btn.attr('data-jid'), type: a_btn.attr('data-type'), num: Number(badge_count)};
                        }
                    });

                    window.sessionStorage.removeItem('msg-tip-'+converse.mobile + converse.itsnow_url);
                    window.sessionStorage.setItem('msg-tip-'+converse.mobile + converse.itsnow_url, JSON.stringify(list));
                },

                converse.ChatlistPanel = Backbone.View.extend({
                    tagName: 'div',
                    className: 'controlbox-pane',
                    id: 'chatlist',
                    events: {
                        "click #chatlist-group .available-chatroom": "openRoom"
                    },

                    initialize: function (cfg) {
                        this.$parent = cfg.$parent;
                        this.model.on('change:showData', this.initLoading, this);
                    },

                    render: function () {
                        this.$parent.append(this.$el.html(
                            converse.templates.chatlist_panel({
                                'label_name': __("Chatlist"),
                                'show_toolbar': converse.allow_chatlist,
                                'label_title': __("new group chat")
                            })
                        ).hide());
                        this.$tabs = this.$parent.parent().find('#controlbox-tabs');
                        //this.initLoading(this.$parent);
                        this.$tabs.prepend(converse.templates.chatlist_tab({
                            label_chatlist: __('Chatlist'),
                            'ioc_path': converse.emoticons_file_path
                        }));
                        return this;
                    },

                    initLoading: function (tabs) {
                        var $el = this.$el;
                        var $chatlist_content = $el.find('.chatlist-content');
                        this.showChats(tabs, $chatlist_content);
                    },

                    showChats: function (tabs, chatlist_content) {
                        var $content = chatlist_content;
                        $content.append(converse.templates.chatlist_group({
                            'label_name': __('Chatlist')
                        }));

                        //rooms item

                        converse.init_update_room = true;
                        var fragment = "";
                        $.ajax({
                            url: converse.imapi_url + converse.imapi_room_list,
                            data: {access_token: converse.access_token, pageIndex: 0, pageSize: 10000},
                            cache: false,
                            success: function (rooms_list) {
                                if (rooms_list && rooms_list.resultCode && rooms_list.resultCode == 1) {

                                    if (rooms_list.data && rooms_list.data.length > 0) {
                                        for (var i = 0; i < rooms_list.data.length; i++) {
                                            var d = rooms_list.data[i];
                                            var name = d.name,
                                                jid = d.jid + converse.muc_service_url,
                                                room_id = d.id;

                                            //添加到面板中
                                            fragment +=
                                                converse.templates.chatlist_item({
                                                    'title_url': converse.imapi_url + converse.imapi_download_avatar + '?userId=' + room_id + '&type=t&access_token=' + converse.access_token,
                                                    'default_img': converse.emoticons_file_path + converse.room_default_img,
                                                    'jid': jid,
                                                    'type': "groupchat",
                                                    'name': name,
                                                    'is_badge_show': false,
                                                    'badge_num': 1
                                                });

                                        }

                                        $content.find('#chatlist-group').append(fragment);

                                        converse_api.chatlist.initBySession('groupchat');
                                    }
                                }
                            }
                        });



                        converse.init_update_chat = true;
                        //chat item
                        $.ajax({
                            url: converse.imapi_url + converse.imapi_chat_list,
                            data: {access_token: converse.access_token},
                            cache: false,
                            success: function (data) {
                                if (data && data.resultCode && data.resultCode == 1) {
                                    if (data.data && data.data.length > 0) {
                                        var list = data.data.reverse();
                                        for (var i = 0; i < list.length; i++) {
                                            var chat = list[i],
                                                jid = chat.userId + '@' + converse.domain,
                                                chat_item = "";
                                            var user_info = converse.getUserInfo2(chat.userId),
                                                default_img = converse.emoticons_file_path + converse.user_default_img,
                                                title_url = default_img,
                                                local_user = converse.getUserByLocal(chat.userId);

                                            if (user_info && local_user) {
                                                if (user_info.hasAvatar) {
                                                    title_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + user_info.userId + '&type=t&access_token=' + converse.access_token;
                                                }

                                                chat_item = converse.templates.chatlist_item({
                                                    'title_url': title_url,
                                                    'default_img': default_img,
                                                    'jid': jid,
                                                    'type': 'chat',
                                                    'name': user_info.nickname,
                                                    'is_badge_show': false,
                                                    'badge_num': 0
                                                });

                                                var is_add = false;
                                                $(converse.chatlist_list_item_class).each(function (index, element) {
                                                    var a_btn = $(element).find('a'),
                                                        item_jid = a_btn.attr('data-jid'),
                                                        item_type = a_btn.attr('data-type');

                                                    if (item_type === 'chat' && item_jid === jid) {
                                                        is_add = true;
                                                        return false;
                                                    }

                                                });

                                                if(!is_add){
                                                    $(converse.chatlist_list_class).prepend(chat_item);
                                                }
                                            }
                                        }

                                        //$content.find('#chatlist-group').prepend(chat_item);

                                        converse_api.chatlist.initBySession('chat');
                                    }
                                }
                            }
                        });

                    },

                    openRoom: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var $item = $(ev.currentTarget).find('.open-room');
                        var jid = $item.attr('data-jid');
                        var type = $item.attr('data-type');

                        //clean tip
                        /*
                         var badge = $(ev.target).parent().find('.badge');
                         if(badge.length > 0){
                         badge.remove();
                         }
                         */
                        converse_api.chatlist.remove(jid);

                        if (type && type === 'chat') {
                            converse_api.chats.open(jid);
                            //converse_api.rooms.pastImg(jid,"chat");
                        }

                        if (type && type === 'groupchat') {
                            var attrs = {
                                nick: Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                                name: $item.text().trim()
                            };
                            //converse_api.rooms.pastImg(jid,"groupchat");
                            if(jid.indexOf('online') >=0){
                                attrs.isHistory = true;
                                //在线客服房间判断是否是当时会话,如是历史会话不改变当前状态
                                $('#conversejs #officials .officials-content .officials-room-item-list dd').each(function(index, element){
                                    var a = $(element).find('a'),
                                        a_jid = a.attr('data-room-jid');

                                    if(a_jid === jid){
                                        attrs.isHistory = false;
                                    }
                                });
                            }
                            converse_api.rooms.open(jid, attrs);
                        }

                    }
                });

                _.extend(converse_api, {
                    'chatlist': {
                        /**
                         * 添加会话信息到消息列表中
                         * @param from_jid    唯一jid
                         * @param type        'chat':单聊 'groupchat':群聊
                         * @param badge_show  是否显示消息显示
                         * @param badge_num   显示消息提示数据，如果之前有消息数量，现在输入的数量与前面的数量相加
                         * @param add_session 是否写入session中
                         */
                        'add': function (from_jid, type, badge_show, badge_num, add_session) {
                            var chatlist_exist = false;
                            $(converse.chatlist_list_item_class).each(function (index, element) {
                                var a_btn = $(element).find('a'),
                                    item_jid = a_btn.attr('data-jid');

                                if (item_jid === from_jid) {
                                    chatlist_exist = true;
                                    if(badge_show) {
                                        var badge = $(element).find('.badge');
                                        if (badge.length > 0) {
                                            var badge_count = badge.text();
                                            badge.text(Number(badge_count) + Number(badge_num));
                                        } else {
                                            $(element).append('<span class="badge">1</span>');
                                        }

                                        //edit session
                                        if(add_session){
                                            converse.addSession(from_jid, type);
                                        }

                                        $(converse.chatlist_list_class).prepend($(element));
                                    }
                                }
                            });

                            if (!chatlist_exist) {
                                //edit session
                                if(add_session){
                                    converse.addSession(from_jid, type);
                                }

                                if (type && type === 'chat') {
                                    var user_info = converse.getUserInfo2(Strophe.unescapeNode(Strophe.getNodeFromJid(from_jid))),
                                        default_img = converse.emoticons_file_path + converse.user_default_img;
                                        title_url = default_img,
                                        name;

                                    if (user_info) {
                                        if (user_info.hasAvatar) {
                                            name = user_info.nickname;
                                            title_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + user_info.userId + '&type=t&access_token=' + converse.access_token;
                                        } else if (user_info && user_info.officialId) {
                                            name = user_info.officialName;
                                            title_url = user_info.logoUrl;
                                            default_img = converse.emoticons_file_path + converse.official_default_img;
                                        }

                                        $(converse.chatlist_list_class).prepend(converse.templates.chatlist_item({
                                            'title_url': title_url,
                                            'default_img': default_img,
                                            'jid': from_jid,
                                            'type': type,
                                            'name': name,
                                            'is_badge_show': badge_show,
                                            'badge_num': badge_num
                                        }));
                                    }
                                }

                                if (type && type === 'groupchat') {
                                    var room_info = converse.roomInfo(Strophe.unescapeNode(Strophe.getNodeFromJid(from_jid))),
                                        default_img = converse.emoticons_file_path + converse.room_default_img,
                                        title_url = default_img;

                                    if (room_info) {
                                        var name = room_info.name,
                                            title_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + room_info.id + '&type=t&access_token=' + converse.access_token;
                                        if(room_info.jid.indexOf('online')>=0) {
                                            var user_id = room_info.jid.split('_')[2],
                                                official_id = room_info.jid.split('_')[1],
                                                c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                                            //客服
                                            if(c_jid != official_id && c_jid != user_id){
                                                var user = converse.getUserInfo2(user_id),
                                                    official = converse.officialInfo(Number(official_id)),
                                                    official_name = official && official.officialName ? official.officialName : (room_info && room_info.name ? room_info.name.name:'');
                                                name = user ? user.nickname  + '(' + official_name + ')' : room_info.nickname + '(' + official_name + ')';

                                                default_img = converse.emoticons_file_path + converse.user_default_img;
                                                title_url = user && user.hasAvatar ? converse.imapi_url + converse.imapi_download_avatar + '?userId='+ user_id +'&type=t&access_token='+converse.access_token : default_img;

                                            } else {
                                                var official = converse.officialInfo(official_id);
                                                default_img = converse.emoticons_file_path + converse.official_default_img;
                                                title_url = official && official.logoUrl ? official.logoUrl : default_img;
                                            }
                                        }

                                        $(converse.chatlist_list_class).prepend(converse.templates.chatlist_item({
                                            'title_url': title_url,
                                            'default_img': default_img,
                                            'jid': from_jid,
                                            'type': type,
                                            'name': name,
                                            'is_badge_show': badge_show,
                                            'badge_num': badge_num
                                        }));
                                    }
                                }

                            }

                            if (badge_show) {
                                converse.updateTipCount();
                            }
                        },
                        'remove': function (from_jid) {
                            $(converse.chatlist_list_item_class).each(function (index, element) {
                                var a_btn = $(element).find('a'),
                                    item_jid = a_btn.attr('data-jid'),
                                    badge = $(element).find('.badge');

                                if (item_jid === from_jid) {
                                    converse.removeTipCount(badge.text());
                                    badge.remove();
                                }
                            });

                            converse.removeSession(from_jid);
                        },
                        'update': function (from_jid, name) {
                            $(converse.chatlist_list_item_class).each(function (index, element) {
                                var a_btn = $(element).find('a'),
                                    item_jid = a_btn.attr('data-jid');

                                if (item_jid === from_jid) {
                                    a_btn.attr('title', name);
                                    a_btn.text(name);
                                }
                            });
                        },
                        'first': function (from_jid, type) {
                            if (Strophe.getNodeFromJid(from_jid) === Strophe.getNodeFromJid(converse.jid)) {
                                return;
                            }

                            var chatlist_exist = false;
                            $(converse.chatlist_list_item_class).each(function (index, element) {
                                var a_btn = $(element).find('a'),
                                    item_jid = a_btn.attr('data-jid');

                                if (item_jid === from_jid) {
                                    chatlist_exist = true;
                                    $(converse.chatlist_list_class).prepend($(element));
                                }
                            });

                            if (!chatlist_exist) {
                                if (type && type === 'chat') {
                                    var user_info = converse.getUserInfo2(Strophe.unescapeNode(Strophe.getNodeFromJid(from_jid))),
                                        default_img, title_url,name;

                                    if (user_info) {
                                        if(user_info.officialName){
                                            name = user_info.officialName;
                                            title_url = user_info.logoUrl;
                                            default_img = converse.emoticons_file_path + converse.official_default_img;
                                        } else {
                                            name = user_info.nickname;
                                            default_img = converse.emoticons_file_path + converse.user_default_img;
                                            title_url = default_img;

                                            if (user_info.hasAvatar) {
                                                title_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + user_info.userId + '&type=t&access_token=' + converse.access_token;
                                            }
                                        }

                                        $(converse.chatlist_list_class).prepend(converse.templates.chatlist_item({
                                            'title_url': title_url,
                                            'default_img': default_img,
                                            'jid': from_jid,
                                            'type': type,
                                            'name': name,
                                            'is_badge_show': false,
                                            'badge_num': 0
                                        }));
                                    }
                                }

                                if (type && type === 'groupchat') {
                                    var room_info = converse.roomInfo(Strophe.unescapeNode(Strophe.getNodeFromJid(from_jid))),
                                        default_img = converse.emoticons_file_path + converse.room_default_img,
                                        title_url = default_img;

                                    if (room_info) {
                                        var name = room_info.name,
                                            title_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + room_info.id + '&type=t&access_token=' + converse.access_token;
                                        if(room_info.jid.indexOf('online')>=0) {
                                            var user_id = room_info.jid.split('_')[2],
                                                official_id = room_info.jid.split('_')[1],
                                                c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                                            //客服
                                            if(c_jid != official_id && c_jid != user_id){
                                                var user = converse.getUserInfo2(user_id),
                                                    official = converse.officialInfo(Number(official_id)),
                                                    official_name = official && official.officialName ? official.officialName : (room_info && room_info.name ? room_info.name.name:'');
                                                name = user ? user.nickname  + '(' + official_name + ')' : room_info.nickname + '(' + official_name + ')';

                                                default_img = converse.emoticons_file_path + converse.user_default_img;
                                                title_url = user && user.hasAvatar ? converse.imapi_url + converse.imapi_download_avatar + '?userId='+ user_id +'&type=t&access_token='+converse.access_token : default_img;

                                            } else {
                                                var official = converse.officialInfo(official_id);
                                                default_img = converse.emoticons_file_path + converse.official_default_img;
                                                title_url = official && official.logoUrl ? official.logoUrl : default_img;
                                            }
                                        }

                                        $(converse.chatlist_list_class).prepend(converse.templates.chatlist_item({
                                            'title_url': title_url,
                                            'default_img': default_img,
                                            'jid': from_jid,
                                            'type': type,
                                            'name': room_info.name,
                                            'is_badge_show': false,
                                            'badge_num': 0
                                        }));
                                    }
                                }
                            }
                        },
                        'deleteitem': function (from_jid) {
                            $(converse.chatlist_list_item_class).each(function (index, element) {
                                var a_btn = $(element).find('a'),
                                    item_jid = a_btn.attr('data-jid'),
                                    badge = $(element).find('.badge');

                                if (item_jid === from_jid) {
                                    converse.removeTipCount(badge.text());
                                    $(element).remove();
                                }
                            });

                            converse.removeSession(from_jid);
                        },
                        'initBySession': function (type) {
                            var list = JSON.parse(window.sessionStorage.getItem('msg-tip-'+converse.mobile + converse.itsnow_url));
                            if(typeof list !== "undefined" && list !== null){
                                for(var i=0;i<list.length;i++){
                                    var tip = list[i];
                                    $(converse.chatlist_list_item_class).each(function (index, element) {
                                        var a_btn = $(element).find('a'),
                                            item_jid = a_btn.attr('data-jid'),
                                            item_type = a_btn.attr('data-type');

                                        if (item_type === type && item_jid === tip.jid) {

                                            var badge = $(element).find('.badge');
                                            if (badge.length > 0) {
                                                var badge_count = badge.text();
                                                badge.text(Number(badge_count) + tip.num);
                                            } else {
                                                $(element).append('<span class="badge">'+tip.num+'</span>');
                                            }

                                            $(converse.chatlist_list_class).prepend($(element));

                                            converse.updateTipCount(tip.num);
                                        }
                                    });
                                }
                            }
                        },
                        'updateItemMsg': function (jid, content, type) {
                            if(content){
                                var obj ,
                                    show = '';

                                if(typeof content === 'string'){
                                    obj = JSON.parse(content);
                                } else {
                                    obj = content;
                                }

                                if(obj){
                                    var fromUserId = obj.fromUserId,
                                        userId = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                                        is_user = false,
                                        time = new Date().getTime(),
                                        sendNickname = obj.fromUserName;

                                    if (fromUserId && fromUserId === userId){
                                        is_user = true;
                                        time = obj.timeSend * 1000;
                                    }
                                    time = moment(time).format('MM-DD HH:mm');

                                    if(obj.type == 1){
                                        show = obj.content;
                                    }else if(obj.type === 2 ){
                                        show = '[图片]';
                                    }else if(obj.type === 3){
                                        show = '[语音]';
                                    } else if(obj.type === 4 ) {
                                        show = '[位置]';
                                    } else if(obj.type === 5 ){
                                        show = '[动画]';
                                    } else if(obj.type === 6){
                                        show = '[音频]';
                                    } else if (obj.type === 8){
                                        show = '[名片]';
                                    } else if(obj.type === 9){
                                        show = '[文件]';
                                    } else if (obj.type ===601){
                                        show = is_user ? obj.content : obj.fromUserName + '撤回了一条消息';
                                    }else {
                                        show = obj.content;
                                    }

                                    if(type && (type === 'groupchat' || type === 'chatroom') && !is_user && obj.type < 11){
                                        show = sendNickname + ':' + show;
                                    }

                                    $(converse.chatlist_list_item_class).each(function (index, element) {
                                        var a_btn = $(element).find('a'),
                                            item_jid = a_btn.attr('data-jid');

                                        if (item_jid === jid) {
                                            var lasttime = $(element).find('.lasttime'),
                                                lastcommunicationt = $(element).find('.lastcommunicationt');

                                            lasttime.text(time);
                                            lastcommunicationt.text(show);
                                        }
                                    });
                                }
                            }
                        },
                    }
                });
            }

        });
    }
}));
