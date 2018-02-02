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