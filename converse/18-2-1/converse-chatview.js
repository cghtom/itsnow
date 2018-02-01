// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

(function (root, factory) {
    define("converse-chatview", [
        "converse-core",
        "converse-api",
        "tpl!chatbox",
        "tpl!new_day",
        "tpl!action",
        "tpl!message",
        "tpl!toolbar",
        "tpl!avatar",
        "tpl!message_article"
    ], factory);
}(this, function (
    converse,
    converse_api,
    tpl_chatbox,
    tpl_new_day,
    tpl_action,
    tpl_message,
    tpl_toolbar,
    tpl_avatar,
    tpl_message_article
) {
    "use strict";
    converse.templates.chatbox = tpl_chatbox;
    converse.templates.new_day = tpl_new_day;
    converse.templates.action = tpl_action;
    converse.templates.message = tpl_message;
    converse.templates.toolbar = tpl_toolbar;
    converse.templates.avatar = tpl_avatar;
    converse.templates.message_article = tpl_message_article;

    var $ = converse_api.env.jQuery,
        utils = converse_api.env.utils,
        Strophe = converse_api.env.Strophe,
        $msg = converse_api.env.$msg,
        _ = converse_api.env._,
        __ = utils.__.bind(converse),
        moment = converse_api.env.moment;

    var KEY = {
        ENTER: 13,
        FORWARD_SLASH: 47
    };

    //存储变量信息
    var VAR ={
        repeatTemp:[]
    };

    var COM = {
        repeat:function(key){//限制执行频率，默认为60秒 允许执行时返回false
            if(!VAR.repeatTemp[key]){
                VAR = {repeatTemp:[]};
                VAR.repeatTemp[key] = 1;
                return true;//允许
            }else{
                return false;
            }
        }
    };

    var lastH = 0;
    converse_api.plugins.add('converse-chatview', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view) {
                        view = new converse.ChatBoxView({model: item});
                        this.add(item.get('id'), view);
                        return view;
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
            this.updateSettings({
                show_toolbar: true,
                chatview_avatar_width: 32,
                chatview_avatar_height: 32,
                visible_toolbar_buttons: {
                    'emoticons': true,
                    'call': false,
                    'clear': true
                },
            });

            converse.ChatBoxView = Backbone.View.extend({
                length: 650,
                tagName: 'div',
                className: 'chatbox hidden',
                is_chatroom: false,  // Leaky abstraction from MUC

                //事件
                events: {
                    'click .close-chatbox-button': 'close',
                    'keypress .chat-textarea': 'keyPressed',
                    'click .chat-textarea': 'clickTextArea',
                    'click .toggle-smiley': 'toggleEmoticonMenu',
                    'click #myTabEmoticon .tab-pane *': 'insertEmoticon',
                    'click .toggle-clear': 'clearMessages',
                    'click .toggle-call': 'toggleCall',
                    'click .new-msgs-indicator': 'viewUnreadMessages',
                    'click .msg-down-img':'chatDownImg',
                    'click .inputfile':'uploadFile',
                    'click .converse_history_query':'historyQuery',
                    'click .msg-withdraw':'clickMsgWithraw',
                    'submit form.add-friend-form': 'addFriendFromForm'
                },

                initialize: function () {
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    // TODO check for changed fullname as well
                    this.model.on('change:chat_state', this.sendChatState, this);
                    this.model.on('change:chat_status', this.onChatStatusChanged, this);
                    this.model.on('change:image', this.renderAvatar, this);
                    this.model.on('change:status', this.onStatusChanged, this);
                    this.model.on('showHelpMessages', this.showHelpMessages, this);
                    this.model.on('sendMessage', this.sendMessage, this);
                    this.render().fetchMessages().insertIntoDOM();
                    // XXX: adding the event below to the events map above doesn't work.
                    // The code that gets executed because of that looks like this:
                    //      this.$el.on('scroll', '.chat-content', this.markScrolled.bind(this));
                    // Which for some reason doesn't work.
                    // So working around that fact here:
                    this.$el.find('.chat-content').on('scroll', this.markScrolled.bind(this));
                    converse.emit('chatBoxInitialized', this);

                    var jid = this.model.get('jid'),
                        id = Strophe.getNodeFromJid(jid),
                        $message_list = this.$el.find('.chat-message');

                    var data = {toUserId:id, access_token:converse.access_token ,pageIndex:0, pageSize:converse.message_pagesize};
                    data.endTime = new Date().getTime();

                    var result_json = $.ajax({
                        url: converse.imapi_url+converse.imapi_chat_message,
                        data: data,
                        async: false
                    }).responseText;
                    var result = JSON.parse(result_json);
                    if(result && result.resultCode && result.resultCode == 1 && result.data){

                        if(result.data.length > 0 && ( result.data.length === converse.message_pagesize || $message_list.length < result.data.length)){
                            this.showSystemHtmlNotificationPrepend('<a class="converse_history_query" jid="'+id+'">历史记录查看</a>',true);
                        }
                    }

                },

                addFriendFromForm: function (ev) {
                    ev.preventDefault();
                    var $input = $(ev.target).find('input');
                    var name = $input.val();
                    if (!name) {
                        if (converse.new_modal) {
                            $.dialog('alert', __('prompt'), __('Please enter the phone number'), 0);
                        } else {
                            alert(__('Please enter the phone number'));
                        }
                        return;
                    }

                    if (name.length == 0) {
                        if (converse.new_modal) {
                            $.dialog('alert', __('prompt'), __('Please enter the phone number'), 0);
                        } else {
                            alert(__('Please enter the phone number'));
                        }
                        return false;
                    }
                    if (name.length != 11) {
                        if (converse.new_modal) {
                            $.dialog('alert', __('prompt'), __('Please enter a valid 11 digit phone number'), 0);
                        } else {
                            alert(__('Please enter a valid 11 digit phone number'));
                        }
                        return false;
                    }
                    var myreg = /^(((13[0-9]{1})|(14[0-9]{1})|(15[0-9]{1})|(17[0-9]{1})|(18[0-9]{1}))+\d{8})$/;
                    if (!myreg.test(name)) {
                        if (converse.new_modal) {
                            $.dialog('alert', __('prompt'), __('Please enter a valid 11 digit phone number'), 0);
                        } else {
                            alert(__('Please enter a valid 11 digit phone number'));
                        }
                        return false;
                    }

                    //查询是否在同事列表中
                    var add_user = converse.imapiUser(null, name);
                    if (add_user && add_user.userId) {
                        var isExist = converse.isExistColleagues(add_user.userId);
                        if (isExist) {
                            if (converse.new_modal) {
                                $.dialog('alert', __('prompt'), __('The user already exists in the list of colleagues'), 0);
                            } else {
                                alert(__('The user already exists in the list of colleagues'));
                            }
                            return false;
                        }
                    } else {
                        if (converse.new_modal) {
                            $.dialog('alert', __('prompt'), __('User does not exist'), 0);
                        } else {
                            alert(__('User does not exist'));
                        }
                        return false;
                    }

                    $.ajax({
                        type: "POST",
                        url: converse.imapi_url + converse.imapi_friend_add,
                        async: false,
                        data: {'toUserTelephone': name, 'access_token': converse.access_token},
                        datatype: "application/x-www-form-urlencoded",//"xml", "html", "script", "json", "jsonp", "text".
                        success: function (data) {
                            var result = data.resultCode;
                            if (result && result == 1) {
                                converse.addFriendsList(add_user);

                                var jid = data.toUserId + '@' + converse.domain;
                                var name = data.toNickname;
                                converse.roster.addAndSubscribe(jid, jid, ['我的好友']);
                                $('.add-friend-dd').hide();
                            } else {
                                if (converse.new_modal) {
                                    $.dialog('alert', __('prompt'), data.resultMsg, 0);
                                } else {
                                    alert(data.resultMsg);
                                }
                            }

                        },
                        error: function () {
                            if (converse.debug) {
                                console.log("error");
                            }
                        }
                    });
                },

                render: function () {
                    var id = Strophe.getNodeFromJid(this.model.get('id')),
                        user = converse.getUserInfo2(id),
                        title = user.nickname;

                    this.$el.attr('id', this.model.get('box_id'))
                        .html(converse.templates.chatbox(
                            _.extend(this.model.toJSON(), {
                                    show_toolbar: converse.show_toolbar,
                                    show_textarea: true,
                                    title: title,
                                    unread_msgs: __('You have unread messages'),
                                    info_close: __('Close this chat box'),
                                    label_personal_message: __('Personal message')
                                }
                            )
                            )
                        );
                    this.$content = this.$el.find('.chat-content');
                    this.renderToolbar().renderAvatar();
                    converse.emit('chatBoxOpened', this);
                    utils.refreshWebkit();
                    return this.showStatusMessage();
                },

                afterMessagesFetched: function () {
                    // Provides a hook for plugins, such as converse-mam.
                    return;
                },

                fetchMessages: function () {
                    this.model.messages.fetch({
                        'add': true,
                        'success': this.afterMessagesFetched.bind(this)
                    });
                    return this;
                },

                insertIntoDOM: function () {
                    /* This method gets overridden in src/converse-controlbox.js if
                     * the controlbox plugin is active.
                     */
                    $('#conversejs').prepend(this.$el);
                    return this;
                },

                clearStatusNotification: function () {
                    this.$content.find('div.chat-event').remove();
                },

                clearWithdrawNotification: function (attr, _this){
                    console.log(attr);
                    console.log(this);
                },

                showStatusNotification: function (message, keep_old, permanent) {
                    if (!keep_old) {
                        this.clearStatusNotification();
                    }
                    var $el = $('<div class="chat-info chat-event"></div>').text(message);
                    if (!permanent) {
                        $el.addClass('chat-event');
                    }
                    this.$content.append($el);
                    this.scrollDown();
                },

                showSystemNotification: function (message, keep_old) {
                    if (!keep_old) {
                        this.clearStatusNotification();
                    }
                    this.$content.append($('<div class="chat-system-info"></div>').text(message));
                    this.scrollDown();
                },
                showSystemMessage: function (message,type) {
                    this.$content.append($('<div class="msg-withdrawal"><div class="msg-withdrawal-css">'+message+'</div></div>'));
                    this.scrollDown();
                },

                showSystemHtmlNotification: function (message, keep_old) {
                    if (!keep_old) {
                        this.clearStatusNotification();
                    }
                    this.$content.append($('<div class="chat-system-info"></div>').html(message));
                    this.scrollDown();
                },

                showSystemHtmlNotificationPrepend: function (message, keep_old) {
                    if (!keep_old) {
                        this.clearStatusNotification();
                    }
                    this.$content.prepend($('<div class="chat-system-info"></div>').html(message));
                    this.scrollDown();
                },

                addSpinner: function () {
                    if (!this.$content.first().hasClass('spinner')) {
                        this.$content.prepend('<span class="spinner"/>');
                    }
                },

                clearSpinner: function () {
                    if (this.$content.children(':first').is('span.spinner')) {
                        this.$content.children(':first').remove();
                    }
                },

                insertDayIndicator: function (date, prepend) {
                    /* Appends (or prepends if "prepend" is truthy) an indicator
                     * into the chat area, showing the day as given by the
                     * passed in date.
                     *
                     * Parameters:
                     *  (String) date - An ISO8601 date string.
                     */
                    var day_date = moment(date).startOf('day');
                    var insert = prepend ? this.$content.prepend: this.$content.append;
                    insert.call(this.$content, converse.templates.new_day({
                        isodate: day_date.format(),
                        datestring: day_date.format("YYYY-MM-DD")
                    }));
                },

                insertMessage: function (attrs, prepend) {
                    /* Helper method which appends a message (or prepends if the
                     * 2nd parameter is set to true) to the end of the chat box's
                     * content area.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message attributes.
                     */
                    var that = this;
                    var insert = prepend ? this.$content.prepend : this.$content.append;
                    _.compose(
                        this.scrollDownMessageHeight.bind(this),
                        function ($el) {
                            insert.call(that.$content, $el);
                            return $el;
                        }
                    )(this.renderMessage(attrs));

                    if(!this.clear_msg_withdraw){
                        this.clear_msg_withdraw = window.setInterval(function(){
                            var $msg = that.$content.find('.me-type');
                            if($msg && $msg.length > 0){
                                $msg.each(function(index, e){
                                    var data_send_time = $(e).attr('data-send-time');
                                    if((new Date().getTime()) - data_send_time >= 120000){
                                        var remove_span = $(e).find(".msg-withdraw");
                                        if(remove_span && remove_span.length > 0){
                                            remove_span.remove();
                                        }
                                    }
                                });
                            }
                        }, 1000);
                    }
                },

                showMessage: function (attrs) {
                    /* Inserts a chat message into the content area of the chat box.
                     * Will also insert a new day indicator if the message is on a
                     * different day.
                     *
                     * The message to show may either be newer than the newest
                     * message, or older than the oldest message.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message attributes.
                     */
                    var msg_dates, idx,
                        $first_msg = this.$content.find('.chat-message:first'),
                        first_msg_date = $first_msg.data('isodate'),
                        current_msg_date = moment(attrs.time) || moment,
                        last_msg_date = this.$content.find('.chat-message:last').data('isodate');

                    if (!first_msg_date) {
                        var first_date = this.$content.children('.chat-message-date:first').find('time').data('isodate');
                        if (!current_msg_date.isAfter(first_date)) {
                            //解决输入状态不显示时会显示日期，下一条消息来时就会存在两个日期
                            var message_child = this.$content.children(':last');
                            if(message_child.length > 0){
                                if(message_child[0].tagName != 'TIME'){
                                    this.insertDayIndicator(current_msg_date);
                                }
                            }else{
                                this.insertDayIndicator(current_msg_date);
                            }
                        }

                        this.insertMessage(attrs);
                        return;
                    }
                    if (current_msg_date.isAfter(last_msg_date) || current_msg_date.isSame(last_msg_date)) {
                        // The new message is after the last message
                        if (current_msg_date.isAfter(last_msg_date, 'day')) {
                            // Append a new day indicator
                            this.insertDayIndicator(current_msg_date);
                        }
                        this.insertMessage(attrs);
                        return;
                    }
                    if (current_msg_date.isBefore(first_msg_date) || current_msg_date.isSame(first_msg_date)) {
                        // The message is before the first, but on the same day.
                        // We need to prepend the message immediately before the
                        // first message (so that it'll still be after the day indicator).
                        //this.insertMessage(attrs, 'prepend');

                        if(current_msg_date.format('YYYY-MM-DD') === moment(first_msg_date).format('YYYY-MM-DD')){
                            var current_msg_date1 = current_msg_date.format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
                            msg_dates = _.map(this.$content.find('.chat-message'), function (el) {
                                return $(el).data('isodate');
                            });
                            msg_dates.push(current_msg_date1);
                            msg_dates.sort();
                            idx = msg_dates.indexOf(current_msg_date1)+1;
                            _.compose(
                                this.scrollDownMessageHeight.bind(this),
                                function ($el) {
                                    if($el && $el.length > 0){
                                        $el.insertBefore(this.$content.find('.chat-message[data-isodate="'+msg_dates[idx]+'"]'));
                                        return $el;
                                    }
                                }.bind(this)
                            )(this.renderMessage(attrs));
                        } else {
                            this.insertMessage(attrs, 'prepend');
                        }

                        if (current_msg_date.isBefore(first_msg_date, 'day')) {
                            // This message is also on a different day, so we prepend a day indicator.
                            this.insertDayIndicator(current_msg_date, 'prepend');
                        }
                        return;
                    }
                    // Find the correct place to position the message
                    current_msg_date = current_msg_date.format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
                    msg_dates = _.map(this.$content.find('.chat-message'), function (el) {
                        return $(el).data('isodate');
                    });
                    msg_dates.push(current_msg_date);
                    msg_dates.sort();
                    idx = msg_dates.indexOf(current_msg_date)-1;
                    _.compose(
                        this.scrollDownMessageHeight.bind(this),
                        function ($el) {
                            if($el && $el.length > 0){
                                $el.insertAfter(this.$content.find('.chat-message[data-isodate="'+msg_dates[idx]+'"]'));
                                return $el;
                            }
                        }.bind(this)
                    )(this.renderMessage(attrs));
                },

                getExtraMessageTemplateAttributes: function (attrs) {
                    // Provides a hook for sending more attributes to the
                    // message template.
                    return {};
                },

                renderMessage: function (attrs) {
                    var msg_time = moment(attrs.time) || moment,
                        msg_message = attrs.message,
                        match = msg_message.match(/^\/(.*?)(?: (.*))?$/),
                        fullname = this.model.get('fullname') || attrs.fullname,
                        extra_classes = attrs.delayed && 'delayed' || '',
                        template,
                        username,
                        type = attrs.type,
                        text = '',
                        system_msg = false,
                        avatar_url,
                        me_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                    var chat_type = this.model.get('type');
                    var user_id = Strophe.getNodeFromJid(this.model.get('id'));
                    var obj = JSON.parse(msg_message);

                    if(obj){
                        var file_flag = '1';

                        if (type && type === 'groupchat'){
                            file_flag = '2';

                            //判断指定类型消息时进行处理
                            if(obj.type && obj.type === 926 && obj.objectId ){
                                //会话结束
                                var room = converse.roomInfo(obj.objectId);
                                if(obj.ts && room && obj.ts > (room.createTime*1000)){
                                    converse.localRoomDel(obj.objectId);
                                }
                                return;
                            } else if (obj.type && obj.type === 925) {
                                if(obj.objectId){
                                    //没有客服
                                    if(converse.isCustomer(obj.objectId)){
                                        var official_id = obj.objectId.split('_')[1],
                                            system_msg;
                                        var official_info = converse.officialInfo(official_id);
                                        if(official_info && official_info.domain){
                                            var domain = official_info.domain,
                                                room = converse.roomInfo(obj.objectId);
                                            var url = 'https://' + domain + converse.itsnow_url + ".itsnow.com" +  converse.itsnow_create_desk ;
                                            if(room){
                                                url += "?sessionId=" + room.id;
                                            }
                                            system_msg = '客服不在线，请选择<a href="' + url + '" target=”_blank">提交工单</a>';
                                        } else {
                                            system_msg = '客服不在线，请稍后再请求会话'
                                        }
                                        //this.showSystemHtmlNotification(system_msg, true);
                                        text = system_msg;
                                    }
                                } else {
                                    text = obj.content;
                                }
                                //return;
                            } else if (obj.type && obj.type === 927 ) {
                                if(obj.objectId){

                                    //客服忙
                                    if(converse.isCustomer(obj.objectId)){
                                        var official_id = obj.objectId.split('_')[1],
                                            system_msg;
                                        var official_info = converse.officialInfo(official_id);
                                        if(official_info && official_info.domain){
                                            var domain = official_info.domain,
                                                room = converse.roomInfo(obj.objectId);
                                            var url = 'https://' + domain + converse.itsnow_url + ".itsnow.com" +  converse.itsnow_create_desk ;
                                            if(room){
                                                url += "?sessionId=" + room.id;
                                            }
                                            system_msg = '当前客服比较繁忙，请选择<a href="' + url + '" target=”_blank">提交工单</a>';
                                        } else {
                                            system_msg = '当前客服比较繁忙，请稍后再请求会话'
                                        }
                                        //this.showSystemHtmlNotification(system_msg, true);
                                        text = system_msg;
                                    }
                                } else {
                                    text = obj.content;
                                }
                                //return;
                            } else if (obj.type && obj.type === 922 ) {
                                if(obj.objectId){
                                    //加入群聊，发送邀请给客服
                                    if(converse.isCustomer(obj.objectId)){
                                        //this.showSystemNotification(obj.content, true);
                                        text = obj.content;
                                    }else{
                                        //this.showSystemNotification(obj.toUserName+'正在请求服务，请及时与客户联系。', true);
                                        text = obj.toUserName+'正在请求服务，请及时与客户联系。';
                                    }
                                } else {
                                    text = obj.content;
                                }
                                //return;
                            } else if (obj.type && obj.type === 923 ) {
                                if(obj.objectId ){
                                    //收到邀请，加入群聊
                                    if(converse.isCustomer(obj.objectId)){
                                        //this.showSystemNotification(obj.content, true);
                                        text = obj.content;
                                    } else {
                                        return;
                                    }
                                    /*
                                     2016-11-30 注销：修复邀请的客服进入后，邀请的客服会再次显示这条消息
                                     else{
                                     this.showSystemNotification("您已进入会话", true);
                                     }*/
                                    //return;
                                } else {
                                    text = obj.content;
                                }

                            } else if (obj.type && obj.type === 929 ) {
                                //客服添加其他客服
                                //this.showSystemNotification(obj.content, true);
                                text = obj.content;
                               // return;
                            } else if (obj.type && obj.type === 930 && obj.objectId ) {
                                //超时关闭会话
                                var room = converse.roomInfo(obj.objectId);
                                if(obj.ts && room && obj.ts > (room.createTime*1000)){
                                    console.log('ts:'+obj.ts);
                                    console.log('create:'+room.createTime*1000);
                                    converse.localRoomDel(obj.objectId);
                                }
                                return;
                            } else if (obj.type && obj.type === 931 && obj.objectId ) {
                                //客服离线超时
                                /*
                                if(converse.isCustomer(obj.objectId)){
                                    this.showSystemNotification(obj.content, true);
                                }*/
                                /*
                                 注销 2016-11-30 解决，会话中邀请的客服人员收到此条消息会将自己退出
                                 else {
                                 converse.localRoomDel(obj.objectId);
                                 }
                                 */
                                /*else {
                                    this.showSystemNotification(obj.content, true);
                                }*/
                                text = obj.content;
                                //return;
                            } else if (obj.type && obj.type === 924 && attrs.sender === 'me' && obj.objectId ) {
                                //退出服务
                                converse.localRoomDel(obj.objectId);
                                return;
                            }  else if (obj.type && obj.type === 903 && obj.objectId ) {
                                //群聊删除
                                converse.localRoomDel(obj.objectId);
                                return;
                            } else if (obj.type && obj.type === 904 && obj.objectId && Number(obj.toUserId) === Number(Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)))) {
                                //被删除
                                //因无法判断是新消息还是历史消息，先查询房间中是否有该用户，如果有，则不进行删除，如果没有，则进行删除
                                var room = converse.imRoomInfo(obj.objectId);
                                if(room && room.members){
                                    var isExistRoom = false;
                                    if(room.members && room.members.length > 0){
                                        for(var j=0;j<room.members.length;j++){
                                            if(Number(Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid))) === room.members[j].userId){
                                                isExistRoom = true;
                                            }
                                        }
                                    }

                                    if(isExistRoom){
                                        system_msg = true;
                                        text = obj.content;
                                        //this.showSystemNotification(obj.content, true);
                                    } else {
                                        converse.localRoomDel(obj.objectId);
                                        return;
                                    }
                                } else {
                                    converse.localRoomDel(obj.objectId);
                                    return;
                                }
                            } else if (obj.type === 902) {
                                //将房间列表及房间名称修改
                                converse.editRoomName(obj.objectId, obj.content);

                                system_msg = true;
                                text = obj.content;
                                //this.showSystemNotification(obj.content, true);
                                //return;
                            }

                        }else if (!type && attrs.sender && attrs.sender === 'me' && chat_type && chat_type === 'chatroom'){
                            file_flag = '2';
                        }

                        if(obj.type){
                            if(obj.type == 1){
                                text = obj.content;
                            }else if(obj.type === 2 ){
                                var extStart=obj.content.lastIndexOf("."),
                                    ext=obj.content.substring(extStart,obj.content.length).toUpperCase(),
                                    message_file_type = 't';
                                if(ext === ".GIF"){
                                    message_file_type = 'o';
                                }
                                var url = converse.imapi_url + converse.imapi_download+ "?fileName=" + obj.content + "&flag="+file_flag+"&type="+message_file_type+"&access_token="+converse.access_token;
                                text = '<img src="'+ url +'" class="msg-down-img" down-type="spli" u="' + obj.content + '"  title="点击查看图片" style="max-width:100%; max-height: 300px;"/> ';

                                //此次处理图片加载完成后将图片显示完全
                                var img = new Image(); //创建一个Image对象，实现图片的预下载
                                img.src = url;
                                var that = this;
                                if (img.complete) { // 如果图片已经存在于浏览器缓存，直接调用回调函数
                                    that.scrollDown();
                                    //if (that.$content.is(':visible') && !that.model.get('scrolled')) {
                                    //    that.$content.scrollTop(that.$content[0].scrollHeight);
                                    //    that.$el.find('.new-msgs-indicator').addClass('hidden');
                                    //}
                                }

                                img.onload = function () { //图片下载完毕时异步调用callback函数。
                                    that.scrollDown();
                                    //if (that.$content.is(':visible') && !that.model.get('scrolled')) {
                                    //    that.$content.scrollTop(that.$content[0].scrollHeight);
                                    //    that.$el.find('.new-msgs-indicator').addClass('hidden');
                                    //}
                                };
                            }else if(obj.type === 3){
                                var url = converse.imapi_url + converse.imapi_download+ "?fileName=" + obj.content + "&flag="+file_flag+"&type=o&access_token="+converse.access_token;
                                text = '<audio style="width: 100px !important;" controls><source src="'+url+'" type="audio/ogg"><source src="'+url+'" type="audio/mpeg"><object data="'+url+'" width="310" height="300"><embed src="'+url+'" width="310" height="300"></object></audio><a class="msg-down-img" down-type="url"  u="' + obj.content + '" url="'+url+'"></a>';
                                //text = '<a class="msg-down-img" down-type="url"  u="' + obj.content + '" url="'+url+'">这是一条语音消息，请在手机上查看或点击此消息进行下载</a>';
                            }else if(obj.type === 4 ){
                                text = "这是一条位置消息，请在手机上查看";
                            }else if(obj.type === 6){
                                var url = converse.imapi_url + converse.imapi_download+ "?fileName=" + obj.content + "&flag="+file_flag+"&access_token="+converse.access_token;
                                text = '<video width="150px" height="200" controls><source src="'+url+'" type="video/webm"><source src="'+url+'" type="video/ogg"><source src="'+url+'" type="video/mp4"><object data="'+url+'" width="310" height="300"><embed src="'+url+'" width="310" height="300"></object></video><a class="msg-down-img" down-type="url"  u="' + obj.content + '" url="'+url+'"></a>';
                            }else if (obj.type === 8){
                                var user = converse.getUserInfo(obj.objectId);
                                if(user){
                                    var sex = '',
                                        birthday = '',
                                        companyName = '',
                                        email = '',
                                        name = '',
                                        telephone = user.telephone,
                                        nickname = '',
                                        user_avatar_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + user.userId + '&type=t&access_token=' + converse.access_token;
                                    console.log(user_avatar_url);

                                    if((typeof(user.birthday) === "undefined") || user.birthday === null){
                                        birthday = '';
                                    } else {
                                        birthday = moment(user.birthday*1000).format('YYYY-MM-DD');
                                    }

                                    if(user.sex && !(typeof(user.sex) === "undefined") && user.sex === 1){
                                        sex = '男';
                                    } else {
                                        sex = '女';
                                    }
                                    if(user.companyName && !(typeof(user.companyName) === "undefined")){
                                        companyName = user.companyName;
                                    }
                                    if(user.email && !(typeof(user.email) === "undefined")){
                                        email = user.email;
                                    }
                                    if(user.name && !(typeof(user.name) === "undefined")){
                                        name = user.name;
                                    }
                                    if(user.nickname && !(typeof(user.nickname) === "undefined")){
                                        nickname = user.nickname;
                                    }

                                    text = '<div class="usercard">' +
                                           '<div style="width:40px;height:40px;margin:12px;float:left"><img height="40" width="40" src="' + user_avatar_url + '"/></div>' +
                                           '<div class="usercard-title"><p title="昵称:' + obj.content + '">昵称:'+ nickname +'</p><p>手机号码:' +telephone+ '</div>' +
                                           '<form class="add-friend-form usercard-form"><p>个人名片:' +
                                                '<input style="display: none" type="text" value="'+telephone+'"/>' +
                                                '<button style="float: right;background: #ddd" class="user-card-plus btn" type="submit" title="">' +
                                                    '<i class="fa fa-user-plus" style="font-size: 18px;color:#2ea7f7 "></i>' +
                                                '</button>' +
                                           '</p></form> ' +
                                           '</div>';
                                }else{
                                    text = '<a title="昵称:' + obj.content + '" href="javascript:void(0);">名片:' + obj.content +'(详情请在手机上查看)</a>';
                                }
                            } else if(obj.type === 9){
                                var url = converse.imapi_url + converse.imapi_download+ "?fileName=" + obj.content + "&flag="+file_flag+"&access_token="+converse.access_token;
                                var msg_file_path = obj.content;
                                if(obj.filePath){
                                    var extStart=obj.filePath.lastIndexOf("/")+1,
                                        msg_file_path=obj.filePath.substring(extStart,obj.filePath.length),
                                        extStart1=msg_file_path.lastIndexOf("\\")+1,
                                        msg_file_path=msg_file_path.substring(extStart1,msg_file_path.length);
                                }
                                text = '文件:'+msg_file_path+'，请<a class="msg-down-img" style="color: #0000ff;text-decoration: none;" down-type="url"  u="' + obj.content + '" url="'+url+'">下载 </a>';
                            }else if(obj.type === 10){
                                system_msg = true;
                                text = '<div class="msg-withdrawal">'+
                                    '<div class="msg-withdrawal-css">'+obj.content+'</div>'+
                                    '</div>';
                            }
                            else if (obj.type === 20) {
                                text = converse.templates.message_article({
                                    'title': obj.content,
                                    'summary': obj.location_x?obj.location_x:obj.summary,
                                    'url': obj.objectId,
                                    'img': obj.fileName
                                });
                            } else if (obj.type === 30) {

                                var alarm_title = {'title': obj.content};
                                var alarm_info  = {'summary': obj.location_x?obj.location_x:obj.summary};

                                text = '<div class="alarm-cue">'+
                                            '<div class="boot-title"> '+alarm_title.title+'</div>' +
                                            '<div class="boot-body-text">'+ alarm_info.summary +'</div>'+
                                        '</div>';

                            } else if (obj.type === 905) {
                                //公告
                                var text_arry = obj.content.split(/\r?\n/);
                                system_msg = true;

                                if (text_arry && text_arry.length > 1) {
                                    for(var i=0;i<text_arry.length; i++) {
                                        //this.showSystemNotification(text_arry[i], true);
                                        text += text_arry[i];
                                    }
                                } else {
                                    //this.showSystemNotification(obj.content, true);
                                    text = obj.content;
                                }
                                text = '<div class="msg-withdrawal">' +
                                    '<div class="msg-withdrawal-css">'+
                                    text +
                                    '</div>'+
                                    '</div>';
                            } else if (obj.type === 904) {
                                system_msg = true;
                                text = '<div class="msg-withdrawal">'+
                                    '<div class="msg-withdrawal-css">'+obj.content+ '加入群聊'+'</div>'+
                                    '</div>';
                                //this.showSystemNotification(obj.content, true);
                                //return;
                            } else if (obj.type === 907) {
                                system_msg = true;
                                text = '<div class="msg-withdrawal">'+
                                '<div class="msg-withdrawal-css">'+obj.content+ '加入群聊'+'</div>'+
                                '</div>';
                            } else if (obj.type === 601) {
                                system_msg = true;
                                if(obj.fromUserId && Number(obj.fromUserId) === Number(me_jid)){
                                    text = '<div class="msg-withdrawal">'+
                                            '<div class="msg-withdrawal-css">'+ obj.content +'</div>'+
                                           '</div>';

                                } else {
                                    text = '<div class="msg-withdrawal">'+
                                        '<div class="msg-withdrawal-css">'+ obj.fromUserName + "撤回了一条消息" +'</div>'+
                                        '</div>';
                                }

                            }else{
                                text = obj.content;
                            }
                        }

                        fullname = obj.fromUserName;
                    }

                    if ((match) && (match[1] === 'me')) {
                        text = text.replace(/^\/me/, '');
                        template = converse.templates.action;
                        username = fullname;
                    } else  {
                        template = converse.templates.message;
                        username = attrs.sender === 'me' && __('me') || fullname;

                        if(attrs.sender == 'me'){
                            avatar_url = converse.imapi_url + converse.imapi_download_avatar + '?userId='+me_jid+ '&type=t&access_token='+converse.access_token;
                        }  else {
                            avatar_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' +user_id+ '&type=t&access_token='+converse.access_token;
                            if (type && type === 'groupchat'){
                                avatar_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' +obj.fromUserId+ '&type=t&access_token='+converse.access_token;
                            }
                        };

                    }
                    this.$content.find('div.chat-event').remove();

                    // FIXME: leaky abstraction from MUC
                    if (this.is_chatroom && attrs.sender === 'them' && (new RegExp("\\b"+this.model.get('nick')+"\\b")).test(text)) {
                        // Add special class to mark groupchat messages in which we
                        // are mentioned.
                        extra_classes += ' mentioned';
                    }

                    var show_withdraw = false;
                    if(attrs.sender && attrs.sender === 'me' && obj.type && obj.type <= 30 && !this.model.get('isHistory')){
                        if((new Date().getTime()) - (obj.timeSend*1000) <= 120000){
                            show_withdraw = true;
                        }
                    }

                    var t = $(template(
                        _.extend(this.getExtraMessageTemplateAttributes(attrs), {
                            'msgid': attrs.msgid,
                            'sender': attrs.sender,
                            'time': msg_time.format('HH:mm:ss'),
                            'isodate': msg_time.format(),
                            'username': username,
                            'avatar_url': avatar_url,
                            'message': '',
                            'extra_classes': extra_classes,
                            'sendTime': obj.ts?obj.ts:obj.timeSend * 1000,
                            'show_sender': system_msg,
                            'show_withdraw': show_withdraw
                        })
                    ));

                    if(obj.type) {
                        if (obj.type != 1 && obj.type != 5 && obj.type != 902) {
                            return t.children('.chat-msg-content').first().html(text).addEmoticons(converse.visible_toolbar_buttons.emoticons).parent();
                        } else if (obj.type === 5 || obj.type === 902) {
                            return t.children('.chat-msg-content').first().text(text).addGifEmoticons(converse.visible_toolbar_buttons.emoticons, converse.emoticons_file_path).parent();
                        } else if (obj.type === 1 ) {
                            if(text){
                                var text_arry = text.split("\n"),
                                    t_children = t.children('.chat-msg-content').first();

                                if (text_arry && text_arry.length > 1) {
                                    for(var i=0;i<text_arry.length; i++) {
                                        t_children.append($("<span></span>").text(text_arry[i]));
                                        if (i != text_arry.length - 1) {
                                            var br_msg = '</br>';
                                            t_children.append(br_msg);
                                        }
                                    }
                                    return t_children.addHyperlinks().addEmoticons(converse.visible_toolbar_buttons.emoticons, converse.emoticons_file_path).parent();
                                }
                            }
                            return t_children.text(text).addHyperlinks().addEmoticons(converse.visible_toolbar_buttons.emoticons, converse.emoticons_file_path).parent();
                        }
                    }

                    /*
                     t.children('.chat-msg-content').first().text(text)
                     .addHyperlinks()
                     .addEmoticons(converse.visible_toolbar_buttons.emoticons).parent();
                     */

                    //return t.children('.chat-msg-content').first().text(text).addEmoticons(converse.visible_toolbar_buttons.emoticons, converse.emoticons_file_path).parent();
                },

                showHelpMessages: function (msgs, type, spinner) {
                    var i, msgs_length = msgs.length;
                    for (i=0; i<msgs_length; i++) {
                        this.$content.append($('<div class="chat-'+(type||'info')+'">'+msgs[i]+'</div>'));
                    }
                    if (spinner === true) {
                        this.$content.append('<span class="spinner"/>');
                    } else if (spinner === false) {
                        this.$content.find('span.spinner').remove();
                    }
                    return this.scrollDown();
                },

                handleChatStateMessage: function (message) {

                    var user;
                    if (message.get('type') && message.get('type') === 'chat'){
                        if(message.get('fullname').indexOf(converse.domain) > -1){
                            user = converse.getUserInfo2(Strophe.getNodeFromJid(this.model.get('fullname')));
                        } else {
                            user = null;
                        }
                    } else if (message.get('fullname')){
                        user = converse.getUserInfo2(message.get('fullname'));
                    }

                    //排除掉自账号在别的设备上发送的输入状态
                    if(message.attributes.sender && !(message.attributes.sender === 'me')){
                        if (message.get('chat_state') === converse.COMPOSING) {
                            this.showStatusNotification((user&&user.nickname?user.nickname:message.get('fullname'))+' '+__('is typing'));
                            this.clear_status_timeout = window.setTimeout(this.clearStatusNotification.bind(this), 5000);
                        } else if (message.get('chat_state') === converse.PAUSED) {
                            this.showStatusNotification((user&&user.nickname?user.nickname:message.get('fullname'))+' '+__('has stopped typing'));
                        } else if (_.contains([converse.INACTIVE, converse.ACTIVE], message.get('chat_state'))) {
                            this.$content.find('div.chat-event').remove();
                        } else if (message.get('chat_state') === converse.GONE) {
                            this.showStatusNotification((user&&user.nickname?user.nickname:message.get('fullname'))+' '+__('has gone away'));
                        }
                    }

                },

                shouldShowOnTextMessage: function () {
                    if(converse.default_form){
                        return !this.$el.is(':visible');
                    }
                },

                updateNewMessageIndicators: function (message) {
                    /* We have two indicators of new messages. The unread messages
                     * counter, which shows the number of unread messages in
                     * the document.title, and the "new messages" indicator in
                     * a chat area, if it's scrolled up so that new messages
                     * aren't visible.
                     *
                     * In both cases we ignore MAM messages.
                     */
                    if (!message.get('archive_id')) {
                        if (this.model.get('scrolled', true)) {
                            this.$el.find('.new-msgs-indicator').removeClass('hidden');
                        }
                        if (converse.windowState === 'hidden' || this.model.get('scrolled', true)) {
                            //隐藏掉头部消息提示
                            //converse.incrementMsgCounter();
                        }
                    }
                },

                handleTextMessage: function (message) {
                    this.showMessage(_.clone(message.attributes));
                    if (message.get('sender') !== 'me') {
                        this.updateNewMessageIndicators(message);
                    } else {
                        // We remove the "scrolled" flag so that the chat area
                        // gets scrolled down. We always want to scroll down
                        // when the user writes a message as opposed to when a
                        // message is received.
                        this.model.set('scrolled', false);
                    }
                    if (this.shouldShowOnTextMessage()) {
                        this.show();
                    } else {
                        this.scrollDown(message);
                    }
                },

                handleErrorMessage: function (message) {
                    var $message = $('[data-msgid='+message.get('msgid')+']');
                    if ($message.length) {
                        $message.after($('<div class="chat-info chat-error"></div>').text(message.get('message')));
                        this.scrollDown();
                    }
                },

                onMessageAdded: function (message) {
                    /* Handler that gets called when a new message object is created.
                     *
                     * Parameters:
                     *    (Object) message - The message Backbone object that was added.
                     */
                    if (typeof this.clear_status_timeout !== 'undefined') {
                        window.clearTimeout(this.clear_status_timeout);
                        delete this.clear_status_timeout;
                    }
                    if (message.get('type') === 'error') {
                        this.handleErrorMessage(message);
                    } else if (!message.get('message')) {
                        this.handleChatStateMessage(message);
                    } else {
                        this.handleTextMessage(message);
                    }
                },

                createMessageStanza: function (message) {
                    return $msg({
                        from: converse.connection.jid,
                        to: this.model.get('jid'),
                        type: 'chat',
                        id: message.get('msgid')
                    }).c('body').t(message.get('message')).up().c(converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up();
                },

                sendMessage: function (message) {
                    /* Responsible for sending off a text message.
                     *
                     *  Parameters:
                     *    (Message) message - The chat message
                     */
                    // TODO: We might want to send to specfic resources.
                    // Especially in the OTR case.
                    var messageStanza = this.createMessageStanza(message);
                    converse.connection.send(messageStanza);
                    if (converse.forward_messages) {
                        // Forward the message, so that other connected resources are also aware of it.
                        converse.connection.send(
                            $msg({ to: converse.bare_jid, type: 'chat', id: message.get('msgid') })
                                .c('forwarded', {xmlns:'urn:xmpp:forward:0'})
                                .c('delay', {xmns:'urn:xmpp:delay',stamp:(new Date()).getTime()}).up()
                                .cnode(messageStanza.tree())
                        );
                    }
                },

                onMessageSubmitted: function (text) {
                    /* This method gets called once the user has typed a message
                     * and then pressed enter in a chat box.
                     *
                     *  Parameters:
                     *    (string) text - The chat message text.
                     */
                    if (!converse.connection.authenticated) {
                        return this.showHelpMessages(
                            ['Sorry, the connection has been lost, '+
                            'and your message could not be sent'],
                            'error'
                        );
                    }

                    if(converse.allow_chatlist){
                        converse_api.chatlist.first(this.model.get('id'), 'chat');
                    }

                    var match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/), msgs;
                    if (match) {
                        if (match[1] === "clear") {
                            return this.clearMessages();
                        }
                        else if (match[1] === "help") {
                            msgs = [
                                '<strong>/help</strong>:'+__('Show this menu')+'',
                                '<strong>/me</strong>:'+__('Write in the third person')+'',
                                '<strong>/clear</strong>:'+__('Remove messages')+''
                            ];
                            this.showHelpMessages(msgs);
                            return;
                        }
                    }

                    //将\转义
                    text = text.replace(/\\/g, "\\\\");

                    //将双引号进行转换
                    var reg = new RegExp("\"","g");
                    text = text.replace(reg,"\\\"");

                    //将换行替换
                    text = text.replace(/\n|\r\n/g, "\\n");

                    // We only save unencrypted messages.
                    //var fullname = converse.xmppstatus.get('fullname');
                    //console.log("fullname1:"+fullname);
                    var fullname = converse.nick_name;

                    if (_.isEmpty(fullname)) {

                        var id = Strophe.getNodeFromJid(converse.jid);
                        var urlStr = converse.imapi_url + "/user/get?userId=" + id + "&access_token=" + converse.access_token;
                        $.ajax({
                            type: "get",
                            url: urlStr,
                            async: false,
                            success: function (data) {
                                var result = data.resultCode;
                                if (result && result == 1 && data && data.data && data.data.nickname) {
                                    fullname = data.data.nickname;
                                    converse.nick_name = fullname;
                                }
                            }
                        });
                    }
                    fullname = _.isEmpty(fullname) ? converse.bare_jid : fullname;

                    var fileType = '1';

                    var obj = '{"content":"' + text + '","fromUserName":"' + fullname + '","timeSend":' + parseInt(moment() / 1000) + ',"type":'+fileType+'}';

                    var message = this.model.messages.create({
                        fullname: fullname,
                        sender: 'me',
                        time: moment().format(),
                        message: obj
                    });
                    this.sendMessage(message);

                    if(converse.allow_chatlist) {
                        //update list item msg
                        converse_api.chatlist.updateItemMsg(this.model.get('jid'), obj, 'chat');
                    }
                },

                sendChatState: function () {
                    /* Sends a message with the status of the user in this chat session
                     * as taken from the 'chat_state' attribute of the chat box.
                     * See XEP-0085 Chat State Notifications.
                     */
                    converse.connection.send(
                        $msg({'to':this.model.get('jid'), 'type': 'chat'})
                            .c(this.model.get('chat_state'), {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                            .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                    );
                },

                setChatState: function (state, no_save) {
                    /* Mutator for setting the chat state of this chat session.
                     * Handles clearing of any chat state notification timeouts and
                     * setting new ones if necessary.
                     * Timeouts are set when the  state being set is COMPOSING or PAUSED.
                     * After the timeout, COMPOSING will become PAUSED and PAUSED will become INACTIVE.
                     * See XEP-0085 Chat State Notifications.
                     *
                     *  Parameters:
                     *    (string) state - The chat state (consts ACTIVE, COMPOSING, PAUSED, INACTIVE, GONE)
                     *    (Boolean) no_save - Just do the cleanup or setup but don't actually save the state.
                     */
                    if (typeof this.chat_state_timeout !== 'undefined') {
                        window.clearTimeout(this.chat_state_timeout);
                        delete this.chat_state_timeout;
                    }
                    if (state === converse.COMPOSING) {
                        this.chat_state_timeout = window.setTimeout(
                            this.setChatState.bind(this), converse.TIMEOUTS.PAUSED, converse.PAUSED);
                    } else if (state === converse.PAUSED) {
                        this.chat_state_timeout = window.setTimeout(
                            this.setChatState.bind(this), converse.TIMEOUTS.INACTIVE, converse.INACTIVE);
                    }
                    if (!no_save && this.model.get('chat_state') !== state) {
                        this.model.set('chat_state', state);
                    }
                    return this;
                },

                clickTextArea: function (ev) {
                    var jid = this.model.get("jid");
                    var btn = COM.repeat("initPastImg-"+jid);
                    if(btn){//初始化
                        converse_api.rooms.pastImg(jid,"chat",0);
                    }
                },

                keyPressed: function (ev) {
                    /* Event handler for when a key is pressed in a chat box textarea.
                     */
                    var $textarea = $(ev.target), message;
                    if (ev.ctrlKey && (ev.keyCode === KEY.ENTER || ev.keyCode === 10)) {
                        ev.preventDefault();
                        var msg = $textarea.val()+'\r\n';
                        $textarea.val(msg);
                    } else if (ev.keyCode === KEY.ENTER) {
                        ev.preventDefault();
                        message = $textarea.val();
                        $textarea.val('').focus();
                        if ($.trim(message) !== '') {
                            this.onMessageSubmitted($.trim(message));
                            converse.emit('messageSend', $.trim(message));
                        }
                        this.setChatState(converse.ACTIVE);
                    } else if (!ev.keyCode&&ev.keyCode != 0) {
                        ev.preventDefault();
                        message = $textarea.val();
                        $textarea.val('').focus();
                        if ($.trim(message) !== '') {
                            //message = message.replace(/\n/g,"\n");
                            this.onMessageSubmitted($.trim(message));
                            converse.emit('messageSend', $.trim(message));
                        }
                        this.setChatState(converse.ACTIVE);
                    } else {
                        // Set chat state to composing if keyCode is not a forward-slash
                        // (which would imply an internal command and not a message).
                        this.setChatState(converse.COMPOSING, ev.keyCode === KEY.FORWARD_SLASH);
                    }
                },

                clearMessages: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if(converse.new_modal){
                        var _this = this;
                        $.dialog('confirm',__('prompt'),__("Are you sure you want to clear the messages from this chat box?"),0,function() {
                            $.closeDialog();

                            _this.$content.empty();
                            _this.model.messages.reset();
                            _this.model.messages.browserStorage._clear();
                            return _this;
                        });
                    } else {
                        var result = confirm(__("Are you sure you want to clear the messages from this chat box?"));
                        if (result === true) {
                            this.$content.empty();
                            this.model.messages.reset();
                            this.model.messages.browserStorage._clear();
                        }
                        return this;
                    }
                },

                uploadFile: function (ev) {
                    var jid = this.model.get('jid');
                    var send_jid = Strophe.getNodeFromJid(jid);
                    var frameName = 'upload_frame_'+send_jid;
                    var uploadFlag = 1;
                    if(this.model.get('type') && this.model.get('type') === 'chatroom'){
                        uploadFlag = 2;
                    }

                    var params ={uploadFlag:uploadFlag,toUserId:send_jid,access_token:converse.access_token};
                    var form = $('<form method="post" style="display:none;" enctype="multipart/form-data" />').attr('name', 'form_' + frameName);
                    form.attr("id", frameName).attr('action', converse.imapi_url + converse.imapi_upload);
                    // form中增加数据域
                    var formHtml = '<input type="file" name="file" class="file_upload_change" >';
                    //var formHtml = "";
                    $.each(params, function(key,val){
                        formHtml += '<input type="hidden" name="' + key + '" value="' + params[key] + '">';
                    });
                    formHtml += '<input type="submit" class="submit">';
                    form.append(formHtml);
                    form.find('.file_upload_change').on('change',this.uploadFileChange.bind(this));
                    $(ev.target).before(form);
                    $(ev.target).after('</form>');

                    // 文件框
                    var fileInput = $('input[type=file][name="file"]', form);
                    fileInput.click();
                },

                uploadFileChange: function(ev){

                    var $parent = $(ev.target).parents('form'),
                        toUserId = $parent.find('input[name="toUserId"]').val(),
                        form =  $parent[0],
                        form_data = new FormData(form),
                        file_name = $(ev.target).val(),
                        is_ie = false;

                    var explorer =window.navigator.userAgent;
                    if (explorer.indexOf("MSIE") > -1) {
                        is_ie = true;
                    } else if (explorer.indexOf("Trident") > -1){
                        console.log(explorer.indexOf("Trident"));
                        is_ie = true;
                    }

                    var jid = this.model.get('jid'),
                        session_type = this.model.get('type')? ( this.model.get('type') === 'chat' ? 'chat' : 'groupchat') : null;

                    if(!session_type){
                        if(jid.indexOf(converse.muc_service_url) >=0 ){
                            session_type = 'groupchat';
                        } else {
                            session_type = 'chat';
                        }
                    }

                    //判断是否符合上传文件要求：图片、音频、视频(.mp4)
                    var extStart=file_name.lastIndexOf("\.");
                    var ext=file_name.substring(extStart).toUpperCase();
                    //.txt|.wps|.rtf|.doc|.docx|.xsl|.xslx|.ppt|.pptx|.pdf|.rar|.zip|.gz|.jpg|.gif|.bmp|.png|.rm|.avi|.wma|.mp3|.mpg|.mp4|.m4a
                    //cgh7953 增加了 .m4a(语音) 和 mp4
                    if(ext!=".TXT"&&ext!=".WPS"&&ext!=".RTF"&&ext!=".DOC"&&ext!=".DOCX"&&ext!=".XLS"
                        &&ext!=".XLSX"&&ext!=".PPT"&&ext!=".PPTX"&&ext!=".PDF"&&ext!=".GIF"&&ext!=".JPG"
                        &&ext!=".GIF"&&ext!=".MP3"&&ext!=".RAR"&&ext!=".ZIP"&&ext!=".GZ"&&ext!=".BMP"
                        &&ext!=".PNG"&&ext!=".RM"&&ext!=".AVI"&&ext!=".WMA"&&ext!=".MPG"&&ext!=".MP4"
                        &&ext!=".M4A"){
                        if(converse.new_modal){
                            $.dialog('alert',__('prompt'),"只能后缀名为 \n.txt .wps .rtf .doc .docx .xls .xlsx .ppt .pptx .pdf .rar .zip .gz .jpg .gif \n .bmp .png .rm .avi .wma .mp3 .mpg .mp4 .m4a 的文件",0);
                        }else{
                            alert("只能后缀名为 \n.txt .wps .rtf .doc .docx .xls .xlsx .ppt .pptx .pdf .rar .zip .gz .jpg .gif \n .bmp .png .rm .avi .wma .mp3 .mpg .mp4 .m4a 的文件");
                        }
                        return false;
                    }

                    $.ajax({
                        url:converse.imapi_url + converse.imapi_upload,
                        type:"post",
                        data:form_data,
                        datyType:'json',
                        processData:false,
                        contentType:false,
                        success:function(data){
                            var $parent_c = $(ev.target).parents('.sendXMPPMessage');
                            var $content = $parent_c.find('.chat-textarea');
                            if(is_ie){
                                form.removeNode();
                            } else {
                                form.remove();
                            }

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

                        },
                        error:function(XMLHttpRequest, textStatus, errorThrown){
                            if(is_ie){
                                form.removeNode();
                            } else {
                                form.remove();
                            }
                            if (textStatus === 413) {
                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__('Upload the file is too large'),0);
                                }else{
                                    alert(__('Upload the file is too large'));
                                }
                            } else {
                                if(converse.new_modal){
                                    $.dialog('alert',__('prompt'),__('Upload the file is too large or error'),0);
                                }else{
                                    alert(__('Upload the file is too large or error'));
                                }
                            }

                        }
                    });

                },

                insertIntoTextArea: function (value) {
                    var $textbox = this.$el.find('textarea.chat-textarea');
                    var existing = $textbox.val();
                    if (existing && (existing[existing.length-1] !== ' ')) {
                        existing = existing + ' ';
                    }
                    $textbox.focus().val(existing+value+' ');
                },

                insertEmoticon: function (ev) {
                    ev.stopPropagation();
                    var $toggle_smiley = this.$el.find('.toggle-smiley ul');
                    $toggle_smiley.slideToggle(200);
                    var $target = $(ev.target);
                    $target = $target.is('a') ? $target : ($target.is('li')? $target.find('.smilyey-item') : $target.parent());
                    /*
                     this.insertIntoTextArea('['+$target.data('emoticon')+']');

                     var $parent = $toggle_smiley.parent().parent().parent();
                     var $content = $parent.find('.chat-textarea');
                     $content.keypress();
                     */
                    var text,type = 1;
                    if($target.attr('et') === 'gif'){
                        text = $target.data('emoticon')+'.gif';
                        type = 5;
                    }else{
                        text = '['+$target.data('emoticon')+']';
                    }

                    var session_type = this.model.get('type')? ( this.model.get('type') === 'chat' ? 'chat' : 'groupchat') : null;

                    if(!session_type){
                        if(this.model.get('jid').indexOf(converse.muc_service_url) >=0 ){
                            session_type = 'groupchat';
                        } else {
                            session_type = 'chat';
                        }
                    }

                    var msg_text = '{"content":"' + text + '","fromUserId":"'+Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid))+'","fromUserName":"'+converse.nick_name+'","timeSend":'+parseInt(moment() / 1000)+',"type":'+type+'}';
                    var msgid = converse.connection.getUniqueId();
                    var msg = $msg({
                        from: converse.connection.jid,
                        to: this.model.get('jid'),
                        type: session_type,
                        id: msgid
                    }).c('body').t(msg_text).up()
                        .c(converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up();

                    converse.connection.send(msg);
                    this.model.messages.create({
                        fullname: this.model.get('nick'),
                        sender: 'me',
                        time: moment().format(),
                        message: msg_text,
                        msgid: msgid
                    });

                    //消息列表第一
                    if (converse.allow_chatlist) {
                        converse_api.chatlist.first(this.model.get('jid'), session_type);
                        converse_api.chatlist.updateItemMsg(this.model.get('jid'), msg_text, session_type);
                    }
                },

                toggleEmoticonMenu: function (ev) {
                    ev.stopPropagation();
                    var $a = $(ev.target);
                    if($a.is('#myEmoticon *')){
                        var s_id ;
                        if($a.is('a')){
                            s_id = $a.attr('s_id');
                        }else{
                            s_id = $a.find('a').attr('s_id');
                        }
                        if(s_id === 'defaultE'){
                            $('#conversejs #myTabEmoticon #defaultE').show();
                            $('#conversejs #myTabEmoticon #defaultE').addClass('in').addClass('active');
                            $('#conversejs #myTabEmoticon #cunstomE').hide();
                            $('#conversejs #myTabEmoticon #cunstomE').removeClass('in').removeClass('active');
                        }else{
                            $('#conversejs #myTabEmoticon #defaultE').hide();
                            $('#conversejs #myTabEmoticon #defaultE').removeClass('in').removeClass('active');
                            $('#conversejs #myTabEmoticon #cunstomE').show();
                            $('#conversejs #myTabEmoticon #cunstomE').addClass('in').addClass('active');
                        }

                        return;
                    }
                    this.$el.find('.toggle-smiley ul').slideToggle(200);
                },

                toggleCall: function (ev) {
                    ev.stopPropagation();
                    converse.emit('callButtonClicked', {
                        connection: converse.connection,
                        model: this.model
                    });
                },

                onChatStatusChanged: function (item) {
                    var chat_status = item.get('chat_status'),
                        fullname = item.get('fullname');
                    fullname = _.isEmpty(fullname)? item.get('jid'): fullname;
                    if (this.$el.is(':visible')) {
                        if (chat_status === 'offline') {
                            this.showStatusNotification(fullname+' '+__('has gone offline'));
                        } else if (chat_status === 'away') {
                            this.showStatusNotification(fullname+' '+__('has gone away'));
                        } else if ((chat_status === 'dnd')) {
                            this.showStatusNotification(fullname+' '+__('is busy'));
                        } else if (chat_status === 'online') {
                            this.$el.find('div.chat-event').remove();
                        }
                    }
                },

                onStatusChanged: function (item) {
                    this.showStatusMessage();
                    converse.emit('contactStatusMessageChanged', {
                        'contact': item.attributes,
                        'message': item.get('status')
                    });
                },

                showStatusMessage: function (msg) {
                    msg = msg || this.model.get('status');
                    if (typeof msg === "string") {
                        this.$el.find('p.user-custom-message').text(msg).attr('title', msg);
                    }
                    return this;
                },

                close: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }

                    //在线客服清除缓存
                    var jid = this.model.get('jid');
                    var id = Strophe.getNodeFromJid(jid);
                    if(id.indexOf('online')>=0){
                        this.$content.empty();
                        this.model.messages.reset();
                        this.model.messages.browserStorage._clear();
                    }

                    if(this.clear_msg_withdraw){
                        window.clearInterval(this.clear_msg_withdraw);
                    }

                    if (converse.connection.connected) {
                        // Immediately sending the chat state, because the
                        // model is going to be destroyed afterwards.
                        this.model.set('chat_state', converse.INACTIVE);
                        this.sendChatState();

                        try {
                            this.model.destroy();
                        } catch (e) {

                        }
                    }
                    this.remove();
                    converse.emit('chatBoxClosed', this);
                    return this;
                },

                getToolbarOptions: function (options) {
                    return _.extend(options || {}, {
                        label_clear: __('Clear all messages'),
                        label_hide_occupants: __('Hide the list of occupants'),
                        label_insert_smiley: __('Insert a smiley'),
                        label_start_call: __('Start a call'),
                        label_start_attachment: __('Send a file'),
                        label_create_desk: __('Create desk'),
                        label_evaluate: __('evaluate'),
                        show_call_button: converse.visible_toolbar_buttons.call,
                        show_file_button: converse.visible_toolbar_buttons.file,
                        show_clear_button: converse.visible_toolbar_buttons.clear,
                        show_emoticons: converse.visible_toolbar_buttons.emoticons,
                        smiley_file_path:converse.emoticons_file_path,
                        // FIXME Leaky abstraction MUC
                        //show_occupants_toggle: this.is_chatroom && converse.visible_toolbar_buttons.toggle_occupants
                        show_occupants_toggle: false,
                        show_create_desk: false,
                        show_evaluate: false
                    });
                },

                renderToolbar: function (toolbar, options) {
                    if (!converse.show_toolbar) { return; }
                    toolbar = toolbar || converse.templates.toolbar;
                    options = _.extend(
                        this.model.toJSON(),
                        this.getToolbarOptions(options || {})
                    );
                    this.$el.find('.chat-toolbar').html(toolbar(options));
                    return this;
                },

                renderAvatar: function () {
                    //if (!this.model.get('image')) {
                    //Show pictures of im
                    var user_info = converse.getUserInfo2(Strophe.getNodeFromJid(this.model.get('id'))),
                        avatar_url = converse.emoticons_file_path + converse.user_default_img,
                        error_avatar_url = converse.emoticons_file_path+converse.user_default_img;

                    if(user_info && user_info.hasAvatar){
                        avatar_url = converse.imapi_url + converse.imapi_download_avatar + '?userId='+Strophe.getNodeFromJid(this.model.get('id'))+'&type=t&access_token='+converse.access_token;
                    } else if(user_info && user_info.officialId){
                        avatar_url = user_info.logoUrl;
                        error_avatar_url = converse.emoticons_file_path + converse.official_default_img;
                    }

                    this.$el.find('.chat-title').before('<div style="display: inline-block;"><img class="roster-item-avatar" width="40" height="40" src="' +avatar_url+ '" onerror="javascript:this.src='+"'"+ error_avatar_url +"'" +';"></div>');
                    return this;
                    //}
                    /*
                     var width = converse.chatview_avatar_width;
                     var height = converse.chatview_avatar_height;
                     var img_src = 'data:'+this.model.get('image_type')+';base64,'+this.model.get('image'),
                     canvas = $(converse.templates.avatar({
                     'width': width,
                     'height': height
                     })).get(0);

                     if (!(canvas.getContext && canvas.getContext('2d'))) {
                     return this;
                     }
                     var ctx = canvas.getContext('2d');
                     var img = new Image();   // Create new Image object
                     img.onload = function () {
                     var ratio = img.width/img.height;
                     if (ratio < 1) {
                     ctx.drawImage(img, 0,0, width, height*(1/ratio));
                     } else {
                     ctx.drawImage(img, 0,0, width, height*ratio);
                     }

                     };
                     img.src = img_src;
                     this.$el.find('.chat-title').before(canvas);
                     return this;
                     */
                },

                focus: function () {
                    this.$el.find('.chat-textarea').focus();
                    converse.emit('chatBoxFocused', this);
                    return this;
                },

                hide: function () {
                    this.el.classList.add('hidden');
                    utils.refreshWebkit();
                    return this;
                },

                afterShown: function () {
                    if (converse.connection.connected) {
                        // Without a connection, we haven't yet initialized
                        // localstorage
                        try {
                            this.model.save();
                        } catch (e) {
                            if(converse.debug){
                                console.log(e);
                            }
                        }
                    }
                    this.setChatState(converse.ACTIVE);
                    this.scrollDown();
                    if (focus) {
                        this.focus();
                    }
                },

                _show: function (focus) {
                    /* Inner show method that gets debounced */
                    if (this.$el.is(':visible') && this.$el.css('opacity') === "1") {
                        if (focus) { this.focus(); }
                        return;
                    }
                    utils.fadeIn(this.el, this.afterShown.bind(this));
                },

                show: function (focus) {
                    if (typeof this.debouncedShow === 'undefined') {
                        /* We wrap the method in a debouncer and set it on the
                         * instance, so that we have it debounced per instance.
                         * Debouncing it on the class-level is too broad.
                         */
                        this.debouncedShow = _.debounce(this._show, 250, true);
                    }
                    this.debouncedShow.apply(this, arguments);
                    return this;
                },

                markScrolled: _.debounce(function (ev) {
                    /* Called when the chat content is scrolled up or down.
                     * We want to record when the user has scrolled away from
                     * the bottom, so that we don't automatically scroll away
                     * from what the user is reading when new messages are
                     * received.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var is_at_bottom = this.$content.scrollTop() + this.$content.innerHeight() >= this.$content[0].scrollHeight-10;
                    if (is_at_bottom) {
                        this.model.set('scrolled', false);
                        this.$el.find('.new-msgs-indicator').addClass('hidden');
                    } else {
                        // We're not at the bottom of the chat area, so we mark
                        // that the box is in a scrolled-up state.
                        this.model.set('scrolled', true);
                    }
                }, 150),


                viewUnreadMessages: function () {
                    this.model.set('scrolled', false);
                    this.scrollDown();
                },

                chatDownImg: function (ev){
                    var img_path = $(ev.target).attr('u'),
                        down_type = $(ev.target).attr('down-type');

                    var urlpath ;
                    if(down_type === 'url'){
                        urlpath = $(ev.target).attr('url');
                    } else {
                        urlpath = converse.imapi_url + converse.imapi_download+ "?fileName=" + img_path + "&flag=1&type=o&access_token="+converse.access_token;
                    }

                    var pic = window.open(urlpath, "fileDown");
                    pic.document.execCommand("SaveAs");
                },

                loadImg: function (ev) {
                    alert('into');
                },

                scrollDownMessageHeight: function ($message) {
                    if ($message && $message.length >0 && this.$content.is(':visible') && !this.model.get('scrolled')) {
                        this.$content.scrollTop(this.$content.scrollTop() + $message[0].scrollHeight );
                    }
                    return this;
                },

                scrollDown: function (message) {
                    if (this.$content.is(':visible') && !this.model.get('scrolled')) {
                        if(!this.$content.find(".historyQuery").offset()){
                            this.$content.scrollTop(this.$content[0].scrollHeight);
                            this.$el.find('.new-msgs-indicator').addClass('hidden');
                        }
                    }
                    return this;
                },

                historyQuery: function (ev) {
                    var that = this,
                        jid = $(ev.target).attr('jid'),
                        $parent = $(ev.target).parent().parent(),
                        $chat_message = $parent.find('.chat-message:first'),
                        $message_list = $parent.find('.chat-message'),
                        c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                    var data = {toUserId:jid, access_token:converse.access_token, pageIndex:0, pageSize:converse.message_pagesize};
                    if($chat_message.length > 0){
                        data.endTime = $chat_message.attr('data-send-time');
                    } else {
                        data.endTime = new Date().getTime();
                    }


                    if($chat_message){
                        that.lastH = document.querySelector('.chat-content').scrollHeight;
                        $chat_message.addClass('historyQuery').siblings().removeClass('historyQuery');
                    }

                    $.ajax({
                        url: converse.imapi_url+converse.imapi_chat_message,
                        data: data,
                        user_id:jid,
                        success: function (result) {
                            if(result && result.resultCode && result.resultCode == 1 && result.data){
                                //获取已存在消息标记集合
                                var chat_msgid = [];
                                if($message_list.length >0){
                                    $message_list.each(function(index,e){
                                        var mid = $(e).attr('data-msgid');
                                        if($.inArray(mid, chat_msgid)>-1){
                                        }else {
                                            chat_msgid[chat_msgid.length] = mid;
                                        }
                                    });
                                }

                                var isFirstSearch = chat_msgid.length===0?true:false;

                                for(var i=0;i<result.data.length;i++){
                                    var time = moment(result.data[i].ts).format(),
                                        nick = result.data[i].fromUserName,
                                        sender = result.data[i].fromUserId === Number(c_jid)? 'me' : 'them',
                                        text = JSON.stringify(result.data[i]),
                                        msgid = result.data[i].packetId,
                                        isExist = false;

                                    if($.inArray(msgid, chat_msgid)>-1){
                                        isExist = true;
                                    }else {
                                        chat_msgid[chat_msgid.length] = msgid;
                                    }

                                    if(!isExist && result.data[i].content){
                                        if(result.data[i].type != 601 || (result.data[i].type === 601 && result.data[i].objectId)) {
                                            that.model.messages.create({
                                                fullname: nick,
                                                sender: sender,
                                                time: time,
                                                message: text,
                                                msgid: msgid,
                                                archive_id: true
                                            });
                                        }
                                    }
                                }

                                $(ev.target).parent().remove();
                                if(result.data.length === converse.message_pagesize){
                                    that.showSystemHtmlNotificationPrepend('<a class="converse_history_query" jid="'+jid+'">历史记录查看</a>',true);
                                }
                                if($chat_message) {
                                    //var tempH =  $parent.scrollHeight;
                                    //var hh = tempH - lastH;
                                    //$parent.scrollTop= ;
                                    //var h = $parent.find("historyQuery").offsetTop;
                                    //$parent.scrollTop = h;
                                    that.lastH = that.lastH||0;
                                    if(!isFirstSearch){
                                        var tempH = document.querySelector('.chat-content').scrollHeight;
                                        var hh = tempH - that.lastH;
                                        var h = 0;
                                        if(document.querySelector('.chat-content').querySelector(".historyQuery")){
                                            h = document.querySelector('.chat-content').querySelector(".historyQuery").offsetTop;
                                        }
                                        document.querySelector('.chat-content').scrollTop = h;
                                        console.log("class定位获取：和上次高度相减,"+h+":"+hh);
                                    }

                                }
                            }
                        }
                    });

                },

                clickMsgWithraw: function (ev) {
                    ev.preventDefault();
                    if(this.model){
                        var $btn = $(ev.target),
                            $chat_message = $btn.parent().parent(),
                            msgid = $chat_message.attr('data-msgid'),
                            url = converse.imapi_url + converse.imapi_chat_withdraw,
                            data = {messageId: msgid, access_token: converse.access_token},
                            id = Strophe.getNodeFromJid(this.model.get('jid')),
                            _that = this;

                        var session_type = this.model.get('type')? ( this.model.get('type') === 'chat' ? 'chat' : 'groupchat') : null;
                        if(!session_type){
                            if(this.model.get('jid').indexOf(converse.muc_service_url) >=0 ){
                                session_type = 'groupchat';
                            } else {
                                session_type = 'chat';
                            }
                        }

                        if(session_type != 'chat'){
                            var room = converse.roomInfo(id),
                            url = converse.imapi_url + converse.imapi_room_withdraw;
                            data.roomId = room.id;
                        }

                        $.ajax({
                            url: url,
                            data: data,
                            cache: false,
                            success: function (data) {
                                if(data && data.resultCode && data.resultCode == 1){
                                    //将内容在session中更改
                                    if(_that.model.messages && _that.model.messages.models && _that.model.messages.models.length > 0){
                                        for(var i = 0; i < _that.model.messages.models.length; i++){
                                            var session_msg = _that.model.messages.models[i];
                                            if(session_msg.attributes && session_msg.attributes.msgid === msgid) {
                                                var msg_attr = session_msg.attributes;
                                                _that.model.messages.remove(msg_attr);

                                                if (_that.model.messages.browserStorage && _that.model.messages.browserStorage.name) {
                                                    window.sessionStorage.removeItem(_that.model.messages.browserStorage.name + "-" + msg_attr.id);
                                                }
                                                break;
                                            }
                                        }
                                    }

                                    //将显示的内容删除
                                    $chat_message.remove();

                                    //再发一条消息
                                    var msg_text = '{"content":"你撤回了一条消息","fromUserId":"'+Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid))+
                                        '","fromUserName":"'+converse.nick_name+'","timeSend":'+parseInt(moment() / 1000)+',"type":601, "objectId":"'+msgid+'"}';
                                    var msg = $msg({
                                        from: converse.connection.jid,
                                        to: _that.model.get('jid'),
                                        type: session_type,
                                        id: msgid
                                    }).c('body').t(msg_text).up()
                                        .c(converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up();

                                    converse.connection.send(msg);
                                    _that.model.messages.create({
                                        fullname: _that.model.get('nick'),
                                        sender: 'me',
                                        time: moment().format(),
                                        message: msg_text,
                                        msgid: msgid
                                    });

                                    //消息列表第一
                                    if (converse.allow_chatlist) {
                                        converse_api.chatlist.first(_that.model.get('jid'), session_type);
                                        converse_api.chatlist.updateItemMsg(_that.model.get('jid'), msg_text, session_type);
                                    }
                                }
                            }
                        });

                    }
                }
            });
        }
    });
}));
