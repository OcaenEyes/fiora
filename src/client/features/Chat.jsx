import React, { Component } from 'react';
import ReactDom from 'react-dom';
import { Layout, Menu, Button, Tooltip, Input, message } from 'antd';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ImmutablePropTypes from 'react-immutable-proptypes';
import { immutableRenderDecorator } from 'react-immutable-render-mixin';
import copy from 'copy-to-clipboard';

import Linkman from 'features/Linkman';
import Message from 'features/Message';
import GroupUser from 'features/GroupUser';
import Icon from 'components/Icon';
import IconButton from 'components/IconButton';
import SelectExpression from 'features/SelectExpression';

import 'styles/feature/chat.less';

import action from '../state/action';

const { Content, Sider } = Layout;

function insertAtCursor(input, value) {
    if (document.selection) {
        input.focus();
        const sel = document.selection.createRange();
        sel.text = value;
        sel.select();
    } else if (input.selectionStart || input.selectionStart === '0') {
        const startPos = input.selectionStart;
        const endPos = input.selectionEnd;
        const restoreTop = input.scrollTop;
        input.value = input.value.substring(0, startPos) + value + input.value.substring(endPos, input.value.length);
        if (restoreTop > 0) {
            input.scrollTop = restoreTop;
        }
        input.focus();
        input.selectionStart = startPos + value.length;
        input.selectionEnd = startPos + value.length;
    } else {
        input.value += value;
        input.focus();
    }
}

