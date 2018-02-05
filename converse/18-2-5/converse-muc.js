// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

/* This is a Converse.js plugin which add support for multi-user chat rooms, as
 * specified in XEP-0045 Multi-user chat.
 */
(function (root, factory) {
    define("converse-muc", [
        "converse-core",
        "converse-api",
        "tpl!chatarea",
        "tpl!chatroom",
        "tpl!chatroom_form",
        "tpl!chatroom_nickname_form",
        "tpl!chatroom_password_form",
        "tpl!chatroom_sidebar",
        "tpl!chatroom_toolbar",
        "tpl!chatroom_head",
        "tpl!chatrooms_tab",
        "tpl!info",
        "tpl!occupant",
        "tpl!room_description",
        "tpl!room_item",
        "tpl!room_panel",
        "tpl!chatroom_desk_list",
        "tpl!room_official_item",
        "tpl!chatroom_member_form",
        "tpl!evaluation_form",
        "tpl!evaluation_f",
        "tpl!agent_configure",
        "typeahead",
        "converse-chatview"
    ], factory);
}(this, function (
    converse,
    converse_api,
    tpl_chatarea,
    tpl_chatroom,
    tpl_chatroom_form,
    tpl_chatroom_nickname_form,
    tpl_chatroom_password_form,
    tpl_chatroom_sidebar,
    tpl_chatroom_toolbar,
    tpl_chatroom_head,
    tpl_chatrooms_tab,
    tpl_info,
    tpl_occupant,
    tpl_room_description,
    tpl_room_item,
    tpl_room_panel,
    tpl_chatroom_desk_list,
    tpl_room_official_item,
    tpl_chatroom_member_form,
    tpl_evaluation_form,
    tpl_evaluation_f,
    tpl_agent_configure
) {
    "use strict";
    converse.templates.chatarea = tpl_chatarea;
    converse.templates.chatroom = tpl_chatroom;
    converse.templates.chatroom_form = tpl_chatroom_form;
    converse.templates.chatroom_nickname_form = tpl_chatroom_nickname_form;
    converse.templates.chatroom_password_form = tpl_chatroom_password_form;
    converse.templates.chatroom_sidebar = tpl_chatroom_sidebar;
    converse.templates.chatroom_head = tpl_chatroom_head;
    converse.templates.chatrooms_tab = tpl_chatrooms_tab;
    converse.templates.info = tpl_info;
    converse.templates.occupant = tpl_occupant;
    converse.templates.room_description = tpl_room_description;
    converse.templates.room_item = tpl_room_item;
    converse.templates.room_panel = tpl_room_panel;
    converse.templates.chatroom_desk_list = tpl_chatroom_desk_list;
    converse.templates.room_official_item = tpl_room_official_item;
    converse.templates.chatroom_member_form = tpl_chatroom_member_form;
    converse.templates.evaluation_form = tpl_evaluation_form;
    converse.templates.agent_configure = tpl_agent_configure;
    converse.templates.evaluation_f = tpl_evaluation_f;

    var ROOMS_PANEL_ID = 'chatrooms';

    //存储变量信息
    var VAR1 ={
        repeatTemp:[]
    };

    var COM1 = {
        repeat1:function(key){
            if(!VAR1.repeatTemp[key]){
                VAR1 = {repeatTemp:[]};
                VAR1.repeatTemp[key] = 1;
                return true;//允许
            }else{
                return false;
            }
        }
    };

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

    converse_api.plugins.add('converse-muc', {
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
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            wrappedChatBox: function (chatbox) {
                /* Wrap a chatbox for outside consumption (i.e. so that it can be
                 * returned via the API.
                 */
                if (!chatbox) { return; }
                var view = converse.chatboxviews.get(chatbox.get('id'));
                var box = this.__super__.wrappedChatBox.apply(this, arguments);
                box.is_chatroom = view.is_chatroom;

                //history room show
                if(chatbox.attributes.isHistory){
                    view.$el.find('.chat-textarea').addClass('chat-textarea-readonly').attr("readonly","readonly").attr('disabled', 'disabled');
                    view.$el.find('.chat-toolbar').addClass('chat-toolbar-readonly').attr('disabled', 'disabled');
                } else {
                    view.$el.find('.chat-textarea').removeClass('chat-textarea-readonly').removeAttr("readonly").removeAttr('disabled');
                    view.$el.find('.chat-toolbar').removeClass('chat-toolbar-readonly').removeAttr('disabled');
                }

                return box;
            },

            Features: {
                addClientFeatures: function () {
                    this.__super__.addClientFeatures.apply(this, arguments);
                    if (converse.allow_muc_invitations) {
                        converse.connection.disco.addFeature(Strophe.NS.MUC_USER); // Invites
                    }
                    if (converse.allow_muc) {
                        converse.connection.disco.addFeature(Strophe.NS.MUC);
                    }
                }
            },

            ControlBoxView: {
                renderContactsPanel: function () {
                    var converse = this.__super__.converse;
                    this.__super__.renderContactsPanel.apply(this, arguments);
                    if (converse.allow_muc) {
                        this.roomspanel = new converse.RoomsPanel({
                            '$parent': this.$el.find('.controlbox-panes'),
                            'model': new (Backbone.Model.extend({
                                id: b64_sha1('converse.roomspanel'+converse.bare_jid), // Required by sessionStorage
                                browserStorage: new Backbone.BrowserStorage[converse.storage](
                                    b64_sha1('converse.roomspanel'+converse.bare_jid))
                            }))()
                        });
                        this.roomspanel.render().model.fetch();
                        if (!this.roomspanel.model.get('nick')) {
                            this.roomspanel.model.save({
                                nick: Strophe.getNodeFromJid(converse.bare_jid)
                            });
                        }
                    }
                },

                onConnected: function () {
                    var converse = this.__super__.converse;
                    this.__super__.onConnected.apply(this, arguments);
                    if (!this.model.get('connected')) {
                        return;
                    }
                    if (_.isUndefined(converse.muc_domain)) {
                        converse.features.off('add', this.featureAdded, this);
                        converse.features.on('add', this.featureAdded, this);
                        // Features could have been added before the controlbox was
                        // initialized. We're only interested in MUC
                        var feature = converse.features.findWhere({
                            'var': Strophe.NS.MUC
                        });
                        if (feature) {
                            this.featureAdded(feature);
                        }
                    } else {
                        this.setMUCDomain(converse.muc_domain);
                    }
                },

                setMUCDomain: function (domain) {
                    this.roomspanel.model.save({'muc_domain': domain});
                    var $server= this.$el.find('input.new-chatroom-server');
                    if (!$server.is(':focus')) {
                        $server.val(this.roomspanel.model.get('muc_domain'));
                    }
                },

                featureAdded: function (feature) {
                    var converse = this.__super__.converse;
                    if ((feature.get('var') === Strophe.NS.MUC) && (converse.allow_muc)) {
                        this.setMUCDomain(feature.get('from'));
                    }
                }
            },

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if((!converse.converse_complete_model) && converse.default_form){
                        //客户断掉重连时会认为view存在，所以在此删除
                        if(view){
                            view.close();
                            view = null;
                        }
                    }
                    if (!view && item.get('type') === 'chatroom') {
                        view = new converse.ChatRoomView({'model': item});
                        return this.add(item.get('id'), view);
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;

            // XXX: Inside plugins, all calls to the translation machinery
            // (e.g. utils.__) should only be done in the initialize function.
            // If called before, we won't know what language the user wants,
            // and it'll fallback to English.

            /* http://xmpp.org/extensions/xep-0045.html
             * ----------------------------------------
             * 100 message      Entering a room         Inform user that any occupant is allowed to see the user's full JID
             * 101 message (out of band)                Affiliation change  Inform user that his or her affiliation changed while not in the room
             * 102 message      Configuration change    Inform occupants that room now shows unavailable members
             * 103 message      Configuration change    Inform occupants that room now does not show unavailable members
             * 104 message      Configuration change    Inform occupants that a non-privacy-related room configuration change has occurred
             * 110 presence     Any room presence       Inform user that presence refers to one of its own room occupants
             * 170 message or initial presence          Configuration change    Inform occupants that room logging is now enabled
             * 171 message      Configuration change    Inform occupants that room logging is now disabled
             * 172 message      Configuration change    Inform occupants that the room is now non-anonymous
             * 173 message      Configuration change    Inform occupants that the room is now semi-anonymous
             * 174 message      Configuration change    Inform occupants that the room is now fully-anonymous
             * 201 presence     Entering a room         Inform user that a new room has been created
             * 210 presence     Entering a room         Inform user that the service has assigned or modified the occupant's roomnick
             * 301 presence     Removal from room       Inform user that he or she has been banned from the room
             * 303 presence     Exiting a room          Inform all occupants of new room nickname
             * 307 presence     Removal from room       Inform user that he or she has been kicked from the room
             * 321 presence     Removal from room       Inform user that he or she is being removed from the room because of an affiliation change
             * 322 presence     Removal from room       Inform user that he or she is being removed from the room because the room has been changed to members-only and the user is not a member
             * 332 presence     Removal from room       Inform user that he or she is being removed from the room because of a system shutdown
             */
            converse.muc = {
                info_messages: {
                    100: __('This room is not anonymous'),
                    102: __('This room now shows unavailable members'),
                    103: __('This room does not show unavailable members'),
                    104: __('The room configuration has changed'),
                    170: __('Room logging is now enabled'),
                    171: __('Room logging is now disabled'),
                    172: __('This room is now no longer anonymous'),
                    173: __('This room is now semi-anonymous'),
                    174: __('This room is now fully-anonymous'),
                    201: __('A new room has been created')
                },

                disconnect_messages: {
                    301: __('You have been banned from this room'),
                    307: __('You have been kicked from this room'),
                    321: __("You have been removed from this room because of an affiliation change"),
                    322: __("You have been removed from this room because the room has changed to members-only and you're not a member"),
                    332: __("You have been removed from this room because the MUC (Multi-user chat) service is being shut down.")
                },

                action_info_messages: {
                    /* XXX: Note the triple underscore function and not double
                     * underscore.
                     *
                     * This is a hack. We can't pass the strings to __ because we
                     * don't yet know what the variable to interpolate is.
                     *
                     * Triple underscore will just return the string again, but we
                     * can then at least tell gettext to scan for it so that these
                     * strings are picked up by the translation machinery.
                     */
                    301: ___("<strong>%1$s</strong> has been banned"),
                    303: ___("<strong>%1$s</strong>'s nickname has changed"),
                    307: ___("<strong>%1$s</strong> has been kicked out"),
                    321: ___("<strong>%1$s</strong> has been removed because of an affiliation change"),
                    322: ___("<strong>%1$s</strong> has been removed for not being a member")
                },

                new_nickname_messages: {
                    210: ___('Your nickname has been automatically set to: <strong>%1$s</strong>'),
                    303: ___('Your nickname has been changed to: <strong>%1$s</strong>')
                }
            };

            // Configuration values for this plugin
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.
            this.updateSettings({
                allow_muc: true,
                allow_muc_invitations: true,
                auto_join_on_invite: true,
                auto_join_rooms: [],
                auto_list_rooms: true,
                muc_domain: undefined,
                hide_muc_server: true,
                muc_history_max_stanzas: undefined,
                muc_instant_rooms: true,
                muc_nickname_from_jid: false,
                show_toolbar: true,
                muc_service_url:"@muc."+converse.domain,
                muc_room_list:[],
                official_list:[],
                muc_disable_moderator_commands: false,
                visible_toolbar_buttons: {
                    'toggle_occupants': false,
                    'show_file_button': true
                },
                msg_list:[],
                last_online_service: null,
                room_handler: [],
                roster_room_list_class: '#conversejs #converse-controlbox-official-rooms .rosterview-room-item-list',
                roster_room_list_item_class: '#conversejs #converse-controlbox-official-rooms .rosterview-room-item-list .rosterview-room-group-item',
            });

            converse.createChatRoom = function (settings) {
                /* Creates a new chat room, making sure that certain attributes
                 * are correct, for example that the "type" is set to
                 * "chatroom".
                 */
                return converse.chatboxviews.showChat(
                    _.extend(settings, {
                        'type': 'chatroom',
                        'affiliation': null,
                        'features_fetched': false,
                        'hidden': false,
                        'membersonly': false,
                        'moderated': false,
                        'nonanonymous': false,
                        'open': false,
                        'passwordprotected': false,
                        'persistent': false,
                        'public': false,
                        'semianonymous': false,
                        'temporary': false,
                        'unmoderated': false,
                        'unsecured': false,
                        'connection_status': Strophe.Status.DISCONNECTED
                    })
                );
            };

            converse.sendRoomMsg = function (room_jid, msgid, content) {
                var msg = $msg({
                    to: room_jid,
                    from: converse.connection.jid,
                    type: 'groupchat',
                    id: msgid
                }).c("body").t(content).up();
                converse.connection.send(msg);
            },

                converse.invitationMsg = function (from_jid, room_jid, recipient) {
                    var invitation = $msg({
                        from: converse.connection.jid,
                        to: room_jid,
                        id: converse.connection.getUniqueId()
                    }).c('x', {'xmlns': Strophe.NS.MUC_USER}).c('invite', {'to': recipient});
                    converse.connection.send(invitation);
                },

                converse.add_room_list = function(data, isAddPanel){
                    var c_m_l = converse.muc_room_list,
                        jid = data.jid + converse.muc_service_url;
                    if( c_m_l && c_m_l.length > 0){
                        var isExist = false;
                        for(var j=0;j<c_m_l.length;j++){
                            var c_room = c_m_l[j];
                            if(data.jid === c_room.jid){
                                isExist = true;
                            }
                        }
                        if(!isExist){
                            c_m_l[c_m_l.length] = data;
                        }
                    }else{
                        c_m_l[c_m_l.length] = data;
                    }

                    if(isAddPanel){
                        var fragment = document.createDocumentFragment();
                        fragment.appendChild($(
                            converse.templates.room_item({
                                'title_url': converse.imapi_url+converse.imapi_download_avatar+'?userId='+ data.id + '&type=t&access_token=' + converse.access_token,
                                'default_img': converse.emoticons_file_path + converse.room_default_img,
                                'name':data.name,
                                'jid':jid,
                                'open_title': __('Click to open this room'),
                                'info_title': __('Show more information on this room')
                            })
                        )[0]);

                        var isExists = false;
                        //在群聊列表中查看是否有此房间的明细，如果有不添加
                        $('#chatrooms #available-chatrooms dd.available-chatroom').each(function(index,element){
                            var a_btn =$(element).find('a');
                            var room_jid = a_btn.attr('data-room-jid');
                            if(room_jid === jid){
                                isExists = true;
                            }
                        });

                        if(!isExists){
                            $('#chatrooms #available-chatrooms').prepend(fragment);
                        }

                        //add user rosterview panel

                        if(jid.indexOf('online') === -1) {
                            var isPandlExists = false;
                            //在群聊列表中查看是否有此房间的明细，如果有不添加
                            $('#conversejs #converse-controlbox-official-rooms .rosterview-room-group-item').each(function (index, element) {
                                var a_btn = $(element).find('a');
                                var room_jid = a_btn.attr('data-room-jid');
                                if (room_jid === jid) {
                                    isPandlExists = true;
                                }
                            });

                            if (!isPandlExists) {
                                //添加到面板中
                                var title_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + data.id + '&type=t&access_token=' + converse.access_token;
                                $('#conversejs #converse-controlbox-official-rooms .rosterview-room-item-list').prepend(
                                    converse.templates.rosterview_room_item({
                                        'room_name': data.name,
                                        'jid_id': jid,
                                        'open_title': __('Click to open this online service'),
                                        'title_url': title_url,
                                        'default_img': converse.emoticons_file_path + converse.room_default_img
                                    }));
                            }
                        }
                    }

                    converse.muc_room_list = c_m_l;
                },

                converse.muc_leave = function (jid) {
                    var node = Strophe.getNodeFromJid(jid),
                        domain = Strophe.getDomainFromJid(jid),
                        user_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                    var toUser = node + "@" + domain + ("/" + user_jid );

                    converse.chatboxes.getChatBox(jid);
                    var presence = $pres({
                        type: "unavailable",
                        from: converse.connection.jid,
                        to: toUser
                    });
                    presence.c("status", "");

                    converse.connection.sendPresence(
                        presence,
                        function (){
                            converse.mucHandlerVarMove(jid);
                            converse.addHistoryRoom(jid);
                        },
                        function (){
                            converse.mucHandlerVarMove(jid);
                            converse.addHistoryRoom(jid);
                        }
                        ,
                        2000
                    );
                },

                converse.mucHandlerVarMove = function (jid) {
                    if(converse.room_handler && converse.room_handler.length > 0){
                        for(var i = 0; i<converse.room_handler.length; i++){
                            if(converse.room_handler[i].jid === jid){
                                converse.connection.deleteHandler(converse.room_handler[i].handler);
                                converse.room_handler.splice(i,1);
                                break;
                            }
                        }
                    }
                },

                converse.addHistoryRoom = function (jid) {
                    var id = Strophe.getNodeFromJid(jid);
                    if(id && id.indexOf('online')>=0) {
                        var user_id = id.split('_')[2],
                            official_id = id.split('_')[1],
                            c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                            room_info = converse.roomInfo(id);

                        //客服
                        if(c_jid != official_id && c_jid != user_id){
                            $('#conversejs #officials .official-room-group-item').each(function (index, element) {
                                var a_btn = $(element).find('a');
                                var room_jid = a_btn.attr('data-room-jid');
                                if (room_jid === jid) {
                                    $(element).find('a').parent().remove();
                                }
                            });
                            var user = converse.getUserInfo2(user_id),
                                official = converse.officialInfo(Number(official_id)),
                                official_name = official && official.officialName ? official.officialName : (room_info && room_info.name ? room_info.name.name:''),
                                name = user&&user.nickname ? user.nickname  + '(' + official_name + ')' : room_info.nickname + '(' + official_name + ')',
                                default_img = converse.emoticons_file_path + converse.user_default_img,
                                avatar_url = default_img,
                                hidden_item = false;

                            if(user && user.hasAvatar){
                                avatar_url = converse.imapi_url + converse.imapi_download_avatar + '?userId='+ user_id +'&type=t&access_token='+converse.access_token;
                            }

                            var name_input = $('#conversejs #officials #official-user-name').val();
                            if(name_input && name_input.trim()){
                                if(name.toUpperCase().indexOf(name_input.trim().toUpperCase()) === -1){
                                    hidden_item = true;
                                }
                            }
                            //添加到面板中
                            var f = converse.is_agent?true:false;
                            //console.error("muc 553 客户不显示 反向发起按钮："+f);
                            $('#conversejs #officials .officials-history-item-list').prepend(
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
                                })
                            );

                        }else if( user_id === c_jid ){//客户
                            //officials-history-item-list
                            var user = converse.getUserInfo2(user_id),
                                official = converse.officialInfo(Number(official_id)),
                                official_name = official && official.officialName ? official.officialName : (room_info && room_info.name ? room_info.name.name:''),
                                name = user&&user.nickname ? user.nickname  + '(' + official_name + ')' : room_info.nickname + '(' + official_name + ')',
                                default_img = converse.emoticons_file_path + converse.user_default_img,
                                avatar_url = default_img,
                                hidden_item = false;

                            if(user && user.hasAvatar){
                                avatar_url = converse.imapi_url + converse.imapi_download_avatar + '?userId='+ user_id +'&type=t&access_token='+converse.access_token;
                            }

                            var name_input = $('#conversejs #officials #official-user-name').val();
                            if(name_input && name_input.trim()){
                                if(name.toUpperCase().indexOf(name_input.trim().toUpperCase()) === -1){
                                    hidden_item = true;
                                }
                            }
                            $('#conversejs #officials .officials-history-item-list .official-room-group-item').each(function (index, element) {
                                var a_btn = $(element).find('a');
                                var room_jid = a_btn.attr('data-room-jid');
                                if (room_jid === jid) {
                                    $(element).find('a').parent().remove();
                                }
                            });
                            var f = converse.is_agent?true:false;
                            //console.error("muc 597 客户不显示 反向发起按钮："+f);
                            $('#conversejs #officials .officials-history-item-list').prepend(
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
                                }));
                        }

                    }

                    //在变量中删除
                    var room_list = converse.muc_room_list;
                    if(room_list && room_list.length > 0){
                        for(var r=0;r<room_list.length;r++){
                            var room_jid = Strophe.getNodeFromJid(jid);
                            if(room_jid === room_list[r].jid){
                                room_list.splice(r,1);
                                break;
                            }
                        }
                    }
                },

                converse.ChatRoomView = converse.ChatBoxView.extend({
                    /* Backbone View which renders a chat room, based upon the view
                     * for normal one-on-one chat boxes.
                     */
                    length: 640,
                    tagName: 'div',
                    className: 'chatbox chatroom hidden',
                    is_chatroom: true,
                    events: {
                        'click .close-chatbox-button': 'close',
                        'click .toggle-smiley': 'toggleEmoticonMenu',
                        'click #myTabEmoticon .tab-pane *': 'insertEmoticon',
                        'click .toggle-clear': 'clearChatRoomMessages',
                        'click .toggle-call': 'toggleCall',
                        'click .toggle-occupants a': 'toggleOccupants',
                        'click .toggle-create-desk': 'createDesk',
                        'click .new-msgs-indicator': 'viewUnreadMessages',
                        'click .occupant': 'onOccupantClicked',
                        'keypress textarea.chat-textarea': 'keyPressed',
                        'click textarea.chat-textarea': 'callClickTextArea',
                        'click .msg-down-img':'chatDownImg',
                        'click .inputfile':'uploadFile',
                        'click .converse_history_query':'mucHistoryQuery',
                        //'click .configure-chatroom-button': 'configureChatRoom',
                        //群聊设置
                        'click .configure-chatroom-button': 'clickConfigure',
                        'click .minimize-chatroom-button': 'clickMinimize',
                        'click .toggle-evaluate':'toggleEvaluateForm',
                        'click .evaluate-form .converse-room-evaluation-subBtn':'saveOnlineServiceEvaluation',
                        'click .msg-withdraw':'clickMsgWithraw'
                    },

                    initialize: function () {
                        var that = this;
                        this.model.messages.on('add', this.onMessageAdded, this);
                        this.model.on('show', this.show, this);
                        this.model.on('destroy', this.hide, this);
                        this.model.on('change:chat_state', this.sendChatState, this);
                        this.model.on('change:affiliation', this.renderHeading, this);
                        this.model.on('change:name', this.renderHeading, this);

                        this.createOccupantsView();

                        this.render().insertIntoDOM();// TODO: hide chat area until messages received.
                        // XXX: adding the event below to the declarative events map doesn't work.

                        // The code that gets executed because of that looks like this:
                        //      this.$el.on('scroll', '.chat-content', this.markScrolled.bind(this));
                        // Which for some reason doesn't work.
                        // So working around that fact here:
                        this.$el.find('.chat-content').on('scroll', this.markScrolled.bind(this));

                        this.getRoomFeatures().always(function () {
                            if(!that.model.get('isHistory')){
                                that.join().fetchMessages();
                            }

                            var jid = that.model.get('jid'),
                                id = Strophe.getNodeFromJid(jid),
                                room = converse.imRoomInfo(id),
                                $message_list = that.$el.find('.chat-message');

                            var data = {room_jid_id:id, access_token:converse.access_token, pageIndex:0, pageSize:converse.message_pagesize};

                            if(!that.model.get('isHistory')){
                                data.startTime = room ? room.createTime * 1000 : new Date().getTime();
                            } else {
                                data.endTime = new Date().getTime();
                            }


                                    var result_json = $.ajax({
                                        url: converse.imapi_url + converse.imapi_room_message,
                                        data: data,
                                        async: false
                                    }).responseText;
                                    var result = JSON.parse(result_json);
                                    if (result && result.resultCode && result.resultCode == 1 && result.data) {

                                        //在线客服加载创建房间到此时的聊天记录
                                        if (id.indexOf('online') >= 0) {
                                            var user_id = id.split('_')[2],
                                                official_id = id.split('_')[1],
                                                c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                                            //if (user_id === c_jid) {

                                            //获取已存在消息标记集合
                                            var chat_msgid = [];
                                            if ($message_list.length > 0) {
                                                $message_list.each(function (index, e) {
                                                    var mid = $(e).attr('data-msgid');
                                                    chat_msgid[chat_msgid.length] = mid;
                                                });
                                            }

                                            var show_msg = false;
                                            for (var i = 0; i < result.data.length; i++) {
                                                var time = moment(result.data[i].ts).format(),
                                                    nick = result.data[i].fromUserName,
                                                    sender = result.data[i].sender === Number(c_jid) ? 'me' : 'them',
                                                    text = JSON.stringify(result.data[i]),
                                                    msgid = result.data[i].packetId,
                                                    isExist = false;

                                                /*if ($.inArray(msgid, chat_msgid) > -1) {
                                                 isExist = true;
                                                 }*/
                                                var dupes = that.model.messages.filter(function (msg) {
                                                    // Find duplicates.
                                                    // Some bots (like HAL in the prosody chatroom)
                                                    // respond to commands with the same ID as the
                                                    // original message. So we also check the sender.
                                                    return msg.get('msgid') === msgid;
                                                });

                                                if (!dupes || (dupes && dupes.length === 0)) {
                                                    if (result.data[i].type != 601 || (result.data[i].type === 601 && result.data[i].objectId)) {
                                                        that.model.messages.create({
                                                            fullname: nick,
                                                            sender: sender,
                                                            time: time,
                                                            message: text,
                                                            msgid: msgid,
                                                            archive_id: true,
                                                            type: 'groupchat'
                                                        });


                                                        //显示到消息列表会话下
                                                        if (converse.allow_chatlist) {
                                                            if ((!show_msg) && !that.model.get('isHistory') && that.model.get('new_session')) {
                                                                converse_api.chatlist.add(that.model.get('jid'), "groupchat", true, 1)
                                                            }
                                                            converse_api.chatlist.updateItemMsg(that.model.get('jid'), text, 'groupchat');
                                                        }

                                                        show_msg = true;
                                                    }
                                                }
                                            }

                                            if (result.data.length === converse.message_pagesize) {
                                                that.showSystemHtmlNotificationPrepend('<a class="converse_history_query" jid="' + id + '">历史记录查看</a>', true);
                                            } else {
                                                //在线客服当前会话查询之前是否存在历史记录
                                                if (!that.model.get('isHistory')) {
                                                    var request_data = {
                                                        room_jid_id: id,
                                                        access_token: converse.access_token,
                                                        pageIndex: 0,
                                                        pageSize: converse.message_pagesize
                                                    };

                                                    request_data.endTime = new Date().getTime();

                                                    var result_json2 = $.ajax({
                                                        url: converse.imapi_url + converse.imapi_room_message,
                                                        data: request_data,
                                                        async: false
                                                    }).responseText;
                                                    var result2 = JSON.parse(result_json2);
                                                    if (result2 && result2.resultCode && result2.resultCode == 1 && result2.data) {
                                                        if (result2.data.length > 0) {
                                                            that.showSystemHtmlNotificationPrepend('<a class="converse_history_query" jid="' + id + '">历史记录查看</a>', true);
                                                        }
                                                    }
                                                }
                                            }
                                            /* } else {
                                             if(result.data.length > 0 && ( result.data.length === converse.message_pagesize || $message_list.length < result.data.length)){
                                             that.showSystemHtmlNotificationPrepend('<a class="converse_history_query" jid="' + id + '">历史记录查看</a>', true);
                                             }
                                             }*/
                                        } else {
                                            if (result.data.length > 0 && ( result.data.length === converse.message_pagesize || $message_list.length < result.data.length)) {
                                                that.showSystemHtmlNotificationPrepend('<a class="converse_history_query" jid="' + id + '">历史记录查看</a>', true);
                                            }
                                        }
                                    }


                            converse.emit('chatRoomOpened', that);
                        });
                    },

                    createOccupantsView: function () {
                        /* Create the ChatRoomOccupantsView Backbone.View
                         */
                        this.occupantsview = new converse.ChatRoomOccupantsView({
                            model: new converse.ChatRoomOccupants()
                        });
                        var id = b64_sha1('converse.occupants'+converse.bare_jid+this.model.get('jid'));
                        this.occupantsview.model.browserStorage = new Backbone.BrowserStorage.session(id);
                        this.occupantsview.chatroomview = this;
                        this.occupantsview.render(this.model.get("jid"), this.model.get('isHistory'));
                        this.occupantsview.model.fetch({add:true});
                    },

                    insertIntoDOM: function () {
                        var view = converse.chatboxviews.get("controlbox");
                        if (view) {
                            this.$el.insertAfter(view.$el);
                        } else {
                            $('#conversejs').prepend(this.$el);
                        }
                        return this;
                    },

                    render: function () {
                        /*
                         this.$el.attr('id', this.model.get('box_id'))
                         .html(converse.templates.chatroom(_.extend(this.model.toJSON(), {
                         label_close: __("Close this cat box"),
                         label_set: __("Setting")
                         })));
                         this.renderChatArea();
                         window.setTimeout(converse.refreshWebkit, 50);
                         return this;
                         */

                        this.$el.attr('id', this.model.get('box_id'))
                            .html(converse.templates.chatroom({
                                label_close: __("Close this cat box"),
                                label_set: __("Setting")
                            }));
                        this.renderHeading();
                        this.renderChatArea();
                        utils.refreshWebkit();
                        return this;
                    },

                    generateHeadingHTML: function () {
                        /* Pure function which returns the heading HTML to be
                         * rendered.
                         */
                        //判断用户在群聊中是什么角色，然后进行设置按钮的显示
                        var configure_btn = false,
                            close_btn = true,
                            minimize_btn = false;
                        var room_jid = this.model.get('jid'),
                            im_room_jid = Strophe.getNodeFromJid(room_jid),
                            room = converse.roomInfo(im_room_jid);

                        //区分普通群聊显示的菜单和在线客服显示的菜单
                        if(im_room_jid.indexOf('online')>=0){
                            var user_id = im_room_jid.split('_')[2],
                                official_id = im_room_jid.split('_')[1],
                                c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                            //historyroom :close_btn
                            if(!this.model.get('isHistory')){
                                //2017-05-05 根据需求修改：只有创建者可以关闭在线客服会话
                                if(room && room.createUserId){
                                    if(Number(room.createUserId) != Number(c_jid)){
                                        close_btn = false;
                                    }
                                }
                                //在线客服设置按钮判断
                                if(c_jid != user_id && c_jid != official_id){
                                    configure_btn = true;
                                    if(room  && room.createUserId && Number(room.createUserId) === Number(c_jid)){
                                        configure_btn = false;
                                    }
                                }
                            }

                            if(!converse.converse_complete_model && converse.default_form){
                                minimize_btn = true;
                            }
                        }else{
                            configure_btn = true;
                        }

                        var default_img = converse.emoticons_file_path + converse.room_default_img,
                            avatar_url = converse.emoticons_file_path + converse.room_default_img;

                        if(room){
                            avatar_url = converse.imapi_url+converse.imapi_download_avatar+'?userId='+ room.id + '&type=t&access_token=' + converse.access_token;
                        }
                        if(im_room_jid.indexOf('online')>=0){
                            var user_id = im_room_jid.split('_')[2],
                                official_id = im_room_jid.split('_')[1],
                                c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                            if(c_jid != user_id && c_jid != official_id){
                                var user_info = converse.getUserInfo2(Number(user_id));

                                default_img = converse.emoticons_file_path + converse.user_default_img;
                                avatar_url = user_info && user_info.hasAvatar ? converse.imapi_url + converse.imapi_download_avatar + '?userId='+ user_id +'&type=t&access_token='+converse.access_token : default_img;
                            } else {
                                var official = converse.officialInfo(official_id);
                                default_img = converse.emoticons_file_path + converse.official_default_img;
                                avatar_url = official && official.logoUrl ? official.logoUrl : default_img;
                            }
                        }

                        return converse.templates.chatroom_head(
                            _.extend(this.model.toJSON(), {
                                info_close: __('Close and leave this room'),
                                info_configure: __('Configure this room'),
                                info_minimize: __('Minimize this chat box'),
                                minimize_btn: minimize_btn,
                                configure_btn: configure_btn,
                                close_show: close_btn,
                                avatar_url: avatar_url,
                                default_img: default_img
                            }));
                    },

                    renderHeading: function () {
                        /* Render the heading UI of the chat room.
                         */
                        this.el.querySelector('.chat-head-chatroom').innerHTML = this.generateHeadingHTML();
                    },

                    renderChatArea: function () {
                        /* Render the UI container in which chat room messages will
                         * appear.
                         */
                        var jid = this.model.get('jid'),
                            id = Strophe.getNodeFromJid(jid),
                            c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                        if (!this.$('.chat-area').length) {
                            this.$('.chatroom-body').empty()
                                .append(
                                    converse.templates.chatarea({
                                        'unread_msgs': __('You have unread messages'),
                                        'show_toolbar': converse.show_toolbar,
                                        'label_message': __('Message')
                                    }))
                                //.append(this.occupantsview.render(jid, c_jid).$el);
                                .append(this.occupantsview.$el);
                            this.renderToolbar(tpl_chatroom_toolbar);
                            this.$content = this.$el.find('.chat-content');
                        }

                        if(id.indexOf('online')>=0 && converse.is_agent && !this.model.get('isHistory')) {
                            var user_id = id.split('_')[2];
                            var official_id = id.split('_')[1];
                            if(c_jid != user_id && c_jid != official_id){
                                this.toggleOccupants(null, true);
                            } else {
                                this.toggleOccupants(null, false);
                            }
                        }else{
                            this.toggleOccupants(null, false);
                        }
                        return this;
                    },

                    getToolbarOptions: function () {
                        var create_desk = false,
                            show_evaluate = false,
                            startTime = 0;
                        if(this.is_chatroom){
                            var jid = this.model.get("jid"),
                                id = Strophe.getNodeFromJid(jid);
                            if(id.indexOf('online')>=0) {
                                create_desk = true;
                                var user_id = id.split('_')[2],
                                    c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                                if(user_id === c_jid && !converse.default_form){
                                    show_evaluate = true;

                                    var room = converse.roomInfo(id);
                                    startTime = room && room.createTime ? room.createTime : 0;
                                }
                            }
                        }

                        return _.extend(
                            converse.ChatBoxView.prototype.getToolbarOptions.apply(this, arguments),
                            {
                                label_hide_occupants: __('Hide the list of occupants'),
                                show_occupants_toggle: this.is_chatroom && converse.visible_toolbar_buttons.toggle_occupants,
                                show_file_button: this.is_chatroom && converse.visible_toolbar_buttons.show_file_button,
                                show_create_desk: this.is_chatroom && create_desk,
                                show_evaluate: this.is_chatroom && show_evaluate,
                                room_jid: id,
                                room_start_time: startTime
                            }
                        );
                    },

                    close: function (ev) {
                        //判断是否是公众号群聊，如果是，则删除房间
                        var official_id = 0;
                        if(ev){
                            var jid = this.model.get('jid');
                            if(jid){
                                var id = Strophe.getNodeFromJid(jid);
                                if(id.indexOf('online')>=0 && !this.model.get('isHistory')) {
                                    official_id = jid.split("_")[1];

                                    var _this = this;
                                    if (converse.new_modal) {

                                        $.dialog('confirm', __('prompt'), __("Are you sure you want to exit this room"), 0, function () {
                                            $.closeDialog();

                                            _this.closeRoom(_this, id, jid);
                                        });
                                        return false;
                                    } else {
                                        var result = confirm(__("Are you sure you want to exit this room"));
                                        if (!(result === true)) {
                                            return false;
                                        }

                                        this.closeRoom(_this, id, jid);
                                    }

                                }
                            }
                        }

                        if(!this.model.get('isHistory')){
                            var c_m_l  = converse.muc_room_list,
                                isExist = false,
                                jid = this.model.get('jid'),
                                id = Strophe.getNodeFromJid(jid);
                            if(c_m_l && c_m_l.length > 0){
                                for(var j=0;j<c_m_l.length;j++){
                                    var c_room = c_m_l[j];
                                    if(id === c_room.jid){
                                        isExist = true;
                                    }
                                }
                            }
                            if(!isExist){
                                if (id.indexOf('online') >= 0) {
                                    if(this.$content.length > 0){
                                        this.$content.empty();
                                    }
                                    this.model.messages.reset();
                                    this.model.messages.browserStorage._clear();
                                }

                                this.leave();
                                converse.addHistoryRoom(jid);
                            }

                            if(!ev && jid.indexOf('online') >= 0){//cgh5252 远程回调关闭客服消息记录
                                converse_api.chatlist.deleteitem(jid);
                            }
                        }
                        if(official_id != 0){
                            COM.repeat('online_service'+official_id,5);
                        }
                        this.hide();
                        converse.ChatBoxView.prototype.close.apply(this, arguments);

                    },

                    toggleOccupants: function (ev, preserve_state) {
                        /* Show or hide the right sidebar containing the chat
                         * occupants (and the invite widget).
                         */
                        if (ev) {
                            ev.preventDefault();
                            ev.stopPropagation();
                        }
                        if (preserve_state) {
                            // Bit of a hack, to make sure that the sidebar's state doesn't change
                            this.model.set({hidden_occupants: !this.model.get('hidden_occupants')});
                        }
                        if (!this.model.get('hidden_occupants')) {
                            this.model.save({hidden_occupants: true});
                            this.$('.icon-hide-users').removeClass('icon-hide-users').addClass('icon-show-users');
                            this.$('.occupants').addClass('hidden');
                            this.$('.chat-area').addClass('full');
                            this.scrollDown();
                        } else {
                            this.model.save({hidden_occupants: false});
                            this.$('.icon-show-users').removeClass('icon-show-users').addClass('icon-hide-users');
                            this.$('.chat-area').removeClass('full');
                            this.$('div.occupants').removeClass('hidden');
                            this.scrollDown();
                        }
                    },

                    onOccupantClicked: function (ev) {
                        /* When an occupant is clicked, insert their nickname into
                         * the chat textarea input.
                         */
                        this.insertIntoTextArea(ev.target.textContent);
                    },

                    requestMemberList: function (affiliation) {
                        /* Send an IQ stanza to the server, asking it for the
                         * member-list of this room.
                         *
                         * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                         *
                         * Parameters:
                         *  (String) affiliation: The specific member list to
                         *      fetch. 'admin', 'owner' or 'member'.
                         *
                         * Returns:
                         *  A promise which resolves once the list has been
                         *  retrieved.
                         */
                        var deferred = new $.Deferred();
                        affiliation = affiliation || 'member';
                        var iq = $iq({to: this.model.get('jid'), type: "get"})
                            .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                            .c("item", {'affiliation': affiliation});
                        converse.connection.sendIQ(iq, deferred.resolve, deferred.reject);
                        return deferred.promise();
                    },

                    parseMemberListIQ: function (iq) {
                        /* Given an IQ stanza with a member list, create an array of member
                         * objects.
                         */
                        return _.map(
                            $(iq).find('query[xmlns="'+Strophe.NS.MUC_ADMIN+'"] item'),
                            function (item) {
                                return {
                                    'jid': item.getAttribute('jid'),
                                    'affiliation': item.getAttribute('affiliation'),
                                };
                            }
                        );
                    },

                    computeAffiliationsDelta: function (exclude_existing, remove_absentees, new_list, old_list) {
                        /* Given two lists of objects with 'jid', 'affiliation' and
                         * 'reason' properties, return a new list containing
                         * those objects that are new, changed or removed
                         * (depending on the 'remove_absentees' boolean).
                         *
                         * The affiliations for new and changed members stay the
                         * same, for removed members, the affiliation is set to 'none'.
                         *
                         * The 'reason' property is not taken into account when
                         * comparing whether affiliations have been changed.
                         *
                         * Parameters:
                         *  (Boolean) exclude_existing: Indicates whether JIDs from
                         *      the new list which are also in the old list
                         *      (regardless of affiliation) should be excluded
                         *      from the delta. One reason to do this
                         *      would be when you want to add a JID only if it
                         *      doesn't have *any* existing affiliation at all.
                         *  (Boolean) remove_absentees: Indicates whether JIDs
                         *      from the old list which are not in the new list
                         *      should be considered removed and therefore be
                         *      included in the delta with affiliation set
                         *      to 'none'.
                         *  (Array) new_list: Array containing the new affiliations
                         *  (Array) old_list: Array containing the old affiliations
                         */
                        var new_jids = _.pluck(new_list, 'jid');
                        var old_jids = _.pluck(old_list, 'jid');

                        // Get the new affiliations
                        var delta = _.map(_.difference(new_jids, old_jids), function (jid) {
                            return new_list[_.indexOf(new_jids, jid)];
                        });
                        if (!exclude_existing) {
                            // Get the changed affiliations
                            delta = delta.concat(_.filter(new_list, function (item) {
                                var idx = _.indexOf(old_jids, item.jid);
                                if (idx >= 0) {
                                    return item.affiliation !== old_list[idx].affiliation;
                                }
                                return false;
                            }));
                        }
                        if (remove_absentees) {
                            // Get the removed affiliations
                            delta = delta.concat(_.map(_.difference(old_jids, new_jids), function (jid) {
                                return {'jid': jid, 'affiliation': 'none'};
                            }));
                        }
                        return delta;
                    },

                    setAffiliation: function(affiliation, members) {
                        /* Send an IQ stanzas to the server to modify one particular
                         * affiliation for certain members
                         *
                         * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                         *
                         * Parameters:
                         *  (Object) members: A map of jids, affiliations and
                         *      optionally reasons. Only those entries with the
                         *      same affiliation as being currently set will be
                         *      considered.
                         *
                         * Returns:
                         *  A promise which resolves and fails depending on the
                         *  XMPP server response.
                         */
                        var deferred = new $.Deferred();
                        var iq = $iq({to: this.model.get('jid'), type: "set"})
                            .c("query", {xmlns: Strophe.NS.MUC_ADMIN});

                        _.each(members, function (member) {
                            if (!_.isUndefined(member.affiliation) &&
                                member.affiliation !== affiliation) {
                                return;
                            }
                            iq.c("item", {
                                'affiliation': member.affiliation || affiliation,
                                'jid': member.jid
                            });
                            if (!_.isUndefined(member.reason)) {
                                iq.c("reason", member.reason).up();
                            }
                            iq.up();
                        });
                        converse.connection.sendIQ(iq, deferred.resolve, deferred.reject);
                        return deferred;
                    },

                    setAffiliations: function (members, onSuccess, onError) {
                        /* Send IQ stanzas to the server to modify the
                         * affiliations in this room.
                         *
                         * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                         *
                         * Parameters:
                         *  (Object) members: A map of jids, affiliations and optionally reasons
                         *  (Function) onSuccess: callback for a succesful response
                         *  (Function) onError: callback for an error response
                         */
                        if (_.isEmpty(members)) {
                            // Succesfully updated with zero affilations :)
                            onSuccess(null);
                            return;
                        }
                        var affiliations = _.uniq(_.pluck(members, 'affiliation'));
                        var promises = _.map(affiliations, _.partial(this.setAffiliation, _, members), this);
                        $.when.apply($, promises).done(onSuccess).fail(onError);
                    },

                    marshallAffiliationIQs: function () {
                        /* Marshall a list of IQ stanzas into a map of JIDs and
                         * affiliations.
                         *
                         * Parameters:
                         *  Any amount of XMLElement objects, representing the IQ
                         *  stanzas.
                         */
                        return _.flatten(_.map(arguments, this.parseMemberListIQ));
                    },

                    getJidsWithAffiliations: function (affiliations) {
                        /* Returns a map of JIDs that have the affiliations
                         * as provided.
                         */
                        if (typeof affiliations === "string") {
                            affiliations = [affiliations];
                        }
                        var that = this;
                        var deferred = new $.Deferred();
                        var promises = [];
                        _.each(affiliations, function (affiliation) {
                            promises.push(that.requestMemberList(affiliation));
                        });
                        $.when.apply($, promises).always(
                            _.compose(deferred.resolve, this.marshallAffiliationIQs.bind(this))
                        );
                        return deferred.promise();
                    },

                    updateMemberLists: function (members, affiliations, deltaFunc) {
                        /* Fetch the lists of users with the given affiliations.
                         * Then compute the delta between those users and
                         * the passed in members, and if it exists, send the delta
                         * to the XMPP server to update the member list.
                         *
                         * Parameters:
                         *  (Object) members: Map of member jids and affiliations.
                         *  (String|Array) affiliation: An array of affiliations or
                         *      a string if only one affiliation.
                         *  (Function) deltaFunc: The function to compute the delta
                         *      between old and new member lists.
                         *
                         * Returns:
                         *  A promise which is resolved once the list has been
                         *  updated or once it's been established there's no need
                         *  to update the list.
                         */
                        var that = this;
                        var deferred = new $.Deferred();
                        this.getJidsWithAffiliations(affiliations).then(function (old_members) {
                            that.setAffiliations(
                                deltaFunc(members, old_members),
                                deferred.resolve,
                                deferred.reject
                            );
                        });
                        return deferred.promise();
                    },

                    directInvite: function (recipient, reason) {
                        /* Send a direct invitation as per XEP-0249
                         *
                         * Parameters:
                         *    (String) recipient - JID of the person being invited
                         *    (String) reason - Optional reason for the invitation
                         */
                        if (this.model.get('membersonly')) {
                            // When inviting to a members-only room, we first add
                            // the person to the member list by giving them an
                            // affiliation of 'member' (if they're not affiliated
                            // already), otherwise they won't be able to join.
                            var map = {}; map[recipient] = 'member';
                            var deltaFunc = _.partial(this.computeAffiliationsDelta, true, false);
                            this.updateMemberLists(
                                [{'jid': recipient, 'affiliation': 'member', 'reason': reason}],
                                ['member', 'owner', 'admin'],
                                deltaFunc
                            );
                        }
                        var attrs = {
                            'xmlns': 'jabber:x:conference',
                            'jid': this.model.get('jid')
                        };
                        if (reason !== null) { attrs.reason = reason; }
                        if (this.model.get('password')) { attrs.password = this.model.get('password'); }
                        var invitation = $msg({
                            from: converse.connection.jid,
                            to: recipient,
                            id: converse.connection.getUniqueId()
                        }).c('x', attrs);
                        converse.connection.send(invitation);
                        converse.emit('roomInviteSent', {
                            'room': this,
                            'recipient': recipient,
                            'reason': reason
                        });
                    },

                    handleChatStateMessage: function (message) {
                        /* Override the method on the ChatBoxView base class to
                         * ignore <gone/> notifications in groupchats.
                         *
                         * As laid out in the business rules in XEP-0085
                         * http://xmpp.org/extensions/xep-0085.html#bizrules-groupchat
                         */
                        if (message.get('fullname') === this.model.get('nick')) {
                            // Don't know about other servers, but OpenFire sends
                            // back to you your own chat state notifications.
                            // We ignore them here...
                            return;
                        }
                        if (message.get('chat_state') !== converse.GONE) {
                            converse.ChatBoxView.prototype.handleChatStateMessage.apply(this, arguments);
                        }
                    },

                    sendChatState: function () {
                        /* Sends a message with the status of the user in this chat session
                         * as taken from the 'chat_state' attribute of the chat box.
                         * See XEP-0085 Chat State Notifications.
                         */
                        var chat_state = this.model.get('chat_state');
                        if (chat_state === converse.GONE) {
                            // <gone/> is not applicable within MUC context
                            return;
                        }
                        converse.connection.send(
                            $msg({'to':this.model.get('jid'), 'type': 'groupchat'})
                                .c(chat_state, {'xmlns': Strophe.NS.CHATSTATES}).up()
                                .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                                .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                        );
                    },

                    sendChatRoomMessage: function (text) {
                        /* Constuct a message stanza to be sent to this chat room,
                         * and send it to the server.
                         *
                         * Parameters:
                         *  (String) text: The message text to be sent.
                         */

                        //将\转义
                        text = text.replace(/\\/g, "\\\\");

                        //将双引号进行转换
                        var reg = new RegExp("\"","g");
                        text = text.replace(reg,"\\\"");

                        //将换行替换
                        text = text.replace(/\n|\r\n/g, "\\n");

                        var fileType = '1';
                        var msg_text = '{"content":"' + text + '","fromUserId":"'+Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid))+'","fromUserName":"'+converse.nick_name+'","timeSend":'+parseInt(moment() / 1000)+',"type":'+fileType+'}';
                        var msgid = converse.connection.getUniqueId();
                        var msg = $msg({
                            to: this.model.get('jid'),
                            from: converse.connection.jid,
                            type: 'groupchat',
                            id: msgid
                        }).c("body").t(msg_text).up();
                        converse.connection.send(msg);
                        this.model.messages.create({
                            fullname: this.model.get('nick'),
                            sender: 'me',
                            time: moment().format(),
                            message: msg_text,
                            msgid: msgid
                        });

                        if(converse.allow_chatlist) {
                            //update list item msg
                            converse_api.chatlist.updateItemMsg(this.model.get('jid'), msg_text, 'groupchat');
                        }
                    },

                    modifyRole: function(room, nick, role, reason, onSuccess, onError) {
                        var item = $build("item", {nick: nick, role: role});
                        var iq = $iq({to: room, type: "set"}).c("query", {xmlns: Strophe.NS.MUC_ADMIN}).cnode(item.node);
                        if (reason !== null) { iq.c("reason", reason); }
                        return converse.connection.sendIQ(iq.tree(), onSuccess, onError);
                    },

                    validateRoleChangeCommand: function (command, args) {
                        /* Check that a command to change a chat room user's role or
                         * affiliation has anough arguments.
                         */
                        // TODO check if first argument is valid
                        if (args.length < 1 || args.length > 2) {
                            this.showStatusNotification(
                                __("Error: the \""+command+"\" command takes two arguments, the user's nickname and optionally a reason."),
                                true
                            );
                            return false;
                        }
                        return true;
                    },

                    clearChatRoomMessages: function (ev) {
                        if (typeof ev !== "undefined") { ev.stopPropagation(); }
                        if(converse.new_modal){
                            var _this = this;
                            $.dialog('confirm',__('prompt'),__("Are you sure you want to clear the messages from this room?"),0,function() {
                                $.closeDialog();
                                _this.$content.empty();
                                _this.model.messages.reset();
                                _this.model.messages.browserStorage._clear();
                                return _this;
                            });
                        } else {
                            var result = confirm(__("Are you sure you want to clear the messages from this room?"));
                            if (result === true) {
                                this.$content.empty();
                                this.model.messages.reset();
                                this.model.messages.browserStorage._clear();
                            }
                            return this;
                        }
                    },

                    onCommandError: function () {
                        this.showStatusNotification(__("Error: could not execute the command"), true);
                    },

                    onMessageSubmitted: function (text) {
                        /* Gets called when the user presses enter to send off a
                         * message in a chat room.
                         *
                         * Parameters:
                         *    (String) text - The message text.
                         */
                        if(converse.allow_chatlist){
                            converse_api.chatlist.first(this.model.get('jid'), 'groupchat');
                        }

                        if (converse.muc_disable_moderator_commands) {
                            return this.sendChatRoomMessage(text);
                        }
                        var match = text.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false, '', ''],
                            args = match[2] && match[2].splitOnce(' ') || [];
                        switch (match[1]) {
                            case 'admin':
                                if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                                this.setAffiliation('admin',
                                    [{ 'jid': args[0],
                                        'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                                break;
                            case 'ban':
                                if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                                this.setAffiliation('outcast',
                                    [{ 'jid': args[0],
                                        'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                                break;
                            case 'clear':
                                this.clearChatRoomMessages();
                                break;
                            case 'deop':
                                if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                                this.modifyRole(
                                    this.model.get('jid'), args[0], 'occupant', args[1],
                                    undefined, this.onCommandError.bind(this));
                                break;
                            case 'help':
                                this.showHelpMessages([
                                    '<strong>/admin</strong>: ' +__("Change user's affiliation to admin"),
                                    '<strong>/ban</strong>: '   +__('Ban user from room'),
                                    '<strong>/clear</strong>: ' +__('Remove messages'),
                                    '<strong>/deop</strong>: '  +__('Change user role to occupant'),
                                    '<strong>/help</strong>: '  +__('Show this menu'),
                                    '<strong>/kick</strong>: '  +__('Kick user from room'),
                                    '<strong>/me</strong>: '    +__('Write in 3rd person'),
                                    '<strong>/member</strong>: '+__('Grant membership to a user'),
                                    '<strong>/mute</strong>: '  +__("Remove user's ability to post messages"),
                                    '<strong>/nick</strong>: '  +__('Change your nickname'),
                                    '<strong>/op</strong>: '    +__('Grant moderator role to user'),
                                    '<strong>/owner</strong>: ' +__('Grant ownership of this room'),
                                    '<strong>/revoke</strong>: '+__("Revoke user's membership"),
                                    '<strong>/topic</strong>: ' +__('Set room topic'),
                                    '<strong>/voice</strong>: ' +__('Allow muted user to post messages')
                                ]);
                                break;
                            case 'kick':
                                if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                                this.modifyRole(
                                    this.model.get('jid'), args[0], 'none', args[1],
                                    undefined, this.onCommandError.bind(this));
                                break;
                            case 'mute':
                                if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                                this.modifyRole(
                                    this.model.get('jid'), args[0], 'visitor', args[1],
                                    undefined, this.onCommandError.bind(this));
                                break;
                            case 'member':
                                if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                                this.setAffiliation('member',
                                    [{ 'jid': args[0],
                                        'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                                break;
                            case 'nick':
                                converse.connection.send($pres({
                                    from: converse.connection.jid,
                                    to: this.getRoomJIDAndNick(match[2]),
                                    id: converse.connection.getUniqueId()
                                }).tree());
                                break;
                            case 'owner':
                                if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                                this.setAffiliation('owner',
                                    [{ 'jid': args[0],
                                        'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                                break;
                            case 'op':
                                if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                                this.modifyRole(
                                    this.model.get('jid'), args[0], 'moderator', args[1],
                                    undefined, this.onCommandError.bind(this));
                                break;
                            case 'revoke':
                                if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                                this.setAffiliation('none',
                                    [{ 'jid': args[0],
                                        'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                                break;
                            case 'topic':
                                converse.connection.send(
                                    $msg({
                                        to: this.model.get('jid'),
                                        from: converse.connection.jid,
                                        type: "groupchat"
                                    }).c("subject", {xmlns: "jabber:client"}).t(match[2]).tree()
                                );
                                break;
                            case 'voice':
                                if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                                this.modifyRole(
                                    this.model.get('jid'), args[0], 'occupant', args[1],
                                    undefined, this.onCommandError.bind(this));
                                break;
                            default:
                                this.sendChatRoomMessage(text);
                                break;
                        }
                    },

                    handleMUCMessage: function (stanza) {
                        /* Handler for all MUC messages sent to this chat room.
                         *
                         * MAM (message archive management XEP-0313) messages are
                         * ignored, since they're handled separately.
                         *
                         * Parameters:
                         *  (XMLElement) stanza: The message stanza.
                         */
                        var is_mam = $(stanza).find('[xmlns="'+Strophe.NS.MAM+'"]').length > 0;
                        if (is_mam) {
                            return true;
                        }
                        var configuration_changed = stanza.querySelector("status[code='104']");
                        var logging_enabled = stanza.querySelector("status[code='170']");
                        var logging_disabled = stanza.querySelector("status[code='171']");
                        var room_no_longer_anon = stanza.querySelector("status[code='172']");
                        var room_now_semi_anon = stanza.querySelector("status[code='173']");
                        var room_now_fully_anon = stanza.querySelector("status[code='173']");

                        if (configuration_changed || logging_enabled || logging_disabled ||
                            room_no_longer_anon || room_now_semi_anon || room_now_fully_anon) {
                            this.getRoomFeatures();
                        }
                        //104 message does not diplay
                        if(!configuration_changed){
                            _.compose(this.onChatRoomMessage.bind(this), this.showStatusMessages.bind(this))(stanza);
                        }
                        return true;
                    },

                    getRoomJIDAndNick: function (nick) {
                        /* Utility method to construct the JID for the current user
                         * as occupant of the room.
                         *
                         * This is the room JID, with the user's nick added at the
                         * end.
                         *
                         * For example: room@conference.example.org/nickname
                         */
                        if (nick) {
                            try {
                                this.model.save({'nick': nick});
                            } catch (e){
                                //console.log(e);
                            }

                        } else {
                            nick = this.model.get('nick');
                        }
                        var room = this.model.get('jid');
                        var node = Strophe.getNodeFromJid(room);
                        var domain = Strophe.getDomainFromJid(room);
                        return node + "@" + domain + (nick !== null ? "/" + nick : "");
                    },

                    registerHandlers: function () {
                        /* Register presence and message handlers for this chat
                         * room
                         */
                        var room_jid = this.model.get('jid');
                        if (this.message_handler || this.presence_handler) {
                            this.removeHandlers();
                        }
                        this.presence_handler = converse.connection.addHandler(
                            this.onChatRoomPresence.bind(this),
                            Strophe.NS.MUC, 'presence', null, null, room_jid,
                            {'ignoreNamespaceFragment': true, 'matchBareFromJid': true}
                        );

                        this.message_handler = converse.connection.addHandler(
                            this.handleMUCMessage.bind(this),
                            null, 'message', null, null, room_jid,
                            {'matchBareFromJid': true}
                        );

                        converse.room_handler[converse.room_handler.length] = {jid: room_jid, handler: this.message_handler};
                    },

                    removeHandlers: function () {
                        /* Remove the presence and message handlers that were
                         * registered for this chat room.
                         */
                        if (this.message_handler) {
                            converse.connection.deleteHandler(this.message_handler);
                            delete this.message_handler;
                            converse.mucHandlerVarMove(this.model.get('jid'));
                        }
                        if (this.presence_handler) {
                            converse.connection.deleteHandler(this.presence_handler);
                            delete this.presence_handler;
                            converse.mucHandlerVarMove(this.model.get('jid'));
                        }
                        return this;
                    },

                    join: function (nick, password, isCreate) {

                        /* Join the chat room.
                         *
                         * Parameters:
                         *  (String) nick: The user's nickname
                         *  (String) password: Optional password, if required by
                         *      the room.
                         */
                        nick = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                        if (!nick) {
                            return this.checkForReservedNick();
                        }
                        this.registerHandlers();
                        if (this.model.get('connection_status') ===  Strophe.Status.CONNECTED) {
                            // We have restored a chat room from session storage,
                            // so we don't send out a presence stanza again.
                            return this;
                        }

                        var room_list = converse.muc_room_list;
                        var room,
                            jid = this.model.get('jid'),
                            id = Strophe.getNodeFromJid(jid),
                            history_val;
                        if(room_list && room_list.length > 0){
                            for(var i=0;i<room_list.length;i++){
                                if(id === room_list[i].jid){
                                    room = room_list[i];
                                    break;
                                }
                            }
                        }

                        /*
                         if(!room || id.indexOf('online')>=0){
                         history_val = {'seconds':'0'};
                         } else {
                         var offline_time = converse.offline_time,
                         now_time = new Date().getTime()/1000;
                         if(offline_time && parseInt(now_time - offline_time) >0){
                         history_val = {'seconds': parseInt(now_time - offline_time) + ''};
                         } else {
                         history_val = {'seconds': '0'};
                         }
                         }
                         */

                        history_val = {'seconds':'0'};
                        /*
                         if(room && id.indexOf('online')>=0){
                         var now_time = new Date().getTime()/1000,
                         time = parseInt(now_time - room.createTime);

                         if(time > 0){
                         history_val = {'seconds':time};
                         }
                         }*/

                        var stanza = $pres({
                            'from': converse.connection.jid,
                            'to': this.getRoomJIDAndNick(nick)
                        }).c("x", {'xmlns': Strophe.NS.MUC})
                            .c("history", history_val).up();
                        if (password) {
                            stanza.cnode(Strophe.xmlElement("password", [], password));
                        }
                        this.model.set('connection_status', Strophe.Status.CONNECTING);

                        //判断是否是新建群聊，如果是进行权限赋值
                        if(!room || isCreate){
                            converse.connection.send(stanza);

                            var user_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                            var iq, stanzaiq;
                            iq = $iq({
                                to: jid,
                                type: "set"
                            }).c("query", {
                                xmlns: Strophe.NS.MUC_OWNER
                            });
                            iq.c("x", {
                                xmlns: "jabber:x:data",
                                type: "submit"
                            });
                            iq.c('field', { 'var': 'FORM_TYPE' }).c('value').t('http://jabber.org/protocol/muc#roomconfig').up().up();
                            iq.c('field', { 'var': 'muc#roomconfig_persistentroom'}).c('value').t('1').up().up();
                            iq.c('field', { 'var': 'muc#roomconfig_roomowners'}).c('value').t(user_jid).up().up();
                            iq.c('field', { 'var': 'muc#roomconfig_roomadmins'}).c('value').t(user_jid).up().up();
                            iq.c('field', {'var': 'muc#roomconfig_passwordprotectedroom'}).c('value').t('0').up().up();

                            stanzaiq = iq.tree();
                            converse.connection.sendIQ(stanzaiq);
                        }else{
                            converse.connection.send(stanza);
                        }

                        return this;
                    },

                    cleanup: function () {
                        try{
                            this.model.save('connection_status', Strophe.Status.DISCONNECTED);
                        } catch (e) {

                        }
                        this.removeHandlers();
                        converse.ChatBoxView.prototype.close.apply(this, arguments);
                    },

                    leave: function(exit_msg) {
                        /* Leave the chat room.
                         *
                         * Parameters:
                         *  (String) exit_msg: Optional message to indicate your
                         *      reason for leaving.
                         */
                        this.hide();
                        this.occupantsview.model.reset();
                        this.occupantsview.model.browserStorage._clear();
                        if (!converse.connection.connected ||
                            this.model.get('connection_status') === Strophe.Status.DISCONNECTED) {
                            // Don't send out a stanza if we're not connected.
                            this.cleanup();
                            return;
                        }
                        var presence = $pres({
                            type: "unavailable",
                            from: converse.connection.jid,
                            to: this.getRoomJIDAndNick()
                        });
                        if (exit_msg !== null) {
                            presence.c("status", exit_msg);
                        }
                        converse.connection.sendPresence(
                            presence,
                            this.cleanup.bind(this),
                            this.cleanup.bind(this),
                            2000
                        );
                    },

                    renderConfigurationForm: function (stanza) {
                        /* Renders a form given an IQ stanza containing the current
                         * room configuration.
                         *
                         * Returns a promise which resolves once the user has
                         * either submitted the form, or canceled it.
                         *
                         * Parameters:
                         *  (XMLElement) stanza: The IQ stanza containing the room config.
                         */
                        var that = this,
                            $body = this.$('.chatroom-body');
                        $body.children().addClass('hidden');
                        // Remove any existing forms
                        $body.find('form.chatroom-form').remove();
                        $body.append(converse.templates.chatroom_form());

                        var $form = $body.find('form.chatroom-form'),
                            $fieldset = $form.children('fieldset:first'),
                            $stanza = $(stanza),
                            $fields = $stanza.find('field'),
                            title = $stanza.find('title').text(),
                            instructions = $stanza.find('instructions').text();
                        $fieldset.find('span.spinner').remove();
                        $fieldset.append($('<legend>').text(title));
                        if (instructions && instructions !== title) {
                            $fieldset.append($('<p class="instructions">').text(instructions));
                        }
                        _.each($fields, function (field) {
                            $fieldset.append(utils.xForm2webForm($(field), $stanza));
                        });
                        $form.append('<fieldset></fieldset>');
                        $fieldset = $form.children('fieldset:last');
                        $fieldset.append('<input type="submit" class="pure-button button-primary" value="'+__('Save')+'"/>');
                        $fieldset.append('<input type="button" class="pure-button button-cancel" value="'+__('Cancel')+'"/>');
                        $fieldset.find('input[type=button]').on('click', function (ev) {
                            ev.preventDefault();
                            that.cancelConfiguration();
                        });
                        $form.on('submit', function (ev) {
                            ev.preventDefault();
                            that.saveConfiguration(ev.target);
                        });
                    },

                    sendConfiguration: function(config, onSuccess, onError) {
                        /* Send an IQ stanza with the room configuration.
                         *
                         * Parameters:
                         *  (Array) config: The room configuration
                         *  (Function) onSuccess: Callback upon succesful IQ response
                         *      The first parameter passed in is IQ containing the
                         *      room configuration.
                         *      The second is the response IQ from the server.
                         *  (Function) onError: Callback upon error IQ response
                         *      The first parameter passed in is IQ containing the
                         *      room configuration.
                         *      The second is the response IQ from the server.
                         */
                        var iq = $iq({to: this.model.get('jid'), type: "set"})
                            .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                            .c("x", {xmlns: Strophe.NS.XFORM, type: "submit"});
                        _.each(config || [], function (node) { iq.cnode(node).up(); });
                        onSuccess = _.isUndefined(onSuccess) ? _.noop : _.partial(onSuccess, iq.nodeTree);
                        onError = _.isUndefined(onError) ? _.noop : _.partial(onError, iq.nodeTree);
                        return converse.connection.sendIQ(iq, onSuccess, onError);
                    },

                    saveConfiguration: function (form) {
                        /* Submit the room configuration form by sending an IQ
                         * stanza to the server.
                         *
                         * Returns a promise which resolves once the XMPP server
                         * has return a response IQ.
                         *
                         * Parameters:
                         *  (HTMLElement) form: The configuration form DOM element.
                         */
                        var that = this;
                        var $inputs = $(form).find(':input:not([type=button]):not([type=submit])'),
                            configArray = [];
                        $inputs.each(function () {
                            configArray.push(utils.webForm2xForm(this));
                        });
                        this.sendConfiguration(configArray);
                        this.$el.find('div.chatroom-form-container').hide(
                            function () {
                                $(this).remove();
                                that.$el.find('.chat-area').removeClass('hidden');
                                that.$el.find('.occupants').removeClass('hidden');
                            });
                    },

                    autoConfigureChatRoom: function (stanza) {
                        /* Automatically configure room based on the
                         * 'roomconfigure' data on this view's model.
                         *
                         * Returns a promise which resolves once a response IQ has
                         * been received.
                         *
                         * Parameters:
                         *  (XMLElement) stanza: IQ stanza from the server,
                         *       containing the configuration.
                         */
                        var that = this, configArray = [],
                            $fields = $(stanza).find('field'),
                            count = $fields.length,
                            config = this.model.get('roomconfig');

                        $fields.each(function () {
                            var fieldname = this.getAttribute('var').replace('muc#roomconfig_', ''),
                                type = this.getAttribute('type'),
                                value;
                            if (fieldname in config) {
                                switch (type) {
                                    case 'boolean':
                                        value = config[fieldname] ? 1 : 0;
                                        break;
                                    case 'list-multi':
                                        // TODO: we don't yet handle "list-multi" types
                                        value = this.innerHTML;
                                        break;
                                    default:
                                        value = config[fieldname];
                                }
                                this.innerHTML = $build('value').t(value);
                            }
                            configArray.push(this);
                            if (!--count) {
                                that.sendConfiguration(configArray);
                            }
                        });
                    },

                    cancelConfiguration: function (ev) {
                        /* Remove the configuration form without submitting and
                         * return to the chat view.
                         */
                        ev.preventDefault();
                        var that = this,
                            jid = this.model.get('jid'),
                            room_jid = Strophe.getNodeFromJid(jid);
                        this.$el.find('div.chatroom-form-container').hide(
                            function () {
                                $(this).remove();
                                that.$el.find('.chat-area').removeClass('hidden');
                                if(room_jid.indexOf('online')>=0) {
                                    //判断是否是房间的所有者
                                    var user_id = room_jid.split('_')[2],
                                        official_id = room_jid.split('_')[1],
                                        c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                                    if(c_jid != user_id && c_jid != official_id){
                                        that.$el.find('.occupants').removeClass('hidden');
                                    }
                                }
                            });
                    },

                    fetchRoomConfiguration: function (handler) {
                        /* Send an IQ stanza to fetch the room configuration data.
                         * Returns a promise which resolves once the response IQ
                         * has been received.
                         *
                         * Parameters:
                         *  (Function) handler: The handler for the response IQ
                         */
                        var that = this;
                        var deferred = new $.Deferred();
                        converse.connection.sendIQ(
                            $iq({
                                'to': this.model.get('jid'),
                                'type': "get"
                            }).c("query", {xmlns: Strophe.NS.MUC_OWNER}),
                            function (iq) {
                                if (handler) {
                                    handler.apply(that, arguments);
                                }
                                deferred.resolve(iq);
                            },
                            deferred.reject // errback
                        );
                        return deferred.promise();
                    },

                    getRoomFeatures: function () {
                        /* Fetch the room disco info, parse it and then
                         * save it on the Backbone.Model of this chat rooms.
                         */
                        var deferred = new $.Deferred();
                        var that = this;
                        converse.connection.disco.info(this.model.get('jid'), null,
                            function (iq) {
                                /*
                                 * See http://xmpp.org/extensions/xep-0045.html#disco-roominfo
                                 *
                                 *  <identity
                                 *      category='conference'
                                 *      name='A Dark Cave'
                                 *      type='text'/>
                                 *  <feature var='http://jabber.org/protocol/muc'/>
                                 *  <feature var='muc_passwordprotected'/>
                                 *  <feature var='muc_hidden'/>
                                 *  <feature var='muc_temporary'/>
                                 *  <feature var='muc_open'/>
                                 *  <feature var='muc_unmoderated'/>
                                 *  <feature var='muc_nonanonymous'/>
                                 */
                                var features = {
                                    'features_fetched': true
                                };
                                _.each(iq.querySelectorAll('feature'), function (field) {
                                    var fieldname = field.getAttribute('var');
                                    if (!fieldname.startsWith('muc_')) {
                                        return;
                                    }
                                    features[fieldname.replace('muc_', '')] = true;
                                });
                                try{
                                    that.model.save(features);
                                }catch (e){
                                    //console.log(e);
                                };

                                return deferred.resolve();
                            },
                            deferred.reject
                        );
                        return deferred.promise();
                    },

                    configureChatRoom: function (ev) {
                        /* Start the process of configuring a chat room, either by
                         * rendering a configuration form, or by auto-configuring
                         * based on the "roomconfig" data stored on the
                         * Backbone.Model.
                         *
                         * Stores the new configuration on the Backbone.Model once
                         * completed.
                         *
                         * Paremeters:
                         *  (Event) ev: DOM event that might be passed in if this
                         *      method is called due to a user action. In this
                         *      case, auto-configure won't happen, regardless of
                         *      the settings.
                         */
                        var that = this;
                        if (_.isUndefined(ev) && this.model.get('auto_configure')) {
                            this.fetchRoomConfiguration().then(that.autoConfigureChatRoom.bind(that));
                        } else {
                            if (typeof ev !== 'undefined' && ev.preventDefault) {
                                ev.preventDefault();
                            }
                            this.showSpinner();
                            this.fetchRoomConfiguration().then(that.renderConfigurationForm.bind(that));
                        }
                    },

                    submitNickname: function (ev) {
                        /* Get the nickname value from the form and then join the
                         * chat room with it.
                         */
                        ev.preventDefault();
                        var $nick = this.$el.find('input[name=nick]');
                        var nick = $nick.val();
                        if (!nick) {
                            $nick.addClass('error');
                            return;
                        }
                        else {
                            $nick.removeClass('error');
                        }
                        this.$el.find('.chatroom-form-container').replaceWith('<span class="spinner centered"/>');
                        this.join(nick);
                    },

                    checkForReservedNick: function () {
                        /* User service-discovery to ask the XMPP server whether
                         * this user has a reserved nickname for this room.
                         * If so, we'll use that, otherwise we render the nickname
                         * form.
                         */
                        this.showSpinner();
                        converse.connection.sendIQ(
                            $iq({
                                'to': this.model.get('jid'),
                                'from': converse.connection.jid,
                                'type': "get"
                            }).c("query", {
                                'xmlns': Strophe.NS.DISCO_INFO,
                                'node': 'x-roomuser-item'
                            }),
                            this.onNickNameFound.bind(this),
                            this.onNickNameNotFound.bind(this)
                        );
                        return this;
                    },

                    onNickNameFound: function (iq) {
                        /* We've received an IQ response from the server which
                         * might contain the user's reserved nickname.
                         * If no nickname is found we either render a form for
                         * them to specify one, or we try to join the room with the
                         * node of the user's JID.
                         *
                         * Parameters:
                         *  (XMLElement) iq: The received IQ stanza
                         */
                        var nick = $(iq)
                            .find('query[node="x-roomuser-item"] identity')
                            .attr('name');
                        if (!nick) {
                            this.onNickNameNotFound();
                        } else {
                            this.join(nick);
                        }
                    },

                    onNickNameNotFound: function (message) {
                        if (converse.muc_nickname_from_jid) {
                            // We try to enter the room with the node part of
                            // the user's JID.
                            this.join(Strophe.unescapeNode(Strophe.getNodeFromJid(converse.bare_jid)));
                        } else {
                            this.renderNicknameForm(message);
                        }
                    },

                    getDefaultNickName: function () {
                        /* The default nickname (used when muc_nickname_from_jid is true)
                         * is the node part of the user's JID.
                         * We put this in a separate method so that it can be
                         * overridden by plugins.
                         */
                        return Strophe.unescapeNode(Strophe.getNodeFromJid(converse.bare_jid));
                    },

                    onNicknameClash: function (presence) {
                        /* When the nickname is already taken, we either render a
                         * form for the user to choose a new nickname, or we
                         * try to make the nickname unique by adding an integer to
                         * it. So john will become john-2, and then john-3 and so on.
                         *
                         * Which option is take depends on the value of
                         * muc_nickname_from_jid.
                         */
                        if (converse.muc_nickname_from_jid) {
                            var nick = presence.getAttribute('from').split('/')[1];
                            if (nick === this.getDefaultNickName()) {
                                this.join(nick + '-2');
                            } else {
                                var del= nick.lastIndexOf("-");
                                var num = nick.substring(del+1, nick.length);
                                this.join(nick.substring(0, del+1) + String(Number(num)+1));
                            }
                        } else {
                            this.renderNicknameForm(
                                __("The nickname you chose is reserved or currently in use, please choose a different one.")
                            );
                        }
                    },

                    renderNicknameForm: function (message) {
                        /* Render a form which allows the user to choose their
                         * nickname.
                         */
                        this.$('.chatroom-body').children().addClass('hidden');
                        this.$('span.centered.spinner').remove();
                        if (typeof message !== "string") {
                            message = '';
                        }
                        this.$('.chatroom-body').append(
                            converse.templates.chatroom_nickname_form({
                                heading: __('Please choose your nickname'),
                                label_nickname: __('Nickname'),
                                label_join: __('Enter room'),
                                validation_message: message
                            }));
                        this.$('.chatroom-form').on('submit', this.submitNickname.bind(this));
                    },

                    submitPassword: function (ev) {
                        ev.preventDefault();
                        var password = this.$el.find('.chatroom-form').find('input[type=password]').val();
                        this.$el.find('.chatroom-form-container').replaceWith('<span class="spinner centered"/>');
                        this.join(this.model.get('nick'), password);
                    },

                    renderPasswordForm: function () {
                        this.$('.chatroom-body').children().addClass('hidden');
                        this.$('span.centered.spinner').remove();
                        this.$('.chatroom-body').append(
                            converse.templates.chatroom_password_form({
                                heading: __('This chatroom requires a password'),
                                label_password: __('Password: '),
                                label_submit: __('Submit')
                            }));
                        this.$('.chatroom-form').on('submit', this.submitPassword.bind(this));
                    },

                    showDisconnectMessage: function (msg) {
                        this.$('.chat-area').addClass('hidden');
                        this.$('.occupants').addClass('hidden');
                        this.$('span.centered.spinner').remove();
                        this.$('.chatroom-body').append($('<p>'+msg+'</p>'));
                    },

                    getMessageFromStatus: function (stat, stanza, is_self) {
                        /* Parameters:
                         *  (XMLElement) stat: A <status> element.
                         *  (Boolean) is_self: Whether the element refers to the
                         *                     current user.
                         *  (XMLElement) stanza: The original stanza received.
                         */
                        var code = stat.getAttribute('code'),
                            from_nick;
                        if (is_self && code === "210") {
                            from_nick = Strophe.unescapeNode(Strophe.getResourceFromJid(stanza.getAttribute('from')));
                            return __(converse.muc.new_nickname_messages[code], from_nick);
                        } else if (is_self && code === "303") {
                            return __(
                                converse.muc.new_nickname_messages[code],
                                stanza.querySelector('x item').getAttribute('nick')
                            );
                        } else if (!is_self && (code in converse.muc.action_info_messages)) {
                            from_nick = Strophe.unescapeNode(Strophe.getResourceFromJid(stanza.getAttribute('from')));
                            return __(converse.muc.action_info_messages[code], from_nick);
                        } else if (code in converse.muc.info_messages) {
                            return converse.muc.info_messages[code];
                        } else if (code !== '110') {
                            if (stat.textContent) {
                                // Sometimes the status contains human readable text and not a code.
                                return stat.textContent;
                            }
                        }
                        return;
                    },

                    saveAffiliationAndRole: function (pres) {
                        /* Parse the presence stanza for the current user's
                         * affiliation.
                         *
                         * Parameters:
                         *  (XMLElement) pres: A <presence> stanza.
                         */
                        // XXX: For some inexplicable reason, the following line of
                        // code works in tests, but not with live data, even though
                        // the passed in stanza looks exactly the same to me:
                        // var item = pres.querySelector('x[xmlns="'+Strophe.NS.MUC_USER+'"] item');
                        // If we want to eventually get rid of jQuery altogether,
                        // then the Sizzle selector library might still be needed
                        // here.
                        var item = $(pres).find('x[xmlns="'+Strophe.NS.MUC_USER+'"] item').get(0);
                        if (_.isUndefined(item)) { return; }
                        var jid = item.getAttribute('jid');
                        if (Strophe.getBareJidFromJid(jid) === converse.bare_jid) {
                            var affiliation = item.getAttribute('affiliation');
                            var role = item.getAttribute('role');
                            if (affiliation) {
                                try {
                                    this.model.save({'affiliation': affiliation});
                                } catch (e) {
                                    if(converse.debug){
                                        //console.log(e);
                                    }
                                }
                            }
                            if (role) {
                                try {
                                    this.model.save({'role': role});
                                } catch (e) {
                                    if(converse.debug){
                                        //console.log(e);
                                    }
                                }
                            }
                        }
                    },

                    parseXUserElement: function (x, stanza, is_self) {
                        /* Parse the passed-in <x xmlns='http://jabber.org/protocol/muc#user'>
                         * element and construct a map containing relevant
                         * information.
                         */
                        // 1. Get notification messages based on the <status> elements.
                        var statuses = x.querySelectorAll('status');
                        var mapper = _.partial(this.getMessageFromStatus, _, stanza, is_self);
                        var notification = {
                            'messages': _.reject(_.map(statuses, mapper), _.isUndefined),
                        };
                        // 2. Get disconnection messages based on the <status> elements
                        var codes = _.map(statuses, function (stat) { return stat.getAttribute('code'); });
                        var disconnection_codes = _.intersection(codes, _.keys(converse.muc.disconnect_messages));
                        var disconnected = is_self && disconnection_codes.length > 0;
                        if (disconnected) {
                            notification.disconnected = true;
                            notification.disconnection_message = converse.muc.disconnect_messages[disconnection_codes[0]];
                        }
                        // 3. Find the reason and actor from the <item> element
                        var item = x.querySelector('item');
                        // By using querySelector above, we assume here there is
                        // one <item> per <x xmlns='http://jabber.org/protocol/muc#user'>
                        // element. This appears to be a safe assumption, since
                        // each <x/> element pertains to a single user.
                        if (!_.isNull(item)) {
                            var reason = item.querySelector('reason');
                            if (reason) {
                                notification.reason = reason ? reason.textContent : undefined;
                            }
                            var actor = item.querySelector('actor');
                            if (actor) {
                                notification.actor = actor ? actor.getAttribute('nick') : undefined;
                            }
                        }
                        return notification;
                    },

                    displayNotificationsforUser: function (notification) {
                        /* Given the notification object generated by
                         * parseXUserElement, display any relevant messages and
                         * information to the user.
                         */
                        var that = this;
                        if (notification.disconnected) {
                            this.showDisconnectMessage(notification.disconnection_message);
                            if (notification.actor) {
                                this.showDisconnectMessage(__(___('This action was done by <strong>%1$s</strong>.'), notification.actor));
                            }
                            if (notification.reason) {
                                this.showDisconnectMessage(__(___('The reason given is: <em>"%1$s"</em>.'), notification.reason));
                            }
                            this.model.save('connection_status', Strophe.Status.DISCONNECTED);
                            return;
                        }
                        _.each(notification.messages, function (message) {
                            that.$content.append(converse.templates.info({'message': message}));
                        });
                        if (notification.reason) {
                            this.showStatusNotification(__('The reason given is: "'+notification.reason+'"'), true);
                        }
                        if (notification.messages.length) {
                            this.scrollDown();
                        }
                    },

                    showStatusMessages: function (stanza, is_self) {
                        /* Check for status codes and communicate their purpose to the user.
                         * See: http://xmpp.org/registrar/mucstatus.html
                         *
                         * Parameters:
                         *  (XMLElement) stanza: The message or presence stanza
                         *      containing the status codes.
                         */
                        var is_self = stanza.querySelectorAll("status[code='110']").length;

                        // Unfortunately this doesn't work (returns empty list)
                        // var elements = stanza.querySelectorAll('x[xmlns="'+Strophe.NS.MUC_USER+'"]');
                        var elements = _.chain(stanza.querySelectorAll('x')).filter(function (x) {
                            return x.getAttribute('xmlns') === Strophe.NS.MUC_USER;
                        }).value();

                        var notifications = _.map(
                            elements,
                            _.partial(this.parseXUserElement.bind(this), _, stanza, is_self)
                        );
                        _.each(notifications, this.displayNotificationsforUser.bind(this));
                        return stanza;
                    },

                    showErrorMessage: function (presence) {
                        // We didn't enter the room, so we must remove it from the MUC
                        // add-on
                        var $error = $(presence).find('error');
                        if ($error.attr('type') === 'auth') {
                            if ($error.find('not-authorized').length) {
                                //this.renderPasswordForm();
                                var jid = this.model.get('jid'),
                                    id = Strophe.getNodeFromJid(jid),
                                    room = converse.roomInfo(id),
                                    user_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                                converse_api.rooms.close(jid);
                                if(room){
                                    var obj = {nick:user_jid,name:room.name};
                                    converse_api.rooms.open(jid);
                                }
                            } else if ($error.find('registration-required').length) {
                                this.showDisconnectMessage(__('You are not on the member list of this room'));
                            } else if ($error.find('forbidden').length) {
                                this.showDisconnectMessage(__('You have been banned from this room'));
                            }
                        } else if ($error.attr('type') === 'modify') {
                            if ($error.find('jid-malformed').length) {
                                this.showDisconnectMessage(__('No nickname was specified'));
                            }
                        } else if ($error.attr('type') === 'cancel') {
                            if ($error.find('not-allowed').length) {
                                this.showDisconnectMessage(__('You are not allowed to create new rooms'));
                            } else if ($error.find('not-acceptable').length) {
                                this.showDisconnectMessage(__("Your nickname doesn't conform to this room's policies"));
                            } else if ($error.find('conflict').length) {
                                this.onNicknameClash(presence);
                            } else if ($error.find('item-not-found').length) {
                                //判断是否是群主或者群成员
                                var jid = this.model.get('jid'),
                                    id = Strophe.getNodeFromJid(jid),
                                    room = converse.roomInfo(id),
                                    user_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                                //删除列表中的房间
                                $('#chatrooms #available-chatrooms dd.available-chatroom').each(function(index,element){
                                    var a_btn =$(element).find('a');
                                    var item_jid = a_btn.attr('data-room-jid');
                                    if(jid === item_jid){
                                        $(element).remove();
                                    }
                                });

                                if(room){
                                    //删除imapi中房间信息
                                    if(user_jid === room.userId){
                                        var result_json = $.ajax({
                                            url: converse.imapi_url+converse.imapi_room_delete,
                                            data:{roomJid:id, access_token:converse.access_token},
                                            async: false
                                        }).responseText;
                                        //var result = JSON.parse(result_json);
                                    } else {
                                        var result_json = $.ajax({
                                            url: converse.imapi_url+converse.imapi_room_member_delete,
                                            data:{roomJid:id, access_token:converse.access_token, userId:user_jid},
                                            async: false
                                        }).responseText;
                                        //var result = JSON.parse(result_json);
                                    }

                                    //在变量中删除
                                    var room_list = converse.muc_room_list;
                                    if(room_list && room_list.length > 0){
                                        for(var r=0;r<room_list.length;r++){
                                            if(id === room_list[r].jid){
                                                room_list.splice(r,1);
                                                break;
                                            }
                                        }
                                    }
                                }

                                this.showDisconnectMessage(__("This room does not (yet) exist"));
                            } else if ($error.find('service-unavailable').length) {
                                this.showDisconnectMessage(__("This room has reached its maximum number of occupants"));
                            }
                        }
                    },

                    showSpinner: function () {
                        this.$('.chatroom-body').children().addClass('hidden');
                        this.$el.find('.chatroom-body').prepend('<span class="spinner centered"/>');
                    },

                    hideSpinner: function () {
                        /* Check if the spinner is being shown and if so, hide it.
                         * Also make sure then that the chat area and occupants
                         * list are both visible.
                         */
                        var that = this;
                        var $spinner = this.$el.find('.spinner');
                        if ($spinner.length) {
                            $spinner.hide(function () {
                                $(this).remove();
                                that.$el.find('.chat-area').removeClass('hidden');
                                that.$el.find('.occupants').removeClass('hidden');
                                that.scrollDown();
                            });
                        }
                        return this;
                    },

                    createInstantRoom: function () {
                        /* Sends an empty IQ config stanza to inform the server that the
                         * room should be created with its default configuration.
                         *
                         * See http://xmpp.org/extensions/xep-0045.html#createroom-instant
                         */
                        try {
                            this.sendConfiguration().then(this.getRoomFeatures.bind(this));
                        } catch (e) {
                            if(converse.debug){
                                console.log(e);
                            }
                        }
                    },

                    onChatRoomPresence: function (pres) {
                        /* Handles all MUC presence stanzas.
                         *
                         * Parameters:
                         *  (XMLElement) pres: The stanza
                         */
                        if (pres.getAttribute('type') === 'error') {
                            this.model.save('connection_status', Strophe.Status.DISCONNECTED);
                            this.showErrorMessage(pres);
                            return true;
                        }
                        var show_status_messages = true;
                        var is_self = pres.querySelector("status[code='110']");
                        var new_room = pres.querySelector("status[code='201']");

                        var kicked_room = pres.querySelector("status[code='307']");
                        if(kicked_room){
                            var items = pres.querySelector("item");

                            if(items){
                                //var nick = items.attr('nick');
                                var nick = items.attributes.nick.value;

                                var jid = this.model.get('jid'),
                                    id = Strophe.getNodeFromJid(jid),
                                    user_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                                    is_Exist = false;

                                if(user_jid === nick){
                                    var room_list = converse.muc_room_list;
                                    if(room_list && room_list.length > 0){
                                        for(var r=0;r<room_list.length;r++){
                                            if(id === room_list[r].jid){
                                                is_Exist = true;
                                                break;
                                            }
                                        }
                                    }
                                    if(is_Exist){
                                        converse.localRoomDel(id);
                                    }
                                    return true;
                                }
                            }
                        }

                        if (is_self) {
                            this.saveAffiliationAndRole(pres);
                        }
                        if (is_self && new_room) {
                            // This is a new room. It will now be configured
                            // and the configuration cached on the
                            // Backbone.Model.
                            if (converse.muc_instant_rooms) {
                                this.createInstantRoom(); // Accept default configuration
                            } else {
                                this.configureChatRoom();
                                if (!this.model.get('auto_configure')) {
                                    // We don't show status messages if the
                                    // configuration form is being shown.
                                    show_status_messages = false;
                                }
                            }
                        } else if (!this.model.get('features_fetched') &&
                            this.model.get('connection_status') !== Strophe.Status.CONNECTED) {
                            // The features for this room weren't fetched yet, perhaps
                            // because it's a new room without locking (in which
                            // case Prosody doesn't send a 201 status).
                            // This is the first presence received for the room, so
                            // a good time to fetch the features.
                            this.getRoomFeatures();
                        }
                        if (show_status_messages) {
                            //this.hideSpinner().showStatusMessages(pres);
                        }
                        this.occupantsview.updateOccupantsOnPresence(pres);
                        if (this.model.get('role') !== 'none') {
                            try {
                                this.model.save('connection_status', Strophe.Status.CONNECTED);
                            } catch (e) {
                                if(converse.debug){
                                    //console.log(e);
                                }
                            }
                        }
                        return true;
                    },

                    setChatRoomSubject: function (sender, subject) {
                        this.$el.find('.chatroom-topic').text(subject).attr('title', subject);
                        // For translators: the %1$s and %2$s parts will get replaced by the user and topic text respectively
                        // Example: Topic set by JC Brand to: Hello World!
                        this.$content.append(
                            converse.templates.info({
                                'message': __('Topic set by %1$s to: %2$s', sender, subject)
                            }));
                        this.scrollDown();
                    },

                    onChatRoomMessage: function (msg) {
                        /* Given a <message> stanza, create a message
                         * Backbone.Model if appropriate.
                         *
                         * Parameters:
                         *  (XMLElement) msg: The received message stanza
                         */
                        var $message = $(msg),
                            $forwarded = $message.find('forwarded'),
                            $delay;
                        if ($forwarded.length) {
                            $message = $forwarded.children('message');
                            $delay = $forwarded.children('delay');
                        }
                        var jid = msg.getAttribute('from'),
                            msgid = msg.getAttribute('id'),
                            id = $message.id,
                            body = $message.children('body'),
                            $message_x = $message.children('x'),
                            resource = Strophe.getResourceFromJid(jid),
                            sender = resource && Strophe.unescapeNode(resource) || '',
                            subject = $message.children('subject').text();

                        var msg_content = $message[0].textContent;
                        if(msg_content && body.length > 0 && $message_x.length === 0){
                            try{
                                var message_content = JSON.parse(msg_content);

                                if(message_content && message_content.type){
                                    if(message_content.type === 601){
                                        var c_jid = Strophe.getBareJidFromJid(jid);
                                        //将内容在session中更改
                                        if(this.model && this.model.messages && this.model.messages.models && this.model.messages.models.length > 0){
                                            for(var i = 0; i < this.model.messages.models.length; i++){
                                                var session_msg = this.model.messages.models[i];
                                                if(session_msg.attributes && session_msg.attributes.msgid === message_content.objectId) {
                                                    var msg_attr = session_msg.attributes;
                                                    this.model.messages.remove(msg_attr);

                                                    if (this.model.messages.browserStorage && this.model.messages.browserStorage.name) {
                                                        window.sessionStorage.removeItem(this.model.messages.browserStorage.name + "-" + msg_attr.id);
                                                    }
                                                    break;
                                                }
                                            }
                                        }

                                        //将显示的内容删除
                                        var view = converse.chatboxviews.get(c_jid);
                                        if(view){
                                            var msg_list = view.$el.find('.chat-content .chat-message');
                                            if(msg_list && msg_list.length > 0){
                                                msg_list.each(function (index, e) {
                                                    var mid = $(e).attr('data-msgid');
                                                    if(mid === message_content.objectId){
                                                        $(e).remove();
                                                    }
                                                });
                                            }
                                        }

                                        if(converse.msg_list && converse.msg_list.length > 0){
                                            for(var i=0;i<converse.msg_list.length;i++){
                                                if(converse.msg_list[i].msgid === msgid){
                                                    converse.msg_list.splice(i, 1);
                                                }
                                            }
                                        }
                                    }
                                }
                            }catch (e){

                            }

                        }

                        var dupes = msgid && this.model.messages.filter(function (msg) {
                                // Find duplicates.
                                // Some bots (like HAL in the prosody chatroom)
                                // respond to commands with the same ID as the
                                // original message. So we also check the sender.
                                //return msg.get('msgid') === msgid && msg.get('fullname') === sender;
                                return msg.get('msgid') === msgid;
                            });

                        if (dupes && dupes.length) {
                            return true;
                        }
                        if (subject) {
                            this.setChatRoomSubject(sender, subject);
                        }
                        if (sender === '') {
                            return true;
                        }
                        this.model.createMessage($message, $delay, msg);
                        if (sender !== this.model.get('nick')) {
                            // We only emit an event if it's not our own message
                            converse.emit('message', msg);


                            if (msgid && body.length > 0 && $message_x.length === 0) {
                                this.messageToRemind(this.model.get('jid'), msgid, msg_content);
                            }
                        }

                        if(converse.default_form) {
                            if (msgid && body.length > 0 && sender === this.model.get('nick') && $message_x.length === 0) {
                                this.messageToRemind(this.model.get('jid'), msgid, msg_content);
                            }
                        }
                        return true;
                    },

                    fetchArchivedMessages: function (options) {
                        /* Fetch archived chat messages from the XMPP server.
                         *
                         * Then, upon receiving them, call onChatRoomMessage
                         * so that they are displayed inside it.
                         */
                        var that = this;
                        if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                            converse.log("Attempted to fetch archived messages but this user's server doesn't support XEP-0313");
                            return;
                        }
                        this.addSpinner();
                        converse_api.archive.query(_.extend(options, {'groupchat': true}),
                            function (messages) {
                                that.clearSpinner();
                                if (messages.length) {
                                    _.map(messages, that.onChatRoomMessage.bind(that));
                                }
                            },
                            function () {
                                that.clearSpinner();
                                converse.log("Error while trying to fetch archived messages", "error");
                            }
                        );
                    },

                    //新添加的方法
                    messageToRemind: function (jid, msgid, content) {
                        var user_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                        var id = Strophe.getNodeFromJid(jid),
                            room = converse.roomInfo(id),
                            msg_content = {};
                        try{
                            msg_content = JSON.parse(content);
                        }catch(e){
                            //cgh7569
                            msg_content = {};
                        }
                        if(msg_content && msg_content.type){
                            if(msg_content.type === 930 || msg_content.type === 924 || msg_content.type === 931 || msg_content.type === 903){
                                return;
                            }
                        }

                        if (room) {
                            var room_name = room.name;
                            var obj = {nick: user_jid, name: room_name};

                            if(id.indexOf('online')>=0){
                                //在线客服房间判断是否是当时会话,如是历史会话不改变当前状态
                                $('#conversejs #officials .officials-content .officials-room-item-list dd').each(function(index, element){
                                    var a = $(element).find('a'),
                                        a_jid = a.attr('data-room-jid');

                                    if(a_jid === jid){
                                        obj.isHistory = false;
                                    }
                                });
                            }

                            var room_model = converse_api.rooms.get(jid, obj);

                            var isMsgListExist = false;
                            if(converse.msg_list && converse.msg_list.length > 0){
                                for(var i=0;i<converse.msg_list.length;i++){
                                    if(converse.msg_list[i].msgid === msgid){
                                        isMsgListExist = true;
                                    }
                                }
                            }

                            if(!isMsgListExist) {
                                converse.msg_list[converse.msg_list.length] = {msgid: msgid, roomJid: jid};

                                if (!room_model) {

                                    if (converse.default_form) {

                                        //查看列表中是否有此房间，如果没有则添加
                                        //converse.add_room_list(room);
                                        converse_api.rooms.open(jid, obj);

                                    } else {

                                        if (id.indexOf('online') >= 0) {

                                            converse.editOfficialList(jid, room_name, room.id);
                                        } else {
                                            var isExist = false;
                                            $('#conversejs #converse-controlbox-official-rooms .rosterview-room-group-item ').each(function (index, element) {
                                                var a_btn = $(element).find('a');
                                                var room_jid = a_btn.attr('data-room-jid');
                                                if (room_jid === jid) {
                                                    isExist = true;
                                                }
                                            });
                                            if (!isExist) {
                                                var title_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + room.id + '&type=t&access_token=' + converse.access_token;
                                                $('#conversejs #converse-controlbox-official-rooms .rosterview-room-item-list').prepend(
                                                    converse.templates.rosterview_room_item({
                                                        'room_name': room_name,
                                                        'jid_id': jid,
                                                        'open_title': __('Click to open this online service'),
                                                        'title_url': title_url,
                                                        'default_img': converse.emoticons_file_path + converse.room_default_img
                                                    }));
                                            }
                                        }
                                        var num = msg_content && msg_content.type && msg_content.type === 601 ? 0 : 1;
                                        converse_api.chatlist.add(jid, 'groupchat', num === 0 ? false : true, num, true);

                                    }
                                } else {
                                    if (converse.allow_chatlist) {
                                        converse_api.chatlist.first(jid, 'groupchat');

                                        if ($(converse.parent_box_id).is(":hidden")) {
                                            if(!(msg_content && msg_content.type && msg_content.type === 601)){
                                                converse.updateMinBoxTip(jid, 'groupchat');
                                            }

                                        }
                                    }
                                }

                                if (converse.allow_chatlist) {
                                    //update list item msg
                                    converse_api.chatlist.updateItemMsg(jid, content, 'groupchat');
                                }
                            }
                        }
                    },

                    closeRoom: function (_this, id, jid){
                        //判断是否是房间的所有者
                        var user_id = id.split('_')[2],
                            official_id = id.split('_')[1],
                            c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                            room_info = converse.roomInfo(id);

                        //客户
                        if(user_id === c_jid){
                            var official_data = converse.officialInfo(official_id);
                            converse.last_online_service = {name:official_data.officialName, id:official_data.officialId, time:new Date().getTime()};
                            //cgh
                            converse.addHistoryRoom(jid);
                            //调用imapi接口删除房间
                            var result_json = $.ajax({
                                url: converse.imapi_url+converse.imapi_session_del,
                                type: 'POST',
                                data:{officialId:official_id,access_token:converse.access_token},
                                async: false
                            }).responseText;
                            var result = JSON.parse(result_json);
                            if(result && result.resultCode && result.resultCode == 1){

                            }
                        }else if (c_jid != official_id){
                            //客服退出
                            if(room_info && room_info.createUserId && Number(room_info.createUserId) === Number(c_jid)){
                                var official_data = converse.officialInfo(official_id);
                                converse.last_online_service = {name:official_data.officialName, id:official_data.officialId, time:new Date().getTime()};

                                //调用imapi接口删除房间
                                var result_json = $.ajax({
                                    url: converse.imapi_url+converse.imapi_session_del,
                                    data:{officialId:official_id,access_token:converse.access_token, userId: user_id},
                                    async: false
                                }).responseText;
                                var result = JSON.parse(result_json);
                                if(result && result.resultCode && result.resultCode == 1){

                                }
                            } else {
                                try{

                                    var agent_available_json = $.ajax({
                                        url: converse.imapi_url+converse.imapi_agent_available,
                                        data:{officialId:official_id,access_token:converse.access_token},
                                        async: false
                                    }).responseText;
                                    var agent_available_result = JSON.parse(agent_available_json);
                                    if(agent_available_result && agent_available_result.resultCode && agent_available_result.resultCode == 1 && agent_available_result.data && agent_available_result.data.count > 0){
                                        //发送消息
                                        var msg_text = '{"content":"客服['+converse.nick_name+']退出服务","objectId":"' + id + '","fromUserId":"'+c_jid+'","fromUserName":"'+converse.nick_name+'","timeSend":'+parseInt(moment() / 1000)+',"type":924}';
                                        var msgid = converse.connection.getUniqueId();
                                        converse.sendRoomMsg(_this.model.get('jid'), msgid, msg_text);
                                        _this.model.messages.create({
                                            fullname: _this.model.get('nick'),
                                            sender: 'me',
                                            time: moment().format(),
                                            message: msg_text,
                                            msgid: msgid
                                        });

                                        var result_json = $.ajax({
                                            url: converse.imapi_url+converse.imapi_room_member_delete,
                                            data:{roomJid:id,access_token:converse.access_token,userId:c_jid},
                                            async: false
                                        }).responseText;
                                        var result = JSON.parse(result_json);
                                        if(result && result.resultCode && result.resultCode == 1){

                                        } else {
                                            if(converse.new_modal){
                                                $.dialog('alert',__('prompt'),__('Close session error'),0);
                                            }else{
                                                alert(__('Close session error'));
                                            }
                                            return;
                                        }
                                    }else{
                                        if(converse.new_modal){
                                            $.dialog('alert',__('prompt'),__('No available customer service,can not quit'),0);
                                        }else{
                                            alert(__('No available customer service,can not quit'));
                                        }
                                        return;
                                    }

                                }catch (e){
                                    if(converse.new_modal){
                                        $.dialog('alert',__('prompt'),__('Close session error'),0);
                                    }else{
                                        alert(__('Close session error'));
                                    }
                                    console.log(e);
                                    return;
                                };
                            }

                        }

                        _this.$content.empty();
                        _this.model.messages.reset();
                        _this.model.messages.browserStorage._clear();
                        _this.leave();

                        converse.ChatBoxView.prototype.close.apply(_this, arguments);

                        //房间列表中去掉此房间信息
                        $('#conversejs #officials #converse-official-list .officials-room-item-list .official-room-group-item').each(function(index,element){
                            var a_btn =$(element).find('a');
                            var room_jid = a_btn.attr('data-room-jid');
                            if(room_jid === jid){
                                $(element).remove();
                            }
                        });

                        if(converse.allow_chatlist){
			    console.error("删除会话列表记录");
                            converse_api.chatlist.deleteitem(jid);
                        }

                        //删除在变量中的信息
                        _this.delete_room_list(id);

                        //客服弹出评价窗口
                        if(converse.default_form){
                            if(user_id === c_jid){
                                //查找是否存在过弹出框，如果存在过，删除
                                var message_html = $('body #converse-evaluation-div');
                                if(message_html.length > 0 ){
                                    message_html.remove();
                                }
                                var html = converse.templates.evaluation_form({
                                    'room_jid': id,
                                    'token': converse.access_token,
                                    'start_time':room_info.createTime
                                });
                                $("body").append(html);
                                $('.converse-evaluation-'+id).find('.converse-room-evaluation-subBtn').on('click', this.saveOnlineServiceEvaluation.bind(this));
                                $('.converse-evaluation-'+id).find('.converse-room-evaluation-canBtn').on('click', this.cancelOnlineServiceEvaluation.bind(this));

                                $('#HBox-'+id).hDialog({'box':'#HBox-'+id,isOverlay: false,width:300,height: 500,title:'感谢您的支持',autoShow: true});
                                var radio = $('.converse-evaluation-'+id).find("input[type='radio'][name='level'][value='1']");
                                radio.prop('checked',true);
                            }
                        }else{
                            if(user_id === c_jid){
                                //查找是否存在过弹出框，如果存在过，删除
                                var message_html = $('#conversejs #converse-evaluation-div');
                                if(message_html.length > 0 ){
                                    message_html.remove();
                                }
                                var html = converse.templates.evaluation_f({
                                    'room_jid': id,
                                    'token': converse.access_token,
                                    'start_time':room_info.createTime
                                });
                                $("#conversejs").append(html);
                                $('.converse-evaluation-'+id).find('.converse-room-evaluation-subBtn').on('click', this.saveOnlineServiceEvaluation.bind(this));
                                $('.converse-evaluation-'+id).find('.converse-room-evaluation-canBtn').on('click', this.cancelOnlineServiceEvaluation.bind(this));

                                $('#HBox-'+id).hDialog({'box':'#HBox-'+id,isOverlay: false,width:300,height: 500,title:'感谢您的支持',autoShow: true});
                                var radio = $('.converse-evaluation-'+id).find("input[type='radio'][name='level'][value='1']");
                                radio.prop('checked',true);
                            }
                        }
                    },

                    mucHistoryQuery: function (ev) {
                        var jid = $(ev.target).attr('jid'),
                            $parent = $(ev.target).parent().parent(),
                            $chat_message = $parent.find('.chat-message:first'),
                            $message_list = $parent.find('.chat-message'),
                            c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                        var data = {room_jid_id:jid, access_token:converse.access_token, pageIndex:0, pageSize:converse.message_pagesize};
                        if($chat_message.length > 0){
                            //data.endTime = new Date(moment($chat_message.attr('data-isodate')).format()).getTime();
                            data.endTime = $chat_message.attr('data-send-time');
                        } else {
                            data.endTime = new Date().getTime();
                        }
                        if($chat_message){
                            $chat_message.addClass('historyQuery').siblings().removeClass('historyQuery');
                        }

                        var result_json = $.ajax({
                            url: converse.imapi_url+converse.imapi_room_message,
                            data:data,
                            async: false
                        }).responseText;
                        var result = JSON.parse(result_json);
                        if(result && result.resultCode && result.resultCode == 1 && result.data){
                            result.data.sort(function(a, b){
                                return a.ts - b.ts;
                            });
                            //获取已存在消息标记集合
                            var chat_msgid = [];
                            if($message_list.length >0) {
                                $message_list.each(function (index, e) {
                                    var mid = $(e).attr('data-msgid');
                                    if ($.inArray(mid, chat_msgid) > -1) {
                                        isExist = true;
                                    } else {
                                        chat_msgid[chat_msgid.length] = mid;
                                    }
                                });
                            }
                            var isFirstSearch = chat_msgid.length===0?true:false;
                            for(var i=0;i<result.data.length;i++){
                                var time = moment(result.data[i].ts).format(),
                                    nick = result.data[i].fromUserName,
                                    sender = result.data[i].sender=== Number(c_jid)? 'me' : 'them',
                                    text = JSON.stringify(result.data[i]),
                                    msgid = result.data[i].packetId,
                                    isExist = false;

                                if($.inArray(msgid, chat_msgid)>-1){
                                    isExist = true;
                                }else {
                                    chat_msgid[chat_msgid.length] = msgid;
                                }

                                if(!isExist && result.data[i].content){
                                    if(result.data[i].type != 601 || (result.data[i].type === 601 && result.data[i].objectId)){
                                        this.model.messages.create({
                                            fullname: nick,
                                            sender: sender,
                                            time: time,
                                            message: text,
                                            msgid: msgid,
                                            archive_id: true,
                                            type: 'groupchat'
                                        });
                                    }
                                }
                            }

                            $(ev.target).parent().remove();
                            if(result.data.length === converse.message_pagesize){
                                this.showSystemHtmlNotificationPrepend('<a class="converse_history_query" jid="'+jid+'">历史记录查看</a>',true);
                            }
                            if($chat_message) {
                                if(!isFirstSearch){
                                    var h = 0;
                                    if(document.querySelector('.chat-content').querySelector(".historyQuery")){
                                        h = document.querySelector('.chat-content').querySelector(".historyQuery").offsetTop;
                                    }
                                    if(h!==0){
                                        if(h>10){//为了显示美观
                                            h = h-10;
                                        }
                                        document.querySelector('.chat-content').scrollTop = h;
                                    }
                                }

                            }
                        }
                    },
                    cancelOnlineServiceEvaluation: function (ev) {
                        var canBtn = $(ev.target).parents('#converse-room-evaluation').parent();
                        canBtn.remove();
                    },

                    saveOnlineServiceEvaluation: function (ev) {
                        var $form, start_time;
                        if(converse.default_form){
                            $form = $(ev.target).parents('#converse-room-evaluation');
                        } else {
                            $form = $(ev.target).parents('#converse-room-evaluation');
                            //cgh 使用helpdesk 的客服评价 $form = $(ev.target).parent();
                        }

                        if($form && $form.length > 0){
                            var jid = $form.find('input[name="jid"]').val(),
                                level = $form.find('input[name="level"]:checked').val(),
                                description = $form.find('.converse-evaluation-description').val(),
                                start_time = $form.find('input[name="startTime"]').val();


                            if(description.length > 255){
                                $form.find('.converse-evaluation-description-title span').text(__("Can't enter more than 255 characters"));
                                return;
                            } else {
                                $form.find('.converse-evaluation-description-title span').text("");
                            }

                            $.post(converse.imapi_url + converse.imapi_online_evaluation, {
                                access_token: converse.access_token,
                                jid: jid,
                                level: level,
                                description:description,
                                startTime:start_time
                            });
                        }
                        if(converse.default_form) {
                            $form.parent().remove();
                        } else {
                            $form.parent().remove();
                            //this.$el.find('.evaluate-form').slideToggle(200);
                        }
                    },
                    callClickTextArea: function (ev){
                        var jid = this.model.get("jid");
                        var btn = COM1.repeat1("initPastImg-"+jid);
                        if(btn){//初始化
                            converse_api.rooms.pastImg(jid,"groupchat",0);
                        }

                    },
                    chatDownImg: function (ev){
                        var img_path = $(ev.target).attr('u'),
                            down_type = $(ev.target).attr('down-type');

                        var urlpath ;
                        if(down_type === 'url'){
                            urlpath = $(ev.target).attr('url');
                        } else {
                            urlpath = converse.imapi_url + converse.imapi_download+ "?fileName=" + img_path + "&flag=2&type=o&access_token="+converse.access_token;
                        }

                        var pic = window.open(urlpath, "fileDown");
                        pic.document.execCommand("SaveAs");
                    },

                    isPermit: function(userObj,roleName){
                        if(userObj){
                            var hasCreate = false;
                            if(userObj.roles&&userObj.roles.length>0){
                                for(var i= 0,len=userObj.roles.length;i<len;i++) {
                                    if (userObj.roles[i]["name"] === 'admin' || userObj.roles[i]["name"] === roleName) {
                                        hasCreate = true;
                                        break;
                                    }
                                }
                            }
                            if(hasCreate){
                                return true;
                            }
                            if(userObj.groups && userObj.groups.length>0){
                                for(var i= 0,len=userObj.groups.length;i<len;i++) {
                                    var roless = userObj.groups[i]["roles"];
                                    if(roless && roless.length>0){
                                        for(var j= 0,len=roless.length;j<len;j++) {
                                            if(roless[j]["name"] === 'admin' || roless[j]["name"] === roleName){
                                                hasCreate = true;
                                                break;
                                            }
                                        }
                                    }
                                    if(hasCreate){
                                        break;
                                    }
                                }
                                if(hasCreate){
                                    return true;
                                }
                            }
                        }
                        return false;
                    },

                    hasCreateDeskByAgent:function(){
                        //判断客服是否有新建工单的权限
                        var userInfo = converse.userObj;
                        if(!userInfo){
                            return false;
                        }
                        var categoryInstance = converse.categoryRole;
                        if(!categoryInstance){
                            return false;
                        }
                        if (categoryInstance.children && categoryInstance.children.length > 0) {
                            var hasCreate = false;
                            for(var i= 0,len=categoryInstance.children.length;i<len;i++){
                                if ('serviceDeskCreateButton' == categoryInstance.children[i].name){
                                    var  roles = categoryInstance.children[i]['roles'];
                                    if(roles && roles.length && roles.length>0){
                                        for(var i= 0,len=roles.length;i<len;i++){
                                            if(this.isPermit(userInfo,roles[i])){
                                                hasCreate = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if(hasCreate){
                                    break;
                                }
                            }
                            return hasCreate;
                        }
                        return false;
                    },

                    createDesk: function (ev) {
                        var jid = this.model.get('jid'),
                            im_room_jid = Strophe.getNodeFromJid(jid);
                        if(im_room_jid.indexOf('online')>=0){
                            //判断是否是房间的所有者
                            var user_id = im_room_jid.split('_')[2],
                                official_id = im_room_jid.split('_')[1],
                                c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                                room = converse.roomInfo(im_room_jid);

                            if(room){
                                if(c_jid != user_id && c_jid != official_id){
                                    //客服
                                    if(!this.hasCreateDeskByAgent()){
                                        alert(__(' Sorry,without permission '));
                                        return false;
                                    }
                                    //查询用户信息
                                    var user = converse.imapiUser(user_id);
                                    var url = converse.itsnow_request_type + '://' + converse.account_name + converse.itsnow_url + ".itsnow.com" + converse.itsnow_platform + converse.itsnow_create_desk_agent + "&sessionId=" + room.id + "&serviceCatalogue=serviceOrder";
                                    if(user){
                                        url = url +"&sessionAccount=" + user.username + "&sessionPassportId=" + user.userId;
                                    }
                                    //var url =  converse.itsnow_create_desk_agent;
                                    //window.open(url, "_self");
                                    window.open(url,"_blank");
                                }else{
                                    //客户
                                    var official_info =  converse.officialInfo(official_id);

                                    if(official_info && official_info.domain){

                                        var domain = official_info.domain;
                                        var url = converse.itsnow_request_type + '://' + domain + converse.itsnow_url + ".itsnow.com" +  converse.itsnow_create_desk + "?sessionId=" + room.id;
                                        //window.open(url, "_self");
                                        window.open(url,"_blank");
                                    }else{
                                        if(converse.new_modal){
                                            $.dialog('alert',__('prompt'),__('This room does not (yet) exist'),0);
                                        }else{
                                            alert(__('This room does not (yet) exist'));
                                        }
                                    }
                                }
                            } else {
                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__('An error occurred'),0);
                                }else{
                                    alert(__('An error occurred'));
                                }
                            }
                        }
                    },

                    configureMemberChatRoom: function (ev) {
                        if (typeof ev !== 'undefined' && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        if (this.$el.find('div.chatroom-form-container').length) {
                            return;
                        }

                        var $btn_parent = $(ev.target).parent(),
                            title_div = $btn_parent.find('.chat-title'),
                            name = $.trim(title_div.text()),
                            jid = this.model.get('jid'),
                            room_jid = Strophe.getNodeFromJid(jid),
                            room = converse.imRoomInfo(room_jid);

                        this.$('.chatroom-body').children().addClass('hidden');
                        if(room){
                            var room_name = converse.htmlEncode(room.name);
                            this.$('.chatroom-body').append(converse.templates.chatroom_member_form({
                                'room_name': room_name
                            }));
                        }

                        var $form = this.$el.find('form.chatroom-form'),
                            $fieldset = $form.children('fieldset:first'),
                            notices = '暂无公告';

                        //群创建时间及群创建人
                        if(room){
                            var room_time_html = '<div class="col-xs-8">' +

                                '<div class="col-xs-2">创建人:</div>' +
                                '<div class="col-xs-10">'+room.nickname+'</div>' +
                                '</div>' +

                                '<div class="col-xs-4">' +

                                '<div class="col-xs-4">创建时间:</div>' +
                                '<div class="col-xs-8"> '+converse.longToDate1(room.createTime*1000)+'</div>' +

                                '</div>';
                            var $room_div = $fieldset.find('.room-name-body');
                            $room_div.append(room_time_html);
                        }

                        //增加添加群成员模块
                        var friends_list = converse.friends_list,
                            colleagues_list = converse.colleagues_list,
                            add_friend_html,
                            member_list = new Array();

                        add_friend_html = '<div class="panel panel-default add-room-member-list " style="display: none;"><div class="panel-heading" style="border-radius: 0px;color: #838383"><h3 class="panel-title" style="padding: 6px">选择用户</h3></div><div class="panel-body" style="padding: 6px;background: #fcfcfc;border: 1px solid #f5f5f5">';
                        if(friends_list && friends_list.length > 0){
                            for (var i = 0; i < friends_list.length; i++) {
                                member_list[member_list.length] = friends_list[i];

                                /*
                                 add_friend_html += '<div class="col-xs-3 double-listbox3" style="margin: 3px;max-width: 154px;">' + '<input type="checkbox" id="' + data.userId + '" value="' + data.userId + '">' + '<label style="margin: 0px;text-align: center" class="list-rowC" for="' + data.userId + '"> '+ data.nickname +'</label>' + '</input>' + '</div>';
                                 */
                            }
                        }
                        if(colleagues_list && colleagues_list.length > 0){
                            for (var i = 0; i < colleagues_list.length; i++) {
                                member_list[member_list.length] = colleagues_list[i];
                                /*
                                 var data = colleagues_list[i];
                                 add_friend_html += '<div class="col-xs-3 double-listbox3" style="margin: 3px;max-width: 154px;">' +  '<input type="checkbox" id="' + data.userId + '"  value="' + data.userId + '">' + '<label style="margin: 0px;text-align: center" class="list-rowC"  for="' + data.userId + '"> '+ data.nickname +'</label>' + '</input>' + '</div>';
                                 */
                            }
                        }

                        //查看是否在成员列表中，如果不在则进行显示
                        if(member_list && member_list.length > 0){
                            for(var i=0;i<member_list.length;i++){
                                var isExist = false,
                                    data = member_list[i];
                                if(room && room.members) {
                                    for (var m = 0; m < room.members.length; m++) {
                                        if(room.members[m].userId === data.userId){
                                            isExist = true;
                                        }
                                    }
                                }
                                if(!isExist){
                                    add_friend_html += '<div class="col-xs-3 double-listbox3" style="margin: 3px;max-width: 154px;">' +  '<input type="checkbox" id="' + data.userId + '"  value="' + data.userId + '">' + '<label style="margin: 0px;text-align: center" class="list-rowC"  for="' + data.userId + '"> '+ data.nickname +'</label>' + '</input>' + '</div>';
                                }
                            }
                        }

                        add_friend_html += '<button class="btn btn-info save-add-room-members"><a class="icon-checkmark" href="#" style="color:#1495ff;" title="添加"></a></button></div></div>';
                        $fieldset.prepend(add_friend_html);

                        if(room && room.notice ){
                            notices = room.notice;
                        }

                        //构建群成员信息
                        var options = "",
                            user_id = Number(Strophe.getNodeFromJid(converse.jid));
                        if(room && room.members){
                            for(var m=0;m<room.members.length;m++){
                                options += '<div class="col-xs-3" style="padding-right: 3px;padding-bottom: 3px"><div class="input-group"><div style="background: #eee" class="input-group-addon" title="'+room.members[m].nickname+'" user="'+room.members[m].userId+'">'+room.members[m].nickname+'</div>';
                                //if(room.members[m].userId != user_id && room.members[m].userId != room.userId){
                                //options += '<span class="input-group-btn"><button class="btn btn-danger room-member-del-btn" uid="'+room.members[m].userId+'" style="border: none;border-radius:0px;color:#fff" type="button">X</button></span>';
                                //}
                                options += '</div></div>';
                            }
                        }

                        $fieldset.prepend('<div class="panel panel-default"><div class="panel-heading" style="border-radius: 0px;color: #838383"><h3 class="panel-title" style="padding: 6px">群成员<a class="converse-room-add-show" style="float:right;color: #009aff;cursor: pointer">添加用户</a></h3></div><div class="panel-body" style="padding: 6px;background: #fcfcfc;border: 1px solid #f5f5f5">'+options+'</div></div>');

                        $fieldset.prepend('<div class="panel panel-default"><div class="panel-heading" style="border-radius: 0px;color: #838383"><h3 class="panel-title" style="padding: 6px">群公告</h3></div><div class="panel-body" style="padding: 6px;background: #fcfcfc;border: 1px solid #f5f5f5">'+notices+'</div></div>');

                        $form.append('<fieldset></fieldset>');
                        var $fieldlastset = $form.children('fieldset:last');
                        $fieldlastset.append('<input type="button" class="pure-button button-cancel exit_room" value="退出群聊"/>');
                        $fieldlastset.append('<input type="button" class="pure-button button-cancel cancel" value="返回"/>');
                        $fieldlastset.append('<input type="button" class="pure-button button-cancel submit" value="保存修改"/>');
                        $fieldlastset.find('.cancel').on('click', this.cancelConfiguration.bind(this));
                        $fieldlastset.find('.exit_room').on('click', this.exitRoomConfiguration.bind(this));
                        $fieldlastset.find('.submit').on('click', this.saveRoomConfiguration.bind(this));
                        $fieldset.find('.converse-room-add-show').on('click', this.roomAddMemberShow.bind(this));
                        $fieldset.find('.add-room-member-list .save-add-room-members').on('click', this.saveSelectRoomMembers.bind(this));
                        $fieldset.find('.room-member-del-btn').on('click',this.delSelectRoomMember.bind(this));
                    },

                    saveRoomConfiguration: function (ev) {
                        ev.preventDefault();
                        var that = this,
                            jid = this.model.get('jid'),
                            room_jid = Strophe.getNodeFromJid(jid),
                            room = converse.roomInfo(room_jid),
                            $parent = $(ev.target).parent().parent(),
                            notice = $.trim($parent.find('#room_notice').val()),
                            room_name = $.trim($parent.find('#roomname').val()),
                            saveObj = {roomId:room.id,access_token:converse.access_token},
                            c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                            old_notice,
                            is_owner = false;

                        if(!room){
                            if(converse.new_modal){
                                $.dialog('alert',__('prompt'),__('This room does not (yet) exist'),0);
                            }else{
                                alert(__('This room does not (yet) exist'));
                            }
                            return;
                        }

                        //owner edit
                        if(room.userId && room.userId === Number(c_jid)){
                            is_owner = true;
                        }

                        if(is_owner){
                            if(room && room.notice){
                                old_notice = room.notice;
                            }
                            if(!(notice === $.trim(old_notice))){
                                //限制120个字符
                                if(notice.length > 120){
                                    if(converse.new_modal){
                                        $.dialog('alert',__('prompt'),__('The content of announcement should not exceed 120 characters'),0);
                                    }else{
                                        alert(__('The content of announcement should not exceed 120 characters'));
                                    }
                                    return false;
                                }

                                if(notice){
                                    saveObj.notice = notice;
                                }else{
                                    saveObj.notice = 'null';
                                }

                                room.notice = notice;
                            }
                        }

                        if(room_name && !(room_name === $.trim(room.name))){
                            if(room_name.length > 20){
                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__("Room name can't enter more than 20 characters"),0);
                                }else{
                                    alert(__("Room name can't enter more than 20 characters"));
                                }
                                return false;
                            }
                            saveObj.roomName = room_name;
                            room.name = room_name;
                        }

                        if((is_owner && saveObj.notice) || saveObj.roomName){
                            var result_json = $.ajax({
                                type: 'POST',
                                url: converse.imapi_url+converse.imapi_room_info_update,
                                data: saveObj,
                                async: false
                            }).responseText;
                            var result = JSON.parse(result_json);
                            if(result && result.resultCode && result.resultCode == 1){
                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__('Settings updated successful'),0);
                                }else{
                                    alert(__('Settings updated successful'));
                                }
                                var room_list = converse.muc_room_list;
                                if(room_list && room_list.length > 0){
                                    for(var r=0;r<room_list.length;r++){
                                        if(room.id === room_list[r].id){
                                            room_list.splice(r,1,room);
                                            break;
                                        }
                                    }
                                }

                                var msg_text = {fromUserId:c_jid, objectId:room.jid, fromUserName: converse.nick_name, timeSend:parseInt(moment() / 1000)};
                                if(!(notice === $.trim(old_notice)) && notice){
                                    //发送消息
                                    if(!$.trim(old_notice) && notice){
                                        msg_text.content = converse.nick_name + '新增群公告：' +notice;
                                    } else if ($.trim(old_notice) && notice) {
                                        msg_text.content = converse.nick_name + '修改群公告：' +notice;
                                    }
                                    /*else {
                                     msg_text.content = converse.nick_name + '清空群公告';
                                     }
                                     */

                                    msg_text.type = 905;

                                    var msgid = converse.connection.getUniqueId();
                                    converse.sendRoomMsg(jid, msgid, JSON.stringify(msg_text));
                                }

                                if(saveObj.roomName){
                                    //修改会话窗口群聊标题
                                    var $chat_title = $parent.parent().parent().parent().find('.chat-head-chatroom').find('.chat-title');
                                    $chat_title.text(saveObj.roomName);

                                    //修改群列表中房间名称
                                    $('#chatrooms #available-chatrooms dd.available-chatroom').each(function(index,element){
                                        var a_btn =$(element).find('a');
                                        var room_jid = a_btn.attr('data-room-jid');
                                        if(room_jid === jid){
                                            a_btn.text(saveObj.roomName);
                                        }
                                    });

                                    //edit rosterview panel roomslist
                                    $('#conversejs #converse-controlbox-official-rooms .rosterview-room-group-item').each(function(index,element){
                                        var room_btn =$(element).find('a');
                                        var a_jid = room_btn.attr('data-room-jid');
                                        if(a_jid === jid){
                                            room_btn.text(saveObj.roomName);
                                        }
                                    });

                                    //发送消息
                                    msg_text.content = converse.nick_name+'修改群名称：'+saveObj.roomName ;
                                    msg_text.type = 902;
                                    var msgid = converse.connection.getUniqueId();
                                    converse.sendRoomMsg(jid, msgid, JSON.stringify(msg_text));
                                }

                                //update chatlist first
                                if(converse.allow_chatlist){
                                    converse_api.chatlist.first(jid, 'groupchat');

                                    //update list item msg
                                    converse_api.chatlist.updateItemMsg(jid, msg_text, 'groupchat');

                                }

                                this.$el.find('div.chatroom-form-container').hide(
                                    function () {
                                        $(this).remove();
                                        that.$el.find('.chat-area').removeClass('hidden');
                                    });
                            } else {
                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__('Settings updated fail'),0);
                                }else{
                                    alert(__('Settings updated fail'));
                                }
                            }
                        } else {
                            if(converse.new_modal){
                                $.dialog('alert',__('prompt'),__('Please change the setting to save'),0);
                            }else{
                                alert(__('Please change the setting to save'));
                            }
                        }

                    },

                    configureAgentChatRoom: function (ev){
                        if (typeof ev !== 'undefined' && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        if (this.$el.find('div.chatroom-form-container').length) {
                            return;
                        }

                        var $btn_parent = $(ev.target).parent();
                        var title_div = $btn_parent.find('.chat-title');
                        var name = $.trim(title_div.text());
                        //cgh7712
                        name = converse.htmlEncode(name);
                        this.$('.chatroom-body').children().addClass('hidden');
                        this.$('.chatroom-body').append(converse.templates.chatroom_member_form({
                            'room_name':name
                        }));

                        var $form = this.$el.find('form.chatroom-form'),
                            $fieldfirst = $form.children('fieldset:first'),
                            $fieldset = $form.children('fieldset:last'),
                            select_div,
                            select_options,
                            room_jid = this.model.get('jid'),
                            jid = Strophe.getNodeFromJid(room_jid),
                            official_id = jid.split('_')[1],
                            c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                        //将房间名称修改禁用
                        $form.find('.room-name-head').css('display','none');
                        $form.find('.room-name-title').css('display','none');
                        $form.find('#roomname').css('display','none');

                        //增加邀请公众号的列表
                        var official_list_json = $.ajax({
                            url: converse.imapi_url+converse.imapi_online_official_list,
                            data:{access_token:converse.access_token},
                            cache: false,
                            async: false
                        }).responseText;
                        var official_list = JSON.parse(official_list_json);
                        if(official_list && official_list.resultCode && official_list.resultCode == 1 ) {
                            if (official_list.data && official_list.data.length > 0) {
                                for (var i = 0; i < official_list.data.length; i++) {
                                    var d = official_list.data[i];
                                    if(Number(official_id) != d.officialId){
                                        //cgh7712
                                        select_options += '<option value="' + d.officialId + '">服务号：' +converse.htmlEncode(d.officialName) + '</option>';
                                    }
                                }
                            }
                        }

                        //增加客服选择的客服表
                        var html = $.ajax({
                            url: converse.imapi_url+converse.imapi_online_invite_agents,
                            data:{officialId:official_id,access_token:converse.access_token,roomJid:jid},
                            cache: false,
                            async: false
                        }).responseText;
                        var agent_list = JSON.parse(html);
                        if(agent_list && agent_list.resultCode && agent_list.resultCode == 1){
                            if(agent_list.data && agent_list.data.length > 0){
                                for(var i=0;i<agent_list.data.length;i++){
                                    var agent = agent_list.data[i];
                                    if(agent.userId != c_jid){
                                        //cgh7712
                                        select_options += '<option value="' + agent.userId + '">'+ agent.group + '客服：' + converse.htmlEncode(agent.name) + '</option>';
                                    }
                                }
                            }
                        }

                        select_div = converse.templates.agent_configure(
                            _.extend({
                                    label_name: __('Select customer service to join the session'),
                                    options: select_options,
                                    invite_btn_name: __('The invitation')
                                }
                            )
                        );

                        $fieldfirst.append(select_div);

                        $form.append('<fieldset></fieldset>');
                        $fieldset.append('<input type="button" class="pure-button button-cancel cancel" style="position: absolute;top:10px" value="返回"/>');
                        $fieldset.find('.cancel').on('click', this.cancelConfiguration.bind(this));
                        $fieldset.find('.exit_room').on('click', this.exitAgentRoomConfiguration.bind(this));
                        $fieldfirst.find('.invite_user_btn').on('click', this.inviteOtherAgentConfiguration.bind(this));

                    },

                    toggleEvaluateForm: function (ev) {
                        ev.stopPropagation();
                        var $a = $(ev.target);
                        if($a.is('.toggle-evaluate')){
                            this.$el.find('.evaluate-form').slideToggle(200);
                        }
                    },

                    agentSelectToRight: function (ev) {
                        var $select_parent = $(ev.target).parents('#showAgengtDiv'),
                            $select_left_div = $select_parent.find('#listLeft'),
                            $select_right_div = $select_parent.find('#listRight');

                        var nodes = $select_left_div.find("option:selected");
                        $select_right_div.append(nodes);
                    },

                    agentSelectToLeft: function (ev) {
                        var $select_parent = $(ev.target).parents('#showAgengtDiv'),
                            $select_left_div = $select_parent.find('#listLeft'),
                            $select_right_div = $select_parent.find('#listRight');

                        var nodes = $select_right_div.find("option:selected");
                        $select_left_div.append(nodes);
                    },

                    clickConfigure: function(ev){
                        var jid = this.model.get('jid'),
                            room_jid = Strophe.getNodeFromJid(jid),
                            room = converse.imRoomInfo(room_jid),
                            c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                        if(room_jid.indexOf('online') > -1){
                            var user_id = room_jid.split('_')[2],
                                official_id = room_jid.split('_')[1];

                            //客服
                            if(c_jid != user_id && c_jid != official_id){
                                this.configureAgentChatRoom(ev);
                            }
                        } else {
                            if(Number(c_jid) === room.userId){
                                this.configureOwnerChatRoom(ev);
                            } else {
                                this.configureMemberChatRoom(ev);
                            }
                        }
                    },

                    clickMinimize: function (ev){
                        var jid = this.model.get('jid'),
                            room_jid = Strophe.getNodeFromJid(jid),
                            room = converse.imRoomInfo(room_jid),
                            c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                        if(room_jid.indexOf('online') > -1){
                            var user_id = room_jid.split('_')[2],
                                official_id = room_jid.split('_')[1];
                            if(c_jid === user_id){
                                var view = converse.chatboxviews.get(this.model.get('id'));
                                if (view) {
                                    view.hide();
                                }
                            }
                        }
                    },

                    configureOwnerChatRoom: function (ev) {
                        if (typeof ev !== 'undefined' && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var l = this.$el.find('div.chatroom-form-container').length;
                        if (this.$el.find('div.chatroom-form-container').length) {
                            return;
                        }

                        var $btn_parent = $(ev.target).parent(),
                            title_div = $btn_parent.find('.chat-title'),
                            name = $.trim(title_div.text()),
                            jid = this.model.get('jid'),
                            room_jid = Strophe.getNodeFromJid(jid),
                            room = converse.imRoomInfo(room_jid);

                        this.$('.chatroom-body').children().addClass('hidden');
                        if(room){
                            var room_name = converse.htmlEncode(room.name);
                            this.$('.chatroom-body').append(converse.templates.chatroom_member_form({
                                'room_name': room_name
                            }));
                        }
                        var $form = this.$el.find('form.chatroom-form'),
                            $fieldset = $form.children('fieldset:first'),
                            notices = '';

                        if(room && room.notice){
                            notices = room.notice;
                        }

                        //群创建时间及群创建人
                        //群创建时间及群创建人
                        if(room){
                            var room_time_html = '<div class="col-xs-8">' +

                                '<div class="col-xs-2">创建人:</div>' +
                                '<div class="col-xs-10">'+room.nickname+'</div>' +
                                '</div>' +

                                '<div class="col-xs-4">' +

                                '<div class="col-xs-4">创建时间:</div>' +
                                '<div class="col-xs-8"> '+converse.longToDate1(room.createTime*1000)+'</div>' +

                                '</div>';
                            var $room_div = $fieldset.find('.room-name-body');
                            $room_div.append(room_time_html);
                        }

                        //增加添加群成员模块
                        var friends_list = converse.friends_list,
                            colleagues_list = converse.colleagues_list,
                            add_friend_html,
                            member_list = new Array();

                        add_friend_html = '<div class="panel panel-default add-room-member-list " style="display: none;"><div class="panel-heading" style="border-radius: 0px;color: #838383"><h3 class="panel-title" style="padding: 6px">选择用户</h3></div><div class="panel-body" style="padding: 6px;background: #fcfcfc;border: 1px solid #f5f5f5">';
                        if(friends_list && friends_list.length > 0){
                            for (var i = 0; i < friends_list.length; i++) {
                                member_list[member_list.length] = friends_list[i];

                                /*
                                 add_friend_html += '<div class="col-xs-3 double-listbox3" style="margin: 3px;max-width: 154px;">' + '<input type="checkbox" id="' + data.userId + '" value="' + data.userId + '">' + '<label style="margin: 0px;text-align: center" class="list-rowC" for="' + data.userId + '"> '+ data.nickname +'</label>' + '</input>' + '</div>';
                                 */
                            }
                        }
                        if(colleagues_list && colleagues_list.length > 0){
                            for (var i = 0; i < colleagues_list.length; i++) {
                                member_list[member_list.length] = colleagues_list[i];
                                /*
                                 var data = colleagues_list[i];
                                 add_friend_html += '<div class="col-xs-3 double-listbox3" style="margin: 3px;max-width: 154px;">' +  '<input type="checkbox" id="' + data.userId + '"  value="' + data.userId + '">' + '<label style="margin: 0px;text-align: center" class="list-rowC"  for="' + data.userId + '"> '+ data.nickname +'</label>' + '</input>' + '</div>';
                                 */
                            }
                        }

                        //查看是否在成员列表中，如果不在则进行显示
                        if(member_list && member_list.length > 0){
                            for(var i=0;i<member_list.length;i++){
                                var isExist = false,
                                    data = member_list[i];
                                if(room && room.members) {
                                    for (var m = 0; m < room.members.length; m++) {
                                        if(room.members[m].userId === data.userId){
                                            isExist = true;
                                        }
                                    }
                                }
                                if(!isExist){
                                    add_friend_html += '<div class="col-xs-3 double-listbox3" style="margin: 3px;max-width: 154px;">' +  '<input type="checkbox" id="' + data.userId + '"  value="' + data.userId + '">' + '<label style="margin: 0px;text-align: center" class="list-rowC"  for="' + data.userId + '"> '+ data.nickname +'</label>' + '</input>' + '</div>';
                                }
                            }
                        }

                        add_friend_html += '<button class="btn btn-info save-add-room-members" style="float: right;border-radius: 0px;width: 8%;margin-top: 5px;background:#fff;height: 25px"><a class="icon-checkmark" href="#" style="color:#1495ff;" title="添加"></a></button></div></div>';
                        $fieldset.prepend(add_friend_html);

                        //构建群成员信息
                        var options = "",
                            user_id = Number(Strophe.getNodeFromJid(converse.jid));
                        if(room && room.members){
                            for(var m=0;m<room.members.length;m++){
                                options += '<div class="col-xs-3" style="padding-right: 3px;padding-bottom: 3px"><div class="input-group"><div style="background: #eee" class="input-group-addon" title="'+room.members[m].nickname+'" user="'+room.members[m].userId+'">'+room.members[m].nickname+'</div>';
                                if(room.members[m].userId != user_id && room.members[m].userId != room.userId){
                                    options += '<button class="btn btn-danger room-member-del-btn" uid="'+room.members[m].userId+'" uname="'+room.members[m].nickname+'" type="button">x</button>';
                                }
                                options += '</div></div>';
                            }
                        }

                        $fieldset.prepend('<div class="panel panel-default"><div class="panel-heading" style="border-radius: 0px;color: #838383"><h3 class="panel-title" style="padding: 6px">群成员<a class="converse-room-add-show" style="float:right;color: #009aff;cursor: pointer">添加用户</a></h3></div><div class="panel-body" style="padding: 6px;background: #fcfcfc;border: 1px solid #f5f5f5">'+options+'</div></div>');

                        $fieldset.prepend('<div class="panel panel-default"><div class="panel-heading" style="border-radius: 0px;color: #838383"><h3 class="panel-title" style="padding: 6px">群公告</h3></div><div class="panel-body" style="padding: 6px;background: #fcfcfc;border: 1px solid #f5f5f5"><textarea name="room_notice" style="border: 1px solid #f1f1f1;box-shadow: none" maxlength="120" class="col-xs-12" id="room_notice" placeholder="暂无公告">'+notices+'</textarea></div></div>');

                        $form.append('<fieldset></fieldset>');
                        var $fieldlastset = $form.children('fieldset:last');
                        $fieldlastset.append('<input type="button" class="pure-button button-cancel exit_room" value="删除并退出群聊"/>');
                        $fieldlastset.append('<input type="button" class="pure-button button-cancel cancel" value="返回"/>');
                        $fieldlastset.append('<input type="button" class="pure-button button-cancel submit" value="保存修改"/>');
                        $fieldlastset.find('.cancel').on('click', this.cancelConfiguration.bind(this));
                        $fieldlastset.find('.exit_room').on('click', this.exitRoomConfiguration.bind(this));
                        $fieldlastset.find('.submit').on('click', this.saveRoomConfiguration.bind(this));
                        $fieldset.find('.converse-room-add-show').on('click', this.roomAddMemberShow.bind(this));
                        $fieldset.find('.save-add-room-members').on('click', this.saveSelectRoomMembers.bind(this));
                        $fieldset.find('.room-member-del-btn').on('click',this.delSelectRoomMember.bind(this));
                    },

                    delSelectRoomMember: function (ev) {
                        ev.preventDefault();
                        var that = this,
                            uid,
                            uname,
                            jid = this.model.get('jid'),
                            room = converse.roomInfo(Strophe.getNodeFromJid(jid)),
                            user_id = Number(Strophe.getNodeFromJid(converse.jid));
                        if($(ev.target).is('.btn')){
                            uid = $(ev.target).attr('uid');
                            uname = $(ev.target).attr('uname');
                        }else{
                            uid = $(ev.target).parent().attr('uid');
                            uname = $(ev.target).parent().attr('uname');
                        }

                        //判断是否删除的是自己，不能删除
                        if(user_id === Number(uid)){
                            if(converse.new_modal){
                                $.dialog('alert',__('prompt'),__("Can't delete my"),0);
                            }else{
                                alert(__("Can't delete my"));
                            }
                            return false;
                        }

                        //不能删除群主
                        if(Number(uid) === room.userId){
                            if(converse.new_modal){
                                $.dialog('alert',__('prompt'),__("Can't delete the administrator"),0);
                            }else{
                                alert(__("Can't delete the administrator"));
                            }
                            return false;
                        }

                        if(converse.new_modal){
                            $.dialog('confirm',__('prompt'),__("Are you sure you want to delete this member"),0,function() {
                                $.closeDialog();

                                var result_json = $.ajax({
                                    url: converse.imapi_url+converse.imapi_room_member_delete,
                                    data:{roomJid:room.jid, access_token:converse.access_token, userId:uid},
                                    async: false
                                }).responseText;
                                var result = JSON.parse(result_json);
                                if(result && result.resultCode && result.resultCode == 1){
                                    //xmpp delete member

                                    //发送删除消息
                                    var msg_text = '{"content":"'+converse.nick_name + '删除群成员：' + uname + '","objectId":"'+room.jid+'","fromUserId":"'+Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid))+'","fromUserName":"'+converse.nick_name+'","toUserId":'+uid+',"timeSend":'+parseInt(moment() / 1000)+',"type":904}';
                                    var msgid = converse.connection.getUniqueId();
                                    converse.sendRoomMsg(that.model.get('jid'), msgid, msg_text);

                                    that.model.messages.create({
                                        fullname: that.model.get('nick'),
                                        sender: 'me',
                                        time: moment().format(),
                                        message: msg_text,
                                        msgid: msgid
                                    });

                                    //remove member
                                    $(ev.target).parent().parent().remove();

                                    //update chatlist first
                                    if(converse.allow_chatlist){
                                        converse_api.chatlist.first(that.model.get('jid'), 'groupchat');
                                    }

                                    if(converse.new_modal){
                                        $.dialog('alert',__('prompt'),__("Operation is successful"),0);
                                    }else{
                                        alert(__("Operation is successful"));
                                    }

                                    that.$el.find('div.chatroom-form-container').hide(
                                        function () {
                                            that.$el.find('div.chatroom-form-container').remove();
                                            that.$el.find('.chat-area').removeClass('hidden');
                                        });
                                } else {
                                    if(converse.new_modal){
                                        $.dialog('alert',__('prompt'),__("An error occurred"),0);
                                    }else{
                                        alert(__("An error occurred"));
                                    }
                                }
                            });
                        } else {

                            var result = confirm(__("Are you sure you want to delete this member"));
                            if (!(result === true)) {
                                return false;
                            }

                            var result_json = $.ajax({
                                url: converse.imapi_url+converse.imapi_room_member_delete,
                                data:{roomJid:room.jid, access_token:converse.access_token, userId:uid},
                                async: false
                            }).responseText;
                            var result = JSON.parse(result_json);
                            if(result && result.resultCode && result.resultCode == 1){
                                //发送删除消息
                                var msg_text = '{"content":"'+converse.nick_name + '删除群成员：' + uname + '","objectId":"'+room.jid+'","fromUserId":"'+Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid))+'","fromUserName":"'+converse.nick_name+'","toUserId":'+uid+',"timeSend":'+parseInt(moment() / 1000)+',"type":904}';
                                var msgid = converse.connection.getUniqueId();
                                converse.sendRoomMsg(this.model.get('jid'), msgid, msg_text);

                                this.model.messages.create({
                                    fullname: this.model.get('nick'),
                                    sender: 'me',
                                    time: moment().format(),
                                    message: msg_text,
                                    msgid: msgid
                                });

                                //remove member
                                $(ev.target).parent().parent().remove();

                                //update chatlist first
                                if(converse.allow_chatlist){
                                    converse_api.chatlist.first(that.model.get('jid'), 'groupchat');
                                }

                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__("Operation is successful"),0);
                                }else{
                                    alert(__("Operation is successful"));
                                }

                                /*
                                 this.$el.find('div.chatroom-form-container').hide(
                                 function () {
                                 $(this).remove();
                                 that.$el.find('.chat-area').removeClass('hidden');
                                 });
                                 */
                            } else {
                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__("An error occurred"),0);
                                }else{
                                    alert(__("An error occurred"));
                                }
                            }
                        }
                    },

                    saveSelectRoomMembers: function (ev) {
                        ev.preventDefault();
                        var that = this,
                            $parent;
                        if($(ev.target).is('.btn')){
                            $parent = $(ev.target).parent();
                        }else{
                            $parent = $(ev.target).parent().parent();
                        }

                        var select =  $parent.find('input[type=checkbox]:checked');
                        if(select.length < 1){
                            if(converse.new_modal){
                                $.dialog('alert',__('prompt'),__('Please choose the need to invite friends'),0);
                            }else{
                                alert(__('Please choose the need to invite friends'));
                            }
                            return false;
                        }

                        var member_id = [], member_name = [], server = converse.muc_service_url;
                        select.each(function (index, el) {
                            member_id[index] = $.trim($(el).val());
                            member_name[index] = $.trim($(el).next('label').text());
                        });

                        var members_json = JSON.stringify(member_id),
                            jid = this.model.get('jid'),
                            room = converse.roomInfo(Strophe.getNodeFromJid(jid)),
                            user_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                        if(room){
                            //在imapi新建群聊
                            var result_json = $.ajax({
                                type: 'POST',
                                url: converse.imapi_url + converse.imapi_room_update,
                                data: {roomId:room.id,access_token: converse.access_token,text: members_json},
                                async: false
                            }).responseText;
                            var result = JSON.parse(result_json);
                            if(result && result.resultCode && result.resultCode == 1){
                                var msg_text = {objectId:room.jid, fromUserId:user_jid, fromUserName:converse.nick_name, timeSend: parseInt(moment() / 1000)};
                                //发送邀请
                                for (var i = 0; i < member_id.length; i++) {
                                    var recipient = member_id[i] + "@" + converse.domain;
                                    converse.invitationMsg(converse.connection.jid, jid, recipient);
                                    converse.emit('roomInviteSent', {
                                        'room': this,
                                        'recipient': recipient,
                                        'reason': ""
                                    });

                                    msg_text.content ='<div class="msg-withdrawal">'+
                                        '<div class="msg-withdrawal-css">'+converse.nick_name + '邀请:'+ member_name[i] + '加入群聊'+'</div>'+
                                        '</div>';
                                    msg_text.type = 907;
                                    //var msg_text = '{"content":"您好，' + agent_name + '将为您服务。","objectId":"'+imapi_jid+'","fromUserId":"' + c_jid + '","fromUserName":"' + converse.nick_name + '","timeSend":' + parseInt(moment() / 1000) + ',"type":929}';
                                    var msgid = converse.connection.getUniqueId();
                                    converse.sendRoomMsg(jid, msgid, JSON.stringify(msg_text));
                                    this.model.messages.create({
                                        fullname: this.model.get('nick'),
                                        sender: 'me',
                                        time: moment().format(),
                                        message: JSON.stringify(msg_text),
                                        msgid: msgid
                                    });
                                }

                                // update chatlist first
                                if(converse.allow_chatlist){
                                    converse_api.chatlist.first(jid, 'groupchat');
                                }

                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__('Operation is successful'),0);
                                }else{
                                    alert(__('Operation is successful'));
                                }

                                this.$el.find('div.chatroom-form-container').hide(
                                    function () {
                                        $(this).remove();
                                        that.$el.find('.chat-area').removeClass('hidden');
                                    });
                            } else {
                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__('An error occurred'),0);
                                }else{
                                    alert(__('An error occurred'));
                                }
                            }
                        }
                    },

                    roomAddMemberShow: function (ev) {
                        var $list = $(ev.target).parent().parent().parent().parent().find('.add-room-member-list');
                        if($list.css("display")=='none' ){
                            $list.show();
                        } else {
                            $list.hide();
                        }
                    },

                    exitRoomConfiguration: function (ev) {
                        ev.preventDefault();
                        var that = this;
                        //退出房间
                        var c_room_jid = that.model.get('jid'),
                            room_jid = Strophe.getNodeFromJid(c_room_jid),
                            c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                            room = converse.roomInfo(room_jid),
                            is_owner = false,
                            url = converse.imapi_url + converse.imapi_room_member_delete,
                            result_data = {roomJid:room_jid, access_token:converse.access_token},
                            msg = __("Are you sure you want to quit this room");

                        if(room.userId && room.userId === Number(c_jid)){
                            is_owner = true;
                            url = converse.imapi_url+converse.imapi_room_delete;
                            msg = __("Are you sure you want to exit and delete this room");
                        } else {
                            result_data.userId = c_jid;
                        }

                        if(converse.new_modal){
                            $.dialog('confirm', '提示', msg, 0, function(){
                                $.closeDialog();

                                var result_json = $.ajax({
                                    url: url,
                                    data: result_data,
                                    async: false
                                }).responseText;
                                var result = JSON.parse(result_json);
                                if(result && result.resultCode && result.resultCode == 1){

                                    //xmpp delete room
                                    if(is_owner){
                                        var destroy_msg = $iq({
                                            to: c_room_jid,
                                            type: "set"
                                        }).c("query", {xmlns: Strophe.NS.MUC + "#owner"}).c("destroy").c("reason").t("房间所有者主动销毁房间");
                                        converse.connection.send(destroy_msg);
                                    }

                                    //exit room
                                    that.leave();

                                    //variable delete room
                                    $('#chatrooms #available-chatrooms dd.available-chatroom').each(function(index,element){
                                        var a_btn =$(element).find('a');
                                        var item_jid = a_btn.attr('data-room-jid');
                                        if(c_room_jid === item_jid){
                                            $(element).remove();
                                        }
                                    });

                                    if(converse.allow_chatlist){
                                        try{
                                            converse_api.chatlist.deleteitem(c_room_jid);
                                        }catch (e){
                                            if(converse.debug){
                                                console.log(e);
                                            }
                                        }
                                    }

                                    //user rosterview panel delete
                                    $('#conversejs #converse-controlbox-official-rooms .rosterview-room-group-item').each(function(index,element){
                                        var a_btn =$(element).find('a');
                                        var jid = a_btn.attr('data-room-jid');
                                        if(c_room_jid === jid){
                                            $(element).remove();
                                        }
                                    });

                                    //panel delete room
                                    that.delete_room_list(room_jid);

                                }else{
                                    that.showStatusNotification(__("An error occurred while trying to save the form."));
                                    that.$el.find('div.chatroom-form-container').hide(
                                        function () {
                                            that.$el.find('div.chatroom-form-container').remove();
                                            that.$el.find('.chat-area').removeClass('hidden');
                                            that.$el.find('.occupants').removeClass('hidden');
                                        });
                                }
                            });
                        } else {
                            var result = confirm(msg);
                            if (!(result === true)) {
                                return false;
                            }

                            //退出房间
                            var result_json = $.ajax({
                                url: url,
                                data:result_data,
                                async: false
                            }).responseText;
                            var result = JSON.parse(result_json);
                            if(result && result.resultCode && result.resultCode == 1){
                                //xmpp delete room
                                if(is_owner){
                                    var destroy_msg = $iq({
                                        to: c_room_jid,
                                        type: "set"
                                    }).c("query", {xmlns: Strophe.NS.MUC + "#owner"}).c("destroy").c("reason").t("房间所有者主动销毁房间");
                                    converse.connection.send(destroy_msg);
                                }

                                //exit room
                                this.leave();

                                //variable delete room
                                $('#chatrooms #available-chatrooms dd.available-chatroom').each(function(index,element){
                                    var a_btn =$(element).find('a');
                                    var item_jid = a_btn.attr('data-room-jid');
                                    if(c_room_jid === item_jid){
                                        $(element).remove();
                                    }
                                });

                                if(converse.allow_chatlist){
                                    try{
                                        converse_api.chatlist.deleteitem(c_room_jid);
                                    }catch (e){
                                        if(converse.debug){
                                            console.log(e);
                                        }
                                    }
                                }

                                //user rosterview panel delete
                                $('#conversejs #converse-controlbox-official-rooms .rosterview-room-group-item').each(function(index,element){
                                    var a_btn =$(element).find('a');
                                    var jid = a_btn.attr('data-room-jid');
                                    if(c_room_jid === jid){
                                        $(element).remove();
                                    }
                                });

                                //panel delete room
                                this.delete_room_list(room_jid);
                            }else{
                                this.showStatusNotification(__("An error occurred while trying to save the form."));
                                this.$el.find('div.chatroom-form-container').hide(
                                    function () {
                                        $(this).remove();
                                        that.$el.find('.chat-area').removeClass('hidden');
                                        that.$el.find('.occupants').removeClass('hidden');
                                    });
                            }
                        }

                    },

                    exitAgentRoomConfiguration: function (ev) {
                        var c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                            jid = this.model.get('jid'),
                            id = Strophe.getNodeFromJid(jid),
                            official_id = id.split('_')[1];

                        if(converse.new_modal){
                            var _this = this;
                            $.dialog('confirm',__('prompt'),__("Are you sure you want to exit this room"),0,function() {
                                $.closeDialog();

                                var agent_available_json = $.ajax({
                                    url: converse.imapi_url+converse.imapi_agent_available,
                                    data:{officialId:official_id,access_token:converse.access_token},
                                    async: false
                                }).responseText;
                                var agent_available_result = JSON.parse(agent_available_json);
                                if(agent_available_result && agent_available_result.resultCode && agent_available_result.resultCode == 1 && agent_available_result.data && agent_available_result.data.count > 0){
                                    //发送消息
                                    var msg_text = '{"content":"客服[' + converse.nick_name + ']退出服务","objectId":"' + id + '","fromUserId":"' + c_jid + '","fromUserName":"' + converse.nick_name + '","timeSend":' + parseInt(moment() / 1000) + ',"type":924}';
                                    var msgid = converse.connection.getUniqueId();
                                    converse.sendRoomMsg(jid, msgid, msg_text);
                                    _this.model.messages.create({
                                        fullname: _this.model.get('nick'),
                                        sender: 'me',
                                        time: moment().format(),
                                        message: msg_text,
                                        msgid: msgid
                                    });

                                    var result_json = $.ajax({
                                        url: converse.imapi_url+converse.imapi_room_member_delete,
                                        data:{roomJid:id,access_token:converse.access_token,userId:c_jid},
                                        async: false
                                    }).responseText;
                                    var result = JSON.parse(result_json);
                                    if(result && result.resultCode && result.resultCode == 1){
                                        //删除聊天记录
                                        _this.model.messages.reset();
                                        _this.model.messages.browserStorage._clear();

                                        //退出房间
                                        _this.leave();

                                        //房间列表中去掉此房间信息
                                        $('#chatrooms #available-chatrooms dd.available-chatroom').each(function(index,element){
                                            var a_btn =$(element).find('a');
                                            var room_jid = a_btn.attr('data-room-jid');
                                            if(room_jid === jid){
                                                $(element).remove();
                                            }
                                        });

                                        _this.delete_room_list(id);
                                        converse.ChatBoxView.prototype.close.apply(_this, arguments);
                                    }
                                }else{
                                    if(converse.new_modal){
                                        $.dialog('alert',__('prompt'),__('No available customer service,can not quit'),0);
                                    }else{
                                        alert(__('No available customer service,can not quit'));
                                    }
                                }
                            });
                        } else {
                            var result = confirm(__("Are you sure you want to exit this room"));
                            if (result === true) {
                                var agent_available_json = $.ajax({
                                    url: converse.imapi_url+converse.imapi_agent_available,
                                    data:{officialId:official_id,access_token:converse.access_token},
                                    async: false
                                }).responseText;
                                var agent_available_result = JSON.parse(agent_available_json);
                                if(agent_available_result && agent_available_result.resultCode && agent_available_result.resultCode == 1 && agent_available_result.data && agent_available_result.data.count > 0){
                                    //发送消息
                                    var msg_text = '{"content":"客服[' + converse.nick_name + ']退出服务","objectId":"' + id + '","fromUserId":"' + c_jid + '","fromUserName":"' + converse.nick_name + '","timeSend":' + parseInt(moment() / 1000) + ',"type":924}';
                                    var msgid = converse.connection.getUniqueId();
                                    converse.sendRoomMsg(jid, msgid, msg_text);
                                    this.model.messages.create({
                                        fullname: this.model.get('nick'),
                                        sender: 'me',
                                        time: moment().format(),
                                        message: msg_text,
                                        msgid: msgid
                                    });

                                    var result_json = $.ajax({
                                        url: converse.imapi_url+converse.imapi_room_member_delete,
                                        data:{roomJid:id,access_token:converse.access_token,userId:c_jid},
                                        async: false
                                    }).responseText;
                                    var result = JSON.parse(result_json);
                                    if(result && result.resultCode && result.resultCode == 1){
                                        //删除聊天记录
                                        this.model.messages.reset();
                                        this.model.messages.browserStorage._clear();

                                        //退出房间
                                        this.leave();

                                        //房间列表中去掉此房间信息
                                        $('#chatrooms #available-chatrooms dd.available-chatroom').each(function(index,element){
                                            var a_btn =$(element).find('a');
                                            var room_jid = a_btn.attr('data-room-jid');
                                            if(room_jid === jid){
                                                $(element).remove();
                                            }
                                        });

                                        this.delete_room_list(id);
                                        converse.ChatBoxView.prototype.close.apply(this, arguments);
                                    }
                                }else{
                                    if(converse.new_modal){
                                        $.dialog('alert',__('prompt'),__('No available customer service,can not quit'),0);
                                    }else{
                                        alert(__('No available customer service,can not quit'));
                                    }
                                }
                            }
                        }
                    },

                    inviteOtherAgentConfiguration: function (ev){
                        ev.preventDefault();
                        var that = this;
                        var room_jid = this.model.get("jid"),
                            imapi_jid = Strophe.getNodeFromJid(room_jid),
                            $parent1 = $(ev.target).parent(".input-group-btn"),
                            $parent = $parent1.parent(".add-agent-official-select"),
                            $listRight = $parent.find('#listRight'),
                            $options = $listRight.find('option:selected'),
                            member_id = [],
                            member_name = [],
                            server = converse.muc_service_url,
                            c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                        if($options.length == 0){
                            if(converse.new_modal){
                                $.dialog('alert',__('prompt'),__('Please select a customer number or official Account'),0);
                            }else{
                                alert(__('Please select a customer number or official Account'));
                            }
                            return false;
                        }

                        $options.each(function (index, el) {
                            member_id[index] = $.trim($(el).val());
                            member_name[index] = $.trim($(el).text());
                        });

                        //更新成员信息
                        var members_json = JSON.stringify(member_id);
                        var result_json = $.ajax({
                            url: converse.imapi_url + converse.imapi_room_update,
                            data:{roomJid: imapi_jid,access_token: converse.access_token,text: members_json},
                            async: false
                        }).responseText;
                        var result = JSON.parse(result_json);

                        if (result && result.resultCode && result.resultCode === 1) {
                            //邀请
                            var agent_name = '';
                            for (var i = 0; i < member_id.length; i++) {
                                var recipient = member_id[i] + "@" + converse.domain;

                                converse.invitationMsg(converse.connection.jid, room_jid, recipient);
                                converse.emit('roomInviteSent', {
                                    'room': this,
                                    'recipient': recipient,
                                    'reason': ""
                                });
                                var name = member_name[i];
                                if(name.indexOf('客服')>=0){
                                    agent_name += name.replace('客服：','');
                                }
                            }

                            //发送消息
                            if(agent_name && agent_name != ''){
                                var msg_text = '{"content":"您好，' + agent_name + '将为您服务。","objectId":"'+imapi_jid+'","fromUserId":"' + c_jid + '","fromUserName":"' + converse.nick_name + '","timeSend":' + parseInt(moment() / 1000) + ',"type":929}';
                                var msgid = converse.connection.getUniqueId();
                                converse.sendRoomMsg(room_jid, msgid, msg_text);
                                this.model.messages.create({
                                    fullname: this.model.get('nick'),
                                    sender: 'me',
                                    time: moment().format(),
                                    message: msg_text,
                                    msgid: msgid
                                });
                            }

                            //关闭设置
                            this.$el.find('div.chatroom-form-container').hide(
                                function () {
                                    $(this).remove();
                                    that.$el.find('.chat-area').removeClass('hidden');
                                    that.$el.find('.occupants').removeClass('hidden');
                                });
                        } else {
                            if(converse.new_modal){
                                $.dialog('alert',__('prompt'),__('An error occurred'),0);
                            }else{
                                alert(__('An error occurred'));
                            }
                            return false;
                        }
                    },

                    delete_room_list:function(id){
                        //删除在变量中的信息
                        var room_list = converse.muc_room_list;
                        if(room_list && room_list.length > 0){
                            for(var r=0;r<room_list.length;r++){
                                if(id === room_list[r].jid){
                                    room_list.splice(r,1);
                                    break;
                                }
                            }
                        }
                    },

                });

            converse.ChatRoomOccupant = Backbone.Model.extend({
                initialize: function (attributes) {
                    this.set(_.extend({
                        'id': converse.connection.getUniqueId(),
                    }, attributes));
                }
            });

            converse.ChatRoomOccupantView = Backbone.View.extend({
                tagName: 'li',
                initialize: function () {
                    this.model.on('change', this.render, this);
                    this.model.on('destroy', this.destroy, this);
                },

                render: function () {
                    var new_el = converse.templates.occupant(
                        _.extend(
                            this.model.toJSON(), {
                                'hint_occupant': __('Click to mention this user in your message.'),
                                'desc_moderator': __('This user is a moderator.'),
                                'desc_occupant': __('This user can send messages in this room.'),
                                'desc_visitor': __('This user can NOT send messages in this room.')
                            })
                    );
                    var $parents = this.$el.parents();
                    if ($parents.length) {
                        this.$el.replaceWith(new_el);
                        this.setElement($parents.first().children('#'+this.model.get('id')), true);
                        this.delegateEvents();
                    } else {
                        this.$el.replaceWith(new_el);
                        this.setElement(new_el, true);
                    }
                    return this;
                },

                destroy: function () {
                    this.$el.remove();
                }
            });

            converse.ChatRoomOccupants = Backbone.Collection.extend({
                model: converse.ChatRoomOccupant
            });

            converse.ChatRoomOccupantsView = Backbone.Overview.extend({
                tagName: 'div',
                className: 'occupants',

                initialize: function () {
                    this.model.on("add", this.onOccupantAdded, this);
                },

                render: function (jid, isHistory) {

                    var id = Strophe.getNodeFromJid(jid);
                    if(jid.indexOf('online')>=0 && converse.is_agent && !isHistory){
                        var user_id = id.split('_')[2],
                            official_id = id.split('_')[1],
                            c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                        if(c_jid != user_id && c_jid != official_id){

                            var list = '<div class="desk_list"><div class="col-xs-12" style="padding: 5px">';

                            list += converse.templates.chatroom_desk_list({
                                'label_desk_title': __('desk_list_title'),
                                'jid':jid
                            });

                            var user;
                            if(c_jid != user_id && c_jid != official_id){

                                try {
                                    var result_json = $.ajax({
                                        url: converse.imapi_url + converse.imapi_user,
                                        data: {userId: user_id, access_token: converse.access_token},
                                        async: false
                                    }).responseText;
                                    var result = JSON.parse(result_json);
                                    if (result && result.resultCode && result.resultCode == 1) {
                                        user = result.data;
                                    }
                                }catch (e){
                                    console.log(e);
                                };

                                if(user){
                                    //查找公众号详情
                                    var official_account = converse.officialInfo(official_id);

                                    if(official_account){
                                        var where = "activity = 1 and ((reportPhone='" + user.telephone + "') or (agentPhone='"+user.telephone+"'))";

                                        var desk_list,
                                            itsnow_desk_url = converse.itsnow_request_type + '://' + official_account.domain + converse.itsnow_url + '.itsnow.com';
                                        try{
                                            var desk_list_json = $.ajax({
                                                url: itsnow_desk_url + converse.itsnow_query_desk_list + 'ServiceOrder',
                                                type: 'GET',
                                                data:{where:where,pageIndex:0,pageSize:100000},
                                                cache: false,
                                                dataType:'json',
                                                async: false
                                            }).responseText;
                                            desk_list = JSON.parse(desk_list_json);
                                        } catch (e){
                                            desk_list = null;
                                            console.log(e);
                                        }
                                        if(desk_list){
                                            var totalSize = desk_list.totalSize,
                                                body = desk_list.body;

                                            if(totalSize && totalSize > 0) {
                                                list += '<div class="col-xs-12 form-list">';

                                                for (var i = 0; i < body.length; i++) {

                                                    var reportLabel = body[i].reportLabel,
                                                        reportPhone = body[i].reportPhone,
                                                        label = body[i].label,
                                                        commitTime = body[i].commitTime,
                                                        progress = body[i].progress,
                                                        associationService = body[i].associationService,
                                                        workFlowProcessId = body[i].workFlowProcessId;

                                                    //详情地址
                                                    var info_url = itsnow_desk_url + converse.itsnow_platform;
                                                    info_url += converse.itsnow_query_desk + '?workFlowTemplateName=' + associationService + "&workFlowProcessInstanceId=" + workFlowProcessId;
                                                    info_url += '&subQuery=allServiceOrder&trueSelectedCategory=allServiceOrder&view=serviceDesks&serviceCatalogue=serviceOrder';
                                                    list += '<div class="col-xs-12" style="background: #f9f9f9;margin-bottom: 2px;padding: 4px">';
                                                    list += '<div class="col-xs-12" style="overflow: hidden;text-overflow: ellipsis;white-space: nowrap;padding: 0" colspan="2"><a href="' + info_url + '" title="' + label + '"  target="_blank">' + label + '</a></div>';
                                                    list += '<div class="col-xs-6" style="padding: 0;">' + converse.longToDate(commitTime) + '</div><div class="col-xs-6" style="padding: 0;text-align:right">' + progress + '</div>';
                                                    list += '</div>'

                                                }

                                                list += '</div>';
                                            }
                                        }
                                    }

                                    list += '</div></div>';

                                    //客户信息
                                    var nickname = user.nickname,
                                        telephone = user.telephone,
                                        email = '',
                                        name = '',
                                        companyName = '',
                                        bizunit = '';

                                    if(user.email && !(typeof(user.email) === "undefined")){
                                        email = user.email;
                                    }
                                    if(user.name && !(typeof(user.name) === "undefined")){
                                        name = user.name;
                                    }
                                    if(user.companyName && !(typeof(user.companyName) === "undefined")){
                                        companyName = user.companyName;
                                    }
                                    if(user.bizunit && !(typeof(user.bizunit) === "undefined")){
                                        bizunit = user.bizunit;
                                    }

                                    list += '<div class="occupants_user_info"><p class="occupants-heading">客户信息</p>';
                                    list += '<div class="msp-info"><table>';
                                    list += '<tr><td><label>昵称：</label><span>' + nickname + '</span></td></tr>';
                                    list += '<tr><td><label>手机号：</label><span>' + telephone + '</span></td></tr>';
                                    list += '<tr><td><label>邮箱：</label><span>' + email + '</span></td></tr>';
                                    list += '<tr><td><label>真实姓名：</label><span>' + name + '</span></td></tr>';
                                    list += '<tr><td><label>所属公司：</label><span>' + companyName + '</span></td></tr>';
                                    list += '<tr><td><label>所属部门：</label><span>' + bizunit + '</span></td></tr>';
                                    list += '</table></div></div>';
                                }
                            }

                            this.$el.html(list);
                            this.$el.find(".refresh_desk_list").on('click',this.refreshDeskList.bind(this));
                        }
                    }
                    return this;
                },

                onOccupantAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view) {
                        view = this.add(item.get('id'), new converse.ChatRoomOccupantView({model: item}));
                    } else {
                        delete view.model; // Remove ref to old model to help garbage collection
                        view.model = item;
                        view.initialize();
                    }
                    this.$('.occupant-list').append(view.render().$el);
                },

                parsePresence: function (pres) {
                    var id = Strophe.getResourceFromJid(pres.getAttribute("from"));
                    var data = {
                        nick: id,
                        type: pres.getAttribute("type"),
                        states: []
                    };
                    _.each(pres.childNodes, function (child) {
                        switch (child.nodeName) {
                            case "status":
                                data.status = child.textContent || null;
                                break;
                            case "show":
                                data.show = child.textContent || null;
                                break;
                            case "x":
                                if (child.getAttribute("xmlns") === Strophe.NS.MUC_USER) {
                                    _.each(child.childNodes, function (item) {
                                        switch (item.nodeName) {
                                            case "item":
                                                data.affiliation = item.getAttribute("affiliation");
                                                data.role = item.getAttribute("role");
                                                data.jid = item.getAttribute("jid");
                                                data.nick = item.getAttribute("nick") || data.nick;
                                                data.nick_name = "";
                                                break;
                                            case "status":
                                                if (item.getAttribute("code")) {
                                                    data.states.push(item.getAttribute("code"));
                                                }
                                        }
                                    });
                                }
                        }
                    });
                    return data;
                },

                findOccupant: function (data) {
                    /* Try to find an existing occupant based on the passed in
                     * data object.
                     *
                     * If we have a JID, we use that as lookup variable,
                     * otherwise we use the nick. We don't always have both,
                     * but should have at least one or the other.
                     */

                    var jid = Strophe.getBareJidFromJid(data.jid);
                    if (jid !== null) {
                        return this.model.where({'jid': jid}).pop();
                    } else {
                        return this.model.where({'nick': data.nick}).pop();
                    }
                },

                updateOccupantsOnPresence: function (pres) {
                    /* Given a presence stanza, update the occupant models
                     * based on its contents.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The presence stanza
                     */
                    var data = this.parsePresence(pres);
                    if (data.type === 'error') {
                        return true;
                    }
                    var occupant = this.findOccupant(data);
                    switch (data.type) {
                        case 'unavailable':
                            if (occupant) { occupant.destroy(); }
                            break;
                        default:
                            var jid = Strophe.getBareJidFromJid(data.jid);
                            var attributes = _.extend(data, {
                                'jid': jid ? jid : undefined,
                                'resource': data.jid ? Strophe.getResourceFromJid(data.jid) : undefined
                            });
                            if (occupant) {
                                occupant.save(attributes);
                            } else {
                                this.model.create(attributes);
                            }
                    }
                },

                initInviteWidget: function () {
                    var $el = this.$('input.invited-contact');
                    $el.typeahead({
                        minLength: 1,
                        highlight: true
                    }, {
                        name: 'contacts-dataset',
                        source: function (q, cb) {
                            var results = [];
                            _.each(converse.roster.filter(utils.contains(['fullname', 'jid'], q)), function (n) {
                                results.push({value: n.get('fullname'), jid: n.get('jid')});
                            });
                            cb(results);
                        },
                        templates: {
                            suggestion: _.template('<p data-jid="{{jid}}">{{value}}</p>')
                        }
                    });
                    $el.on('typeahead:selected', function (ev, suggestion, dname) {
                        var reason = prompt(
                            __(___('You are about to invite %1$s to the chat room "%2$s". '), suggestion.value, this.model.get('id')) +
                            __("You may optionally include a message, explaining the reason for the invitation.")
                        );
                        if (reason !== null) {
                            this.chatroomview.directInvite(suggestion.jid, reason);
                        }
                        $(ev.target).typeahead('val', '');
                    }.bind(this));
                    return this;
                },

                //新增方法
                refreshDeskList: function (ev) {
                    ev.preventDefault();
                    var jid = $(ev.target).attr('room'),
                        room = converse.roomInfo(Strophe.getNodeFromJid(jid));

                    if(room && room.jid.indexOf('online')>=0 && converse.is_agent) {
                        var user_id = room.jid.split('_')[2],
                            official_id = room.jid.split('_')[1],
                            user;

                        try {
                            var result_json = $.ajax({
                                url: converse.imapi_url + converse.imapi_user,
                                data: {userId: user_id, access_token: converse.access_token},
                                async: false
                            }).responseText;
                            var result = JSON.parse(result_json);
                            if (result && result.resultCode && result.resultCode == 1) {
                                user = result.data;
                            }
                        } catch (e) {
                            console.log(e);
                        }

                        if (user) {
                            //查找公众号详情
                            var official_account = converse.officialInfo(official_id),
                                $table_parent = $(ev.target).parent().parent().parent(),
                                $table = $table_parent.find('table');

                            var where = "activity = 1 and ((reportPhone='" + user.telephone + "') or (agentPhone='" + user.telephone + "'))";

                            var desk_list,
                                itsnow_desk_url = converse.itsnow_request_type + '://' + official_account.domain + converse.itsnow_url + '.itsnow.com';

                            try {
                                var desk_list_json = $.ajax({
                                    url: itsnow_desk_url + converse.itsnow_query_desk_list + 'ServiceOrder',
                                    type: 'GET',
                                    data: {where: where, pageIndex: 0, pageSize: 100000},
                                    cache: false,
                                    dataType: 'json',
                                    async: false
                                }).responseText;
                                desk_list = JSON.parse(desk_list_json);
                            } catch (e) {
                                desk_list = null;
                                console.log(e);
                            }
                            if (desk_list) {
                                var totalSize = desk_list.totalSize,
                                    body = desk_list.body;

                                if (totalSize && totalSize > 0) {
                                    $table.empty();

                                    var list = '<tbody>';

                                    for (var i = 0; i < body.length; i++) {

                                        var reportLabel = body[i].reportLabel,
                                            reportPhone = body[i].reportPhone,
                                            label = body[i].label,
                                            commitTime = body[i].commitTime,
                                            progress = body[i].progress,
                                            associationService = body[i].associationService,
                                            workFlowProcessId = body[i].workFlowProcessId;

                                        //详情地址
                                        var info_url = itsnow_desk_url + converse.itsnow_platform;
                                        info_url += converse.itsnow_query_desk + '?workFlowTemplateName=' + associationService + "&workFlowProcessInstanceId=" + workFlowProcessId;
                                        info_url += '&subQuery=allServiceOrder&trueSelectedCategory=allServiceOrder&view=serviceDesks&serviceCatalogue=serviceOrder'
                                        list += '<tr><td colspan="2" style="overflow: hidden;text-overflow: ellipsis;white-space: nowrap;max-width: 200px;"><a href="' + info_url + '" title="' + label + '" target="_blank">' + label + '</td></tr>';
                                        list += '<tr><td>' + converse.longToDate(commitTime) + '</td><td>' + progress + '</td></tr>';
                                    }

                                    list += '</tobdy>';
                                    if($table && $table.length > 0){
                                        $table.append(list);
                                    }else {
                                        list = '<table>' + list;
                                        list = list + '</table>';
                                        $table_parent.append(list);
                                    }
                                }
                            }
                        }
                    }
                }
            });

            converse.RoomsPanel = Backbone.View.extend({
                /* Backbone View which renders the "Rooms" tab and accompanying
                 * panel in the control box.
                 *
                 * In this panel, chat rooms can be listed, joined and new rooms
                 * can be created.
                 */
                tagName: 'div',
                className: 'controlbox-pane',
                id: 'chatrooms',
                events: {
                    'submit form.add-chatroom': 'createAgentChatRoom',
                    'click input#show-rooms': 'showRooms',
                    'click a.open-room': 'joinChatRoom',
                    'click a.room-info': 'showRoomInfo',
                    'change input[name=server]': 'setDomain',
                    'change input[name=nick]': 'setNick',
                    'click a.add-chatroom-btn': 'createAgentChatRoom',
                    'click a.create-room-btn':'createRoomShow',
                    'click a.create-room-skip':'createMemberRoom'
                },

                initialize: function (cfg) {
                    this.$parent = cfg.$parent;
                    this.model.on('change:muc_domain', this.onDomainChange, this);
                    this.model.on('change:nick', this.onNickChange, this);
                },

                render: function () {
                    this.$parent.append(
                        this.$el.html(
                            converse.templates.room_panel({
                                'server_input_type': converse.hide_muc_server && 'hidden' || 'text',
                                'server_label_global_attr': converse.hide_muc_server && ' hidden' || '',
                                'label_room_name': __('Room name'),
                                'label_nickname': __('Nickname'),
                                'label_server': __('Server'),
                                'label_join': __('Join Room'),
                                'label_show_rooms': __('Show rooms'),
                                'is_agent': converse.is_agent
                            })
                        ));
                    this.$tabs = this.$parent.parent().find('#controlbox-tabs');
                    var controlbox = converse.chatboxes.get('controlbox');
                    this.$tabs.append(converse.templates.chatrooms_tab({
                        'label_rooms': __('Rooms'),
                        'is_current': controlbox.get('active-panel') === ROOMS_PANEL_ID
                    }));
                    if (controlbox.get('active-panel') !== ROOMS_PANEL_ID) {
                        this.$el.addClass('hidden');
                    }
                    return this;
                },

                onDomainChange: function (model) {
                    var $server = this.$el.find('input.new-chatroom-server');
                    $server.val(model.get('muc_domain'));
                    if (converse.auto_list_rooms) {
                        //this.updateRoomsList();
                        this.showRooms();
                    }
                },

                onNickChange: function (model) {
                    var $nick = this.$el.find('input.new-chatroom-nick');
                    $nick.val(model.get('nick'));
                },

                informNoRoomsFound: function () {
                    var $available_chatrooms = this.$el.find('#available-chatrooms');
                    // For translators: %1$s is a variable and will be replaced with the XMPP server name
                    $available_chatrooms.html('<dt>'+__('No rooms on %1$s',this.model.get('muc_domain'))+'</dt>');
                    $('input#show-rooms').show().siblings('span.spinner').remove();
                },

                onRoomsFound: function (iq) {
                    /* Handle the IQ stanza returned from the server, containing
                     * all its public rooms.
                     */
                    var name, jid, i, fragment,
                        $available_chatrooms = this.$el.find('#available-chatrooms');
                    this.rooms = $(iq).find('query').find('item');
                    if (this.rooms.length) {
                        // For translators: %1$s is a variable and will be
                        // replaced with the XMPP server name
                        $available_chatrooms.html('<dt>'+__('Rooms on %1$s',this.model.get('muc_domain'))+'</dt>');
                        fragment = document.createDocumentFragment();
                        for (i=0; i<this.rooms.length; i++) {
                            name = Strophe.unescapeNode($(this.rooms[i]).attr('name')||$(this.rooms[i]).attr('jid'));
                            jid = $(this.rooms[i]).attr('jid');
                            fragment.appendChild($(
                                converse.templates.room_item({
                                    'title_url': '',
                                    'default_img': converse.emoticons_file_path + converse.room_default_img,
                                    'name':name,
                                    'jid':jid,
                                    'open_title': __('Click to open this room'),
                                    'info_title': __('Show more information on this room')
                                })
                            )[0]);
                        }
                        $available_chatrooms.append(fragment);
                        $('input#show-rooms').show().siblings('span.spinner').remove();
                    } else {
                        this.informNoRoomsFound();
                    }
                    return true;
                },

                updateRoomsList: function () {
                    /* Send and IQ stanza to the server asking for all rooms
                     */

                    converse.connection.sendIQ(
                        $iq({
                            to: this.model.get('muc_domain'),
                            from: converse.connection.jid,
                            type: "get"
                        }).c("query", {xmlns: Strophe.NS.DISCO_ITEMS}),
                        this.onRoomsFound.bind(this),
                        this.informNoRoomsFound.bind(this)
                    );
                },

                showRooms: function () {
                    var $available_chatrooms = this.$el.find('#available-chatrooms');
                    var $server = this.$el.find('input.new-chatroom-server');
                    var server = "muc."+converse.domain;
                    if (!server) {
                        $server.addClass('error');
                        return;
                    }
                    this.$el.find('input.new-chatroom-name').removeClass('error');
                    $server.removeClass('error');

                    $('input#show-rooms').hide().after('<span class="spinner"/>');
                    this.model.save({muc_domain: server});
                    //this.updateRoomsList();
                    $available_chatrooms.empty();

                    var rooms_list_json = $.ajax({
                        url: converse.imapi_url+converse.imapi_room_list,
                        data:{access_token:converse.access_token,pageIndex:0,pageSize:10000},
                        cache: false,
                        async: false
                    }).responseText;
                    var rooms_list = JSON.parse(rooms_list_json);
                    if(rooms_list && rooms_list.resultCode && rooms_list.resultCode == 1){

                        var name, jid, i, fragment,c_m_l  = converse.muc_room_list;
                        if(rooms_list.data && rooms_list.data.length >0){
                            fragment = document.createDocumentFragment();

                            for( var i=0;i<rooms_list.data.length;i++) {
                                var d = rooms_list.data[i];
                                name = d.name;
                                jid = d.jid+converse.muc_service_url;

                                converse.add_room_list(d, true);
                            }
                            converse.muc_room_list = c_m_l;
                            $available_chatrooms.append(fragment);
                            $('input#show-rooms').show().siblings('span.spinner').remove();
                        }else{
                            $('input#show-rooms').show().siblings('span.spinner').remove();
                        }
                    }
                    $('input#show-rooms').show().siblings('span.spinner').remove();

                    //显示公众号列表
                    var official_list_json = $.ajax({
                        url: converse.imapi_url+converse.imapi_online_official_list,
                        data:{access_token:converse.access_token},
                        cache: false,
                        async: false
                    }).responseText;
                    var official_list = JSON.parse(official_list_json);
                    if(official_list && official_list.resultCode && official_list.resultCode == 1){
                        var $available_official_chatrooms = this.$el.find('#available-official-chatrooms');
                        $available_official_chatrooms.empty();
                        var fragment = document.createDocumentFragment();
                        if(official_list.data && official_list.data.length >0){
                            converse.official_list = official_list.data;
                            for( var i=0;i<official_list.data.length;i++) {
                                var d = official_list.data[i];
                                var name = d.officialName,
                                    official_id = d.officialId;

                                //添加到面板中
                                jid = d.jid+converse.muc_service_url;
                                fragment.appendChild($(
                                    converse.templates.room_official_item({
                                        'name':name,
                                        'officialid':official_id
                                    })
                                )[0]);
                            }

                            $available_official_chatrooms.append(fragment);
                        }
                        //隐藏掉
                        $available_official_chatrooms.css('display','none');
                        $(".available-official-chatrooms_title").css('display','none');
                    }
                },

                insertRoomInfo: function (el, stanza) {
                    /* Insert room info (based on returned #disco IQ stanza)
                     *
                     * Parameters:
                     *  (HTMLElement) el: The HTML DOM element that should
                     *      contain the info.
                     *  (XMLElement) stanza: The IQ stanza containing the room
                     *      info.
                     */
                    var $stanza = $(stanza);
                    // All MUC features found here: http://xmpp.org/registrar/disco-features.html
                    $(el).find('span.spinner').replaceWith(
                        converse.templates.room_description({
                            'desc': $stanza.find('field[var="muc#roominfo_description"] value').text(),
                            'occ': $stanza.find('field[var="muc#roominfo_occupants"] value').text(),
                            'hidden': $stanza.find('feature[var="muc_hidden"]').length,
                            'membersonly': $stanza.find('feature[var="muc_membersonly"]').length,
                            'moderated': $stanza.find('feature[var="muc_moderated"]').length,
                            'nonanonymous': $stanza.find('feature[var="muc_nonanonymous"]').length,
                            'open': $stanza.find('feature[var="muc_open"]').length,
                            'passwordprotected': $stanza.find('feature[var="muc_passwordprotected"]').length,
                            'persistent': $stanza.find('feature[var="muc_persistent"]').length,
                            'publicroom': $stanza.find('feature[var="muc_public"]').length,
                            'semianonymous': $stanza.find('feature[var="muc_semianonymous"]').length,
                            'temporary': $stanza.find('feature[var="muc_temporary"]').length,
                            'unmoderated': $stanza.find('feature[var="muc_unmoderated"]').length,
                            'label_desc': __('Description:'),
                            'label_occ': __('Occupants:'),
                            'label_features': __('Features:'),
                            'label_requires_auth': __('Requires authentication'),
                            'label_hidden': __('Hidden'),
                            'label_requires_invite': __('Requires an invitation'),
                            'label_moderated': __('Moderated'),
                            'label_non_anon': __('Non-anonymous'),
                            'label_open_room': __('Open room'),
                            'label_permanent_room': __('Permanent room'),
                            'label_public': __('Public'),
                            'label_semi_anon': __('Semi-anonymous'),
                            'label_temp_room': __('Temporary room'),
                            'label_unmoderated': __('Unmoderated')
                        })
                    );
                },

                toggleRoomInfo: function (ev) {
                    /* Show/hide extra information about a room in the listing.
                     */
                    var target = ev.target,
                        $parent = $(target).parent('dd'),
                        $div = $parent.find('div.room-info');
                    if ($div.length) {
                        $div.remove();
                    } else {
                        $parent.find('span.spinner').remove();
                        $parent.append('<span class="spinner hor_centered"/>');
                        converse.connection.disco.info(
                            $(target).attr('data-room-jid'), null, _.partial(this.insertRoomInfo, $parent[0])
                        );
                    }
                },

                createChatRoom: function (ev) {
                    ev.preventDefault();
                    var name, $name, server, $server, jid;
                    if (ev.type === 'click') {
                        name = $(ev.target).text();
                        jid = $(ev.target).attr('data-room-jid');
                    } else {
                        $name = this.$el.find('input.new-chatroom-name');
                        $server= this.$el.find('input.new-chatroom-server');
                        server = $server.val();
                        name = $name.val().trim();
                        $name.val(''); // Clear the input
                        if (name && server) {
                            jid = Strophe.escapeNode(name.toLowerCase()) + '@' + server.toLowerCase();
                            $name.removeClass('error');
                            $server.removeClass('error');
                            this.model.save({muc_domain: server});
                        } else {
                            if (!name) { $name.addClass('error'); }
                            if (!server) { $server.addClass('error'); }
                            return;
                        }
                    }
                    converse.createChatRoom({
                        'id': jid,
                        'jid': jid,
                        'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                        'type': 'chatroom',
                        'box_id': b64_sha1(jid)
                    });
                },

                setDomain: function (ev) {
                    this.model.save({muc_domain: ev.target.value});
                },

                setNick: function (ev) {
                    this.model.save({nick: ev.target.value});
                },

                // new method
                createRoomShow:function(){
                    converse_api.createroom.open();
                },

                joinChatRoom: function (ev) {
                    ev.preventDefault();
                    var name, $name, server, $server, jid;
                    name = $(ev.target).text();
                    jid = $(ev.target).attr('data-room-jid');

                    //clean tip
                    /*
                     var badge = $(ev.target).parent().find('.badge');
                     if(badge.length > 0){
                     badge.remove();
                     }
                     */
                    $(converse.chatlist_list_item_class).each(function (index, element) {
                        var a_btn = $(element).find('a');
                        var room_jid = a_btn.attr('data-jid');
                        if (room_jid === jid) {
                            var $badge = $(element).find('.badge');
                            if ($badge.length > 0) {
                                $badge.remove();
                            }
                        }
                    });

                    if(converse.msg_list && converse.msg_list.length > 0){
                        for(var i=0;i<converse.msg_list.length;i++){
                            if(converse.msg_list[i].roomJid === jid){
                                converse.msg_list.splice(i,1);
                            }
                        }
                    }

                    converse.createChatRoom({
                        'id': jid,
                        'jid': jid,
                        'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                        'type': 'chatroom',
                        'box_id': b64_sha1(jid)
                    });
                },

                //新增方法
                createAgentChatRoom: function (ev) {
                    ev.preventDefault();
                    var name, $name, $server, jid, chatroom, official_name,
                        official_id = $(ev.target).attr('data-official-jid'),
                        user_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                        room_jid = "online_" + official_id + "_" + user_jid,
                        user_nick = converse.nick_name,
                        server = converse.muc_service_url,
                        official_info;


                    try {
                        var official_json = $.ajax({
                            url: converse.imapi_url+converse.imapi_official_find,
                            data:{'officialId':official_id,'access_token':converse.access_token},
                            cache: false,
                            async: false
                        }).responseText;
                        official_info = JSON.parse(official_json);
                    } catch (e){
                        console.log(e);
                    }

                    if(official_info && official_info.resultCode && official_info.resultCode === 1 ){
                        if(official_info.data && official_info.data.onlineService && official_info.data.status === 1 ){
                            official_name = official_info.data.officialName;

                            name = official_name;
                            if (name && server) {
                                jid = room_jid + server.toLowerCase();
                                this.model.save({muc_domain: server});
                            } else {
                                if (!name) { $name.addClass('error'); }
                                if (!server) { $server.addClass('error'); }
                                return;
                            }

                            var isExists = converse.roomIsExists(room_jid);
                            if(isExists){
                                var obj = {nick:user_jid,name:name};
                                converse_api.rooms.open(jid, obj);
                                return true;
                            }

                            var members = [official_id];
                            var members_json = JSON.stringify(members);
                            //$.post(converse.imapi_url+converse.imapi_room_add,{name:name, longitude:0, cityId:0, provinceId:0, areaId:0, countryId:0, latitude:0, access_token:converse.access_token, roomName:name, jid:room_jid, text:members_json},function(data,status){
                            $.post(converse.imapi_url+converse.imapi_session_add,{officialId:official_id,access_token:converse.access_token},function(data,status){
                                var obj = {nick:user_jid,name:name};
                                if(data && data.resultCode == 1){

                                    if(!data.data.newCreated){
                                        var room_info = data.data;

                                        //将数据保存在变量中以便查询时使用
                                        converse.add_room_list(room_info);

                                        var room_jid = jid;
                                        var chatroom = converse.createChatRoom({
                                            'id': room_jid,
                                            'jid': room_jid,
                                            'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(room_jid)) ,
                                            'type': 'chatroom',
                                            'box_id': b64_sha1(room_jid)
                                        });

                                        converse.editOfficialList(room_jid, name, room_info.id);

                                        if(converse.allow_chatlist){

                                            var user_id = room_info.jid.split('_')[2],
                                                official_id = room_info.jid.split('_')[1],
                                                c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                                            if(c_jid != official_id && c_jid != user_id &&
                                                ((!room_info.createUserId) || (room_info.createUserId && Number(room_info.createUserId) != Number(c_jid)))){
                                                converse_api.chatlist.add(room_jid, 'groupchat', true, 1, false);
                                            } else {
                                                converse_api.chatlist.add(room_jid, 'groupchat', false, 0, false);
                                            }

                                        }

                                    }

                                    //1s execute
                                    /*
                                     window.setTimeout(function(){
                                     //邀请公众号
                                     var recipient = official_id + "@" + converse.domain;
                                     converse.invitationMsg(converse.connection.jid, jid, recipient);
                                     converse.emit('roomInviteSent', {
                                     'room': this,
                                     'recipient': recipient,
                                     'reason': ""
                                     });

                                     //邀请自己
                                     var recipient1 = user_jid + "@" + converse.domain;
                                     converse.invitationMsg(converse.connection.jid, jid, recipient1);
                                     converse.emit('roomInviteSent', {
                                     'room': this,
                                     'recipient': recipient1,
                                     'reason': ""
                                     });

                                     //将房间信息添加到变量中
                                     if(data.data){
                                     converse.add_room_list(data.data);
                                     }

                                     //将明细添加到在线客服面板中
                                     converse.editOfficialList(jid, name, data.data.id);

                                     if(converse.allow_chatlist){
                                     converse_api.chatlist.add(Strophe.getBareJidFromJid(jid), 'groupchat', false, 0, false);
                                     }

                                     //session view
                                     var view = converse.chatboxviews.get(jid),
                                     title_url = converse.imapi_url+converse.imapi_download_avatar+'?userId='+ data.data.id + '&type=t&access_token=' + converse.access_token;
                                     if (view) {
                                     view.$el.find('.roster-item-avatar').attr('src',title_url);
                                     }

                                     }, 1000);*/

                                }else{
                                    converse_api.rooms.open(room_jid+server, obj);
                                    /*
                                     var destroy_msg = $iq({
                                     to: jid,
                                     type: "set"
                                     }).c("query", {xmlns: Strophe.NS.MUC + "#owner"}).c("destroy").c("reason").t("房间所有者主动销毁房间");
                                     converse.connection.send(destroy_msg);
                                     */
                                }
                            });
                        } else {
                            if(converse.new_modal){
                                $.dialog('alert',__('prompt'),__("online service function does not exist"),0);
                            }else{
                                alert(__("online service function does not exist"));
                            }
                            return false;
                        }
                    } else {
                        if(converse.new_modal){
                            $.dialog('alert',__('prompt'),__("online service function does not exist"),0);
                        }else{
                            alert(__("online service function does not exist"));
                        }
                        return false;
                    }

                },

                sendSysMsgAfterCreateRoom: function (msg,users,roomJid,inviteMsg) {

                    console.log('inviteMsg:', inviteMsg);
                    var message = JSON.stringify(msg);
                    var initInviteMsg = {};
                    initInviteMsg.packetId = converse.connection.getUniqueId();
                    initInviteMsg.content = inviteMsg;
                    initInviteMsg.fromUserId = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                    initInviteMsg.fromUserName = converse.nick_name;
                    initInviteMsg.toUserId = roomJid;
                    initInviteMsg.objectId = roomJid;
                    initInviteMsg.timeSend = Math.round(Date.now() / 1000);
                    initInviteMsg.type = 907;
                    var initInviteMessage = JSON.stringify(initInviteMsg);
                    var from = converse.connection.jid,to = roomJid;
                    //发送创建群聊消息
                    if (message && to) {
                        var reply = $msg({
                            from: from,
                            to: to,
                            type: 'groupchat',
                            id: msg.packetId
                        }).c('body').t(message).up()
                            .c(converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up();
                        converse.connection.send(reply);
                    }

                    if (initInviteMessage && to) {
                        console.log('发送首次创建房间邀请好友信息:', initInviteMsg);
                        var reply = $msg({
                            from: from,
                            to: to,
                            type: 'groupchat',
                            id: initInviteMsg.packetId
                        }).c('body').t(initInviteMessage).up()
                            .c(converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up();
                        converse.connection.send(reply);
                    }
                },

                createMemberRoom: function () {
                    //获取群成员
                    var member_id = [], member_name = [], server = converse.muc_service_url, that = this;
                    var names = "";
                    $(".create-room-body #listRight [type=checkbox]").each(function (index, el) {
                        member_id[index] = $.trim($(el).val());
                        member_name[index] = $.trim($(el).next('label').text());
                        if(index==0){
                            names += member_name[index];
                        }else {
                            names += ","+member_name[index];
                        }
                    });

                    this.model.save({muc_domain: server});

                    //关闭选择群聊人员框
                    $(".create-room").remove();

                    var name = converse.nick_name + "," + member_name.join(','),
                        room_jid = converse_api.createroom.randomJid(true, 32, 32),
                        jid = room_jid + server.toLowerCase(),
                        user_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                        chatroom,
                        members_json = JSON.stringify(member_id);

                    if(name.length > 20){
                        name = name.substring(0,20);
                        name += '...';
                    }

                    //在converse中新建群聊
                    chatroom = converse.createChatRoom({
                        'id': jid,
                        'jid': jid,
                        'name': name ,
                        'type': 'chatroom',
                        'box_id': b64_sha1(jid)
                    });

                    //在imapi新建群聊
                    $.post(converse.imapi_url + converse.imapi_room_add, {
                        name: name,
                        longitude: 0,
                        cityId: 0,
                        provinceId: 0,
                        areaId: 0,
                        countryId: 0,
                        latitude: 0,
                        access_token: converse.access_token,
                        roomName: name,
                        jid: room_jid,
                        text: members_json
                    }, function (data, status) {
                        if (data && data.resultCode == 1) {
                            var msg1 = '{"packetId":"'+converse.connection.getUniqueId()+'","content":"'+converse.nick_name+'创建了群聊","fromUserId":'+Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid))+',"fromUserName":"'+converse.nick_name+'","toUserId":"'+room_jid+'","objectId":"'+room_jid+'","timeSend":'+parseInt(moment() / 1000)+',"type":10}';
                            var msg = JSON.parse(msg1);
                            that.sendSysMsgAfterCreateRoom(msg,member_id,jid,names);
                            //window.setTimeout(function(){
                                //发送邀请
                                //将自己加入邀请表
                                member_id[member_id.length] = user_jid;
                                //for (var i = 0; i < member_id.length; i++) {
                                //    var recipient = member_id[i] + "@" + converse.domain;
                                //    converse.invitationMsg(converse.connection.jid, jid, recipient);
                                //    converse.emit('roomInviteSent', {
                                //        'room': this,
                                //        'recipient': recipient,
                                //        'reason': ""
                                //    });
                                //}

                                //将房间信息添加到变量中
                                if(data.data){
                                    var c_m_l = converse.muc_room_list;
                                    if( c_m_l && c_m_l.length > 0){
                                        var isExist = false;
                                        for(var j=0;j<c_m_l.length;j++){
                                            var c_room = c_m_l[j];
                                            if(data.data.jid == c_room.jid){
                                                isExist = true;
                                            }
                                        }
                                        if(!isExist){
                                            c_m_l[c_m_l.length] = data.data;
                                        }
                                    }else{
                                        c_m_l[c_m_l.length] = data.data;
                                    }
                                    converse.muc_room_list = c_m_l;
                                }

                                var fragment = document.createDocumentFragment(),
                                    title_url = converse.imapi_url+converse.imapi_download_avatar+'?userId='+ data.data.id + '&type=t&access_token=' + converse.access_token;
                                fragment.appendChild($(
                                    converse.templates.room_item({
                                        'title_url': title_url,
                                        'default_img': converse.emoticons_file_path + converse.room_default_img,
                                        'name':name,
                                        'jid':jid,
                                        'open_title': __('Click to open this room'),
                                        'info_title': __('Show more information on this room')
                                    })
                                )[0]);

                                var isExists = false;
                                //在群聊列表中查看是否有此房间的明细，如果有不添加
                                $('#chatrooms #available-chatrooms dd.available-chatroom').each(function(index,element){
                                    var a_btn =$(element).find('a');
                                    var room_jid = a_btn.attr('data-room-jid');
                                    if(room_jid === jid){
                                        isExists = true;
                                    }
                                });

                                if(!isExists){
                                    $('#chatrooms #available-chatrooms').prepend(fragment);
                                }

                                //add chatlist
                                if(converse.allow_chatlist){
                                    converse_api.chatlist.add(jid, 'groupchat', false, 0, false);
                                }

                                //add user contact list
                                that.addRosterView(jid, data.data.id, name);

                                //session view
                                var view = converse.chatboxviews.get(jid);
                                if (view) {
                                    view.$el.find('.roster-item-avatar').attr('src',title_url);
                                }

                            //}, 1000);

                        }else{
                            /*
                             var destroy_msg = $iq({
                             to: jid,
                             type: "set"
                             }).c("query", {xmlns: Strophe.NS.MUC + "#owner"}).c("destroy").c("reason").t("房间所有者主动销毁房间");
                             converse.connection.send(destroy_msg);
                             */
                        }
                    });
                },

                addRosterView: function (room_jid, room_id, room_name){
                    var isPandlExists = false;
                    //在群聊列表中查看是否有此房间的明细，如果有不添加
                    $('#conversejs #converse-controlbox-official-rooms .rosterview-room-group-item').each(function(index,element){
                        var a_btn =$(element).find('a');
                        var jid = a_btn.attr('data-room-jid');
                        if(jid === room_jid){
                            isPandlExists = true;
                        }
                    });

                    if(!isPandlExists){
                        //添加到面板中
                        var title_url = converse.imapi_url+converse.imapi_download_avatar+'?userId='+ room_id + '&type=t&access_token=' + converse.access_token;
                        $('#conversejs #converse-controlbox-official-rooms .rosterview-room-item-list').prepend(
                            converse.templates.rosterview_room_item({
                                'room_name': room_name,
                                'jid_id': room_jid,
                                'open_title': __('Click to open this online service'),
                                'title_url': title_url,
                                'default_img': converse.emoticons_file_path + converse.room_default_img
                            }));
                    }
                }

            });
            /************************ End of ChatRoomView **********************/

            if(!converse.converse_complete_model){
                converse.createAgentChatRoom = function (official_id) {
                    var name, $name, $server, jid, chatroom, official_name,
                        user_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                        room_jid = "online_" + official_id + "_" + user_jid,
                        user_nick = converse.nick_name,
                        server = converse.muc_service_url,
                        official_info;

                    try {
                        var official_json = $.ajax({
                            url: converse.imapi_url + converse.imapi_official_find,
                            data: {'officialId': official_id, 'access_token': converse.access_token},
                            cache: false,
                            async: false
                        }).responseText;
                        official_info = JSON.parse(official_json);
                    } catch (e) {
                        console.log(e);
                    }

                    if (official_info && official_info.resultCode && official_info.resultCode === 1) {
                        if (official_info.data && official_info.data.onlineService && official_info.data.status === 1) {
                            official_name = official_info.data.officialName;

                            name = official_name;

                            /*
                             var isExists = converse.roomIsExists(room_jid);
                             if (isExists) {
                             var obj = {nick: user_jid, name: name};
                             converse_api.rooms.open(jid, obj);
                             return true;
                             }*/

                            var members = [official_id];
                            var members_json = JSON.stringify(members);
                            $.post(converse.imapi_url + converse.imapi_session_add, {
                                officialId: official_id,
                                access_token: converse.access_token
                            }, function (data, status) {

                                var obj = {nick:user_jid,name:name};
                                if (data && data.resultCode == 1) {

                                    if(!data.data.newCreated){
                                        converse.add_room_list(data.data, false);
                                        converse_api.rooms.open(room_jid + server.toLowerCase(), obj);
                                    }
                                } else {
                                    // converse_api.rooms.open(room_jid + server.toLowerCase(), obj);
                                    if (converse.new_modal) {
                                        $.dialog('alert', __('prompt'), __("online service function does not exist"), 0);
                                    } else {
                                        alert(__("online service function does not exist"));
                                    }
                                    return false;
                                }

                            });
                        } else {
                            if (converse.new_modal) {
                                $.dialog('alert', __('prompt'), __("online service function does not exist"), 0);
                            } else {
                                alert(__("online service function does not exist"));
                            }
                            return false;
                        }
                    } else {
                        if (converse.new_modal) {
                            $.dialog('alert', __('prompt'), __("online service function does not exist"), 0);
                        } else {
                            alert(__("online service function does not exist"));
                        }
                        return false;
                    }
                }
            }

            converse.onDirectMUCInvitation = function (message) {
                /* A direct MUC invitation to join a room has been received
                 * See XEP-0249: Direct MUC invitations.
                 *
                 * Parameters:
                 *  (XMLElement) message: The message stanza containing the
                 *        invitation.
                 */
                var $message = $(message),
                    $x = $message.children('x[xmlns="'+Strophe.NS.MUC_USER+'"]'),
                    from = Strophe.getBareJidFromJid($message.attr('from')),
                    room_jid = $message.attr('from'),
                    reason = $x.attr('reason'),
                    contact = converse.roster?converse.roster.get(from):null,
                    result;

                var $invite = $x.children('invite');
                if($invite.length == 0){
                    return;
                }

                //Query whether there is a local
                var c_m_l = converse.muc_room_list,
                    im_room_jid = Strophe.getNodeFromJid(room_jid);
                if( c_m_l && c_m_l.length > 0){
                    for(var j=0;j<c_m_l.length;j++){
                        var c_room = c_m_l[j];
                        if(im_room_jid === c_room.jid){
                            return;
                        }
                    }
                }

                if (converse.auto_join_on_invite) {
                    result = true;
                } else {
                    // Invite request might come from someone not your roster list
                    contact = contact? contact.get('fullname'): Strophe.getNodeFromJid(from);
                    if (!reason) {
                        result = confirm(
                            __(___("%1$s has invited you to join a chat room: %2$s"),
                                contact, room_jid)
                        );
                    } else {
                        result = confirm(
                            __(___('%1$s has invited you to join a chat room: %2$s, and left the following reason: "%3$s"'),
                                contact, room_jid, reason)
                        );
                    }
                }
                if (result === true && (converse.converse_complete_model || ((!converse.converse_complete_model) && converse.default_form && (im_room_jid.indexOf('online')>=0)))) {

                    //此判断用于用户简易版下接收客服发起当前租户下的在线客服
                    if(!converse.converse_complete_model){
                        if(!converse.tenant_id){
                            return;
                        }

                        var tenant_official = converse.officialByDomain(converse.tenant_id);

                        if(!tenant_official){
                            return;
                        }

                        var official_id = im_room_jid.split('_')[1];
                        if(Number(tenant_official.officialId) != Number(official_id)){
                            return;
                        }
                    }

                    var html = $.ajax({
                        url: converse.imapi_url+converse.imapi_room_get,
                        data:{roomJid:im_room_jid,access_token:converse.access_token},
                        cache: false,
                        async: false
                    }).responseText;
                    var room_info = JSON.parse(html);
                    if(room_info && room_info.data ){
                        var name = room_info.data.name,
                            chatroom,
                            open_session = false;

                        if(im_room_jid.indexOf('online')>=0) {
                            var user_id = im_room_jid.split('_')[2],
                                official_id = im_room_jid.split('_')[1],
                                c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                            //客服
                            if(c_jid != official_id && c_jid != user_id){
                                var user = converse.getUserInfo2(user_id),
                                    official = converse.officialInfo(Number(official_id)),
                                    official_name = official && official.officialName ? official.officialName : (room_info && room_info.name ? room_info.name.name:'');
                                name = user&&user.nickname ? user.nickname  + '(' + official_name + ')' : d.nickname + '(' + official_name + ')';
                            }

                            if((room_info.data.createUserId && Number(room_info.data.createUserId) === Number(c_jid))){
                                open_session = true;
                            } else if (c_jid === user_id && !room_info.data.createUserId && !converse_complete_model) {
                                open_session = true;
                            }
                        }

                        if(converse.allow_chatlist){

                            if(open_session){
                                chatroom = converse.createChatRoom({
                                    'id': room_jid,
                                    'jid': room_jid,
                                    'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(room_jid)) ,
                                    'type': 'chatroom',
                                    'box_id': b64_sha1(room_jid)
                                });
                            } else {
                                chatroom = converse.chatboxviews.showChat(
                                    _.extend({
                                        'id': room_jid,
                                        'jid': room_jid,
                                        'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(room_jid)),
                                        'nick': Strophe.unescapeNode(Strophe.getNodeFromJid(converse.connection.jid)),
                                        'type': 'chatroom',
                                        'box_id': b64_sha1(room_jid),
                                        'password': $x.attr('password')
                                    }, {
                                        'type': 'chatroom',
                                        'affiliation': null,
                                        'features_fetched': false,
                                        'hidden': open_session?false:true,
                                        'membersonly': false,
                                        'moderated': false,
                                        'nonanonymous': false,
                                        'open': open_session,
                                        'passwordprotected': false,
                                        'persistent': false,
                                        'public': false,
                                        'semianonymous': false,
                                        'temporary': false,
                                        'unmoderated': false,
                                        'unsecured': false,
                                        'show': open_session,
                                        'new_session': true,
                                        'connection_status': Strophe.Status.DISCONNECTED
                                    })
                                );
                            }

                        } else {
                            chatroom = converse.createChatRoom({
                                'id': room_jid,
                                'jid': room_jid,
                                'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(room_jid)),
                                'nick': Strophe.unescapeNode(Strophe.getNodeFromJid(converse.connection.jid)),
                                'type': 'chatroom',
                                'box_id': b64_sha1(room_jid),
                                'password': $x.attr('password')
                            });
                        }

                        if (!_.contains(
                                [Strophe.Status.CONNECTING, Strophe.Status.CONNECTED],
                                chatroom.get('connection_status'))
                        ) {
                            //历史会话窗口是开着的，所以加入房间
                            var boxviews = converse.chatboxviews.get(room_jid);
                            boxviews.join();
                            boxviews.$el.find('.chat-textarea').removeClass('chat-textarea-readonly').removeAttr("readonly").removeAttr('disabled');
                            boxviews.$el.find('.chat-toolbar').removeClass('chat-toolbar-readonly').removeAttr('disabled');

                            if(room_info.data.createUserId && Number(room_info.data.createUserId) != Number(c_jid)){
                                boxviews.$el.find('.chat-head .close-chatbox-button').remove();
                            }

                            //获取创建房间到此时的信息
                            var jid = room_jid,
                                id = room_info.data.jid,
                                room = converse.imRoomInfo(id),
                                $message_list = boxviews.$el.find('.chat-message');

                            var data = {room_jid_id:id, access_token:converse.access_token, pageIndex:0, pageSize:converse.message_pagesize};

                            data.startTime = room ? room.createTime * 1000 : new Date().getTime();

                            var result_json = $.ajax({
                                url: converse.imapi_url+converse.imapi_room_message,
                                data:data,
                                async: false
                            }).responseText;
                            var result = JSON.parse(result_json);
                            if(result && result.resultCode && result.resultCode == 1 && result.data){

                                //在线客服加载创建房间到此时的聊天记录
                                if(id.indexOf('online')>=0) {
                                    var user_id = id.split('_')[2],
                                        official_id = id.split('_')[1],
                                        c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                                    //获取已存在消息标记集合
                                    var chat_msgid = [];
                                    if ($message_list.length > 0) {
                                        $message_list.each(function (index, e) {
                                            var mid = $(e).attr('data-msgid');
                                            chat_msgid[chat_msgid.length] = mid;
                                        });
                                    }

                                    for (var i = 0; i < result.data.length; i++) {
                                        var time = moment(result.data[i].ts).format(),
                                            nick = result.data[i].fromUserName,
                                            sender = result.data[i].sender === Number(c_jid) ? 'me' : 'them',
                                            text = JSON.stringify(result.data[i]),
                                            msgid = result.data[i].packetId,
                                            isExist = false;

                                        var dupes = boxviews.model.messages.filter(function (msg) {
                                            return msg.get('msgid') === msgid;
                                        });

                                        if (!dupes || (dupes && dupes.length === 0)) {
                                            if(result.data[i].type != 601 || (result.data[i].type === 601 && result.data[i].objectId)){
                                                boxviews.model.messages.create({
                                                    fullname: nick,
                                                    sender: sender,
                                                    time: time,
                                                    message: text,
                                                    msgid: msgid,
                                                    archive_id: true,
                                                    type: 'groupchat'
                                                });

                                                //显示到消息列表会话下
                                                if(converse.allow_chatlist){
                                                    converse_api.chatlist.updateItemMsg(boxviews.model.get('jid'), text, 'groupchat');
                                                }

                                            }
                                        }
                                    }
                                }
                            }

                        }

                        if(im_room_jid.indexOf('online')>=0) {
                            //将数据保存在变量中以便查询时使用
                            var c_m_l = converse.muc_room_list;
                            if(c_m_l && c_m_l.length > 0){
                                var isExist = false;
                                for(var j=0;j<c_m_l.length;j++){
                                    var c_room = c_m_l[j];
                                    if(room_info.data.jid == c_room.jid){
                                        isExist = true;
                                    }
                                }
                                if(!isExist){
                                    c_m_l[c_m_l.length] = room_info.data;
                                }
                            }else{
                                c_m_l[c_m_l.length] = room_info.data;
                            }
                            converse.muc_room_list = c_m_l;

                            converse.editOfficialList(room_jid, name, room_info.data.id);
                        } else {

                            converse.add_room_list(room_info.data, true);
                        }

                        if(converse.allow_chatlist){
                            if(!open_session){
                                var view = converse.chatboxviews.get(room_jid);
                                if(view){
                                    view.close();
                                }
                            }

                            if(im_room_jid.indexOf('online')>=0){
                                var user_id = im_room_jid.split('_')[2],
                                    official_id = im_room_jid.split('_')[1],
                                    c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                                /*if(c_jid != official_id && c_jid != user_id &&
                                 ((!room_info.data.createUserId) || (room_info.data.createUserId && Number(room_info.data.createUserId) != Number(c_jid)))){
                                 if(converse.allow_chatlist) {
                                 converse_api.chatlist.add(room_jid, 'groupchat', true, 1, false);
                                 }
                                 } else {
                                 if(converse.allow_chatlist) {
                                 converse_api.chatlist.add(room_jid, 'groupchat', false, 0, false);
                                 }
                                 }*/
                                if(converse.allow_chatlist) {
                                    converse_api.chatlist.add(room_jid, 'groupchat', false, 0, false);
                                }
                            } else {
                                if(converse.allow_chatlist) {
                                    converse_api.chatlist.add(room_jid, 'groupchat', false, 0, false);
                                }
                            }
                        }
                    }
                }
            };

            if (converse.allow_muc_invitations) {

                var registerDirectInvitationHandler = function () {
                    converse.connection.addHandler(
                        function (message) {
                            converse.onDirectMUCInvitation(message);
                            return true;
                        }, Strophe.NS.MUC_USER, 'message');
                };
                converse.on('connected', registerDirectInvitationHandler);
                converse.on('reconnected', registerDirectInvitationHandler);
            }

            var autoJoinRooms = function () {
                /* Automatically join chat rooms, based on the
                 * "auto_join_rooms" configuration setting, which is an array
                 * of strings (room JIDs) or objects (with room JID and other
                 * settings).
                 */

                if(converse.converse_complete_model){
                    var rooms_list = converse.muc_room_list;
                    if(rooms_list && rooms_list.length > 0){
                        var rooms = new Array();
                        for (var i = 0; i < rooms_list.length; i++) {
                            var d = rooms_list[i];

                            var name = d.name;
                            var jid = d.jid + converse.muc_service_url;
                            var nick = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                            var obj = {jid: jid, nick: nick, name: name};
                            rooms[rooms.length] = obj;
                        }
                        converse.auto_join_rooms = rooms;

                    }else {
                        $.ajax({
                            type : "POST",
                            url : converse.imapi_url+converse.imapi_room_list,
                            data:{access_token:converse.access_token,pageIndex:0,pageSize:10000},
                            cache: false,
                            async : false,
                            success : function(data){
                                var result = data.resultCode;
                                if(result && result == 1) {
                                    if (data.data && data.data.length > 0) {
                                        var rooms = new Array();
                                        for (var i = 0; i < data.data.length; i++) {
                                            var d = data.data[i];

                                            var name = d.name;
                                            var jid = d.jid + converse.muc_service_url;
                                            var nick = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                                            var obj = {jid: jid, nick: nick, name: name};
                                            rooms[rooms.length] = obj;
                                            converse.add_room_list(d, true);
                                        }
                                        converse.auto_join_rooms = rooms;

                                    }
                                }
                            }
                        });
                    }

                    //查看在线客服的房间是否在列表中，如果未有，添加上并加入到变量中
                    var rooms_list_json = $.ajax({
                        url: converse.imapi_url+converse.imapi_oline_room_list,
                        data:{access_token:converse.access_token,pageIndex:0,pageSize:10000},
                        cache: false,
                        async: false
                    }).responseText;
                    var rooms_list = JSON.parse(rooms_list_json);
                    if(rooms_list && rooms_list.resultCode && rooms_list.resultCode == 1){

                        var online_rooms = rooms_list.data;
                        if(online_rooms && online_rooms.length >0){
                            var join_rooms = converse.auto_join_rooms,
                                nick = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                            for( var i=0;i<online_rooms.length;i++) {
                                var d = online_rooms[i],
                                    isExist = false,
                                    jid = d.jid + converse.muc_service_url;
                                for(var j=0;j<join_rooms.length;j++){
                                    if(jid === join_rooms[j].jid){
                                        isExist = true;
                                        continue;
                                    }
                                }
                                if(!isExist){
                                    join_rooms[join_rooms.length] = {jid: jid, nick: nick, name: d.name};

                                    //查看变量中是否存在，不存在保存
                                    converse.add_room_list(d, false);
                                }
                            }
                        }
                    }

                } else {
                    //查询当前租户下是否有在线客服请求

                    if(converse.tenant_id){
                        var tenant_official = converse.officialByDomain(converse.tenant_id);

                        if(tenant_official){

                            var rooms_list_json = $.ajax({
                                url: converse.imapi_url+converse.imapi_oline_room_list,
                                data:{access_token:converse.access_token,pageIndex:0,pageSize:10000},
                                cache: false,
                                async: false
                            }).responseText;
                            var rooms_list = JSON.parse(rooms_list_json);
                            if(rooms_list && rooms_list.resultCode && rooms_list.resultCode == 1){

                                var online_rooms = rooms_list.data;
                                if(online_rooms && online_rooms.length >0){
                                    var join_rooms = converse.auto_join_rooms,
                                        nick = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                                    for( var i=0;i<online_rooms.length;i++) {
                                        var d = online_rooms[i],
                                            isExist = false,
                                            jid = d.jid + converse.muc_service_url;
                                        for(var j=0;j<join_rooms.length;j++){
                                            if(jid === join_rooms[j].jid){
                                                isExist = true;
                                                continue;
                                            }
                                        }

                                        var user_id = d.jid.split('_')[2],
                                            official_id = d.jid.split('_')[1];
                                        if((!isExist) && Number(tenant_official.officialId) === Number(official_id) ){

                                            join_rooms[join_rooms.length] = {jid: jid, nick: nick, name: d.name};

                                            //查看变量中是否存在，不存在保存
                                            converse.add_room_list(d, false);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                _.each(converse.auto_join_rooms, function (room) {
                    if (typeof room === 'string') {
                        converse_api.rooms.open(room);
                    } else if (typeof room === 'object') {
                        //converse_api.rooms.open(room.jid, room.nick);
                        converse_api.rooms.open(room.jid, {nick: room.nick,name: room.name});
                    } else {
                        converse.log('Invalid room criteria specified for "auto_join_rooms"', 'error');
                    }
                });

                converse_api.rooms.close();

                if(converse.converse_complete_model){

                    var official_list = $("#conversejs .add-chatroom-btn");
                    if(official_list.length === 0){
                        $('#conversejs #show-rooms').click();
                    }
                }
            };
            converse.on('chatBoxesFetched', autoJoinRooms);

            converse.getWrappedChatRoom = function (jid, attrs, fetcher) {
                jid = jid.toLowerCase();
                var chatbox = fetcher(_.extend({
                    'id': jid,
                    'jid': jid,
                    'name': attrs.name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                    'type': 'chatroom',
                    'box_id': b64_sha1(jid)
                }, attrs));
                if(typeof(attrs.isHistory)!="undefined" && chatbox && chatbox.attributes){
                    chatbox.attributes.isHistory = attrs.isHistory;
                }
                return converse.wrappedChatBox(chatbox);
            };

            /* We extend the default converse.js API to add methods specific to MUC
             * chat rooms.
             */
            _.extend(converse_api, {
                'rooms': {
                    'pastImg':function(jid,session_type,second){
                        if(!second && second!=0){
                            second = 5000;
                        }else {
                            second = second*1000;
                        }
                        if($(".chat-textarea").length==1){
                            $(function () {
                                try{
                                    setTimeout(function(){
                                        var ccc = 'chat-textarea';
                                        document.querySelector('.'+ccc).addEventListener('click',function(e){console.log(e)});
                                        //_that1.pasteImg("chat-textarea");

                                        document.querySelector('.'+ccc).addEventListener('paste' ,function(e){
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
                                                    var blob = item.getAsFile(),
                                                        reader = new FileReader();

                                                    reader.onload = function (e) {

                                                        //显示图像
                                                        var msg = '<div> <image src=' + e.target.result + '/> </div>';
                                                        //$('.'+textID).html(msg);
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
                                                        //formData.append("uploadType",10063);
                                                        formData.append("access_token",converse.access_token);
                                                        //var data = converse.uploadMessage(formData);
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
                                                                    var d = JSON.parse(data),
                                                                        im_img = d.data['images'],
                                                                        im_other = d.data['others'],
                                                                        im_audios = d.data['audios'],
                                                                        im_videos = d.data['videos'],
                                                                        text;
                                                                    if(d && d.resultCode && d.resultCode == 1 && d.success && d.success == 1){
                                                                        if(im_img[0] && im_img[0].oUrl){
                                                                            text = im_img[0].oUrl;
                                                                        }else if (im_other[0] && im_other[0].oUrl) {
                                                                            text = im_other[0].oUrl;
                                                                        }else if (im_audios[0] && im_audios[0].oUrl) {
                                                                            text = im_audios[0].oUrl;
                                                                        }else if (im_videos[0] && im_videos[0].oUrl) {
                                                                            text = im_videos[0].oUrl;
                                                                        }

                                                                        if(text){
                                                                            var ext=text.substring(text.lastIndexOf("\.")).toUpperCase();
                                                                            var fileType = 9,
                                                                                user_id = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                                                                            if(ext ==='.BMP' || ext ==='.PNG' || ext ==='.JPG' || ext ==='.JPEG' || ext ==='.GIF'){
                                                                                fileType = 2;
                                                                            } else if( ext ==='.MP4'){//avi video 标签不支持
                                                                                fileType = 6;
                                                                            }else if(ext === '.M4A' || ext === '.MP3'){//mp3使用audio播放 cgh7953
                                                                                fileType = 3;
                                                                            }
                                                                            var msg_text = {content: text,filePath:file_name, fromUserId: user_id, fromUserName: converse.nick_name,timeSend:parseInt(moment() / 1000),type:fileType};

                                                                            var msgid = converse.connection.getUniqueId();
                                                                            var msg = $msg({
                                                                                from: converse.connection.jid,
                                                                                to: jid,
                                                                                type: session_type,
                                                                                id: msgid
                                                                            }).c('body').t(JSON.stringify(msg_text)).up()
                                                                                .c(converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up();
                                                                            converse.connection.send(msg);

                                                                            if(session_type === 'chat'){
                                                                                var view = converse.chatboxes.getChatBox(jid);
                                                                                var toUserId = Strophe.unescapeNode(Strophe.getNodeFromJid(jid));
                                                                                var user = converse.getUserInfo2(toUserId);
                                                                                view.messages.create({
                                                                                    fullname: user.nickname,
                                                                                    sender: 'me',
                                                                                    time: moment().format(),
                                                                                    message: JSON.stringify(msg_text),
                                                                                    msgid: msgid
                                                                                });
                                                                            }

                                                                            //消息列表第一
                                                                            if (converse.allow_chatlist) {
                                                                                converse_api.chatlist.first(jid, session_type);
                                                                                converse_api.chatlist.updateItemMsg(jid, JSON.stringify(msg_text), session_type);
                                                                            }
                                                                        }else{
                                                                            if(converse.new_modal){
                                                                                $.dialog('alert',__('prompt'),__('Upload failed'),0);
                                                                            }else{
                                                                                alert(__('Upload failed'));
                                                                            }
                                                                        }
                                                                    }else{
                                                                        if(converse.new_modal){
                                                                            $.dialog('alert',__('prompt'),__('Upload failed'),0);
                                                                        }else{
                                                                            alert(__('Upload failed'));
                                                                        }
                                                                    }
                                                                }
                                                            });
                                                        } catch (e) {
                                                            if (converse.debug) {
                                                                console.log(' error:' + e);
                                                            }
                                                            return null;
                                                        }

                                                    };

                                                    reader.readAsDataURL(blob);
                                                }
                                            }
                                        });


                                    },second);
                                }catch(e){
                                        console.error(e);
                                }

                            });
                        }
                    },
                    'close': function (jids, leave) {
                        if (typeof jids === "undefined") {
                            converse.chatboxviews.each(function (view) {
                                if (view.is_chatroom && view.model) {
                                    view.close();
                                }
                            });
                        } else if (typeof jids === "string") {
                            var view = converse.chatboxviews.get(jids);
                            if (view) {
                                if(leave){
                                    var id = Strophe.getNodeFromJid(jids);
                                    var room_list = converse.muc_room_list;
                                    if(room_list && room_list.length > 0){
                                        for(var r=0;r<room_list.length;r++){
                                            if(id === room_list[r].jid){
                                                room_list.splice(r,1);
                                                break;
                                            }
                                        }
                                    }
                                }
                                view.close();
                            } else if ((!view) && leave) {
                                converse.muc_leave(jids);
                            }
                        } else {
                            _.map(jids, function (jid) {
                                var view = converse.chatboxviews.get(jid);
                                if (view) { view.close(); }
                            });
                        }
                    },
                    'open': function (jids, attrs) {

                        if(converse.queryCreateRoomPanel()){
                            return;
                        }

                        if (typeof attrs === "string") {
                            attrs = {'nick': attrs};
                        } else if (typeof attrs === "undefined") {
                            attrs = {};
                        }
                        if (_.isUndefined(attrs.maximize)) {
                            attrs.maximize = false;
                        }
                        if (!attrs.nick && converse.muc_nickname_from_jid) {
                            attrs.nick = Strophe.getNodeFromJid(converse.bare_jid);
                        }
                        if (typeof jids === "undefined") {
                            throw new TypeError('rooms.open: You need to provide at least one JID');
                        } else if (typeof jids === "string") {
                            if(!attrs.name && !attrs.nick){
                                var room = converse.roomInfo(Strophe.getNodeFromJid(jids)),
                                    user_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                                if(room) {
                                    if (converse.msg_list && converse.msg_list.length > 0) {
                                        for (var i = 0; i < converse.msg_list.length; i++) {
                                            if (converse.msg_list[i].roomJid === jids) {
                                                converse.msg_list.splice(i, 1);
                                            }
                                        }
                                    }

                                    attrs.nick = user_jid;
                                    attrs.name = room.name;
                                } else {
                                    if(converse.new_modal){
                                        $.dialog('alert',__('prompt'),__("This room does not (yet) exist"),0);
                                    }else{
                                        alert(__("This room does not (yet) exist"));
                                    }
                                    return false;
                                }
                            }

                            return converse.getWrappedChatRoom(jids, attrs, converse.createChatRoom);
                        }
                        return _.map(jids, _.partial(converse.getWrappedChatRoom, _, attrs, converse.createChatRoom));
                    },
                    'get': function (jids, attrs, create) {
                        if (typeof attrs === "string") {
                            attrs = {'nick': attrs};
                        } else if (typeof attrs === "undefined") {
                            attrs = {};
                        }
                        if (typeof jids === "undefined") {
                            var result = [];
                            converse.chatboxes.each(function (chatbox) {
                                if (chatbox.get('type') === 'chatroom') {
                                    result.push(converse.wrappedChatBox(chatbox));
                                }
                            });
                            return result;
                        }
                        var fetcher = _.partial(converse.chatboxviews.getChatBox.bind(converse.chatboxviews), _, create);
                        if (!attrs.nick) {
                            attrs.nick = Strophe.getNodeFromJid(converse.bare_jid);
                        }
                        if (typeof jids === "string") {

                            return converse.getWrappedChatRoom(jids, attrs, fetcher);
                        }
                        return _.map(jids, _.partial(converse.getWrappedChatRoom, _, attrs, fetcher));
                    },
                    'get_token':function(){
                        return converse.access_token;
                    },
                    'online_service':function (official_name, official_id) {
                        var btn = COM.repeat('online_service'+official_id,4);
                        if(btn){
                            alert("不能频繁操作，请"+btn+"秒后再试！");
                            return ;
                        }
                        var official_account;

                        if(converse.queryCreateRoomPanel()){
                            return;
                        }

                        if(converse.last_online_service) {
                            if(official_name && converse.last_online_service.name === official_name && (new Date().getTime() - converse.last_online_service.time) < 4000){
                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__("Frequent operation, try again later"),0);
                                }else{
                                    alert(__("Frequent operation, try again later"));
                                }
                                return false;
                            } else if (official_id && converse.last_online_service.id === official_id  && (new Date().getTime() - converse.last_online_service.time) < 4000) {
                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__("Frequent operation, try again later"),0);
                                }else{
                                    alert(__("Frequent operation, try again later"));
                                }
                                return false;
                            }
                        }

                        if(official_name){
                            var official_list = converse.official_list,
                                official_name = $.trim(official_name);
                            if(official_list && official_list.length > 0){
                                for(var i=0;i<official_list.length;i++){
                                    if($.trim(official_list[i].officialName) === official_name){
                                        official_account = official_list[i];
                                        break;
                                    }
                                }
                            }

                            if(!official_account){
                                var official_json = $.ajax({
                                    url: converse.imapi_url+converse.imapi_official_find,
                                    data:{'officialName':official_name,'access_token':converse.access_token},
                                    cache: false,
                                    async: false
                                }).responseText;
                                var official_info = JSON.parse(official_json);
                                if(official_info && official_info.resultCode && official_info.resultCode == 1 && official_info.data && official_info.data.onlineService) {
                                    official_account = official_info.data;
                                    if(official_list && official_list.length > 0){
                                        official_list[official_list.length] = official_account;
                                    }else{
                                        official_list = new Array();
                                        official_list[0] = official_account;
                                    }
                                    converse.official_list = official_list;
                                }
                            }

                        } else {
                            if(official_id){
                                official_account = converse.officialInfo(official_id);
                            }
                        }

                        if(official_account){
                            var c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));
                            var room_id = 'online_' + official_account.officialId + '_' + c_jid + converse.muc_service_url;
                            var view = converse.chatboxviews.get(room_id);

                            if(view){
                                if (_.contains(
                                        [Strophe.Status.CONNECTING, Strophe.Status.CONNECTED],
                                        view.model.get('connection_status'))
                                ) {
                                    view.show();
                                    return;
                                }
                            }

                            if(converse.account_name && !(converse.account_name === official_account.domain)){
                                if(converse.converse_complete_model) {
                                    var official_list = $("#conversejs .add-chatroom-btn");
                                    if (official_list.length === 0) {
                                        $('#conversejs #show-rooms').click();
                                    }
                                    $("#conversejs .add-chatroom-btn").each(function (index, el) {
                                        var jid = $(el).attr('data-official-jid');
                                        if (Number($.trim(jid)) === official_account.officialId) {
                                            $(el).click();
                                            return false;
                                        }
                                    });
                                } else {
                                    converse.createAgentChatRoom(official_account.officialId);
                                }
                            } else if (converse.account_name && converse.account_name === official_account.domain && !converse.is_agent) {
                                if (converse.converse_complete_model) {
                                    var official_list = $("#conversejs .add-chatroom-btn");
                                    if (official_list.length === 0) {
                                        $('#conversejs #show-rooms').click();
                                    }
                                    $("#conversejs .add-chatroom-btn").each(function (index, el) {
                                        var jid = $(el).attr('data-official-jid');
                                        if (Number($.trim(jid)) === official_account.officialId) {
                                            $(el).click();
                                            return false;
                                        }
                                    });
                                } else {
                                    converse.createAgentChatRoom(official_account.officialId);
                                }
                            } else {
                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__("Don't allow customer own service"),0);
                                }else{
                                    alert(__("Don't allow customer own service"));
                                }
                            }

                        }else{
                            if(converse.new_modal){
                                $.dialog('alert',__('prompt'),__("online service function does not exist"),0);
                            }else{
                                alert(__("online service function does not exist"));
                            }
                        }

                    },
                    'refresh_agent':function(){
                        var user = converse.imapiUser(Strophe.getNodeFromJid(converse.jid));
                        if(user){
                            if(user.isAgent){

                                if($('#conversejs #controlbox .operation-panel .converse-check-online-panel').length === 0){
                                    var label_click_btn, label_info, show_agent_state = false;

                                    if(!converse.agent_status || (converse.agent_status && converse.agent_status === 2 && converse.agent_state && converse.agent_state === 'checkout')){
                                        label_click_btn = __('agent_online');
                                        label_info = __('sign in');
                                    } else {
                                        label_click_btn = __('agent_offline');
                                        label_info = __('sign out');
                                        show_agent_state = true;
                                    }

                                    var html = '<div class="converse-check-online-panel" style="float: left;margin-right: 5px">';
                                    html += '<a class="icon-pencil '+label_click_btn+'" href="javascript:void(0);" title="'+label_info+'"> </a></div>';

                                    var agent_state_html = '<ul style="display: none;padding: 5px" class="head-toolbar-online-ul">',
                                        options = [{value: 'available', ico: 'online', text: '空闲'}, {
                                            value: 'calling',
                                            ico: 'phone',
                                            text: '通话中'
                                        }, {value: 'busy', ico: 'dnd', text: '忙碌'}, {value: 'rest', ico: 'away', text: '小休'}];

                                    //客服当前状态，如果未有数据，则以空闲为初始化
                                    var agent_state_description = options[0].text,
                                        agent_state_val = options[0].value,
                                        agent_state_icon = options[0].ico;
                                    for (var s = 0; s < options.length; s++) {
                                        agent_state_html += converse.templates.status_option({
                                            'value': options[s].value,
                                            'text': options[s].text,
                                            'ico': options[s].ico,
                                            'status_class': 'im_status_list'
                                        });
                                        if(converse.agent_state && converse.agent_state === options[s].value){
                                            agent_state_description = options[s].text;
                                            agent_state_val = options[s].value;
                                            agent_state_icon = options[s].ico;
                                        }
                                    }
                                    agent_state_html += '</ul>';

                                    html += '<div class="agent-status-panel" style="'+(show_agent_state?'':"display:none;")+' ">';
                                    html += '<a id="agent-status" class="'+agent_state_val+' icon-'+agent_state_icon+'" data-value="'+agent_state_description+'" title="'+agent_state_description+'" href="javascript:void(0);"></a>';
                                    html += agent_state_html + '</div>';

                                    $('#conversejs #controlbox .operation-panel .create-room-panel').after(html);
                                }
                            } else {
                                if($('#conversejs #controlbox .operation-panel .converse-check-online-panel').length > 0){
                                    $('#conversejs #controlbox .operation-panel .converse-check-online-panel').remove();
                                    $('#conversejs #controlbox .operation-panel .agent-status-panel').remove();
                                }
                            }
                        }

                    }
                }
            });
            //存储变量信息
            var VAR ={
                repeatTemp:[]
            };

            var COM = {
                repeat:function(s,t){//限制执行频率，默认为60秒 允许执行时返回false
                    t = t ? t * 1000 : 60000;//毫秒
                    var time = microtime();
                    if(!VAR.repeatTemp[s]){
                        VAR.repeatTemp[s] = time;
                        return false;//允许
                    }else{
                        var ts = t - (time - VAR.repeatTemp[s]);
                        ts = parseInt(ts/1000);
                        if(ts > 0){

                            return ts;//禁止执行
                        }else{

                            VAR.repeatTemp[s] = time;//更新时间
                            return false;//允许
                        }
                    }
                }
            };
            //获取毫秒级时间戳
            function microtime(){

                return new Date().getTime();
            }

            var reconnectToChatRooms = function () {
                /* Upon a reconnection event from converse, join again
                 * all the open chat rooms.
                 */

                converse.chatboxviews.each(function (view) {
                    if (view.model.get('type') === 'chatroom') {
                        /*view.model.save('connection_status', Strophe.Status.DISCONNECTED);
                         view.join();*/

                        if(converse.converse_complete_model && !converse.default_form){
                            view.model.save('connection_status', Strophe.Status.DISCONNECTED);
                            view.join();
                        } else {
                            var id = Strophe.getNodeFromJid(view.model.get('jid'));
                            var room = converse.imRoomInfo(id);
                            if(room){
                                view.model.save('connection_status', Strophe.Status.DISCONNECTED);
                                view.join();
                            } else {
                                view.close();
                            }
                        }
                    }
                });

            };
            converse.on('reconnected', reconnectToChatRooms);

            var disconnectChatRooms = function () {
                /* When disconnecting, or reconnecting, mark all chat rooms as
                 * disconnected, so that they will be properly entered again
                 * when fetched from session storage.
                 */
                converse.chatboxes.each(function (model) {
                    if (model.get('type') === 'chatroom') {
                        model.save('connection_status', Strophe.Status.DISCONNECTED);
                    }
                });
            };
            converse.on('reconnecting', disconnectChatRooms);
            converse.on('disconnecting', disconnectChatRooms);
        }
    });
}));