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
    define("converse-official", [
        "converse-core",
        "converse-api",
        "tpl!official_panel",
        "tpl!official_group",
        "tpl!official_tab",
        "tpl!official_group_item",
        "tpl!official_room_item",
        "tpl!room_official_item",
        "typeahead",
        "converse-chatview",
        "sortByPinYin"
    ], factory);
}(this, function (converse,
                  converse_api,
                  tpl_official_panel,
                  tpl_official_group,
                  tpl_official_tab,
                  tpl_official_group_item,
                  tpl_official_room_item,
                  tpl_room_official_item) {
    "use strict";
    converse.templates.official_panel = tpl_official_panel;
    converse.templates.official_group = tpl_official_group;
    converse.templates.official_tab = tpl_official_tab;
    converse.templates.official_group_item = tpl_official_group_item;
    converse.templates.official_room_item = tpl_official_room_item;
    converse.templates.room_official_item = tpl_room_official_item;

    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
        b64_sha1 = converse_api.env.b64_sha1,
        utils = converse_api.env.utils;
    // Other necessary globals
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._;

    // For translations
    var __ = utils.__.bind(converse);
    var ___ = utils.___;

    if(converse.converse_complete_model) {
        converse_api.plugins.add('converse-official', {
            /* Optional dependencies are other plugins which might be
             * overridden or relied upon, if they exist, otherwise they're ignored.
             *
             * However, if the setting "strict_plugin_dependencies" is set to true,
             * an error will be raised if the plugin is not found.
             *
             * NB: These plugins need to have already been loaded via require.js.
             */
            optional_dependencies: ["converse-controlbox"],

            overrides: {

                ControlBoxView: {
                    renderContactsPanel: function () {
                        var converse = this.__super__.converse;
                        this.__super__.renderContactsPanel.apply(this, arguments);

                        if (converse.allow_official) {
                            this.officialpanel = new converse.OfficialPanel({
                                '$parent': this.$el.find('.controlbox-panes'),
                                'model': new (Backbone.Model.extend({
                                    id: b64_sha1('converse.officials' + converse.bare_jid), // Required by sessionStorage
                                    browserStorage: new Backbone.BrowserStorage[converse.storage](
                                        b64_sha1('converse.officials' + converse.bare_jid))
                                }))()
                            });
                            this.officialpanel.render().model.fetch();
                            if (!this.officialpanel.model.get('nick')) {
                                this.officialpanel.model.save({
                                    nick: Strophe.getNodeFromJid(converse.bare_jid)
                                });
                            }
                        }
                        return this;

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
                    online_service_rooms: [],
                    history_rooms: [],
                });


                converse.OfficialPanel = Backbone.View.extend({
                    tagName: 'div',
                    className: 'controlbox-pane',
                    id: 'officials',
                    events: {
                        "click .officials-group a.group-toggle": "toggle",
                        "click .official-group-item a.open-service": "openOnlineService",
                        "click .official-room-group-item a.open-service-room": "openRoom",
                        "click .official-room-group-item a.open-history-room": "openHistoryRoom",
                        "keyup #official-user-name": "roomSearch",
                        "click .request-new-session": "requestNewSession"
                    },

                    initialize: function (cfg) {
                        this.$parent = cfg.$parent;

                    },

                    render: function () {
                        this.$parent.append(this.$el.html(
                            converse.templates.official_panel({
                                'label_name': __("Official"),
                                'ioc_path': converse.emoticons_file_path,
                                'input_describe': __('query_criteria')
                            })
                        ).hide());
                        this.$tabs = this.$parent.parent().find('#controlbox-tabs');
                        this.initLoading(this.$parent);
                        this.$tabs.prepend(converse.templates.official_tab({label_officials: __('Official'),'ioc_path': converse.emoticons_file_path}));
                        return this;
                    },

                    initLoading: function (tabs) {
                        var $officials_content = tabs.find('.officials-content');
                        this.showOfficialRoom(tabs, $officials_content);
                        this.showHistoryList(tabs, $officials_content);

                        //展开
                        $("#conversejs #officials #converse-official-list .officials-group .group-toggle").removeClass("icon-closed").addClass("icon-opened");
                        $("#conversejs #officials #converse-official-list .officials-group .group-toggle").each(function (index, el) {
                            $(el).removeClass("icon-closed").addClass("icon-opened");
                            $("#conversejs #converse-official-list .officials-content " + $(el).attr("data-tab")).show();
                        });

                    },

                    showOfficialRoom: function (tabs, officials_content) {
                        var $officials_content = officials_content;
                        $officials_content.append(converse.templates.official_group({
                            'label_name': __('Online_service_list'),
                            'label_tab': '.officials-room-item-list'
                        }));

                        //item
                        var fragment = "<div class='officials-room-item-list'>";

                        $.ajax({
                            url: converse.imapi_url + converse.imapi_oline_room_list,
                            data: {access_token: converse.access_token, pageIndex: 0, pageSize: 10000},
                            cache: false,
                            success: function(rooms_list){
                                if (rooms_list && rooms_list.resultCode && rooms_list.resultCode == 1) {

                                    var name, jid, i, item = '', c_m_l = converse.muc_room_list;
                                    if (rooms_list.data && rooms_list.data.length > 0) {

                                        for (var i = 0; i < rooms_list.data.length; i++) {
                                            var d = rooms_list.data[i];
                                            name = d.name;
                                            jid = d.jid + converse.muc_service_url;

                                            //更改在线客服房间名
                                            if(d.jid.indexOf('online')>=0) {
                                                //判断是否是房间的所有者
                                                var user_id = d.jid.split('_')[2],
                                                    official_id = d.jid.split('_')[1],
                                                    c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                                                    user_avatar_url = converse.imapi_url+converse.imapi_download_avatar+'?userId='+ d.id + '&type=t&access_token=' + converse.access_token,
                                                    default_img = converse.emoticons_file_path + converse.room_default_img;

                                                if(c_jid != user_id && c_jid != official_id){
                                                    var user = converse.getUserInfo2(user_id),
                                                        official = converse.officialInfo(Number(official_id)),
                                                        official_name = official && official.officialName ? official.officialName : d.name;
                                                        name = user&&user.nickname ? user.nickname  + '(' + official_name + ')' : d.nickname + '(' + official_name + ')';


                                                    default_img = converse.emoticons_file_path + converse.user_default_img;
                                                    user_avatar_url = user && user.hasAvatar ? converse.imapi_url+converse.imapi_download_avatar+'?userId='+ user_id + '&type=t&access_token=' + converse.access_token : default_img;

                                                } else {
                                                    var official = converse.officialInfo(official_id);
                                                    default_img = converse.emoticons_file_path + converse.official_default_img;
                                                    user_avatar_url = official && official.logoUrl ? official.logoUrl : default_img;
                                                }
                                            }

                                            item += converse.templates.official_room_item({
                                                'room_name':name,
                                                'jid_id':jid,
                                                'open_title': __('Click to open this online service'),
                                                'a_class': 'open-service-room',
                                                'user_avatar_url': user_avatar_url,
                                                'default_img': default_img,
                                                'show_avatar': true,
                                                'hidden_item': false,
                                                'show_operation': false,
                                                'operation_title': __('send new session')
                                            });
                                        }

                                        $officials_content.find('.officials-room-item-list').append(item);
                                    }
                                }
                            }
                        });

                        fragment += "</div>";
                        $officials_content.append(fragment);
                    },

                    showHistoryList: function (tabs, officials_content) {
                        var $officials_content = officials_content;
                        $officials_content.append(converse.templates.official_group({
                            'label_name': __('history_session_list'),
                            'label_tab': '.officials-history-item-list'
                        }));

                        //item
                        var fragment = "<div class='officials-history-item-list'>";

                        $.ajax({
                            url: converse.imapi_url + converse.imapi_room_offline,
                            data: {access_token: converse.access_token, pageIndex:0, pageSize:1000},
                            cache: false,
                            success: function (rooms_list) {
                                if (rooms_list && rooms_list.resultCode && rooms_list.resultCode == 1) {

                                    if (rooms_list.data && rooms_list.data.length > 0) {
                                        //cgh
                                        Object.keys(rooms_list.data).forEach(function (element) {
                                            rooms_list.data.sort(function (a, b) {
                                                return naturalComparator(b.destroyTime, a.destroyTime);
                                            })
                                        });
                                        var item = '';
                                        for (var i = 0; i < rooms_list.data.length; i++) {
                                            var d = rooms_list.data[i],
                                                official_id = d.jid.split('_')[1],
                                                user = converse.getUserInfo2(d.userId),
                                                official = converse.officialInfo(Number(official_id)),
                                                official_name = official && official.officialName ? official.officialName : d.name,
                                                name = user ? user.nickname  + '(' + official_name + ')' : d.nickname + '(' + official_name + ')',
                                                jid = d.jid + converse.muc_service_url,
                                                user_id = d.jid.split('_')[2],
                                                c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                                            if(d.jid.indexOf('online')>=0) {

                                                if (converse.is_agent) {
                                                    var isPandlExists = false;
                                                    //在群聊列表中查看是否有此房间的明细，如果有不添加
                                                    $('#conversejs #officials #officials-history-item-list .official-room-group-item').each(function (index, element) {
                                                        var a_btn = $(element).find('a');
                                                        var room_jid = a_btn.attr('data-room-jid');
                                                        if (room_jid === jid) {
                                                            isPandlExists = true;
                                                        }
                                                    });

                                                    if (!isPandlExists) {
                                                        var default_img = converse.emoticons_file_path + converse.user_default_img,
                                                            avatar_url = default_img,
                                                            hidden_item = false;

                                                        if (user && user.hasAvatar) {
                                                            avatar_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + d.userId + '&type=t&access_token=' + converse.access_token;
                                                        }

                                                        var name_input = $('#conversejs #officials #official-user-name').val();
                                                        if (name_input && name_input.trim()) {
                                                            if (name.toUpperCase().indexOf(name_input.trim().toUpperCase()) === -1) {
                                                                hidden_item = true;
                                                            }
                                                        }
                                                        var f = converse.is_agent?true:false;
                                                        //添加到面板中
                                                        item +=
                                                            converse.templates.official_room_item({
                                                                'room_name': name,
                                                                'jid_id': jid,
                                                                'open_title': __('Click to open this online service'),
                                                                'a_class': 'open-history-room',
                                                                'user_avatar_url': avatar_url,
                                                                'default_img': default_img,
                                                                'show_avatar': true,
                                                                'hidden_item': hidden_item,
                                                                'show_operation': f,
                                                                'operation_title': __('send new session')
                                                            });
                                                    }
                                                } else if (Number(c_jid) === Number(user_id)) {
                                                    var isPandlExists = false;
                                                    //在群聊列表中查看是否有此房间的明细，如果有不添加
                                                    $('#conversejs #officials #officials-history-item-list .official-room-group-item').each(function (index, element) {
                                                        var a_btn = $(element).find('a');
                                                        var room_jid = a_btn.attr('data-room-jid');
                                                        if (room_jid === jid) {
                                                            isPandlExists = true;
                                                        }
                                                    });

                                                    if (!isPandlExists) {
                                                        var default_img = converse.emoticons_file_path + converse.official_default_img;
                                                            avatar_url = official && official.logoUrl ? official.logoUrl : default_img,
                                                            hidden_item = false,
                                                            name = official_name;

                                                        var name_input = $('#conversejs #officials #official-user-name').val();
                                                        if (name_input && name_input.trim()) {
                                                            if (name.toUpperCase().indexOf(name_input.trim().toUpperCase()) === -1) {
                                                                hidden_item = true;
                                                            }
                                                        }
                                                        var f = converse.is_agent?true:false;
                                                        //添加到面板中
                                                        item +=
                                                            converse.templates.official_room_item({
                                                                'room_name': name,
                                                                'jid_id': jid,
                                                                'open_title': __('Click to open this online service'),
                                                                'a_class': 'open-history-room',
                                                                'user_avatar_url': avatar_url,
                                                                'default_img': default_img,
                                                                'show_avatar': true,
                                                                'hidden_item': hidden_item,
                                                                'show_operation': f,
                                                                'operation_title': __('send new session')
                                                            });
                                                    }
                                                }
                                            }
                                        }

                                        $officials_content.find('.officials-history-item-list').append(item);
                                    }
                                }
                            }
                        });

                        fragment += "</div>";
                        $officials_content.append(fragment);
                    },

                    roomSearch: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }

                        var name = $(ev.target).val().trim(),
                            $parent = $(ev.target).parents('.officials-content'),
                            that = this;

                        //query all data
                        $parent.find('.officials-room-item-list dd').each(function(index, element){
                          var a = $(element).find('a'),
                              jid = a.attr('data-room-jid'),
                              room_name = a.text().trim();

                            if(name){
                                if(that.isLike(name, room_name)){
                                    $(element).show();
                                } else {
                                    $(element).hide();
                                }
                            } else {
                                $(element).show();
                            }
                        });

                        //$parent.find('.officials-history-item-list dd').filter(":contains("+name+")").show();
                        //$parent.find('.officials-history-item-list dd').

                        $parent.find('.officials-history-item-list dd').each(function(index, element){
                            var a = $(element).find('a'),
                                jid = a.attr('data-room-jid'),
                                room_name = a.text().trim();

                            if(name){
                                if(that.isLike(name, room_name)){
                                    $(element).show();
                                } else {
                                    $(element).hide();
                                }
                            } else {
                                $(element).show();
                            }
                        });

                    },

                    isLike: function (exp, room_name) {
                        var i = false;
                        if (exp.constructor == String) {

                            var s = exp;

                            if(room_name.toUpperCase().indexOf(exp.toUpperCase()) >= 0){
                                return true;
                            } else {
                                return false;
                            }
                        }
                        return false;
                    },

                    toggle: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var $el = $(ev.target);
                        if ($el.hasClass("icon-opened")) {
                            this.$el.nextUntil('dt').slideUp();
                            this.model.save({state: converse.CLOSED});
                            $el.removeClass("icon-opened").addClass("icon-closed");
                            var tab = "#conversejs #converse-official-list .officials-content " + $el.attr("data-tab");
                            $(tab).hide();
                        } else {
                            $el.removeClass("icon-closed").addClass("icon-opened");
                            this.model.save({state: converse.OPENED});
                            var tab = "#conversejs #converse-official-list .officials-content " + $el.attr("data-tab");
                            $(tab).show();
                        }
                    },

                    openOnlineService: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var $el = $(ev.currentTarget);
                        converse_api.rooms.online_service(null, $el.attr("data-official").trim());
                    },

                    openRoom: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var room_a = $(ev.currentTarget);
                        var room_jid = room_a.attr('data-room-jid').trim();

                        //clean tips
                        converse_api.chatlist.remove(room_jid);

                        var attrs = {
                            nick: Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                            name: room_a.text().trim()
                        };
                        //converse_api.rooms.pastImg(room_jid,"groupchat");
                        converse_api.rooms.open(room_jid, attrs);
                    },

                    openHistoryRoom: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var room_a = $(ev.currentTarget);

                        var room_jid = room_a.attr('data-room-jid').trim();

                        var attrs = {
                            nick: Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                            name: room_a.text().trim()
                        };
                        //查看房间是否存在在线客服列表中，如果存在，则打开
                        var isPandlExists = false;
                        //在群聊列表中查看是否有此房间的明细，如果有不添加
                        $('#conversejs #officials .officials-room-item-list .official-room-group-item').each(function (index, element) {
                            var a_btn = $(element).find('a');
                            var jid = a_btn.attr('data-room-jid');
                            if (room_jid === jid.trim()) {
                                isPandlExists = true;
                            }
                        });

                        if (!isPandlExists) {
                            attrs.isHistory = true;
                        } else {
                            //clean tips
                            converse_api.chatlist.remove(room_jid);
                        }

                        converse_api.rooms.open(room_jid, attrs);
                    },

                    requestNewSession: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var room_a = $(ev.currentTarget),
                            room_jid = room_a.attr('data-room-jid').trim(),
                            id = Strophe.getNodeFromJid(room_jid),
                            room = converse.imRoomInfo(id),
                            user_id = id.split('_')[2],
                            official_id = id.split('_')[1],
                            c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));;

                        if (!room) {

                            if(c_jid != user_id && c_jid != official_id){
                                $.post(converse.imapi_url + converse.imapi_session_add, {
                                    officialId: official_id,
                                    access_token: converse.access_token,
                                    userId:user_id
                                }, function (data, status) {

                                    if (data && data.resultCode == 1) {

                                        if(!data.data.newCreated){

                                            var room = data.data,
                                                open_room_jid = room.jid + converse.muc_service_url;

                                            //将数据保存在变量中以便查询时使用
                                            converse.add_room_list(open_room_jid, false);

                                            var chatroom = converse.createChatRoom({
                                                'id': open_room_jid,
                                                'jid': open_room_jid,
                                                'name': room_name || Strophe.unescapeNode(Strophe.getNodeFromJid(open_room_jid)) ,
                                                'type': 'chatroom',
                                                'box_id': b64_sha1(open_room_jid)
                                            });

                                            converse.editOfficialList(open_room_jid, room_name, room.id);

                                            if(converse.allow_chatlist){

                                                var user_id = room.jid.split('_')[2],
                                                    official_id = room.jid.split('_')[1],
                                                    c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                                                if(c_jid != official_id && c_jid != user_id &&
                                                    ((!room.createUserId) || (room.createUserId && Number(room.createUserId) != Number(c_jid)))){
                                                    converse_api.chatlist.add(open_room_jid, 'groupchat', true, 1, false);
                                                } else {
                                                    converse_api.chatlist.add(open_room_jid, 'groupchat', false, 0, false);
                                                }

                                            }
                                        }
                                    } else {
                                        alert('发起失败');
                                    }
                                });
                            } else {

                            }
                        } else {
                            var $a_parent = room_a.parent(),
                                room_info_a = $a_parent.find('.open-history-room'),
                                room_name;

                            if(room_info_a && room_info_a.length > 0){
                                room_name = room_info_a.text().trim();
                            } else {
                                var user = converse.getUserInfo2(room.userId),
                                    official = converse.officialInfo(Number(official_id)),
                                    official_name = official && official.officialName ? official.officialName : d.name;
                                    room_name = user ? user.nickname  + '(' + official_name + ')' : d.nickname + '(' + official_name + ')';
                            }

                            var attrs = {
                                nick: Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                                name: room_name
                            };
                            //clean tips
                            converse_api.rooms.open(room_jid, attrs);
                            converse_api.chatlist.remove(room_jid);
                        }
                    }

                });

                /* We extend the default converse.js API to add methods specific to MUC
                 * chat rooms.
                 */
                _.extend(converse_api, {
                    'officials': {
                        'refresh': function () {

                            var $officials_content = $("#conversejs .roster-contacts .officials-item-list").empty(),
                                fragment = "<div class='officials-item-list'>",
                                official_item_list;

                            var official_list_json = $.ajax({
                                url: converse.imapi_url + converse.imapi_online_official_list,
                                data: {access_token: converse.access_token},
                                cache: false,
                                async: false
                            }).responseText;
                            var official_list = JSON.parse(official_list_json);
                            if (official_list && official_list.resultCode && official_list.resultCode == 1) {

                                if (official_list.data && official_list.data.length > 0) {
                                    official_item_list = official_list.data;

                                    //official panel
                                    for (var i = 0; i < official_list.data.length; i++) {
                                        var d = official_list.data[i];
                                        var name = d.officialName,
                                            official_id = d.officialId,
                                            show_add_btn = true,
                                            send_official_service_btn = true;
                                        //cgh7712
                                        name = converse.htmlEncode(name);
                                        if (d.domain === converse.account_name && converse.is_agent) {
                                            //用户主账户下的客服不显示自己公司的主账号
                                            send_official_service_btn = false;
                                        }

                                        //默认的公众号不显示设置默认公众号按钮
                                        if (d.officialId === Number(converse.default_official)) {
                                            show_add_btn = false;
                                        }

                                        //添加到面板中
                                        fragment +=
                                            converse.templates.official_group_item({
                                                'official_name': name,
                                                'official_id': official_id,
                                                'show_add_btn': show_add_btn,
                                                'show_title': __("Set to the default online customer service"),
                                                'open_title': __("Click to request online service"),
                                                'title_url': d.logoUrl,
                                                'send_official_service_btn': send_official_service_btn,
                                                'default_img': converse.emoticons_file_path + converse.official_default_img
                                            });

                                    }
                                }
                            }
                            fragment += "</div>";
                            $officials_content.append(fragment);

                            //room panel
                            if (official_item_list && official_item_list.length > 0) {
                                var $available_official_chatrooms = $('#conversejs #chatrooms #available-official-chatrooms');
                                $available_official_chatrooms.empty();
                                var fragment = document.createDocumentFragment();

                                converse.official_list = official_list.data;

                                for (var i = 0; i < official_item_list.length; i++) {
                                    var d = official_item_list[i];
                                    var name = d.officialName,
                                        official_id = d.officialId;

                                    fragment.appendChild($(
                                        converse.templates.room_official_item({
                                            'name': name,
                                            'officialid': official_id
                                        })
                                    )[0]);

                                }
                                $available_official_chatrooms.append(fragment);
                            }
                        },
                        'editItem': function (data) {
                            var isExist = false;

                            $("#conversejs .roster-contacts .officials-item-list .official-group-item").each(function (index, element) {
                                var a_btn = $(element).find('a');
                                var official_id = a_btn.attr('data-official');
                                if (data.officialId === Number(official_id.trim())) {
                                    a_btn.text(data.officialName);
                                    a_btn.find('.room-img').src(data.logoUrl);
                                }
                            });
                        }
                    }
                });

            }

        });
    }
}));
