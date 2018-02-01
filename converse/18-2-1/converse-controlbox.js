// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, Backbone */

(function (root, factory) {
    define("converse-controlbox", [
            "converse-core",
            "converse-api",
            "tpl!add_contact_dropdown",
            "tpl!add_contact_form",
            "tpl!change_status_message",
            "tpl!chat_status",
            "tpl!choose_status",
            "tpl!contacts_panel",
            "tpl!contacts_tab",
            "tpl!controlbox",
            "tpl!controlbox_toggle",
            "tpl!login_panel",
            "tpl!login_tab",
            "tpl!search_contact",
            "tpl!status_option",
            "tpl!agent_online_dropdown",
            "tpl!controlbox_user",
            "converse-chatview",
            "converse-rosterview"
    ], factory);
}(this, function (
            converse,
            converse_api,
            tpl_add_contact_dropdown,
            tpl_add_contact_form,
            tpl_change_status_message,
            tpl_chat_status,
            tpl_choose_status,
            tpl_contacts_panel,
            tpl_contacts_tab,
            tpl_controlbox,
            tpl_controlbox_toggle,
            tpl_login_panel,
            tpl_login_tab,
            tpl_search_contact,
            tpl_status_option,
            tpl_agent_online_dropdown,
            tpl_controlbox_user
        ) {
    "use strict";
    converse.templates.add_contact_dropdown = tpl_add_contact_dropdown;
    converse.templates.add_contact_form = tpl_add_contact_form;
    converse.templates.change_status_message = tpl_change_status_message;
    converse.templates.chat_status = tpl_chat_status;
    converse.templates.choose_status = tpl_choose_status;
    converse.templates.contacts_panel = tpl_contacts_panel;
    converse.templates.contacts_tab = tpl_contacts_tab;
    converse.templates.controlbox = tpl_controlbox;
    converse.templates.controlbox_toggle = tpl_controlbox_toggle;
    converse.templates.login_panel = tpl_login_panel;
    converse.templates.login_tab = tpl_login_tab;
    converse.templates.search_contact = tpl_search_contact;
    converse.templates.status_option = tpl_status_option;
    converse.templates.agent_online_dropdown = tpl_agent_online_dropdown;
    converse.templates.controlbox_user = tpl_controlbox_user;

    var USERS_PANEL_ID = 'users';

    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
        utils = converse_api.env.utils;
    // Other necessary globals
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        __ = utils.__.bind(converse),
        moment = converse_api.env.moment;


    if(converse.converse_complete_model) {
        converse_api.plugins.add('converse-controlbox', {

            overrides: {
                // Overrides mentioned here will be picked up by converse.js's
                // plugin architecture they will replace existing methods on the
                // relevant objects or classes.
                //
                // New functions which don't exist yet can also be added.

                initSession: function () {
                    this.controlboxtoggle = new this.ControlBoxToggle();
                    this.__super__.initSession.apply(this, arguments);
                },

                initConnection: function () {
                    this.__super__.initConnection.apply(this, arguments);
                    if (this.connection) {
                        this.addControlBox();
                    }
                },

                _tearDown: function () {
                    this.__super__._tearDown.apply(this, arguments);
                    if (this.rosterview) {
                        this.rosterview.unregisterHandlers();
                        // Removes roster groups
                        this.rosterview.model.off().reset();
                        this.rosterview.each(function (groupview) {
                            groupview.removeAll();
                            groupview.remove();
                        });
                        this.rosterview.removeAll().remove();
                    }
                },

                clearSession: function () {
                    this.__super__.clearSession.apply(this, arguments);
                    if (_.isUndefined(this.connection) && this.connection.connected) {
                        this.chatboxes.get('controlbox').save({'connected': false});
                    }
                },

                ChatBoxes: {
                    chatBoxMayBeShown: function (chatbox) {
                        return this.__super__.chatBoxMayBeShown.apply(this, arguments) &&
                            chatbox.get('id') !== 'controlbox';
                    },

                    onChatBoxesFetched: function (collection, resp) {
                        this.__super__.onChatBoxesFetched.apply(this, arguments);
                        if (!_.include(_.pluck(resp, 'id'), 'controlbox')) {
                            this.add({
                                id: 'controlbox',
                                box_id: 'controlbox'
                            });
                        }
                        this.get('controlbox').save({connected: true});
                    },
                },

                ChatBoxViews: {
                    onChatBoxAdded: function (item) {
                        if (item.get('box_id') === 'controlbox') {
                            var view = this.get(item.get('id'));
                            if (view) {
                                view.model = item;
                                view.initialize();
                                return view;
                            } else {
                                view = new converse.ControlBoxView({model: item});
                                return this.add(item.get('id'), view);
                            }
                        } else {
                            return this.__super__.onChatBoxAdded.apply(this, arguments);
                        }
                    },

                    closeAllChatBoxes: function () {
                        this.each(function (view) {
                            if (!converse.connection.connected ||
                                view.model.get('id') !== 'controlbox') {
                                view.close();
                            }
                        });
                        return this;
                    },

                    getChatBoxWidth: function (view) {
                        var controlbox = this.get('controlbox');
                        if (view.model.get('id') === 'controlbox') {
                            /* We return the width of the controlbox or its toggle,
                             * depending on which is visible.
                             */
                            if (!controlbox || !controlbox.$el.is(':visible')) {
                                return converse.controlboxtoggle.$el.outerWidth(true);
                            } else {
                                return controlbox.$el.outerWidth(true);
                            }
                        } else {
                            return this.__super__.getChatBoxWidth.apply(this, arguments);
                        }
                    }
                },


                ChatBox: {
                    initialize: function () {
                        if (this.get('id') === 'controlbox') {
                            this.set({
                                'time_opened': moment(0).valueOf(),
                                'num_unread': 0
                            });
                        } else {
                            this.__super__.initialize.apply(this, arguments);
                        }
                    },
                },


                ChatBoxView: {
                    insertIntoDOM: function () {
                        this.$el.insertAfter(converse.chatboxviews.get("controlbox").$el);
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
                    allow_logout: true,
                    default_domain: undefined,
                    show_controlbox_by_default: false,
                    sticky_controlbox: false,
                    xhr_user_search: false,
                    xhr_user_search_url: ''
                });

                var LABEL_CONTACTS = __('Contacts');

                converse.addControlBox = function () {
                    return converse.chatboxes.add({
                        id: 'controlbox',
                        box_id: 'controlbox',
                        closed: !converse.show_controlbox_by_default
                    });
                };

                converse.ControlBoxView = converse.ChatBoxView.extend({
                    tagName: 'div',
                    className: 'chatbox',
                    id: 'controlbox',
                    events: {
                        'click a.close-chatbox-button': 'close',
                        'click ul#controlbox-tabs li *': 'switchTab',
                        'click .create-room-panel .create-room-btn': 'createRoom',
                        'click a.agent_offline': 'agentEditOffline',
                        'click a.agent_online': 'agentEditOnline',
                        'click a.create-online-service-btn': 'openDefaultOnlineService',
                        'click a#agent-status': 'toggleAgentStateOptions',
                        'click .agent-status-panel ul li a': 'clickAgentStatus',
                        'submit form.add-friend-form': 'addFriendFromForm',
                        'click a.toggle-add-friend-form': 'toggleAddFriendForm'
                    },

                    initialize: function () {
                        this.$el.insertAfter(converse.controlboxtoggle.$el);
                        this.model.on('change:connected', this.onConnected, this);
                        this.model.on('destroy', this.hide, this);
                        this.model.on('hide', this.hide, this);
                        this.model.on('show', this.show, this);
                        this.model.on('change:closed', this.ensureClosedState, this);
                        this.render();
                        if (this.model.get('connected')) {
                            this.insertRoster();
                        }
                        if (typeof this.model.get('closed') === 'undefined') {
                            this.model.set('closed', !converse.show_controlbox_by_default);
                        }
                        if (!this.model.get('closed')) {
                            this.show();
                        } else {
                            this.hide();
                        }
                    },

                    render: function () {
                        this.$el.html(converse.templates.controlbox(
                            _.extend(this.model.toJSON(), {
                                sticky_controlbox: converse.sticky_controlbox,
                                label_close: __("Narrow this cat box")
                            }))
                        );
                        if (!converse.connection.connected || !converse.connection.authenticated || converse.connection.disconnecting) {
                            this.renderLoginPanel();
                        } else if (!this.contactspanel || !this.contactspanel.$el.is(':visible')) {
                            this.renderContactsPanel();
                        }
                        if (converse.connection.connected) {
                            this.renderUserPanel();
                        }

                        return this;
                    },

                    onConnected: function () {
                        if (this.model.get('connected')) {
                            this.render().insertRoster();
                        }
                    },

                    insertRoster: function () {
                        /* We initialize the roster, which will appear inside the
                         * Contacts Panel.
                         */
                        this.contactspanel.$el.append(converse.rosterview.$el);
                        return this;
                    },

                    renderLoginPanel: function () {
                        this.loginpanel = new converse.LoginPanel({
                            '$parent': this.$el.find('.controlbox-panes'),
                            'model': this
                        });
                        this.loginpanel.render();
                        return this;
                    },

                    renderContactsPanel: function () {
                        if (_.isUndefined(this.model.get('active-panel'))) {
                            this.model.save({'active-panel': USERS_PANEL_ID});
                        }
                        this.contactspanel = new converse.ContactsPanel({
                            '$parent': this.$el.find('.controlbox-panes')
                        });
                        this.contactspanel.render();
                        converse.xmppstatusview = new converse.XMPPStatusView({
                            'model': converse.xmppstatus
                        });
                        converse.xmppstatusview.render();
                    },

                    renderUserPanel: function () {
                        var $top = this.$el.find('.controlbox-head'),
                            avatar_url = converse.emoticons_file_path + converse.user_default_img;
                        if (converse.hasAvatar) {
                            avatar_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + Strophe.getNodeFromJid(converse.jid) + '&type=t&access_token=' + converse.access_token;
                        }

                        //如果是客服，增加签到签退
                        var label_click_btn, label_info,
                            show_agent_state = false;
                        if (converse.is_agent) {
                            //已签退
                            if(!converse.agent_status || (converse.agent_status && converse.agent_status === 2 && converse.agent_state && converse.agent_state === 'checkout')){
                                label_click_btn = __('agent_online');
                                label_info = __('sign in');
                            } else {
                                label_click_btn = __('agent_offline');
                                label_info = __('sign out');
                                show_agent_state = true;
                            }
                        }
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

                        var html = converse.templates.controlbox_user(
                            _.extend(this.model.toJSON(), {
                                sticky_controlbox: converse.sticky_controlbox,
                                label_close: __("Narrow this cat box"),
                                user_avatar_url: avatar_url,
                                user_nickname: converse.nick_name,
                                label_title: __("new group chat"),
                                is_agent: converse.is_agent,
                                check_online_label_click_btn: label_click_btn,
                                check_online_label_info: label_info,
                                show_online_service_toolbar: converse.default_official,
                                online_service_label_title: __("Click to request online service"),
                                show_agent_state: show_agent_state,
                                agent_state: agent_state_html,
                                agent_state_description: agent_state_description,
                                agent_state_val: agent_state_val,
                                agent_state_icon: agent_state_icon,
                                add_friend_label: __('Click to add new chat contacts'),
                                add_friend_input_placeh: __('phone'),
                                add_friend_button_label: __('Add')
                            }));

                        $top.prepend(html);
                    },

                    close: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        if (converse.connection.connected) {
                            this.model.save({'closed': true});
                        } else {
                            this.model.trigger('hide');
                        }
                        converse.emit('controlBoxClosed', this);
                        return this;
                    },

                    ensureClosedState: function () {
                        if (this.model.get('closed')) {
                            this.hide();
                        } else {
                            this.show();
                        }
                    },

                    hide: function (callback) {
                        this.$el.addClass('hidden');
                        utils.refreshWebkit();
                        converse.emit('chatBoxClosed', this);
                        if (!converse.connection.connected) {
                            converse.controlboxtoggle.render();
                        }
                        converse.controlboxtoggle.show(callback);
                        return this;
                    },

                    onControlBoxToggleHidden: function () {
                        var that = this;
                        utils.fadeIn(this.el, function () {
                            converse.controlboxtoggle.updateOnlineCount();
                            utils.refreshWebkit();
                            converse.emit('controlBoxOpened', that);
                        });
                    },

                    show: function () {
                        converse.controlboxtoggle.hide(
                            this.onControlBoxToggleHidden.bind(this)
                        );
                        return this;
                    },

                    switchTab: function (ev) {
                        // TODO: automatically focus the relevant input
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var $tab = $(ev.target),
                            $sibling,
                            $tab_panel,
                            $a = $tab;
                        if ($tab.is('a')) {
                            $sibling = $tab.parent().siblings('li').children('a');
                            $tab_panel = $($tab.attr('href'));
                        }
                        if ($tab.is('img') || $tab.is('span')) {
                            $sibling = $tab.parent().parent().siblings('li').children('a');
                            $tab_panel = $($tab.parent().attr('href'));
                            $a = $tab.parent();
                        }

                        $sibling.each(function (index, element) {
                            $($(element).attr('href')).hide();
                            $(element).removeClass('current');
                        });
                        //$($sibling.attr('href')).addClass('hidden');
                        //$sibling.removeClass('current');
                        $a.addClass('current');
                        $tab_panel.removeClass('hidden').css('display', "block");
                        if (converse.connection.connected) {
                            this.model.save({'active-panel': $tab.data('id')});
                        }
                        return this;
                    },

                    showHelpMessages: function (msgs) {
                        // Override showHelpMessages in ChatBoxView, for now do nothing.
                        return;
                    },

                    //自定义方法
                    createRoom: function (ev) {
                        converse_api.createroom.open();
                    },

                    agentEditOnline: function (ev) {
                        var $ev_target = $(ev.target);
                        $.ajax({
                            url: converse.imapi_url + converse.imapi_agent_online,
                            data: {access_token: converse.access_token},
                            success: function (result) {
                                if (result && result.resultCode && result.resultCode == 1) {
                                    if (converse.new_modal) {
                                        $.dialog('alert', __('prompt'), __('Sign in successfully'), 0);
                                    } else {
                                        alert(__('Sign in successfully'));
                                    }

                                    converse.agent_status = 1;

                                    //将状态更改为空闲并解锁
                                    var $panel =$ev_target.parent().parent().find('.agent-status-panel');
                                    $panel.find('#agent-status').removeClass().addClass('available').addClass('icon-online').attr('title', '空闲');
                                    $panel.show();

                                    //将签到改成签退
                                    $ev_target.removeClass('agent_online').addClass('agent_offline').attr('title', '签退');
                                } else {
                                    if (converse.new_modal) {
                                        $.dialog('alert', __('prompt'), __('An error occurred'), 0);
                                    } else {
                                        alert(__('An error occurred'));
                                    }
                                }
                            }
                        });
                    },

                    agentEditOffline: function (ev) {
                        var $ev_target = $(ev.target);
                        $.ajax({
                            url: converse.imapi_url + converse.imapi_agent_offline,
                            data: {access_token: converse.access_token},
                            success: function(result) {
                                if (result && result.resultCode && result.resultCode == 1) {
                                    if (converse.new_modal) {
                                        $.dialog('alert', __('prompt'), __('Sign back successfully'), 0);
                                    } else {
                                        alert(__('Sign back successfully'));
                                    }

                                    converse.agent_status = 2;
                                    //将状态解锁
                                    $ev_target.parent().parent().find('.agent-status-panel').hide();

                                    //将签退改成签到
                                    $ev_target.removeClass('agent_offline').addClass('agent_online').attr('title', ' 签到');
                                } else {
                                    if (converse.new_modal) {
                                        $.dialog('alert', __('prompt'), __('An error occurred'), 0);
                                    } else {
                                        alert(__('An error occurred'));
                                    }
                                }
                            }
                        });
                    },

                    openDefaultOnlineService: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var $el = $(ev.target);
                        if (!$el.attr("data-official")) {
                            if (converse.new_modal) {
                                $.dialog('alert', __('prompt'), __('Default online customer service is not set'), 0);
                            } else {
                                alert(__('Default online customer service is not set'));
                            }
                            return;
                        }
                        converse_api.rooms.online_service(null, $el.attr("data-official"));
                        $('ul#controlbox-tabs li a[href="#chatlist"]').click();
                    },

                    toggleAgentStateOptions: function (ev) {
                        ev.preventDefault();
                        $(ev.target).parent().find('ul').toggle('fast');
                    },

                    clickAgentStatus: function (ev) {
                        ev.preventDefault();
                        var status = $(ev.target).attr('data-value');
                        var ioc = $(ev.target).find('span').attr('class');
                        var describe = $(ev.target).text();

                        $.ajax({
                            url: converse.imapi_url+converse.imapi_agent_online,
                            data:{access_token:converse.access_token,status:status},
                            success: function(result){
                                if(result && result.resultCode && result.resultCode == 1){
                                    var $panel = $(ev.target).parents('.agent-status-panel');
                                    $panel.find('#agent-status').removeClass().addClass(status).addClass(ioc).attr('title', describe);
                                    $panel.find('ul').hide();
                                }
                            }
                        });
                    },

                    toggleAddFriendForm: function (ev) {
                        ev.preventDefault();
                        $(ev.target).parent().find('.username').val('');
                        $(ev.target).parent().find('dd').toggle('fast', function () {
                            if ($(this).is(':visible')) {
                                $(this).find('input.username').focus();
                            }
                        });
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
                    }

                });


                converse.LoginPanel = Backbone.View.extend({
                    tagName: 'div',
                    id: "login-dialog",
                    className: 'controlbox-pane',
                    events: {
                        'submit form#converse-login': 'authenticate'
                    },

                    initialize: function (cfg) {
                        cfg.$parent.html(this.$el.html(
                            converse.templates.login_panel({
                                'ANONYMOUS': converse.ANONYMOUS,
                                'EXTERNAL': converse.EXTERNAL,
                                'LOGIN': converse.LOGIN,
                                'PREBIND': converse.PREBIND,
                                'auto_login': converse.auto_login,
                                'authentication': converse.authentication,
                                'label_username': __('XMPP Username:'),
                                'label_password': __('Password:'),
                                'label_anon_login': __('Click here to log in anonymously'),
                                'label_login': __('Log In'),
                                'placeholder_username': (converse.locked_domain || converse.default_domain) && __('Username') || __('user@server'),
                                'placeholder_password': __('password')
                            })
                        ));
                        this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                    },

                    render: function () {
                        this.$tabs.append(converse.templates.login_tab({label_sign_in: __('Sign in')}));
                        this.$el.find('input#jid').focus();
                        if (!this.$el.is(':visible')) {
                            this.$el.show();
                        }
                        return this;
                    },

                    authenticate: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var $form = $(ev.target);
                        if (converse.authentication === converse.ANONYMOUS) {
                            this.connect($form, converse.jid, null);
                            return;
                        }
                        var $jid_input = $form.find('input[name=jid]'),
                            jid = $jid_input.val(),
                            $pw_input = $form.find('input[name=password]'),
                            password = $pw_input.val(),
                            errors = false;

                        if (!jid) {
                            errors = true;
                            $jid_input.addClass('error');
                        }
                        if (!password && converse.authentication !== converse.EXTERNAL) {
                            errors = true;
                            $pw_input.addClass('error');
                        }
                        if (errors) {
                            return;
                        }
                        if (converse.locked_domain) {
                            jid = Strophe.escapeNode(jid) + '@' + converse.locked_domain;
                        } else if (converse.default_domain && jid.indexOf('@') === -1) {
                            jid = jid + '@' + converse.default_domain;
                        }
                        this.connect($form, jid, password);
                        return false;
                    },

                    connect: function ($form, jid, password) {
                        var resource;
                        if ($form) {
                            $form.find('input[type=submit]').hide().after('<span class="spinner login-submit"/>');
                        }
                        if (jid) {
                            resource = Strophe.getResourceFromJid(jid);
                            if (!resource) {
                                jid = jid.toLowerCase() + converse.generateResource();
                            } else {
                                jid = Strophe.getBareJidFromJid(jid).toLowerCase() + '/' + resource;
                            }
                        }
                        converse.connection.connect(jid, password, converse.onConnectStatusChanged);
                    },

                    remove: function () {
                        this.$tabs.empty();
                        this.$el.parent().empty();
                    }
                });


                converse.XMPPStatusView = Backbone.View.extend({
                    el: "span#xmpp-status-holder",

                    events: {
                        "click a.choose-xmpp-status": "toggleOptions",
                        "click #fancy-xmpp-status-select a.change-xmpp-status-message": "renderStatusChangeForm",
                        "submit #set-custom-xmpp-status": "setStatusMessage",
                        "click .dropdown dd ul li a": "setStatus"
                    },

                    initialize: function () {
                        this.model.on("change:status", this.updateStatusUI, this);
                        this.model.on("change:status_message", this.updateStatusUI, this);
                        this.model.on("update-status-ui", this.updateStatusUI, this);
                    },

                    render: function () {
                        // Replace the default dropdown with something nicer
                        var $select = this.$el.find('select#select-xmpp-status'),
                            chat_status = this.model.get('status') || 'offline',
                            options = $('option', $select),
                            $options_target,
                            options_list = [];
                        this.$el.html(converse.templates.choose_status());

                        this.$el.find('#fancy-xmpp-status-select')
                            .html(converse.templates.chat_status({
                                'status_message': this.model.get('status_message') || __("I am %1$s", this.getPrettyStatus(chat_status)),
                                'chat_status': chat_status,
                                'desc_custom_status': __('Click here to write a custom status message'),
                                'desc_change_status': __('Click to change your chat status')
                            }));

                        options.each(function () {
                            options_list.push(converse.templates.status_option({
                                'value': $(this).val(),
                                'text': this.text,
                                'ico': '',
                                'status_class': 'converse_status_list'
                            }));
                        });

                        $options_target = this.$el.find("#target dd ul").hide();
                        $options_target.append(options_list.join(''));
                        $select.remove();

                        return this;
                    },

                    toggleOptions: function (ev) {
                        ev.preventDefault();
                        $(ev.target).parent().parent().siblings('dd').find('ul').toggle('fast');
                    },

                    renderStatusChangeForm: function (ev) {
                        ev.preventDefault();
                        var status_message = this.model.get('status') || 'offline';
                        var input = converse.templates.change_status_message({
                            'status_message': status_message,
                            'label_custom_status': __('Custom status'),
                            'label_save': __('Save')
                        });
                        var $xmppstatus = this.$el.find('.xmpp-status');
                        $xmppstatus.parent().addClass('no-border');
                        $xmppstatus.replaceWith(input);
                        this.$el.find('.custom-xmpp-status').focus().focus();
                    },

                    setStatusMessage: function (ev) {
                        ev.preventDefault();
                        this.model.setStatusMessage($(ev.target).find('input').val());
                    },

                    setStatus: function (ev) {
                        ev.preventDefault();
                        var $el = $(ev.currentTarget),
                            value = $el.attr('data-value');

                        if (value === 'logout') {
                            this.$el.find(".dropdown dd ul").hide();
                            converse.logOut();
                        } else {
                            this.model.setStatus(value);
                            this.$el.find(".dropdown dd ul").hide();
                        }
                    },

                    getPrettyStatus: function (stat) {
                        if (stat === 'chat') {
                            return __('online');
                        } else if (stat === 'dnd') {
                            return __('busy');
                        } else if (stat === 'xa') {
                            return __('away for long');
                        } else if (stat === 'away') {
                            return __('away');
                        } else if (stat === 'offline') {
                            return __('offline');
                        } else if (stat === 'available') {
                            return __('available');
                        } else if (stat === 'calling') {
                            return __('calling');
                        } else if (stat === 'rest') {
                            return __('rest');
                        } else {
                            return __(stat) || __('online');
                        }
                    },

                    updateStatusUI: function (model) {
                        var stat = model.get('status');
                        // For translators: the %1$s part gets replaced with the status
                        // Example, I am online
                        var status_message = model.get('status_message') || __("I am %1$s", this.getPrettyStatus(stat));
                        this.$el.find('#fancy-xmpp-status-select').removeClass('no-border').html(
                            converse.templates.chat_status({
                                'chat_status': stat,
                                'status_message': status_message,
                                'desc_custom_status': __('Click here to write a custom status message'),
                                'desc_change_status': __('Click to change your chat status')
                            }));
                    }
                });


                converse.ContactsPanel = Backbone.View.extend({
                    tagName: 'div',
                    className: 'controlbox-pane',
                    id: 'users',
                    events: {
                        'click a.toggle-xmpp-contact-form': 'toggleContactForm',
                        'submit form.add-xmpp-contact': 'addContactFromForm',
                        'submit form.search-xmpp-contact': 'searchContacts',
                        'click a.subscribe-to-user': 'addContactFromList'
                    },

                    initialize: function (cfg) {
                        cfg.$parent.append(this.$el);
                        this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                    },

                    render: function () {
                        var markup;
                        var widgets = converse.templates.contacts_panel({
                            label_online: __('Online'),
                            label_busy: __('Busy'),
                            label_away: __('Away'),
                            label_offline: __('Offline'),
                            label_logout: __('Log out'),
                            include_offline_state: converse.include_offline_state,
                            allow_logout: converse.allow_logout
                        });
                        var controlbox = converse.chatboxes.get('controlbox');
                        this.$tabs.append(converse.templates.contacts_tab({
                            'label_contacts': LABEL_CONTACTS,
                            'is_current': controlbox.get('active-panel') === USERS_PANEL_ID,
                            'ioc_path': converse.emoticons_file_path
                        }));
                        if (converse.xhr_user_search) {
                            markup = converse.templates.search_contact({
                                label_contact_name: __('Contact name'),
                                label_search: __('Search')
                            });
                        } else {
                            markup = converse.templates.add_contact_form({
                                label_contact_username: __('手机号码'),
                                label_add: __('Add')
                            });
                        }

                        if (converse.allow_contact_requests) {
                            widgets += converse.templates.add_contact_dropdown({
                                label_click_to_chat: __('Click to add new chat contacts'),
                                label_add_contact: __('Add a contact')
                            });
                        }

                        this.$el.html(widgets);
                        this.$el.find('.search-xmpp ul').append(markup);
                        if (controlbox.get('active-panel') !== USERS_PANEL_ID) {
                            this.$el.addClass('hidden');
                        }
                        return this;
                    },

                    toggleContactForm: function (ev) {
                        ev.preventDefault();
                        this.$el.find('.search-xmpp').toggle('fast', function () {
                            if ($(this).is(':visible')) {
                                $(this).find('input.username').focus();
                            }
                        });
                    },

                    searchContacts: function (ev) {
                        ev.preventDefault();
                        $.getJSON(converse.xhr_user_search_url + "?q=" + $(ev.target).find('input.username').val(), function (data) {
                            var $ul = $('.search-xmpp ul');
                            $ul.find('li.found-user').remove();
                            $ul.find('li.chat-info').remove();
                            if (!data.length) {
                                $ul.append('<li class="chat-info">' + __('No users found') + '</li>');
                            }
                            $(data).each(function (idx, obj) {
                                $ul.append(
                                    $('<li class="found-user"></li>')
                                        .append(
                                            $('<a class="subscribe-to-user" href="#" title="' + __('Click to add as a chat contact') + '"></a>')
                                                .attr('data-recipient', Strophe.getNodeFromJid(obj.id) + "@" + Strophe.getDomainFromJid(obj.id))
                                                .text(obj.fullname)
                                        )
                                );
                            });
                        });
                    },

                    addContactFromForm: function (ev) {
                        ev.preventDefault();
                        var $input = $(ev.target).find('input');
                        var name = $input.val();
                        if (!name) {
                            // this is not a valid JID
                            //$input.addClass('error');
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
                                    $('.search-xmpp').hide();
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

                    addContactFromList: function (ev) {
                        ev.preventDefault();
                        var $target = $(ev.target),
                            jid = $target.attr('data-recipient'),
                            name = $target.text();
                        converse.roster.addAndSubscribe(jid, name);
                        $target.parent().remove();
                        $('.search-xmpp').hide();
                    }

                });


                converse.ControlBoxToggle = Backbone.View.extend({
                    tagName: 'a',
                    className: 'toggle-controlbox hidden',
                    id: 'toggle-controlbox',
                    events: {
                        'click': 'onClick'
                    },
                    attributes: {
                        'href': "#"
                    },

                    initialize: function () {
                        converse.chatboxviews.$el.prepend(this.render());
                        this.updateOnlineCount();
                        var that = this;
                        converse.on('initialized', function () {
                            converse.roster.on("add", that.updateOnlineCount, that);
                            converse.roster.on('change', that.updateOnlineCount, that);
                            converse.roster.on("destroy", that.updateOnlineCount, that);
                            converse.roster.on("remove", that.updateOnlineCount, that);
                        });
                    },

                    render: function () {

                        // We let the render method of ControlBoxView decide whether
                        // the ControlBox or the Toggle must be shown. This prevents
                        // artifacts (i.e. on page load the toggle is shown only to then
                        // seconds later be hidden in favor of the control box).
                        return this.$el.html(
                            converse.templates.controlbox_toggle({
                                'label_toggle': __('Toggle chat')
                            })
                        );
                    },

                    updateOnlineCount: _.debounce(function () {
                        if (typeof converse.roster === 'undefined') {
                            return;
                        }
                        var $count = this.$('#online-count');
                        $count.text('(' + converse.roster.getNumOnlineContacts() + ')');
                        if (!$count.is(':visible')) {
                            $count.show();
                        }
                    }, converse.animate ? 100 : 0),

                    hide: function (callback) {
                        this.el.classList.add('hidden');
                        callback();
                    },

                    show: function (callback) {
                        utils.fadeIn(this.el, callback);
                    },

                    showControlBox: function () {
                        var controlbox = converse.chatboxes.get('controlbox');
                        if (!controlbox) {
                            controlbox = converse.addControlBox();
                        }
                        if (converse.connection.connected) {
                            controlbox.save({closed: false});
                        } else {
                            controlbox.trigger('show');
                        }
                    },

                    onClick: function (e) {
                        e.preventDefault();
                        if ($("div#controlbox").is(':visible')) {
                            var controlbox = converse.chatboxes.get('controlbox');
                            if (converse.connection.connected) {
                                controlbox.save({closed: true});
                            } else {
                                controlbox.trigger('hide');
                            }
                        } else {
                            this.showControlBox();
                        }
                    }
                });

                var disconnect = function () {
                    /* Upon disconnection, set connected to `false`, so that if
                     * we reconnect,
                     * "onConnected" will be called, to fetch the roster again and
                     * to send out a presence stanza.
                     */
                    var view = converse.chatboxviews.get('controlbox');
                    view.model.set({connected: false});
                    view.$('#controlbox-tabs').empty();
                    view.renderLoginPanel();
                };
                converse.on('disconnected', disconnect);

                var afterReconnected = function () {
                    /* After reconnection makes sure the controlbox's is aware.
                     */
                    var view = converse.chatboxviews.get('controlbox');
                    if (view.model.get('connected')) {
                        converse.chatboxviews.get("controlbox").onConnected();
                    } else {
                        view.model.set({connected: true});
                    }
                };
                converse.on('reconnected', afterReconnected);

            }
        });
    }
}));