@immutableRenderDecorator
class Chat extends Component {
    static contextTypes = {
        router: PropTypes.object.isRequired,
    }
    static propTypes = {
        $$groups: ImmutablePropTypes.list,
        currentGroup: PropTypes.string.isRequired,
        userListSollapsed: PropTypes.bool.isRequired,
        insertInputValue: PropTypes.string,
        guest: PropTypes.bool,
    }
    constructor(...args) {
        super(...args);
        this.onScrollHandle = null;
        this.updateOnlineTask = null;
        this.openUserList = action.setUserListSollapsed.bind(null, false);
        this.closeUserList = action.setUserListSollapsed.bind(null, true);
        this.openSelectExpression = action.setSelectExpression.bind(null, true);
    }
    componentDidMount() {
        this.updateOnlineTask = setInterval(() => {
            const $$group = this.getCurrentGroup();
            if ($$group) {
                action.updateGroupOnline($$group.get('_id'));
            }
        }, 60000);
    }
    componentWillUpdate(nextProps) {
        if (nextProps.insertInputValue && this.props.insertInputValue !== nextProps.insertInputValue) {
            insertAtCursor(ReactDom.findDOMNode(this.input), nextProps.insertInputValue);
        }
    }
    componentDidUpdate(prevProps) {
        if (!prevProps.$$groups && this.props.$$groups) {
            action.selectGroup(this.context.router.route.match.params.name);
        }
    }
    componentWillUnmount() {
        clearImmediate(this.updateOnlineTask);
    }
    getCurrentGroup = () => {
        const { $$groups, currentGroup } = this.props;
        return $$groups && $$groups.find(
            ($$g) => $$g.get('name') === currentGroup,
        );
    }
    handleSelectGroup = ({ key }) => {
        action.selectGroup(key);
        this.context.router.history.push(`/group/${key}`);
    }
    handleInputKeyDown = (e) => {
        if (e.keyCode === 9) {
            e.preventDefault();
            return 0;
        }
    }
    handleInputEnter = (e) => {
        if (!e.shiftKey) {
            const $$group = this.getCurrentGroup();
            action.sendMessage($$group.get('_id'), 'group', {
                type: 'text',
                content: e.target.value,
            }).then((res) => {
                if (res.status !== 201) {
                    message.error(`消息发送失败, ${res.data}`);
                }
            });
            e.target.style.height = '40px';
            e.target.value = '';
            e.preventDefault();
        }
    }
    handleMessageListScroll = (e) => {
        const $messageList = e.target;
        if (this.onScrollHandle) {
            clearTimeout(this.onScrollHandle);
        }
        this.onScrollHandle = setTimeout(() => {
            action.setAutoScroll($messageList.scrollHeight - $messageList.scrollTop - $messageList.clientHeight < $messageList.clientHeight / 2);
        }, 50);
    }
    handleShareGroup = () => {
        if (this.props.currentGroup) {
            copy(`${window.location.origin}/group/${this.props.currentGroup}`);
        } else {
            copy(window.location.href);
        }
        message.info('已复制邀请链接, 发送给你的朋友吧');
    }
    jumpTo = (path) => {
        this.context.router.history.push(path);
    }
    renderGroups = () => {
        const { $$groups, currentGroup } = this.props;
        if (!$$groups) {
            return null;
        }
        return (
            <Menu className="linkman-list" mode="inline" selectedKeys={[currentGroup]} onSelect={this.handleSelectGroup}>
                {
                    $$groups.map(($$group) => {
                        const name = $$group.get('name');
                        const avatar = $$group.get('avatar');
                        const $$messages = $$group.get('messages');
                        const $$lastMessage = $$messages.get($$messages.size - 1);
                        let lastMessage = '';
                        if ($$lastMessage) {
                            lastMessage = `${$$lastMessage.getIn(['from', 'username'])}: ${$$lastMessage.get('content')}`;
                        }
                        return (
                            <Menu.Item key={name}>
                                <Linkman
                                    avatar={avatar}
                                    username={name}
                                    content={$$lastMessage ? lastMessage : '...'}
                                />
                            </Menu.Item>
                        );
                    })
                }
            </Menu>
        );
    }
    renderMessage = () => {
        const $$messages = this.getCurrentGroup().get('messages');
        return $$messages.map(($$message, index) => (
            <Message
                key={`message${$$message.get('_id')}`}
                id={$$message.get('_id')}
                avatar={$$message.getIn(['from', 'avatar'])}
                username={$$message.getIn(['from', 'username'])}
                time={$$message.get('createTime')}
                type={$$message.get('type')}
                content={$$message.get('content')}
                status={$$message.get('status')}
                isSimple={index > 0 ? $$messages.getIn([index - 1, 'from', '_id']) === $$message.getIn(['from', '_id']) : false}
            />
        ));
    }
    render() {
        const { userListSollapsed, guest } = this.props;
        const $$group = this.getCurrentGroup();
        return (
            <Layout className="feature-chat">
                <Layout className="wrap">
                    <Sider className="sider" width={300}>
                        {this.renderGroups()}
                    </Sider>
                    {
                        $$group ?
                            <Layout>
                                <Layout className="window">
                                    <div className="header">
                                        <div className="avatar-name">
                                            <p className="name">{$$group.get('name')}</p>
                                        </div>
                                        <div className="button-group">
                                            <Tooltip title="分享群组" mouseEnterDelay={0.5}>
                                                <Button shape="circle" onClick={this.handleShareGroup}>
                                                    <Icon icon="icon-share-copy" size={14} />
                                                </Button>
                                            </Tooltip>
                                            <Tooltip title={userListSollapsed ? '打开用户列表' : '关闭用户列表'} mouseEnterDelay={0.5}>
                                                <Button shape="circle" onClick={userListSollapsed ? this.openUserList : this.closeUserList}>
                                                    <Icon icon={userListSollapsed ? 'icon-left' : 'icon-right'} size={14} />
                                                </Button>
                                            </Tooltip>
                                        </div>
                                    </div>
                                    <Content className="message-list" onScroll={this.handleMessageListScroll}>
                                        {this.renderMessage()}
                                    </Content>
                                    {
                                        guest ?
                                            <div className="guest">
                                                <h3>
                                                    游客用户不能发言, 请
                                                    <a onClick={this.jumpTo.bind(this, '/login')} >登录</a>
                                                    或
                                                    <a onClick={this.jumpTo.bind(this, '/signin')} >注册</a>
                                                </h3>
                                            </div>
                                        :
                                            <div className="footer">
                                                <div>
                                                    <Input
                                                        className="input"
                                                        type="textarea"
                                                        placeholder="输入要发送的消息"
                                                        autosize={{ minRows: 1, maxRows: 5 }}
                                                        onKeyDown={this.handleInputKeyDown}
                                                        onPressEnter={this.handleInputEnter}
                                                        ref={(i) => this.input = i}
                                                    />
                                                    <div className="button-container">
                                                        <IconButton icon="icon-expression" size={20} onClick={this.openSelectExpression} />
                                                    </div>
                                                    <SelectExpression />
                                                </div>
                                            </div>
                                    }
                                </Layout>
                                <Sider className="user-list" collapsed={userListSollapsed} collapsible collapsedWidth={0} trigger={null} width={240}>
                                    <div>
                                        <div className="title">
                                            <p>在线成员: {$$group.get('onlines').size}/{$$group.get('members')}</p>
                                        </div>
                                        <ul className="group-user-list">
                                            {
                                                $$group.get('onlines').map(($$online, i) => (
                                                    <GroupUser key={i} avatar={$$online.getIn(['user', 'avatar'])} username={$$online.getIn(['user', 'username'])} os={$$online.get('os')} browser={$$online.get('browser')} />
                                                ))
                                            }
                                        </ul>
                                    </div>
                                </Sider>
                            </Layout>
                        :
                            <div className="no-select">
                                <img src={require('../assets/images/fiora_cute.png')} />
                                <h4>请选择左侧联系人</h4>
                            </div>
                    }
                </Layout>
            </Layout>
        );
    }
}

export default connect(
    ($$state) => ({
        $$groups: $$state.getIn(['user', 'groups']),
        currentGroup: $$state.getIn(['currentGroup']),
        userListSollapsed: $$state.getIn(['view', 'userListSollapsed']),
        insertInputValue: $$state.getIn(['view', 'insertInputValue']),
        guest: $$state.getIn(['user', 'guest']),
    }),
)(Chat);
