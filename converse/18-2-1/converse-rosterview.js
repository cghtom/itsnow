// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

(function (root, factory) {
    define("converse-rosterview", [
            "converse-core",
            "converse-api",
            "tpl!group_header",
            "tpl!pending_contact",
            "tpl!requesting_contact",
            "tpl!roster",
            "tpl!roster_item",
            "tpl!roster_a",
            "tpl!official_group_item",
            "tpl!rosterview_room_item"
    ], factory);
}(this, function (
            converse,
            converse_api, 
            tpl_group_header,
            tpl_pending_contact,
            tpl_requesting_contact,
            tpl_roster,
            tpl_roster_item,
            tpl_roster_a,
            tpl_official_group_item,
            tpl_rosterview_room_item) {
    "use strict";
    converse.templates.group_header = tpl_group_header;
    converse.templates.pending_contact = tpl_pending_contact;
    converse.templates.requesting_contact = tpl_requesting_contact;
    converse.templates.roster = tpl_roster;
    converse.templates.roster_item = tpl_roster_item;
    converse.templates.roster_a = tpl_roster_a;
    converse.templates.official_group_item = tpl_official_group_item;
    converse.templates.rosterview_room_item = tpl_rosterview_room_item;

    var $ = converse_api.env.jQuery,
        utils = converse_api.env.utils,
        Strophe = converse_api.env.Strophe,
        $msg = converse_api.env.$msg,
        $iq = converse_api.env.$iq,
        b64_sha1 = converse_api.env.b64_sha1,
        moment = converse_api.env.moment,
        _ = converse_api.env._,
        __ = utils.__.bind(converse);

    if(converse.converse_complete_model) {
        converse_api.plugins.add('rosterview', {

            overrides: {
                // Overrides mentioned here will be picked up by converse.js's
                // plugin architecture they will replace existing methods on the
                // relevant objects or classes.
                //
                // New functions which don't exist yet can also be added.
                afterReconnected: function () {
                    this.rosterview.registerRosterXHandler();
                    this.__super__.afterReconnected.apply(this, arguments);
                },

                _tearDown: function () {
                    /* Remove the rosterview when tearing down. It gets created
                     * anew when reconnecting or logging in.
                     */
                    this.__super__._tearDown.apply(this, arguments);
                    if (!_.isUndefined(this.rosterview)) {
                        this.rosterview.remove();
                    }
                },

                RosterGroups: {
                    comparator: function () {
                        // RosterGroupsComparator only gets set later (once i18n is
                        // set up), so we need to wrap it in this nameless function.
                        return converse.RosterGroupsComparator.apply(this, arguments);
                    }
                }
            },


            initialize: function () {
                /* The initialize function gets called as soon as the plugin is
                 * loaded by converse.js's plugin machinery.
                 */
                this.updateSettings({
                    allow_chat_pending_contacts: false,
                    allow_contact_removal: true,
                    show_toolbar: true,
                });

                var STATUSES = {
                    'dnd': __('This contact is busy'),
                    'online': __('This contact is online'),
                    'offline': __('This contact is offline'),
                    'unavailable': __('This contact is unavailable'),
                    'xa': __('This contact is away for an extended period'),
                    'away': __('This contact is away')
                };
                var LABEL_CONTACTS = __('Contacts');
                var LABEL_GROUPS = __('Groups');
                var HEADER_CURRENT_CONTACTS = __('My contacts');
                var HEADER_PENDING_CONTACTS = __('My friend');
                var HEADER_REQUESTING_CONTACTS = __('Contact requests');
                var HEADER_UNGROUPED = __('未分组');
                var HEADER_WEIGHTS = {};
                HEADER_WEIGHTS[HEADER_REQUESTING_CONTACTS] = 0;
                HEADER_WEIGHTS[HEADER_CURRENT_CONTACTS] = 1;
                HEADER_WEIGHTS[HEADER_UNGROUPED] = 2;
                HEADER_WEIGHTS[HEADER_PENDING_CONTACTS] = 3;

                converse.RosterGroupsComparator = function (a, b) {
                    /* Groups are sorted alphabetically, ignoring case.
                     * However, Ungrouped, Requesting Contacts and Pending Contacts
                     * appear last and in that order.
                     */
                    a = a.get('name');
                    b = b.get('name');
                    var special_groups = _.keys(HEADER_WEIGHTS);
                    var a_is_special = _.contains(special_groups, a);
                    var b_is_special = _.contains(special_groups, b);
                    if (!a_is_special && !b_is_special) {
                        return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0);
                    } else if (a_is_special && b_is_special) {
                        return HEADER_WEIGHTS[a] < HEADER_WEIGHTS[b] ? -1 : (HEADER_WEIGHTS[a] > HEADER_WEIGHTS[b] ? 1 : 0);
                    } else if (!a_is_special && b_is_special) {
                        return (b === HEADER_REQUESTING_CONTACTS) ? 1 : -1;
                    } else if (a_is_special && !b_is_special) {
                        return (a === HEADER_REQUESTING_CONTACTS) ? -1 : 1;
                    }
                };


                converse.RosterFilter = Backbone.Model.extend({
                    initialize: function () {
                        this.set({
                            'filter_text': '',
                            'filter_type': 'contacts',
                            'chat_state': ''
                        });
                    },
                });

                converse.RosterFilterView = Backbone.View.extend({
                    tagName: 'span',
                    events: {
                        "keydown .roster-filter": "liveFilter",
                        "click .onX": "clearFilter",
                        "mousemove .x": "toggleX",
                        "change .filter-type": "changeTypeFilter",
                        "change .state-type": "changeChatStateFilter"
                    },

                    initialize: function () {
                        this.model.on('change', this.render, this);
                    },

                    render: function () {
                        this.$el.html(converse.templates.roster(
                            _.extend(this.model.toJSON(), {
                                placeholder: __('Filter'),
                                label_contacts: LABEL_CONTACTS,
                                label_groups: LABEL_GROUPS,
                                label_state: __('State'),
                                label_any: __('Any'),
                                label_online: __('Online'),
                                label_chatty: __('Chatty'),
                                label_busy: __('Busy'),
                                label_away: __('Away'),
                                label_xa: __('Extended Away'),
                                label_offline: __('Offline')
                            })
                        ));
                        var $roster_filter = this.$('.roster-filter');
                        $roster_filter[this.tog($roster_filter.val())]('x');
                        return this.$el;
                    },

                    tog: function (v) {
                        return v ? 'addClass' : 'removeClass';
                    },

                    toggleX: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var el = ev.target;
                        $(el)[this.tog(el.offsetWidth - 18 < ev.clientX - el.getBoundingClientRect().left)]('onX');
                    },

                    changeChatStateFilter: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        this.model.save({
                            'chat_state': this.$('.state-type').val()
                        });
                    },

                    changeTypeFilter: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var type = ev.target.value;
                        if (type === 'state') {
                            this.model.save({
                                'filter_type': type,
                                'chat_state': this.$('.state-type').val()
                            });
                        } else {
                            this.model.save({
                                'filter_type': type,
                                'filter_text': this.$('.roster-filter').val(),
                            });
                        }
                    },

                    liveFilter: _.debounce(function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        this.model.save({
                            'filter_type': this.$('.filter-type').val(),
                            'filter_text': this.$('.roster-filter').val()
                        });
                    }, 250),

                    isActive: function () {
                        /* Returns true if the filter is enabled (i.e. if the user
                         * has added values to the filter).
                         */
                        if (this.model.get('filter_type') === 'state' ||
                            this.model.get('filter_text')) {
                            return true;
                        }
                        return false;
                    },

                    show: function () {
                        if (this.$el.is(':visible')) {
                            return this;
                        }
                        this.$el.show();
                        return this;
                    },

                    hide: function () {
                        if (!this.$el.is(':visible')) {
                            return this;
                        }
                        if (this.$('.roster-filter').val().length > 0) {
                            // Don't hide if user is currently filtering.
                            return;
                        }
                        this.model.save({
                            'filter_text': '',
                            'chat_state': ''
                        });
                        this.$el.hide();
                        return this;
                    },

                    clearFilter: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                            $(ev.target).removeClass('x onX').val('');
                        }
                        this.model.save({
                            'filter_text': ''
                        });
                    }
                });

                converse.RosterView = Backbone.Overview.extend({
                    tagName: 'div',
                    id: 'converse-roster',
                    events: {
                        'click .officials-group a.group-toggle': 'groupToggle',
                        'click #converse-controlbox-official-rooms .official-group-item .open-service': 'openOfficialChat',
                        'click #converse-controlbox-official-rooms .official-group-item .send-official-service': 'sendServiceRequest',
                        'click #converse-controlbox-official-rooms .official-group-item .set-official-default': 'setDefaultOfficial',
                        'click #converse-controlbox-official-rooms .rosterview-room-group-item': 'openRoom'
                    },

                    initialize: function () {
                        this.roster_handler_ref = this.registerRosterHandler();
                        this.rosterx_handler_ref = this.registerRosterXHandler();
                        converse.roster.on("add", this.onContactAdd, this);
                        converse.roster.on('change', this.onContactChange, this);
                        converse.roster.on("destroy", this.update, this);
                        converse.roster.on("remove", this.update, this);
                        this.model.on("add", this.onGroupAdd, this);
                        this.model.on("reset", this.reset, this);
                        converse.on('rosterGroupsFetched', this.positionFetchedGroups, this);
                        converse.on('rosterContactsFetched', this.update, this);
                        this.createRosterFilter();
                    },

                    render: function () {
                        this.$roster = $('<dl class="roster-contacts" style="display: none;"></dl>');
                        var widgets = '<div id="converse-controlbox-official-rooms">';
                        //增加服务号列表
                        widgets = this.toggleOfficialList(widgets);

                        // 群聊列表
                        widgets = this.toggleRoomsList(widgets);

                        widgets += '</div>';
                        this.$roster.prepend(widgets);
                        this.$el.html(this.filter_view.render());

                        if (!converse.allow_contact_requests) {
                            // XXX: if we ever support live editing of config then
                            // we'll need to be able to remove this class on the fly.
                            this.$el.addClass('no-contact-requests');
                        }
                        return this;
                    },

                    createRosterFilter: function () {
                        // Create a model on which we can store filter properties
                        var model = new converse.RosterFilter();
                        model.id = b64_sha1('converse.rosterfilter' + converse.bare_jid);
                        model.browserStorage = new Backbone.BrowserStorage.local(this.filter.id);
                        this.filter_view = new converse.RosterFilterView({'model': model});
                        this.filter_view.model.on('change', this.updateFilter, this);
                        this.filter_view.model.fetch();
                    },

                    updateFilter: _.debounce(function () {
                        /* Filter the roster again.
                         * Called whenever the filter settings have been changed or
                         * when contacts have been added, removed or changed.
                         *
                         * Debounced so that it doesn't get called for every
                         * contact fetched from browser storage.
                         */
                        var type = this.filter_view.model.get('filter_type');
                        if (type === 'state') {
                            this.filter(this.filter_view.model.get('chat_state'), type);
                        } else {
                            this.filter(this.filter_view.model.get('filter_text'), type);
                        }
                    }, 100),

                    unregisterHandlers: function () {
                        converse.connection.deleteHandler(this.roster_handler_ref);
                        delete this.roster_handler_ref;
                        converse.connection.deleteHandler(this.rosterx_handler_ref);
                        delete this.rosterx_handler_ref;
                    },

                    update: _.debounce(function () {
                        if (this.$roster.parent().length === 0) {
                            this.$el.append(this.$roster.show());
                        }
                        return this.showHideFilter();
                    }, converse.animate ? 100 : 0),

                    showHideFilter: function () {
                        if (!this.$el.is(':visible')) {
                            return;
                        }
                        if (this.$roster.hasScrollBar()) {
                            this.filter_view.show();
                        } else if (!this.filter_view.isActive()) {
                            this.filter_view.hide();
                        }
                        return this;
                    },


                    filter: function (query, type) {
                        // First we make sure the filter is restored to its
                        // original state
                        _.each(this.getAll(), function (view) {
                            if (view.model.contacts.length > 0) {
                                view.show().filter('');
                            }
                        });
                        // Now we can filter
                        query = query.toLowerCase();
                        if (type === 'groups') {
                            _.each(this.getAll(), function (view, idx) {
                                if (view.model.get('name').toLowerCase().indexOf(query.toLowerCase()) === -1) {
                                    view.hide();
                                } else if (view.model.contacts.length > 0) {
                                    view.show();
                                }
                            });
                        } else {
                            _.each(this.getAll(), function (view) {
                                view.filter(query, type);
                            });
                        }
                    },

                    reset: function () {
                        converse.roster.reset();
                        this.removeAll();
                        this.$roster = $('<dl class="roster-contacts" style="display: none;"></dl>');
                        this.render().update();
                        return this;
                    },

                    registerRosterHandler: function () {
                        converse.connection.addHandler(
                            converse.roster.onRosterPush.bind(converse.roster),
                            Strophe.NS.ROSTER, 'iq', "set"
                        );
                    },

                    registerRosterXHandler: function () {
                        var t = 0;
                        converse.connection.addHandler(
                            function (msg) {
                                window.setTimeout(
                                    function () {
                                        converse.connection.flush();
                                        converse.roster.subscribeToSuggestedItems.bind(converse.roster)(msg);
                                    },
                                    t
                                );
                                t += $(msg).find('item').length * 250;
                                return true;
                            },
                            Strophe.NS.ROSTERX, 'message', null
                        );
                    },


                    onGroupAdd: function (group) {
                        var view = new converse.RosterGroupView({model: group});
                        this.add(group.get('name'), view.render());
                        this.positionGroup(view);
                    },

                    onContactAdd: function (contact) {
                        this.addRosterContact(contact).update();
                        this.updateFilter();
                    },

                    onContactChange: function (contact) {
                        this.updateChatBox(contact).update();
                        if (_.has(contact.changed, 'subscription')) {
                            if (contact.changed.subscription === 'from') {
                                this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                            } else if (_.contains(['both', 'to'], contact.get('subscription'))) {
                                this.addExistingContact(contact);
                            }
                        }
                        if (_.has(contact.changed, 'ask') && contact.changed.ask === 'subscribe') {
                            this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                        }
                        if (_.has(contact.changed, 'subscription') && contact.changed.requesting === 'true') {
                            this.addContactToGroup(contact, HEADER_REQUESTING_CONTACTS);
                        }
                        this.updateFilter();
                    },

                    updateChatBox: function (contact) {
                        var chatbox = converse.chatboxes.get(contact.get('jid')),
                            changes = {};
                        if (!chatbox) {
                            return this;
                        }
                        if (_.has(contact.changed, 'chat_status')) {
                            changes.chat_status = contact.get('chat_status');
                        }
                        if (_.has(contact.changed, 'status')) {
                            changes.status = contact.get('status');
                        }
                        chatbox.save(changes);
                        return this;
                    },

                    positionFetchedGroups: function (model, resp, options) {
                        /* Instead of throwing an add event for each group
                         * fetched, we wait until they're all fetched and then
                         * we position them.
                         * Works around the problem of positionGroup not
                         * working when all groups besides the one being
                         * positioned aren't already in inserted into the
                         * roster DOM element.
                         */
                        this.model.sort();
                        this.model.each(function (group, idx) {
                            var view = this.get(group.get('name'));
                            if (!view) {
                                view = new converse.RosterGroupView({model: group});
                                this.add(group.get('name'), view.render());
                            }
                            if (idx === 0) {
                                this.$roster.append(view.$el);
                            } else {
                                this.appendGroup(view);
                            }
                        }.bind(this));
                    },

                    positionGroup: function (view) {
                        /* Place the group's DOM element in the correct alphabetical
                         * position amongst the other groups in the roster.
                         */
                        var $groups = this.$roster.find('.roster-group'),
                            index = $groups.length ? this.model.indexOf(view.model) : 0;
                        if (index === 0) {
                            this.$roster.append(view.$el);
                        } else if (index === (this.model.length - 1)) {
                            this.appendGroup(view);
                        } else {
                            $($groups.eq(index)).before(view.$el);
                        }
                        return this;
                    },

                    appendGroup: function (view) {
                        /* Add the group at the bottom of the roster
                         */
                        var $last = this.$roster.find('.roster-group').last();
                        var $siblings = $last.siblings('dd');
                        if ($siblings.length > 0) {
                            $siblings.last().after(view.$el);
                        } else {
                            $last.after(view.$el);
                        }
                        return this;
                    },

                    getGroup: function (name) {
                        /* Returns the group as specified by name.
                         * Creates the group if it doesn't exist.
                         */
                        var view = this.get(name);
                        if (view) {
                            return view.model;
                        }
                        return this.model.create({name: name, id: b64_sha1(name)});
                    },

                    addContactToGroup: function (contact, name) {
                        this.getGroup(name).contacts.add(contact);
                    },

                    addExistingContact: function (contact) {
                        var groups;
                        if (converse.roster_groups) {
                            groups = contact.get('groups');
                            if (groups.length === 0) {
                                groups = [HEADER_UNGROUPED];
                            }
                        } else {
                            groups = [HEADER_CURRENT_CONTACTS];
                        }
                        _.each(groups, _.bind(this.addContactToGroup, this, contact));
                    },

                    addRosterContact: function (contact) {
                        if (contact.get('subscription') === 'both' || contact.get('subscription') === 'to') {
                            this.addExistingContact(contact);
                        } else {
                            if ((contact.get('ask') === 'subscribe') || (contact.get('subscription') === 'from')) {
                                this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                            } else if (contact.get('requesting') === true) {
                                this.addContactToGroup(contact, HEADER_REQUESTING_CONTACTS);
                            }
                        }
                        return this;
                    },

                    groupToggle: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var $el = $(ev.target);
                        if ($el.hasClass("icon-opened")) {
                            this.$el.nextUntil('dt').slideUp();
                            $el.removeClass("icon-opened").addClass("icon-closed");
                            var tab = "#conversejs #converse-controlbox-official-rooms " + $el.attr("data-tab");
                            $(tab).hide();
                        } else {
                            $el.removeClass("icon-closed").addClass("icon-opened");
                            //this.model.save({state: converse.OPENED});
                            var tab = "#conversejs #converse-controlbox-official-rooms " + $el.attr("data-tab");
                            $(tab).show();
                        }
                    },

                    toggleRoomsList: function (widgets) {
                        widgets += converse.templates.official_group({
                            'label_name': __('Rooms'),
                            'label_tab': '.rosterview-room-item-list'
                        });

                        //item
                        var fragment = "<div class='rosterview-room-item-list' style='display: none;'>";

                        var rooms_list_json = $.ajax({
                            url: converse.imapi_url + converse.imapi_room_list,
                            data: {access_token: converse.access_token, pageIndex: 0, pageSize: 10000},
                            cache: false,
                            async: false
                        }).responseText;
                        var rooms_list = JSON.parse(rooms_list_json);
                        if (rooms_list && rooms_list.resultCode && rooms_list.resultCode == 1) {

                            var name, jid, i, fragment, c_m_l = converse.muc_room_list;
                            if (rooms_list.data && rooms_list.data.length > 0) {

                                for (var i = 0; i < rooms_list.data.length; i++) {
                                    var d = rooms_list.data[i];
                                    name = d.name;
                                    jid = d.jid + converse.muc_service_url;

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
                                        name = converse.htmlEncode(name);

                                        //添加到面板中
                                        var title_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + d.id + '&type=t&access_token=' + converse.access_token;
                                        fragment +=
                                            converse.templates.rosterview_room_item({
                                                'room_name': name,
                                                'jid_id': jid,
                                                'open_title': __('Click to open this online service'),
                                                'title_url': title_url,
                                                'default_img': converse.emoticons_file_path + converse.room_default_img
                                            });
                                    }

                                }

                            }
                        }
                        fragment += "</div>";
                        return widgets += fragment;
                    },

                    toggleOfficialList: function (widgets) {
                        widgets += (converse.templates.official_group({
                            'label_name': __('Official_list'),
                            'label_tab': '.officials-item-list'
                        }));

                        //item
                        var fragment = "<div class='officials-item-list' style='display: none;'>";

                        var official_list_json = $.ajax({
                            url: converse.imapi_url + converse.imapi_online_official_list,
                            data: {access_token: converse.access_token},
                            cache: false,
                            async: false
                        }).responseText;
                        var official_list = JSON.parse(official_list_json);
                        if (official_list && official_list.resultCode && official_list.resultCode == 1) {

                            if (official_list.data && official_list.data.length > 0) {
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
                        return widgets += fragment;
                    },

                    openOfficialChat: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var $el = $(ev.currentTarget);

                        if(converse.queryCreateRoomPanel()){
                            return;
                        }
                        var official = $el.attr("data-official").trim(),
                            jid = official + '@' + converse.domain,
                            name = $el.text();
                        //clear badge
                        if (converse.allow_chatlist) {
                            converse_api.chatlist.remove(jid);
                        }

                        return converse.chatboxviews.showChat({
                            'id': jid,
                            'jid': jid,
                            'fullname':  name.trim(),
                            'type': 'chat',
                            'box_id': b64_sha1(jid)
                        });
                    },

                    sendServiceRequest: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var $el = $(ev.currentTarget);
                        converse_api.rooms.online_service(null, $el.attr("data-official"));
                    },

                    setDefaultOfficial: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var $el = $(ev.target);
                        var result_json = $.ajax({
                            type: 'POST',
                            url: converse.imapi_url + converse.imapi_official_default,
                            data: {access_token: converse.access_token, officialId: $el.attr("data-official")},
                            async: false
                        }).responseText;
                        var result = JSON.parse(result_json);
                        if (result && result.resultCode && result.resultCode == 1) {
                            converse.default_official = $el.attr("data-official");

                            //update default official
                            $("#conversejs .controlbox-head .converse-create-online-panel .create-online-service-btn").attr("data-official", $el.attr("data-official"));

                            //update official list
                            $el.parent().parent().find('.official-group-item').each(function (index, element) {
                                if ($(element).find(".set-official-default").length > 0) {
                                    var data_official = $(element).find(".set-official-default").attr("data-official");

                                    if (Number(data_official) === Number($el.attr("data-official"))) {
                                        $(element).find(".set-official-default").remove();
                                    }

                                } else {
                                    var $official = $(element).find(".open-service"),
                                        data_official = $official.attr("data-official");

                                    if (Number(data_official) != Number($el.attr("data-official"))) {
                                        var set_official_info = '<a class="set-official-default icon-pushpin" style="float: right" title="' + __("Set to the default online customer service") + '" data-official="' + data_official + '" href="javascript:void(0);"></a>';
                                        $(element).append(set_official_info);
                                    }
                                }
                            });

                            //alert message
                            if (converse.new_modal) {
                                $.dialog('alert', __('prompt'), __('Settings updated successful'), 0);
                            } else {
                                alert(__('Settings updated successful'));
                            }
                        } else {
                            if (converse.new_modal) {
                                $.dialog('alert', __('prompt'), __('Settings updated fail'), 0);
                            } else {
                                alert(__('Settings updated fail'));
                            }
                        }
                    },

                    openRoom: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var $item = $(ev.currentTarget).find('.open-service-room');
                        var jid = $item.attr('data-room-jid').trim();
                        var name = $item.text().trim();

                        converse_api.chatlist.remove(jid);

                        var attrs = {nick: Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)), name: name};
                        converse_api.rooms.open(jid, attrs);
                    }
                });


                converse.RosterContactView = Backbone.View.extend({
                    tagName: 'dd',

                    events: {
                        "click .accept-xmpp-request": "acceptRequest",
                        "click .decline-xmpp-request": "declineRequest",
                        "click .open-chat": "openChat",
                        "mouseenter .open-chat": "friendInfo",
                        "click .remove-xmpp-contact": "removeContact"
                    },

                    initialize: function () {
                        this.model.on("change", this.render, this);
                        this.model.on("remove", this.remove, this);
                        this.model.on("destroy", this.remove, this);
                        this.model.on("open", this.openChat, this);
                    },

                    render: function () {
                        if (!this.mayBeShown()) {
                            this.$el.hide();
                            return this;
                        }
                        var item = this.model,
                            ask = item.get('ask'),
                            chat_status = item.get('chat_status'),
                            requesting = item.get('requesting'),
                            subscription = item.get('subscription'),
                            groups = item.get('groups');

                        var classes_to_remove = [
                            'current-xmpp-contact',
                            'pending-xmpp-contact',
                            'requesting-xmpp-contact'
                        ].concat(_.keys(STATUSES));

                        _.each(classes_to_remove,
                            function (cls) {
                                if (this.el.className.indexOf(cls) !== -1) {
                                    this.$el.removeClass(cls);
                                }
                            }, this);
                        this.$el.addClass(chat_status).data('status', chat_status);

                        if ((ask === 'subscribe') || (subscription === 'from')) {
                            /* ask === 'subscribe'
                             *      Means we have asked to subscribe to them.
                             *
                             * subscription === 'from'
                             *      They are subscribed to use, but not vice versa.
                             *      We assume that there is a pending subscription
                             *      from us to them (otherwise we're in a state not
                             *      supported by converse.js).
                             *
                             *  So in both cases the user is a "pending" contact.
                             */
                            //this.$el.addClass('pending-xmpp-contact');

                            //获取用户是否有头像hasAvatar
                            var user_info = converse.getUserInfo2(Strophe.getNodeFromJid(item.id)),
                                default_img = converse.emoticons_file_path + converse.user_default_img,
                                avatar_url = default_img;

                            if (user_info && user_info.hasAvatar) {
                                avatar_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + Strophe.getNodeFromJid(item.id) + '&type=t&access_token=' + converse.access_token;
                            }

                            this.$el.addClass('current-xmpp-contact');
                            this.$el.html(converse.templates.pending_contact(
                                _.extend(item.toJSON(), {
                                    'desc_status': STATUSES[chat_status || 'offline'],
                                    'desc_chat': __('Click to chat with this contact'),
                                    'desc_remove': __('Click to remove this contact'),
                                    'title_fullname': __('Name'),
                                    'allow_contact_removal': true,
                                    'user_avatar_url': avatar_url,
                                    'default_img': default_img
                                })
                            ));
                        } else if (requesting === true) {
                            this.$el.addClass('requesting-xmpp-contact');
                            this.$el.html(converse.templates.requesting_contact(
                                _.extend(item.toJSON(), {
                                    'desc_accept': __("Click to accept this contact request"),
                                    'desc_decline': __("Click to decline this contact request"),
                                    'allow_chat_pending_contacts': converse.allow_chat_pending_contacts
                                })
                            ));

                        } else if (subscription === 'both' || subscription === 'to') {
                            var isShowDel = converse.allow_contact_removal;
                            if (groups && groups.length > 0 && groups[0] === '我的同事') {
                                isShowDel = false;
                            }

                            //获取用户是否有头像hasAvatar
                            var user_info = converse.getUserInfo2(Strophe.getNodeFromJid(item.id)),
                                default_img = converse.emoticons_file_path + converse.user_default_img,
                                avatar_url = default_img;

                            if (user_info && user_info.hasAvatar) {
                                avatar_url = converse.imapi_url + converse.imapi_download_avatar + '?userId=' + Strophe.getNodeFromJid(item.id) + '&type=t&access_token=' + converse.access_token;
                            }

                            this.$el.addClass('current-xmpp-contact');
                            this.$el.removeClass(_.without(['both', 'to'], subscription)[0]).addClass(subscription);
                            this.$el.html(converse.templates.roster_item(
                                _.extend(item.toJSON(), {
                                    //'desc_status': STATUSES[chat_status||'offline'],
                                    'desc_chat': __('Click to chat with this contact'),
                                    'desc_remove': __('Click to remove this contact'),
                                    'title_fullname': __('Name'),
                                    'allow_contact_removal': isShowDel,
                                    'user_avatar_url': avatar_url,
                                    'default_img': default_img
                                })
                            ));
                        }
                        return this;
                    },

                    isGroupCollapsed: function () {
                        /* Check whether the group in which this contact appears is
                         * collapsed.
                         */
                        // XXX: this sucks and is fragile.
                        // It's because I tried to do the "right thing"
                        // and use definition lists to represent roster groups.
                        // If roster group items were inside the group elements, we
                        // would simplify things by not having to check whether the
                        // group is collapsed or not.
                        var name = this.$el.prevAll('dt:first').data('group');
                        var group = converse.rosterview.model.where({'name': name})[0];
                        if (group && group.get('state') && group.get('state') === converse.CLOSED) {
                            return true;
                        }
                        return false;
                    },

                    mayBeShown: function () {
                        /* Return a boolean indicating whether this contact should
                         * generally be visible in the roster.
                         *
                         * It doesn't check for the more specific case of whether
                         * the group it's in is collapsed (see isGroupCollapsed).
                         */
                        var chatStatus = this.model.get('chat_status');
                        if ((converse.show_only_online_users && chatStatus !== 'online') ||
                            (converse.hide_offline_users && chatStatus === 'offline')) {
                            // If pending or requesting, show
                            if ((this.model.get('ask') === 'subscribe') ||
                                (this.model.get('subscription') === 'from') ||
                                (this.model.get('requesting') === true)) {
                                return true;
                            }
                            return false;
                        }
                        return true;
                    },

                    openChat: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }

                        var jid = this.model.get('id');
                        //客服向客户反向发起服务号，agent_official_id通过设置指定客服所在默认服务号
                        if(converse.converse_complete_model){
                            if(converse.is_agent){
                                if(converse.queryUserIsAgent()){
                                    var send_user_id = Strophe.unescapeNode(Strophe.getNodeFromJid(this.model.get('id'))),
                                        user = converse.getUserInfo2(Number(send_user_id)),
                                        official = converse.officialInfo(Number(converse.agent_official_id)),
                                        official_name = official && official.officialName ? official.officialName : null,
                                        room_name = user ? user.nickname  + '(' + official_name + ')' : room.nickname + '(' + official_name + ')',
                                        send_room_jid1 = 'online_' + converse.agent_official_id + "_" + send_user_id,
                                        send_room_jid = 'online_' + converse.agent_official_id + "_" + send_user_id + converse.muc_service_url;

                                    var attrs = {
                                        nick: Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)),
                                        name: room_name
                                    };

                                    //查看会话是否已存在
                                    var room_list = converse.muc_room_list,
                                        is_exist = false;
                                    if(room_list && room_list.length > 0){
                                        for(var r=0;r<room_list.length;r++){
                                            if(send_room_jid1 === room_list[r].jid){
                                                is_exist = true;
                                                break;
                                            }
                                        }
                                    }

                                    if(is_exist){
                                        converse_api.rooms.open(send_room_jid, attrs);
                                        return ;
                                    }

                                    $.post(converse.imapi_url + converse.imapi_session_add, {
                                        officialId: converse.agent_official_id,
                                        access_token: converse.access_token,
                                        userId: Strophe.unescapeNode(Strophe.getNodeFromJid(this.model.get('id')))
                                    }, function (data, status) {

                                        if (data && data.resultCode == 1) {
                                            if(!data.data.newCreated){

                                                var room = data.data,
                                                    room_jid = room.jid + converse.muc_service_url;

                                                //将数据保存在变量中以便查询时使用
                                                converse.add_room_list(room, false);

                                                var chatroom = converse.createChatRoom({
                                                    'id': room_jid,
                                                    'jid': room_jid,
                                                    'name': room_name || Strophe.unescapeNode(Strophe.getNodeFromJid(room_jid)) ,
                                                    'type': 'chatroom',
                                                    'box_id': b64_sha1(room_jid)
                                                });

                                                converse.editOfficialList(room_jid, room_name, room.id);

                                                if(converse.allow_chatlist){

                                                    var user_id = room.jid.split('_')[2],
                                                        official_id = room.jid.split('_')[1],
                                                        c_jid = Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid));

                                                    if(c_jid != official_id && c_jid != user_id &&
                                                        ((!room.createUserId) || (room.createUserId && Number(room.createUserId) != Number(c_jid)))){
                                                        converse_api.chatlist.add(room_jid, 'groupchat', true, 1, false);
                                                    } else {
                                                        converse_api.chatlist.add(room_jid, 'groupchat', false, 0, false);
                                                    }

                                                }
                                            }
                                        } else {
                                            alert('发起失败');
                                        }
                                    });
                                    return;
                                }
                            }

                        }

                        if(converse.queryCreateRoomPanel()){
                            return;
                        }

                        //clear badge
                        if (converse.allow_chatlist) {
                            converse_api.chatlist.remove(jid);
                        }

                        return converse.chatboxviews.showChat(this.model.attributes);
                    },

                    friendInfo: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        var aTarget = $(ev.currentTarget),
                            title = aTarget.attr('title');

                        if (title) {
                            return;
                        }
                        var user_id = this.model.attributes.user_id;
                        var user = converse.getUserInfo2(user_id);
                        if (user && user.name) {
                        } else {
                            user = converse.getUserInfo(user_id);
                        }
                        
                        if(!user){
                            return;
                        }

                        var sex = '',
                            birthday = '',
                            companyName = '',
                            email = '',
                            name = '',
                            telephone = '',
                            nickname = '';

                        if((typeof(user.birthday) === "undefined") || user.birthday === null || !/^\d{2,}$/.test($.trim(user.birthday))){
                            birthday = '';
                        } else {
                            birthday = moment(user.birthday*1000).format('YYYY-MM-DD');
                        }
                        if (user.sex && !(typeof(user.sex) === "undefined") && user.sex === 1) {
                            sex = '男';
                        } else {
                            sex = '女';
                        }
                        if (user.companyName && !(typeof(user.companyName) === "undefined")) {
                            companyName = user.companyName;
                        }
                        if (user.email && !(typeof(user.email) === "undefined")) {
                            email = user.email;
                        }
                        if (user.name && !(typeof(user.name) === "undefined")) {
                            name = user.name;
                        }
                        if (user.nickname && !(typeof(user.nickname) === "undefined")) {
                            nickname = user.nickname;
                        }
                        if (user.telephone && !(typeof(user.nickname) === "undefined")) {
                            telephone = user.telephone;
                        }

                        var text = converse.templates.roster_a({
                            'title_nickname': __('title_nickname'),
                            'nickname': nickname,
                            'title_name': __('title_name'),
                            'name': name,
                            'title_sex': __('title_sex'),
                            'sex': sex,
                            'title_birthday': __('title_birthday'),
                            'birthday': birthday,
                            'title_telephone': __('title_telephone'),
                            'telephone': telephone,
                            'title_email': __('title_email'),
                            'email': email,
                            'title_companyName': __('title_companyName'),
                            'companyName': companyName
                        });
                        //var text = '昵称:'+nickname+'</br>性别:'+sex+'&#13;出生日期:'+birthday+'&#13;手机号码:'+telephone+'&#13;邮箱:'+email+'&#13;公司:'+companyName+'';
                        aTarget.attr('title', text);
                    },

                    removeContact: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        if (!converse.allow_contact_removal) {
                            return;
                        }

                        if (converse.new_modal) {
                            var _this = this;
                            $.dialog('confirm', __('prompt'), __("Are you sure you want to remove this contact?"), 0, function () {
                                $.closeDialog();

                                var user_id = Strophe.getNodeFromJid(_this.model.get('jid'));

                                var result_json = $.ajax({
                                    url: converse.imapi_url + converse.imapi_friend_del,
                                    data: {toUserId: user_id, access_token: converse.access_token},
                                    cache: false,
                                    async: false
                                }).responseText;
                                var result = JSON.parse(result_json);
                                if (result && result.resultCode && result.resultCode === 1) {
                                    //发送一条信息

                                    var msg_text = '{"fromUserId":"' + Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)) + '","fromUserName":"' + converse.nick_name + '","timeSend":' + parseInt(moment() / 1000) + ',"type": 505}';
                                    var msg = $msg({
                                        to: _this.model.get('jid'),
                                        from: converse.connection.jid,
                                        type: 'chat',
                                        id: converse.connection.getUniqueId()
                                    }).c("body").t(msg_text).up()
                                        .c("x", {xmlns: "jabber:x:event"}).c("composing");
                                    converse.connection.send(msg);

                                    converse.delFriendsList(user_id);

                                    _this.model.destroy();
                                    _this.remove();

                                    var iq = $iq({type: 'set'})
                                        .c('query', {xmlns: Strophe.NS.ROSTER})
                                        .c('item', {jid: _this.model.get('jid'), subscription: "remove"});
                                    converse.connection.sendIQ(iq,
                                        function (iq) {

                                        }.bind(_this),
                                        function (err) {
                                            //alert(__("Sorry, there was an error while trying to remove "+name+" as a contact."));
                                            console.log(err);
                                        }
                                    );
                                }
                            });
                        } else {
                            var result = confirm(__("Are you sure you want to remove this contact?"));
                            if (result === true) {

                                var user_id = Strophe.getNodeFromJid(this.model.get('jid'));

                                var result_json = $.ajax({
                                    url: converse.imapi_url + converse.imapi_friend_del,
                                    data: {toUserId: user_id, access_token: converse.access_token},
                                    cache: false,
                                    async: false
                                }).responseText;
                                var result = JSON.parse(result_json);
                                if (result && result.resultCode && result.resultCode === 1) {
                                    //发送一条信息

                                    var msg_text = '{"fromUserId":"' + Strophe.unescapeNode(Strophe.getNodeFromJid(converse.jid)) + '","fromUserName":"' + converse.nick_name + '","timeSend":' + parseInt(moment() / 1000) + ',"type": 505}';
                                    var msg = $msg({
                                        to: this.model.get('jid'),
                                        from: converse.connection.jid,
                                        type: 'chat',
                                        id: converse.connection.getUniqueId()
                                    }).c("body").t(msg_text).up()
                                        .c("x", {xmlns: "jabber:x:event"}).c("composing");
                                    converse.connection.send(msg);

                                    converse.delFriendsList(user_id);

                                    this.model.destroy();
                                    this.remove();

                                    var iq = $iq({type: 'set'})
                                        .c('query', {xmlns: Strophe.NS.ROSTER})
                                        .c('item', {jid: this.model.get('jid'), subscription: "remove"});
                                    converse.connection.sendIQ(iq,
                                        function (iq) {

                                        }.bind(this),
                                        function (err) {
                                            //alert(__("Sorry, there was an error while trying to remove "+name+" as a contact."));
                                            console.log(err);
                                        }
                                    );
                                }
                            }
                        }
                    },

                    acceptRequest: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        converse.roster.sendContactAddIQ(
                            this.model.get('jid'),
                            this.model.get('fullname'),
                            [],
                            function () {
                                this.model.authorize().subscribe();
                            }.bind(this)
                        );
                    },

                    declineRequest: function (ev) {
                        if (ev && ev.preventDefault) {
                            ev.preventDefault();
                        }

                        if (converse.new_modal) {
                            var _this = this;
                            $.dialog('confirm', __('prompt'), __("Are you sure you want to decline this contact request?"), 0, function () {
                                $.closeDialog();

                                _this.model.unauthorize().destroy();
                                return _this;
                            });
                        } else {
                            var result = confirm(__("Are you sure you want to decline this contact request?"));
                            if (result === true) {
                                this.model.unauthorize().destroy();
                            }
                            return this;
                        }
                    }
                });


                converse.RosterGroupView = Backbone.Overview.extend({
                    tagName: 'dt',
                    className: 'roster-group',
                    events: {
                        "click a.group-toggle": "toggle"
                    },

                    initialize: function () {
                        this.model.contacts.on("add", this.addContact, this);
                        this.model.contacts.on("change:subscription", this.onContactSubscriptionChange, this);
                        this.model.contacts.on("change:requesting", this.onContactRequestChange, this);
                        this.model.contacts.on("change:chat_status", function (contact) {
                            // This might be optimized by instead of first sorting,
                            // finding the correct position in positionContact
                            this.model.contacts.sort();
                            this.positionContact(contact).render();
                        }, this);
                        this.model.contacts.on("destroy", this.onRemove, this);
                        this.model.contacts.on("remove", this.onRemove, this);
                        converse.roster.on('change:groups', this.onContactGroupChange, this);
                    },

                    render: function () {
                        this.$el.attr('data-group', this.model.get('name'));
                        this.$el.html(
                            $(converse.templates.group_header({
                                label_group: this.model.get('name'),
                                desc_group_toggle: this.model.get('description'),
                                toggle_state: this.model.get('state')
                            }))
                        );
                        return this;
                    },

                    addContact: function (contact) {

                        var jid = contact.get('id');
                        if (jid) {
                            var id = Strophe.getNodeFromJid(jid);

                            var user = converse.getUserInfo2(id);
                            if (user) {
                                contact.set('fullname', user.nickname);
                            }

                        }

                        var view = new converse.RosterContactView({model: contact});
                        this.add(contact.get('id'), view);
                        view = this.positionContact(contact).render();
                        if (view.mayBeShown()) {
                            if (this.model.get('state') === converse.CLOSED) {
                                if (view.$el[0].style.display !== "none") {
                                    view.$el.hide();
                                }
                                if (!this.$el.is(':visible')) {
                                    this.$el.show();
                                }
                            } else {
                                if (this.$el[0].style.display !== "block") {
                                    this.show();
                                }
                            }
                        }
                    },

                    positionContact: function (contact) {
                        /* Place the contact's DOM element in the correct alphabetical
                         * position amongst the other contacts in this group.
                         */
                        var view = this.get(contact.get('id'));
                        var index = this.model.contacts.indexOf(contact);
                        view.$el.detach();
                        if (index === 0) {
                            this.$el.after(view.$el);
                        } else if (index === (this.model.contacts.length - 1)) {
                            this.$el.nextUntil('dt').last().after(view.$el);
                        } else {
                            this.$el.nextUntil('dt').eq(index).before(view.$el);
                        }
                        return view;
                    },

                    show: function () {
                        this.$el.show();
                        _.each(this.getAll(), function (view) {
                            if (view.mayBeShown() && !view.isGroupCollapsed()) {
                                view.$el.show();
                            }
                        });
                        return this;
                    },

                    hide: function () {
                        this.$el.nextUntil('dt').addBack().hide();
                    },

                    filter: function (q, type) {
                        /* Filter the group's contacts based on the query "q".
                         * The query is matched against the contact's full name.
                         * If all contacts are filtered out (i.e. hidden), then the
                         * group must be filtered out as well.
                         */
                        var matches;
                        if (q.length === 0) {
                            if (this.model.get('state') === converse.OPENED) {
                                this.model.contacts.each(function (item) {
                                    var view = this.get(item.get('id'));
                                    if (view.mayBeShown() && !view.isGroupCollapsed()) {
                                        view.$el.show();
                                    }
                                }.bind(this));
                            }
                            this.showIfNecessary();
                        } else {
                            q = q.toLowerCase();
                            if (type === 'state') {
                                if (this.model.get('name') === HEADER_REQUESTING_CONTACTS) {
                                    // When filtering by chat state, we still want to
                                    // show requesting contacts, even though they don't
                                    // have the state in question.
                                    matches = this.model.contacts.filter(
                                        function (contact) {
                                            return utils.contains.not('chat_status', q)(contact) && !contact.get('requesting');
                                        }
                                    );
                                } else {
                                    matches = this.model.contacts.filter(
                                        utils.contains.not('chat_status', q)
                                    );
                                }
                            } else {
                                matches = this.model.contacts.filter(
                                    utils.contains.not('fullname', q)
                                );
                            }
                            if (matches.length === this.model.contacts.length) {
                                // hide the whole group
                                this.hide();
                            } else {
                                _.each(matches, function (item) {
                                    this.get(item.get('id')).$el.hide();
                                }.bind(this));
                                _.each(this.model.contacts.reject(utils.contains.not('fullname', q)), function (item) {
                                    this.get(item.get('id')).$el.show();
                                }.bind(this));
                                this.showIfNecessary();
                            }
                        }
                    },

                    showIfNecessary: function () {
                        if (!this.$el.is(':visible') && this.model.contacts.length > 0) {
                            this.$el.show();
                        }
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
                        } else {
                            $el.removeClass("icon-closed").addClass("icon-opened");
                            this.model.save({state: converse.OPENED});
                            this.filter(
                                converse.rosterview.$('.roster-filter').val() || '',
                                converse.rosterview.$('.filter-type').val()
                            );
                        }
                    },

                    onContactGroupChange: function (contact) {
                        var in_this_group = _.contains(contact.get('groups'), this.model.get('name'));
                        var cid = contact.get('id');
                        var in_this_overview = !this.get(cid);
                        if (in_this_group && !in_this_overview) {
                            this.model.contacts.remove(cid);
                        } else if (!in_this_group && in_this_overview) {
                            this.addContact(contact);
                        }
                    },

                    onContactSubscriptionChange: function (contact) {
                        if ((this.model.get('name') === HEADER_PENDING_CONTACTS) && contact.get('subscription') !== 'from') {
                            this.model.contacts.remove(contact.get('id'));
                        }
                    },

                    onContactRequestChange: function (contact) {
                        if ((this.model.get('name') === HEADER_REQUESTING_CONTACTS) && !contact.get('requesting')) {
                            /* We suppress events, otherwise the remove event will
                             * also cause the contact's view to be removed from the
                             * "Pending Contacts" group.
                             */
                            this.model.contacts.remove(contact.get('id'), {'silent': true});
                            // Since we suppress events, we make sure the view and
                            // contact are removed from this group.
                            this.get(contact.get('id')).remove();
                            this.onRemove(contact);
                        }
                    },

                    onRemove: function (contact) {
                        this.remove(contact.get('id'));
                        if (this.model.contacts.length === 0) {
                            this.$el.hide();
                        }
                    }
                });

                /* -------- Event Handlers ----------- */

                var initRoster = function () {
                    /* Create an instance of RosterView once the RosterGroups
                     * collection has been created (in converse-core.js)
                     */
                    converse.rosterview = new converse.RosterView({
                        'model': converse.rostergroups
                    });
                    converse.rosterview.render();
                };
                converse.on('rosterInitialized', initRoster);
                converse.on('rosterReadyAfterReconnection', initRoster);
            }
        });
    }
}));
